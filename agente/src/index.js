import "dotenv/config";
import express from "express";
import cors from "cors";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { chat_simples, analisar_imagem_stream } from "./llm.js";
import { clonar_repositorio, criar_branch, commit_e_push } from "./ferramentas.js";
import { CriadorProjeto } from "./criar-projeto.js";

// Importar rotas
import agenticRoutes from './routes/agentic.js';
import {
  criarProjeto,
  buscarProjetoPorUrl,
  buscarProjetoPorCaminho,
  buscarProjetoPorId,
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
  listarProjetos,
  deletarProjeto,
  salvarVersaoArquivo,
  buscarVersoesArquivo,
  restaurarVersaoArquivo
} from "./database.js";
import {
  gerarMudancaInteligente,
  analisarDiferencas,
  gerarDiff
} from "./analisador.js";
import { processMessageStream } from "./core/agent.js";
import { executarProvisionamento } from "./provisionar/orquestrador.js";

const app = express();
app.use(cors());
app.options('*', cors());
app.use(express.json({ limit: "10mb" }));

// Configurar rotas agentic
app.use('/api/agentic', agenticRoutes);

app.get("/saude", (_req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.json({ ok: true });
});

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

    const nomeProjeto = repositorioUrl
      ? repositorioUrl.split("/").pop().replace(".git", "")
      : caminhoLocal
        ? path.basename(caminhoLocal)
        : "projeto";

    let pasta = caminhoLocal;

    // Sempre cria um novo projeto para isolamento completo entre chats
    if (!caminhoLocal && repositorioUrl) {
      // Verifica se já existe um repositório clonado para reutilizar o diretório
      const projetoExistente = buscarProjetoPorUrl(repositorioUrl);
      
      if (projetoExistente && projetoExistente.caminho_local && await pathExists(projetoExistente.caminho_local)) {
        // Reutiliza o diretório do repositório já clonado
        pasta = projetoExistente.caminho_local;
      } else {
        // Clona o repositório em um novo diretório
        pasta = await resolveWorkspaceDirectory(nomeProjeto);
        await clonar_repositorio(repositorioUrl, pasta, token);
        await criar_branch(pasta, `agente/${Date.now()}`, branchBase);
      }
    }

    // Sempre cria um novo projeto (não reutiliza)
    const projetoId = criarProjeto(nomeProjeto, repositorioUrl || "", pasta, branchBase || "main");
    const novoProjeto = { id: projetoId, nome: nomeProjeto };
    registrarHistorico(projetoId, "projeto_criado", "Projeto aberto em novo chat");

    const arvore = await listar_arvore(pasta);
    const mudancasPendentes = buscarMudancasPendentes(projetoId);

    res.json({
      ok: true,
      projeto: novoProjeto,
      pasta,
      arvore,
      conversas: [],
      historico: [],
      mudancasPendentes: mudancasPendentes
    });
  } catch (e) {
    res.status(500).json({ erro: String(e?.message || e) });
  }
});

// Criar projeto do zero (workspace vazio pronto para scaffold)
app.post("/projeto/criar", async (req, res) => {
  try {
    const { nome, prompt } = req.body || {};

    const nomeProjeto = (nome || "novo-projeto").toString();
    const pastaAgentes = path.join(process.cwd(), "..", "Agentes");
    
    // Garantir que a pasta Agentes existe
    await fs.promises.mkdir(pastaAgentes, { recursive: true });

    // Configurar SSE para progresso em tempo real
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    const enviarProgresso = (dados) => {
      res.write(`data: ${JSON.stringify(dados)}\n\n`);
    };

    const criador = new CriadorProjeto(nomeProjeto, pastaAgentes, enviarProgresso);
    
    enviarProgresso({
      etapa: "inicio",
      status: "iniciando",
      detalhes: { mensagem: `Iniciando criação do projeto ${nomeProjeto}...` }
    });

    const resultado = await criador.criarProjetoCompleto();
    
    if (resultado.sucesso) {
      // Criar registro no banco de dados
      const projetoId = criarProjeto(nomeProjeto, "", resultado.caminho, "main");
      registrarHistorico(projetoId, "projeto_criado", "Projeto React criado com preview");

      enviarProgresso({
        etapa: "finalizado",
        status: "concluido",
        detalhes: {
          mensagem: "Projeto criado com sucesso!",
          projetoId,
          caminho: resultado.caminho,
          servidor: resultado.servidor
        }
      });
    } else {
      enviarProgresso({
        etapa: "erro",
        status: "erro",
        detalhes: {
          mensagem: "Erro ao criar projeto",
          erro: resultado.erro
        }
      });
    }

    res.end();
  } catch (e) {
    res.write(`data: ${JSON.stringify({
      etapa: "erro",
      status: "erro", 
      detalhes: { mensagem: "Erro interno", erro: String(e?.message || e) }
    })}\n\n`);
    res.end();
  }
});

