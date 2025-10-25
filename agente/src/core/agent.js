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
import { ContextAwareness } from "./context-awareness.js";

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

COMANDOS AUTÔNOMOS ESPECIAIS:
- Se o usuário pedir para "criar uma LP exemplar", "criar landing page exemplar", "criar exemplo de LP" ou similar, classifique como "autonomous_lp"
- Se o usuário pedir para "criar um exemplo", "fazer um exemplo", "mostrar como ficaria" de qualquer coisa, classifique como "autonomous_example"
- Para comandos autônomos, defina confidence como 1.0 e não faça perguntas

Responda APENAS em JSON válido:
{
  "kind": "chat | analysis | code_change | question | repo | autonomous_lp | autonomous_example",
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
      const intent = JSON.parse(resposta.slice(i, j + 1));
      
      // Para comandos autônomos, nunca fazer perguntas
      if (intent.kind === "autonomous_lp" || intent.kind === "autonomous_example") {
        intent.needsQuestions = false;
        intent.confidence = 1.0;
        return intent;
      }
      
      // Se for uma mudança de código e a confiança for baixa, marcar para perguntas
      if (intent.kind === "code_change" && intent.confidence < 0.7) {
        intent.needsQuestions = true;
      }
      
      return intent;
    }
  } catch {}
  return { kind: "code_change", targets: [], plan: ["Entender", "Modificar", "Validar"], confidence: 0.4, needsQuestions: true };
}

async function answerChat(mensagem, ctx, behaviorAdjustments = {}) {
  // Detectar se é uma resposta conversacional natural
  const naturalResponse = generateNaturalResponse(mensagem, ctx, behaviorAdjustments);
  if (naturalResponse) {
    return naturalResponse;
  }

  // Aplicar ajustes comportamentais na resposta do chat
  let contexto = ctx.resumoContexto ? `Contexto resumido do projeto e conversa:\n${ctx.resumoContexto}` : "";
  
  // Adicionar instruções comportamentais baseadas na consciência contextual
  if (behaviorAdjustments.responseStyle || behaviorAdjustments.detailLevel || behaviorAdjustments.formality) {
    contexto += "\n\nAjustes comportamentais para esta resposta:\n";
    
    if (behaviorAdjustments.responseStyle === 'direct') {
      contexto += "- Seja direto e objetivo, evite rodeios\n";
    } else if (behaviorAdjustments.responseStyle === 'explanatory') {
      contexto += "- Forneça explicações detalhadas e contexto adicional\n";
    } else if (behaviorAdjustments.responseStyle === 'casual') {
      contexto += "- Use um tom mais casual e descontraído\n";
    }
    
    if (behaviorAdjustments.detailLevel === 'high') {
      contexto += "- Inclua mais detalhes técnicos e passos intermediários\n";
    } else if (behaviorAdjustments.detailLevel === 'low') {
      contexto += "- Mantenha a resposta concisa e focada\n";
    }
    
    if (behaviorAdjustments.formality === 'casual') {
      contexto += "- Use linguagem informal e amigável\n";
    } else if (behaviorAdjustments.formality === 'professional') {
      contexto += "- Mantenha um tom profissional e formal\n";
    }
    
    if (behaviorAdjustments.proactivity === 'high') {
      contexto += "- Seja proativo em sugerir melhorias e próximos passos\n";
    }
  }
  
  return await chat_simples(mensagem, contexto);
}

/**
 * Gera respostas conversacionais naturais para interações básicas
 */
