export async function enviarChatComStreaming(
  mensagem,
  agenteUrl,
  projetoId,
  onEtapa,
  onCompleto,
  onErro
) {
  try {
    const response = await fetch(`${agenteUrl}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projetoId, mensagem }),
    });

    if (!response.ok) {
      throw new Error('Falha ao conectar com o servidor');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            
            if (data.tipo === 'etapa') {
              onEtapa(data.conteudo);
            } else if (data.tipo === 'completo') {
              onCompleto(data);
            } else if (data.tipo === 'erro') {
              onErro(data.mensagem);
            }
          } catch (e) {
            console.error('Erro ao parsear evento SSE:', e);
          }
        }
      }
    }
  } catch (error) {
    onErro(error.message || 'Erro desconhecido');
  }
}

export function criarDiffVisualizer(originalText, modifiedText) {
  const originalLines = originalText.split('\n');
  const modifiedLines = modifiedText.split('\n');
  
  const original = [];
  const modified = [];
  const changes = [];
  
  const maxLines = Math.max(originalLines.length, modifiedLines.length);
  
  for (let i = 0; i < maxLines; i++) {
    const origLine = originalLines[i];
    const modLine = modifiedLines[i];
    
    if (origLine === undefined && modLine !== undefined) {
      // Linha adicionada
      original.push({ lineNum: '', content: '', type: 'empty' });
      modified.push({ lineNum: i + 1, content: modLine, type: 'added' });
      changes.push(i);
    } else if (origLine !== undefined && modLine === undefined) {
      // Linha removida
      original.push({ lineNum: i + 1, content: origLine, type: 'removed' });
      modified.push({ lineNum: '', content: '', type: 'empty' });
      changes.push(i);
    } else if (origLine !== modLine) {
      // Linha modificada
      original.push({ lineNum: i + 1, content: origLine, type: 'removed' });
      modified.push({ lineNum: i + 1, content: modLine, type: 'added' });
      changes.push(i);
    } else {
      // Linha sem alteração
      original.push({ lineNum: i + 1, content: origLine, type: 'context' });
      modified.push({ lineNum: i + 1, content: modLine, type: 'context' });
    }
  }
  
  return { original, modified, changes };
}
