import "dotenv/config";
import express from "express";
import cors from "cors";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { chat_simples } from "./llm.js";
import { clonar_repositorio, criar_branch, commit_e_push } from "./ferramentas.js";
import {
  criarProjeto,
  buscarProjetoPorUrl,
  buscarProjetoPorCaminho,
  atualizarUltimoAcesso,
  atualizarCaminhoProjeto,
  criarMudancaPendente,
  buscarMudancasPendentes,
  aprovarMudanca,
  rejeitarMudanca,
  registrarHistorico,
  buscarHistorico,
  salvarConversa,
  buscarConversas,
  listarProjetos
} from "./database.js";
import {
  gerarMudancaInteligente,
  analisarDiferencas,
  gerarDiff
} from "./analisador.js";

const app = express();
app.use(cors());
app.options('*', cors());
app.use(express.json({ limit: "10mb" }));

app.get("/saude", (_req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.json({ ok: true });
});

const estado = {
  pasta: null,
  projetoId: null,
  url: null,
};

async function pathExists(target) {
  try {
    await fs.promises.access(target, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function sanitizeWorkspaceName(nome) {
  if (!nome) return "workspace";
  return nome
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "workspace";
}

async function resolveWorkspaceDirectory(nomeProjeto) {
  const baseDir = path.join(os.homedir(), "Downloads", "agente");
  await fs.promises.mkdir(baseDir, { recursive: true });
  const safeName = sanitizeWorkspaceName(nomeProjeto);
  let destino = path.join(baseDir, safeName);
  let contador = 1;

  while (await pathExists(destino)) {
    destino = path.join(baseDir, `${safeName}_${contador}`);
    contador += 1;
    if (contador > 50) {
      destino = path.join(baseDir, `${safeName}_${Date.now()}`);
      break;
    }
  }

  return destino;
}

async function listar_arvore(base) {
  const ignorar = new Set([".git", "node_modules", ".next", "dist", "build", ".agent"]);
  const resultado = [];
  const maxItens = 5000;
  const maxProfundidade = 6;
  let count = 0;

  async function walk(dir, depth) {
    if (depth > maxProfundidade) return;
    const itens = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const ent of itens) {
      if (count >= maxItens) return;
      if (ignorar.has(ent.name)) continue;
      const full = path.join(dir, ent.name);
      const rel = path.relative(base, full).replace(/\\/g, "/");
      resultado.push({ path: rel, tipo: ent.isDirectory() ? "dir" : "file" });
      count++;
      if (ent.isDirectory()) await walk(full, depth + 1);
    }
  }

  await walk(base, 0);
  return resultado;
}

app.post("/repo/abrir", async (req, res) => {
  try {
    const { repositorioUrl, branchBase, token, caminhoLocal } = req.body || {};

    if (!repositorioUrl && !caminhoLocal) {
      return res.status(400).json({ erro: "repositorioUrl ou caminhoLocal é obrigatório" });
    }

    let pasta = caminhoLocal;
    let projetoExistente = null;

    if (caminhoLocal) {
      projetoExistente = buscarProjetoPorCaminho(caminhoLocal);
    } else if (repositorioUrl) {
      projetoExistente = buscarProjetoPorUrl(repositorioUrl);
    }

      const nomeProjeto = repositorioUrl
      ? repositorioUrl.split("/").pop().replace(".git", "")
      : caminhoLocal
        ? path.basename(caminhoLocal)
        : "projeto";

    if (!projetoExistente) {
      if (!caminhoLocal && repositorioUrl) {
        pasta = await resolveWorkspaceDirectory(nomeProjeto);
        await clonar_repositorio(repositorioUrl, pasta, token);
        await criar_branch(pasta, `agente/${Date.now()}`, branchBase);
      }

      const projetoId = criarProjeto(nomeProjeto, repositorioUrl || "", pasta, branchBase || "main");
      projetoExistente = { id: projetoId, nome: nomeProjeto };
      registrarHistorico(projetoId, "projeto_criado", "Projeto aberto pela primeira vez");
    } else {
      pasta = projetoExistente.caminho_local;
      const projetoNome = projetoExistente.nome || nomeProjeto;

      if (!pasta && repositorioUrl) {
        pasta = await resolveWorkspaceDirectory(projetoNome);
        await clonar_repositorio(repositorioUrl, pasta, token);
        await criar_branch(pasta, `agente/${Date.now()}`, branchBase);
        atualizarCaminhoProjeto(projetoExistente.id, pasta);
      } else if (pasta && repositorioUrl && !(await pathExists(pasta))) {
        pasta = await resolveWorkspaceDirectory(projetoNome);
        await clonar_repositorio(repositorioUrl, pasta, token);
        await criar_branch(pasta, `agente/${Date.now()}`, branchBase);
        atualizarCaminhoProjeto(projetoExistente.id, pasta);
      }

      atualizarUltimoAcesso(projetoExistente.id);
      registrarHistorico(projetoExistente.id, "projeto_reaberto", "Projeto reaberto");
    }

    estado.pasta = pasta;
    estado.projetoId = projetoExistente.id;
    estado.url = repositorioUrl;

    const arvore = await listar_arvore(pasta);
    const conversas = buscarConversas(projetoExistente.id, 10);
    const historico = buscarHistorico(projetoExistente.id, 20);
    const mudancasPendentes = buscarMudancasPendentes(projetoExistente.id);

    res.json({
      ok: true,
      projeto: projetoExistente,
      pasta,
      arvore,
      conversas: conversas.map(c => ({
        mensagem: c.mensagem,
        resposta: c.resposta,
        timestamp: c.timestamp
      })),
      historico: historico.map(h => ({
        tipo: h.tipo,
        descricao: h.descricao,
        timestamp: h.timestamp
      })),
      mudancasPendentes: mudancasPendentes.length
    });
  } catch (e) {
    res.status(500).json({ erro: String(e?.message || e) });
  }
});

app.get("/repo/tree", async (_req, res) => {
  try {
    if (!estado.pasta) return res.status(400).json({ erro: "Nenhum repositório aberto" });
    const arvore = await listar_arvore(estado.pasta);
    res.json({ arvore });
  } catch (e) {
    res.status(500).json({ erro: String(e?.message || e) });
  }
});

app.get("/repo/file", async (req, res) => {
  try {
    if (!estado.pasta) return res.status(400).json({ erro: "Nenhum repositório aberto" });
    const rel = req.query.path;
    if (!rel) return res.status(400).json({ erro: "path é obrigatório" });
    const full = path.join(estado.pasta, rel);
    const data = await fs.promises.readFile(full, "utf-8");
    res.type("text/plain").send(data);
  } catch (e) {
    res.status(500).json({ erro: String(e?.message || e) });
  }
});

app.post("/repo/save", async (req, res) => {
  try {
    if (!estado.pasta) return res.status(400).json({ erro: "Nenhum repositório aberto" });
    const { path: rel, conteudo } = req.body || {};
    if (!rel) return res.status(400).json({ erro: "path é obrigatório" });
    const full = path.join(estado.pasta, rel);
    await fs.promises.mkdir(path.dirname(full), { recursive: true });
    await fs.promises.writeFile(full, conteudo ?? "", "utf-8");

    if (estado.projetoId) {
      registrarHistorico(estado.projetoId, "arquivo_salvo", `Arquivo ${rel} salvo manualmente`);
    }

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ erro: String(e?.message || e) });
  }
});

