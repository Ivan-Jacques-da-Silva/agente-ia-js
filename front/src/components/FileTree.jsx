import React, { useState, useCallback, useMemo } from 'react';
import { 
  FaChevronRight, 
  FaChevronDown, 
  FaFolder, 
  FaFolderOpen, 
  FaFile,
  FaJs,
  FaHtml5,
  FaCss3Alt,
  FaReact,
  FaMarkdown,
  FaCog,
  FaImage,
  FaFileCode,
  FaDatabase,
  FaGitAlt,
  FaNodeJs,
  FaVuejs,
  FaSass
} from 'react-icons/fa';
import { 
  SiTypescript, 
  SiJavascript, 
  SiReact, 
  SiVite, 
  SiEslint,
  SiPrettier,
  SiTailwindcss,
  SiJson
} from 'react-icons/si';
import './FileTree.css';

// Ícones por tipo de arquivo - mais específicos como no VS Code
const getFileIcon = (fileName) => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  const fullName = fileName.toLowerCase();
  
  // Arquivos específicos
  if (fullName === 'package.json') return <SiJson className="file-icon package-json" />;
  if (fullName === 'package-lock.json') return <SiJson className="file-icon package-lock" />;
  if (fullName === 'vite.config.js') return <SiVite className="file-icon vite" />;
  if (fullName === '.eslintrc.js' || fullName === '.eslintrc.json') return <SiEslint className="file-icon eslint" />;
  if (fullName === '.prettierrc') return <SiPrettier className="file-icon prettier" />;
  if (fullName === 'tailwind.config.js') return <SiTailwindcss className="file-icon tailwind" />;
  if (fullName === '.gitignore' || fullName === '.gitattributes') return <FaGitAlt className="file-icon git" />;
  if (fullName.includes('readme')) return <FaMarkdown className="file-icon readme" />;
  
  switch (ext) {
    case 'js':
      return <SiJavascript className="file-icon js" />;
    case 'jsx':
      return <SiReact className="file-icon jsx" />;
    case 'ts':
      return <SiTypescript className="file-icon ts" />;
    case 'tsx':
      return <SiReact className="file-icon tsx" />;
    case 'html':
      return <FaHtml5 className="file-icon html" />;
    case 'css':
      return <FaCss3Alt className="file-icon css" />;
    case 'scss':
    case 'sass':
      return <FaSass className="file-icon scss" />;
    case 'json':
      return <SiJson className="file-icon json" />;
    case 'md':
    case 'markdown':
      return <FaMarkdown className="file-icon md" />;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
      return <FaImage className="file-icon img" />;
    case 'txt':
      return <FaFileCode className="file-icon txt" />;
    case 'sql':
      return <FaDatabase className="file-icon sql" />;
    case 'vue':
      return <FaVuejs className="file-icon vue" />;
    default:
      return <FaFile className="file-icon default" />;
  }
};

const FileTreeItem = ({ 
  item, 
  level = 0, 
  expandedFolders, 
  onToggleFolder, 
  onFileClick, 
  activeFile 
}) => {
  const isFolder = item.type === 'folder';
  const isExpanded = expandedFolders.has(item.path);
  const hasChildren = isFolder && item.children && item.children.length > 0;
  const isActive = activeFile === item.path;

  const handleClick = useCallback(() => {
    if (isFolder) {
      onToggleFolder(item.path);
    } else {
      onFileClick(item.path);
    }
  }, [isFolder, item.path, onToggleFolder, onFileClick]);

  const handleChevronClick = useCallback((e) => {
    e.stopPropagation();
    if (isFolder) {
      onToggleFolder(item.path);
    }
  }, [isFolder, item.path, onToggleFolder]);

  return (
    <div className="file-tree-item">
      <div
        className={`file-tree-node ${isFolder ? 'folder' : 'file'} ${isActive ? 'active' : ''}`}
        style={{ paddingLeft: `${level * 16}px` }}
        onClick={handleClick}
      >
        <div className="file-tree-content">
          {/* Chevron simplificado para pastas */}
          {isFolder && hasChildren && (
            <span 
              className="folder-chevron"
              onClick={handleChevronClick}
            >
              {isExpanded ? <FaChevronDown /> : <FaChevronRight />}
            </span>
          )}
          
          {/* Espaçamento uniforme para todos os itens */}
          {(!isFolder || !hasChildren) && (
            <span className="file-indent"></span>
          )}
          
          <span className="file-icon-container">
            {isFolder ? (
              isExpanded ? <FaFolderOpen className="folder-icon open" /> : <FaFolder className="folder-icon closed" />
            ) : (
              getFileIcon(item.name)
            )}
          </span>
          
          <span className="file-name">{item.name}</span>
        </div>
      </div>
      
      {isFolder && isExpanded && hasChildren && (
        <div className="folder-children">
          {item.children.map((child, index) => (
            <FileTreeItem
              key={child.path || `${item.path}-${index}`}
              item={child}
              level={level + 1}
              expandedFolders={expandedFolders}
              onToggleFolder={onToggleFolder}
              onFileClick={onFileClick}
              activeFile={activeFile}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const FileTree = ({ 
  fileTree, 
  onFileClick, 
  activeFile, 
  currentProject,
  onOpenFolder 
}) => {
  const [expandedFolders, setExpandedFolders] = useState(new Set());

  const handleToggleFolder = useCallback((folderPath) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderPath)) {
        newSet.delete(folderPath);
      } else {
        newSet.add(folderPath);
      }
      return newSet;
    });
  }, []);

  // Expandir automaticamente a pasta raiz quando um projeto é carregado
  React.useEffect(() => {
    if (currentProject && fileTree.length > 0) {
      setExpandedFolders(new Set([currentProject.name]));
    }
  }, [currentProject, fileTree]);

  if (!currentProject) {
    return (
      <div className="file-tree-empty">
        <div className="empty-state">
          <FaFolder className="empty-icon" />
          <p>Nenhuma pasta aberta</p>
          <button className="open-folder-btn" onClick={onOpenFolder}>
            <FaFolder className="btn-icon" />
            Abrir Pasta
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="file-tree">
      <div className="project-root">
        <div className="project-header">
          <FaFolderOpen className="project-icon" />
          <span className="project-name">{currentProject.name}</span>
        </div>
        
        <div className="file-tree-content">
          {fileTree.map((item, index) => (
            <FileTreeItem
              key={item.path || index}
              item={item}
              level={0}
              expandedFolders={expandedFolders}
              onToggleFolder={handleToggleFolder}
              onFileClick={onFileClick}
              activeFile={activeFile}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default FileTree;