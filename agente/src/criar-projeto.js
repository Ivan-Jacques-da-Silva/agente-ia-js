import fs from "node:fs/promises";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export class CriadorProjeto {
  constructor(nomeProjeto, pastaDestino, callbackProgresso = null) {
    this.nomeProjeto = nomeProjeto;
    this.pastaDestino = pastaDestino;
    this.callbackProgresso = callbackProgresso;
    this.pastaCompleta = path.join(pastaDestino, nomeProjeto);
  }

  reportarProgresso(etapa, status, detalhes = {}) {
    if (this.callbackProgresso) {
      this.callbackProgresso({
        etapa,
        status,
        detalhes,
        timestamp: new Date().toISOString()
      });
    }
  }

  async criarEstruturaProjeto() {
    this.reportarProgresso("estrutura", "iniciando", { 
      mensagem: "Criando estrutura de pastas..." 
    });

    // Criar pasta principal
    await fs.mkdir(this.pastaCompleta, { recursive: true });
    
    // Criar estrutura de pastas React
    const pastas = [
      "src",
      "src/components",
      "src/hooks",
      "src/utils",
      "public"
    ];

    for (const pasta of pastas) {
      const caminhoCompleto = path.join(this.pastaCompleta, pasta);
      await fs.mkdir(caminhoCompleto, { recursive: true });
      
      this.reportarProgresso("estrutura", "progresso", {
        pasta: pasta,
        mensagem: `Pasta ${pasta} criada`
      });
      
      // Pequena pausa para visualização
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    this.reportarProgresso("estrutura", "concluido", {
      mensagem: "Estrutura de pastas criada com sucesso"
    });
  }

  async criarPackageJson() {
    this.reportarProgresso("package", "iniciando", {
      mensagem: "Criando package.json..."
    });

    const packageJson = {
      name: this.nomeProjeto.toLowerCase().replace(/\s+/g, '-'),
      version: "0.1.0",
      private: true,
      dependencies: {
        "react": "^18.2.0",
        "react-dom": "^18.2.0",
        "react-scripts": "5.0.1"
      },
      scripts: {
        "start": "react-scripts start",
        "build": "react-scripts build",
        "test": "react-scripts test",
        "eject": "react-scripts eject"
      },
      eslintConfig: {
        extends: [
          "react-app",
          "react-app/jest"
        ]
      },
      browserslist: {
        production: [
          ">0.2%",
          "not dead",
          "not op_mini all"
        ],
        development: [
          "last 1 chrome version",
          "last 1 firefox version",
          "last 1 safari version"
        ]
      }
    };

    const caminhoPackage = path.join(this.pastaCompleta, "package.json");
    await fs.writeFile(caminhoPackage, JSON.stringify(packageJson, null, 2));

    this.reportarProgresso("package", "concluido", {
      mensagem: "package.json criado com sucesso"
    });
  }

  async criarArquivoHtml() {
    this.reportarProgresso("html", "iniciando", {
      mensagem: "Criando estrutura HTML..."
    });

    const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <link rel="icon" href="%PUBLIC_URL%/favicon.ico" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#000000" />
  <meta name="description" content="Aplicação React criada pelo Agente IA" />
  <title>${this.nomeProjeto}</title>
</head>
<body>
  <noscript>Você precisa habilitar JavaScript para executar esta aplicação.</noscript>
  <div id="root"></div>
</body>
</html>`;

    const caminhoHtml = path.join(this.pastaCompleta, "public", "index.html");
    await fs.writeFile(caminhoHtml, htmlContent);

    this.reportarProgresso("html", "concluido", {
      mensagem: "Arquivo HTML criado",
      arquivo: "public/index.html"
    });
  }

  async criarComponenteApp() {
    this.reportarProgresso("app", "iniciando", {
      mensagem: "Criando componente principal App..."
    });

    const appJsxContent = `import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [count, setCount] = useState(0);
  const [message, setMessage] = useState('Bem-vindo ao seu novo projeto React!');

  useEffect(() => {
    document.title = '${this.nomeProjeto}';
  }, []);

  const handleClick = () => {
    setCount(count + 1);
    setMessage(\`Você clicou \${count + 1} vez\${count + 1 === 1 ? '' : 'es'}!\`);
  };

  return (
    <div className="App">
      <header className="App-header">
        <div className="logo-container">
          <div className="logo">⚛️</div>
          <h1>${this.nomeProjeto}</h1>
        </div>
        
        <div className="content">
          <p className="welcome-message">{message}</p>
          
          <div className="counter-section">
            <button 
              className="counter-button" 
              onClick={handleClick}
              aria-label="Incrementar contador"
            >
              Clique aqui: {count}
            </button>
          </div>

          <div className="features">
            <div className="feature-card">
              <h3>🚀 Rápido</h3>
              <p>Construído com React 18 e as melhores práticas</p>
            </div>
            <div className="feature-card">
              <h3>🎨 Moderno</h3>
              <p>Interface limpa e responsiva</p>
            </div>
            <div className="feature-card">
              <h3>🔧 Configurável</h3>
              <p>Pronto para personalização e expansão</p>
            </div>
          </div>

          <div className="getting-started">
            <h2>Próximos Passos</h2>
            <ul>
              <li>Edite <code>src/App.js</code> para personalizar esta página</li>
              <li>Adicione novos componentes em <code>src/components/</code></li>
              <li>Execute <code>npm start</code> para desenvolvimento</li>
              <li>Execute <code>npm run build</code> para produção</li>
            </ul>
          </div>
        </div>
      </header>
    </div>
  );
}

export default App;`;

    const caminhoApp = path.join(this.pastaCompleta, "src", "App.jsx");
    await fs.writeFile(caminhoApp, appJsxContent);

    this.reportarProgresso("app", "progresso", {
      mensagem: "Componente App.jsx criado",
      arquivo: "src/App.jsx"
    });

    // Criar CSS do App
    const appCssContent = `.App {
  text-align: center;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.App-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 40px 20px;
  color: white;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
}

.logo-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 40px;
  animation: fadeInDown 1s ease-out;
}

.logo {
  font-size: 4rem;
  margin-bottom: 20px;
  animation: spin 20s linear infinite;
}

.logo-container h1 {
  font-size: 2.5rem;
  margin: 0;
  color: #ffffff;
  text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
}

.content {
  max-width: 800px;
  width: 100%;
}

.welcome-message {
  font-size: 1.3rem;
  margin-bottom: 30px;
  color: #f0f0f0;
  animation: fadeIn 1.5s ease-out;
}

.counter-section {
  margin: 40px 0;
}

.counter-button {
  background: linear-gradient(45deg, #ff6b6b, #ee5a24);
  border: none;
  color: white;
  padding: 15px 30px;
  font-size: 1.1rem;
  border-radius: 50px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(0,0,0,0.2);
  font-weight: 600;
}

.counter-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0,0,0,0.3);
  background: linear-gradient(45deg, #ee5a24, #ff6b6b);
}

.counter-button:active {
  transform: translateY(0);
}

.features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin: 50px 0;
}

.feature-card {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 15px;
  padding: 25px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: transform 0.3s ease;
}

.feature-card:hover {
  transform: translateY(-5px);
}

.feature-card h3 {
  margin: 0 0 15px 0;
  font-size: 1.3rem;
  color: #ffffff;
}

.feature-card p {
  margin: 0;
  color: #e0e0e0;
  line-height: 1.5;
}

.getting-started {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 15px;
  padding: 30px;
  margin-top: 40px;
  text-align: left;
}

.getting-started h2 {
  color: #61dafb;
  margin-top: 0;
  text-align: center;
}

.getting-started ul {
  list-style: none;
  padding: 0;
}

.getting-started li {
  margin: 15px 0;
  padding: 10px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  color: #f0f0f0;
}

.getting-started li:last-child {
  border-bottom: none;
}

.getting-started code {
  background-color: rgba(0, 0, 0, 0.3);
  padding: 4px 8px;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  color: #61dafb;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeInDown {
  from {
    opacity: 0;
    transform: translateY(-30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 768px) {
  .App-header {
    padding: 20px 15px;
  }
  
  .logo-container h1 {
    font-size: 2rem;
  }
  
  .welcome-message {
    font-size: 1.1rem;
  }
  
  .features {
    grid-template-columns: 1fr;
  }
  
  .getting-started {
    padding: 20px;
  }
}`;

    const caminhoCss = path.join(this.pastaCompleta, "src", "App.css");
    await fs.writeFile(caminhoCss, appCssContent);

    this.reportarProgresso("app", "concluido", {
      mensagem: "Componente App e CSS criados",
      arquivos: ["src/App.jsx", "src/App.css"]
    });
  }

  async criarIndexJs() {
    this.reportarProgresso("index", "iniciando", {
      mensagem: "Criando arquivo de entrada..."
    });

    const indexContent = `import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`;

    const caminhoIndex = path.join(this.pastaCompleta, "src", "index.js");
    await fs.writeFile(caminhoIndex, indexContent);

    // Criar CSS global
    const indexCssContent = `body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

code {
  font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New',
    monospace;
}

* {
  box-sizing: border-box;
}`;

    const caminhoIndexCss = path.join(this.pastaCompleta, "src", "index.css");
    await fs.writeFile(caminhoIndexCss, indexCssContent);

    this.reportarProgresso("index", "concluido", {
      mensagem: "Arquivos de entrada criados",
      arquivos: ["src/index.js", "src/index.css"]
    });
  }

  async instalarDependencias() {
    this.reportarProgresso("instalacao", "iniciando", {
      mensagem: "Verificando e instalando dependências..."
    });

    try {
      // Primeiro, verificar se o npm está disponível
      await execAsync("npm --version", { cwd: this.pastaCompleta });
      
      this.reportarProgresso("instalacao", "progresso", {
        mensagem: "NPM encontrado, iniciando instalação..."
      });

      // Instalar dependências com output em tempo real
      const { stdout, stderr } = await execAsync("npm install --silent", {
        cwd: this.pastaCompleta,
        timeout: 300000 // 5 minutos
      });

      this.reportarProgresso("instalacao", "progresso", {
        mensagem: "Dependências principais instaladas, verificando integridade..."
      });

      // Verificar se as dependências foram instaladas corretamente
      const packageCheck = await execAsync("npm list react react-dom react-scripts --depth=0", {
        cwd: this.pastaCompleta
      });

      this.reportarProgresso("instalacao", "concluido", {
        mensagem: "Todas as dependências instaladas e verificadas com sucesso",
        detalhes: "React, React-DOM e React-Scripts prontos para uso"
      });
    } catch (error) {
      this.reportarProgresso("instalacao", "erro", {
        mensagem: "Erro ao instalar dependências",
        erro: error.message,
        solucao: "Verifique se o Node.js e NPM estão instalados corretamente"
      });
      throw error;
    }
  }

  async iniciarServidor() {
    this.reportarProgresso("servidor", "iniciando", {
      mensagem: "Preparando servidor de desenvolvimento..."
    });

    return new Promise((resolve, reject) => {
      // Usar BROWSER=none para evitar abrir o navegador automaticamente
      const processo = exec("set BROWSER=none && npm start", {
        cwd: this.pastaCompleta,
        env: { ...process.env, BROWSER: 'none' }
      });

      let servidorIniciado = false;
      let timeout;

      // Timeout de 60 segundos para iniciar o servidor
      timeout = setTimeout(() => {
        if (!servidorIniciado) {
          this.reportarProgresso("servidor", "erro", {
            mensagem: "Timeout: Servidor demorou muito para iniciar",
            erro: "O servidor não respondeu em 60 segundos"
          });
          processo.kill();
          reject(new Error("Timeout ao iniciar servidor"));
        }
      }, 60000);

      processo.stdout.on('data', (data) => {
        const output = data.toString();
        console.log('Server output:', output);
        
        // Procurar por indicadores de que o servidor iniciou
        if (output.includes('webpack compiled') || 
            output.includes('Local:') || 
            output.includes('localhost:3000') ||
            output.includes('development server')) {
          if (!servidorIniciado) {
            servidorIniciado = true;
            clearTimeout(timeout);
            
            this.reportarProgresso("servidor", "concluido", {
              mensagem: "Servidor de desenvolvimento iniciado com sucesso!",
              url: "http://localhost:3000",
              detalhes: "Aplicação React rodando e pronta para desenvolvimento"
            });
            
            resolve({
              processo,
              url: "http://localhost:3000"
            });
          }
        } else if (output.includes('Starting the development server')) {
          this.reportarProgresso("servidor", "progresso", {
            mensagem: "Iniciando servidor de desenvolvimento..."
          });
        }
      });

      processo.stderr.on('data', (data) => {
        const errorOutput = data.toString();
        console.error('Server error:', errorOutput);
        
        // Não tratar warnings como erros fatais
        if (!errorOutput.includes('WARNING') && !servidorIniciado) {
          this.reportarProgresso("servidor", "erro", {
            mensagem: "Erro no servidor de desenvolvimento",
            erro: errorOutput
          });
        }
      });

      processo.on('error', (error) => {
        if (!servidorIniciado) {
          clearTimeout(timeout);
          this.reportarProgresso("servidor", "erro", {
            mensagem: "Erro ao iniciar servidor",
            erro: error.message
          });
          reject(error);
        }
      });

      processo.on('exit', (code) => {
        if (!servidorIniciado && code !== 0) {
          clearTimeout(timeout);
          this.reportarProgresso("servidor", "erro", {
            mensagem: "Servidor encerrou inesperadamente",
            erro: `Código de saída: ${code}`
          });
          reject(new Error(`Servidor encerrou com código ${code}`));
        }
      });
    });
  }

  async criarProjetoCompleto() {
    try {
      await this.criarEstruturaProjeto();
      await this.criarPackageJson();
      await this.criarArquivoHtml();
      await this.criarComponenteApp();
      await this.criarIndexJs();
      await this.instalarDependencias();
      
      const servidor = await this.iniciarServidor();
      
      return {
        sucesso: true,
        caminho: this.pastaCompleta,
        servidor: servidor
      };
    } catch (error) {
      this.reportarProgresso("erro", "erro", {
        mensagem: "Erro durante a criação do projeto",
        erro: error.message
      });
      
      return {
        sucesso: false,
        erro: error.message
      };
    }
  }
}