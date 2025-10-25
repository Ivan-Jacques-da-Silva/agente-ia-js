/**
 * Sistema de Análise de Intenção Inteligente e Auto-Interpretativo
 * Interpreta mensagens do usuário de forma contextual e natural
 */

// Categorias de intenção expandidas
export const INTENT_CATEGORIES = {
  GREETING: 'greeting',           // Cumprimentos e saudações
  CASUAL: 'casual',              // Conversa casual, agradecimentos
  PROJECT_REQUEST: 'project_request', // Solicitação de novo projeto
  CODE_HELP: 'code_help',        // Ajuda com código existente
  IMPROVEMENT: 'improvement',     // Melhorias em projeto existente
  QUESTION: 'question',          // Perguntas técnicas
  COMMAND: 'command',            // Comandos específicos
  CONTEXTUAL: 'contextual',      // Resposta baseada no contexto da conversa
  ADAPTIVE: 'adaptive',          // Resposta que se adapta ao nível de detalhe necessário
  UNCLEAR: 'unclear'             // Intenção não clara
};

// Padrões para cada categoria - expandidos e mais naturais
const INTENT_PATTERNS = {
  [INTENT_CATEGORIES.GREETING]: [
    /^(oi|olá|ola|hello|hi|hey)$/i,
    /^(bom dia|boa tarde|boa noite)$/i,
    /^(como vai|tudo bem|e ai|eai|opa|salve)$/i,
    /^(oi|olá|hello|hi)\s*[!.]*$/i,
    /^(oi\s+tudo\s+bem|oi\s+como\s+vai)$/i
  ],
  
  [INTENT_CATEGORIES.CASUAL]: [
    /^(obrigad[oa]|valeu|thanks?|brigado)$/i,
    /^(legal|show|perfeito|ótimo|otimo|beleza|ok|certo|massa|top)$/i,
    /^(entendi|entendo|compreendi|saquei|captei)$/i,
    /^(tchau|bye|até logo|falou|flw|até mais)$/i,
    /^(nossa|uau|wow|incrível|demais)$/i,
    /^(sim|não|nao|claro|certeza|exato)$/i
  ],
  
  [INTENT_CATEGORIES.CONTEXTUAL]: [
    /^(isso|exato|correto|certo|perfeito)$/i,
    /^(continua|continue|prossiga|vai)$/i,
    /^(pode|pode\s+ser|tá\s+bom|ta\s+bom)$/i,
    /^(entendi|saquei|captei|compreendi)$/i,
    /^(mais|e\s+mais|tem\s+mais|algo\s+mais)$/i
  ],
  
  [INTENT_CATEGORIES.PROJECT_REQUEST]: [
    /cri[ae]\s+(uma?\s+)?(lp|landing\s*page)/i,
    /fazer\s+(uma?\s+)?(lp|landing\s*page)/i,
    /construir\s+(uma?\s+)?(aplicação|app|site|sistema)/i,
    /desenvolver\s+(uma?\s+)?(aplicação|app|site|sistema)/i,
    /quero\s+(criar|fazer|desenvolver|construir)/i,
    /preciso\s+(de\s+)?(uma?\s+)?(aplicação|app|site|sistema|lp)/i,
    /gostaria\s+(de\s+)?(criar|fazer|desenvolver)/i,
    /vamos\s+(criar|fazer|desenvolver)/i
  ],
  
  [INTENT_CATEGORIES.CODE_HELP]: [
    /como\s+(fazer|implementar|criar)\s+/i,
    /ajuda\s+(com|para)\s+/i,
    /não\s+(sei|consigo|entendo)\s+como/i,
    /tenho\s+(dúvida|problema)\s+(com|sobre|em)/i,
    /erro\s+(em|no|na)/i,
    /bug\s+(em|no|na)/i,
    /não\s+(funciona|está\s+funcionando)/i,
    /me\s+explica\s+como/i,
    /pode\s+me\s+ajudar\s+com/i
  ],
  
  [INTENT_CATEGORIES.IMPROVEMENT]: [
    /melhor[ae]\s+/i,
    /otimiz[ae]\s+/i,
    /adicione?\s+/i,
    /inclua\s+/i,
    /modifique?\s+/i,
    /alter[ae]\s+/i,
    /atualiz[ae]\s+/i,
    /corrij[ae]\s+/i,
    /ajust[ae]\s+/i,
    /vamos\s+(melhorar|otimizar|adicionar)/i
  ],
  
  [INTENT_CATEGORIES.QUESTION]: [
    /^(o\s+que|que|qual|como|quando|onde|por\s*que|porque)\s+/i,
    /\?$/,
    /posso\s+/i,
    /é\s+possível/i,
    /existe\s+(alguma?\s+)?(forma|maneira|jeito)/i,
    /me\s+fala\s+sobre/i,
    /explica\s+pra\s+mim/i
  ],
  
  [INTENT_CATEGORIES.COMMAND]: [
    /^(execute?|rode?|roda|executa)\s+/i,
    /^(instale?|instala)\s+/i,
    /^(abra|abre)\s+/i,
    /^(salve?|salva)\s+/i,
    /^(delete?|deleta|remove?|remova)\s+/i,
    /^(mostra|mostre|exibe|exiba)\s+/i
  ]
};

