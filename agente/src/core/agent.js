import path from "node:path";
import fs from "node:fs";
import {
  buscarConversas,
  buscarHistorico,
  buscarContextoProjeto,
  criarMudancaPendente,
  registrarHistorico,
  salvarConversa,
} from "../database.js";
import { chat_simples } from "../llm.js";
import { gerarMudancaInteligente, gerarDiff, analisarDiferencas } from "../analisador.js";

function emit(res, tipo, conteudo) {
  res.write(`data: ${JSON.stringify({ tipo, conteudo })}\n\n`);
}

function emitComplete(res, payload) {
  // Compat: front espera campos no nível raiz (não em "conteudo")
  res.write(`data: ${JSON.stringify({ tipo: "completo", ...payload })}\n\n`);
}

function emitThought(res, text, status = "running", details = []) {
  emit(res, "pensamento", { text, status, details });
}

async function collectContext(estado, arvore) {
  const conversas = buscarConversas(estado.projetoId, 20);
  const historico = buscarHistorico(estado.projetoId, 20);
  const arquivos = buscarContextoProjeto(estado.projetoId, 20);

  const files = (arvore || []).filter(a => a.tipo === "file").map(a => a.path);
  const estruturaAmostra = files.slice(0, 300).join("\n");

  const conversaCurta = conversas.map(c => `U: ${c.mensagem}\nA: ${c.resposta || ""}`).join("\n---\n");
  const historicoCurto = historico.map(h => `${h.tipo}: ${h.descricao}`).join("\n");
  const arquivosCurto = arquivos.map(a => `${a.caminho}`).join("\n");

  const resumoContexto = [
    conversaCurta ? `Historico curto de conversa:\n${conversaCurta}` : null,
    historicoCurto ? `Acoes recentes:\n${historicoCurto}` : null,
    arquivosCurto ? `Arquivos trabalhados recentemente:\n${arquivosCurto}` : null,
    estruturaAmostra ? `Estrutura do projeto (amostra):\n${estruturaAmostra}` : null,
  ].filter(Boolean).join("\n\n");

  return { conversas, historico, arquivos, files, estruturaAmostra, resumoContexto };
}

function buildIntentPrompt(mensagem, ctx) {
  return `Você é um agente de desenvolvimento autônomo. Classifique a intenção do usuário e proponha um plano.

MENSAGEM:
"""
${mensagem}
"""

CONTEXTO DE CONVERSA E AÇÕES (resumo):
${ctx.resumoContexto}

Responda APENAS em JSON válido:
{
  "kind": "chat | analysis | code_change | question | repo",
  "targets": ["paths ou temas"],
  "plan": ["passo 1", "passo 2", "passo 3"],
  "confidence": 0.0
}
`;}

async function analyzeIntent(mensagem, ctx) {
  const prompt = buildIntentPrompt(mensagem, ctx);
  const resposta = await chat_simples(prompt, "Classificacao de intencao");
  try {
    const i = resposta.indexOf("{");
    const j = resposta.lastIndexOf("}");
    if (i >= 0 && j > i) {
      return JSON.parse(resposta.slice(i, j + 1));
    }
  } catch {}
  return { kind: "code_change", targets: [], plan: ["Entender", "Modificar", "Validar"], confidence: 0.4 };
}

async function answerChat(mensagem, ctx) {
  const contexto = ctx.resumoContexto ? `Contexto resumido do projeto e conversa:\n${ctx.resumoContexto}` : "";
  return await chat_simples(mensagem, contexto);
}

