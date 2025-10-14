import { chat_simples } from "./llm.js";
import { buscarContextoProjeto, salvarContextoArquivo, buscarConversas, buscarHistorico } from "./database.js";
import fs from "node:fs";
import path from "node:path";

function extrairJSON(texto) {
  try {
    const inicio = texto.indexOf("{");
    const fim = texto.lastIndexOf("}");
    if (inicio < 0 || fim <= inicio) return null;
    const jsonString = texto.slice(inicio, fim + 1).trim();
    return JSON.parse(jsonString);
  } catch (e) {
    console.error("Erro ao extrair JSON:", e.message);
    return null;
  }
}

export async function analisarIntencao(mensagem, projetoId, arvore) {
  const contextoArquivos = await buscarContextoProjeto(projetoId, 20);
  const conversas = buscarConversas(projetoId, 10);
  const historico = buscarHistorico(projetoId, 10);
  const todosArquivos = (arvore || []).filter(a => a.tipo === "file").map(a => a.path);
  const arquivosRelevantes = todosArquivos.slice(0, 300);

  const temArquivos = arquivosRelevantes.length > 0;
  const contextoMsg = temArquivos ? `Projeto com ${todosArquivos.length} arquivos.` : `Nenhum projeto aberto ainda.`;

  const resumoConversas = conversas.map(c => `U:${c.mensagem} | A:${(c.resposta||"").slice(0,120)}`).join("\n");
  const resumoHistorico = historico.map(h => `${h.tipo}:${h.descricao}`).join("\n");

  const prompt = `Você é um agente de desenvolvimento. Classifique a intenção e proponha um plano sucinto.\n\nCONTEXTO: ${contextoMsg}\nMENSAGEM: "${mensagem}"\n\nArquivos no projeto (amostra):\n${temArquivos ? arquivosRelevantes.slice(0, 100).join("\n") : "(sem arquivos)"}\n\nArquivos trabalhados recentemente:\n${contextoArquivos.map(c => `- ${c.caminho}`).join("\n")}\n\nConversa recente:\n${resumoConversas}\n\nAções recentes:\n${resumoHistorico}\n\nResponda apenas com JSON válido (sem quebras de linha nas strings):\n{\n  "arquivos_alvo": ["caminho1", "caminho2"],\n  "tipo_mudanca": "edicao|criacao|exclusao|refatoracao",\n  "complexidade": "baixa|media|alta",\n  "riscos": ["ponto1"],\n  "plano_acao": "Texto em uma linha",\n  "confidence": 0.0\n}`;

  try {
    const resposta = await chat_simples("Classificar intenção", prompt);
    const json = extrairJSON(resposta);
    if (json) return json;
  } catch (e) {
    console.error("Erro ao analisar intenção:", e);
  }

  return {
    arquivos_alvo: [],
    tipo_mudanca: "edicao",
    complexidade: "media",
    riscos: [],
    plano_acao: "Executar a solicitação com segurança",
    confidence: 0.3
  };
}

function detectarTecnologias(arvore) {
  const tecnologias = new Set();
  const arquivos = (arvore || []).filter(a => a.tipo === 'file').map(a => a.path);
  if (arquivos.some(f => f.includes('package.json'))) tecnologias.add('Node.js');
  if (arquivos.some(f => f.endsWith('.jsx') || f.endsWith('.tsx'))) tecnologias.add('React');
  if (arquivos.some(f => f.includes('vite.config'))) tecnologias.add('Vite');
  if (arquivos.some(f => f.endsWith('.py'))) tecnologias.add('Python');
  if (arquivos.some(f => f.endsWith('.java'))) tecnologias.add('Java');
  if (arquivos.some(f => f.endsWith('.go'))) tecnologias.add('Go');
  if (arquivos.some(f => f.includes('Cargo.toml'))) tecnologias.add('Rust');
  if (arquivos.some(f => f.includes('angular.json'))) tecnologias.add('Angular');
  if (arquivos.some(f => f.includes('next.config'))) tecnologias.add('Next.js');
  return Array.from(tecnologias);
}

function normalizarTokens(texto) {
  return String(texto || "")
    .toLowerCase()
    .replace(/[^a-z0-9._\-/ ]+/g, " ")
    .split(/\s+/)
    .filter(t => t && t.length >= 3);
}