app.get("/repo/tree", async (req, res) => {
  try {
    const projetoId = req.query.projetoId ? parseInt(req.query.projetoId) : null;
    if (!projetoId) return res.status(400).json({ erro: "projetoId é obrigatório" });
    
    const projeto = buscarProjetoPorId(projetoId);
    if (!projeto || !projeto.caminho_local) {
      return res.status(400).json({ erro: "Projeto não encontrado ou sem caminho local" });
    }
    
    const arvore = await listar_arvore(projeto.caminho_local);
    res.json({ arvore });
  } catch (e) {
    res.status(500).json({ erro: String(e?.message || e) });
  }
});

app.get("/repo/file", async (req, res) => {
  try {
    const projetoId = req.query.projetoId ? parseInt(req.query.projetoId) : null;
    const rel = req.query.path;
    
    if (!projetoId) return res.status(400).json({ erro: "projetoId é obrigatório" });
    if (!rel) return res.status(400).json({ erro: "path é obrigatório" });
    
    const projeto = buscarProjetoPorId(projetoId);
    if (!projeto || !projeto.caminho_local) {
      return res.status(400).json({ erro: "Projeto não encontrado ou sem caminho local" });
    }
    
    const full = path.join(projeto.caminho_local, rel);
    const data = await fs.promises.readFile(full, "utf-8");
    res.type("text/plain").send(data);
  } catch (e) {
    res.status(500).json({ erro: String(e?.message || e) });
  }
});

app.post("/repo/save", async (req, res) => {
  try {
    const { projetoId, path: rel, conteudo } = req.body || {};
    
    if (!projetoId) return res.status(400).json({ erro: "projetoId é obrigatório" });
    if (!rel) return res.status(400).json({ erro: "path é obrigatório" });
    
    const projeto = buscarProjetoPorId(projetoId);
    if (!projeto || !projeto.caminho_local) {
      return res.status(400).json({ erro: "Projeto não encontrado ou sem caminho local" });
    }
    
    const full = path.join(projeto.caminho_local, rel);
    await fs.promises.mkdir(path.dirname(full), { recursive: true });
    await fs.promises.writeFile(full, conteudo ?? "", "utf-8");

    registrarHistorico(projetoId, "arquivo_salvo", `Arquivo ${rel} salvo manualmente`);

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ erro: String(e?.message || e) });
  }
});

app.post("/repo/commit", async (req, res) => {
  try {
    const { projetoId, mensagem } = req.body || {};
    
    if (!projetoId) return res.status(400).json({ erro: "projetoId é obrigatório" });
    
    const projeto = buscarProjetoPorId(projetoId);
    if (!projeto || !projeto.caminho_local) {
      return res.status(400).json({ erro: "Projeto não encontrado ou sem caminho local" });
    }
    
    await commit_e_push(projeto.caminho_local, mensagem || "chore: atualizações via Agente");
    registrarHistorico(projetoId, "commit_realizado", mensagem || "Commit automático");

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ erro: String(e?.message || e) });
  }
});