async function runAnalysis(mensagem, estado, ctx) {
  const detalhes = [];
  detalhes.push(`Total de arquivos: ${ctx.files.length}`);

  const principais = ctx.files.filter(a => /(^|\/)src\//.test(a) || /package.json$/.test(a) || /index\./.test(a)).slice(0, 10);
  const trechos = [];
  for (const arq of principais.slice(0, 5)) {
    try {
      const p = path.join(estado.pasta, arq);
      const c = await fs.promises.readFile(p, "utf-8");
      if (c.length < 4000) trechos.push(`Arquivo: ${arq}\n\`\`\`\n${c}\n\`\`\``);
    } catch {}
  }

  const prompt = `Você é um engenheiro sênior.
Analise o pedido abaixo com base no projeto.

Pedido do usuário:
${mensagem}

Estrutura (amostra):
${ctx.estruturaAmostra}

Contexto trabalhado recentemente:
${ctx.arquivos.map(a=>`- ${a.caminho}`).join("\n")}

Trechos relevantes:
${trechos.join("\n\n")}

Responda objetivamente com achados, melhorias e próximos passos. Seja claro.`;

  const resposta = await chat_simples(prompt, "Analise de Projeto");
  return { resposta, detalhes };
}

export async function processMessageStream(mensagem, estado, arvore, res) {
  emitThought(res, "Coletando contexto do projeto", "running");
  const ctx = await collectContext(estado, arvore);
  emitThought(res, "Coletando contexto do projeto", "completed", [
    `Conversas: ${ctx.conversas.length}`,
    `Eventos: ${ctx.historico.length}`,
    `Arquivos conhecidos: ${ctx.files.length}`,
  ]);

  emitThought(res, "Analisando intenção e definindo plano", "running");
  const intent = await analyzeIntent(mensagem, ctx);
  emitThought(res, "Analisando intenção e definindo plano", "completed", intent.plan || []);

  if (intent.kind === "chat") {
    emitThought(res, "Gerando resposta contextual", "running");
    const resposta = await answerChat(mensagem, ctx);
    salvarConversa(estado.projetoId, mensagem, resposta);
    emitThought(res, "Gerando resposta contextual", "completed");
    emitComplete(res, { resposta, mudancas: [] });
    try { res.end(); } catch {}
    return;
  }

  if (intent.kind === "analysis" || intent.kind === "question") {
    emitThought(res, "Executando análise orientada pelo contexto", "running");
    const { resposta, detalhes } = await runAnalysis(mensagem, estado, ctx);
    salvarConversa(estado.projetoId, mensagem, resposta);
    emitThought(res, "Executando análise orientada pelo contexto", "completed", detalhes);
    emitComplete(res, { resposta, mudancas: [] });
    try { res.end(); } catch {}
    return;
  }

  // code_change ou repo (default para alterações)
  emitThought(res, "Identificando arquivos relevantes e propondo mudanças", "running", intent.targets || []);
  const resultado = await gerarMudancaInteligente(mensagem, estado.projetoId, estado.pasta, arvore);
  emitThought(res, "Identificando arquivos relevantes e propondo mudanças", "completed");

  if (resultado.mudancas && resultado.mudancas.length > 0) {
    const mudancasComId = [];
    for (const mudanca of resultado.mudancas) {
      emitThought(res, `Preparando mudança em ${mudanca.arquivo}`, "running");
      const p = path.join(estado.pasta, mudanca.arquivo);
      let original = "";
      try { original = await fs.promises.readFile(p, "utf-8"); } catch {}
      const diff = gerarDiff(original, mudanca.conteudo_novo, mudanca.arquivo);
      const analise = await analisarDiferencas(original, mudanca.conteudo_novo);
      const id = criarMudancaPendente(
        estado.projetoId,
        mudanca.arquivo,
        original,
        mudanca.conteudo_novo,
        diff,
        mudanca.descricao || "Mudança proposta pelo agente"
      );
      mudancasComId.push({
        id,
        arquivo: mudanca.arquivo,
        descricao: mudanca.descricao,
        diff: diff.slice(0, 5000),
        analise,
        conteudo_original: original,
        conteudo_novo: mudanca.conteudo_novo,
      });
      emitThought(res, `Preparando mudança em ${mudanca.arquivo}`, "completed");
    }

    const resposta = `Analisei seu pedido e preparei ${mudancasComId.length} mudança(s). Revise e aprove para aplicar.`;
    salvarConversa(estado.projetoId, mensagem, resposta, JSON.stringify({ intent }));
    registrarHistorico(estado.projetoId, "mudancas_propostas", `${mudancasComId.length} mudanças propostas`);
    emitComplete(res, { resposta, mudancas: mudancasComId, mensagem_commit: resultado.mensagem_commit, analise: { intent } });
    try { res.end(); } catch {}
  } else {
    emitThought(res, "Gerando resposta com base no contexto", "running");
    const resposta = await answerChat(mensagem, ctx);
    salvarConversa(estado.projetoId, mensagem, resposta, JSON.stringify({ intent }));
    emitThought(res, "Gerando resposta com base no contexto", "completed");
    emitComplete(res, { resposta, mudancas: [] });
    try { res.end(); } catch {}
  }

  // sumarização de memória do turno
  try {
    const sumPrompt = `Resuma em até 5 linhas o que foi pedido, decisões do agente e próximos passos úteis para continuar.`;
    const resumo = await chat_simples(sumPrompt + "\n\nBase:\n" + ctx.resumoContexto + "\n\nPedido:\n" + mensagem, "Resumo do turno");
    registrarHistorico(estado.projetoId, "resumo_turno", resumo);
  } catch {}
}