// Palavras-chave que indicam contexto
const CONTEXT_KEYWORDS = {
  project: ['projeto', 'aplicação', 'app', 'site', 'sistema', 'landing page', 'lp'],
  code: ['código', 'função', 'componente', 'arquivo', 'script', 'css', 'html', 'javascript', 'react'],
  error: ['erro', 'bug', 'problema', 'falha', 'não funciona', 'quebrado'],
  improvement: ['melhorar', 'otimizar', 'adicionar', 'incluir', 'modificar', 'alterar', 'atualizar']
};

/**
 * Analisa a intenção de uma mensagem com auto-interpretação inteligente
 * @param {string} message - Mensagem do usuário
 * @param {Object} context - Contexto atual (projeto, histórico, etc.)
 * @returns {Object} Resultado da análise
 */
export function analyzeIntent(message, context = {}) {
  const cleanMessage = message.trim();
  const lowerMessage = cleanMessage.toLowerCase();
  
  // Auto-interpretação: determinar nível de análise necessário
  const complexity = determineComplexity(cleanMessage, context);
  
  // Verificar padrões diretos primeiro
  for (const [category, patterns] of Object.entries(INTENT_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(cleanMessage)) {
        return {
          category,
          confidence: 0.9,
          message: cleanMessage,
          context: extractContext(lowerMessage),
          needsAnalysis: false,
          complexity,
          suggestedResponse: generateSuggestedResponse(category, cleanMessage, context),
          adaptiveSteps: generateAdaptiveSteps(category, complexity, context)
        };
      }
    }
  }
  
  // Análise por palavras-chave e contexto
  const contextAnalysis = analyzeByContext(lowerMessage, context);
  if (contextAnalysis.confidence > 0.6) {
    return {
      ...contextAnalysis,
      message: cleanMessage,
      needsAnalysis: false,
      complexity,
      suggestedResponse: generateSuggestedResponse(contextAnalysis.category, cleanMessage, context),
      adaptiveSteps: generateAdaptiveSteps(contextAnalysis.category, complexity, context)
    };
  }
  
  // Se não conseguiu determinar, marcar como unclear
  return {
    category: INTENT_CATEGORIES.UNCLEAR,
    confidence: 0.3,
    message: cleanMessage,
    context: extractContext(lowerMessage),
    needsAnalysis: true,
    complexity,
    suggestedResponse: generateClarificationResponse(cleanMessage, context),
    adaptiveSteps: ['Esclarecer intenção', 'Analisar contexto', 'Propor solução']
  };
}

/**
 * Determina a complexidade da tarefa para auto-interpretação
 */
