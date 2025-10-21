/**
 * Security Manager - Gerenciamento de Segurança para Execução de Comandos
 * 
 * Implementa timeout configurável e allowlist de comandos seguros
 * para proteger o sistema contra execução de comandos perigosos
 */

import { EventEmitter } from 'events';

export class SecurityManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Configurações de timeout
    this.defaultTimeout = options.defaultTimeout || 30000; // 30 segundos
    this.maxTimeout = options.maxTimeout || 300000; // 5 minutos
    
    // Allowlist de comandos seguros
    this.allowedCommands = new Set([
      // Node.js e npm
      'npm', 'npx', 'node', 'yarn', 'pnpm',
      
      // Git
      'git',
      
      // Ferramentas de build
      'vite', 'webpack', 'rollup', 'parcel',
      
      // Frameworks
      'next', 'nuxt', 'gatsby', 'create-react-app',
      
      // Utilitários seguros
      'ls', 'dir', 'pwd', 'cd', 'mkdir', 'rmdir',
      'cat', 'type', 'echo', 'find', 'grep',
      
      // Docker (comandos específicos)
      'docker-compose', 'docker',
      
      // Linters e formatters
      'eslint', 'prettier', 'tsc', 'jest', 'vitest',
      
      // Package managers específicos
      'bun', 'deno'
    ]);
    
    // Comandos explicitamente bloqueados
    this.blockedCommands = new Set([
      // Comandos de sistema perigosos
      'rm', 'del', 'format', 'fdisk', 'mkfs',
      'shutdown', 'reboot', 'halt', 'poweroff',
      'kill', 'killall', 'pkill', 'taskkill',
      
      // Comandos de rede perigosos
      'wget', 'curl', 'nc', 'netcat', 'telnet',
      'ssh', 'scp', 'rsync', 'ftp', 'sftp',
      
      // Comandos de usuário/permissão
      'su', 'sudo', 'chmod', 'chown', 'passwd',
      'useradd', 'userdel', 'groupadd', 'groupdel',
      
      // Comandos de processo
      'crontab', 'at', 'batch', 'nohup',
      
      // Comandos de sistema
      'mount', 'umount', 'fdisk', 'parted',
      'systemctl', 'service', 'chkconfig',
      
      // Interpretadores perigosos
      'python', 'python3', 'perl', 'ruby', 'php',
      'bash', 'sh', 'zsh', 'fish', 'powershell', 'cmd'
    ]);
    
    // Padrões de comandos perigosos (regex)
    this.dangerousPatterns = [
      /rm\s+-rf/i,           // rm -rf
      /del\s+\/[sq]/i,       // del /s /q
      /format\s+[a-z]:/i,    // format C:
      />\s*\/dev\/null/i,    // redirecionamento perigoso
      /\|\s*sh/i,            // pipe para shell
      /\|\s*bash/i,          // pipe para bash
      /\|\s*cmd/i,           // pipe para cmd
      /&&\s*(rm|del)/i,      // comandos encadeados perigosos
      /;\s*(rm|del)/i,       // comandos sequenciais perigosos
      /\$\(/,                // command substitution
      /`[^`]*`/,             // backticks
      /eval\s*\(/i,          // eval
      /exec\s*\(/i,          // exec
      /system\s*\(/i,        // system calls
      /\/etc\/passwd/i,      // acesso a arquivos sensíveis
      /\/etc\/shadow/i,      // acesso a arquivos sensíveis
      /\.\.\/\.\.\//,        // directory traversal
      /\.\.\\\.\.\\/         // directory traversal (Windows)
    ];
    
    // Argumentos perigosos
    this.dangerousArgs = new Set([
      '--allow-run',
      '--allow-net',
      '--allow-env',
      '--allow-read',
      '--allow-write',
      '--unsafe-perm',
      '--ignore-scripts=false'
    ]);
    
    // Timeouts ativos
    this.activeTimeouts = new Map();
    
    // Estatísticas
    this.stats = {
      commandsExecuted: 0,
      commandsBlocked: 0,
      timeouts: 0,
      startTime: Date.now()
    };
  }

  /**
   * Valida se um comando é seguro para execução
   */
  validateCommand(command, options = {}) {
    const validation = {
      allowed: false,
      reason: null,
      sanitizedCommand: null,
      timeout: this.calculateTimeout(command, options)
    };

    try {
      // Normalizar comando
      const normalizedCommand = command.trim().toLowerCase();
      
      // Verificar se o comando está vazio
      if (!normalizedCommand) {
        validation.reason = 'Comando vazio';
        return validation;
      }

      // Extrair o comando base (primeira palavra)
      const baseCommand = normalizedCommand.split(/\s+/)[0];
      
      // Verificar se está na lista de bloqueados
      if (this.blockedCommands.has(baseCommand)) {
        validation.reason = `Comando '${baseCommand}' está explicitamente bloqueado`;
        this.stats.commandsBlocked++;
        return validation;
      }

      // Verificar padrões perigosos
      for (const pattern of this.dangerousPatterns) {
        if (pattern.test(command)) {
          validation.reason = `Comando contém padrão perigoso: ${pattern}`;
          this.stats.commandsBlocked++;
          return validation;
        }
      }

      // Verificar argumentos perigosos
      const args = command.split(/\s+/).slice(1);
      for (const arg of args) {
        if (this.dangerousArgs.has(arg)) {
          validation.reason = `Argumento perigoso detectado: ${arg}`;
          this.stats.commandsBlocked++;
          return validation;
        }
      }

      // Verificar se está na allowlist
      if (!this.allowedCommands.has(baseCommand)) {
        validation.reason = `Comando '${baseCommand}' não está na allowlist`;
        this.stats.commandsBlocked++;
        return validation;
      }

      // Sanitizar comando
      validation.sanitizedCommand = this.sanitizeCommand(command);
      validation.allowed = true;
      this.stats.commandsExecuted++;
      
      return validation;

    } catch (error) {
      validation.reason = `Erro na validação: ${error.message}`;
      return validation;
    }
  }

  /**
   * Sanitiza um comando removendo caracteres perigosos
   */
  sanitizeCommand(command) {
    return command
      // Remover caracteres de controle
      .replace(/[\x00-\x1f\x7f-\x9f]/g, '')
      // Remover múltiplos espaços
      .replace(/\s+/g, ' ')
      // Trim
      .trim();
  }

  /**
   * Calcula timeout apropriado para um comando
   */
  calculateTimeout(command, options = {}) {
    // Timeout customizado
    if (options.timeout) {
      return Math.min(options.timeout, this.maxTimeout);
    }

    // Timeouts específicos por tipo de comando
    const baseCommand = command.trim().split(/\s+/)[0].toLowerCase();
    
    const timeoutMap = {
      'npm': 120000,        // 2 minutos para npm
      'yarn': 120000,       // 2 minutos para yarn
      'pnpm': 120000,       // 2 minutos para pnpm
      'git': 60000,         // 1 minuto para git
      'docker': 180000,     // 3 minutos para docker
      'docker-compose': 180000, // 3 minutos para docker-compose
      'vite': 60000,        // 1 minuto para vite
      'webpack': 120000,    // 2 minutos para webpack
      'next': 90000,        // 1.5 minutos para next
      'tsc': 90000,         // 1.5 minutos para TypeScript
      'jest': 60000,        // 1 minuto para jest
      'vitest': 60000       // 1 minuto para vitest
    };

    return timeoutMap[baseCommand] || this.defaultTimeout;
  }

  /**
   * Cria um timeout para um comando
   */
  createTimeout(commandId, timeoutMs, callback) {
    const timeout = setTimeout(() => {
      this.stats.timeouts++;
      this.activeTimeouts.delete(commandId);
      this.emit('command_timeout', { commandId, timeout: timeoutMs });
      callback(new Error(`Command timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    this.activeTimeouts.set(commandId, timeout);
    return timeout;
  }

  /**
   * Limpa um timeout ativo
   */
  clearTimeout(commandId) {
    const timeout = this.activeTimeouts.get(commandId);
    if (timeout) {
      clearTimeout(timeout);
      this.activeTimeouts.delete(commandId);
      return true;
    }
    return false;
  }

  /**
   * Adiciona comando à allowlist
   */
  allowCommand(command) {
    this.allowedCommands.add(command.toLowerCase());
    this.emit('command_allowed', { command });
  }

  /**
   * Remove comando da allowlist
   */
  disallowCommand(command) {
    this.allowedCommands.delete(command.toLowerCase());
    this.emit('command_disallowed', { command });
  }

  /**
   * Bloqueia comando explicitamente
   */
  blockCommand(command) {
    this.blockedCommands.add(command.toLowerCase());
    this.emit('command_blocked', { command });
  }

  /**
   * Desbloqueia comando
   */
  unblockCommand(command) {
    this.blockedCommands.delete(command.toLowerCase());
    this.emit('command_unblocked', { command });
  }

  /**
   * Obtém estatísticas de segurança
   */
  getStats() {
    const uptime = Date.now() - this.stats.startTime;
    return {
      ...this.stats,
      uptime,
      activeTimeouts: this.activeTimeouts.size,
      allowedCommands: Array.from(this.allowedCommands),
      blockedCommands: Array.from(this.blockedCommands)
    };
  }

  /**
   * Reseta estatísticas
   */
  resetStats() {
    this.stats = {
      commandsExecuted: 0,
      commandsBlocked: 0,
      timeouts: 0,
      startTime: Date.now()
    };
    this.emit('stats_reset');
  }

  /**
   * Limpa todos os timeouts ativos
   */
  clearAllTimeouts() {
    for (const [commandId, timeout] of this.activeTimeouts) {
      clearTimeout(timeout);
    }
    this.activeTimeouts.clear();
    this.emit('all_timeouts_cleared');
  }

  /**
   * Exporta configuração atual
   */
  exportConfig() {
    return {
      defaultTimeout: this.defaultTimeout,
      maxTimeout: this.maxTimeout,
      allowedCommands: Array.from(this.allowedCommands),
      blockedCommands: Array.from(this.blockedCommands)
    };
  }

  /**
   * Importa configuração
   */
  importConfig(config) {
    if (config.defaultTimeout) this.defaultTimeout = config.defaultTimeout;
    if (config.maxTimeout) this.maxTimeout = config.maxTimeout;
    if (config.allowedCommands) {
      this.allowedCommands = new Set(config.allowedCommands);
    }
    if (config.blockedCommands) {
      this.blockedCommands = new Set(config.blockedCommands);
    }
    this.emit('config_imported', config);
  }
}