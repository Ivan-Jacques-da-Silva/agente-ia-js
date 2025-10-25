/**
 * Sistema de Consciência Contextual
 * 
 * Analisa automaticamente o contexto da conversa e ajusta o comportamento
 * do agente para ser mais inteligente e autônomo
 */

export class ContextAwareness {
  constructor() {
    this.conversationHistory = [];
    this.userPreferences = {};
    this.projectContext = {};
    this.behaviorPatterns = {};
    this.adaptationRules = this.initializeAdaptationRules();
  }

  /**
   * Inicializa regras de adaptação comportamental
   */
  initializeAdaptationRules() {
    return {
      // Regras baseadas no histórico de conversa
      conversation: {
        // Se usuário sempre confirma mudanças, ser mais direto
        directApproach: {
          condition: (context) => context.approvalRate > 0.8,
          behavior: 'direct',
          description: 'Usuário confia nas sugestões, ser mais direto'
        },
        // Se usuário faz muitas perguntas, ser mais explicativo
        explanatory: {
          condition: (context) => context.questionRate > 0.6,
          behavior: 'detailed',
          description: 'Usuário gosta de detalhes, ser mais explicativo'
        },
        // Se usuário usa linguagem casual, espelhar o tom
        casual: {
          condition: (context) => context.casualityScore > 0.7,
          behavior: 'casual',
          description: 'Usuário prefere comunicação casual'
        }
      },
      
      // Regras baseadas no tipo de projeto
      project: {
        // Projetos complexos requerem mais análise
        complex: {
          condition: (context) => context.projectComplexity === 'high',
          behavior: 'thorough',
          description: 'Projeto complexo, análise mais profunda'
        },
        // Projetos simples podem ser mais diretos
        simple: {
          condition: (context) => context.projectComplexity === 'low',
          behavior: 'efficient',
          description: 'Projeto simples, execução eficiente'
        }
      },
      
      // Regras baseadas no tempo e contexto
      temporal: {
        // Horário de trabalho vs. horário pessoal
        workHours: {
          condition: (context) => context.isWorkHours,
          behavior: 'professional',
          description: 'Horário comercial, tom mais profissional'
        },
        // Sessões longas podem indicar urgência
        urgency: {
          condition: (context) => context.sessionDuration > 60,
          behavior: 'focused',
          description: 'Sessão longa, manter foco'
        }
      }
    };
  }

  /**
   * Analisa o contexto atual e determina comportamento apropriado
   */
  analyzeContext(message, conversationHistory, projectInfo) {
    const context = this.buildContextProfile(message, conversationHistory, projectInfo);
    const behaviorAdjustments = this.determineBehaviorAdjustments(context);
    
    return {
      context,
      behaviorAdjustments,
      recommendations: this.generateRecommendations(context, behaviorAdjustments)
    };
  }

  /**
   * Constrói perfil contextual completo
   */
  buildContextProfile(message, conversationHistory, projectInfo) {
    const messageAnalysis = this.analyzeMessage(message);
    const historyAnalysis = this.analyzeConversationHistory(conversationHistory);
    const projectAnalysis = this.analyzeProject(projectInfo);
    const temporalAnalysis = this.analyzeTemporalContext();

    return {
      // Análise da mensagem atual
      currentMessage: messageAnalysis,
      
      // Análise do histórico
      approvalRate: historyAnalysis.approvalRate,
      questionRate: historyAnalysis.questionRate,
      casualityScore: historyAnalysis.casualityScore,
      averageResponseTime: historyAnalysis.averageResponseTime,
      
      // Análise do projeto
      projectComplexity: projectAnalysis.complexity,
      projectType: projectAnalysis.type,
      technologiesUsed: projectAnalysis.technologies,
      
      // Análise temporal
      isWorkHours: temporalAnalysis.isWorkHours,
      sessionDuration: temporalAnalysis.sessionDuration,
      timeOfDay: temporalAnalysis.timeOfDay,
      
      // Padrões identificados
      userExpertiseLevel: this.assessUserExpertise(conversationHistory, projectInfo),
      communicationStyle: this.identifyCommunicationStyle(conversationHistory),
      preferredWorkflow: this.identifyPreferredWorkflow(conversationHistory)
    };
  }