app.post("/repo/commit", async (req, res) => {
  try {
    if (!estado.pasta) return res.status(400).json({ erro: "Nenhum repositório aberto" });
    const { mensagem } = req.body || {};
    await commit_e_push(estado.pasta, mensagem || "chore: atualizações via Agente");

    if (estado.projetoId) {
      registrarHistorico(estado.projetoId, "commit_realizado", mensagem || "Commit automático");
    }

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ erro: String(e?.message || e) });
  }
});

app.post("/chat/inteligente", async (req, res) => {
  try {
    if (!estado.pasta || !estado.projetoId) {
      return res.status(400).json({ erro: "Nenhum projeto aberto" });
    }

    const { mensagem } = req.body || {};
    if (!mensagem) return res.status(400).json({ erro: "mensagem é obrigatória" });

    const arvore = await listar_arvore(estado.pasta);
    const resultado = await gerarMudancaInteligente(mensagem, estado.projetoId, estado.pasta, arvore);

    if (resultado.mudancas && resultado.mudancas.length > 0) {
      for (const mudanca of resultado.mudancas) {
        const arquivoPath = path.join(estado.pasta, mudanca.arquivo);
        let original = "";

        try {
          original = await fs.promises.readFile(arquivoPath, "utf-8");
        } catch (e) {
          original = "";
        }

        const diff = gerarDiff(original, mudanca.conteudo_novo, mudanca.arquivo);
        const analise = await analisarDiferencas(original, mudanca.conteudo_novo);

        criarMudancaPendente(
          estado.projetoId,
          mudanca.arquivo,
          original,
          mudanca.conteudo_novo,
          diff,
          mudanca.descricao || "Alteração gerada pelo agente"
        );
      }

      const resposta = `Analisei sua solicita��ão e preparei ${resultado.mudancas.length} alteração(ões). Revise as mudanças pendentes e aprove para aplicar.`;

      salvarConversa(estado.projetoId, mensagem, resposta, JSON.stringify(resultado.analise));
      registrarHistorico(estado.projetoId, "mudancas_propostas", `${resultado.mudancas.length} alterações propostas`);

      res.json({
        resposta,
        mudancas: resultado.mudancas.length,
        analise: resultado.analise,
        mensagem_commit: resultado.mensagem_commit
      });
    } else {
      const resposta = await chat_simples(mensagem, "Repositório local aberto");
      salvarConversa(estado.projetoId, mensagem, resposta);
      res.json({ resposta, mudancas: 0 });
    }
  } catch (e) {
    res.status(500).json({ erro: String(e?.message || e) });
  }
});

