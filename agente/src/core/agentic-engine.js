/**
 * Agentic Engine - Motor Principal do Agente Autônomo
 * 
 * Sistema central que coordena todas as capacidades do agente:
 * - LLM para raciocínio e planejamento
 * - Sandbox para execução segura
 * - Workflows para orquestração de tarefas
 * - Feedback loops para aprendizado contínuo
 */

import { LLMClient } from './llm-client.js';
import { SandboxManager } from './sandbox-manager.js';
import { WorkflowOrchestrator } from './workflow-orchestrator.js';
import { PreviewManager } from './preview-manager.js';
import { FeedbackSystem } from './feedback-system.js';
import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

export class AgenticEngine extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      llmProvider: config.llmProvider || 'openai',
      apiKey: config.apiKey || process.env.OPENAI_API_KEY,
      model: config.model || 'gpt-4',
      sandboxPath: config.sandboxPath || './sandbox',
      maxConcurrentTasks: config.maxConcurrentTasks || 3,
      enableFeedback: true,
      ...config
    };
    
    this.activeTasks = new Map();
    this.taskQueue = [];
    this.isProcessing = false;
    this.feedbackLoop = new Map();
    this.activeProcesses = new Map();
    this.context = {
      files: new Map(),
      dependencies: new Set(),
      runningServices: new Map(),
      errors: [],
      lastOutput: ''
    };
    this.projectPath = config.projectPath || './project';
    
    // Inicializar componentes
    this.llmClient = new LLMClient(this.config);
    this.sandboxManager = null;
    this.workflowOrchestrator = null;
    this.previewManager = new PreviewManager(this.config);
    this.feedbackSystem = new FeedbackSystem();
  }

  /**
   * Inicializa o motor agentic
   */
  async initialize(projectId) {
    try {
      this.emit('engine_initializing', { projectId });
      
      // Inicializar sandbox manager
      this.sandboxManager = new SandboxManager(projectId, (log) => {
        this.emit('sandbox_log', log);
      });
      
      await this.sandboxManager.initializeSandbox();
      
      // Inicializar workflow orchestrator
      this.workflowOrchestrator = new WorkflowOrchestrator(
        this.llmClient, 
        this.sandboxManager
      );
      
      // Configurar event listeners
      this.setupEventListeners();
      
      this.emit('engine_ready', { projectId });
      return { success: true, projectId };
    } catch (error) {
      this.emit('engine_error', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Configura listeners de eventos
   */
  setupEventListeners() {
    // Workflow events
    this.workflowOrchestrator.on('workflow_started', (data) => {
      this.emit('task_started', data);
    });
    
    this.workflowOrchestrator.on('step_started', (data) => {
      this.emit('step_progress', data);
    });
    
    this.workflowOrchestrator.on('step_completed', (data) => {
      this.emit('step_completed', data);
    });
    
    this.workflowOrchestrator.on('workflow_completed', (data) => {
      this.emit('task_completed', data);
    });
    
    this.workflowOrchestrator.on('workflow_error', (data) => {
      this.emit('task_error', data);
    });
  }

  /**
   * Processa solicitação do usuário
   */
  async processUserRequest(message, context = {}) {
    try {
      this.emit('request_received', { message, context });
      
      // Analisar intenção do usuário
      const intent = await this.analyzeUserIntent(message, context);
      
      // Executar workflow apropriado
      const result = await this.workflowOrchestrator.executeWorkflow(
        intent.description, 
        { ...context, ...intent.parameters }
      );
      
      // Processar resultado
      const response = await this.processWorkflowResult(result, intent);
      
      this.emit('request_completed', { message, response });
      return response;
    } catch (error) {
      this.emit('request_error', { message, error: error.message });
      return {
        success: false,
        error: error.message,
        message: 'Desculpe, ocorreu um erro ao processar sua solicitação.'
      };
    }
  }

  /**
   * Analisa intenção do usuário usando LLM
   */
  async analyzeUserIntent(message, context) {
    const prompt = `Analise a seguinte solicitação do usuário e determine a intenção:

MENSAGEM: ${message}
CONTEXTO: ${JSON.stringify(context, null, 2)}

Determine:
1. Tipo de tarefa (criar_projeto, debug, melhorar_codigo, etc.)
2. Tecnologias envolvidas
3. Parâmetros específicos
4. Prioridade da tarefa

Responda em formato JSON:
{
  "type": "tipo_da_tarefa",
  "description": "descrição detalhada",
  "technologies": ["tech1", "tech2"],
  "parameters": {
    "framework": "react",
    "features": ["feature1", "feature2"]
  },
  "priority": "high|medium|low"
}`;

    const response = await this.llmClient.sendMessage(prompt, context);
    
    try {
      return JSON.parse(response.content);
    } catch (error) {
      // Fallback para análise simples
      return {
        type: 'general_task',
        description: message,
        technologies: [],
        parameters: context,
        priority: 'medium'
      };
    }
  }

  /**
   * Processa resultado do workflow
   */
  async processWorkflowResult(workflowResult, intent) {
    if (!workflowResult.success) {
      return {
        success: false,
        message: `Não foi possível completar a tarefa: ${workflowResult.error}`,
        error: workflowResult.error
      };
    }

    // Gerar resposta baseada no resultado
    const prompt = `Gere uma resposta amigável para o usuário baseada no resultado do workflow:

INTENÇÃO ORIGINAL: ${intent.description}
RESULTADO: ${JSON.stringify(workflowResult.result, null, 2)}

A resposta deve:
- Confirmar que a tarefa foi concluída
- Destacar os principais resultados
- Mencionar próximos passos se aplicável
- Ser clara e útil`;

    const response = await this.llmClient.sendMessage(prompt);
    
    return {
      success: true,
      message: response.content,
      workflowId: workflowResult.workflowId,
      result: workflowResult.result,
      previewUrl: this.getPreviewUrl()
    };
  }

  /**
   * Executa comando no sandbox
   */
  async executeCommand(command, options = {}) {
    if (!this.sandboxManager) {
      throw new Error('Sandbox não inicializado');
    }
    
    this.emit('command_executing', { command });
    
    try {
      const result = await this.sandboxManager.executeInSandbox(command, options);
      
      this.emit('command_completed', { command, result });
      return result;
    } catch (error) {
      this.emit('command_error', { command, error: error.message });
      throw error;
    }
  }

  /**
   * Cria arquivo no projeto
   */
  async createFile(filePath, content) {
    if (!this.sandboxManager) {
      throw new Error('Sandbox não inicializado');
    }
    
    return await this.sandboxManager.createFile(filePath, content);
  }

  /**
   * Lê arquivo do projeto
   */
  async readFile(filePath) {
    if (!this.sandboxManager) {
      throw new Error('Sandbox não inicializado');
    }
    
    return await this.sandboxManager.readFile(filePath);
  }

  /**
   * Lista arquivos do projeto
   */
  async listFiles(directory = '') {
    if (!this.sandboxManager) {
      throw new Error('Sandbox não inicializado');
    }
    
    return await this.sandboxManager.listFiles(directory);
  }

  /**
   * Inicia servidor de desenvolvimento
   */
  async startDevServer(framework = 'react') {
    if (!this.sandboxManager) {
      throw new Error('Sandbox não inicializado');
    }
    
    const result = await this.previewManager.startPreview(framework);
    
    if (result.success) {
      this.emit('server_started', { url: result.url, port: result.port, framework });
    }
    
    return result;
  }

  /**
   * Para servidor de desenvolvimento
   */
  async stopDevServer() {
    if (!this.previewManager) {
      return;
    }
    
    const result = await this.previewManager.stopPreview();
    this.emit('server_stopped');
    return result;
  }

  /**
   * Obtém URL de preview
   */
  getPreviewUrl() {
    if (!this.previewManager) {
      return null;
    }
    
    const status = this.previewManager.getPreviewStatus();
    return status.active ? status.url : null;
  }

  /**
   * Obtém status do sistema
   */
  getStatus() {
    const status = {
      engine: 'ready',
      sandbox: null,
      workflows: [],
      activeTasks: Array.from(this.activeTasks.keys()),
      previewUrl: this.getPreviewUrl()
    };
    
    if (this.sandboxManager) {
      status.sandbox = this.sandboxManager.getStatus();
    }
    
    if (this.workflowOrchestrator) {
      status.workflows = this.workflowOrchestrator.getActiveWorkflows();
    }
    
    return status;
  }

  /**
   * Adiciona feedback ao loop de aprendizado
   */
  addFeedback(taskId, feedback) {
    this.feedbackLoop.set(taskId, {
      timestamp: Date.now(),
      feedback,
      processed: false
    });
    
    this.emit('feedback_received', { taskId, feedback });
  }

  /**
   * Processa feedback acumulado
   */
  async processFeedback() {
    const unprocessedFeedback = Array.from(this.feedbackLoop.entries())
      .filter(([_, data]) => !data.processed);
    
    if (unprocessedFeedback.length === 0) {
      return;
    }
    
    const prompt = `Analise o feedback recebido e sugira melhorias no sistema:

FEEDBACK: ${JSON.stringify(unprocessedFeedback, null, 2)}

Identifique:
1. Padrões nos problemas reportados
2. Áreas que precisam de melhoria
3. Sugestões de otimização
4. Ajustes nos workflows`;

    const response = await this.llmClient.sendMessage(prompt);
    
    // Marcar feedback como processado
    unprocessedFeedback.forEach(([taskId]) => {
      const data = this.feedbackLoop.get(taskId);
      if (data) {
        data.processed = true;
      }
    });
    
    this.emit('feedback_processed', { 
      count: unprocessedFeedback.length,
      insights: response.content 
    });
    
    return response.content;
  }

  /**
   * Adicionar feedback do usuário
   */
  async addFeedback(taskId, feedback) {
    try {
      const feedbackEntry = this.feedback.addUserFeedback(taskId, feedback);
      
      // Analisar feedback para melhorar performance
      if (feedback.rating <= 2) {
        const task = this.feedback.tasks.get(taskId);
        if (task) {
          // Criar tarefa de melhoria baseada no feedback negativo
          this.feedback.createTask({
            title: `Melhorar: ${task.title}`,
            description: `Baseado no feedback: ${feedback.comment}`,
            priority: 'high',
            context: { originalTask: taskId, feedback: feedbackEntry }
          });
        }
      }
      
      this.emit('feedback_added', feedbackEntry);
      return feedbackEntry;
    } catch (error) {
      this.emit('error', { type: 'feedback_error', error: error.message });
      throw error;
    }
  }

  /**
   * Processar feedback e aprender
   */
  async processFeedback() {
    try {
      const analysis = this.feedback.analyzeFeedback();
      
      // Aplicar melhorias baseadas na análise
      if (analysis.recommendations.length > 0) {
        for (const recommendation of analysis.recommendations) {
          this.feedback.createTask({
            title: 'Implementar melhoria',
            description: recommendation,
            priority: 'medium',
            tags: ['improvement', 'feedback-driven']
          });
        }
      }
      
      this.emit('feedback_processed', analysis);
      return analysis;
    } catch (error) {
      this.emit('error', { type: 'feedback_processing_error', error: error.message });
      throw error;
    }
  }

  /**
   * Limpar recursos
   */
  async cleanup() {
    try {
      // Parar todos os processos ativos
      for (const [taskId, process] of this.activeProcesses) {
        try {
          process.kill();
        } catch (error) {
          console.warn(`Erro ao finalizar processo ${taskId}:`, error.message);
        }
      }
      
      // Limpar sandbox
      if (this.sandboxManager) {
        await this.sandboxManager.cleanup();
      }
      
      // Limpar preview
      if (this.previewManager) {
        await this.previewManager.cleanup();
      }
      
      // Exportar dados de feedback para análise futura
      if (this.feedback && this.config.enableFeedback) {
        try {
          const exportPath = path.join(this.projectPath, 'feedback-data.json');
          await this.feedback.exportData(exportPath);
        } catch (error) {
          console.warn('Erro ao exportar dados de feedback:', error.message);
        }
      }
      
      this.activeProcesses.clear();
      this.activeTasks.clear();
      this.taskQueue = [];
      
      this.emit('engine_cleaned');
    } catch (error) {
      this.emit('error', { type: 'cleanup_error', error: error.message });
      throw error;
    }
  }

  /**
   * Obtém métricas de performance
   */
  getMetrics() {
    return {
      activeTasks: this.activeTasks.size,
      queuedTasks: this.taskQueue.length,
      feedbackCount: this.feedbackLoop.size,
      llmUsage: this.llmClient.getUsageStats(),
      uptime: process.uptime()
    };
  }

  /**
   * Inicia o agente autônomo com uma tarefa
   */
  async startAutonomousTask(userRequest) {
    this.reportProgress('agent_start', 'iniciando', {
      message: `🤖 Agente IA iniciando tarefa: ${userRequest}`
    });

    // Análise da intenção usando LLM
    const intent = await this.analyzeIntent(userRequest);
    
    // Gerar plano de execução
    const plan = await this.generateExecutionPlan(intent);
    
    // Executar plano com feedback loop
    await this.executeAgenticWorkflow(plan);
  }

  /**
   * Analisa a intenção do usuário usando LLM
   */
  async analyzeIntent(userRequest) {
    const prompt = `Você é um AI Software Engineer autônomo. Analise a solicitação do usuário e determine:

SOLICITAÇÃO: "${userRequest}"

Responda em JSON com:
{
  "type": "create_project|modify_code|debug|deploy|analyze",
  "technology": "react|vue|node|python|etc",
  "complexity": "simple|medium|complex",
  "requirements": ["req1", "req2"],
  "estimated_steps": 5,
  "needs_sandbox": true,
  "needs_preview": true
}`;

    try {
      const response = await chat_simples(prompt, "Análise de Intenção");
      const jsonStart = response.indexOf('{');
      const jsonEnd = response.lastIndexOf('}');
      
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        return JSON.parse(response.slice(jsonStart, jsonEnd + 1));
      }
    } catch (error) {
      console.error('Erro na análise de intenção:', error);
    }

    // Fallback
    return {
      type: 'create_project',
      technology: 'react',
      complexity: 'medium',
      requirements: ['interface moderna', 'responsivo'],
      estimated_steps: 5,
      needs_sandbox: true,
      needs_preview: true
    };
  }

  /**
   * Gera plano de execução detalhado
   */
  async generateExecutionPlan(intent) {
    const prompt = `Como AI Software Engineer, crie um plano detalhado de execução:

INTENÇÃO: ${JSON.stringify(intent, null, 2)}

Gere um plano com comandos reais que serão executados:

{
  "steps": [
    {
      "id": 1,
      "name": "Setup Environment",
      "commands": ["npm init -y", "npm install react react-dom"],
      "expected_output": "package.json created",
      "files_to_create": ["src/App.jsx", "src/index.js"],
      "preview_available": false
    }
  ],
  "success_criteria": ["servidor rodando", "preview funcionando"],
  "rollback_plan": ["npm run stop", "rm -rf node_modules"]
}`;

    try {
      const response = await chat_simples(prompt, "Geração de Plano");
      const jsonStart = response.indexOf('{');
      const jsonEnd = response.lastIndexOf('}');
      
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        return JSON.parse(response.slice(jsonStart, jsonEnd + 1));
      }
    } catch (error) {
      console.error('Erro na geração de plano:', error);
    }

    // Plano padrão para React
    return {
      steps: [
        {
          id: 1,
          name: "Inicializar Projeto React",
          commands: ["npx create-react-app . --template typescript"],
          expected_output: "React app created",
          files_to_create: [],
          preview_available: false
        },
        {
          id: 2,
          name: "Instalar Dependências",
          commands: ["npm install"],
          expected_output: "Dependencies installed",
          files_to_create: [],
          preview_available: false
        },
        {
          id: 3,
          name: "Iniciar Servidor",
          commands: ["npm start"],
          expected_output: "Server running",
          files_to_create: [],
          preview_available: true
        }
      ],
      success_criteria: ["servidor rodando na porta 3000"],
      rollback_plan: ["pkill -f 'react-scripts'"]
    };
  }

  /**
   * Executa workflow agentic com feedback loop
   */
  async executeAgenticWorkflow(plan) {
    this.reportProgress('workflow_start', 'iniciando', {
      message: `🔄 Iniciando workflow com ${plan.steps.length} etapas`
    });

    for (const step of plan.steps) {
      await this.executeStep(step);
      
      // Feedback loop - verificar se o passo foi bem-sucedido
      const success = await this.verifyStepSuccess(step);
      
      if (!success) {
        await this.handleStepFailure(step);
      }
      
      // Atualizar contexto
      await this.updateContext(step);
      
      // Preview se disponível
      if (step.preview_available) {
        await this.generatePreview();
      }
    }

    this.reportProgress('workflow_complete', 'concluido', {
      message: '✅ Workflow agentic concluído com sucesso!'
    });
  }

  /**
   * Executa um passo individual
   */
  async executeStep(step) {
    this.reportProgress('step_start', 'progresso', {
      message: `⚡ Executando: ${step.name}`
    });

    for (const command of step.commands) {
      await this.executeCommand(command, step);
    }

    // Criar arquivos se necessário
    for (const filePath of step.files_to_create || []) {
      await this.createFileWithAI(filePath, step);
    }
  }

  /**
   * Executa comando real no sistema
   */
  async executeCommand(command, step) {
    return new Promise((resolve, reject) => {
      this.reportProgress('command_start', 'progresso', {
        message: `💻 Executando: ${command}`
      });

      const process = spawn('cmd', ['/c', command], {
        cwd: this.projectPath,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      let errorOutput = '';

      process.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        this.onCommand && this.onCommand({
          type: 'stdout',
          command,
          output: text
        });
      });

      process.stderr.on('data', (data) => {
        const text = data.toString();
        errorOutput += text;
        this.onCommand && this.onCommand({
          type: 'stderr',
          command,
          output: text
        });
      });

      process.on('close', (code) => {
        this.context.lastOutput = output;
        
        if (code === 0) {
          this.reportProgress('command_success', 'progresso', {
            message: `✅ Comando executado: ${command}`
          });
          resolve({ output, code });
        } else {
          this.context.errors.push({ command, error: errorOutput, code });
          this.reportProgress('command_error', 'erro', {
            message: `❌ Erro no comando: ${command}`,
            error: errorOutput
          });
          reject(new Error(`Command failed: ${command}`));
        }
      });

      // Armazenar processo para possível cancelamento
      this.activeProcesses.set(command, process);
    });
  }

  /**
   * Cria arquivo usando IA
   */
  async createFileWithAI(filePath, step) {
    const prompt = `Crie o conteúdo para o arquivo: ${filePath}

CONTEXTO DO PASSO: ${step.name}
TECNOLOGIA: React/TypeScript
ESTILO: Moderno, limpo, funcional

Gere apenas o conteúdo do arquivo, sem explicações:`;

    try {
      const content = await chat_simples(prompt, "Criação de Arquivo");
      const fullPath = path.join(this.projectPath, filePath);
      
      // Criar diretório se não existir
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      
      // Escrever arquivo
      await fs.writeFile(fullPath, content);
      
      this.context.files.set(filePath, content);
      
      this.reportProgress('file_created', 'progresso', {
        message: `📄 Arquivo criado: ${filePath}`
      });
    } catch (error) {
      this.reportProgress('file_error', 'erro', {
        message: `❌ Erro ao criar arquivo: ${filePath}`,
        error: error.message
      });
    }
  }

  /**
   * Verifica se o passo foi bem-sucedido
   */
  async verifyStepSuccess(step) {
    // Implementar verificação baseada em expected_output
    return !this.context.errors.some(err => 
      step.commands.includes(err.command)
    );
  }

  /**
   * Lida com falha em um passo
   */
  async handleStepFailure(step) {
    this.reportProgress('step_failure', 'erro', {
      message: `🔧 Tentando corrigir falha em: ${step.name}`
    });

    // Usar IA para sugerir correção
    const prompt = `Houve falha no passo: ${step.name}

COMANDOS EXECUTADOS: ${step.commands.join(', ')}
ERROS: ${JSON.stringify(this.context.errors)}

Sugira comandos de correção:`;

    try {
      const correction = await chat_simples(prompt, "Correção de Erro");
      // Implementar lógica de correção
    } catch (error) {
      console.error('Erro na correção:', error);
    }
  }

  /**
   * Atualiza contexto do agente
   */
  async updateContext(step) {
    // Atualizar informações sobre arquivos, dependências, etc.
    this.context.dependencies.add(step.name);
  }

  /**
   * Gera preview ao vivo
   */
  async generatePreview() {
    this.reportProgress('preview_generating', 'progresso', {
      message: '🖥️ Gerando preview ao vivo...'
    });

    // Verificar se há servidor rodando
    const serverProcess = Array.from(this.activeProcesses.values())
      .find(proc => proc.spawnargs.some(arg => arg.includes('start')));

    if (serverProcess) {
      this.onPreview && this.onPreview({
        url: 'http://localhost:3000',
        status: 'ready'
      });
    }
  }

  /**
   * Para todos os processos ativos
   */
  async stopAllProcesses() {
    for (const [command, process] of this.activeProcesses) {
      process.kill();
    }
    this.activeProcesses.clear();
  }

  /**
   * Reporta progresso
   */
  reportProgress(stage, status, details) {
    this.onProgress && this.onProgress({
      stage,
      status,
      timestamp: new Date().toISOString(),
      ...details
    });
  }
}

export default AgenticEngine;