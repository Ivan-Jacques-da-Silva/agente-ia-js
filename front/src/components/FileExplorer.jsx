import React, { useState, useCallback } from 'react';
import './FileExplorer.css';

function FileIcon({ tipo, nome }) {
  const getIcon = () => {
    if (tipo === 'dir') return 'fas fa-folder';
    
    const ext = nome.split('.').pop()?.toLowerCase();
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

  return <i className={`file-icon ${getIcon()}`} />;
}

function FileTreeNode({ 
  node, 
  level = 0, 
  expandedDirs, 
  onToggleDir, 
  onAbrirArquivo,
  onContextMenu 
}) {
  const isExpanded = expandedDirs[node.fullPath];
  const hasChildren = node.children && Object.keys(node.children).length > 0;

  const handleClick = useCallback(() => {
    if (node.tipo === 'dir') {
      onToggleDir(node.fullPath);
    } else {
      onAbrirArquivo(node);
    }
  }, [node, onToggleDir, onAbrirArquivo]);

  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
    onContextMenu?.(e, node);
  }, [node, onContextMenu]);

  return (
    <div className="file-tree-node">
      <div 
        className={`file-tree-item ${node.tipo === 'dir' ? 'is-directory' : 'is-file'}`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        {node.tipo === 'dir' && (
          <i 
            className={`file-tree-arrow fas fa-chevron-${isExpanded ? 'down' : 'right'}`}
          />
        )}
        <FileIcon tipo={node.tipo} nome={node.nome} />
        <span className="file-tree-label">{node.nome}</span>
      </div>
      
      {node.tipo === 'dir' && isExpanded && hasChildren && (
        <div className="file-tree-children">
          {Object.values(node.children)
            .sort((a, b) => {
              // Diretórios primeiro, depois arquivos
              if (a.tipo === 'dir' && b.tipo !== 'dir') return -1;
              if (a.tipo !== 'dir' && b.tipo === 'dir') return 1;
              return a.nome.localeCompare(b.nome);
            })
            .map((child) => (
              <FileTreeNode
                key={child.fullPath}
                node={child}
                level={level + 1}
                expandedDirs={expandedDirs}
                onToggleDir={onToggleDir}
                onAbrirArquivo={onAbrirArquivo}
                onContextMenu={onContextMenu}
              />
            ))}
        </div>
      )}
    </div>
  );
}

export default FileExplorer;

export function FileExplorer({ 
  arvore, 
  onAbrirArquivo, 
  projeto,
  onCriarArquivo,
  onCriarPasta,
  onRenomear,
  onExcluir
}) {
  const [expandedDirs, setExpandedDirs] = useState({});
  const [contextMenu, setContextMenu] = useState(null);

  const handleToggleDir = useCallback((path) => {
    setExpandedDirs(prev => ({
      ...prev,
      [path]: !prev[path]
    }));
  }, []);

  const handleContextMenu = useCallback((e, node) => {
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      node
    });
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleContextAction = useCallback((action) => {
    if (!contextMenu) return;
    
    const { node } = contextMenu;
    
    switch (action) {
      case 'criar-arquivo':
        onCriarArquivo?.(node.tipo === 'dir' ? node.fullPath : node.fullPath.split('/').slice(0, -1).join('/'));
        break;
      case 'criar-pasta':
        onCriarPasta?.(node.tipo === 'dir' ? node.fullPath : node.fullPath.split('/').slice(0, -1).join('/'));
        break;
      case 'renomear':
        onRenomear?.(node);
        break;
      case 'excluir':
        onExcluir?.(node);
        break;
    }
    
    setContextMenu(null);
  }, [contextMenu, onCriarArquivo, onCriarPasta, onRenomear, onExcluir]);

  // Construir árvore estruturada
  const arvoreEstruturada = React.useMemo(() => {
    if (!Array.isArray(arvore)) return [];
    
    const root = { children: {} };

    const ensureDir = (parent, part, fullPath) => {
      if (!parent.children[part]) {
        parent.children[part] = { 
          nome: part, 
          tipo: "dir", 
          fullPath, 
          children: {} 
        };
      }
      return parent.children[part];
    };

    for (const item of arvore) {
      if (!item || !item.path) continue;
      const partes = item.path.split("/");
      let cursor = root;

      partes.forEach((parte, idx) => {
        const atualPath = partes.slice(0, idx + 1).join("/");
        const ultimo = idx === partes.length - 1;

        if (ultimo) {
          if (item.tipo === "dir") {
            const dir = ensureDir(cursor, parte, atualPath);
            dir.tipo = "dir";
          } else {
            cursor.children[parte] = { 
              nome: parte, 
              tipo: item.tipo || "file", 
              fullPath: item.path 
            };
          }
        } else {
          cursor = ensureDir(cursor, parte, atualPath);
        }
      });
    }

    return Object.values(root.children);
  }, [arvore]);

  return (
    <div className="file-explorer">
      <div className="file-explorer-content">
        {projeto ? (
          <div className="project-info">
            <div className="project-name">
              <i className="fas fa-folder-open"></i>
              {projeto.nome}
            </div>
            {projeto.caminho_local && (
              <div className="project-path" title={projeto.caminho_local}>
                {projeto.caminho_local}
              </div>
            )}
          </div>
        ) : (
          <div className="no-project">
            <p>Nenhum projeto aberto</p>
          </div>
        )}

        <div className="file-tree">
          {arvoreEstruturada.length > 0 ? (
            arvoreEstruturada.map((node) => (
              <FileTreeNode
                key={node.fullPath}
                node={node}
                expandedDirs={expandedDirs}
                onToggleDir={handleToggleDir}
                onAbrirArquivo={onAbrirArquivo}
                onContextMenu={handleContextMenu}
              />
            ))
          ) : (
            <div className="empty-tree">
              <p>Pasta vazia</p>
            </div>
          )}
        </div>
      </div>

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
              onClick={() => handleContextAction('criar-arquivo')}
            >
              <i className="fas fa-file-plus"></i>
              Novo Arquivo
            </div>
            <div 
              className="context-menu-item"
              onClick={() => handleContextAction('criar-pasta')}
            >
              <i className="fas fa-folder-plus"></i>
              Nova Pasta
            </div>
            <div className="context-menu-separator" />
            <div 
              className="context-menu-item"
              onClick={() => handleContextAction('renomear')}
            >
              <i className="fas fa-edit"></i>
              Renomear
            </div>
            <div 
              className="context-menu-item danger"
              onClick={() => handleContextAction('excluir')}
            >
              <i className="fas fa-trash"></i>
              Excluir
            </div>
          </div>
        </>
      )}
    </div>
  );
}