  /**
   * Analisa a mensagem atual
   */
  analyzeMessage(message) {
    const msg = message.toLowerCase();
    
    return {
      length: message.length,
      hasQuestions: msg.includes('?'),
      isGreeting: this.isGreeting(msg),
      isUrgent: this.detectUrgency(msg),
      isCasual: this.detectCasualty(msg),
      technicalTerms: this.extractTechnicalTerms(msg),
      sentiment: this.analyzeSentiment(msg),
      intent: this.classifyIntent(msg)
    };
  }

  /**
   * Analisa histórico de conversas
   */
  analyzeConversationHistory(history) {
    if (!history || history.length === 0) {
      return {
        approvalRate: 0.5,
        questionRate: 0.3,
        casualityScore: 0.5,
        averageResponseTime: 30
      };
    }

    const approvals = history.filter(msg => 
      msg.content && (
        msg.content.includes('ok') || 
        msg.content.includes('sim') || 
        msg.content.includes('perfeito') ||
        msg.content.includes('pode aplicar')
      )
    ).length;

    const questions = history.filter(msg => 
      msg.content && msg.content.includes('?')
    ).length;

    const casualMessages = history.filter(msg => 
      msg.content && this.detectCasualty(msg.content.toLowerCase())
    ).length;

    return {
      approvalRate: approvals / Math.max(history.length, 1),
      questionRate: questions / Math.max(history.length, 1),
      casualityScore: casualMessages / Math.max(history.length, 1),
      averageResponseTime: this.calculateAverageResponseTime(history)
    };
  }

  /**
   * Analisa informações do projeto
   */
  analyzeProject(projectInfo) {
    if (!projectInfo) {
      return {
        complexity: 'medium',
        type: 'unknown',
        technologies: []
      };
    }

    const complexity = this.assessProjectComplexity(projectInfo);
    const type = this.identifyProjectType(projectInfo);
    const technologies = this.extractTechnologies(projectInfo);

    return { complexity, type, technologies };
  }

  /**
   * Analisa contexto temporal
   */
  analyzeTemporalContext() {
    const now = new Date();
    const hour = now.getHours();
    const isWorkHours = hour >= 9 && hour <= 18;
    
    return {
      isWorkHours,
      timeOfDay: this.getTimeOfDay(hour),
      sessionDuration: this.calculateSessionDuration(),
      dayOfWeek: now.getDay()
    };
  }

  /**
   * Determina ajustes comportamentais baseados no contexto
   */
  determineBehaviorAdjustments(context) {
    const adjustments = {
      responseStyle: 'balanced',
      detailLevel: 'medium',
      proactivity: 'moderate',
      formality: 'professional'
    };

    // Aplicar regras de adaptação
    Object.values(this.adaptationRules).forEach(ruleCategory => {
      Object.values(ruleCategory).forEach(rule => {
        if (rule.condition(context)) {
          this.applyBehaviorRule(adjustments, rule.behavior);
        }
      });
    });

    return adjustments;
  }

  /**
   * Aplica regra comportamental específica
   */
  applyBehaviorRule(adjustments, behavior) {
    switch (behavior) {
      case 'direct':
        adjustments.responseStyle = 'direct';
        adjustments.proactivity = 'high';
        break;
      case 'detailed':
        adjustments.detailLevel = 'high';
        adjustments.responseStyle = 'explanatory';
        break;
      case 'casual':
        adjustments.formality = 'casual';
        break;
      case 'thorough':
        adjustments.detailLevel = 'high';
        adjustments.proactivity = 'high';
        break;
      case 'efficient':
        adjustments.responseStyle = 'direct';
        adjustments.detailLevel = 'low';
        break;
      case 'professional':
        adjustments.formality = 'professional';
        break;
      case 'focused':
        adjustments.responseStyle = 'direct';
        adjustments.proactivity = 'high';
        break;
    }
  }

  /**
   * Gera recomendações baseadas no contexto
   */
  generateRecommendations(context, behaviorAdjustments) {
    const recommendations = [];

    // Recomendações baseadas no estilo de resposta
    if (behaviorAdjustments.responseStyle === 'direct') {
      recommendations.push('Ser mais direto e objetivo nas respostas');
    } else if (behaviorAdjustments.responseStyle === 'explanatory') {
      recommendations.push('Fornecer explicações detalhadas e contexto');
    }

    // Recomendações baseadas no nível de detalhe
    if (behaviorAdjustments.detailLevel === 'high') {
      recommendations.push('Incluir mais detalhes técnicos e passos intermediários');
    } else if (behaviorAdjustments.detailLevel === 'low') {
      recommendations.push('Manter respostas concisas e focadas');
    }

    // Recomendações baseadas na proatividade
    if (behaviorAdjustments.proactivity === 'high') {
      recommendations.push('Ser mais proativo em sugerir melhorias e próximos passos');
    }

    return recommendations;
  }

