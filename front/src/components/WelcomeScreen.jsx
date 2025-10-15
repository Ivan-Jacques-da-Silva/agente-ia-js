import React, { useState } from 'react';
import { FolderPicker, NewProjectDialog } from './FolderPicker';
import './WelcomeScreen.css';

export function WelcomeScreen({ 
  onOpenFolder, 
  onCreateProject, 
  onCloneRepository,
  recentProjects = [] 
}) {
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [showCloneDialog, setShowCloneDialog] = useState(false);

  const handleOpenFolder = () => {
    setShowFolderPicker(true);
  };

  const handleCreateProject = () => {
    setShowNewProject(true);
  };

  const handleCloneRepository = () => {
    setShowCloneDialog(true);
  };

  const handleFolderSelected = (folderData) => {
    setShowFolderPicker(false);
    onOpenFolder?.(folderData);
  };

  const handleProjectCreated = (projectData) => {
    setShowNewProject(false);
    onCreateProject?.(projectData);
  };

  const handleRepositoryCloned = (repoData) => {
    setShowCloneDialog(false);
    onCloneRepository?.(repoData);
  };

  return (
    <div className="welcome-screen">
      <div className="welcome-content">
        <div className="welcome-header">
          <div className="logo-section">
            <i className="fas fa-code"></i>
            <h1>Agente IA</h1>
            <p>Editor de código inteligente</p>
          </div>
        </div>

        <div className="welcome-main">
          <div className="quick-actions">
            <h2>Começar</h2>
            <div className="action-cards">
              <div className="action-card" onClick={handleCreateProject}>
                <div className="card-icon">
                  <i className="fas fa-plus"></i>
                </div>
                <div className="card-content">
                  <h3>Novo Projeto</h3>
                  <p>Criar um novo projeto do zero</p>
                </div>
                <div className="card-arrow">
                  <i className="fas fa-chevron-right"></i>
                </div>
              </div>

              <div className="action-card" onClick={handleOpenFolder}>
                <div className="card-icon">
                  <i className="fas fa-folder-open"></i>
                </div>
                <div className="card-content">
                  <h3>Abrir Pasta</h3>
                  <p>Abrir uma pasta existente</p>
                </div>
                <div className="card-arrow">
                  <i className="fas fa-chevron-right"></i>
                </div>
              </div>

              <div className="action-card" onClick={handleCloneRepository}>
                <div className="card-icon">
                  <i className="fab fa-git-alt"></i>
                </div>
                <div className="card-content">
                  <h3>Clonar Repositório</h3>
                  <p>Clonar um repositório Git</p>
                </div>
                <div className="card-arrow">
                  <i className="fas fa-chevron-right"></i>
                </div>
              </div>
            </div>
          </div>

          {recentProjects.length > 0 && (
            <div className="recent-projects">
              <h2>Projetos Recentes</h2>
              <div className="recent-list">
                {recentProjects.slice(0, 5).map((project, index) => (
                  <div 
                    key={index}
                    className="recent-item"
                    onClick={() => onOpenFolder?.(project)}
                  >
                    <div className="recent-icon">
                      <i className="fas fa-folder"></i>
                    </div>
                    <div className="recent-info">
                      <div className="recent-name">{project.name}</div>
                      <div className="recent-path">{project.path}</div>
                    </div>
                    <div className="recent-date">
                      {new Date(project.lastOpened).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="welcome-tips">
            <h2>Dicas</h2>
            <div className="tips-grid">
              <div className="tip-item">
                <i className="fas fa-keyboard"></i>
                <div>
                  <strong>Ctrl+S</strong> para salvar arquivos
                </div>
              </div>
              <div className="tip-item">
                <i className="fas fa-search"></i>
                <div>
                  <strong>Ctrl+F</strong> para buscar no arquivo
                </div>
              </div>
              <div className="tip-item">
                <i className="fas fa-comments"></i>
                <div>
                  Use o <strong>chat do agente</strong> para ajuda
                </div>
              </div>
              <div className="tip-item">
                <i className="fas fa-palette"></i>
                <div>
                  Alterne entre <strong>temas claro/escuro</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <FolderPicker
        isOpen={showFolderPicker}
        onFolderSelect={handleFolderSelected}
        onCancel={() => setShowFolderPicker(false)}
      />

      <NewProjectDialog
        isOpen={showNewProject}
        onCreateProject={handleProjectCreated}
        onCancel={() => setShowNewProject(false)}
      />

      <CloneRepositoryDialog
        isOpen={showCloneDialog}
        onCloneRepository={handleRepositoryCloned}
        onCancel={() => setShowCloneDialog(false)}
      />
    </div>
  );
}

export default WelcomeScreen;

// Componente para clonar repositório
function CloneRepositoryDialog({ onCloneRepository, onCancel, isOpen }) {
  const [repoUrl, setRepoUrl] = useState('');
  const [localPath, setLocalPath] = useState('');
  const [isCloning, setIsCloning] = useState(false);
  const [error, setError] = useState('');

  const handleClone = async () => {
    if (!repoUrl.trim()) return;

    setIsCloning(true);
    setError('');

    try {
      // Simular clonagem (aqui você integraria com o backend)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const repoName = repoUrl.split('/').pop()?.replace('.git', '') || 'repositorio';
      
      onCloneRepository?.({
        name: repoName,
        url: repoUrl.trim(),
        localPath: localPath.trim() || `./${repoName}`,
        cloned: true
      });
    } catch (err) {
      setError('Erro ao clonar repositório: ' + err.message);
    } finally {
      setIsCloning(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="folder-picker-overlay">
      <div className="folder-picker-modal">
        <div className="folder-picker-header">
          <h3>
            <i className="fab fa-git-alt"></i>
            Clonar Repositório
          </h3>
          <button className="close-button" onClick={onCancel}>
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="folder-picker-content">
          <div className="folder-picker-description">
            <p>
              Digite a URL do repositório Git que você deseja clonar.
            </p>
          </div>

          {error && (
            <div className="error-message">
              <i className="fas fa-exclamation-triangle"></i>
              {error}
            </div>
          )}

          <div className="project-form">
            <div className="form-group">
              <label htmlFor="repo-url">URL do Repositório:</label>
              <input
                id="repo-url"
                type="url"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/usuario/repositorio.git"
                disabled={isCloning}
              />
            </div>

            <div className="form-group">
              <label htmlFor="local-path">Pasta Local (opcional):</label>
              <input
                id="local-path"
                type="text"
                value={localPath}
                onChange={(e) => setLocalPath(e.target.value)}
                placeholder="Deixe vazio para usar o nome do repositório"
                disabled={isCloning}
              />
            </div>
          </div>
        </div>

        <div className="folder-picker-actions">
          <button
            className="cancel-button"
            onClick={onCancel}
            disabled={isCloning}
          >
            Cancelar
          </button>
          <button
            className="create-button"
            onClick={handleClone}
            disabled={!repoUrl.trim() || isCloning}
          >
            {isCloning ? (
              <>
                <i className="fas fa-spinner fa-spin"></i>
                Clonando...
              </>
            ) : (
              <>
                <i className="fab fa-git-alt"></i>
                Clonar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}