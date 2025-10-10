import { chat_simples } from "./llm.js";
import { buscarContextoProjeto, salvarContextoArquivo } from "./database.js";
import fs from "node:fs";
import path from "node:path";

export async function analisarIntencao(mensagem, projetoId, arvore) {
  const contexto = await buscarContextoProjeto(projetoId, 20);
  const todosArquivos = arvore.filter(a => a.tipo === "file").map(a => a.path);
  const arquivosRelevantes = todosArquivos.slice(0, 300);

  const prompt = `Voc2 8 um assistente de an2lise de c30digo. Analise a inten30o do usu2rio e identifique:
1. Quais arquivos provavelmente precisam ser alterados
2. Tipo de altera30o (cria30o, edi30o, exclus2o, refatora30o)
3. Complexidade estimada (baixa, m5dia, alta)
4. Riscos potenciais

Mensagem do usu2rio: "${mensagem}"

Arquivos dispon2veis no projeto (amostra):
${arquivosRelevantes.join("\n")}

Contexto de arquivos recentemente acessados:
${contexto.map(c => `- ${c.caminho}`).join("\n")}

Responda em JSON com:
{
  "arquivos_alvo": ["caminho1", "caminho2"],
  "tipo_mudanca": "edi30o|cria30o|exclus2o|refatora30o",
  "complexidade": "baixa|m5dia|alta",
  "riscos": ["risco1", "risco2"],
  "plano_acao": "descri30o breve do que ser3 feito"
}

IMPORTANTE:
- Sempre selecione caminhos que EXISTEM na lista de arquivos do projeto, quando for uma edi30o/refatora30o.
- Se precisar criar um arquivo novo, indique um caminho plaus2vel dentro da estrutura existente.
`;

  try {
    const resposta = await chat_simples("Analise a inten30o", prompt);
    const inicio = resposta.indexOf("{");
    const fim = resposta.lastIndexOf("}");

    if (inicio >= 0 && fim > inicio) {
      const json = JSON.parse(resposta.slice(inicio, fim + 1));
      return json;
    }
  } catch (e) {
    console.error("Erro ao analisar inten30o:", e);
  }

  return {
    arquivos_alvo: [],
    tipo_mudanca: "edi30o",
    complexidade: "m5dia",
    riscos: [],
    plano_acao: "Executar a solicita30o do usu2rio"
  };
}

function normalizarTokens(texto) {
  return String(texto || "")
    .toLowerCase()
    .replace(/[^a-z0-9._\-/ ]+/g, " ")
    .split(/\s+/)
    .filter(t => t && t.length >= 3);
}

