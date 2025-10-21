/**
 * Security Routes - Rotas para Gerenciamento de Segurança
 * 
 * Endpoints para configurar timeout, allowlist e monitorar
 * a execução segura de comandos no sistema
 */

import express from 'express';
import { SecurityManager } from '../core/security-manager.js';

const router = express.Router();

// Instância global do SecurityManager para configuração
let globalSecurityManager = null;

/**
 * Inicializa o SecurityManager global
 */
function initializeSecurityManager() {
  if (!globalSecurityManager) {
    globalSecurityManager = new SecurityManager({
      defaultTimeout: 30000,
      maxTimeout: 300000
    });
  }
  return globalSecurityManager;
}

/**
 * GET /api/security/config
 * Obtém configuração atual de segurança
 */
router.get('/config', (req, res) => {
  try {
    const securityManager = initializeSecurityManager();
    const config = securityManager.exportConfig();
    
    res.json({
      success: true,
      config
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/security/config
 * Atualiza configuração de segurança
 */
router.post('/config', (req, res) => {
  try {
    const securityManager = initializeSecurityManager();
    const { config } = req.body;
    
    if (!config) {
      return res.status(400).json({
        success: false,
        error: 'Configuração não fornecida'
      });
    }
    
    securityManager.importConfig(config);
    
    res.json({
      success: true,
      message: 'Configuração atualizada com sucesso'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/security/stats
 * Obtém estatísticas de segurança
 */
router.get('/stats', (req, res) => {
  try {
    const securityManager = initializeSecurityManager();
    const stats = securityManager.getStats();
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/security/reset-stats
 * Reseta estatísticas de segurança
 */
router.post('/reset-stats', (req, res) => {
  try {
    const securityManager = initializeSecurityManager();
    securityManager.resetStats();
    
    res.json({
      success: true,
      message: 'Estatísticas resetadas com sucesso'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/security/validate-command
 * Valida se um comando é seguro
 */
router.post('/validate-command', (req, res) => {
  try {
    const securityManager = initializeSecurityManager();
    const { command, options = {} } = req.body;
    
    if (!command) {
      return res.status(400).json({
        success: false,
        error: 'Comando não fornecido'
      });
    }
    
    const validation = securityManager.validateCommand(command, options);
    
    res.json({
      success: true,
      validation
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/security/allow-command
 * Adiciona comando à allowlist
 */
router.post('/allow-command', (req, res) => {
  try {
    const securityManager = initializeSecurityManager();
    const { command } = req.body;
    
    if (!command) {
      return res.status(400).json({
        success: false,
        error: 'Comando não fornecido'
      });
    }
    
    securityManager.allowCommand(command);
    
    res.json({
      success: true,
      message: `Comando '${command}' adicionado à allowlist`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/security/block-command
 * Bloqueia comando explicitamente
 */
router.post('/block-command', (req, res) => {
  try {
    const securityManager = initializeSecurityManager();
    const { command } = req.body;
    
    if (!command) {
      return res.status(400).json({
        success: false,
        error: 'Comando não fornecido'
      });
    }
    
    securityManager.blockCommand(command);
    
    res.json({
      success: true,
      message: `Comando '${command}' bloqueado`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/security/allow-command/:command
 * Remove comando da allowlist
 */
router.delete('/allow-command/:command', (req, res) => {
  try {
    const securityManager = initializeSecurityManager();
    const { command } = req.params;
    
    securityManager.disallowCommand(command);
    
    res.json({
      success: true,
      message: `Comando '${command}' removido da allowlist`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/security/block-command/:command
 * Remove comando da blocklist
 */
router.delete('/block-command/:command', (req, res) => {
  try {
    const securityManager = initializeSecurityManager();
    const { command } = req.params;
    
    securityManager.unblockCommand(command);
    
    res.json({
      success: true,
      message: `Comando '${command}' desbloqueado`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/security/allowed-commands
 * Lista comandos permitidos
 */
router.get('/allowed-commands', (req, res) => {
  try {
    const securityManager = initializeSecurityManager();
    const stats = securityManager.getStats();
    
    res.json({
      success: true,
      commands: stats.allowedCommands
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/security/blocked-commands
 * Lista comandos bloqueados
 */
router.get('/blocked-commands', (req, res) => {
  try {
    const securityManager = initializeSecurityManager();
    const stats = securityManager.getStats();
    
    res.json({
      success: true,
      commands: stats.blockedCommands
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/security/timeout/set-default
 * Define timeout padrão
 */
router.post('/timeout/set-default', (req, res) => {
  try {
    const securityManager = initializeSecurityManager();
    const { timeout } = req.body;
    
    if (!timeout || timeout < 1000 || timeout > 600000) {
      return res.status(400).json({
        success: false,
        error: 'Timeout deve estar entre 1000ms (1s) e 600000ms (10min)'
      });
    }
    
    securityManager.defaultTimeout = timeout;
    
    res.json({
      success: true,
      message: `Timeout padrão definido para ${timeout}ms`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/security/active-timeouts
 * Lista timeouts ativos
 */
router.get('/active-timeouts', (req, res) => {
  try {
    const securityManager = initializeSecurityManager();
    const stats = securityManager.getStats();
    
    res.json({
      success: true,
      activeTimeouts: stats.activeTimeouts,
      count: stats.activeTimeouts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/security/clear-timeouts
 * Limpa todos os timeouts ativos
 */
router.post('/clear-timeouts', (req, res) => {
  try {
    const securityManager = initializeSecurityManager();
    securityManager.clearAllTimeouts();
    
    res.json({
      success: true,
      message: 'Todos os timeouts foram limpos'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
export { initializeSecurityManager };