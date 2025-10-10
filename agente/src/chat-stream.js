import { gerarMudancaInteligente, gerarDiff, analisarDiferencas } from "./analisador.js";
import { criarMudancaPendente, salvarConversa, registrarHistorico } from "./database.js";
import { chat_simples } from "./llm.js";
import path from "node:path";
import fs from "node:fs";

export async function processarChatComStreaming(mensagem, estado, arvore, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  let abortado = false;
  const enviarEtapa = (etapa) => {
    if (!abortado) {
      res.write(`data: ${JSON.stringify({ tipo: 'etapa', conteudo: etapa })}\n\n`);
    }
  };

  try {
    enviarEtapa('🔍 Analisando solicitação...');
    
    enviarEtapa(`📁 Carregados ${arvore.filter(a => a.tipo === 'file').length} arquivos do projeto`);
    
    const resultado = await gerarMudancaInteligente(mensagem, estado.projetoId, estado.pasta, arvore);
    
    if (resultado.analise && resultado.analise.passos) {
      for (const passo of resultado.analise.passos) {
        enviarEtapa(`✓ ${passo}`);
      }
    }

    if (resultado.mudancas && resultado.mudancas.length > 0) {
      enviarEtapa(`🔧 Gerando ${resultado.mudancas.length} alteração(ões)...`);
      
      const mudancasComId = [];
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

        const mudancaId = criarMudancaPendente(
          estado.projetoId,
          mudanca.arquivo,
          original,
          mudanca.conteudo_novo,
          diff,
          mudanca.descricao || "Alteração gerada pelo agente"
        );

        mudancasComId.push({
          id: mudancaId,
          arquivo: mudanca.arquivo,
          descricao: mudanca.descricao,
          diff: diff.slice(0, 5000),
          analise: analise,
          conteudo_original: original,
          conteudo_novo: mudanca.conteudo_novo
        });

        enviarEtapa(`✏️ Preparada alteração em ${mudanca.arquivo}`);
      }

      const resposta = `Analisei sua solicitação e preparei ${resultado.mudancas.length} alteração(ões). Revise as mudanças abaixo:`;

      salvarConversa(estado.projetoId, mensagem, resposta, JSON.stringify(resultado.analise));
      registrarHistorico(estado.projetoId, "mudancas_propostas", `${resultado.mudancas.length} alterações propostas`);

      enviarEtapa('✅ Análise concluída!');

      res.write(`data: ${JSON.stringify({
        tipo: 'completo',
        resposta,
        mudancas: mudancasComId,
        analise: resultado.analise,
        mensagem_commit: resultado.mensagem_commit
      })}\n\n`);
      res.end();
    } else {
      enviarEtapa('💬 Processando resposta...');
      const resposta = await chat_simples(mensagem, "Repositório local aberto");
      salvarConversa(estado.projetoId, mensagem, resposta);
      
      res.write(`data: ${JSON.stringify({
        tipo: 'completo',
        resposta,
        mudancas: []
      })}\n\n`);
      res.end();
    }
  } catch (e) {
    res.write(`data: ${JSON.stringify({ tipo: 'erro', mensagem: String(e?.message || e) })}\n\n`);
    res.end();
  }
}
