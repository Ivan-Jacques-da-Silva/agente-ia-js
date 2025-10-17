/**
 * Gerenciador de Preview Ao Vivo
 * 
 * Sistema para capturar e transmitir preview em tempo real
 * dos projetos sendo desenvolvidos pelo agente
 */

import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class PreviewManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.projectPath = options.projectPath || './projects';
    this.previewPort = options.previewPort || 3000;
    this.proxyPort = options.proxyPort || 8080;
    
    // Estado do preview
    this.activeServers = new Map();
    this.previewUrls = new Map();
    this.screenshots = new Map();
    
    // Configurações
    this.config = {
      captureInterval: options.captureInterval || 2000, // 2s
      maxScreenshots: options.maxScreenshots || 10,
      enableLiveReload: options.enableLiveReload !== false,
      frameworks: {
        react: {
          startCommand: 'npm run dev',
          buildCommand: 'npm run build',
          defaultPort: 3000
        },
        vue: {
          startCommand: 'npm run dev',
          buildCommand: 'npm run build',
          defaultPort: 5173
        },
        angular: {
          startCommand: 'ng serve',
          buildCommand: 'ng build',
          defaultPort: 4200
        },
        svelte: {
          startCommand: 'npm run dev',
          buildCommand: 'npm run build',
          defaultPort: 5173
        },
        nextjs: {
          startCommand: 'npm run dev',
          buildCommand: 'npm run build',
          defaultPort: 3000
        }
      }
    };
    
    this.log('PreviewManager inicializado');
  }
  
  /**
   * Inicia preview para um projeto
   */
  async startPreview(projectId, framework = 'react') {
    try {
      this.log(`Iniciando preview para projeto ${projectId} (${framework})`);
      
      const projectPath = path.join(this.projectPath, projectId);
      
      // Verificar se projeto existe
      try {
        await fs.access(projectPath);
      } catch (error) {
        throw new Error(`Projeto não encontrado: ${projectPath}`);
      }
      
      // Detectar framework se não especificado
      if (framework === 'auto') {
        framework = await this.detectFramework(projectPath);
      }
      
      const frameworkConfig = this.config.frameworks[framework];
      if (!frameworkConfig) {
        throw new Error(`Framework não suportado: ${framework}`);
      }
      
      // Encontrar porta disponível
      const port = await this.findAvailablePort(frameworkConfig.defaultPort);
      
      // Iniciar servidor de desenvolvimento
      const server = await this.startDevServer(projectPath, framework, port);
      
      // Registrar servidor ativo
      this.activeServers.set(projectId, {
        process: server,
        framework,
        port,
        projectPath,
        startTime: Date.now()
      });
      
      // URL do preview
      const previewUrl = `http://localhost:${port}`;
      this.previewUrls.set(projectId, previewUrl);
      
      // Iniciar captura de screenshots (se suportado)
      if (this.config.enableScreenshots) {
        setTimeout(() => {
          this.startScreenshotCapture(projectId, previewUrl);
        }, 5000); // Aguardar servidor inicializar
      }
      
      // Configurar live reload
      if (this.config.enableLiveReload) {
        this.setupLiveReload(projectId, projectPath);
      }
      
      this.emit('preview_started', {
        projectId,
        framework,
        url: previewUrl,
        port
      });
      
      this.log(`Preview iniciado: ${previewUrl}`);
      
      return {
        success: true,
        url: previewUrl,
        port,
        framework
      };
      
    } catch (error) {
      this.log(`Erro ao iniciar preview: ${error.message}`, 'error');
      
      this.emit('preview_error', {
        projectId,
        error: error.message
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Para preview de um projeto
   */
  async stopPreview(projectId) {
    try {
      const serverInfo = this.activeServers.get(projectId);
      
      if (!serverInfo) {
        return { success: true, message: 'Preview não estava ativo' };
      }
      
      // Parar processo do servidor
      if (serverInfo.process && !serverInfo.process.killed) {
        serverInfo.process.kill('SIGTERM');
        
        // Forçar kill se não parar em 5s
        setTimeout(() => {
          if (!serverInfo.process.killed) {
            serverInfo.process.kill('SIGKILL');
          }
        }, 5000);
      }
      
      // Limpar registros
      this.activeServers.delete(projectId);
      this.previewUrls.delete(projectId);
      this.screenshots.delete(projectId);
      
      this.emit('preview_stopped', { projectId });
      
      this.log(`Preview parado para projeto ${projectId}`);
      
      return { success: true };
      
    } catch (error) {
      this.log(`Erro ao parar preview: ${error.message}`, 'error');
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Obtém status do preview
   */
  getPreviewStatus(projectId) {
    const serverInfo = this.activeServers.get(projectId);
    const previewUrl = this.previewUrls.get(projectId);
    
    if (!serverInfo) {
      return {
        active: false,
        projectId
      };
    }
    
    return {
      active: true,
      projectId,
      framework: serverInfo.framework,
      url: previewUrl,
      port: serverInfo.port,
      uptime: Date.now() - serverInfo.startTime,
      screenshots: this.screenshots.get(projectId) || []
    };
  }
  
  /**
   * Lista todos os previews ativos
   */
  listActivePreviews() {
    const previews = [];
    
    for (const [projectId, serverInfo] of this.activeServers) {
      previews.push({
        projectId,
        framework: serverInfo.framework,
        url: this.previewUrls.get(projectId),
        port: serverInfo.port,
        uptime: Date.now() - serverInfo.startTime
      });
    }
    
    return previews;
  }
  
  /**
   * Detecta framework do projeto
   */
  async detectFramework(projectPath) {
    try {
      const packageJsonPath = path.join(projectPath, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
      
      const dependencies = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      };
      
      // Detectar por dependências
      if (dependencies.react) return 'react';
      if (dependencies.vue) return 'vue';
      if (dependencies['@angular/core']) return 'angular';
      if (dependencies.svelte) return 'svelte';
      if (dependencies.next) return 'nextjs';
      
      // Detectar por scripts
      const scripts = packageJson.scripts || {};
      if (scripts.dev && scripts.dev.includes('next')) return 'nextjs';
      if (scripts.serve && scripts.serve.includes('ng')) return 'angular';
      
      // Default
      return 'react';
      
    } catch (error) {
      this.log(`Erro ao detectar framework: ${error.message}`, 'warn');
      return 'react';
    }
  }
  
  /**
   * Inicia servidor de desenvolvimento
   */
  async startDevServer(projectPath, framework, port) {
    return new Promise((resolve, reject) => {
      const frameworkConfig = this.config.frameworks[framework];
      const command = frameworkConfig.startCommand;
      
      // Configurar variáveis de ambiente
      const env = {
        ...process.env,
        PORT: port.toString(),
        BROWSER: 'none', // Não abrir browser automaticamente
        CI: 'true' // Evitar prompts interativos
      };
      
      this.log(`Executando: ${command} na pasta ${projectPath}`);
      
      const [cmd, ...args] = command.split(' ');
      const server = spawn(cmd, args, {
        cwd: projectPath,
        env,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let serverReady = false;
      
      // Monitorar saída para detectar quando servidor está pronto
      server.stdout.on('data', (data) => {
        const output = data.toString();
        this.log(`[${framework}] ${output.trim()}`);
        
        // Detectar quando servidor está pronto
        if (!serverReady && this.isServerReady(output, framework)) {
          serverReady = true;
          resolve(server);
        }
        
        this.emit('server_output', {
          projectId: path.basename(projectPath),
          type: 'stdout',
          data: output
        });
      });
      
      server.stderr.on('data', (data) => {
        const output = data.toString();
        this.log(`[${framework}] ERROR: ${output.trim()}`, 'error');
        
        this.emit('server_output', {
          projectId: path.basename(projectPath),
          type: 'stderr',
          data: output
        });
      });
      
      server.on('error', (error) => {
        this.log(`Erro no servidor: ${error.message}`, 'error');
        if (!serverReady) {
          reject(error);
        }
      });
      
      server.on('exit', (code) => {
        this.log(`Servidor finalizado com código ${code}`);
        this.emit('server_exit', {
          projectId: path.basename(projectPath),
          code
        });
      });
      
      // Timeout para inicialização
      setTimeout(() => {
        if (!serverReady) {
          reject(new Error('Timeout ao iniciar servidor'));
        }
      }, 30000); // 30s timeout
    });
  }
  
  /**
   * Verifica se servidor está pronto baseado na saída
   */
  isServerReady(output, framework) {
    const readyPatterns = {
      react: [
        'Local:',
        'webpack compiled',
        'compiled successfully',
        'ready on'
      ],
      vue: [
        'Local:',
        'ready in',
        'running at'
      ],
      angular: [
        'compiled successfully',
        'Angular Live Development Server'
      ],
      svelte: [
        'Local:',
        'ready in'
      ],
      nextjs: [
        'ready on',
        'compiled successfully'
      ]
    };
    
    const patterns = readyPatterns[framework] || readyPatterns.react;
    return patterns.some(pattern => 
      output.toLowerCase().includes(pattern.toLowerCase())
    );
  }
  
  /**
   * Encontra porta disponível
   */
  async findAvailablePort(startPort) {
    const net = await import('net');
    
    return new Promise((resolve) => {
      const server = net.createServer();
      
      server.listen(startPort, () => {
        const port = server.address().port;
        server.close(() => resolve(port));
      });
      
      server.on('error', () => {
        // Porta ocupada, tentar próxima
        this.findAvailablePort(startPort + 1).then(resolve);
      });
    });
  }
  
  /**
   * Configura live reload para mudanças de arquivo
   */
  setupLiveReload(projectId, projectPath) {
    // Implementação básica de file watching
    // Em produção, usar chokidar ou similar
    const watcher = fs.watch(projectPath, { recursive: true }, (eventType, filename) => {
      if (filename && !filename.includes('node_modules')) {
        this.emit('file_changed', {
          projectId,
          eventType,
          filename
        });
      }
    });
    
    // Armazenar watcher para cleanup
    const serverInfo = this.activeServers.get(projectId);
    if (serverInfo) {
      serverInfo.watcher = watcher;
    }
  }
  
  /**
   * Inicia captura de screenshots (placeholder)
   */
  async startScreenshotCapture(projectId, url) {
    // Placeholder para captura de screenshots
    // Em implementação real, usar puppeteer ou playwright
    this.log(`Screenshot capture iniciado para ${url}`);
    
    const screenshots = [];
    this.screenshots.set(projectId, screenshots);
    
    // Simular captura periódica
    const captureInterval = setInterval(() => {
      const screenshot = {
        timestamp: Date.now(),
        url,
        // Em implementação real, capturar screenshot real
        placeholder: `Screenshot de ${url} em ${new Date().toISOString()}`
      };
      
      screenshots.push(screenshot);
      
      // Manter apenas últimos N screenshots
      if (screenshots.length > this.config.maxScreenshots) {
        screenshots.shift();
      }
      
      this.emit('screenshot_captured', {
        projectId,
        screenshot
      });
      
    }, this.config.captureInterval);
    
    // Armazenar interval para cleanup
    const serverInfo = this.activeServers.get(projectId);
    if (serverInfo) {
      serverInfo.screenshotInterval = captureInterval;
    }
  }
  
  /**
   * Limpa recursos
   */
  async cleanup() {
    this.log('Limpando recursos do PreviewManager...');
    
    // Parar todos os previews ativos
    const projectIds = Array.from(this.activeServers.keys());
    
    for (const projectId of projectIds) {
      await this.stopPreview(projectId);
    }
    
    this.log('Cleanup concluído');
  }
  
  /**
   * Log interno
   */
  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [PreviewManager] [${level.toUpperCase()}] ${message}`);
    
    this.emit('log', {
      timestamp,
      level,
      message,
      component: 'PreviewManager'
    });
  }
}

export default PreviewManager;