app.post("/chat/inteligente", async (req, res) => {
  try {
    const { projetoId, mensagem } = req.body || {};
    
    if (!projetoId) return res.status(400).json({ erro: "projetoId é obrigatório" });
    if (!mensagem) return res.status(400).json({ erro: "mensagem é obrigatória" });

    const projeto = buscarProjetoPorId(projetoId);
    if (!projeto || !projeto.caminho_local) {
      return res.status(400).json({ erro: "Projeto não encontrado ou sem caminho local" });
    }

    const arvore = await listar_arvore(projeto.caminho_local);
    const resultado = await gerarMudancaInteligente(mensagem, projetoId, projeto.caminho_local, arvore);

    if (resultado.mudancas && resultado.mudancas.length > 0) {
      for (const mudanca of resultado.mudancas) {
        const arquivoPath = path.join(projeto.caminho_local, mudanca.arquivo);
        let original = "";

        try {
          original = await fs.promises.readFile(arquivoPath, "utf-8");
        } catch (e) {
          original = "";
        }

        const diff = gerarDiff(original, mudanca.conteudo_novo, mudanca.arquivo);
        const analise = await analisarDiferencas(original, mudanca.conteudo_novo);

        criarMudancaPendente(
          projetoId,
          mudanca.arquivo,
          original,
          mudanca.conteudo_novo,
          diff,
          mudanca.descricao || "Alteração gerada pelo agente"
        );
      }

      const resposta = `Analisei sua solicitação e preparei ${resultado.mudancas.length} alteração(ões). Revise as mudanças pendentes e aprove para aplicar.`;

      salvarConversa(projetoId, mensagem, resposta, JSON.stringify(resultado.analise));
      registrarHistorico(projetoId, "mudancas_propostas", `${resultado.mudancas.length} alterações propostas`);

      res.json({
        resposta,
        mudancas: resultado.mudancas.length,
        analise: resultado.analise,
        mensagem_commit: resultado.mensagem_commit
      });
    } else {
      const resposta = await chat_simples(mensagem, "Repositório local aberto");
      salvarConversa(projetoId, mensagem, resposta);
      res.json({ resposta, mudancas: 0 });
    }
  } catch (e) {
    res.status(500).json({ erro: String(e?.message || e) });
  }
});

