import React, { useState, useRef, useEffect } from 'react';
import { FaComments, FaPlus, FaTimes, FaRobot, FaFolder, FaHandPaper, FaClock, FaArrowRight } from 'react-icons/fa';
import './ChatPanel.css';

const ChatPanel = ({ 
  isVisible, 
  onToggle, 
  currentProject, 
  chatMessages = [], 
  onSendMessage,
  isLoading = false 
}) => {
  const [message, setMessage] = useState('');
  const [chatSessions, setChatSessions] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  const handleSendMessage = async () => {
    if (!message.trim() || isLoading || !currentProject) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };

    // Limpa o input
    setMessage('');
    
    // Envia mensagem para o componente pai
    if (onSendMessage) {
      onSendMessage(userMessage);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderMessage = (msg) => {
    return (
      <div key={msg.id} className={`chat-message ${msg.type}`}>
        <div className="message-header">
          <span className="message-author">
            {msg.type === 'user' ? 'Você' : 'Agente IA'}
          </span>
          <span className="message-time">
            {formatTimestamp(msg.timestamp)}
          </span>
        </div>
        <div className="message-content">
          {msg.type === 'assistant' && msg.content.includes('```') ? (
            <pre className="code-block">{msg.content}</pre>
          ) : (
            <div className="message-text">{msg.content}</div>
          )}
        </div>
      </div>
    );
  };

  if (!isVisible) return null;

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <div className="chat-title">
              <span className="chat-icon">💬</span>
              <span>Chat com Agente IA</span>
            </div>
        <div className="chat-actions">
          <button 
            className="chat-action-btn"
            onClick={() => {/* Nova conversa */}}
            title="Nova conversa"
          >
            <FaPlus />
          </button>
          <button 
            className="chat-action-btn"
            onClick={onToggle}
            title="Fechar chat"
          >
            <FaTimes />
          </button>
        </div>
      </div>

      {!currentProject ? (
        <div className="chat-empty-state">
          <div className="empty-icon">🤖</div>
          <h3>Chat com Agente IA</h3>
          <p>Abra uma pasta ou crie um novo projeto para começar a conversar com o agente.</p>
        </div>
      ) : (
        <>
          <div className="chat-project-info">
            <span className="project-icon"><FaFolder /></span>
            <span className="project-name">{currentProject.nome || 'Projeto'}</span>
          </div>

          <div className="chat-messages">
            {chatMessages.length === 0 ? (
              <div className="chat-welcome">
                <div className="welcome-icon">👋</div>
                <h4>Olá! O que posso te ajudar hoje?</h4>
                <p>Você pode me pedir para:</p>
                <ul>
                  <li>Analisar e explicar código</li>
                  <li>Criar novos arquivos</li>
                  <li>Refatorar código existente</li>
                  <li>Corrigir bugs</li>
                  <li>Implementar funcionalidades</li>
                </ul>
              </div>
            ) : (
              chatMessages.map(renderMessage)
            )}
            
            {isLoading && (
              <div className="chat-message assistant loading">
                <div className="message-header">
                  <span className="message-author">Agente IA</span>
                </div>
                <div className="message-content">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          <div className="chat-input-container">
            <div className="chat-input-wrapper">
              <textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Digite sua mensagem... (Enter para enviar, Shift+Enter para nova linha)"
                className="chat-input"
                rows="1"
                disabled={isLoading}
              />
              <button
                onClick={handleSendMessage}
                disabled={!message.trim() || isLoading}
                className="send-button"
                title="Enviar mensagem"
              >
                {isLoading ? <FaClock /> : <FaArrowRight />}
              </button>
            </div>
            <div className="chat-input-hint">
              Use <kbd>Enter</kbd> para enviar, <kbd>Shift+Enter</kbd> para nova linha
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ChatPanel;