  // Métodos auxiliares
  isGreeting(msg) {
    const greetings = ['oi', 'olá', 'hey', 'hi', 'hello', 'bom dia', 'boa tarde', 'boa noite'];
    return greetings.some(greeting => msg.includes(greeting));
  }

  detectUrgency(msg) {
    const urgentWords = ['urgente', 'rápido', 'agora', 'imediato', 'asap', 'pressa'];
    return urgentWords.some(word => msg.includes(word));
  }

  detectCasualty(msg) {
    const casualWords = ['cara', 'mano', 'galera', 'pessoal', 'valeu', 'beleza', 'show', 'massa'];
    return casualWords.some(word => msg.includes(word));
  }

  extractTechnicalTerms(msg) {
    const techTerms = ['react', 'vue', 'angular', 'node', 'javascript', 'typescript', 'css', 'html', 'api', 'database'];
    return techTerms.filter(term => msg.includes(term));
  }

  analyzeSentiment(msg) {
    const positiveWords = ['bom', 'ótimo', 'excelente', 'perfeito', 'legal', 'show'];
    const negativeWords = ['ruim', 'erro', 'problema', 'difícil', 'complicado'];
    
    const positiveCount = positiveWords.filter(word => msg.includes(word)).length;
    const negativeCount = negativeWords.filter(word => msg.includes(word)).length;
    
    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  classifyIntent(msg) {
    if (msg.includes('criar') || msg.includes('fazer')) return 'create';
    if (msg.includes('corrigir') || msg.includes('fix')) return 'fix';
    if (msg.includes('melhorar') || msg.includes('otimizar')) return 'improve';
    if (msg.includes('explicar') || msg.includes('como')) return 'explain';
    return 'general';
  }

  assessUserExpertise(history, projectInfo) {
    // Lógica para avaliar nível de expertise baseado no histórico
    const techTermsUsed = history.reduce((count, msg) => {
      if (msg.content) {
        return count + this.extractTechnicalTerms(msg.content.toLowerCase()).length;
      }
      return count;
    }, 0);

    if (techTermsUsed > 10) return 'expert';
    if (techTermsUsed > 5) return 'intermediate';
    return 'beginner';
  }

  identifyCommunicationStyle(history) {
    const casualCount = history.filter(msg => 
      msg.content && this.detectCasualty(msg.content.toLowerCase())
    ).length;
    
    const totalMessages = history.length;
    const casualityRatio = casualCount / Math.max(totalMessages, 1);
    
    if (casualityRatio > 0.6) return 'casual';
    if (casualityRatio < 0.2) return 'formal';
    return 'balanced';
  }

  identifyPreferredWorkflow(history) {
    // Analisar padrões de workflow preferidos
    const hasStepByStepRequests = history.some(msg => 
      msg.content && (msg.content.includes('passo a passo') || msg.content.includes('etapas'))
    );
    
    if (hasStepByStepRequests) return 'step-by-step';
    return 'direct';
  }

  assessProjectComplexity(projectInfo) {
    // Lógica simplificada para avaliar complexidade
    if (projectInfo.files && projectInfo.files.length > 20) return 'high';
    if (projectInfo.files && projectInfo.files.length > 5) return 'medium';
    return 'low';
  }

  identifyProjectType(projectInfo) {
    if (projectInfo.packageJson) {
      const deps = projectInfo.packageJson.dependencies || {};
      if (deps.react) return 'react';
      if (deps.vue) return 'vue';
      if (deps.express) return 'node-api';
    }
    return 'unknown';
  }

  extractTechnologies(projectInfo) {
    const technologies = [];
    if (projectInfo.packageJson && projectInfo.packageJson.dependencies) {
      technologies.push(...Object.keys(projectInfo.packageJson.dependencies));
    }
    return technologies;
  }

  getTimeOfDay(hour) {
    if (hour < 6) return 'night';
    if (hour < 12) return 'morning';
    if (hour < 18) return 'afternoon';
    return 'evening';
  }

  calculateSessionDuration() {
    // Implementar lógica para calcular duração da sessão
    return 30; // placeholder
  }

  calculateAverageResponseTime(history) {
    // Implementar lógica para calcular tempo médio de resposta
    return 30; // placeholder
  }
}