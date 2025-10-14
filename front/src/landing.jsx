import React, { useState } from "react";

export default function Landing({ onImportarGitHub, onCriarDoZero, agenteStatus, projetos = [], onAbrirProjeto }) {
  const [prompt, setPrompt] = useState("");
  const [githubUrl, setGithubUrl] = useState("");

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
                title="Enviar"
                onClick={() => onCriarDoZero(prompt)}
                disabled={agenteStatus !== "ready"}
              >
                <i className="fas fa-arrow-up" />
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
            <h2 className="section-title" style={{ marginBottom: 12 }}>Seus Projetos</h2>
            <div className="projects-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
              {projetos.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="project-card"
                  style={{ textAlign: 'left' }}
                  onClick={() => onAbrirProjeto && onAbrirProjeto(p)}
                  title={`Abrir projeto ${p.nome}`}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <i className="fas fa-folder-open" style={{ color: 'var(--primary-color)' }} />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 700 }}>{p.nome || `Projeto ${p.id}`}</span>
                      {p.ultimo_acesso && (
                        <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                          Último acesso: {new Date(p.ultimo_acesso).toLocaleString('pt-BR')}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
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