app.post("/chat/gerar-titulo", async (req, res) => {
  try {
    const { contexto } = req.body || {};
    if (!contexto) return res.status(400).json({ erro: "contexto é obrigatório" });

    const prompt = `Com base no seguinte contexto de conversa, gere um título curto e descritivo (máximo 4 palavras) para esta conversa. Responda apenas com o título, sem pontuação no final.\n\nContexto: ${contexto.slice(0, 300)}`;
    
    const titulo = await chat_simples(prompt, "Geração de título");
    const tituloLimpo = titulo.trim().replace(/^["']|["']$/g, '').replace(/[.:!?]$/g, '');
    
    res.json({ titulo: tituloLimpo });
  } catch (e) {
    res.status(500).json({ erro: String(e?.message || e) });
  }
});

app.get("/mudancas/pendentes", async (req, res) => {
  try {
    const projetoId = req.query.projetoId ? parseInt(req.query.projetoId) : null;
    if (!projetoId) return res.status(400).json({ erro: "projetoId é obrigatório" });

    const mudancas = buscarMudancasPendentes(projetoId);
    res.json({ mudancas });
  } catch (e) {
    res.status(500).json({ erro: String(e?.message || e) });
  }
});

app.post("/mudancas/aprovar", async (req, res) => {
  try {
    const { projetoId, mudancaId } = req.body || {};
    
    if (!projetoId) return res.status(400).json({ erro: "projetoId é obrigatório" });
    if (!mudancaId) return res.status(400).json({ erro: "mudancaId é obrigatório" });

    const projeto = buscarProjetoPorId(projetoId);
    if (!projeto || !projeto.caminho_local) {
      return res.status(400).json({ erro: "Projeto não encontrado ou sem caminho local" });
    }

    const mudancas = buscarMudancasPendentes(projetoId);
    const mudanca = mudancas.find(m => m.id === mudancaId);

    if (!mudanca) return res.status(404).json({ erro: "Mudança não encontrada" });

    const arquivoPath = path.join(projeto.caminho_local, mudanca.arquivo);
    
    let conteudoOriginal = "";
    try {
      conteudoOriginal = await fs.promises.readFile(arquivoPath, "utf-8");
    } catch (e) {
      conteudoOriginal = "";
    }
    
    if (conteudoOriginal) {
      salvarVersaoArquivo(
        projetoId, 
        mudanca.arquivo, 
        conteudoOriginal, 
        `Versão antes da mudança: ${mudanca.descricao || 'alteração'}`,
        mudancaId
      );
    }
    
    await fs.promises.mkdir(path.dirname(arquivoPath), { recursive: true });
    await fs.promises.writeFile(arquivoPath, mudanca.conteudo_novo, "utf-8");

    aprovarMudanca(mudancaId);
    
    const dadosMudanca = JSON.stringify({
      arquivo: mudanca.arquivo,
      conteudo_original: conteudoOriginal,
      conteudo_novo: mudanca.conteudo_novo,
      diff: mudanca.diff
    });
    
    registrarHistorico(projetoId, "mudanca_aprovada", `Arquivo ${mudanca.arquivo} alterado`, dadosMudanca);

    res.json({ ok: true, arquivo: mudanca.arquivo });
  } catch (e) {
    res.status(500).json({ erro: String(e?.message || e) });
  }
});

app.post("/mudancas/rejeitar", async (req, res) => {
  try {
    const { projetoId, mudancaId } = req.body || {};
    
    if (!projetoId) return res.status(400).json({ erro: "projetoId é obrigatório" });
    if (!mudancaId) return res.status(400).json({ erro: "mudancaId é obrigatório" });

    rejeitarMudanca(mudancaId);
    registrarHistorico(projetoId, "mudanca_rejeitada", "Mudança rejeitada pelo usuário");

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

app.get("/historico", async (req, res) => {
  try {
    const projetoId = req.query.projetoId ? parseInt(req.query.projetoId) : null;
    if (!projetoId) return res.status(400).json({ erro: "projetoId é obrigatório" });
    
    const historico = buscarHistorico(projetoId, 50);
    res.json({ historico });
  } catch (e) {
    res.status(500).json({ erro: String(e?.message || e) });
  }
});

app.get("/conversas", async (req, res) => {
  try {
    const projetoId = req.query.projetoId ? parseInt(req.query.projetoId) : null;
    if (!projetoId) return res.status(400).json({ erro: "projetoId é obrigatório" });
    
    const conversas = buscarConversas(projetoId, 50);
    res.json({ conversas });
  } catch (e) {
    res.status(500).json({ erro: String(e?.message || e) });
  }
});

app.post("/projeto/deletar", async (req, res) => {
  try {
    const { projetoId, removerArquivos = true } = req.body || {};
    const id = projetoId ? parseInt(projetoId) : null;
    if (!id) return res.status(400).json({ erro: "projetoId é obrigatório" });

    const projeto = buscarProjetoPorId(id);
    if (!projeto) return res.status(404).json({ erro: "Projeto não encontrado" });

    if (removerArquivos && projeto.caminho_local) {
      try {
        await fs.promises.rm(projeto.caminho_local, { recursive: true, force: true });
      } catch (e) {
        // Ignora falhas ao remover diretório
      }
    }

    deletarProjeto(id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ erro: String(e?.message || e) });
  }
});

app.post("/vision/analisar", async (req, res) => {
  try {
    const { projetoId, imagem, prompt } = req.body || {};
    if (!imagem) return res.status(400).json({ erro: "Imagem é obrigatória" });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    let abortado = false;
    
    req.on('close', () => {
      abortado = true;
    });

    const imagemBase64 = imagem.replace(/^data:image\/[^;]+;base64,/, '');

    res.write(`data: ${JSON.stringify({ tipo: 'inicio', mensagem: '🔍 Analisando imagem...' })}\n\n`);

    await analisar_imagem_stream(
      imagemBase64,
      prompt,
      (chunk, textoCompleto) => {
        if (!abortado) {
          res.write(`data: ${JSON.stringify({ tipo: 'chunk', conteudo: chunk, textoCompleto })}\n\n`);
        }
      },
      (textoFinal) => {
        if (!abortado) {
          res.write(`data: ${JSON.stringify({ tipo: 'completo', resultado: textoFinal })}\n\n`);
          
          if (projetoId) {
            salvarConversa(
              projetoId,
              `[IMAGEM] ${prompt || 'Análise de imagem'}`,
              textoFinal,
              JSON.stringify({ tipo: 'visao', modelo: process.env.VISION_MODEL || 'llava:7b' })
            );
          }
          
          res.end();
        }
      }
    );
  } catch (e) {
    res.write(`data: ${JSON.stringify({ tipo: 'erro', mensagem: String(e?.message || e) })}\n\n`);
    res.end();
  }
});

// Transcrição de áudio (SSE). Implementa recepção e fluxo de status.
// Para transcrição real, configure um serviço Whisper externo e integre aqui.
app.post("/audio/transcrever", async (req, res) => {
  try {
    const { audio } = req.body || {};
    if (!audio) return res.status(400).json({ erro: "Áudio é obrigatório" });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    res.write(`data: ${JSON.stringify({ tipo: 'inicio', mensagem: '🎙️ Iniciando transcrição...' })}\n\n`);

    // No backend local de STT configurado: emitimos sugestão e encerramos
    const aviso = [
      'Transcrição de áudio no backend não está configurada.',
      'Use a opção de "Gravar voz (transcrever no navegador)" para transcrição imediata,',
      'ou configure um serviço Whisper e integre aqui.'
    ].join(' ');

    res.write(`data: ${JSON.stringify({ tipo: 'chunk', conteudo: aviso, textoCompleto: aviso })}\n\n`);
    res.write(`data: ${JSON.stringify({ tipo: 'completo', resultado: aviso })}\n\n`);
    try { res.end(); } catch {}
  } catch (e) {
    res.write(`data: ${JSON.stringify({ tipo: 'erro', mensagem: String(e?.message || e) })}\n\n`);
    try { res.end(); } catch {}
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

app.post("/provisionar/executar", async (req, res) => {
  try {
    const { projetoId, opcoes = {} } = req.body || {};
    
    if (!projetoId) return res.status(400).json({ erro: "projetoId é obrigatório" });

    const projeto = buscarProjetoPorId(projetoId);
    if (!projeto || !projeto.caminho_local) {
      return res.status(400).json({ erro: "Projeto não encontrado ou sem caminho local" });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    let abortado = false;
    
    req.on('close', () => {
      abortado = true;
    });

    const callbackProgresso = (evento) => {
      if (!abortado) {
        res.write(`data: ${JSON.stringify(evento)}\n\n`);
      }
    };

    const resultado = await executarProvisionamento(
      projeto.caminho_local,
      opcoes,
      callbackProgresso
    );

    if (!abortado) {
      res.write(`data: ${JSON.stringify({ 
        tipo: 'finalizado', 
        resultado 
      })}\n\n`);
      
      if (resultado.sucesso) {
        registrarHistorico(
          projetoId, 
          "provisionamento_concluido", 
          `Provisionamento executado em ${resultado.tempoTotal}s`,
          JSON.stringify(resultado.dados.relatorio?.relatorio || {})
        );
      }
      
      res.end();
    }
  } catch (e) {
    if (!res.headersSent) {
      res.status(500).json({ erro: String(e?.message || e) });
    } else {
      res.write(`data: ${JSON.stringify({ tipo: 'erro', mensagem: String(e?.message || e) })}\n\n`);
      res.end();
    }
  }
});

app.post("/chat/stream", async (req, res) => {
  try {
    const { projetoId, mensagem } = req.body || {};
    
    if (!projetoId) return res.status(400).json({ erro: "projetoId é obrigatório" });
    if (!mensagem) return res.status(400).json({ erro: "mensagem é obrigatória" });

    const projeto = buscarProjetoPorId(projetoId);
    if (!projeto || !projeto.caminho_local) {
      return res.status(400).json({ erro: "Projeto não encontrado ou sem caminho local" });
    }

    const estado = {
      pasta: projeto.caminho_local,
      projetoId: projetoId,
      url: projeto.repositorio_url
    };

    // Configura SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const arvore = await listar_arvore(projeto.caminho_local);
    await processMessageStream(mensagem, estado, arvore, res);
  } catch (e) {
    if (!res.headersSent) {
      res.status(500).json({ erro: String(e?.message || e) });
    }
  }
});

await start();
