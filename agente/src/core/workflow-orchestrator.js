/**
 * Workflow Orchestrator - Orquestração de Workflows Agentic
 * 
 * Coordena tarefas complexas através de workflows inteligentes
 * com feedback loops e execução autônoma
 */

import EventEmitter from 'events';

export class WorkflowOrchestrator extends EventEmitter {
  constructor(llmClient, sandboxManager) {
    super();
    this.llmClient = llmClient;
    this.sandboxManager = sandboxManager;
    this.activeWorkflows = new Map();
    this.taskQueue = [];
    this.isProcessing = false;
    this.workflows = this.initializeWorkflows();
  }

  /**
   * Inicializa workflows predefinidos
   */
  initializeWorkflows() {
    return {
      'create_react_app': {
        name: 'Criar Aplicação React',
        steps: [
          { id: 'setup_env', name: 'Configurar Ambiente', type: 'command' },
          { id: 'create_structure', name: 'Criar Estrutura', type: 'filesystem' },
          { id: 'install_deps', name: 'Instalar Dependências', type: 'package' },
          { id: 'generate_code', name: 'Gerar Código', type: 'code' },
          { id: 'start_server', name: 'Iniciar Servidor', type: 'server' },
          { id: 'validate', name: 'Validar Aplicação', type: 'test' }
        ]
      },
      'create_vue_app': {
        name: 'Criar Aplicação Vue',
        steps: [
          { id: 'setup_env', name: 'Configurar Ambiente', type: 'command' },
          { id: 'create_structure', name: 'Criar Estrutura', type: 'filesystem' },
          { id: 'install_deps', name: 'Instalar Dependências', type: 'package' },
          { id: 'generate_code', name: 'Gerar Código', type: 'code' },
          { id: 'start_server', name: 'Iniciar Servidor', type: 'server' },
          { id: 'validate', name: 'Validar Aplicação', type: 'test' }
        ]
      },
      'create_node_api': {
        name: 'Criar API Node.js',
        steps: [
          { id: 'setup_env', name: 'Configurar Ambiente', type: 'command' },
          { id: 'create_structure', name: 'Criar Estrutura', type: 'filesystem' },
          { id: 'install_deps', name: 'Instalar Dependências', type: 'package' },
          { id: 'generate_code', name: 'Gerar Código', type: 'code' },
          { id: 'start_server', name: 'Iniciar Servidor', type: 'server' },
          { id: 'test_endpoints', name: 'Testar Endpoints', type: 'test' }
        ]
      },
      'debug_application': {
        name: 'Debug de Aplicação',
        steps: [
          { id: 'analyze_error', name: 'Analisar Erro', type: 'analysis' },
          { id: 'identify_cause', name: 'Identificar Causa', type: 'diagnosis' },
          { id: 'fix_code', name: 'Corrigir Código', type: 'code' },
          { id: 'test_fix', name: 'Testar Correção', type: 'test' },
          { id: 'validate', name: 'Validar Solução', type: 'validation' }
        ]
      }
    };
  }

  /**
   * Executa workflow baseado na intenção do usuário
   */
  async executeWorkflow(intent, parameters = {}) {
    const workflowId = this.generateWorkflowId();
    
    try {
      // Determinar workflow apropriado
      const workflow = await this.determineWorkflow(intent, parameters);
      
      if (!workflow) {
        throw new Error('Não foi possível determinar o workflow apropriado');
      }

      // Registrar workflow ativo
      this.activeWorkflows.set(workflowId, {
        id: workflowId,
        workflow,
        parameters,
        status: 'running',
        currentStep: 0,
        startTime: Date.now(),
        logs: []
      });

      this.emit('workflow_started', { workflowId, workflow: workflow.name });
      
      // Executar workflow
      const result = await this.runWorkflow(workflowId);
      
      return {
        success: true,
        workflowId,
        result
      };
    } catch (error) {
      this.emit('workflow_error', { workflowId, error: error.message });
      return {
        success: false,
        workflowId,
        error: error.message
      };
    }
  }

