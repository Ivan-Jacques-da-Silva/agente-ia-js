/**
 * Sistema de Análise de Intenção Inteligente
 * Interpreta mensagens do usuário para determinar a melhor resposta
 */

// Categorias de intenção
export const INTENT_CATEGORIES = {
  GREETING: 'greeting',           // Cumprimentos e saudações
  CASUAL: 'casual',              // Conversa casual, agradecimentos
  PROJECT_REQUEST: 'project_request', // Solicitação de novo projeto
  CODE_HELP: 'code_help',        // Ajuda com código existente
  IMPROVEMENT: 'improvement',     // Melhorias em projeto existente
  QUESTION: 'question',          // Perguntas técnicas
  COMMAND: 'command',            // Comandos específicos
  UNCLEAR: 'unclear'             // Intenção não clara
};

// Padrões para cada categoria
const INTENT_PATTERNS = {
  [INTENT_CATEGORIES.GREETING]: [
    /^(oi|olá|ola|hello|hi|hey)$/i,
    /^(bom dia|boa tarde|boa noite)$/i,
    /^(como vai|tudo bem|e ai|eai)$/i,
    /^(oi|olá|hello|hi)\s*[!.]*$/i
  ],
  
  [INTENT_CATEGORIES.CASUAL]: [
    /^(obrigad[oa]|valeu|thanks?)$/i,
    /^(legal|show|perfeito|ótimo|otimo|beleza|ok|certo)$/i,
    /^(entendi|entendo|compreendi)$/i,
    /^(tchau|bye|até logo|falou)$/i
  ],
  
  [INTENT_CATEGORIES.PROJECT_REQUEST]: [
    /cri[ae]\s+(uma?\s+)?(lp|landing\s*page)/i,
    /fazer\s+(uma?\s+)?(lp|landing\s*page)/i,
    /construir\s+(uma?\s+)?(aplicação|app|site|sistema)/i,
    /desenvolver\s+(uma?\s+)?(aplicação|app|site|sistema)/i,
    /quero\s+(criar|fazer|desenvolver|construir)/i,
    /preciso\s+(de\s+)?(uma?\s+)?(aplicação|app|site|sistema|lp)/i,
    /gostaria\s+(de\s+)?(criar|fazer|desenvolver)/i
  ],
  
  [INTENT_CATEGORIES.CODE_HELP]: [
    /como\s+(fazer|implementar|criar)\s+/i,
    /ajuda\s+(com|para)\s+/i,
    /não\s+(sei|consigo|entendo)\s+como/i,
    /tenho\s+(dúvida|problema)\s+(com|sobre|em)/i,
    /erro\s+(em|no|na)/i,
    /bug\s+(em|no|na)/i,
    /não\s+(funciona|está\s+funcionando)/i
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
    /ajust[ae]\s+/i
  ],
  
  [INTENT_CATEGORIES.QUESTION]: [
    /^(o\s+que|que|qual|como|quando|onde|por\s*que|porque)\s+/i,
    /\?$/,
    /posso\s+/i,
    /é\s+possível/i,
    /existe\s+(alguma?\s+)?(forma|maneira|jeito)/i
  ],
  
  [INTENT_CATEGORIES.COMMAND]: [
    /^(execute?|rode?|roda|executa)\s+/i,
    /^(instale?|instala)\s+/i,
    /^(abra|abre)\s+/i,
    /^(salve?|salva)\s+/i,
    /^(delete?|deleta|remove?|remova)\s+/i
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
 * Analisa a intenção de uma mensagem
 * @param {string} message - Mensagem do usuário
 * @param {Object} context - Contexto atual (projeto, histórico, etc.)
 * @returns {Object} Resultado da análise
 */
export function analyzeIntent(message, context = {}) {
  const cleanMessage = message.trim();
  const lowerMessage = cleanMessage.toLowerCase();
  
  // Verificar padrões diretos
  for (const [category, patterns] of Object.entries(INTENT_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(cleanMessage)) {
        return {
          category,
          confidence: 0.9,
          message: cleanMessage,
          context: extractContext(lowerMessage),
          needsAnalysis: category === INTENT_CATEGORIES.UNCLEAR,
          suggestedResponse: generateSuggestedResponse(category, cleanMessage, context)
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
      suggestedResponse: generateSuggestedResponse(contextAnalysis.category, cleanMessage, context)
    };
  }
  
  // Se não conseguiu determinar, marcar como unclear
  return {
    category: INTENT_CATEGORIES.UNCLEAR,
    confidence: 0.3,
    message: cleanMessage,
    context: extractContext(lowerMessage),
    needsAnalysis: true,
    suggestedResponse: generateClarificationResponse(cleanMessage, context)
  };
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
 * Gera resposta sugerida baseada na categoria
 */
function generateSuggestedResponse(category, message, context) {
  switch (category) {
    case INTENT_CATEGORIES.GREETING:
      return generateGreetingResponse(message);
      
    case INTENT_CATEGORIES.CASUAL:
      return generateCasualResponse(message);
      
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
 * Gera resposta de cumprimento
 */
function generateGreetingResponse(message) {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('bom dia')) {
    return 'Bom dia! 😊 Sou seu assistente de desenvolvimento. Como posso ajudar você hoje?';
  } else if (lowerMessage.includes('boa tarde')) {
    return 'Boa tarde! 👋 Estou aqui para ajudar com seus projetos de desenvolvimento. O que vamos criar?';
  } else if (lowerMessage.includes('boa noite')) {
    return 'Boa noite! 🌙 Pronto para trabalhar em algum projeto interessante?';
  } else {
    return 'Olá! 👋 Sou seu assistente de desenvolvimento. Posso ajudar você a criar aplicações, sites, landing pages e muito mais. O que gostaria de desenvolver?';
  }
}

/**
 * Gera resposta casual
 */
function generateCasualResponse(message) {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('obrigad')) {
    return 'De nada! 😊 Estou sempre aqui para ajudar. Precisa de mais alguma coisa?';
  } else if (['legal', 'show', 'perfeito', 'ótimo', 'otimo'].some(word => lowerMessage.includes(word))) {
    return 'Fico feliz que tenha gostado! 🎉 Se precisar de mais alguma coisa, é só falar.';
  } else {
    return 'Perfeito! 👍 Estou aqui se precisar de ajuda com desenvolvimento.';
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