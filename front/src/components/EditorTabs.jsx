import React, { useCallback, useRef, useState } from 'react';
import './EditorTabs.css';

function TabIcon({ arquivo }) {
  const getIcon = () => {
    if (!arquivo.nome) return 'fas fa-file';
    
    const ext = arquivo.nome.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'js':
      case 'jsx':
        return 'fab fa-js-square';
      case 'ts':
      case 'tsx':
        return 'fas fa-code';
      case 'css':
        return 'fab fa-css3-alt';
      case 'html':
        return 'fab fa-html5';
      case 'json':
        return 'fas fa-brackets-curly';
      case 'md':
        return 'fab fa-markdown';
      case 'py':
        return 'fab fa-python';
      case 'java':
        return 'fab fa-java';
      case 'php':
        return 'fab fa-php';
      case 'xml':
        return 'fas fa-code';
      case 'yml':
      case 'yaml':
        return 'fas fa-file-code';
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'svg':
        return 'fas fa-image';
      case 'pdf':
        return 'fas fa-file-pdf';
      case 'txt':
        return 'fas fa-file-alt';
      default:
        return 'fas fa-file';
    }
  };

  return <i className={`tab-icon ${getIcon()}`} />;
}

export function EditorTabs({ 
  abas = [], 
  abaAtiva, 
  onAbaChange, 
  onFecharAba,
  onFecharTodasAbas,
  onFecharOutrasAbas 
}) {
  const [draggedTab, setDraggedTab] = useState(null);
  const [dragOverTab, setDragOverTab] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const tabsContainerRef = useRef(null);

  const handleTabClick = useCallback((abaId) => {
    onAbaChange?.(abaId);
  }, [onAbaChange]);

  const handleCloseClick = useCallback((e, abaId) => {
    e.stopPropagation();
    onFecharAba?.(abaId);
  }, [onFecharAba]);

  const handleContextMenu = useCallback((e, aba) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      aba
    });
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleContextAction = useCallback((action) => {
    if (!contextMenu) return;
    
    const { aba } = contextMenu;
    
    switch (action) {
      case 'fechar':
        onFecharAba?.(aba.id);
        break;
      case 'fechar-outras':
        onFecharOutrasAbas?.(aba.id);
        break;
      case 'fechar-todas':
        onFecharTodasAbas?.();
        break;
      case 'fechar-direita':
        // Implementar lógica para fechar abas à direita
        break;
    }
    
    setContextMenu(null);
  }, [contextMenu, onFecharAba, onFecharOutrasAbas, onFecharTodasAbas]);

  // Drag and Drop handlers
  const handleDragStart = useCallback((e, aba) => {
    setDraggedTab(aba);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e, aba) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverTab(aba);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverTab(null);
  }, []);

  const handleDrop = useCallback((e, targetAba) => {
    e.preventDefault();
    
    if (draggedTab && targetAba && draggedTab.id !== targetAba.id) {
      // Implementar reordenação das abas
      // onReorderTabs?.(draggedTab.id, targetAba.id);
    }
    
    setDraggedTab(null);
    setDragOverTab(null);
  }, [draggedTab]);

  const handleDragEnd = useCallback(() => {
    setDraggedTab(null);
    setDragOverTab(null);
  }, []);

  if (!abas || abas.length === 0) {
    return null;
  }

  return (
    <div className="editor-tabs">
      <div 
        className="tabs-container"
        ref={tabsContainerRef}
      >
        {abas.map((aba) => (
          <div
            key={aba.id}
            className={`editor-tab ${abaAtiva === aba.id ? 'active' : ''} ${
              dragOverTab?.id === aba.id ? 'drag-over' : ''
            }`}
            onClick={() => handleTabClick(aba.id)}
            onContextMenu={(e) => handleContextMenu(e, aba)}
            draggable
            onDragStart={(e) => handleDragStart(e, aba)}
            onDragOver={(e) => handleDragOver(e, aba)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, aba)}
            onDragEnd={handleDragEnd}
          >
            <TabIcon arquivo={aba} />
            <span className="tab-label" title={aba.path}>
              {aba.nome}
            </span>
            {aba.dirty && (
              <span className="tab-dirty-indicator" title="Arquivo modificado">
                ●
              </span>
            )}
            <button
              className="tab-close-button"
              onClick={(e) => handleCloseClick(e, aba.id)}
              title="Fechar aba"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
        ))}
      </div>

      {/* Scroll buttons for when there are too many tabs */}
      {abas.length > 10 && (
        <div className="tabs-scroll-controls">
          <button 
            className="tabs-scroll-button"
            onClick={() => {
              if (tabsContainerRef.current) {
                tabsContainerRef.current.scrollLeft -= 100;
              }
            }}
          >
            <i className="fas fa-chevron-left"></i>
          </button>
          <button 
            className="tabs-scroll-button"
            onClick={() => {
              if (tabsContainerRef.current) {
                tabsContainerRef.current.scrollLeft += 100;
              }
            }}
          >
            <i className="fas fa-chevron-right"></i>
          </button>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div 
            className="context-menu-overlay"
            onClick={handleCloseContextMenu}
          />
          <div 
            className="context-menu"
            style={{ 
              left: contextMenu.x, 
              top: contextMenu.y 
            }}
          >
            <div 
              className="context-menu-item"
              onClick={() => handleContextAction('fechar')}
            >
              <i className="fas fa-times"></i>
              Fechar
            </div>
            <div 
              className="context-menu-item"
              onClick={() => handleContextAction('fechar-outras')}
            >
              <i className="fas fa-times-circle"></i>
              Fechar Outras
            </div>
            <div 
              className="context-menu-item"
              onClick={() => handleContextAction('fechar-todas')}
            >
              <i className="fas fa-ban"></i>
              Fechar Todas
            </div>
            <div className="context-menu-separator" />
            <div 
              className="context-menu-item"
              onClick={() => handleContextAction('fechar-direita')}
            >
              <i className="fas fa-arrow-right"></i>
              Fechar à Direita
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default EditorTabs;