  /**
   * Determina workflow apropriado baseado na intenção
   */
  async determineWorkflow(intent, parameters) {
    // Usar LLM para determinar workflow
    const prompt = `Analise a seguinte intenção e determine o workflow mais apropriado:

INTENÇÃO: ${intent}
PARÂMETROS: ${JSON.stringify(parameters, null, 2)}

WORKFLOWS DISPONÍVEIS:
${Object.entries(this.workflows).map(([key, workflow]) => 
  `- ${key}: ${workflow.name}`
).join('\n')}

Responda apenas com a chave do workflow mais apropriado, ou "custom" se precisar criar um workflow personalizado.`;

    const response = await this.llmClient.sendMessage(prompt);
    const workflowKey = response.content.trim().toLowerCase();

    if (this.workflows[workflowKey]) {
      return this.workflows[workflowKey];
    }

    // Se não encontrou workflow predefinido, criar um personalizado
    return await this.createCustomWorkflow(intent, parameters);
  }

  /**
   * Cria workflow personalizado
   */
  async createCustomWorkflow(intent, parameters) {
    const prompt = `Crie um workflow detalhado para a seguinte intenção:

INTENÇÃO: ${intent}
PARÂMETROS: ${JSON.stringify(parameters, null, 2)}

O workflow deve ter:
- Nome descritivo
- Lista de passos sequenciais
- Cada passo deve ter: id, name, type

TIPOS DISPONÍVEIS: command, filesystem, package, code, server, test, analysis, diagnosis, validation

Responda em formato JSON:
{
  "name": "Nome do Workflow",
  "steps": [
    { "id": "step1", "name": "Descrição", "type": "tipo" }
  ]
}`;

    const response = await this.llmClient.sendMessage(prompt);
    
    try {
      const workflow = JSON.parse(response.content);
      return workflow;
    } catch (error) {
      throw new Error('Não foi possível criar workflow personalizado');
    }
  }

  /**
   * Executa workflow completo
   */
  async runWorkflow(workflowId) {
    const workflowData = this.activeWorkflows.get(workflowId);
    if (!workflowData) {
      throw new Error('Workflow não encontrado');
    }

    const { workflow, parameters } = workflowData;
    const results = [];

    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];
      
      // Atualizar status
      workflowData.currentStep = i;
      this.emit('step_started', { workflowId, step: step.name, progress: i / workflow.steps.length });

