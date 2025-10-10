import React, { useState, useRef, useEffect } from 'react';

export function VisionAnalyzer({ agenteUrl, onAnaliseCompleta }) {
  const [imagem, setImagem] = useState(null);
  const [imagemPreview, setImagemPreview] = useState(null);
  const [analisando, setAnalisando] = useState(false);
  const [progresso, setProgresso] = useState([]);
  const [textoAtual, setTextoAtual] = useState('');
  const eventSourceRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleImagemSelecionada = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target.result;
      setImagem(base64);
      setImagemPreview(base64);
    };
    reader.readAsDataURL(file);
  };

  const interromperAnalise = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setAnalisando(false);
    setProgresso(prev => [...prev, { tipo: 'interrupcao', mensagem: '⚠️ Análise interrompida pelo usuário', timestamp: Date.now() }]);
  };

  const analisarImagem = async () => {
    if (!imagem || !agenteUrl) return;

    setAnalisando(true);
    setProgresso([{ tipo: 'inicio', mensagem: '🚀 Iniciando análise de imagem...', timestamp: Date.now() }]);
    setTextoAtual('');

    try {
      const response = await fetch(`${agenteUrl}/vision/analisar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imagem: imagem,
          prompt: 'Analise esta imagem em detalhes. Descreva o que você vê, identifique elementos importantes, cores, objetos, texto (se houver) e qualquer contexto relevante que possa ajudar um agente de IA a entender a situação.'
        })
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.tipo === 'inicio') {
                setProgresso(prev => [...prev, { tipo: 'processando', mensagem: data.mensagem, timestamp: Date.now() }]);
              } else if (data.tipo === 'chunk') {
                setTextoAtual(data.textoCompleto || '');
                setProgresso(prev => {
                  const ultimo = prev[prev.length - 1];
                  if (ultimo?.tipo === 'streaming') {
                    return [...prev.slice(0, -1), { ...ultimo, texto: data.textoCompleto, timestamp: Date.now() }];
                  }
                  return [...prev, { tipo: 'streaming', texto: data.textoCompleto, timestamp: Date.now() }];
                });
              } else if (data.tipo === 'completo') {
                setProgresso(prev => [...prev, { tipo: 'sucesso', mensagem: '✅ Análise completa!', resultado: data.resultado, timestamp: Date.now() }]);
                setTextoAtual(data.resultado);
                if (onAnaliseCompleta) {
                  onAnaliseCompleta(data.resultado);
                }
              } else if (data.tipo === 'erro') {
                setProgresso(prev => [...prev, { tipo: 'erro', mensagem: `❌ Erro: ${data.mensagem}`, timestamp: Date.now() }]);
              }
            } catch (e) {
              console.warn('Erro ao parsear SSE:', e);
            }
          }
        }
      }
    } catch (e) {
      setProgresso(prev => [...prev, { tipo: 'erro', mensagem: `❌ Erro: ${e.message}`, timestamp: Date.now() }]);
    } finally {
      setAnalisando(false);
    }
  };

  const limpar = () => {
    setImagem(null);
    setImagemPreview(null);
    setProgresso([]);
    setTextoAtual('');
    setAnalisando(false);
  };

  return (
    <div style={{ padding: '20px', background: '#1a1d29', borderRadius: '8px', marginBottom: '20px' }}>
      <h3 style={{ color: '#8b9dc3', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        🖼️ Análise de Imagem com IA
      </h3>

      <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
        {/* Upload */}
        <div style={{ flex: '1', minWidth: '250px' }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImagemSelecionada}
            style={{ display: 'none' }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={analisando}
            style={{
              padding: '10px 20px',
              background: '#5865f2',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: analisando ? 'not-allowed' : 'pointer',
              opacity: analisando ? 0.5 : 1,
              width: '100%'
            }}
          >
            📎 Selecionar Imagem
          </button>

          {imagemPreview && (
            <div style={{ marginTop: '10px', textAlign: 'center' }}>
              <img
                src={imagemPreview}
                alt="Preview"
                style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '5px', border: '2px solid #2e3338' }}
              />
            </div>
          )}
        </div>

        {/* Ações */}
        <div style={{ flex: '1', minWidth: '250px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            onClick={analisarImagem}
            disabled={!imagem || analisando}
            style={{
              padding: '10px 20px',
              background: imagem && !analisando ? '#3ba55c' : '#2e3338',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: imagem && !analisando ? 'pointer' : 'not-allowed',
              opacity: imagem && !analisando ? 1 : 0.5
            }}
          >
            {analisando ? '🔄 Analisando...' : '🚀 Analisar Imagem'}
          </button>

          {analisando && (
            <button
              onClick={interromperAnalise}
              style={{
                padding: '10px 20px',
                background: '#ed4245',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              ⏸️ Interromper
            </button>
          )}

          {(imagem || progresso.length > 0) && !analisando && (
            <button
              onClick={limpar}
              style={{
                padding: '10px 20px',
                background: '#2e3338',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              🗑️ Limpar
            </button>
          )}
        </div>
      </div>

      {/* Timeline de Progresso */}
      {progresso.length > 0 && (
        <div style={{ marginTop: '20px', background: '#0f1117', borderRadius: '8px', padding: '15px', maxHeight: '400px', overflowY: 'auto' }}>
          <h4 style={{ color: '#8b9dc3', marginBottom: '10px', fontSize: '14px' }}>📊 Timeline da Análise</h4>
          
          {progresso.map((item, idx) => (
            <div
              key={idx}
              style={{
                padding: '10px',
                marginBottom: '8px',
                background: item.tipo === 'erro' ? '#3a1f1f' : item.tipo === 'sucesso' ? '#1f3a28' : '#1a1d29',
                borderLeft: `4px solid ${
                  item.tipo === 'erro' ? '#ed4245' : 
                  item.tipo === 'sucesso' ? '#3ba55c' : 
                  item.tipo === 'streaming' ? '#5865f2' : '#8b9dc3'
                }`,
                borderRadius: '4px',
                animation: idx === progresso.length - 1 ? 'fadeIn 0.3s ease' : 'none'
              }}
            >
              <div style={{ fontSize: '12px', color: '#8b9dc3', marginBottom: '5px' }}>
                {new Date(item.timestamp).toLocaleTimeString()}
              </div>
              
              {item.tipo === 'streaming' ? (
                <div style={{ color: '#dcddde', fontSize: '14px', lineHeight: '1.6', fontFamily: 'monospace' }}>
                  <div style={{ color: '#5865f2', marginBottom: '5px', fontWeight: 'bold' }}>
                    💭 Analisando... ({item.texto?.length || 0} caracteres)
                  </div>
                  <div style={{ 
                    background: '#0a0c10', 
                    padding: '10px', 
                    borderRadius: '4px',
                    maxHeight: '150px',
                    overflowY: 'auto',
                    whiteSpace: 'pre-wrap',
                    wordWrap: 'break-word'
                  }}>
                    {item.texto}
                    <span style={{ 
                      display: 'inline-block',
                      width: '8px',
                      height: '14px',
                      background: '#5865f2',
                      marginLeft: '2px',
                      animation: 'blink 1s infinite'
                    }}></span>
                  </div>
                </div>
              ) : (
                <div style={{ color: '#dcddde', fontSize: '14px' }}>
                  {item.mensagem}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
