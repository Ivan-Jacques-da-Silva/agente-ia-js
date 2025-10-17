import React, { useState, useRef, useEffect, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { 
  FaFolder, 
  FaFolderOpen, 
  FaFile, 
  FaSearch, 
  FaDownload, 
  FaChevronLeft, 
  FaChevronRight, 
  FaChevronDown, 
  FaChevronUp,
  FaPlus,
  FaSync,
  FaTimes,
  FaCodeBranch,
  FaEye,
  FaExternalLinkAlt,
  FaDesktop,
  FaRedo,
  FaArrowLeft,
  FaArrowRight
} from 'react-icons/fa';
import './IDELayout.css';

export function IDELayout({
  currentProject,
  fileTree = [],
  openTabs = [],
  activeTab,
  fileContents = {},
  chatMessages = [],
  isLoading = false,
  theme = 'dark',
  projects = [],
  isBuilding = false,
  buildData = null,
  onOpenFolder,
  onCreateProject,
  onCloneRepository,
  onDeleteProject,
  onFileSelect,
  onFileChange,
  onTabClose,
  onTabSwitch,
  onSendMessage,
  onThemeToggle,
  onBuildComplete,
  onCreateFile,
  onCreateFolder,
  onDeleteFile,
  onRenameFile
}) {
  // Estados do layout
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [chatWidth, setChatWidth] = useState(400);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(200);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);
  const [isBottomPanelCollapsed, setIsBottomPanelCollapsed] = useState(false);
  
  // Estados de redimensionamento
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isResizingChat, setIsResizingChat] = useState(false);
  const [isResizingBottom, setIsResizingBottom] = useState(false);
  
  // Estados das abas
  const [activeBottomTab, setActiveBottomTab] = useState('terminal');
  const [activeSidebarTab, setActiveSidebarTab] = useState('explorer');
  
  // Estados do chat
  const [chatInput, setChatInput] = useState('');
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  
  // Estados do terminal
  const [terminalOutput, setTerminalOutput] = useState([]);
  const [terminalInput, setTerminalInput] = useState('');
  
  // Estados do preview
  const [previewUrl, setPreviewUrl] = useState('');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  
  // Refs
  const editorRef = useRef(null);
  const chatInputRef = useRef(null);
  const terminalRef = useRef(null);
  const previewRef = useRef(null);

  // Handlers de redimensionamento
  const handleSidebarResize = useCallback((e) => {
    if (!isResizingSidebar) return;
    const newWidth = Math.max(200, Math.min(600, e.clientX));
    setSidebarWidth(newWidth);
  }, [isResizingSidebar]);

  const handleChatResize = useCallback((e) => {
    if (!isResizingChat) return;
    const containerWidth = window.innerWidth;
    const newWidth = Math.max(300, Math.min(800, containerWidth - e.clientX));
    setChatWidth(newWidth);
  }, [isResizingChat]);

  const handleBottomResize = useCallback((e) => {
    if (!isResizingBottom) return;
    const containerHeight = window.innerHeight;
    const newHeight = Math.max(150, Math.min(400, containerHeight - e.clientY));
    setBottomPanelHeight(newHeight);
  }, [isResizingBottom]);

  // Effect para eventos de mouse
  useEffect(() => {
    const handleMouseMove = (e) => {
      handleSidebarResize(e);
      handleChatResize(e);
      handleBottomResize(e);
    };

    const handleMouseUp = () => {
      setIsResizingSidebar(false);
      setIsResizingChat(false);
      setIsResizingBottom(false);
    };

    if (isResizingSidebar || isResizingChat || isResizingBottom) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingSidebar, isResizingChat, isResizingBottom, handleSidebarResize, handleChatResize, handleBottomResize]);

  // Configuração do editor Monaco
  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    
    monaco.editor.defineTheme('ide-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#1e1e1e',
        'editor.foreground': '#d4d4d4',
        'editorLineNumber.foreground': '#858585',
        'editor.selectionBackground': '#264f78',
        'editor.inactiveSelectionBackground': '#3a3d41'
      }
    });
    
    monaco.editor.setTheme(theme === 'dark' ? 'ide-dark' : 'vs');
  };

  // Handlers de arquivos
  const handleFileClick = (file) => {
    if (file.type === 'file') {
      onFileSelect?.(file);
    } else {
      toggleFolder(file.path);
    }
  };

  const toggleFolder = (folderPath) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderPath)) {
      newExpanded.delete(folderPath);
    } else {
      newExpanded.add(folderPath);
    }
    setExpandedFolders(newExpanded);
  };

  // Handler do chat
  const handleChatSubmit = (e) => {
    e.preventDefault();
    console.log("handleChatSubmit chamado com:", chatInput);
    console.log("onSendMessage existe:", !!onSendMessage);
    if (chatInput.trim()) {
      console.log("Enviando mensagem:", chatInput);
      onSendMessage?.(chatInput);
      setChatInput('');
    } else {
      console.log("Input vazio, não enviando");
    }
  };

  // Handler do terminal
  const handleTerminalSubmit = async (e) => {
    e.preventDefault();
    if (terminalInput.trim()) {
      const command = terminalInput.trim();
      setTerminalOutput(prev => [...prev, `$ ${command}`]);
      setTerminalInput('');
      
      try {
        // Executar comando via API do agente
        const response = await fetch('/agente/execute', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            projectId: currentProject?.id || 'default',
            command: command,
            options: {}
          })
        });
        
        const result = await response.json();
        
        if (result.success && result.result) {
          // Adicionar saída do comando
          if (result.result.stdout) {
            setTerminalOutput(prev => [...prev, result.result.stdout]);
          }
          if (result.result.stderr) {
            setTerminalOutput(prev => [...prev, `Error: ${result.result.stderr}`]);
          }
        } else {
          setTerminalOutput(prev => [...prev, `Error: ${result.error || 'Command failed'}`]);
        }
      } catch (error) {
        setTerminalOutput(prev => [...prev, `Error: ${error.message}`]);
      }
    }
  };

  // Handler do preview
  const handlePreviewRefresh = () => {
    if (previewRef.current) {
      setIsPreviewLoading(true);
      previewRef.current.src = previewRef.current.src;
      
      const handleLoad = () => {
        setIsPreviewLoading(false);
        previewRef.current.removeEventListener('load', handleLoad);
      };
      
      previewRef.current.addEventListener('load', handleLoad);
    }
  };

  const handlePreviewUrlChange = (url) => {
    setPreviewUrl(url);
    if (previewRef.current) {
      setIsPreviewLoading(true);
      previewRef.current.src = url;
    }
  };

  // Detectar se é um projeto web e definir URL padrão
  useEffect(() => {
    if (currentProject && !previewUrl) {
      // Verificar se existe index.html ou é um projeto web
      const hasIndexHtml = fileTree.some(file => 
        file.name === 'index.html' || 
        file.path?.includes('index.html')
      );
      
      const hasPackageJson = fileTree.some(file => 
        file.name === 'package.json' || 
        file.path?.includes('package.json')
      );
      
      if (hasIndexHtml) {
        // Para projetos HTML estáticos
        setPreviewUrl('http://localhost:5000/preview');
      } else if (hasPackageJson) {
        // Para projetos Node.js/React/Vue etc
        setPreviewUrl('http://localhost:3000');
      }
    }
  }, [currentProject, fileTree, previewUrl]);

  // Renderização da árvore de arquivos
  const renderFileTree = (items, level = 0) => {
    return items.map((item, index) => (
      <div key={item.path || index} className="file-tree-item" style={{ paddingLeft: `${level * 16 + 8}px` }}>
        <div
          className={`file-tree-node ${item.type === 'file' ? 'file' : 'folder'} ${
            activeTab === item.path ? 'active' : ''
          }`}
          onClick={() => handleFileClick(item)}
        >
          <span className="file-icon">
          {item.type === 'folder' ? (
            expandedFolders.has(item.path) ? <FaFolderOpen /> : <FaFolder />
          ) : (
            <FaFile />
          )}
        </span>
          <span className="file-name">{item.name}</span>
        </div>
        {item.type === 'folder' && expandedFolders.has(item.path) && item.children && (
          <div className="folder-children">
            {renderFileTree(item.children, level + 1)}
          </div>
        )}
      </div>
    ));
  };

  return (
    <div className={`ide-layout ${theme}`}>
      {/* Sidebar Esquerda */}
      <div 
        className={`ide-sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}
        style={{ width: isSidebarCollapsed ? '48px' : `${sidebarWidth}px` }}
      >
        {/* Menu Superior da Sidebar */}
        <div className="sidebar-header">
          <div className="sidebar-tabs">
            <button
              className={`sidebar-tab ${activeSidebarTab === 'explorer' ? 'active' : ''}`}
              onClick={() => setActiveSidebarTab('explorer')}
              title="Explorer"
            >
              <FaFolder />
            </button>
            <button
              className={`sidebar-tab ${activeSidebarTab === 'search' ? 'active' : ''}`}
              onClick={() => setActiveSidebarTab('search')}
              title="Search"
            >
              <FaSearch />
            </button>
            <button
              className={`sidebar-tab ${activeSidebarTab === 'git' ? 'active' : ''}`}
              onClick={() => setActiveSidebarTab('git')}
              title="Controle de Versão"
            >
              <FaCodeBranch />
            </button>
          </div>
          <div className="sidebar-actions">
            <button className="action-btn" onClick={onOpenFolder} title="Abrir Pasta">
              <FaFolder />
            </button>
            <button className="action-btn" onClick={onCloneRepository} title="Clonar Repositório">
              <FaDownload />
            </button>
            <button 
              className="collapse-btn"
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            >
              {isSidebarCollapsed ? <FaChevronRight /> : <FaChevronLeft />}
            </button>
          </div>
        </div>

        {/* Conteúdo da Sidebar */}
        {!isSidebarCollapsed && (
          <div className="sidebar-content">
            {activeSidebarTab === 'explorer' && (
              <div className="explorer-panel">
                <div className="panel-title">
                  <span>EXPLORADOR</span>
                  <div className="panel-actions">
                    <button className="panel-action" onClick={onCreateFile} title="Novo Arquivo">
              <FaFile />
            </button>
            <button className="panel-action" onClick={onCreateFolder} title="Nova Pasta">
              <FaFolder />
            </button>
                  </div>
                </div>
                <div className="file-tree">
                  {currentProject ? (
                    <div className="project-root">
                      <div className="project-name">{currentProject.name}</div>
                      {renderFileTree(fileTree)}
                    </div>
                  ) : (
                    <div className="no-project">
                      <p>Nenhuma pasta aberta</p>
                      <button onClick={onOpenFolder}>Abrir Pasta</button>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {activeSidebarTab === 'search' && (
              <div className="search-panel">
                <div className="panel-title">BUSCAR</div>
                <input 
                  type="text" 
                  placeholder="Buscar arquivos..." 
                  className="search-input"
                />
              </div>
            )}
            
            {activeSidebarTab === 'git' && (
              <div className="git-panel">
                <div className="panel-title">CONTROLE DE VERSÃO</div>
                <div className="git-status">
                  <p>Nenhuma alteração</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Divisor da Sidebar */}
      <div
        className="resize-handle sidebar-resize"
        onMouseDown={() => setIsResizingSidebar(true)}
      />

      {/* Área Central */}
      <div className="ide-main">
        {/* Editor com Abas */}
        <div className="editor-area">
          {/* Barra de Abas */}
          <div className="tab-bar">
            {openTabs.map((tab) => (
              <div
                key={tab.path}
                className={`tab ${activeTab === tab.path ? 'active' : ''}`}
                onClick={() => onTabSwitch?.(tab.path)}
              >
                <span className="tab-icon"><FaFile /></span>
                <span className="tab-name">{tab.name}</span>
                <button
                  className="tab-close"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTabClose?.(tab.path);
                  }}
                >
                  ×
                </button>
              </div>
            ))}
            
            {/* Preview Tab */}
            <div
              className={`tab preview-tab ${activeTab === 'preview' ? 'active' : ''}`}
              onClick={() => onTabSwitch?.('preview')}
            >
              <span className="tab-icon"><FaEye /></span>
              <span className="tab-name">Preview</span>
            </div>
            
            {openTabs.length === 0 && activeTab !== 'preview' && (
              <div className="tab placeholder">
                <span>Nenhum arquivo aberto</span>
              </div>
            )}
          </div>

          {/* Editor */}
          <div className="editor-container">
            {activeTab === 'preview' ? (
              <div className="preview-panel-main">
                <div className="preview-toolbar">
                  <button 
                    onClick={() => {
                      const iframe = document.querySelector('.preview-iframe');
                      if (iframe && iframe.contentWindow) {
                        iframe.contentWindow.history.back();
                      }
                    }}
                    className="preview-nav-btn"
                    title="Voltar"
                  >
                    <FaArrowLeft />
                  </button>
                  <button 
                    onClick={() => {
                      const iframe = document.querySelector('.preview-iframe');
                      if (iframe && iframe.contentWindow) {
                        iframe.contentWindow.history.forward();
                      }
                    }}
                    className="preview-nav-btn"
                    title="Avançar"
                  >
                    <FaArrowRight />
                  </button>
                  <button 
                    onClick={() => {
                      const iframe = document.querySelector('.preview-iframe');
                      if (iframe) {
                        iframe.src = iframe.src;
                      }
                    }}
                    className="preview-nav-btn"
                    title="Recarregar"
                  >
                    <FaRedo />
                  </button>
                  <input
                    type="url"
                    value={previewUrl}
                    onChange={(e) => handlePreviewUrlChange(e.target.value)}
                    placeholder="Digite uma URL para visualizar (ex: http://localhost:3000)..."
                    className="preview-url-input"
                  />
                  {previewUrl && (
                    <a 
                      href={previewUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="external-link-btn"
                      title="Abrir em nova aba"
                    >
                      <FaExternalLinkAlt />
                    </a>
                  )}
                </div>
                <div className="preview-content">
                  {previewUrl ? (
                    <iframe
                      src={previewUrl}
                      title="Visualização ao Vivo"
                      className="preview-iframe"
                      sandbox="allow-scripts allow-same-origin allow-forms"
                    />
                  ) : (
                    <div className="preview-placeholder">
                      <div className="preview-placeholder-icon"><FaDesktop /></div>
                      <h3>Visualização ao Vivo</h3>
                      <p>Digite uma URL acima para visualizar sua aplicação</p>
                      <p>URLs comuns de desenvolvimento:</p>
                      <ul>
                        <li>http://localhost:3000 (React/Node.js)</li>
                        <li>http://localhost:5173 (Vite)</li>
                        <li>http://localhost:8080 (Vue/Webpack)</li>
                        <li>http://localhost:5000 (Express/Flask)</li>
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ) : activeTab && fileContents[activeTab] !== undefined ? (
              <Editor
                height="100%"
                language="javascript"
                value={fileContents[activeTab]}
                onChange={(value) => onFileChange?.(activeTab, value)}
                onMount={handleEditorDidMount}
                theme={theme === 'dark' ? 'ide-dark' : 'vs'}
                options={{
                  minimap: { enabled: true },
                  fontSize: 14,
                  lineNumbers: 'on',
                  wordWrap: 'on',
                  automaticLayout: true,
                }}
              />
            ) : (
              <div className="editor-welcome">
                <h2>Bem-vindo ao IDE</h2>
                <p>Abra um arquivo para começar a editar ou clique na aba Preview para visualizar sua aplicação</p>
              </div>
            )}
          </div>
        </div>

        {/* Divisor do Painel Inferior */}
        <div
          className="resize-handle bottom-resize"
          onMouseDown={() => setIsResizingBottom(true)}
        />

        {/* Painel Inferior */}
        <div 
          className={`bottom-panel ${isBottomPanelCollapsed ? 'collapsed' : ''}`}
          style={{ height: isBottomPanelCollapsed ? '32px' : `${bottomPanelHeight}px` }}
        >
          {/* Abas do Painel Inferior */}
          <div className="bottom-tabs">
            <button
              className={`bottom-tab ${activeBottomTab === 'terminal' ? 'active' : ''}`}
              onClick={() => setActiveBottomTab('terminal')}
            >
              Terminal
            </button>
            <button
              className={`bottom-tab ${activeBottomTab === 'console' ? 'active' : ''}`}
              onClick={() => setActiveBottomTab('console')}
            >
              Console
            </button>
            <button 
              className="panel-collapse"
              onClick={() => setIsBottomPanelCollapsed(!isBottomPanelCollapsed)}
            >
              {isBottomPanelCollapsed ? <FaChevronUp /> : <FaChevronDown />}
            </button>
          </div>

          {/* Conteúdo do Painel Inferior */}
          {!isBottomPanelCollapsed && (
            <div className="bottom-content">
              {activeBottomTab === 'terminal' && (
                <div className="terminal-panel">
                  <div className="terminal-output" ref={terminalRef}>
                    {terminalOutput.map((line, index) => (
                      <div key={index} className="terminal-line">{line}</div>
                    ))}
                  </div>
                  <form onSubmit={handleTerminalSubmit} className="terminal-input-form">
                    <span className="terminal-prompt">$</span>
                    <input
                      type="text"
                      value={terminalInput}
                      onChange={(e) => setTerminalInput(e.target.value)}
                      className="terminal-input"
                      placeholder="Digite um comando..."
                    />
                  </form>
                </div>
              )}
              
              {activeBottomTab === 'console' && (
                <div className="console-panel">
                  <div className="console-output">
                    <div className="console-line">A saída do console aparecerá aqui</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Divisor do Chat */}
      <div
        className="resize-handle chat-resize"
        onMouseDown={() => setIsResizingChat(true)}
      />

      {/* Chat Lateral Direito */}
      <div 
        className={`ide-chat ${isChatCollapsed ? 'collapsed' : ''}`}
        style={{ width: isChatCollapsed ? '48px' : `${chatWidth}px` }}
      >
        <div className="chat-header">
          <h3>Assistente IA</h3>
          <button 
            className="chat-collapse"
            onClick={() => setIsChatCollapsed(!isChatCollapsed)}
          >
            {isChatCollapsed ? <FaChevronLeft /> : <FaChevronRight />}
          </button>
        </div>

        {!isChatCollapsed && (
          <>
            <div className="chat-messages">
              {chatMessages.map((message, index) => (
                <div key={index} className={`message ${message.role}`}>
                  <div className="message-content">{message.content}</div>
                </div>
              ))}
              {isLoading && (
                <div className="message assistant loading">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleChatSubmit} className="chat-input-form">
              <textarea
                ref={chatInputRef}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Pergunte sobre seu código..."
                className="chat-input"
                rows={3}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleChatSubmit(e);
                  }
                }}
              />
              <button type="submit" className="chat-send" disabled={!chatInput.trim()}>
                Enviar
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default IDELayout;