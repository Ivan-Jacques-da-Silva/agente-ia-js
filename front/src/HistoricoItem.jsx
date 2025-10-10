import React, { useState } from 'react';
import { criarDiffVisualizer } from './chat-utils';

export function HistoricoItem({ item, onVisualizarDiff }) {
  const [expandido, setExpandido] = useState(false);
  const [copiado, setCopiado] = useState(null);

  const copiarCodigo = async (codigo, tipo) => {
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiado(tipo);
      setTimeout(() => setCopiado(null), 2000);
    } catch (e) {
      console.error('Erro ao copiar:', e);
    }
  };

  const iconesPorTipo = {
    'projeto_criado': '📁',
    'projeto_reaberto': '🔄',
    'mudanca_aprovada': '✅',
    'mudancas_propostas': '📝',
    'mudanca_rejeitada': '❌',
    'arquivo_salvo': '💾',
    'commit_realizado': '🚀'
  };

  const icone = iconesPorTipo[item.tipo] || '📌';

  // Verificar se tem dados de mudança
  const temMudanca = item.dados && typeof item.dados === 'string';
  let dadosMudanca = null;
  
  if (temMudanca) {
    try {
      dadosMudanca = JSON.parse(item.dados);
    } catch (e) {
      dadosMudanca = null;
    }
  }

  return (
    <div className="historico-item-card">
      <div 
        className="historico-item-header"
        onClick={() => setExpandido(!expandido)}
        style={{ cursor: temMudanca ? 'pointer' : 'default' }}
      >
        <div className="historico-item-icon">{icone}</div>
        <div className="historico-item-info">
          <div className="historico-item-tipo">{item.tipo.replace(/_/g, ' ')}</div>
          <div className="historico-item-descricao">{item.descricao}</div>
          <div className="historico-item-timestamp">
            {new Date(item.timestamp).toLocaleString('pt-BR')}
          </div>
        </div>
        {temMudanca && (
          <button
            type="button"
            className="historico-expand-btn"
            onClick={(e) => {
              e.stopPropagation();
              setExpandido(!expandido);
            }}
          >
            <i className={`fas fa-chevron-${expandido ? 'up' : 'down'}`}></i>
          </button>
        )}
      </div>

      {expandido && dadosMudanca && dadosMudanca.arquivo && (
        <div className="historico-item-detalhes">
          <div className="historico-arquivo-path">
            <i className="fas fa-file-code"></i> {dadosMudanca.arquivo}
          </div>

          {dadosMudanca.conteudo_original && dadosMudanca.conteudo_novo && (
            <>
              <div className="historico-codigo-comparacao">
                <div className="historico-codigo-bloco">
                  <div className="historico-codigo-header">
                    <span>Código Anterior</span>
                    <button
                      type="button"
                      className="button button-tertiary button-sm"
                      onClick={() => copiarCodigo(dadosMudanca.conteudo_original, 'original')}
                    >
                      {copiado === 'original' ? (
                        <><i className="fas fa-check"></i> Copiado!</>
                      ) : (
                        <><i className="fas fa-copy"></i> Copiar</>
                      )}
                    </button>
                  </div>
                  <pre className="historico-codigo-preview">
                    {dadosMudanca.conteudo_original.slice(0, 500)}
                    {dadosMudanca.conteudo_original.length > 500 && '...'}
                  </pre>
                </div>

                <div className="historico-codigo-bloco">
                  <div className="historico-codigo-header">
                    <span>Código Novo</span>
                    <button
                      type="button"
                      className="button button-tertiary button-sm"
                      onClick={() => copiarCodigo(dadosMudanca.conteudo_novo, 'novo')}
                    >
                      {copiado === 'novo' ? (
                        <><i className="fas fa-check"></i> Copiado!</>
                      ) : (
                        <><i className="fas fa-copy"></i> Copiar</>
                      )}
                    </button>
                  </div>
                  <pre className="historico-codigo-preview">
                    {dadosMudanca.conteudo_novo.slice(0, 500)}
                    {dadosMudanca.conteudo_novo.length > 500 && '...'}
                  </pre>
                </div>
              </div>

              <button
                type="button"
                className="button button-primary"
                onClick={() => {
                  const diffData = criarDiffVisualizer(
                    dadosMudanca.conteudo_original,
                    dadosMudanca.conteudo_novo
                  );
                  onVisualizarDiff({
                    arquivo: dadosMudanca.arquivo,
                    tipo: item.tipo,
                    timestamp: item.timestamp,
                    ...diffData
                  });
                }}
                style={{ marginTop: '12px', width: '100%' }}
              >
                <i className="fas fa-code-compare"></i> Ver Comparação Completa
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
