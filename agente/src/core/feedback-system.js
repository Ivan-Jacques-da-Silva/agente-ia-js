import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';

/**
 * Sistema de feedback e gerenciamento de tarefas para o agente autônomo
 */
export class FeedbackSystem extends EventEmitter {
  constructor() {
    super();
    this.tasks = new Map();
    this.feedback = [];
    this.metrics = {
      tasksCompleted: 0,
      tasksCreated: 0,
      averageCompletionTime: 0,
      successRate: 0,
      userSatisfaction: 0
    };
    this.learningData = [];
  }

  /**
   * Criar uma nova tarefa
   */
  createTask(taskData) {
    const task = {
      id: this.generateTaskId(),
      title: taskData.title,
      description: taskData.description,
      priority: taskData.priority || 'medium',
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      estimatedTime: taskData.estimatedTime || null,
      actualTime: null,
      dependencies: taskData.dependencies || [],
      tags: taskData.tags || [],
      context: taskData.context || {},
      progress: 0,
      subtasks: [],
      feedback: [],
      attempts: 0,
      maxAttempts: taskData.maxAttempts || 3
    };

    this.tasks.set(task.id, task);
    this.metrics.tasksCreated++;
    
    this.emit('taskCreated', task);
    this.log(`Nova tarefa criada: ${task.title} (ID: ${task.id})`);
    
    return task;
  }

  /**
   * Atualizar status de uma tarefa
   */
  updateTaskStatus(taskId, status, progress = null) {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Tarefa ${taskId} não encontrada`);
    }

    const oldStatus = task.status;
    task.status = status;
    task.updatedAt = Date.now();
    
    if (progress !== null) {
      task.progress = Math.max(0, Math.min(100, progress));
    }

    if (status === 'completed') {
      task.actualTime = Date.now() - task.createdAt;
      this.metrics.tasksCompleted++;
      this.calculateSuccessRate();
      this.emit('taskCompleted', task);
    } else if (status === 'failed') {
      task.attempts++;
      this.emit('taskFailed', task);
    }

    this.emit('taskUpdated', { task, oldStatus, newStatus: status });
    this.log(`Tarefa ${taskId} atualizada: ${oldStatus} → ${status}`);
    
    return task;
  }

  /**
   * Adicionar subtarefa
   */
  addSubtask(parentTaskId, subtaskData) {
    const parentTask = this.tasks.get(parentTaskId);
    if (!parentTask) {
      throw new Error(`Tarefa pai ${parentTaskId} não encontrada`);
    }

    const subtask = {
      id: this.generateTaskId(),
      title: subtaskData.title,
      description: subtaskData.description || '',
      status: 'pending',
      createdAt: Date.now(),
      progress: 0
    };

    parentTask.subtasks.push(subtask);
    parentTask.updatedAt = Date.now();
    
    this.emit('subtaskAdded', { parentTask, subtask });
    return subtask;
  }

  /**
   * Adicionar feedback do usuário
   */
  addUserFeedback(taskId, feedback) {
    const feedbackEntry = {
      id: this.generateFeedbackId(),
      taskId,
      type: 'user',
      rating: feedback.rating, // 1-5
      comment: feedback.comment || '',
      timestamp: Date.now(),
      helpful: feedback.helpful || null,
      suggestions: feedback.suggestions || []
    };

    this.feedback.push(feedbackEntry);
    
    if (taskId) {
      const task = this.tasks.get(taskId);
      if (task) {
        task.feedback.push(feedbackEntry);
      }
    }

    this.updateUserSatisfaction();
    this.emit('feedbackReceived', feedbackEntry);
    
    return feedbackEntry;
  }

  /**
   * Adicionar feedback automático do sistema
   */
  addSystemFeedback(taskId, feedback) {
    const feedbackEntry = {
      id: this.generateFeedbackId(),
      taskId,
      type: 'system',
      success: feedback.success,
      errorMessage: feedback.errorMessage || null,
      executionTime: feedback.executionTime || null,
      resourceUsage: feedback.resourceUsage || null,
      timestamp: Date.now(),
      context: feedback.context || {}
    };

    this.feedback.push(feedbackEntry);
    
    if (taskId) {
      const task = this.tasks.get(taskId);
      if (task) {
        task.feedback.push(feedbackEntry);
      }
    }

    this.emit('systemFeedbackReceived', feedbackEntry);
    return feedbackEntry;
  }

  /**
   * Analisar padrões e aprender com feedback
   */
  analyzeFeedback() {
    const analysis = {
      commonIssues: this.identifyCommonIssues(),
      successPatterns: this.identifySuccessPatterns(),
      improvementAreas: this.identifyImprovementAreas(),
      recommendations: this.generateRecommendations()
    };

    this.learningData.push({
      timestamp: Date.now(),
      analysis,
      metrics: { ...this.metrics }
    });

    this.emit('feedbackAnalyzed', analysis);
    return analysis;
  }

  /**
   * Obter próxima tarefa baseada em prioridade e dependências
   */
  getNextTask() {
    const availableTasks = Array.from(this.tasks.values())
      .filter(task => 
        task.status === 'pending' && 
        this.areDependenciesMet(task) &&
        task.attempts < task.maxAttempts
      )
      .sort((a, b) => {
        // Ordenar por prioridade e depois por data de criação
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return a.createdAt - b.createdAt;
      });

    return availableTasks[0] || null;
  }

  /**
   * Verificar se dependências de uma tarefa foram atendidas
   */
  areDependenciesMet(task) {
    return task.dependencies.every(depId => {
      const depTask = this.tasks.get(depId);
      return depTask && depTask.status === 'completed';
    });
  }

  /**
   * Obter estatísticas do sistema
   */
  getMetrics() {
    return {
      ...this.metrics,
      totalTasks: this.tasks.size,
      pendingTasks: Array.from(this.tasks.values()).filter(t => t.status === 'pending').length,
      activeTasks: Array.from(this.tasks.values()).filter(t => t.status === 'in_progress').length,
      failedTasks: Array.from(this.tasks.values()).filter(t => t.status === 'failed').length,
      averageFeedbackRating: this.calculateAverageFeedbackRating(),
      totalFeedback: this.feedback.length
    };
  }

  /**
   * Exportar dados para análise
   */
  async exportData(filePath) {
    const data = {
      tasks: Array.from(this.tasks.entries()),
      feedback: this.feedback,
      metrics: this.metrics,
      learningData: this.learningData,
      exportedAt: Date.now()
    };

    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    this.log(`Dados exportados para: ${filePath}`);
  }

  /**
   * Importar dados de análise
   */
  async importData(filePath) {
    try {
      const data = JSON.parse(await fs.readFile(filePath, 'utf8'));
      
      this.tasks = new Map(data.tasks);
      this.feedback = data.feedback || [];
      this.metrics = { ...this.metrics, ...data.metrics };
      this.learningData = data.learningData || [];
      
      this.log(`Dados importados de: ${filePath}`);
      this.emit('dataImported', data);
    } catch (error) {
      this.log(`Erro ao importar dados: ${error.message}`);
      throw error;
    }
  }

  // Métodos auxiliares privados

  generateTaskId() {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateFeedbackId() {
    return `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  calculateSuccessRate() {
    if (this.metrics.tasksCreated === 0) {
      this.metrics.successRate = 0;
      return;
    }
    
    this.metrics.successRate = (this.metrics.tasksCompleted / this.metrics.tasksCreated) * 100;
  }

  updateUserSatisfaction() {
    const userFeedback = this.feedback.filter(f => f.type === 'user' && f.rating);
    if (userFeedback.length === 0) {
      this.metrics.userSatisfaction = 0;
      return;
    }

    const totalRating = userFeedback.reduce((sum, f) => sum + f.rating, 0);
    this.metrics.userSatisfaction = (totalRating / userFeedback.length) * 20; // Converter para porcentagem
  }

  calculateAverageFeedbackRating() {
    const userFeedback = this.feedback.filter(f => f.type === 'user' && f.rating);
    if (userFeedback.length === 0) return 0;
    
    const totalRating = userFeedback.reduce((sum, f) => sum + f.rating, 0);
    return totalRating / userFeedback.length;
  }

  identifyCommonIssues() {
    const failedTasks = Array.from(this.tasks.values()).filter(t => t.status === 'failed');
    const issues = {};
    
    failedTasks.forEach(task => {
      task.feedback.forEach(feedback => {
        if (feedback.type === 'system' && feedback.errorMessage) {
          const errorType = this.categorizeError(feedback.errorMessage);
          issues[errorType] = (issues[errorType] || 0) + 1;
        }
      });
    });

    return Object.entries(issues)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([issue, count]) => ({ issue, count }));
  }