function determineComplexity(message, context) {
  const lowerMessage = message.toLowerCase();
  
  // Palavras que indicam alta complexidade
  const highComplexityWords = ['sistema', 'aplicação', 'plataforma', 'integração', 'api', 'banco de dados', 'autenticação'];
  // Palavras que indicam média complexidade
  const mediumComplexityWords = ['site', 'página', 'componente', 'funcionalidade', 'melhorar', 'adicionar'];
  // Palavras que indicam baixa complexidade
  const lowComplexityWords = ['cor', 'texto', 'botão', 'imagem', 'ajustar', 'corrigir'];
  
  const highCount = highComplexityWords.filter(word => lowerMessage.includes(word)).length;
  const mediumCount = mediumComplexityWords.filter(word => lowerMessage.includes(word)).length;
  const lowCount = lowComplexityWords.filter(word => lowerMessage.includes(word)).length;
  
  if (highCount > 0) return 'high';
  if (mediumCount > 0) return 'medium';
  if (lowCount > 0) return 'low';
  
  // Baseado no tamanho da mensagem
  if (message.length > 100) return 'high';
  if (message.length > 30) return 'medium';
  return 'low';
}

/**
 * Gera passos adaptativos baseados na complexidade
 */
function generateAdaptiveSteps(category, complexity, context) {
  const baseSteps = {
    [INTENT_CATEGORIES.GREETING]: ['Cumprimentar'],
    [INTENT_CATEGORIES.CASUAL]: ['Responder naturalmente'],
    [INTENT_CATEGORIES.CONTEXTUAL]: ['Interpretar contexto', 'Responder adequadamente'],
    [INTENT_CATEGORIES.PROJECT_REQUEST]: ['Analisar requisitos', 'Criar estrutura', 'Implementar'],
    [INTENT_CATEGORIES.CODE_HELP]: ['Analisar problema', 'Propor solução'],
    [INTENT_CATEGORIES.IMPROVEMENT]: ['Avaliar código atual', 'Implementar melhoria'],
    [INTENT_CATEGORIES.QUESTION]: ['Pesquisar informação', 'Formular resposta'],
    [INTENT_CATEGORIES.COMMAND]: ['Executar comando']
  };
  
  let steps = baseSteps[category] || ['Analisar', 'Executar'];
  
  // Adaptar baseado na complexidade
  if (complexity === 'high') {
    steps = ['Análise detalhada', ...steps, 'Validação', 'Otimização'];
  } else if (complexity === 'medium') {
    steps = ['Análise', ...steps, 'Validação'];
  }
  // Para 'low', manter steps básicos
  
  return steps;
}

/**
 * Analisa por contexto e palavras-chave
 */
function analyzeByContext(message, context) {
  let scores = {};
  
  // Inicializar scores
  Object.values(INTENT_CATEGORIES).forEach(cat => scores[cat] = 0);
  
  // Analisar palavras-chave
  for (const [contextType, keywords] of Object.entries(CONTEXT_KEYWORDS)) {
    const keywordCount = keywords.filter(keyword => message.includes(keyword)).length;
    
    if (keywordCount > 0) {
      switch (contextType) {
        case 'project':
          scores[INTENT_CATEGORIES.PROJECT_REQUEST] += keywordCount * 0.3;
          break;
        case 'code':
          scores[INTENT_CATEGORIES.CODE_HELP] += keywordCount * 0.3;
          break;
        case 'error':
          scores[INTENT_CATEGORIES.CODE_HELP] += keywordCount * 0.4;
          break;
        case 'improvement':
          scores[INTENT_CATEGORIES.IMPROVEMENT] += keywordCount * 0.3;
          break;
      }
    }
  }
  
  // Considerar contexto do projeto atual
  if (context.hasProject) {
    scores[INTENT_CATEGORIES.CODE_HELP] += 0.2;
    scores[INTENT_CATEGORIES.IMPROVEMENT] += 0.2;
  } else {
    scores[INTENT_CATEGORIES.PROJECT_REQUEST] += 0.3;
  }
  
  // Encontrar categoria com maior score
  const bestCategory = Object.entries(scores).reduce((a, b) => scores[a[0]] > scores[b[0]] ? a : b)[0];
  const confidence = scores[bestCategory];
  
  return {
    category: bestCategory,
    confidence,
    context: extractContext(message)
  };
}

/**
 * Extrai contexto da mensagem
 */
