import React, { useRef, useState, useCallback } from 'react';
import './FolderPicker.css';

export function FolderPicker({ onFolderSelect, onCancel, isOpen }) {
  const [selectedPath, setSelectedPath] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const handleFolderSelect = useCallback(async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsLoading(true);
    setError('');

    try {
      // Obter o caminho da pasta a partir do primeiro arquivo
      const firstFile = files[0];
      const fullPath = firstFile.webkitRelativePath || firstFile.name;
      const folderPath = fullPath.split('/')[0];
      
      // Construir estrutura de arquivos
      const fileStructure = {};
      const fileContents = {};

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const relativePath = file.webkitRelativePath || file.name;
        
        // Ler conteúdo do arquivo se for um arquivo de texto
        if (isTextFile(file)) {
          try {
            const content = await readFileContent(file);
            fileContents[relativePath] = content;
          } catch (err) {
            console.warn(`Não foi possível ler o arquivo ${relativePath}:`, err);
            fileContents[relativePath] = '';
          }
        }

        // Construir estrutura de diretórios
        const pathParts = relativePath.split('/');
        let current = fileStructure;
        
        for (let j = 0; j < pathParts.length - 1; j++) {
          const part = pathParts[j];
          if (!current[part]) {
            current[part] = { type: 'directory', children: {} };
          }
          current = current[part].children;
        }
        
        // Adicionar arquivo
        const fileName = pathParts[pathParts.length - 1];
        current[fileName] = {
          type: 'file',
          size: file.size,
          lastModified: file.lastModified,
          path: relativePath
        };
      }

      setSelectedPath(folderPath);
      
      // Chamar callback com os dados da pasta
      onFolderSelect?.({
        name: folderPath,
        path: folderPath,
        structure: fileStructure,
        contents: fileContents,
        totalFiles: files.length
      });

    } catch (err) {
      setError('Erro ao processar a pasta selecionada: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  }, [onFolderSelect]);

  const readFileContent = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('Erro ao ler arquivo'));
      reader.readAsText(file);
    });
  };

  const isTextFile = (file) => {
    const textExtensions = [
      'txt', 'js', 'jsx', 'ts', 'tsx', 'css', 'html', 'htm', 'json', 'xml',
      'md', 'py', 'java', 'php', 'rb', 'go', 'rs', 'cpp', 'c', 'h', 'hpp',
      'yml', 'yaml', 'toml', 'ini', 'cfg', 'conf', 'log', 'sql', 'sh', 'bat',
      'ps1', 'dockerfile', 'gitignore', 'env', 'properties'
    ];
    
    const extension = file.name.split('.').pop()?.toLowerCase();
    return textExtensions.includes(extension) || file.size < 1024 * 1024; // < 1MB
  };

  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleCancel = useCallback(() => {
    setSelectedPath('');
    setError('');
    onCancel?.();
  }, [onCancel]);

  if (!isOpen) return null;

  return (
    <div className="folder-picker-overlay">
      <div className="folder-picker-modal">
        <div className="folder-picker-header">
          <h3>
            <i className="fas fa-folder-open"></i>
            Abrir Pasta
          </h3>
          <button 
            className="close-button"
            onClick={handleCancel}
            disabled={isLoading}
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="folder-picker-content">
          <div className="folder-picker-description">
            <p>
              Selecione uma pasta para abrir como projeto. Todos os arquivos da pasta 
              serão carregados e você poderá editá-los diretamente.
            </p>
          </div>

          {error && (
            <div className="error-message">
              <i className="fas fa-exclamation-triangle"></i>
              {error}
            </div>
          )}

          <div className="folder-selection-area">
            <input
              ref={fileInputRef}
              type="file"
              webkitdirectory=""
              directory=""
              multiple
              onChange={handleFolderSelect}
              style={{ display: 'none' }}
              disabled={isLoading}
            />
            
            <div className="folder-input-group">
              <input
                type="text"
                className="folder-path-input"
                value={selectedPath}
                placeholder="Nenhuma pasta selecionada"
                readOnly
              />
              <button
                className="browse-button"
                onClick={handleBrowseClick}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i>
                    Processando...
                  </>
                ) : (
                  <>
                    <i className="fas fa-folder"></i>
                    Procurar
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="folder-picker-tips">
            <h4>
              <i className="fas fa-lightbulb"></i>
              Dicas:
            </h4>
            <ul>
              <li>Selecione a pasta raiz do seu projeto</li>
              <li>Arquivos de texto serão carregados automaticamente</li>
              <li>Arquivos binários grandes serão ignorados</li>
              <li>Você pode editar e salvar arquivos diretamente</li>
            </ul>
          </div>
        </div>

        <div className="folder-picker-actions">
          <button
            className="cancel-button"
            onClick={handleCancel}
            disabled={isLoading}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

export default FolderPicker;

// Componente para criar novo projeto
export function NewProjectDialog({ onCreateProject, onCancel, isOpen }) {
  const [projectName, setProjectName] = useState('');
  const [projectType, setProjectType] = useState('javascript');
  const [isCreating, setIsCreating] = useState(false);

  const projectTemplates = {
    javascript: {
      name: 'JavaScript',
      icon: 'fab fa-js-square',
      files: {
        'package.json': JSON.stringify({
          name: projectName || 'novo-projeto',
          version: '1.0.0',
          description: '',
          main: 'index.js',
          scripts: {
            start: 'node index.js',
            test: 'echo "Error: no test specified" && exit 1'
          },
          keywords: [],
          author: '',
          license: 'ISC'
        }, null, 2),
        'index.js': `console.log('Olá, mundo!');\n`,
        'README.md': `# ${projectName || 'Novo Projeto'}\n\nDescrição do projeto.\n`
      }
    },
    react: {
      name: 'React',
      icon: 'fab fa-react',
      files: {
        'package.json': JSON.stringify({
          name: projectName || 'novo-projeto-react',
          version: '0.1.0',
          private: true,
          dependencies: {
            react: '^18.2.0',
            'react-dom': '^18.2.0'
          },
          scripts: {
            start: 'react-scripts start',
            build: 'react-scripts build',
            test: 'react-scripts test',
            eject: 'react-scripts eject'
          }
        }, null, 2),
        'src/App.jsx': `import React from 'react';\nimport './App.css';\n\nfunction App() {\n  return (\n    <div className="App">\n      <h1>Olá, React!</h1>\n    </div>\n  );\n}\n\nexport default App;\n`,
        'src/index.js': `import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App';\n\nconst root = ReactDOM.createRoot(document.getElementById('root'));\nroot.render(<App />);\n`,
        'src/App.css': `.App {\n  text-align: center;\n  padding: 20px;\n}\n`,
        'public/index.html': `<!DOCTYPE html>\n<html lang="pt-BR">\n<head>\n  <meta charset="utf-8" />\n  <title>${projectName || 'Novo Projeto React'}</title>\n</head>\n<body>\n  <div id="root"></div>\n</body>\n</html>\n`,
        'README.md': `# ${projectName || 'Novo Projeto React'}\n\nProjeto React criado com Create React App.\n`
      }
    },
    html: {
      name: 'HTML/CSS/JS',
      icon: 'fab fa-html5',
      files: {
        'index.html': `<!DOCTYPE html>\n<html lang="pt-BR">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>${projectName || 'Novo Projeto'}</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <h1>Olá, mundo!</h1>\n  <script src="script.js"></script>\n</body>\n</html>\n`,
        'style.css': `body {\n  font-family: Arial, sans-serif;\n  margin: 0;\n  padding: 20px;\n  background-color: #f0f0f0;\n}\n\nh1 {\n  color: #333;\n  text-align: center;\n}\n`,
        'script.js': `console.log('Projeto carregado!');\n`,
        'README.md': `# ${projectName || 'Novo Projeto'}\n\nProjeto web simples com HTML, CSS e JavaScript.\n`
      }
    }
  };

  const handleCreate = useCallback(async () => {
    if (!projectName.trim()) return;

    setIsCreating(true);
    
    try {
      const template = projectTemplates[projectType];
      const projectData = {
        name: projectName.trim(),
        type: projectType,
        structure: {},
        contents: {}
      };

      // Construir estrutura e conteúdos
      Object.entries(template.files).forEach(([filePath, content]) => {
        const pathParts = filePath.split('/');
        let current = projectData.structure;
        
        // Criar diretórios
        for (let i = 0; i < pathParts.length - 1; i++) {
          const part = pathParts[i];
          if (!current[part]) {
            current[part] = { type: 'directory', children: {} };
          }
          current = current[part].children;
        }
        
        // Adicionar arquivo
        const fileName = pathParts[pathParts.length - 1];
        current[fileName] = {
          type: 'file',
          path: filePath
        };
        
        // Adicionar conteúdo
        projectData.contents[filePath] = content;
      });

      onCreateProject?.(projectData);
    } catch (err) {
      console.error('Erro ao criar projeto:', err);
    } finally {
      setIsCreating(false);
    }
  }, [projectName, projectType, onCreateProject]);

  if (!isOpen) return null;

  return (
    <div className="folder-picker-overlay">
      <div className="folder-picker-modal">
        <div className="folder-picker-header">
          <h3>
            <i className="fas fa-plus"></i>
            Novo Projeto
          </h3>
          <button className="close-button" onClick={onCancel}>
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="folder-picker-content">
          <div className="project-form">
            <div className="form-group">
              <label htmlFor="project-name">Nome do Projeto:</label>
              <input
                id="project-name"
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Digite o nome do projeto"
                disabled={isCreating}
              />
            </div>

            <div className="form-group">
              <label>Tipo de Projeto:</label>
              <div className="project-templates">
                {Object.entries(projectTemplates).map(([key, template]) => (
                  <div
                    key={key}
                    className={`template-option ${projectType === key ? 'selected' : ''}`}
                    onClick={() => setProjectType(key)}
                  >
                    <i className={template.icon}></i>
                    <span>{template.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="folder-picker-actions">
          <button
            className="cancel-button"
            onClick={onCancel}
            disabled={isCreating}
          >
            Cancelar
          </button>
          <button
            className="create-button"
            onClick={handleCreate}
            disabled={!projectName.trim() || isCreating}
          >
            {isCreating ? (
              <>
                <i className="fas fa-spinner fa-spin"></i>
                Criando...
              </>
            ) : (
              <>
                <i className="fas fa-plus"></i>
                Criar Projeto
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}