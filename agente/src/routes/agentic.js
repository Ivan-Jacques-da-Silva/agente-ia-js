/**
 * Rotas API para Sistema Agentic
 * 
 * Endpoints para interação com o agente autônomo
 */

import express from 'express';
import { AgenticEngine } from '../core/agentic-engine.js';

const router = express.Router();

// Instâncias ativas dos agentes
const activeAgents = new Map();

/**
 * Inicializa novo agente
 */
router.post('/initialize', async (req, res) => {
  try {
    const { projectId, config = {} } = req.body;
    
    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: 'projectId é obrigatório'
      });
    }
    
    // Verificar se já existe agente para este projeto
    if (activeAgents.has(projectId)) {
      return res.json({
        success: true,
        message: 'Agente já inicializado',
        projectId,
        status: activeAgents.get(projectId).getStatus()
      });
    }
    
    // Criar novo agente
    const agent = new AgenticEngine({
      ...config,
      projectPath: `./projects/${projectId}`
    });
    
    // Configurar event listeners para WebSocket (se disponível)
    setupAgentEventListeners(agent, projectId);
    
    // Inicializar agente
    const result = await agent.initialize(projectId);
    
    if (result.success) {
      activeAgents.set(projectId, agent);
      
      res.json({
        success: true,
        message: 'Agente inicializado com sucesso',
        projectId,
        status: agent.getStatus()
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Erro ao inicializar agente:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Processa solicitação do usuário
 */
router.post('/process', async (req, res) => {
  try {
    const { projectId, message, context = {} } = req.body;
    
    if (!projectId || !message) {
      return res.status(400).json({
        success: false,
        error: 'projectId e message são obrigatórios'
      });
    }
    
    const agent = activeAgents.get(projectId);
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agente não encontrado. Inicialize primeiro.'
      });
    }
    
    // Processar solicitação
    const result = await agent.processUserRequest(message, context);
    
    res.json(result);
  } catch (error) {
    console.error('Erro ao processar solicitação:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Executa comando específico
 */
router.post('/execute', async (req, res) => {
  try {
    const { projectId, command, options = {} } = req.body;
    
    if (!projectId || !command) {
      return res.status(400).json({
        success: false,
        error: 'projectId e command são obrigatórios'
      });
    }
    
    const agent = activeAgents.get(projectId);
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agente não encontrado'
      });
    }
    
    const result = await agent.executeCommand(command, options);
    
    res.json({
      success: result.code === 0,
      result
    });
  } catch (error) {
    console.error('Erro ao executar comando:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Cria arquivo no projeto
 */
router.post('/files/create', async (req, res) => {
  try {
    const { projectId, filePath, content } = req.body;
    
    if (!projectId || !filePath || content === undefined) {
      return res.status(400).json({
        success: false,
        error: 'projectId, filePath e content são obrigatórios'
      });
    }
    
    const agent = activeAgents.get(projectId);
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agente não encontrado'
      });
    }
    
    const result = await agent.createFile(filePath, content);
    res.json(result);
  } catch (error) {
    console.error('Erro ao criar arquivo:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Lê arquivo do projeto
 */
router.get('/files/read', async (req, res) => {
  try {
    const { projectId, filePath } = req.query;
    
    if (!projectId || !filePath) {
      return res.status(400).json({
        success: false,
        error: 'projectId e filePath são obrigatórios'
      });
    }
    
    const agent = activeAgents.get(projectId);
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agente não encontrado'
      });
    }
    
    const result = await agent.readFile(filePath);
    res.json(result);
  } catch (error) {
    console.error('Erro ao ler arquivo:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Lista arquivos do projeto
 */
router.get('/files/list', async (req, res) => {
  try {
    const { projectId, directory = '' } = req.query;
    
    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: 'projectId é obrigatório'
      });
    }
    
    const agent = activeAgents.get(projectId);
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agente não encontrado'
      });
    }
    
    const result = await agent.listFiles(directory);
    res.json(result);
  } catch (error) {
    console.error('Erro ao listar arquivos:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Inicia servidor de desenvolvimento
 */
router.post('/server/start', async (req, res) => {
  try {
    const { projectId, framework = 'react' } = req.body;
    
    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: 'projectId é obrigatório'
      });
    }
    
    const agent = activeAgents.get(projectId);
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agente não encontrado'
      });
    }
    
    const result = await agent.startDevServer(framework);
    res.json(result);
  } catch (error) {
    console.error('Erro ao iniciar servidor:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Para servidor de desenvolvimento
 */
router.post('/server/stop', async (req, res) => {
  try {
    const { projectId } = req.body;
    
    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: 'projectId é obrigatório'
      });
    }
    
    const agent = activeAgents.get(projectId);
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agente não encontrado'
      });
    }
    
    await agent.stopDevServer();
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao parar servidor:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Obtém status do agente
 */
