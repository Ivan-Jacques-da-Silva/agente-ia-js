import React, { useState, useRef, useEffect } from 'react';
import { FaClock, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import Timeline from './Timeline';
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
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  const handleSendMessage = async () => {
    if (!message.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };

    setMessage('');
    onSendMessage?.(userMessage);
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
    // Renderizar mensagem de progresso/etapas do agente com Timeline
    if (msg.type === 'agent-progress') {
      // Converter formato antigo para o novo formato da Timeline
      const timelineSteps = msg.steps ? msg.steps.map((step, index) => ({
        id: step.id || index,
        title: step.title,
        description: step.description,
        status: step.status,
        startTime: step.startTime || Date.now(),
        endTime: step.endTime,
        command: step.command,
        details: step.details,
        logs: step.logs,
        output: step.output,
        files: step.files
      })) : [];

      return (
        <div key={msg.id || `progress-${Date.now()}`} className="chat-message agent-progress">
          <Timeline 
            steps={timelineSteps}
            currentStep={msg.currentStep}
            showTimestamps={true}
            showDuration={true}
            onStepClick={(stepId) => console.log('Step clicked:', stepId)}
            className="chat-timeline"
          />
        </div>
      );
    }

    // Renderizar mensagem normal
    return (
      <div key={msg.id} className={`chat-message ${msg.type}`}>
        <div className="message-header">
          <span className="message-author">
           {msg.type === 'user' ? '👤 Você' : '🤖 Agente IA'}
         </span>
          <span className="message-time">{formatTimestamp(msg.timestamp)}</span>
        </div>
        <div className="message-content">
          {msg.type === 'assistant' && msg.content?.includes('```') ? (
            <pre className="code-block">{msg.content}</pre>
          ) : (
            <div className="message-text">{msg.content}</div>
          )}
        </div>
      </div>
    );
  };

  if (!isVisible) {
    return (
      <div className="ide-chat collapsed" style={{ width: '48px' }}>
        <div className="chat-header">
          <button className="chat-collapse" onClick={onToggle} title="Expandir chat">
            <FaChevronLeft />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ide-chat" style={{ width: '400px' }}>
      <div className="chat-header">
        <h3>Assistente IA</h3>
        <button className="chat-collapse" onClick={onToggle} title="Recolher chat">
          <FaChevronRight />
        </button>
      </div>

      <div className="chat-panel-content">
        {!currentProject && (
          <div className="chat-empty-state">
            <div className="empty-icon">🤖</div>
            <h3>Chat com Agente IA</h3>
            <p>
              Dica: mesmo sem projeto aberto, você pode pedir
              "crie uma landing page" que o agente cria um projeto automaticamente.
            </p>
          </div>
        )}

        <div className="chat-messages">
          {chatMessages.length === 0 ? (
            <div className="chat-welcome">
              <div className="welcome-icon">💬</div>
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
            chatMessages.map((msg, index) => (
              <div key={msg.id || `msg-${index}`}>
                {renderMessage(msg)}
              </div>
            ))
          )}

          {isLoading && (
            <div className="message assistant loading">
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

        <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="chat-input-form">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={currentProject ? 'Pergunte sobre seu código...' : 'Descreva o que deseja construir...'}
            className="chat-input"
            rows="3"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!message.trim() || isLoading}
            className="chat-send"
            title="Enviar mensagem"
          >
            {isLoading ? <FaClock /> : 'Enviar'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatPanel;

