/**
 * LLM Client - Cliente para Modelos de Linguagem
 * 
 * Integração com diferentes provedores de LLM para o agente autônomo
 */

import axios from 'axios';

export class LLMClient {
  constructor(config = {}) {
    this.config = {
      provider: config.provider || 'openai',
      apiKey: config.apiKey || process.env.OPENAI_API_KEY,
      model: config.model || 'gpt-4',
      baseURL: config.baseURL,
      maxTokens: config.maxTokens || 4000,
      temperature: config.temperature || 0.7,
      ...config
    };
    
    this.conversationHistory = [];
    this.systemPrompt = this.buildSystemPrompt();
  }

  /**
   * Constrói prompt do sistema para o agente
   */
  buildSystemPrompt() {
    return `Você é um AI Software Engineer autônomo especializado em desenvolvimento web.

CAPACIDADES:
- Criar projetos completos do zero
- Executar comandos reais no sistema
- Instalar dependências e configurar ambientes
- Escrever código funcional e testado
- Debuggar e corrigir problemas
- Implementar features complexas

FERRAMENTAS DISPONÍVEIS:
- Sandbox isolado para execução segura
- Terminal com acesso completo
- Sistema de arquivos para criar/editar código
- Servidor de desenvolvimento com preview ao vivo
- Instalação automática de dependências

WORKFLOW:
1. Analise o pedido do usuário
2. Planeje a arquitetura e estrutura
3. Execute comandos para configurar ambiente
4. Implemente código incrementalmente
5. Teste e valide funcionalidades
6. Forneça preview ao vivo
7. Itere baseado no feedback

REGRAS:
- Sempre execute comandos reais, não simule
- Crie código funcional e completo
- Use boas práticas de desenvolvimento
- Forneça logs detalhados do progresso
- Mantenha o usuário informado de cada etapa
- Se encontrar erros, corrija automaticamente

Responda sempre em português brasileiro e seja proativo na resolução de problemas.`;
  }

  /**
   * Envia mensagem para o LLM
   */
  async sendMessage(message, context = {}) {
    try {
      const messages = [
        { role: 'system', content: this.systemPrompt },
        ...this.conversationHistory,
        { role: 'user', content: this.formatMessage(message, context) }
      ];

      const response = await this.callLLM(messages);
      
      // Adicionar à história da conversa
      this.conversationHistory.push(
        { role: 'user', content: message },
        { role: 'assistant', content: response.content }
      );

      // Limitar histórico para evitar overflow
      if (this.conversationHistory.length > 20) {
        this.conversationHistory = this.conversationHistory.slice(-20);
      }

      return {
        success: true,
        content: response.content,
        actions: this.parseActions(response.content),
        reasoning: response.reasoning
      };
    } catch (error) {
      console.error('Erro no LLM:', error);
      return {
        success: false,
        error: error.message,
        content: 'Desculpe, ocorreu um erro ao processar sua solicitação.'
      };
    }
  }

  /**
   * Formata mensagem com contexto
   */
  formatMessage(message, context) {
    let formattedMessage = message;

    if (context.files && context.files.length > 0) {
      formattedMessage += '\n\nArquivos do projeto:\n';
      context.files.forEach(file => {
        formattedMessage += `- ${file.path}\n`;
      });
    }

    if (context.currentCode) {
      formattedMessage += '\n\nCódigo atual:\n```\n' + context.currentCode + '\n```';
    }

    if (context.errors && context.errors.length > 0) {
      formattedMessage += '\n\nErros encontrados:\n';
      context.errors.forEach(error => {
        formattedMessage += `- ${error}\n`;
      });
    }

    if (context.sandboxStatus) {
      formattedMessage += '\n\nStatus do sandbox:\n' + JSON.stringify(context.sandboxStatus, null, 2);
    }

    return formattedMessage;
  }

