import React, { useState, useRef } from 'react';

export function AttachmentMenu({ agenteUrl, onAnaliseCompleta }) {
  const [menuAberto, setMenuAberto] = useState(false);
  const [analisando, setAnalisando] = useState(false);
  const [progresso, setProgresso] = useState(null);
  const [tipoArquivo, setTipoArquivo] = useState(null);
  const imagemInputRef = useRef(null);
  const pdfInputRef = useRef(null);

  const handleAnexar = (tipo) => {
    setMenuAberto(false);
    if (tipo === 'imagem') {
      imagemInputRef.current?.click();
    } else if (tipo === 'pdf') {
      pdfInputRef.current?.click();
    }
  };

  const interromperAnalise = () => {
    setAnalisando(false);
    setProgresso(null);
  };

  const analisarArquivo = async (file, tipo) => {
    if (!file || !agenteUrl) return;

    setAnalisando(true);
    setTipoArquivo(tipo);
    setProgresso({ tipo: 'inicio', texto: `🔍 Analisando ${tipo}...`, timestamp: Date.now() });

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const base64 = event.target.result;
        
        const response = await fetch(`${agenteUrl}/vision/analisar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imagem: base64,
            prompt: tipo === 'pdf' 
              ? 'Analise este documento PDF. Extraia e descreva todo o conteúdo, incluindo texto, estrutura e elementos importantes.'
              : 'Analise esta imagem em detalhes. Descreva o que você vê e contextualize para ajudar um agente de IA.'
          })
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let textoCompleto = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter(line => line.trim());

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.tipo === 'chunk') {
                  textoCompleto = data.textoCompleto || '';
                  setProgresso({ tipo: 'streaming', texto: textoCompleto, timestamp: Date.now() });
                } else if (data.tipo === 'completo') {
                  setProgresso({ tipo: 'sucesso', texto: data.resultado, timestamp: Date.now() });
                  if (onAnaliseCompleta) {
                    onAnaliseCompleta(data.resultado, tipo, file.name);
                  }
                  setTimeout(() => {
                    setAnalisando(false);
                    setProgresso(null);
                  }, 2000);
                }
              } catch (e) {
                console.warn('Erro ao parsear SSE:', e);
              }
            }
          }
        }
      } catch (e) {
        setProgresso({ tipo: 'erro', texto: `❌ Erro: ${e.message}`, timestamp: Date.now() });
        setTimeout(() => {
          setAnalisando(false);
          setProgresso(null);
        }, 3000);
      }
    };

    reader.readAsDataURL(file);
  };

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px' }}>
      {/* Botão de anexar */}
      <button
        type="button"
        onClick={() => setMenuAberto(!menuAberto)}
        disabled={analisando}
        style={{
          background: 'transparent',
          border: 'none',
          cursor: analisando ? 'not-allowed' : 'pointer',
          fontSize: '20px',
          padding: '8px',
          borderRadius: '4px',
          transition: 'background 0.2s',
          opacity: analisando ? 0.5 : 1
        }}
        onMouseEnter={(e) => !analisando && (e.currentTarget.style.background = '#2e3338')}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        title="Anexar arquivo"
      >
        📎
      </button>

      {/* Menu dropdown */}
      {menuAberto && (
        <>
          <div 
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 999
            }}
            onClick={() => setMenuAberto(false)}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '100%',
              left: 0,
              marginBottom: '8px',
              background: '#2e3338',
              borderRadius: '8px',
              padding: '4px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              zIndex: 1000,
              minWidth: '180px'
            }}
          >
            <button
              onClick={() => handleAnexar('imagem')}
              style={{
                width: '100%',
                padding: '10px 14px',
                background: 'transparent',
                border: 'none',
                color: '#dcddde',
                cursor: 'pointer',
                borderRadius: '4px',
                textAlign: 'left',
                transition: 'background 0.2s',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#404449'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ fontSize: '18px' }}>🖼️</span>
              <span>Anexar Imagem</span>
            </button>
            
            <button
              onClick={() => handleAnexar('pdf')}
              style={{
                width: '100%',
                padding: '10px 14px',
                background: 'transparent',
                border: 'none',
                color: '#dcddde',
                cursor: 'pointer',
                borderRadius: '4px',
                textAlign: 'left',
                transition: 'background 0.2s',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#404449'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ fontSize: '18px' }}>📄</span>
              <span>Anexar PDF</span>
            </button>
          </div>
        </>
      )}

      {/* Inputs ocultos */}
      <input
        ref={imagemInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) analisarArquivo(file, 'imagem');
        }}
        style={{ display: 'none' }}
      />
      <input
        ref={pdfInputRef}
        type="file"
        accept="application/pdf"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) analisarArquivo(file, 'pdf');
        }}
        style={{ display: 'none' }}
      />

      {/* Indicador de progresso compacto */}
      {analisando && progresso && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          left: '40px',
          marginBottom: '8px',
          background: '#1a1d29',
          borderRadius: '8px',
          padding: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          zIndex: 1000,
          minWidth: '300px',
          maxWidth: '400px',
          borderLeft: `4px solid ${progresso.tipo === 'streaming' ? '#5865f2' : progresso.tipo === 'sucesso' ? '#3ba55c' : '#ed4245'}`
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', color: '#8b9dc3' }}>
              {progresso.tipo === 'streaming' ? '💭 Analisando...' : progresso.tipo === 'sucesso' ? '✅ Completo' : '❌ Erro'}
            </span>
            <button
              onClick={interromperAnalise}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#ed4245',
                cursor: 'pointer',
                fontSize: '12px',
                padding: '4px 8px',
                borderRadius: '4px'
              }}
            >
              ⏸️ Parar
            </button>
          </div>
          
          <div style={{
            maxHeight: '100px',
            overflowY: 'auto',
            fontSize: '13px',
            color: '#dcddde',
            lineHeight: '1.5',
            fontFamily: 'monospace',
            background: '#0a0c10',
            padding: '8px',
            borderRadius: '4px'
          }}>
            {progresso.texto}
            {progresso.tipo === 'streaming' && (
              <span style={{ 
                display: 'inline-block',
                width: '8px',
                height: '12px',
                background: '#5865f2',
                marginLeft: '2px',
                animation: 'blink 1s infinite'
              }}></span>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