function extractContext(message) {
  const context = {
    keywords: [],
    entities: [],
    sentiment: 'neutral'
  };
  
  // Extrair palavras-chave relevantes
  for (const [type, keywords] of Object.entries(CONTEXT_KEYWORDS)) {
    const found = keywords.filter(keyword => message.includes(keyword));
    if (found.length > 0) {
      context.keywords.push({ type, words: found });
    }
  }
  
  // Detectar sentimento básico
  const positiveWords = ['bom', 'ótimo', 'perfeito', 'legal', 'show', 'gostei', 'adorei'];
  const negativeWords = ['ruim', 'problema', 'erro', 'bug', 'não funciona', 'quebrado'];
  
  if (positiveWords.some(word => message.includes(word))) {
    context.sentiment = 'positive';
  } else if (negativeWords.some(word => message.includes(word))) {
    context.sentiment = 'negative';
  }
  
  return context;
}

/**
 * Gera resposta sugerida baseada na categoria com auto-interpretação
 */
function generateSuggestedResponse(category, message, context) {
  switch (category) {
    case INTENT_CATEGORIES.GREETING:
      return generateGreetingResponse(message);
      
    case INTENT_CATEGORIES.CASUAL:
      return generateCasualResponse(message);
      
    case INTENT_CATEGORIES.CONTEXTUAL:
      return generateContextualResponse(message, context);
      
    case INTENT_CATEGORIES.PROJECT_REQUEST:
      return "Entendi que você quer criar um novo projeto! Vou analisar sua solicitação e criar um plano de implementação.";
      
    case INTENT_CATEGORIES.CODE_HELP:
      return context.hasProject 
        ? "Vou analisar seu código e ajudar com essa questão."
        : "Para ajudar com código, preciso que você abra um projeto ou me dê mais detalhes sobre o que está desenvolvendo.";
        
    case INTENT_CATEGORIES.IMPROVEMENT:
      return context.hasProject
        ? "Vou analisar as melhorias que você quer implementar no projeto."
        : "Para implementar melhorias, preciso saber em qual projeto você está trabalhando.";
        
    case INTENT_CATEGORIES.QUESTION:
      return "Vou pesquisar e responder sua pergunta da melhor forma possível.";
      
    case INTENT_CATEGORIES.COMMAND:
      return "Vou executar esse comando para você.";
      
    default:
      return generateClarificationResponse(message, context);
  }
}

/**
 * Gera resposta contextual baseada no fluxo da conversa
 */
function generateContextualResponse(message, context) {
  const lowerMessage = message.toLowerCase();
  
  if (['isso', 'exato', 'correto', 'certo'].some(word => lowerMessage.includes(word))) {
    return 'Perfeito! 🎯 Vamos continuar então.';
  } else if (['continua', 'continue', 'prossiga', 'vai'].some(word => lowerMessage.includes(word))) {
    return 'Certo! 🚀 Vamos prosseguir com o próximo passo.';
  } else if (['pode', 'tá bom', 'ta bom'].some(word => lowerMessage.includes(word))) {
    return 'Ótimo! 👍 Vamos fazer isso então.';
  } else if (['mais', 'tem mais', 'algo mais'].some(word => lowerMessage.includes(word))) {
    return 'Claro! 📋 Vou adicionar mais detalhes ou funcionalidades.';
  } else {
    return 'Entendi! 💡 Vamos ajustar conforme sua preferência.';
  }
}

/**
 * Gera resposta de cumprimento mais natural e contextual
 */
function generateGreetingResponse(message) {
  const lowerMessage = message.toLowerCase();
  const currentHour = new Date().getHours();
  
  // Respostas espelhadas e naturais
  if (lowerMessage.includes('oi') && !lowerMessage.includes('bom') && !lowerMessage.includes('boa')) {
    return 'Oi! 👋 Como posso te ajudar hoje?';
  } else if (lowerMessage.includes('olá') || lowerMessage.includes('ola')) {
    return 'Olá! 😊 Pronto para trabalharmos juntos?';
  } else if (lowerMessage.includes('hey') || lowerMessage.includes('hi')) {
    return 'Hey! 🚀 O que vamos criar hoje?';
  } else if (lowerMessage.includes('bom dia')) {
    return 'Bom dia! ☀️ Vamos começar bem o dia desenvolvendo algo incrível?';
  } else if (lowerMessage.includes('boa tarde')) {
    return 'Boa tarde! 🌤️ Que tal criarmos algo interessante esta tarde?';
  } else if (lowerMessage.includes('boa noite')) {
    return 'Boa noite! 🌙 Trabalhando até tarde? Vamos fazer algo produtivo!';
  } else if (lowerMessage.includes('como vai') || lowerMessage.includes('tudo bem')) {
    return 'Tudo ótimo por aqui! 😄 E você, como está? O que podemos desenvolver juntos?';
  } else if (lowerMessage.includes('e ai') || lowerMessage.includes('eai')) {
    return 'E aí! 🤙 Beleza? Bora codar algo legal?';
  } else if (lowerMessage.includes('opa') || lowerMessage.includes('salve')) {
    return 'Opa! 👊 Salve! Pronto para a ação?';
  } else {
    // Resposta baseada no horário se não conseguir identificar padrão específico
    if (currentHour < 12) {
      return 'Bom dia! 🌅 Sou seu assistente de desenvolvimento. Vamos começar o dia criando algo incrível?';
    } else if (currentHour < 18) {
      return 'Boa tarde! ☀️ Estou aqui para ajudar com seus projetos. O que vamos desenvolver?';
    } else {
      return 'Boa noite! 🌃 Pronto para trabalhar em algo interessante?';
    }
  }
}

