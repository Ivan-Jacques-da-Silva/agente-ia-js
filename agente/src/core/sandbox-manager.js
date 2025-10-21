/**
 * Sandbox Manager - Gerenciamento de Ambiente Sandbox
 * 
 * Gerencia ambientes isolados para execução segura de código
 * e comandos do agente autônomo
 */

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { SecurityManager } from './security-manager.js';

export class SandboxManager {
  constructor(projectId, onLog) {
    this.projectId = projectId;
    this.onLog = onLog;
    this.sandboxPath = path.join(os.tmpdir(), 'agentic-sandbox', projectId);
    this.activeContainers = new Map();
    this.portMappings = new Map();
    this.nextPort = 3000;
    
    // Inicializar gerenciador de segurança
    this.securityManager = new SecurityManager({
      defaultTimeout: 30000,  // 30 segundos
      maxTimeout: 300000      // 5 minutos
    });
    
    // Escutar eventos de segurança
    this.securityManager.on('command_timeout', (data) => {
      this.log('security_timeout', `⏰ Timeout do comando: ${data.commandId}`);
    });
    
    this.securityManager.on('command_blocked', (data) => {
      this.log('security_blocked', `🚫 Comando bloqueado: ${data.command}`);
    });
  }

  /**
   * Inicializa ambiente sandbox
   */
  async initializeSandbox() {
    this.log('sandbox_init', '🏗️ Inicializando ambiente sandbox...');
    
    try {
      // Criar diretório sandbox
      await fs.mkdir(this.sandboxPath, { recursive: true });
      
      // Configurar ambiente isolado
      await this.setupIsolatedEnvironment();
      
      this.log('sandbox_ready', '✅ Ambiente sandbox pronto');
      return { success: true, path: this.sandboxPath };
    } catch (error) {
      this.log('sandbox_error', `❌ Erro ao inicializar sandbox: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Configura ambiente isolado
   */
  async setupIsolatedEnvironment() {
    // Criar estrutura básica
    const dirs = ['src', 'public', 'node_modules', '.temp'];
    for (const dir of dirs) {
      await fs.mkdir(path.join(this.sandboxPath, dir), { recursive: true });
    }

    // Criar package.json básico
    const packageJson = {
      name: `agentic-project-${this.projectId}`,
      version: '1.0.0',
      private: true,
      scripts: {
        start: 'react-scripts start',
        build: 'react-scripts build',
        test: 'react-scripts test',
        dev: 'vite dev'
      },
      dependencies: {},
      devDependencies: {}
    };

    await fs.writeFile(
      path.join(this.sandboxPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
  }

  /**
   * Executa comando no sandbox
   */
  async executeInSandbox(command, options = {}) {
    this.log('command_start', `💻 Executando no sandbox: ${command}`);
    
    // Validar comando com o SecurityManager
    const validation = this.securityManager.validateCommand(command, options);
    
    if (!validation.allowed) {
      const error = new Error(`Comando não permitido: ${validation.reason}`);
      this.log('command_blocked', `🚫 ${error.message}`);
      throw error;
    }
    
    // Usar comando sanitizado
    const sanitizedCommand = validation.sanitizedCommand;
    const timeout = validation.timeout;
    const commandId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    this.log('command_validated', `✅ Comando validado (timeout: ${timeout}ms): ${sanitizedCommand}`);
    
    return new Promise((resolve, reject) => {
      const process = spawn('cmd', ['/c', sanitizedCommand], {
        cwd: this.sandboxPath,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          NODE_ENV: 'development',
          PORT: this.getNextPort().toString(),
          ...options.env
        }
      });

      let stdout = '';
      let stderr = '';
      let isResolved = false;

      // Configurar timeout
      const timeoutHandle = this.securityManager.createTimeout(commandId, timeout, (error) => {
        if (!isResolved) {
          isResolved = true;
          process.kill('SIGTERM');
          reject(error);
        }
      });

      const cleanup = () => {
        this.securityManager.clearTimeout(commandId);
        this.activeContainers.delete(commandId);
      };

      process.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        this.log('command_output', output.trim());
      });

      process.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        this.log('command_error', output.trim());
      });

      process.on('close', (code) => {
        if (!isResolved) {
          isResolved = true;
          cleanup();
          
          if (code === 0) {
            this.log('command_success', `✅ Comando concluído: ${sanitizedCommand}`);
            resolve({ stdout, stderr, code, commandId });
          } else {
            this.log('command_failed', `❌ Comando falhou: ${sanitizedCommand} (código: ${code})`);
            reject(new Error(`Command failed with code ${code}: ${stderr}`));
          }
        }
      });

      process.on('error', (error) => {
        if (!isResolved) {
          isResolved = true;
          cleanup();
          this.log('command_error', `❌ Erro no processo: ${error.message}`);
          reject(error);
        }
      });

      // Armazenar processo para controle
      this.activeContainers.set(commandId, {
        process,
        command: sanitizedCommand,
        startTime: Date.now(),
        timeout
      });
    });
  }

  /**
   * Instala dependências no sandbox
   */
  async installDependencies(dependencies) {
    this.log('deps_install', `📦 Instalando dependências: ${dependencies.join(', ')}`);
    
    try {
      // Instalar dependências uma por vez para melhor controle
      for (const dep of dependencies) {
        await this.executeInSandbox(`npm install ${dep}`);
        this.log('dep_installed', `✅ Instalado: ${dep}`);
      }
      
      return { success: true };
    } catch (error) {
      this.log('deps_error', `❌ Erro na instalação: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Cria arquivo no sandbox
   */
  async createFile(filePath, content) {
    try {
      const fullPath = path.join(this.sandboxPath, filePath);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content);
      
      this.log('file_created', `📄 Arquivo criado: ${filePath}`);
      return { success: true, path: fullPath };
    } catch (error) {
      this.log('file_error', `❌ Erro ao criar arquivo: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Lê arquivo do sandbox
   */
  async readFile(filePath) {
    try {
      const fullPath = path.join(this.sandboxPath, filePath);
      const content = await fs.readFile(fullPath, 'utf8');
      return { success: true, content };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Inicia servidor de desenvolvimento
   */
  async startDevServer(framework = 'react') {
    const port = this.getNextPort();
    this.log('server_start', `🚀 Iniciando servidor de desenvolvimento na porta ${port}`);
    
    try {
      let command;
      switch (framework) {
        case 'react':
          command = 'npm start';
          break;
        case 'vite':
          command = 'npm run dev';
          break;
        case 'next':
          command = 'npm run dev';
          break;
        default:
          command = 'npm start';
      }

      // Validar comando com SecurityManager
      const validation = this.securityManager.validateCommand(command, { timeout: 60000 });
      
      if (!validation.allowed) {
        const error = new Error(`Comando não permitido: ${validation.reason}`);
        this.log('command_blocked', `🚫 ${error.message}`);
        throw error;
      }

      const sanitizedCommand = validation.sanitizedCommand;
      const commandId = `dev-server-${Date.now()}`;

      const process = spawn('cmd', ['/c', sanitizedCommand], {
        cwd: this.sandboxPath,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          PORT: port.toString(),
          BROWSER: 'none'
        }
      });

      // Aguardar servidor iniciar
      return new Promise((resolve, reject) => {
        let serverStarted = false;
        const timeout = setTimeout(() => {
          if (!serverStarted) {
            reject(new Error('Timeout ao iniciar servidor'));
          }
        }, 30000);

        process.stdout.on('data', (data) => {
          const output = data.toString();
          this.log('server_output', output.trim());
          
          if (output.includes('Local:') || output.includes('localhost') || output.includes('ready')) {
            if (!serverStarted) {
              serverStarted = true;
              clearTimeout(timeout);
              this.portMappings.set('dev-server', port);
              this.activeContainers.set(commandId, {
                process,
                command: sanitizedCommand,
                startTime: Date.now(),
                type: 'dev-server'
              });
              
              this.log('server_ready', `✅ Servidor pronto em http://localhost:${port}`);
              resolve({
                success: true,
                url: `http://localhost:${port}`,
                port,
                process,
                commandId
              });
            }
          }
        });

        process.stderr.on('data', (data) => {
          const output = data.toString();
          this.log('server_error', output.trim());
        });

        process.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    } catch (error) {
      this.log('server_error', `❌ Erro ao iniciar servidor: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Para servidor de desenvolvimento
   */
  async stopDevServer() {
    const process = this.activeContainers.get('dev-server');
    if (process) {
      process.kill();
      this.activeContainers.delete('dev-server');
      this.portMappings.delete('dev-server');
      this.log('server_stopped', '🛑 Servidor de desenvolvimento parado');
    }
  }

  /**
   * Obtém próxima porta disponível
   */
  getNextPort() {
    const port = this.nextPort;
    this.nextPort++;
    return port;
  }

  /**
   * Lista arquivos do sandbox
   */
  async listFiles(directory = '') {
    try {
      const fullPath = path.join(this.sandboxPath, directory);
      const items = await fs.readdir(fullPath, { withFileTypes: true });
      
      return {
        success: true,
        files: items.map(item => ({
          name: item.name,
          type: item.isDirectory() ? 'directory' : 'file',
          path: path.join(directory, item.name)
        }))
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Limpa ambiente sandbox
   */
  async cleanup() {
    this.log('cleanup_start', '🧹 Limpando ambiente sandbox...');
    
    // Limpar todos os timeouts ativos
    this.securityManager.clearAllTimeouts();
    
    // Parar todos os processos
    for (const [commandId, containerInfo] of this.activeContainers) {
      try {
        if (containerInfo.process) {
          containerInfo.process.kill();
        } else {
          // Compatibilidade com formato antigo
          containerInfo.kill();
        }
        this.log('process_killed', `🛑 Processo parado: ${commandId}`);
      } catch (error) {
        this.log('process_error', `❌ Erro ao parar processo ${commandId}: ${error.message}`);
      }
    }
    
    this.activeContainers.clear();
    this.portMappings.clear();
    
    // Remover arquivos temporários
    try {
      await fs.rm(this.sandboxPath, { recursive: true, force: true });
      this.log('cleanup_complete', '✅ Limpeza concluída');
    } catch (error) {
      this.log('cleanup_error', `❌ Erro na limpeza: ${error.message}`);
    }
  }

  /**
   * Obtém status do sandbox
   */
  getStatus() {
    const activeProcesses = Array.from(this.activeContainers.entries()).map(([commandId, info]) => ({
      commandId,
      command: info.command || 'unknown',
      startTime: info.startTime || Date.now(),
      timeout: info.timeout || 0,
      type: info.type || 'command'
    }));

    return {
      path: this.sandboxPath,
      activeProcesses,
      ports: Object.fromEntries(this.portMappings),
      nextPort: this.nextPort,
      security: this.securityManager.getStats()
    };
  }

  /**
   * Mata processo específico
   */
  async killProcess(commandId) {
    const containerInfo = this.activeContainers.get(commandId);
    if (!containerInfo) {
      return { success: false, error: 'Processo não encontrado' };
    }

    try {
      if (containerInfo.process) {
        containerInfo.process.kill();
      } else {
        containerInfo.kill();
      }
      
      this.securityManager.clearTimeout(commandId);
      this.activeContainers.delete(commandId);
      
      this.log('process_killed', `🛑 Processo ${commandId} parado manualmente`);
      return { success: true };
    } catch (error) {
      this.log('process_error', `❌ Erro ao parar processo ${commandId}: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Configura SecurityManager
   */
  configureSecurityManager(config) {
    this.securityManager.importConfig(config);
    this.log('security_config', '🔒 Configuração de segurança atualizada');
  }

  /**
   * Adiciona comando à allowlist
   */
  allowCommand(command) {
    this.securityManager.allowCommand(command);
    this.log('security_allow', `✅ Comando permitido: ${command}`);
  }

  /**
   * Bloqueia comando
   */
  blockCommand(command) {
    this.securityManager.blockCommand(command);
    this.log('security_block', `🚫 Comando bloqueado: ${command}`);
  }

  /**
   * Log de eventos
   */
  log(type, message) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type,
      message,
      sandbox: this.projectId
    };
    
    console.log(`[Sandbox ${this.projectId}] ${message}`);
    this.onLog && this.onLog(logEntry);
  }
}

export default SandboxManager;