      try {
        // Executar passo
        const stepResult = await this.executeStep(step, parameters, workflowId);
        results.push(stepResult);

        // Log do resultado
        this.logWorkflowStep(workflowId, step, stepResult);

        this.emit('step_completed', { 
          workflowId, 
          step: step.name, 
          result: stepResult,
          progress: (i + 1) / workflow.steps.length 
        });

        // Verificar se deve continuar
        if (!stepResult.success && step.critical !== false) {
          throw new Error(`Passo crítico falhou: ${step.name}`);
        }

      } catch (error) {
        this.emit('step_error', { workflowId, step: step.name, error: error.message });
        
        // Tentar recuperação automática
        const recovery = await this.attemptRecovery(step, error, parameters, workflowId);
        if (!recovery.success) {
          throw error;
        }
        
        results.push(recovery);
      }
    }

    // Finalizar workflow
    workflowData.status = 'completed';
    workflowData.endTime = Date.now();
    
    this.emit('workflow_completed', { workflowId, results });
    
    return {
      success: true,
      steps: results,
      duration: workflowData.endTime - workflowData.startTime
    };
  }

  /**
   * Executa passo individual do workflow
   */
  async executeStep(step, parameters, workflowId) {
    switch (step.type) {
      case 'command':
        return await this.executeCommandStep(step, parameters, workflowId);
      
      case 'filesystem':
        return await this.executeFilesystemStep(step, parameters, workflowId);
      
      case 'package':
        return await this.executePackageStep(step, parameters, workflowId);
      
      case 'code':
        return await this.executeCodeStep(step, parameters, workflowId);
      
      case 'server':
        return await this.executeServerStep(step, parameters, workflowId);
      
      case 'test':
        return await this.executeTestStep(step, parameters, workflowId);
      
      case 'analysis':
        return await this.executeAnalysisStep(step, parameters, workflowId);
      
      case 'diagnosis':
        return await this.executeDiagnosisStep(step, parameters, workflowId);
      
      case 'validation':
        return await this.executeValidationStep(step, parameters, workflowId);
      
      default:
        throw new Error(`Tipo de passo não suportado: ${step.type}`);
    }
  }

  /**
   * Executa passo de comando
   */
  async executeCommandStep(step, parameters, workflowId) {
    const prompt = `Execute o comando necessário para: ${step.name}

CONTEXTO: ${JSON.stringify(parameters, null, 2)}

Forneça o comando exato a ser executado.`;

    const response = await this.llmClient.sendMessage(prompt);
    const commands = this.llmClient.parseActions(response.content)
      .filter(action => action.type === 'command');

    const results = [];
    for (const command of commands) {
      const result = await this.sandboxManager.executeInSandbox(command.content);
      results.push(result);
    }

    return {
      success: results.every(r => r.code === 0),
      commands: commands.map(c => c.content),
      results
    };
  }

  /**
   * Executa passo de sistema de arquivos
   */
  async executeFilesystemStep(step, parameters, workflowId) {
    const prompt = `Crie a estrutura de arquivos necessária para: ${step.name}

CONTEXTO: ${JSON.stringify(parameters, null, 2)}

Liste os arquivos e diretórios a serem criados.`;

    const response = await this.llmClient.sendMessage(prompt);
    
    // Extrair estrutura de arquivos da resposta
    const files = this.parseFileStructure(response.content);
    const results = [];

    for (const file of files) {
      if (file.type === 'directory') {
        // Criar diretório será feito automaticamente ao criar arquivos
        continue;
      } else {
        const result = await this.sandboxManager.createFile(file.path, file.content || '');
        results.push(result);
      }
    }

    return {
      success: results.every(r => r.success),
      files: files.map(f => f.path),
      results
    };
  }

  /**
   * Executa passo de instalação de pacotes
   */
  async executePackageStep(step, parameters, workflowId) {
    const prompt = `Determine os pacotes necessários para: ${step.name}

CONTEXTO: ${JSON.stringify(parameters, null, 2)}

Liste os pacotes npm a serem instalados.`;

    const response = await this.llmClient.sendMessage(prompt);
    const packages = this.parsePackageList(response.content);

    const result = await this.sandboxManager.installDependencies(packages);
    
    return {
      success: result.success,
      packages,
      result
    };
  }

  /**
   * Executa passo de geração de código
   */
  async executeCodeStep(step, parameters, workflowId) {
    const prompt = `Gere o código necessário para: ${step.name}

CONTEXTO: ${JSON.stringify(parameters, null, 2)}

Forneça o código completo e funcional.`;

    const response = await this.llmClient.sendMessage(prompt);
    const codeBlocks = this.llmClient.parseActions(response.content)
      .filter(action => action.type === 'code');

    const results = [];
    for (const code of codeBlocks) {
      const filename = this.determineFilename(code, parameters);
      const result = await this.sandboxManager.createFile(filename, code.content);
      results.push({ ...result, filename, language: code.language });
    }

    return {
      success: results.every(r => r.success),
      files: results.map(r => r.filename),
      results
    };
  }

  /**
   * Executa passo de servidor
   */
  async executeServerStep(step, parameters, workflowId) {
    const framework = parameters.framework || 'react';
    const result = await this.sandboxManager.startDevServer(framework);
    
    return {
      success: result.success,
      url: result.url,
      port: result.port,
      result
    };
  }

  /**
   * Executa passo de teste
   */
  async executeTestStep(step, parameters, workflowId) {
    // Implementar testes baseados no contexto
    const result = await this.sandboxManager.executeInSandbox('npm test -- --watchAll=false');
    
    return {
      success: result.code === 0,
      output: result.stdout,
      errors: result.stderr
    };
  }

  /**
   * Executa passo de análise
   */
  async executeAnalysisStep(step, parameters, workflowId) {
    const context = await this.gatherAnalysisContext(parameters);
    
    const prompt = `Analise o seguinte contexto para: ${step.name}

CONTEXTO: ${JSON.stringify(context, null, 2)}

Forneça uma análise detalhada e recomendações.`;

    const response = await this.llmClient.sendMessage(prompt);
    
    return {
      success: true,
      analysis: response.content,
      context
    };
  }

  /**
   * Executa passo de diagnóstico
   */
  async executeDiagnosisStep(step, parameters, workflowId) {
    const prompt = `Diagnostique o problema para: ${step.name}

CONTEXTO: ${JSON.stringify(parameters, null, 2)}

Identifique a causa raiz e possíveis soluções.`;

    const response = await this.llmClient.sendMessage(prompt);
    
    return {
      success: true,
      diagnosis: response.content,
      recommendations: this.parseRecommendations(response.content)
    };
  }

  /**
   * Executa passo de validação
   */
  async executeValidationStep(step, parameters, workflowId) {
    const validations = await this.runValidations(parameters);
    
    return {
      success: validations.every(v => v.passed),
      validations,
      summary: this.generateValidationSummary(validations)
    };
  }

  /**
   * Tenta recuperação automática de erro
   */
  async attemptRecovery(step, error, parameters, workflowId) {
    const prompt = `Ocorreu um erro no passo "${step.name}":

ERRO: ${error.message}
CONTEXTO: ${JSON.stringify(parameters, null, 2)}

Sugira uma estratégia de recuperação e execute-a.`;

    const response = await this.llmClient.sendMessage(prompt);
    
    // Tentar executar estratégia de recuperação
    try {
      const actions = this.llmClient.parseActions(response.content);
      const results = [];
      
      for (const action of actions) {
        if (action.type === 'command') {
          const result = await this.sandboxManager.executeInSandbox(action.content);
          results.push(result);
        }
      }
      
      return {
        success: results.every(r => r.code === 0),
        recovery: response.content,
        results
      };
    } catch (recoveryError) {
      return {
        success: false,
        error: recoveryError.message
      };
    }
  }

  /**
   * Utilitários auxiliares
   */
  generateWorkflowId() {
    return `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  logWorkflowStep(workflowId, step, result) {
    const workflowData = this.activeWorkflows.get(workflowId);
    if (workflowData) {
      workflowData.logs.push({
        timestamp: Date.now(),
        step: step.name,
        result: result.success ? 'success' : 'error',
        details: result
      });
    }
  }

  parseFileStructure(content) {
    // Implementar parser para estrutura de arquivos
    const files = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      if (line.includes('criar arquivo') || line.includes('create file')) {
        const match = line.match(/`([^`]+)`/);
        if (match) {
          files.push({
            path: match[1],
            type: 'file',
            content: ''
          });
        }
      }
    }
    
    return files;
  }

  parsePackageList(content) {
    const packages = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      const match = line.match(/npm install\s+([^\s]+)/);
      if (match) {
        packages.push(match[1]);
      }
    }
    
    return packages;
  }

  determineFilename(code, parameters) {
    // Lógica para determinar nome do arquivo baseado no código e contexto
    const ext = this.getFileExtension(code.language);
    return `generated_${Date.now()}.${ext}`;
  }

  getFileExtension(language) {
    const extensions = {
      javascript: 'js',
      typescript: 'ts',
      jsx: 'jsx',
      tsx: 'tsx',
      css: 'css',
      html: 'html',
      json: 'json'
    };
    return extensions[language] || 'txt';
  }

  async gatherAnalysisContext(parameters) {
    const files = await this.sandboxManager.listFiles();
    const status = this.sandboxManager.getStatus();
    
    return {
      files: files.files || [],
      sandboxStatus: status,
      parameters
    };
  }

  parseRecommendations(content) {
    const recommendations = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      if (line.includes('recomendação') || line.includes('sugestão')) {
        recommendations.push(line.trim());
      }
    }
    
    return recommendations;
  }

  async runValidations(parameters) {
    const validations = [
      { name: 'Estrutura de arquivos', test: () => this.validateFileStructure() },
      { name: 'Dependências instaladas', test: () => this.validateDependencies() },
      { name: 'Servidor funcionando', test: () => this.validateServer() }
    ];
    
    const results = [];
    for (const validation of validations) {
      try {
        const passed = await validation.test();
        results.push({ name: validation.name, passed, error: null });
      } catch (error) {
        results.push({ name: validation.name, passed: false, error: error.message });
      }
    }
    
    return results;
  }

  generateValidationSummary(validations) {
    const passed = validations.filter(v => v.passed).length;
    const total = validations.length;
    return `${passed}/${total} validações passaram`;
  }

  async validateFileStructure() {
    const files = await this.sandboxManager.listFiles();
    return files.success && files.files.length > 0;
  }

  async validateDependencies() {
    const packageJson = await this.sandboxManager.readFile('package.json');
    return packageJson.success;
  }

  async validateServer() {
    const status = this.sandboxManager.getStatus();
    return status.activeProcesses.includes('dev-server');
  }

  /**
   * Obtém status de workflow
   */
  getWorkflowStatus(workflowId) {
    return this.activeWorkflows.get(workflowId);
  }

  /**
   * Lista workflows ativos
   */
  getActiveWorkflows() {
    return Array.from(this.activeWorkflows.values());
  }

  /**
   * Cancela workflow
   */
  async cancelWorkflow(workflowId) {
    const workflowData = this.activeWorkflows.get(workflowId);
    if (workflowData) {
      workflowData.status = 'cancelled';
      this.activeWorkflows.delete(workflowId);
      this.emit('workflow_cancelled', { workflowId });
      return true;
    }
    return false;
  }
}

export default WorkflowOrchestrator;