app.get("/mudancas/pendentes", async (_req, res) => {
  try {
    if (!estado.projetoId) return res.status(400).json({ erro: "Nenhum projeto aberto" });

    const mudancas = buscarMudancasPendentes(estado.projetoId);
    res.json({ mudancas });
  } catch (e) {
    res.status(500).json({ erro: String(e?.message || e) });
  }
});

app.post("/mudancas/aprovar", async (req, res) => {
  try {
    if (!estado.pasta || !estado.projetoId) {
      return res.status(400).json({ erro: "Nenhum projeto aberto" });
    }

    const { mudancaId } = req.body || {};
    if (!mudancaId) return res.status(400).json({ erro: "mudancaId é obrigatório" });

    const mudancas = buscarMudancasPendentes(estado.projetoId);
    const mudanca = mudancas.find(m => m.id === mudancaId);

    if (!mudanca) return res.status(404).json({ erro: "Mudança não encontrada" });

    const arquivoPath = path.join(estado.pasta, mudanca.arquivo);
    await fs.promises.mkdir(path.dirname(arquivoPath), { recursive: true });
    await fs.promises.writeFile(arquivoPath, mudanca.conteudo_novo, "utf-8");

    aprovarMudanca(mudancaId);
    registrarHistorico(estado.projetoId, "mudanca_aprovada", `Arquivo ${mudanca.arquivo} alterado`);

    res.json({ ok: true, arquivo: mudanca.arquivo });
  } catch (e) {
    res.status(500).json({ erro: String(e?.message || e) });
  }
});

app.post("/mudancas/rejeitar", async (req, res) => {
  try {
    if (!estado.projetoId) return res.status(400).json({ erro: "Nenhum projeto aberto" });

    const { mudancaId } = req.body || {};
    if (!mudancaId) return res.status(400).json({ erro: "mudancaId é obrigatório" });

    rejeitarMudanca(mudancaId);
    registrarHistorico(estado.projetoId, "mudanca_rejeitada", "Mudança rejeitada pelo usuário");

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ erro: String(e?.message || e) });
  }
});

app.get("/projetos", async (_req, res) => {
  try {
    const projetos = listarProjetos(50);
    res.json({ projetos });
  } catch (e) {
    res.status(500).json({ erro: String(e?.message || e) });
  }
});

app.get("/historico", async (_req, res) => {
  try {
    if (!estado.projetoId) return res.status(400).json({ erro: "Nenhum projeto aberto" });
    const historico = buscarHistorico(estado.projetoId, 50);
    res.json({ historico });
  } catch (e) {
    res.status(500).json({ erro: String(e?.message || e) });
  }
});

app.get("/conversas", async (_req, res) => {
  try {
    if (!estado.projetoId) return res.status(400).json({ erro: "Nenhum projeto aberto" });
    const conversas = buscarConversas(estado.projetoId, 50);
    res.json({ conversas });
  } catch (e) {
    res.status(500).json({ erro: String(e?.message || e) });
  }
});

async function findAvailablePort(start) {
  for (let p = start; p < start + 50; p++) {
    const ok = await new Promise((resolve) => {
      const srv = net.createServer()
        .once("error", () => resolve(false))
        .once("listening", () => srv.close(() => resolve(true)))
        .listen(p, "0.0.0.0");
    });
    if (ok) return p;
  }
  throw new Error("Sem porta livre encontrada");
}

let server;
async function start() {
  const base = Number(process.env.AGENTE_PORTA || 6060);
  const porta = await findAvailablePort(base);
  server = app.listen(porta, () => console.log(`Agente na porta ${porta}`));
}

function graceful() {
  if (server) {
    console.log("Encerrando Agente e liberando porta...");
    try {
      server.close(() => process.exit(0));
    } catch {
      process.exit(0);
    }
  } else {
    process.exit(0);
  }
}

process.on("SIGINT", graceful);
process.on("SIGTERM", graceful);

await start();
