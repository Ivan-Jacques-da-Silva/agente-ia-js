import React, { useState } from "react";

export default function Landing({ onImportarGitHub, onCriarDoZero, agenteStatus, projetos = [], onAbrirProjeto, onDeletarProjeto }) {
  const [prompt, setPrompt] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const projectsPerPage = 6;

  // Calcular projetos para a página atual
  const totalPages = Math.ceil(projetos.length / projectsPerPage);
  const startIndex = (currentPage - 1) * projectsPerPage;
  const endIndex = startIndex + projectsPerPage;
  const currentProjects = projetos.slice(startIndex, endIndex);

  const handleDeleteProject = (project, e) => {
    e.stopPropagation();
    if (window.confirm(`Tem certeza que deseja excluir o projeto "${project.nome || `Projeto ${project.id}`}"?`)) {
      onDeletarProjeto && onDeletarProjeto(project);
    }
  };

  const handleCriarDoZero = async () => {
    if (!prompt.trim() || agenteStatus !== "ready" || isCreatingProject) return;
    
    setIsCreatingProject(true);
    try {
      await onCriarDoZero(prompt);
    } catch (error) {
      console.error("Erro ao criar projeto:", error);
    } finally {
      setIsCreatingProject(false);
    }
  };

  return (
    <div className="landing-root">
      <div className="landing-gradient" />
      <div className="landing-content">
        <h1 className="landing-title">Crie algo com o Agente</h1>
        <p className="landing-subtitle">Desenvolva apps e sites conversando em PT‑BR</p>

        <div className="landing-input-card">
          <textarea
            className="landing-textarea"
            placeholder="Peça para criar uma landing page, um CRUD, ou descreva seu projeto..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={isCreatingProject}
          />
          <div className="landing-toolbar">
            <div className="landing-toolbar-left">
              <button type="button" className="landing-icon-button" title="Adicionar">+</button>
              <button type="button" className="landing-icon-button" title="Anexar">
                <i className="fas fa-paperclip" />
                <span className="landing-icon-label">Anexar</span>
              </button>
              <span className="landing-pill" title="Visibilidade da ideia">
                <i className="fas fa-globe" />
                <span>Público</span>
              </span>
            </div>
            <div className="landing-toolbar-right">
              <button type="button" className="landing-icon-button" title="Gravar áudio">
                <i className="fas fa-microphone" />
              </button>
              <button
                type="button"
                className="landing-icon-button"
                title={isCreatingProject ? "Criando projeto..." : "Enviar"}
                onClick={handleCriarDoZero}
                disabled={agenteStatus !== "ready" || !prompt.trim() || isCreatingProject}
              >
                {isCreatingProject ? (
                  <div className="loading-spinner" style={{ width: 16, height: 16 }} />
                ) : (
                  <i className="fas fa-arrow-up" />
                )}
              </button>
            </div>
          </div>
          <div className="landing-actions">
            <input
              className="landing-input"
              placeholder="https://github.com/org/repo (opcional)"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
            />
            <button
              className="button button-secondary"
              onClick={() => githubUrl && onImportarGitHub(githubUrl)}
              disabled={!githubUrl || agenteStatus !== "ready"}
              title={agenteStatus !== "ready" ? "Agente indisponível" : "Importar do GitHub"}
            >
              Importar do GitHub
            </button>
          </div>
        </div>

        {/* Lista de projetos existentes */}
        {projetos?.length > 0 && (
          <section style={{ marginTop: 24 }}>
            <div className="projects-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 className="section-title" style={{ margin: 0 }}>Seus Projetos ({projetos.length})</h2>
              {totalPages > 1 && (
                <div className="pagination-info" style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                  Página {currentPage} de {totalPages}
                </div>
              )}
            </div>
            <div className="projects-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              {currentProjects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="project-card"
                  style={{ 
                    textAlign: 'left', 
                    position: 'relative',
                    padding: '16px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    backdropFilter: 'blur(10px)',
                    transition: 'all 0.2s ease',
                    cursor: 'pointer'
                  }}
                  onClick={() => onAbrirProjeto && onAbrirProjeto(p)}
                  title={`Abrir projeto ${p.nome}`}
                  onMouseEnter={(e) => {
                    e.target.style.background = 'rgba(255, 255, 255, 0.08)';
                    e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                    e.target.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'rgba(255, 255, 255, 0.05)';
                    e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                    e.target.style.transform = 'translateY(0)';
                  }}
                >
                  <div className="project-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div className="project-icon" style={{ 
                      width: '40px', 
                      height: '40px', 
                      background: 'var(--primary-color)', 
                      borderRadius: '8px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      color: 'white'
                    }}>
                      <i className="fas fa-folder" />
                    </div>
                    <button
                      type="button"
                      className="delete-btn"
                      title="Excluir projeto"
                      onClick={(e) => handleDeleteProject(p, e)}
                      style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        borderRadius: '6px',
                        padding: '6px 8px',
                        color: '#ef4444',
                        cursor: 'pointer',
                        fontSize: '12px',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.background = 'rgba(239, 68, 68, 0.2)';
                        e.target.style.borderColor = 'rgba(239, 68, 68, 0.4)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.background = 'rgba(239, 68, 68, 0.1)';
                        e.target.style.borderColor = 'rgba(239, 68, 68, 0.2)';
                      }}
                    >
                      <i className="fas fa-trash" />
                    </button>
                  </div>
                  <div className="project-info">
                    <div className="project-name" style={{ fontWeight: 600, fontSize: '16px', marginBottom: '4px', color: 'var(--text-primary)' }}>
                      {p.nome || `Projeto ${p.id}`}
                    </div>
                    <div className="project-path" style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', wordBreak: 'break-all' }}>
                      {p.caminho_local || 'Caminho não disponível'}
                    </div>
                    <div className="project-date" style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                      {p.ultimo_acesso ? `Último acesso: ${new Date(p.ultimo_acesso).toLocaleString('pt-BR')}` : 'Data não disponível'}
                    </div>
                  </div>
                </button>
              ))}
            </div>
            {totalPages > 1 && (
              <div className="pagination" style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                gap: '8px', 
                marginTop: '24px' 
              }}>
                <button 
                  className="pagination-btn"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: 'var(--text-primary)',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    opacity: currentPage === 1 ? 0.5 : 1,
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (currentPage !== 1) {
                      e.target.style.background = 'rgba(255, 255, 255, 0.15)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (currentPage !== 1) {
                      e.target.style.background = 'rgba(255, 255, 255, 0.1)';
                    }
                  }}
                >
                  <i className="fas fa-chevron-left"></i>
                  Anterior
                </button>
                <div className="pagination-pages" style={{ display: 'flex', gap: '4px' }}>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      className={`pagination-page ${page === currentPage ? 'active' : ''}`}
                      onClick={() => setCurrentPage(page)}
                      style={{
                        background: page === currentPage ? 'var(--primary-color)' : 'rgba(255, 255, 255, 0.1)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '6px',
                        padding: '8px 12px',
                        color: page === currentPage ? 'white' : 'var(--text-primary)',
                        cursor: 'pointer',
                        fontSize: '14px',
                        minWidth: '36px',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        if (page !== currentPage) {
                          e.target.style.background = 'rgba(255, 255, 255, 0.15)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (page !== currentPage) {
                          e.target.style.background = 'rgba(255, 255, 255, 0.1)';
                        }
                      }}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                <button 
                  className="pagination-btn"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: 'var(--text-primary)',
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                    opacity: currentPage === totalPages ? 0.5 : 1,
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (currentPage !== totalPages) {
                      e.target.style.background = 'rgba(255, 255, 255, 0.15)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (currentPage !== totalPages) {
                      e.target.style.background = 'rgba(255, 255, 255, 0.1)';
                    }
                  }}
                >
                  Próxima
                  <i className="fas fa-chevron-right"></i>
                </button>
              </div>
            )}
          </section>
        )}

        <div className="landing-footer">
          <span className={`status-dot status-${agenteStatus}`}></span>
          <span className="status-text">
            {agenteStatus === "ready" ? "Agente conectado" : agenteStatus === "resolving" ? "Conectando..." : "Agente indisponível"}
          </span>
        </div>
      </div>
    </div>
  );
}