function heuristicaArquivos(arvore, mensagem) {
  const files = arvore.filter(a => a.tipo === "file").map(a => a.path);
  const tokens = normalizarTokens(mensagem);
  const pontuacao = new Map();

  const boostExt = (p) => (p.endsWith('.jsx')||p.endsWith('.tsx')) ? 3 : (p.endsWith('.js')||p.endsWith('.ts')) ? 2 : 1;

  for (const f of files) {
    let score = 0;
    const fLower = f.toLowerCase();
    for (const t of tokens) {
      if (fLower.includes(t)) score += 2;
    }
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
  if (candidatos.length === 0) {
    candidatos.push(...files.filter(f => /\.(jsx?|tsx?)$/i.test(f)).slice(0,3));
  }
  if (candidatos.length === 0) candidatos.push(...files.slice(0,1));

  return Array.from(new Set(candidatos)).slice(0,3);
}

export async function gerarMudancaInteligente(mensagem, projetoId, pastaProjeto, arvore) {
  const passos = [];
  passos.push(`Arquivos no projeto (amostra de ${Math.min(300, arvore.filter(a=>a.tipo==='file').length)} arquivos)`);
  const analise = await analisarIntencao(mensagem, projetoId, arvore);
  passos.push("Intenção analisada pelo LLM");

  const arquivosContexto = [];
  let candidatos = Array.isArray(analise.arquivos_alvo) ? analise.arquivos_alvo.slice(0,5) : [];
  const conjunto = new Set(arvore.filter(a => a.tipo === 'file').map(a => a.path));
  candidatos = candidatos.filter(c => conjunto.has(c));
  if (candidatos.length === 0) {
    candidatos = heuristicaArquivos(arvore, mensagem);
  }
  if (candidatos.length) {
    passos.push(`Arquivos candidatos: ${candidatos.slice(0,3).join(', ')}`);
  } else {
    passos.push('Nenhum arquivo candidato encontrado');
  }

  for (const arquivoAlvo of candidatos) {
    try {
      const caminhoCompleto = path.join(pastaProjeto, arquivoAlvo);
      const existe = await fs.promises.access(caminhoCompleto).then(() => true).catch(() => false);

      if (existe) {
        const conteudo = await fs.promises.readFile(caminhoCompleto, "utf-8");
        arquivosContexto.push({ caminho: arquivoAlvo, conteudo: conteudo.slice(0, 10000) });
        await salvarContextoArquivo(projetoId, arquivoAlvo, conteudo);
      }
    } catch (e) {
      console.error(`Erro ao ler ${arquivoAlvo}:`, e);
    }
  }

  const listaArquivos = arvore.filter(a => a.tipo === 'file').slice(0, 500).map(a => a.path).join('\n');

  const prompt = `Voc2 8 um desenvolvedor experiente. Gere as altera55es necess5rias para atender ao pedido.

Pedido: "${mensagem}"

Plano de a50o: ${analise.plano_acao}

Arquivos para alterar:
${arquivosContexto.map(a => `
Arquivo: ${a.caminho}
Conte40do atual:
\`\`\`
${a.conteudo}
\`\`\`
`).join("\n")}

Arquivos existentes no projeto (amostra):
${listaArquivos}

Responda em JSON com um array de mudan55es:
{
  "mudancas": [
    {
      "arquivo": "caminho/do/arquivo.js",
      "conteudo_novo": "conte40do completo do arquivo atualizado",
      "descricao": "descri30o breve da mudan5a"
    }
  ],
  "mensagem_commit": "mensagem descritiva para o commit"
}

IMPORTANTE:
- Retorne o conte40do COMPLETO de cada arquivo, n5o apenas as linhas alteradas.
- Se nenhum arquivo alvo foi fornecido acima, escolha 1 a 3 caminhos EXISTENTES da lista e preencha o campo "arquivo" com esses caminhos exatos.
- Se precisar criar arquivo novo, indique um caminho coerente com a estrutura mostrada.
`;

  try {
    const resposta = await chat_simples("Gere as mudan5as", prompt);
    const inicio = resposta.indexOf("{");
    const fim = resposta.lastIndexOf("}");

    if (inicio >= 0 && fim > inicio) {
      const json = JSON.parse(resposta.slice(inicio, fim + 1));
      return { ...json, analise: { ...analise, passos } };
    }
  } catch (e) {
    console.error("Erro ao gerar mudan5as:", e);
  }

  return {
    mudancas: [],
    mensagem_commit: "Altera55es via agente",
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

    if (linhaOriginal === undefined && linhaNova !== undefined) {
      diferencas.linhas_adicionadas++;
    } else if (linhaOriginal !== undefined && linhaNova === undefined) {
      diferencas.linhas_removidas++;
    } else if (linhaOriginal !== linhaNova) {
      diferencas.linhas_modificadas++;
    }
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

    if (linhaOriginal === undefined && linhaNova !== undefined) {
      diff += `+${linhaNova}\n`;
    } else if (linhaOriginal !== undefined && linhaNova === undefined) {
      diff += `-${linhaOriginal}\n`;
    } else if (linhaOriginal !== linhaNova) {
      diff += `-${linhaOriginal}\n`;
      diff += `+${linhaNova}\n`;
    } else {
      diff += ` ${linhaOriginal}\n`;
    }
  }

  return diff;
}