/**
 * Gera resposta casual mais natural e contextual
 */
function generateCasualResponse(message) {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('obrigad') || lowerMessage.includes('brigado')) {
    return 'De nada! 😊 Fico feliz em ajudar. Precisando de mais alguma coisa, é só falar!';
  } else if (lowerMessage.includes('valeu')) {
    return 'Valeu você! 🤝 Sempre à disposição para ajudar.';
  } else if (['legal', 'show', 'massa', 'top'].some(word => lowerMessage.includes(word))) {
    return 'Que bom que curtiu! 🎉 Vamos continuar fazendo coisas incríveis juntos.';
  } else if (['perfeito', 'ótimo', 'otimo'].some(word => lowerMessage.includes(word))) {
    return 'Perfeito mesmo! 🎯 Estamos no caminho certo. O que mais podemos fazer?';
  } else if (['entendi', 'saquei', 'captei', 'compreendi'].some(word => lowerMessage.includes(word))) {
    return 'Ótimo! 👍 Agora que você entendeu, vamos para o próximo passo?';
  } else if (['nossa', 'uau', 'wow', 'incrível', 'demais'].some(word => lowerMessage.includes(word))) {
    return 'Né? 🤩 Adoro quando as coisas ficam assim! Vamos fazer mais?';
  } else if (lowerMessage.includes('sim') || lowerMessage.includes('claro') || lowerMessage.includes('certeza')) {
    return 'Perfeito! 🚀 Vamos em frente então!';
  } else if (lowerMessage.includes('não') || lowerMessage.includes('nao')) {
    return 'Tudo bem! 😌 Se mudar de ideia ou precisar de algo diferente, me avisa.';
  } else if (['tchau', 'bye', 'falou', 'flw'].some(word => lowerMessage.includes(word))) {
    return 'Até mais! 👋 Foi um prazer ajudar. Volte sempre que precisar!';
  } else {
    return 'Entendi! 👌 Estou aqui se precisar de mais alguma coisa.';
  }
}

/**
 * Gera resposta de esclarecimento
 */
function generateClarificationResponse(message, context) {
  return `Entendi que você disse: "${message}". Para te ajudar melhor, você poderia ser mais específico sobre o que precisa? Por exemplo:

• Se quer criar algo novo: "Criar uma landing page para minha empresa"
• Se precisa de ajuda com código: "Como implementar autenticação no React"
• Se quer melhorar algo existente: "Adicionar modo escuro ao meu site"

O que você gostaria de fazer?`;
}

/**
 * Verifica se a mensagem precisa de análise mais profunda
 */
export function needsDeepAnalysis(intentResult) {
  return intentResult.needsAnalysis || 
         intentResult.confidence < 0.7 || 
         intentResult.category === INTENT_CATEGORIES.UNCLEAR;
}

/**
 * Determina se deve usar o agente autônomo
 */
export function shouldUseAutonomousAgent(intentResult, context) {
  const autonomousCategories = [
    INTENT_CATEGORIES.PROJECT_REQUEST,
    INTENT_CATEGORIES.IMPROVEMENT
  ];
  
  return autonomousCategories.includes(intentResult.category) && 
         intentResult.confidence > 0.7;
}