function heuristicaArquivos(arvore, mensagem) {
  const files = (arvore || []).filter(a => a.tipo === "file").map(a => a.path);
  const tokens = normalizarTokens(mensagem);
  const pontuacao = new Map();
  const boostExt = (p) => (p.endsWith('.jsx')||p.endsWith('.tsx')) ? 3 : (p.endsWith('.js')||p.endsWith('.ts')) ? 2 : 1;

  for (const f of files) {
    let score = 0;
    const fLower = f.toLowerCase();
    for (const t of tokens) if (fLower.includes(t)) score += 2;
    if (fLower.includes('front/src/app.jsx')) score += 6;
    if (fLower.includes('/app.') || fLower.includes('app.jsx') || fLower.includes('app.tsx')) score += 3;
    if (fLower.includes('/index.') || fLower.includes('index.jsx') || fLower.includes('index.tsx')) score += 2;
    if (fLower.includes('front/src')) score += 2;
    score *= boostExt(fLower);
    if (score > 0) pontuacao.set(f, score);
  }

  const candidatos = Array.from(pontuacao.entries())
    .sort((a,b) => b[1]-a[1])
    .slice(0, 3)
    .map(([f]) => f);

  if (candidatos.length === 0) {
    const preferidos = ['front/src/app.jsx', 'src/App.jsx', 'src/app.jsx'];
    for (const p of preferidos) if (files.includes(p)) candidatos.push(p);
  }
  if (candidatos.length === 0) candidatos.push(...files.filter(f => /\.(jsx?|tsx?)$/i.test(f)).slice(0,3));
  if (candidatos.length === 0) candidatos.push(...files.slice(0,1));
  return Array.from(new Set(candidatos)).slice(0,3);
}

export async function gerarMudancaInteligente(mensagem, projetoId, pastaProjeto, arvore) {
  const passos = [];
  passos.push(`Analisando estrutura do projeto`);
  passos.push(`Total de arquivos identificados: ${arvore.filter(a=>a.tipo==='file').length}`);
  const tecnologias = detectarTecnologias(arvore);
  if (tecnologias.length > 0) passos.push(`Tecnologias detectadas: ${tecnologias.join(', ')}`);

  passos.push(`Interpretando a solicitação`);
  const analise = await analisarIntencao(mensagem, projetoId, arvore);
  passos.push(`Tipo de mudança: ${analise.tipo_mudanca || 'edicao'}`);
  passos.push(`Complexidade estimada: ${analise.complexidade || 'media'}`);
  if (analise.riscos && analise.riscos.length > 0) passos.push(`Pontos de atenção: ${analise.riscos.slice(0, 2).join(', ')}`);

  passos.push(`Buscando arquivos relevantes`);
  const arquivosContexto = [];
  let candidatos = Array.isArray(analise.arquivos_alvo) ? analise.arquivos_alvo.slice(0,5) : [];
  const conjunto = new Set(arvore.filter(a => a.tipo === 'file').map(a => a.path));
  candidatos = candidatos.filter(c => conjunto.has(c));
  if (candidatos.length === 0) {
    passos.push('Identificando melhores arquivos candidatos');
    candidatos = heuristicaArquivos(arvore, mensagem);
  }
  if (candidatos.length) passos.push(`Arquivos selecionados: ${candidatos.slice(0,3).join(', ')}`);
  else passos.push('Trabalhando com contexto geral do projeto');

  passos.push(`Carregando conteúdo dos arquivos`);
  for (const arquivoAlvo of candidatos) {
    try {
      const caminhoCompleto = path.join(pastaProjeto, arquivoAlvo);
      const existe = await fs.promises.access(caminhoCompleto).then(() => true).catch(() => false);
      if (existe) {
        const conteudo = await fs.promises.readFile(caminhoCompleto, "utf-8");
        const linhas = conteudo.split('\n').length;
        passos.push(`${arquivoAlvo} carregado (${linhas} linhas)`);
        arquivosContexto.push({ caminho: arquivoAlvo, conteudo: conteudo.slice(0, 10000) });
        await salvarContextoArquivo(projetoId, arquivoAlvo, conteudo);
      }
    } catch (e) {
      passos.push(`Erro ao carregar ${arquivoAlvo}: ${e.message}`);
      console.error(`Erro ao ler ${arquivoAlvo}:`, e);
    }
  }

  passos.push(`Preparando proposta de código`);
  passos.push(`Usando contexto de ${arquivosContexto.length} arquivo(s)`);

  const listaArquivos = arvore.filter(a => a.tipo === 'file').slice(0, 500).map(a => a.path).join('\n');
  const prompt = `Você é um desenvolvedor experiente. Proponha alterações com segurança e completude.

Solicitação do usuário:
"${mensagem}"

Plano de ação:
${analise.plano_acao}

Arquivos para modificar:
${arquivosContexto.map(a => `
Arquivo: ${a.caminho}
Conteúdo atual:
\`\`\`
${a.conteudo}
\`\`\`
`).join("\n")}