  /**
   * Chama o LLM baseado no provedor configurado
   */
  async callLLM(messages) {
    switch (this.config.provider) {
      case 'openai':
        return await this.callOpenAI(messages);
      case 'anthropic':
        return await this.callAnthropic(messages);
      case 'local':
        return await this.callLocalLLM(messages);
      default:
        throw new Error(`Provedor não suportado: ${this.config.provider}`);
    }
  }

  /**
   * Chama OpenAI API
   */
  async callOpenAI(messages) {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: this.config.model,
      messages,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      stream: false
    }, {
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    return {
      content: response.data.choices[0].message.content,
      usage: response.data.usage
    };
  }

  /**
   * Chama Anthropic API
   */
  async callAnthropic(messages) {
    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: this.config.model,
      messages: messages.filter(m => m.role !== 'system'),
      system: this.systemPrompt,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature
    }, {
      headers: {
        'x-api-key': this.config.apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      }
    });

    return {
      content: response.data.content[0].text,
      usage: response.data.usage
    };
  }

  /**
   * Chama LLM local (Ollama, etc.)
   */
  async callLocalLLM(messages) {
    const baseURL = this.config.baseURL || 'http://localhost:11434';
    
    const response = await axios.post(`${baseURL}/api/chat`, {
      model: this.config.model,
      messages,
      stream: false,
      options: {
        temperature: this.config.temperature,
        num_predict: this.config.maxTokens
      }
    });

    return {
      content: response.data.message.content
    };
  }

  /**
   * Extrai ações do conteúdo da resposta
   */
  parseActions(content) {
    const actions = [];
    
    // Buscar por comandos
    const commandRegex = /```(?:bash|shell|cmd)\n(.*?)\n```/gs;
    let match;
    while ((match = commandRegex.exec(content)) !== null) {
      actions.push({
        type: 'command',
        content: match[1].trim()
      });
    }

    // Buscar por código
    const codeRegex = /```(\w+)\n(.*?)\n```/gs;
    while ((match = codeRegex.exec(content)) !== null) {
      if (match[1] !== 'bash' && match[1] !== 'shell' && match[1] !== 'cmd') {
        actions.push({
          type: 'code',
          language: match[1],
          content: match[2].trim()
        });
      }
    }

    // Buscar por criação de arquivos
    const fileRegex = /criar arquivo `([^`]+)`/gi;
    while ((match = fileRegex.exec(content)) !== null) {
      actions.push({
        type: 'create_file',
        path: match[1]
      });
    }

    return actions;
  }

  /**
   * Gera código baseado em especificação
   */
  async generateCode(specification, language = 'javascript') {
    const prompt = `Gere código ${language} completo e funcional para: ${specification}

Requisitos:
- Código limpo e bem documentado
- Seguir boas práticas
- Incluir tratamento de erros
- Ser executável imediatamente

Responda apenas com o código, sem explicações adicionais.`;

    const response = await this.sendMessage(prompt);
    return response;
  }

  /**
   * Analisa e corrige erros
   */
  async debugCode(code, error, context = '') {
    const prompt = `Analise e corrija o seguinte erro:

CÓDIGO:
\`\`\`
${code}
\`\`\`

ERRO:
${error}

CONTEXTO:
${context}

Forneça:
1. Explicação do problema
2. Código corrigido
3. Passos para evitar o erro no futuro`;

    const response = await this.sendMessage(prompt);
    return response;
  }

  /**
   * Sugere melhorias no código
   */
  async suggestImprovements(code, language = 'javascript') {
    const prompt = `Analise o código ${language} e sugira melhorias:

\`\`\`${language}
${code}
\`\`\`

Considere:
- Performance
- Legibilidade
- Manutenibilidade
- Segurança
- Boas práticas`;

    const response = await this.sendMessage(prompt);
    return response;
  }

  /**
   * Limpa histórico da conversa
   */
  clearHistory() {
    this.conversationHistory = [];
  }

  /**
   * Obtém estatísticas de uso
   */
  getUsageStats() {
    return {
      messagesCount: this.conversationHistory.length / 2,
      provider: this.config.provider,
      model: this.config.model
    };
  }
}

export default LLMClient;