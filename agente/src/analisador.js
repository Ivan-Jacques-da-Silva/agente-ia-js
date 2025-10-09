import { chat_simples } from "./llm.js";
import { buscarContextoProjeto, salvarContextoArquivo } from "./database.js";
import fs from "node:fs";
import path from "node:path";

export async function analisarIntencao(mensagem, projetoId, arvore) {
  const contexto = await buscarContextoProjeto(projetoId, 20);
  const arquivosRelevantes = arvore.filter(a => a.tipo === "file").slice(0, 100).map(a => a.path);

  const prompt = `Você é um assistente de análise de código. Analise a intenção do usuário e identifique:
1. Quais arquivos provavelmente precisam ser alterados
2. Tipo de alteração (criação, edição, exclusão, refatoração)
3. Complexidade estimada (baixa, média, alta)
4. Riscos potenciais

Mensagem do usuário: "${mensagem}"

Arquivos disponíveis no projeto (primeiros 100):
${arquivosRelevantes.join("\n")}

Contexto de arquivos recentemente acessados:
${contexto.map(c => `- ${c.caminho}`).join("\n")}

Responda em JSON com:
{
  "arquivos_alvo": ["caminho1", "caminho2"],
  "tipo_mudanca": "edição|criação|exclusão|refatoração",
  "complexidade": "baixa|média|alta",
  "riscos": ["risco1", "risco2"],
  "plano_acao": "descrição breve do que será feito"
}`;

  try {
    const resposta = await chat_simples("Analise a intenção", prompt);
    const inicio = resposta.indexOf("{");
    const fim = resposta.lastIndexOf("}");

    if (inicio >= 0 && fim > inicio) {
      const json = JSON.parse(resposta.slice(inicio, fim + 1));
      return json;
    }
  } catch (e) {
    console.error("Erro ao analisar intenção:", e);
  }

  return {
    arquivos_alvo: [],
    tipo_mudanca: "edição",
    complexidade: "média",
    riscos: [],
    plano_acao: "Executar a solicitação do usuário"
  };
}

export async function gerarMudancaInteligente(mensagem, projetoId, pastaProjeto, arvore) {
  const analise = await analisarIntencao(mensagem, projetoId, arvore);

  const arquivosContexto = [];
  for (const arquivoAlvo of analise.arquivos_alvo.slice(0, 5)) {
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

  const prompt = `Você é um desenvolvedor experiente. Gere as alterações necessárias para atender ao pedido.

Pedido: "${mensagem}"

Plano de ação: ${analise.plano_acao}

Arquivos para alterar:
${arquivosContexto.map(a => `
Arquivo: ${a.caminho}
Conteúdo atual:
\`\`\`
${a.conteudo}
\`\`\`
`).join("\n")}

Responda em JSON com um array de mudanças:
{
  "mudancas": [
    {
      "arquivo": "caminho/do/arquivo.js",
      "conteudo_novo": "conteúdo completo do arquivo atualizado",
      "descricao": "descrição breve da mudança"
    }
  ],
  "mensagem_commit": "mensagem descritiva para o commit"
}

IMPORTANTE: Retorne o conteúdo COMPLETO de cada arquivo, não apenas as linhas alteradas.`;

  try {
    const resposta = await chat_simples("Gere as mudanças", prompt);
    const inicio = resposta.indexOf("{");
    const fim = resposta.lastIndexOf("}");

    if (inicio >= 0 && fim > inicio) {
      const json = JSON.parse(resposta.slice(inicio, fim + 1));
      return { ...json, analise };
    }
  } catch (e) {
    console.error("Erro ao gerar mudanças:", e);
  }

  return {
    mudancas: [],
    mensagem_commit: "Alterações via agente",
    analise
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
