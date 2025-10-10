import React from 'react';

export function MudancaCard({ mudanca, onVisualizar, onAprovar, onRejeitar, loading }) {
  const { arquivo, descricao, analise } = mudanca;

  return (
    <div className="mudanca-card-chat">
      <div className="mudanca-header-chat">
        <div className="mudanca-icon">📝</div>
        <div className="mudanca-info">
          <div className="mudanca-arquivo">{arquivo}</div>
          <div className="mudanca-descricao">{descricao}</div>
        </div>
      </div>

      {analise && (
        <div className="mudanca-stats">
          <span className="stat-add">+{analise.linhas_adicionadas || 0}</span>
          <span className="stat-remove">-{analise.linhas_removidas || 0}</span>
          <span className="stat-modify">~{analise.linhas_modificadas || 0}</span>
        </div>
      )}

      <div className="mudanca-actions">
        <button
          type="button"
          className="button button-tertiary button-sm"
          onClick={() => onVisualizar(mudanca)}
        >
          <i className="fas fa-code"></i> Ver Código
        </button>
        <button
          type="button"
          className="button button-primary button-sm"
          onClick={() => onAprovar(mudanca.id)}
          disabled={loading}
        >
          <i className="fas fa-check"></i> Aprovar
        </button>
        <button
          type="button"
          className="button button-secondary button-sm"
          onClick={() => onRejeitar(mudanca.id)}
          disabled={loading}
        >
          <i className="fas fa-times"></i> Rejeitar
        </button>
      </div>
    </div>
  );
}
