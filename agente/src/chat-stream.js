import { gerarMudancaInteligente, gerarDiff, analisarDiferencas } from "./analisador.js";
import { criarMudancaPendente, salvarConversa, registrarHistorico } from "./database.js";
import { chat_simples } from "./llm.js";
import path from "node:path";
import fs from "node:fs";

function ehMensagemDeConversa(mensagem) {
  const msgLower = mensagem.toLowerCase().trim();
  
  if (msgLower.length > 100) {
    return false;
  }
  
  const saudacoesExatas = ['olá', 'oi', 'ola', 'bom dia', 'boa tarde', 'boa noite', 'hello', 'hi', 'hey'];
  const agradecimentosExatos = ['obrigado', 'obrigada', 'valeu', 'thanks', 'thank you'];
  const perguntasSimples = ['como você está', 'tudo bem', 'como vai', 'quem é você', 'o que você faz'];
  
  for (const saudacao of saudacoesExatas) {
    if (msgLower === saudacao || msgLower === saudacao + '!' || msgLower === saudacao + '?') {
      return true;
    }
  }
  
  for (const agradecimento of agradecimentosExatos) {
    if (msgLower === agradecimento || msgLower === agradecimento + '!' || msgLower === agradecimento + '.') {
      return true;
    }
  }
  
  if (msgLower.length < 30) {
    for (const pergunta of perguntasSimples) {
      if (msgLower === pergunta || msgLower === pergunta + '?' || msgLower.includes(pergunta)) {
        return true;
      }
    }
  }
  
  return false;
}

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

  const enviarPensamento = (texto, status = 'running', detalhes = []) => {
    if (!abortado) {
      res.write(`data: ${JSON.stringify({ 
        tipo: 'pensamento', 
        conteudo: { text: texto, status, details: detalhes }
      })}\n\n`);
    }
  };

  try {
    if (ehMensagemDeConversa(mensagem)) {
      enviarPensamento('Identificando tipo de mensagem', 'running');
      enviarPensamento('Identificando tipo de mensagem', 'completed');
      enviarPensamento('Respondendo sua mensagem', 'running');
      
      const resposta = await chat_simples(mensagem, "Conversa com o usuário");
      salvarConversa(estado.projetoId, mensagem, resposta);
      
      enviarPensamento('Respondendo sua mensagem', 'completed');
      
      res.write(`data: ${JSON.stringify({
        tipo: 'completo',
        resposta,
        mudancas: []
      })}\n\n`);
      res.end();
      return;
    }
    
    enviarPensamento('🔍 Analisando sua solicitação', 'running', ['Entendendo o que você precisa', 'Identificando arquivos relevantes']);
    await new Promise(resolve => setTimeout(resolve, 500));
    enviarPensamento('🔍 Analisando sua solicitação', 'completed');
    
    enviarPensamento('📂 Carregando contexto do projeto', 'running', [
      `📊 Total de arquivos: ${arvore.filter(a => a.tipo === 'file').length}`,
      `✅ Estrutura compreendida`
    ]);
    await new Promise(resolve => setTimeout(resolve, 300));
    enviarPensamento('📂 Carregando contexto do projeto', 'completed');
    
    enviarPensamento('🎯 Identificando os melhores arquivos', 'running');
    
    const resultado = await gerarMudancaInteligente(mensagem, estado.projetoId, estado.pasta, arvore);
    
    enviarPensamento('🎯 Identificando os melhores arquivos', 'completed');
    
    if (resultado.analise && resultado.analise.passos) {
      enviarPensamento('💡 Executando análise detalhada', 'running', resultado.analise.passos);
      await new Promise(resolve => setTimeout(resolve, 400));
      enviarPensamento('💡 Executando análise detalhada', 'completed');
    }

    if (resultado.mudancas && resultado.mudancas.length > 0) {
      enviarPensamento(`✨ Preparando ${resultado.mudancas.length} alteração(ões)`, 'running', 
        resultado.mudancas.map(m => `📝 ${m.arquivo}`)
      );
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const mudancasComId = [];
      for (const mudanca of resultado.mudancas) {
        enviarPensamento(`⚙️ Processando ${mudanca.arquivo}`, 'running', [
          '📖 Lendo código atual',
          '🔄 Calculando diferenças',
          '📊 Analisando impacto'
        ]);
        
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

        enviarPensamento(`⚙️ Processando ${mudanca.arquivo}`, 'completed');
      }

      enviarPensamento(`✨ Preparando ${resultado.mudancas.length} alteração(ões)`, 'completed');
      
      enviarPensamento('🎉 Finalizando e preparando resposta', 'running');

      const resposta = `Pronto! Analisei sua solicitação e preparei ${resultado.mudancas.length} alteração(ões) para você. Revise as mudanças abaixo e aprove quando estiver satisfeito:`;

      salvarConversa(estado.projetoId, mensagem, resposta, JSON.stringify(resultado.analise));
      registrarHistorico(estado.projetoId, "mudancas_propostas", `${resultado.mudancas.length} alterações propostas`);

      enviarPensamento('🎉 Finalizando e preparando resposta', 'completed');

      res.write(`data: ${JSON.stringify({
        tipo: 'completo',
        resposta,
        mudancas: mudancasComId,
        analise: resultado.analise,
        mensagem_commit: resultado.mensagem_commit
      })}\n\n`);
      res.end();
    } else {
      enviarPensamento('💬 Preparando resposta para você', 'running');
      const resposta = await chat_simples(mensagem, "Repositório local aberto");
      salvarConversa(estado.projetoId, mensagem, resposta);
      enviarPensamento('💬 Preparando resposta para você', 'completed');
      
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
