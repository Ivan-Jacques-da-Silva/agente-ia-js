import React, { useEffect, useRef, useState } from 'react';

export function AttachmentMenu({ agenteUrl, onAnaliseCompleta }) {
  const [menuAberto, setMenuAberto] = useState(false);
  const [analisando, setAnalisando] = useState(false);
  const [progresso, setProgresso] = useState(null);
  const [tipoArquivo, setTipoArquivo] = useState(null);
  const imagemInputRef = useRef(null);
  const pdfInputRef = useRef(null);
  const audioInputRef = useRef(null);

  const [gravando, setGravando] = useState(false);
  const recognitionRef = useRef(null);
  const [transcricaoParcial, setTranscricaoParcial] = useState('');

  const handleAnexar = (tipo) => {
    setMenuAberto(false);
    if (tipo === 'imagem') {
      imagemInputRef.current?.click();
    } else if (tipo === 'pdf') {
      pdfInputRef.current?.click();
    } else if (tipo === 'audio') {
      audioInputRef.current?.click();
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

  const transcreverAudioArquivo = async (file) => {
    if (!file || !agenteUrl) return;
    setAnalisando(true);
    setTipoArquivo('audio');
    setProgresso({ tipo: 'inicio', texto: `🎙️ Transcrevendo áudio...`, timestamp: Date.now() });

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const base64 = event.target.result;
        const response = await fetch(`${agenteUrl}/audio/transcrever`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audio: base64 })
        });

        const streamReader = response.body.getReader();
        const decoder = new TextDecoder();
        let textoCompleto = '';

        while (true) {
          const { done, value } = await streamReader.read();
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
                    onAnaliseCompleta(data.resultado, 'audio', file.name);
                  }
                  setTimeout(() => {
                    setAnalisando(false);
                    setProgresso(null);
                  }, 1500);
                }
              } catch (e) {
                console.warn('Erro ao parsear SSE de áudio:', e);
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

  // Transcrição via Web Speech API (navegador)
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      const rec = new SR();
      rec.continuous = true;
      rec.interimResults = true;
      recognitionRef.current = rec;
      rec.onresult = (e) => {
        let final = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const trans = e.results[i][0].transcript;
          if (e.results[i].isFinal) final += trans + ' ';
          else setTranscricaoParcial(trans);
        }
        if (final) {
          setTranscricaoParcial('');
          if (onAnaliseCompleta) {
            onAnaliseCompleta(final.trim(), 'audio', 'microfone');
          }
        }
      };
      rec.onerror = () => {
        setGravando(false);
      };
    }
  }, [onAnaliseCompleta]);

  const iniciarGravacao = () => {
    if (!recognitionRef.current) return;
    setGravando(true);
    recognitionRef.current.start();
  };
  const pararGravacao = () => {
    try { recognitionRef.current?.stop(); } catch {}
    setGravando(false);
  };

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      {/* Botão de anexar */}
      <button
        type="button"
        onClick={() => setMenuAberto(!menuAberto)}
        disabled={analisando}
        style={{
          background: 'none',
          border: 'none',
          cursor: analisando ? 'not-allowed' : 'pointer',
          fontSize: '18px',
          padding: '8px',
          opacity: analisando ? 0.4 : 0.7
        }}
        title="Anexar"
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
              marginBottom: '4px',
              background: '#1a1d29',
              border: '1px solid #2e3338',
              borderRadius: '4px',
              padding: '4px',
              zIndex: 1000,
              minWidth: '140px'
            }}
          >
            <button
              onClick={() => handleAnexar('imagem')}
              style={{
                width: '100%',
                padding: '8px 10px',
                background: 'none',
                border: 'none',
                color: '#dcddde',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span>🖼️</span>
              <span>Imagem</span>
            </button>
            
            <button
              onClick={() => handleAnexar('pdf')}
              style={{
                width: '100%',
                padding: '8px 10px',
                background: 'none',
                border: 'none',
                color: '#dcddde',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span>📄</span>
              <span>PDF</span>
            </button>

            <button
              onClick={() => handleAnexar('audio')}
              style={{
                width: '100%',
                padding: '8px 10px',
                background: 'none',
                border: 'none',
                color: '#dcddde',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span>🎧</span>
              <span>Áudio</span>
            </button>

            <div style={{ padding: '4px 8px', borderTop: '1px solid #2e3338', marginTop: '4px' }}>
              <button
                onClick={gravando ? pararGravacao : iniciarGravacao}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  background: gravando ? '#402020' : 'none',
                  border: '1px solid #2e3338',
                  color: '#dcddde',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  borderRadius: '4px'
                }}
              >
                <span>{gravando ? '🛑' : '🎙️'}</span>
                <span>{gravando ? 'Parar gravação (transcrição local)' : 'Gravar voz (transcrever no navegador)'}</span>
              </button>
              {transcricaoParcial && (
                <div style={{ marginTop: '6px', fontSize: '12px', color: '#dcddde' }}>
                  {transcricaoParcial}
                </div>
              )}
            </div>
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
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) transcreverAudioArquivo(file);
        }}
        style={{ display: 'none' }}
      />

      {/* Indicador de progresso */}
      {analisando && progresso && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          left: '40px',
          marginBottom: '4px',
          background: '#1a1d29',
          border: '1px solid #2e3338',
          borderRadius: '4px',
          padding: '8px',
          zIndex: 1000,
          minWidth: '250px',
          maxWidth: '350px'
        }}>
          <div style={{ fontSize: '11px', color: '#8b9dc3', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
            <span>{progresso.tipo === 'streaming' ? 'Analisando...' : progresso.tipo === 'sucesso' ? 'Completo' : 'Erro'}</span>
            <button onClick={interromperAnalise} style={{ background: 'none', border: 'none', color: '#ed4245', cursor: 'pointer', fontSize: '11px', padding: 0 }}>
              Parar
            </button>
          </div>
          <div style={{ fontSize: '12px', color: '#dcddde', maxHeight: '80px', overflowY: 'auto' }}>
            {progresso.texto?.slice(0, 200)}...
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
