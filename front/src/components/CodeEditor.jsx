import React, { useEffect, useRef, useState, useCallback } from 'react';
import './CodeEditor.css';

export function CodeEditor({ 
  arquivo, 
  conteudo, 
  onChange, 
  onSave,
  readOnly = false,
  theme = 'dark'
}) {
  const editorRef = useRef(null);
  const textareaRef = useRef(null);
  const [lineNumbers, setLineNumbers] = useState([]);
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });
  const [isModified, setIsModified] = useState(false);

  // Atualizar números das linhas
  const updateLineNumbers = useCallback((text) => {
    const lines = text.split('\n');
    setLineNumbers(lines.map((_, index) => index + 1));
  }, []);

  // Atualizar posição do cursor
  const updateCursorPosition = useCallback(() => {
    if (!textareaRef.current) return;
    
    const textarea = textareaRef.current;
    const text = textarea.value;
    const cursorPos = textarea.selectionStart;
    
    const textBeforeCursor = text.substring(0, cursorPos);
    const lines = textBeforeCursor.split('\n');
    const line = lines.length;
    const column = lines[lines.length - 1].length + 1;
    
    setCursorPosition({ line, column });
  }, []);

  // Manipular mudanças no conteúdo
  const handleChange = useCallback((e) => {
    const newContent = e.target.value;
    updateLineNumbers(newContent);
    setIsModified(newContent !== conteudo);
    onChange?.(newContent);
  }, [conteudo, onChange, updateLineNumbers]);

  // Manipular teclas especiais
  const handleKeyDown = useCallback((e) => {
    // Ctrl+S para salvar
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      onSave?.();
      setIsModified(false);
      return;
    }

    // Tab para indentação
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = e.target;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const value = textarea.value;
      
      if (e.shiftKey) {
        // Shift+Tab para remover indentação
        const lineStart = value.lastIndexOf('\n', start - 1) + 1;
        const lineText = value.substring(lineStart, start);
        
        if (lineText.startsWith('  ')) {
          const newValue = value.substring(0, lineStart) + 
                          lineText.substring(2) + 
                          value.substring(start);
          textarea.value = newValue;
          textarea.setSelectionRange(start - 2, end - 2);
          handleChange({ target: textarea });
        }
      } else {
        // Tab para adicionar indentação
        const newValue = value.substring(0, start) + '  ' + value.substring(end);
        textarea.value = newValue;
        textarea.setSelectionRange(start + 2, start + 2);
        handleChange({ target: textarea });
      }
    }

    // Auto-fechamento de parênteses, chaves, etc.
    const pairs = {
      '(': ')',
      '[': ']',
      '{': '}',
      '"': '"',
      "'": "'"
    };

    if (pairs[e.key]) {
      const textarea = e.target;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      
      if (start === end) {
        e.preventDefault();
        const value = textarea.value;
        const newValue = value.substring(0, start) + 
                        e.key + pairs[e.key] + 
                        value.substring(end);
        textarea.value = newValue;
        textarea.setSelectionRange(start + 1, start + 1);
        handleChange({ target: textarea });
      }
    }
  }, [handleChange, onSave]);

  // Sincronizar scroll entre números de linha e editor
  const handleScroll = useCallback((e) => {
    const lineNumbersEl = editorRef.current?.querySelector('.line-numbers');
    if (lineNumbersEl) {
      lineNumbersEl.scrollTop = e.target.scrollTop;
    }
  }, []);

  // Inicializar números das linhas
  useEffect(() => {
    if (conteudo) {
      updateLineNumbers(conteudo);
    }
  }, [conteudo, updateLineNumbers]);

  // Detectar linguagem do arquivo
  const getLanguage = useCallback(() => {
    if (!arquivo?.nome) return 'text';
    
    const ext = arquivo.nome.split('.').pop()?.toLowerCase();
    const languageMap = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'css': 'css',
      'html': 'html',
      'json': 'json',
      'md': 'markdown',
      'py': 'python',
      'java': 'java',
      'php': 'php',
      'xml': 'xml',
      'yml': 'yaml',
      'yaml': 'yaml'
    };
    
    return languageMap[ext] || 'text';
  }, [arquivo]);

  if (!arquivo) {
    return (
      <div className="code-editor-empty">
        <div className="empty-state">
          <i className="fas fa-file-code"></i>
          <h3>Nenhum arquivo aberto</h3>
          <p>Selecione um arquivo no explorador para começar a editar</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`code-editor ${theme}`} ref={editorRef}>
      <div className="editor-header">
        <div className="file-info">
          <i className="fas fa-file-code"></i>
          <span className="file-name">{arquivo.nome}</span>
          <span className="file-path">{arquivo.path}</span>
          {isModified && <span className="modified-indicator">●</span>}
        </div>
        <div className="editor-actions">
          <button 
            className="action-button"
            onClick={onSave}
            disabled={!isModified}
            title="Salvar (Ctrl+S)"
          >
            <i className="fas fa-save"></i>
          </button>
        </div>
      </div>

      <div className="editor-content">
        <div className="line-numbers">
          {lineNumbers.map(num => (
            <div key={num} className="line-number">
              {num}
            </div>
          ))}
        </div>
        
        <textarea
          ref={textareaRef}
          className={`code-textarea language-${getLanguage()}`}
          value={conteudo || ''}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onScroll={handleScroll}
          onSelect={updateCursorPosition}
          onClick={updateCursorPosition}
          onKeyUp={updateCursorPosition}
          readOnly={readOnly}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          placeholder={readOnly ? 'Arquivo somente leitura' : 'Digite seu código aqui...'}
        />
      </div>

      <div className="editor-footer">
        <div className="cursor-info">
          Ln {cursorPosition.line}, Col {cursorPosition.column}
        </div>
        <div className="language-info">
          {getLanguage().toUpperCase()}
        </div>
        <div className="encoding-info">
          UTF-8
        </div>
      </div>
    </div>
  );
}

export default CodeEditor;