Estrutura do projeto (amostra):
${listaArquivos}

Responda APENAS com JSON válido (sem quebras de linha nas strings de descrição):
{
  "mudancas": [
    {
      "arquivo": "caminho/do/arquivo.js",
      "conteudo_novo": "conteúdo completo do arquivo atualizado",
      "descricao": "Descrição clara da mudança em uma linha"
    }
  ],
  "mensagem_commit": "mensagem descritiva para o commit"
}

IMPORTANTE:
- Retorne JSON válido sem quebras de linha nas strings de descrição/commit
- Retorne o conteúdo COMPLETO de cada arquivo, não apenas trechos
- Use caminhos EXATOS da lista de arquivos do projeto
- Mantenha a formatação e estilo do código existente
`;

  try {
    const resposta = await chat_simples("Gerar proposta de mudanças", prompt);
    const json = extrairJSON(resposta);
    if (json) return { ...json, analise: { ...analise, passos } };
  } catch (e) {
    console.error("Erro ao gerar mudanças:", e);
  }

  return {
    mudancas: [],
    mensagem_commit: "Alterações via agente",
    analise: { ...analise, passos }
  };
}

export async function analisarDiferencas(original, novo) {
  const linhasOriginais = original.split("\n");
  const linhasNovas = novo.split("\n");
  const diferencas = {
    linhas_adicionadas: 0,
    linhas_removidas: 0,
    linhas_modificadas: 0,
    total_linhas_antes: linhasOriginais.length,
    total_linhas_depois: linhasNovas.length
  };
  const maxLinhas = Math.max(linhasOriginais.length, linhasNovas.length);
  for (let i = 0; i < maxLinhas; i++) {
    const linhaOriginal = linhasOriginais[i];
    const linhaNova = linhasNovas[i];
    if (linhaOriginal === undefined && linhaNova !== undefined) diferencas.linhas_adicionadas++;
    else if (linhaOriginal !== undefined && linhaNova === undefined) diferencas.linhas_removidas++;
    else if (linhaOriginal !== linhaNova) diferencas.linhas_modificadas++;
  }
  return diferencas;
}

export function gerarDiff(original, novo, nomeArquivo) {
  const linhasOriginais = original.split("\n");
  const linhasNovas = novo.split("\n");
  let diff = `diff --git a/${nomeArquivo} b/${nomeArquivo}\n`;
  diff += `--- a/${nomeArquivo}\n`;
  diff += `+++ b/${nomeArquivo}\n`;
  diff += `@@ -1,${linhasOriginais.length} +1,${linhasNovas.length} @@\n`;
  const maxLinhas = Math.max(linhasOriginais.length, linhasNovas.length);
  for (let i = 0; i < maxLinhas; i++) {
    const linhaOriginal = linhasOriginais[i];
    const linhaNova = linhasNovas[i];
    if (linhaOriginal === undefined && linhaNova !== undefined) diff += `+${linhaNova}\n`;
    else if (linhaOriginal !== undefined && linhaNova === undefined) diff += `-${linhaOriginal}\n`;
    else if (linhaOriginal !== linhaNova) { diff += `-${linhaOriginal}\n`; diff += `+${linhaNova}\n`; }
    else diff += ` ${linhaOriginal}\n`;
  }
  return diff;
}
