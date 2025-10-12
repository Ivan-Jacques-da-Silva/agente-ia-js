import { gerarMudancaInteligente, gerarDiff, analisarDiferencas } from "./analisador.js";
import { criarMudancaPendente, salvarConversa, registrarHistorico } from "./database.js";
import { chat_simples } from "./llm.js";
import path from "node:path";
import fs from "node:fs";

function ehReferenciaAoProjeto(mensagem) {
  const msgLower = mensagem.toLowerCase().trim();
  
  const palavrasChaveProjeto = [
    'meu projeto', 'meu código', 'minha aplicação', 'meu app',
    'este projeto', 'esse projeto', 'o projeto', 'no projeto',
    'os arquivos', 'meus arquivos', 'este código', 'esse código',
    'sintaxe', 'syntax', 'erro', 'bug', 'problema',
    'analisar', 'verificar', 'checar', 'revisar',
    'refatorar', 'melhorar', 'otimizar', 'corrigir',
    'adicionar', 'criar', 'modificar', 'alterar', 'mudar',
    'implementar', 'desenvolver', 'construir'
  ];
  
  for (const palavra of palavrasChaveProjeto) {
    if (msgLower.includes(palavra)) {
      return true;
    }
  }
  
  return false;
}

function ehSolicitacaoDeAnalise(mensagem) {
  const msgLower = mensagem.toLowerCase().trim();
  
  const palavrasAnalise = ['analisar', 'verificar', 'checar', 'revisar', 'ver se', 'tem algum', 'existe'];
  const palavrasChecagem = ['erro', 'bug', 'problema', 'sintaxe', 'syntax', 'issue'];
  const palavrasNegacao = ['não', 'sem', 'nenhum'];
  const palavrasAcao = [
    'corrigir', 'consertar', 'adicionar', 'criar', 'modificar', 'alterar', 
    'mudar', 'implementar', 'desenvolver', 'construir', 'refatorar',
    'remover', 'deletar', 'ajustar', 'atualizar', 'melhorar'
  ];
  
  const temAcao = palavrasAcao.some(p => msgLower.includes(p));
  
  if (temAcao) {
    return false;
  }
  
  let temAnalise = false;
  let temChecagem = false;
  
  for (const palavra of palavrasAnalise) {
    if (msgLower.includes(palavra)) {
      temAnalise = true;
      break;
    }
  }
  
  for (const palavra of palavrasChecagem) {
    if (msgLower.includes(palavra)) {
      temChecagem = true;
      break;
    }
  }
  
  const temNegacao = palavrasNegacao.some(p => msgLower.includes(p));
  
  return (temAnalise && temChecagem) || (temAnalise && !temAcao) || (temChecagem && temNegacao);
}

function ehMensagemDeConversa(mensagem) {
  const msgLower = mensagem.toLowerCase().trim();
  
  if (ehReferenciaAoProjeto(mensagem)) {
    return false;
  }
  
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
    
    if (ehSolicitacaoDeAnalise(mensagem) && ehReferenciaAoProjeto(mensagem)) {
      enviarPensamento('🔍 Identificando solicitação de análise', 'running');
      enviarPensamento('🔍 Identificando solicitação de análise', 'completed');
      
      enviarPensamento('📂 Carregando arquivos do projeto', 'running', [
        `📊 Total de arquivos: ${arvore.filter(a => a.tipo === 'file').length}`
      ]);
      
      const arquivos = arvore.filter(a => a.tipo === 'file').map(a => a.path);
      const arquivosPrincipais = arquivos.filter(a => 
        a.endsWith('.js') || a.endsWith('.jsx') || 
        a.endsWith('.ts') || a.endsWith('.tsx') ||
        a.endsWith('.py') || a.endsWith('.java') ||
        a.includes('package.json') || a.includes('index')
      ).slice(0, 10);
      
      let contextoProjeto = `Estrutura do projeto (${arquivos.length} arquivos):\n${arquivos.slice(0, 50).join('\n')}`;
      
      for (const arquivo of arquivosPrincipais.slice(0, 5)) {
        const arquivoPath = path.join(estado.pasta, arquivo);
        try {
          const conteudo = await fs.promises.readFile(arquivoPath, 'utf-8');
          if (conteudo.length < 3000) {
            contextoProjeto += `\n\n📄 ${arquivo}:\n\`\`\`\n${conteudo}\n\`\`\``;
          }
        } catch (e) {}
      }
      
      enviarPensamento('📂 Carregando arquivos do projeto', 'completed');
      enviarPensamento('🤔 Analisando código em busca de problemas', 'running');
      
      const prompt = `Você é um desenvolvedor experiente analisando um projeto.

SOLICITAÇÃO DO USUÁRIO:
"${mensagem}"

CONTEXTO DO PROJETO:
${contextoProjeto}

Por favor, analise o projeto e responda a solicitação do usuário de forma clara e direta. 
- Se encontrar erros/problemas, liste-os
- Se não encontrar problemas, confirme que está tudo ok
- Seja específico e útil
- Responda de forma amigável com emojis quando apropriado`;

      const resposta = await chat_simples(prompt, "Análise de projeto");
      salvarConversa(estado.projetoId, mensagem, resposta);
      
      enviarPensamento('🤔 Analisando código em busca de problemas', 'completed');
      
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