router.get('/status', async (req, res) => {
  try {
    const { projectId } = req.query;
    
    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: 'projectId é obrigatório'
      });
    }
    
    const agent = activeAgents.get(projectId);
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agente não encontrado'
      });
    }
    
    const status = agent.getStatus();
    res.json({
      success: true,
      status
    });
  } catch (error) {
    console.error('Erro ao obter status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Obtém métricas do agente
 */
router.get('/metrics', async (req, res) => {
  try {
    const { projectId } = req.query;
    
    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: 'projectId é obrigatório'
      });
    }
    
    const agent = activeAgents.get(projectId);
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agente não encontrado'
      });
    }
    
    const metrics = agent.getMetrics();
    res.json({
      success: true,
      metrics
    });
  } catch (error) {
    console.error('Erro ao obter métricas:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Adiciona feedback
 */
router.post('/feedback', async (req, res) => {
  try {
    const { projectId, taskId, rating, comment, helpful, suggestions } = req.body;
    
    if (!projectId || !taskId) {
      return res.status(400).json({
        success: false,
        error: 'projectId e taskId são obrigatórios'
      });
    }
    
    const agent = activeAgents.get(projectId);
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agente não encontrado'
      });
    }
    
    const feedback = await agent.addFeedback(taskId, {
      rating,
      comment,
      helpful,
      suggestions
    });
    
    res.json({ success: true, feedback });
  } catch (error) {
    console.error('Erro ao adicionar feedback:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Processa feedback e gera análise
 */
router.post('/process-feedback', async (req, res) => {
  try {
    const { projectId } = req.body;
    
    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: 'projectId é obrigatório'
      });
    }
    
    const agent = activeAgents.get(projectId);
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agente não encontrado'
      });
    }
    
    const analysis = await agent.processFeedback();
    
    res.json({ success: true, analysis });
  } catch (error) {
    console.error('Erro ao processar feedback:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Obtém métricas de feedback
 */
router.get('/feedback-metrics', async (req, res) => {
  try {
    const { projectId } = req.query;
    
    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: 'projectId é obrigatório'
      });
    }
    
    const agent = activeAgents.get(projectId);
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agente não encontrado'
      });
    }
    
    const metrics = agent.feedback.getMetrics();
    
    res.json({ success: true, metrics });
  } catch (error) {
    console.error('Erro ao obter métricas de feedback:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Lista agentes ativos
 */
router.get('/agents', (req, res) => {
  try {
    const agents = Array.from(activeAgents.entries()).map(([projectId, agent]) => ({
      projectId,
      status: agent.getStatus(),
      metrics: agent.getMetrics()
    }));
    
    res.json({
      success: true,
      agents,
      count: agents.length
    });
  } catch (error) {
    console.error('Erro ao listar agentes:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Finaliza agente
 */
router.post('/cleanup', async (req, res) => {
  try {
    const { projectId } = req.body;
    
    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: 'projectId é obrigatório'
      });
    }
    
    const agent = activeAgents.get(projectId);
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agente não encontrado'
      });
    }
    
    await agent.cleanup();
    activeAgents.delete(projectId);
    
    res.json({
      success: true,
      message: 'Agente finalizado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao finalizar agente:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Configura event listeners para o agente
 */
function setupAgentEventListeners(agent, projectId) {
  // Logs do sandbox
  agent.on('sandbox_log', (log) => {
    console.log(`[${projectId}] Sandbox:`, log.message);
    // Aqui você pode enviar via WebSocket se implementado
  });
  
  // Progresso de tarefas
  agent.on('step_progress', (data) => {
    console.log(`[${projectId}] Progresso:`, data.step, `(${Math.round(data.progress * 100)}%)`);
  });
  
  // Tarefas completadas
  agent.on('task_completed', (data) => {
    console.log(`[${projectId}] Tarefa concluída:`, data.workflowId);
  });
  
  // Erros
  agent.on('task_error', (data) => {
    console.error(`[${projectId}] Erro na tarefa:`, data.error);
  });
  
  // Servidor iniciado
  agent.on('server_started', (data) => {
    console.log(`[${projectId}] Servidor iniciado:`, data.url);
  });
}

/**
 * Middleware para limpeza automática
 */
process.on('SIGINT', async () => {
  console.log('Finalizando agentes ativos...');
  
  for (const [projectId, agent] of activeAgents) {
    try {
      await agent.cleanup();
      console.log(`Agente ${projectId} finalizado`);
    } catch (error) {
      console.error(`Erro ao finalizar agente ${projectId}:`, error.message);
    }
  }
  
  process.exit(0);
});

export default router;