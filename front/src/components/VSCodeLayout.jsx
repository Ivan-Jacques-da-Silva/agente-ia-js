import React, { useState, useRef, useEffect } from 'react';
import './VSCodeLayout.css';
import FileExplorer from './FileExplorer';
import EditorTabs from './EditorTabs';
import CodeEditor from './CodeEditor';
import ChatPanel from './ChatPanel';
import WelcomeScreen from './WelcomeScreen';
import FolderPicker from './FolderPicker';

export function VSCodeLayout({
  currentProject,
  fileTree,
  openTabs,
  activeTab,
  fileContents,
  chatMessages,
  isLoading,
  theme,
  onOpenFolder,
  onCreateProject,
  onCloneRepository,
  onFileSelect,
  onFileChange,
  onTabClose,
  onTabSwitch,
  onSendMessage,
  onThemeToggle
}) {
  const [sidebarWidth, setSidebarWidth] = useState(250);
  const [chatWidth, setChatWidth] = useState(350);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isChatVisible, setIsChatVisible] = useState(true);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isResizingChat, setIsResizingChat] = useState(false);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  
  const sidebarRef = useRef(null);
  const chatRef = useRef(null);

  // Redimensionamento da sidebar
  const handleSidebarResize = (e) => {
    if (!isResizingSidebar) return;
    const newWidth = Math.max(200, Math.min(600, e.clientX));
    setSidebarWidth(newWidth);
  };

  // Redimensionamento do chat
  const handleChatResize = (e) => {
    if (!isResizingChat) return;
    const containerWidth = window.innerWidth;
    const newWidth = Math.max(300, Math.min(800, containerWidth - e.clientX));
    setChatWidth(newWidth);
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      handleSidebarResize(e);
      handleChatResize(e);
    };

    const handleMouseUp = () => {
      setIsResizingSidebar(false);
      setIsResizingChat(false);
    };

    if (isResizingSidebar || isResizingChat) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingSidebar, isResizingChat]);

  const handleOpenFolder = () => {
    setShowFolderPicker(true);
  };

  const handleFolderSelected = (folderData) => {
    setShowFolderPicker(false);
    if (onOpenFolder) {
      onOpenFolder(folderData);
    }
  };

  return (
    <div className={`vscode-layout ${theme}`} data-theme={theme}>
      {/* Barra de Título */}
      <div className="title-bar">
        <div className="title-bar-left">
          <div className="window-controls">
            <div className="window-control minimize"></div>
            <div className="window-control maximize"></div>
            <div className="window-control close"></div>
          </div>
        </div>
        <div className="title-bar-center">
          <span className="app-title">
            {currentProject ? `${currentProject.nome} - Agente IA` : 'Agente IA'}
          </span>
        </div>
        <div className="title-bar-right">
          <button 
            className="title-bar-btn"
            onClick={onThemeToggle}
            title="Alternar tema"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </div>

      {/* Layout Principal */}
      <div className="main-layout">
        {/* Barra de Atividades */}
        <div className="activity-bar">
          <div className="activity-items">
            <button 
              className={`activity-item ${!isSidebarCollapsed ? 'active' : ''}`}
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              title="Explorer"
            >
              📁
            </button>
            <button 
              className="activity-item"
              onClick={handleOpenFolder}
              title="Abrir pasta"
            >
              📂
            </button>
            <button 
              className={`activity-item ${isChatVisible ? 'active' : ''}`}
              onClick={() => setIsChatVisible(!isChatVisible)}
              title="Chat"
            >
              💬
            </button>
          </div>
        </div>

        {/* Sidebar */}
        {!isSidebarCollapsed && (
          <>
            <div 
              className="sidebar"
              ref={sidebarRef}
              style={{ width: sidebarWidth }}
            >
              <FileExplorer
                currentProject={currentProject}
                fileTree={fileTree}
                onFileSelect={onFileSelect}
                onCreateFile={(path, name) => {/* Implementar */}}
                onCreateFolder={(path, name) => {/* Implementar */}}
                onDeleteItem={(path) => {/* Implementar */}}
                onRenameItem={(path, newName) => {/* Implementar */}}
              />
            </div>
            <div 
              className="sidebar-resizer"
              onMouseDown={() => setIsResizingSidebar(true)}
            />
          </>
        )}

        {/* Área do Editor */}
        <div className="editor-area">
          {!currentProject ? (
            <WelcomeScreen
              onOpenFolder={handleFolderSelected}
              onCreateProject={onCreateProject}
              onCloneRepository={onCloneRepository}
            />
          ) : (
            <>
              <EditorTabs
                tabs={openTabs || []}
                activeTab={activeTab}
                onTabSwitch={onTabSwitch}
                onTabClose={onTabClose}
              />
              <CodeEditor
                file={openTabs?.find(tab => tab.id === activeTab)}
                content={fileContents}
                onChange={onFileChange}
                theme={theme}
              />
            </>
          )}
        </div>

        {/* Chat Panel */}
        {isChatVisible && (
          <>
            <div 
              className="chat-resizer"
              onMouseDown={() => setIsResizingChat(true)}
            />
            <div 
              className="chat-panel-container"
              ref={chatRef}
              style={{ width: chatWidth }}
            >
              <ChatPanel
                isVisible={isChatVisible}
                onToggle={() => setIsChatVisible(false)}
                currentProject={currentProject}
                chatMessages={chatMessages || []}
                onSendMessage={onSendMessage}
                isLoading={isLoading}
              />
            </div>
          </>
        )}
      </div>

      {/* Barra de Status */}
      <div className="status-bar">
        <div className="status-left">
          {currentProject && (
            <>
              <span className="status-item">📁 {currentProject.nome}</span>
              <span className="status-item">
                {openTabs?.length || 0} arquivo(s) aberto(s)
              </span>
            </>
          )}
        </div>
        <div className="status-right">
          <span className="status-item">{theme === 'dark' ? 'Escuro' : 'Claro'}</span>
          <span className="status-item">Agente IA</span>
        </div>
      </div>

      {/* Folder Picker Modal */}
      {showFolderPicker && (
        <FolderPicker
          onFolderSelected={handleFolderSelected}
          onCancel={() => setShowFolderPicker(false)}
        />
      )}
    </div>
  );
}

export default VSCodeLayout;