  identifySuccessPatterns() {
    const completedTasks = Array.from(this.tasks.values()).filter(t => t.status === 'completed');
    const patterns = {};
    
    completedTasks.forEach(task => {
      task.tags.forEach(tag => {
        patterns[tag] = (patterns[tag] || 0) + 1;
      });
    });

    return Object.entries(patterns)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([pattern, count]) => ({ pattern, count }));
  }

  identifyImprovementAreas() {
    const areas = [];
    
    if (this.metrics.successRate < 80) {
      areas.push('Taxa de sucesso baixa - revisar estratégias de execução');
    }
    
    if (this.metrics.userSatisfaction < 70) {
      areas.push('Satisfação do usuário baixa - melhorar qualidade das respostas');
    }
    
    const avgTime = this.calculateAverageCompletionTime();
    if (avgTime > 300000) { // 5 minutos
      areas.push('Tempo de execução alto - otimizar performance');
    }

    return areas;
  }

  generateRecommendations() {
    const recommendations = [];
    const commonIssues = this.identifyCommonIssues();
    
    if (commonIssues.length > 0) {
      recommendations.push(`Focar na resolução de: ${commonIssues[0].issue}`);
    }
    
    if (this.metrics.userSatisfaction < 80) {
      recommendations.push('Implementar mais validações antes de entregar resultados');
    }
    
    if (this.metrics.successRate < 90) {
      recommendations.push('Adicionar mais verificações de erro e retry logic');
    }

    return recommendations;
  }

  calculateAverageCompletionTime() {
    const completedTasks = Array.from(this.tasks.values())
      .filter(t => t.status === 'completed' && t.actualTime);
    
    if (completedTasks.length === 0) return 0;
    
    const totalTime = completedTasks.reduce((sum, task) => sum + task.actualTime, 0);
    return totalTime / completedTasks.length;
  }

  categorizeError(errorMessage) {
    const message = errorMessage.toLowerCase();
    
    if (message.includes('network') || message.includes('connection')) {
      return 'Network Error';
    } else if (message.includes('permission') || message.includes('access')) {
      return 'Permission Error';
    } else if (message.includes('syntax') || message.includes('parse')) {
      return 'Syntax Error';
    } else if (message.includes('timeout')) {
      return 'Timeout Error';
    } else {
      return 'Unknown Error';
    }
  }

  log(message) {
    console.log(`[FeedbackSystem] ${new Date().toISOString()}: ${message}`);
  }
}