function generateNaturalResponse(mensagem, ctx, behaviorAdjustments = {}) {
  const msg = mensagem.toLowerCase().trim();
  
  // Aplicar ajustes de formalidade
  const isCasual = behaviorAdjustments.formality === 'casual';
  const isProfessional = behaviorAdjustments.formality === 'professional';
  
  // Cumprimentos
  const greetings = ['oi', 'olá', 'ola', 'hey', 'hi', 'hello', 'bom dia', 'boa tarde', 'boa noite'];
  if (greetings.some(greeting => msg === greeting || msg.startsWith(greeting + ' ') || msg.startsWith(greeting + ','))) {
    let responses;
    if (isProfessional) {
      responses = [
        'Olá! Como posso auxiliá-lo hoje?',
        'Bom dia! Estou à disposição para ajudar com seu projeto.',
        'Saudações! Em que posso ser útil?',
        'Olá! Pronto para colaborar em suas necessidades.'
      ];
    } else if (isCasual) {
      responses = [
        'E aí! 😄 Bora trabalhar juntos?',
        'Oi! Tudo certo? Vamos fazer algo massa hoje?',
        'Hey! 🤘 Qual é a boa de hoje?',
        'Salve! Pronto pra codar? 🚀'
      ];
    } else {
      responses = [
        'Oi! 👋 Como posso ajudar você hoje?',
        'Olá! Estou aqui para ajudar com seu projeto. O que você gostaria de fazer?',
        'Oi! Pronto para trabalhar juntos. Em que posso ajudar?',
        'Hey! 🤖 Vamos criar algo incrível hoje?'
      ];
    }
    return responses[Math.floor(Math.random() * responses.length)];
  }

  // Agradecimentos
  const thanks = ['obrigado', 'obrigada', 'valeu', 'thanks', 'thank you', 'brigado', 'brigada'];
  if (thanks.some(thank => msg.includes(thank))) {
    const responses = [
      'De nada! 😊 Estou sempre aqui para ajudar.',
      'Por nada! Foi um prazer ajudar. Precisa de mais alguma coisa?',
      'Fico feliz em ajudar! 🚀 Vamos continuar?',
      'Sempre às ordens! Que tal o próximo desafio?'
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  // Despedidas
  const farewells = ['tchau', 'bye', 'até logo', 'até mais', 'falou', 'até', 'adeus'];
  if (farewells.some(farewell => msg === farewell || msg.startsWith(farewell + ' '))) {
    const responses = [
      'Até logo! 👋 Foi ótimo trabalhar com você.',
      'Tchau! Estarei aqui quando precisar. 🤖',
      'Até mais! Espero ter ajudado bastante hoje.',
      'Falou! Qualquer coisa, é só chamar! 🚀'
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  // Elogios
  const compliments = ['muito bom', 'excelente', 'perfeito', 'ótimo', 'incrível', 'top', 'show', 'massa'];
  if (compliments.some(comp => msg.includes(comp))) {
    const responses = [
      'Que bom que gostou! 😊 Vamos continuar fazendo coisas incríveis.',
      'Obrigado! 🤖 Adoro quando o resultado fica do seu gosto.',
      'Fico feliz que tenha ficado bom! Próximo desafio?',
      'Show! 🚀 Trabalhando juntos sempre dá certo.'
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  // Confirmações simples
  const confirmations = ['ok', 'okay', 'certo', 'entendi', 'beleza', 'perfeito', 'sim', 'yes'];
  if (confirmations.includes(msg)) {
    const responses = [
      'Perfeito! 👍 Vamos em frente.',
      'Ótimo! O que fazemos agora?',
      'Beleza! 🤖 Próximo passo?',
      'Show! Estamos alinhados. 🚀'
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  // Pedidos de ajuda genéricos
  const helpRequests = ['me ajuda', 'preciso de ajuda', 'help', 'socorro', 'não sei'];
  if (helpRequests.some(help => msg.includes(help))) {
    const responses = [
      'Claro! 🤖 Estou aqui para isso. Me conte o que você precisa.',
      'Sempre! Em que posso ajudar especificamente?',
      'É para isso que existo! 😊 Qual é o desafio?',
      'Vamos resolver juntos! 🚀 Me explica melhor o que você precisa.'
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  // Expressões de dúvida
  const doubts = ['não entendi', 'como assim', 'o que', 'hein', 'como', 'que isso'];
  if (doubts.some(doubt => msg.includes(doubt))) {
    const responses = [
      'Deixa eu explicar melhor! 🤖 O que especificamente não ficou claro?',
      'Sem problemas! Vou detalhar mais. Sobre qual parte você tem dúvida?',
      'Ah, vou esclarecer! 😊 Me diz onde posso ser mais específico.',
      'Tranquilo! 🚀 Vamos por partes. O que você gostaria que eu explicasse?'
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  return null; // Não é uma resposta conversacional natural
}

async function generateClarifyingQuestions(mensagem, ctx) {
  const prompt = `Você é um agente de desenvolvimento experiente. O usuário fez o seguinte pedido:

"${mensagem}"

Contexto do projeto:
${ctx.resumoContexto}

Estrutura do projeto (amostra):
${ctx.estruturaAmostra}

Gere 2-4 perguntas específicas e objetivas para esclarecer os requisitos antes de começar o desenvolvimento. 
As perguntas devem ajudar a entender melhor:
- Funcionalidades específicas desejadas
- Tecnologias ou frameworks preferidos
- Estilo visual ou UX esperado
- Integrações necessárias

Responda APENAS em JSON válido:
{
  "questions": [
    "Pergunta específica 1?",
    "Pergunta específica 2?",
    "Pergunta específica 3?"
  ]
}`;

  try {
    const resposta = await chat_simples(prompt, "Geração de perguntas de esclarecimento");
    const i = resposta.indexOf("{");
    const j = resposta.lastIndexOf("}");
    if (i >= 0 && j > i) {
      const result = JSON.parse(resposta.slice(i, j + 1));
      return result.questions || [];
    }
  } catch (e) {
    console.error("Erro ao gerar perguntas:", e);
  }
  
  // Fallback com perguntas genéricas
  return [
    "Que funcionalidades específicas você gostaria que fossem implementadas?",
    "Há alguma tecnologia ou framework específico que prefere?",
    "Como você imagina a interface visual deste projeto?"
  ];
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

// Instância global do sistema de consciência contextual
const contextAwareness = new ContextAwareness();

export async function processMessageStream(mensagem, estado, arvore, res) {
  emitThought(res, "Coletando contexto do projeto", "running");
  const ctx = await collectContext(estado, arvore);
  emitThought(res, "Coletando contexto do projeto", "completed", [
    `Conversas: ${ctx.conversas.length}`,
    `Eventos: ${ctx.historico.length}`,
    `Arquivos conhecidos: ${ctx.files.length}`,
  ]);

  // Análise de consciência contextual
  emitThought(res, "Analisando consciência contextual", "running");
  const contextAnalysis = contextAwareness.analyzeContext(mensagem, ctx.conversas, {
    files: ctx.files,
    packageJson: estado.packageJson
  });
  emitThought(res, "Analisando consciência contextual", "completed", [
    `Estilo de resposta: ${contextAnalysis.behaviorAdjustments.responseStyle}`,
    `Nível de detalhe: ${contextAnalysis.behaviorAdjustments.detailLevel}`,
    `Proatividade: ${contextAnalysis.behaviorAdjustments.proactivity}`,
    `Formalidade: ${contextAnalysis.behaviorAdjustments.formality}`
  ]);

  emitThought(res, "Analisando intenção e definindo plano", "running");
  const intent = await analyzeIntent(mensagem, ctx);
  
  // Aplicar ajustes comportamentais baseados na consciência contextual
  intent.behaviorAdjustments = contextAnalysis.behaviorAdjustments;
  intent.contextRecommendations = contextAnalysis.recommendations;
  
  emitThought(res, "Analisando intenção e definindo plano", "completed", intent.plan || []);

  // Se precisar de perguntas de esclarecimento
  if (intent.needsQuestions) {
    emitThought(res, "Gerando perguntas de esclarecimento", "running");
    const questions = await generateClarifyingQuestions(mensagem, ctx);
    emitThought(res, "Gerando perguntas de esclarecimento", "completed", [`${questions.length} perguntas geradas`]);
    
    const questionText = "Preciso de algumas informações adicionais para implementar sua solicitação da melhor forma:\n\n" + 
                        questions.map((q, i) => `${i + 1}. ${q}`).join('\n') + 
                        "\n\nPor favor, responda essas perguntas para que eu possa prosseguir com o desenvolvimento.";
    
    salvarConversa(estado.projetoId, mensagem, questionText);
    emitComplete(res, { resposta: questionText, mudancas: [], needsQuestions: true });
    try { res.end(); } catch {}
    return;
  }

  if (intent.kind === "chat") {
    emitThought(res, "Gerando resposta contextual", "running");
    const resposta = await answerChat(mensagem, ctx, contextAnalysis.behaviorAdjustments);
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

  // Comandos autônomos
  if (intent.kind === "autonomous_lp") {
    emitThought(res, "Criando landing page exemplar automaticamente", "running");
    const resultado = await createExampleLandingPage(estado.projetoId, estado.pasta, arvore);
    emitThought(res, "Criando landing page exemplar automaticamente", "completed");
    
    if (resultado.mudancas && resultado.mudancas.length > 0) {
      const mudancasComId = [];
      for (const mudanca of resultado.mudancas) {
        emitThought(res, `Aplicando mudança em ${mudanca.arquivo}`, "running");
        const p = path.join(estado.pasta, mudanca.arquivo);
        let original = "";
        try { original = await fs.promises.readFile(p, "utf-8"); } catch {}
        const diff = gerarDiff(original, mudanca.conteudo_novo, mudanca.arquivo);
        const analise = await analisarDiferencas(original, mudanca.conteudo_novo);
        
        const mudancaId = await criarMudancaPendente(
          estado.projetoId,
          mudanca.arquivo,
          original,
          mudanca.conteudo_novo,
          diff,
          analise.resumo,
          analise.riscos
        );
        
        mudancasComId.push({ id: mudancaId, ...mudanca });
        emitThought(res, `Aplicando mudança em ${mudanca.arquivo}`, "completed");
      }
      
      salvarConversa(estado.projetoId, mensagem, resultado.resposta);
      emitComplete(res, { resposta: resultado.resposta, mudancas: mudancasComId });
      try { res.end(); } catch {}
      return;
    }
  }

  if (intent.kind === "autonomous_example") {
    emitThought(res, "Criando exemplo automaticamente", "running");
    const resultado = await createAutonomousExample(mensagem, estado.projetoId, estado.pasta, arvore);
    emitThought(res, "Criando exemplo automaticamente", "completed");
    
    if (resultado.mudancas && resultado.mudancas.length > 0) {
      const mudancasComId = [];
      for (const mudanca of resultado.mudancas) {
        emitThought(res, `Aplicando mudança em ${mudanca.arquivo}`, "running");
        const p = path.join(estado.pasta, mudanca.arquivo);
        let original = "";
        try { original = await fs.promises.readFile(p, "utf-8"); } catch {}
        const diff = gerarDiff(original, mudanca.conteudo_novo, mudanca.arquivo);
        const analise = await analisarDiferencas(original, mudanca.conteudo_novo);
        
        const mudancaId = await criarMudancaPendente(
          estado.projetoId,
          mudanca.arquivo,
          original,
          mudanca.conteudo_novo,
          diff,
          analise.resumo,
          analise.riscos
        );
        
        mudancasComId.push({ id: mudancaId, ...mudanca });
        emitThought(res, `Aplicando mudança em ${mudanca.arquivo}`, "completed");
      }
      
      salvarConversa(estado.projetoId, mensagem, resultado.resposta);
      emitComplete(res, { resposta: resultado.resposta, mudancas: mudancasComId });
      try { res.end(); } catch {}
      return;
    }
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

// Função para criar landing page exemplar automaticamente
async function createExampleLandingPage(projetoId, pasta, arvore) {
  const prompt = `Crie uma landing page exemplar moderna e atrativa para um produto/serviço fictício.

A landing page deve incluir:
- Header com navegação
- Hero section com call-to-action
- Seção de features/benefícios
- Seção de depoimentos
- Footer com links

Use dados exemplares realistas e design moderno com:
- Cores atrativas e profissionais
- Tipografia clara
- Layout responsivo
- Componentes React funcionais
- CSS moderno (flexbox/grid)

Substitua completamente o conteúdo do App.js com a nova landing page.

Responda APENAS em JSON válido:
{
  "mudancas": [
    {
      "arquivo": "src/App.js",
      "conteudo_novo": "código completo da landing page"
    }
  ],
  "resposta": "Criei uma landing page exemplar moderna com seções de hero, features, depoimentos e footer. A página está pronta para visualização!"
}`;

  try {
    const resposta = await chat_simples(prompt, "Criação de landing page exemplar");
    const i = resposta.indexOf("{");
    const j = resposta.lastIndexOf("}");
    if (i >= 0 && j > i) {
      return JSON.parse(resposta.slice(i, j + 1));
    }
  } catch (e) {
    console.error("Erro ao criar landing page exemplar:", e);
  }

  // Fallback com landing page básica
  return {
    mudancas: [{
      arquivo: "src/App.jsx",
      conteudo_novo: `import React from 'react';
import './App.css';

function App() {
  return (
    <div className="App">
      <header className="hero">
        <nav className="navbar">
          <div className="nav-brand">
            <h2>TechSolution</h2>
          </div>
          <ul className="nav-links">
            <li><a href="#features">Features</a></li>
            <li><a href="#testimonials">Depoimentos</a></li>
            <li><a href="#contact">Contato</a></li>
          </ul>
        </nav>
        
        <div className="hero-content">
          <h1>Transforme seu Negócio com Nossa Solução</h1>
          <p>A plataforma mais completa para automatizar seus processos e aumentar sua produtividade em até 300%</p>
          <div className="hero-buttons">
            <button className="btn-primary">Começar Grátis</button>
            <button className="btn-secondary">Ver Demo</button>
          </div>
        </div>
      </header>

      <section id="features" className="features">
        <div className="container">
          <h2>Por que escolher nossa solução?</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">⚡</div>
              <h3>Super Rápido</h3>
              <p>Processe milhares de dados em segundos com nossa tecnologia avançada</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔒</div>
              <h3>100% Seguro</h3>
              <p>Seus dados protegidos com criptografia de nível militar</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📊</div>
              <h3>Analytics Avançado</h3>
              <p>Relatórios detalhados e insights em tempo real</p>
            </div>
          </div>
        </div>
      </section>

      <section id="testimonials" className="testimonials">
        <div className="container">
          <h2>O que nossos clientes dizem</h2>
          <div className="testimonials-grid">
            <div className="testimonial-card">
              <p>"Aumentamos nossa produtividade em 250% no primeiro mês!"</p>
              <div className="testimonial-author">
                <strong>Maria Silva</strong>
                <span>CEO, TechCorp</span>
              </div>
            </div>
            <div className="testimonial-card">
              <p>"A melhor decisão que tomamos para nossa empresa."</p>
              <div className="testimonial-author">
                <strong>João Santos</strong>
                <span>CTO, InnovaTech</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-section">
              <h3>TechSolution</h3>
              <p>Transformando negócios através da tecnologia</p>
            </div>
            <div className="footer-section">
              <h4>Links</h4>
              <ul>
                <li><a href="#features">Features</a></li>
                <li><a href="#pricing">Preços</a></li>
                <li><a href="#support">Suporte</a></li>
              </ul>
            </div>
            <div className="footer-section">
              <h4>Contato</h4>
              <p>contato@techsolution.com</p>
              <p>(11) 9999-9999</p>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; 2024 TechSolution. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;`
    }, {
      arquivo: "src/App.css",
      conteudo_novo: `/* Reset e configurações globais */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  line-height: 1.6;
  color: #333;
}

.App {
  min-height: 100vh;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

/* Header e Hero Section */
.hero {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.navbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
}

.nav-brand h2 {
  font-size: 1.8rem;
  font-weight: 700;
}

.nav-links {
  display: flex;
  list-style: none;
  gap: 2rem;
}

.nav-links a {
  color: white;
  text-decoration: none;
  font-weight: 500;
  transition: opacity 0.3s ease;
}

.nav-links a:hover {
  opacity: 0.8;
}

.hero-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  padding: 2rem;
}

.hero-content h1 {
  font-size: 3.5rem;
  font-weight: 700;
  margin-bottom: 1.5rem;
  max-width: 800px;
}

.hero-content p {
  font-size: 1.3rem;
  margin-bottom: 2.5rem;
  max-width: 600px;
  opacity: 0.9;
}

.hero-buttons {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  justify-content: center;
}

.btn-primary, .btn-secondary {
  padding: 1rem 2rem;
  font-size: 1.1rem;
  font-weight: 600;
  border: none;
  border-radius: 50px;
  cursor: pointer;
  transition: all 0.3s ease;
  text-decoration: none;
  display: inline-block;
}

.btn-primary {
  background: white;
  color: #667eea;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
}

.btn-secondary {
  background: transparent;
  color: white;
  border: 2px solid white;
}

.btn-secondary:hover {
  background: white;
  color: #667eea;
}

/* Features Section */
.features {
  padding: 5rem 0;
  background: #f8f9fa;
}

.features h2 {
  text-align: center;
  font-size: 2.5rem;
  margin-bottom: 3rem;
  color: #333;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
}

.feature-card {
  background: white;
  padding: 2.5rem;
  border-radius: 15px;
  text-align: center;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease;
}

.feature-card:hover {
  transform: translateY(-5px);
}

.feature-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.feature-card h3 {
  font-size: 1.5rem;
  margin-bottom: 1rem;
  color: #333;
}

.feature-card p {
  color: #666;
  line-height: 1.6;
}

/* Testimonials Section */
.testimonials {
  padding: 5rem 0;
  background: white;
}

.testimonials h2 {
  text-align: center;
  font-size: 2.5rem;
  margin-bottom: 3rem;
  color: #333;
}

.testimonials-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 2rem;
}

.testimonial-card {
  background: #f8f9fa;
  padding: 2rem;
  border-radius: 15px;
  border-left: 4px solid #667eea;
}

.testimonial-card p {
  font-size: 1.1rem;
  font-style: italic;
  margin-bottom: 1.5rem;
  color: #555;
}

.testimonial-author strong {
  display: block;
  color: #333;
  margin-bottom: 0.5rem;
}

.testimonial-author span {
  color: #666;
  font-size: 0.9rem;
}

/* Footer */
.footer {
  background: #333;
  color: white;
  padding: 3rem 0 1rem;
}

.footer-content {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 2rem;
  margin-bottom: 2rem;
}

.footer-section h3, .footer-section h4 {
  margin-bottom: 1rem;
}

.footer-section ul {
  list-style: none;
}

.footer-section ul li {
  margin-bottom: 0.5rem;
}

.footer-section a {
  color: #ccc;
  text-decoration: none;
  transition: color 0.3s ease;
}

.footer-section a:hover {
  color: white;
}

.footer-bottom {
  text-align: center;
  padding-top: 2rem;
  border-top: 1px solid #555;
  color: #ccc;
}

/* Responsividade */
@media (max-width: 768px) {
  .hero-content h1 {
    font-size: 2.5rem;
  }
  
  .hero-content p {
    font-size: 1.1rem;
  }
  
  .nav-links {
    display: none;
  }
  
  .features-grid {
    grid-template-columns: 1fr;
  }
  
  .testimonials-grid {
    grid-template-columns: 1fr;
  }
  
  .hero-buttons {
    flex-direction: column;
    align-items: center;
  }
  
  .btn-primary, .btn-secondary {
    width: 200px;
  }
}`
    }],
    resposta: "Criei uma landing page exemplar moderna com seções de hero, features, depoimentos e footer. A página inclui dados exemplares e está pronta para visualização!"
  };
}

// Função para criar exemplos autônomos baseados na mensagem do usuário
async function createAutonomousExample(mensagem, projetoId, pasta, arvore) {
  const prompt = `O usuário pediu: "${mensagem}"

Crie um exemplo completo e funcional baseado no pedido. Analise o que foi solicitado e implemente automaticamente.

Se for sobre:
- Componentes: crie componentes React funcionais
- Páginas: crie páginas completas
- Features: implemente a funcionalidade completa
- Estilos: adicione CSS moderno e responsivo

Use dados exemplares realistas e código de qualidade profissional.

Responda APENAS em JSON válido:
{
  "mudancas": [
    {
      "arquivo": "caminho/do/arquivo",
      "conteudo_novo": "código completo"
    }
  ],
  "resposta": "Descrição do que foi criado"
}`;

  try {
    const resposta = await chat_simples(prompt, "Criação de exemplo autônomo");
    const i = resposta.indexOf("{");
    const j = resposta.lastIndexOf("}");
    if (i >= 0 && j > i) {
      return JSON.parse(resposta.slice(i, j + 1));
    }
  } catch (e) {
    console.error("Erro ao criar exemplo autônomo:", e);
  }

  // Fallback
  return {
    mudancas: [],
    resposta: "Não foi possível criar o exemplo automaticamente. Tente ser mais específico sobre o que deseja."
  };
}
