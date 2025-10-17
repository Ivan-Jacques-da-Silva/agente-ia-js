/**
 * Interface Agentic - AI Software Engineer
 * 
 * Interface principal para interação com o agente autônomo
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  FaTimes, 
  FaRobot, 
  FaCog, 
  FaClock, 
  FaRocket, 
  FaClipboardList, 
  FaTrash, 
  FaBolt,
  FaExclamationTriangle,
  FaCheckCircle,
  FaCircle,
  FaTimesCircle,
  FaUser,
  FaComments,
  FaEdit
} from 'react-icons/fa';
import './AgenticInterface.css';

const AgenticInterface = ({ projectId, onClose }) => {
  // Estados principais
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState([]);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [agentStatus, setAgentStatus] = useState('idle');
  const [currentTask, setCurrentTask] = useState(null);
  
  // Refs
  const messagesEndRef = useRef(null);
  const logsEndRef = useRef(null);
  const previewRef = useRef(null);
  
  // Configurações
  const API_BASE = 'http://localhost:6060/api/agentic';
  
  useEffect(() => {
    initializeAgent();
    return () => {
      cleanupAgent();
    };
  }, [projectId]);
  
  useEffect(() => {
    scrollToBottom();
  }, [messages, logs]);
  
  /**
   * Inicializa o agente
   */
  const initializeAgent = async () => {
    try {
      const response = await fetch(`${API_BASE}/initialize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          config: {
            enableLivePreview: true,
            enableLogs: true
          }
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        addSystemMessage('🤖 Agente AI inicializado com sucesso!');
        setAgentStatus('ready');
        
        // Verificar se há preview ativo
        checkPreviewStatus();
      } else {
        addSystemMessage(`❌ Erro ao inicializar agente: ${result.error}`);
        setAgentStatus('error');
      }
    } catch (error) {
      console.error('Erro ao inicializar agente:', error);
      addSystemMessage(`❌ Erro de conexão: ${error.message}`);
      setAgentStatus('error');
    }
  };
  
  /**
   * Verifica status do preview
   */
  const checkPreviewStatus = async () => {
    try {
      const response = await fetch(`${API_BASE}/status?projectId=${projectId}`);
      const result = await response.json();
      
      if (result.success && result.status.preview) {
        setPreviewUrl(result.status.preview.url);
      }
    } catch (error) {
      console.error('Erro ao verificar preview:', error);
    }
  };
  
  /**
   * Envia mensagem para o agente
   */
  const sendMessage = async () => {
    if (!inputMessage.trim() || isProcessing) return;
    
    const userMessage = inputMessage.trim();
    setInputMessage('');
    setIsProcessing(true);
    
    // Adicionar mensagem do usuário
    addUserMessage(userMessage);
    
    try {
      const response = await fetch(`${API_BASE}/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          message: userMessage,
          context: {
            currentTask,
            previewActive: !!previewUrl
          }
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Processar resposta do agente
        processAgentResponse(result);
      } else {
        addSystemMessage(`❌ Erro: ${result.error}`);
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      addSystemMessage(`❌ Erro de comunicação: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };
  
  /**
   * Processa resposta do agente
   */
  const processAgentResponse = (result) => {
    // Adicionar resposta do agente
    if (result.response) {
      addAgentMessage(result.response);
    }
    
    // Processar logs
    if (result.logs) {
      result.logs.forEach(log => addLog(log));
    }
    
    // Atualizar status da tarefa
    if (result.task) {
      setCurrentTask(result.task);
    }
    
    // Atualizar preview se necessário
    if (result.previewUrl) {
      setPreviewUrl(result.previewUrl);
    }
    
    // Atualizar status do agente
    if (result.status) {
      setAgentStatus(result.status);
    }
  };
  
  /**
   * Adiciona mensagem do usuário
   */
  const addUserMessage = (message) => {
    setMessages(prev => [...prev, {
      id: Date.now(),
      type: 'user',
      content: message,
      timestamp: new Date()
    }]);
  };
  
  /**
   * Adiciona mensagem do agente
   */
  const addAgentMessage = (message) => {
    setMessages(prev => [...prev, {
      id: Date.now(),
      type: 'agent',
      content: message,
      timestamp: new Date()
    }]);
  };
  
  /**
   * Adiciona mensagem do sistema
   */
  const addSystemMessage = (message) => {
    setMessages(prev => [...prev, {
      id: Date.now(),
      type: 'system',
      content: message,
      timestamp: new Date()
    }]);
  };
  
  /**
   * Adiciona log
   */
  const addLog = (log) => {
    setLogs(prev => [...prev, {
      id: Date.now(),
      ...log,
      timestamp: new Date()
    }]);
  };
  
  /**
   * Limpa agente
   */
  const cleanupAgent = async () => {
    try {
      await fetch(`${API_BASE}/cleanup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ projectId }),
      });
    } catch (error) {
      console.error('Erro ao limpar agente:', error);
    }
  };
  
  /**
   * Scroll para o final
   */
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  /**
   * Manipula tecla Enter
   */
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };
  
  /**
   * Formata timestamp
   */
  const formatTime = (date) => {
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };
  
  /**
   * Obtém ícone do status
   */
  const getStatusIcon = () => {
    switch (agentStatus) {
      case 'ready': return <FaCheckCircle style={{color: '#10b981'}} />;
      case 'processing': return <FaClock style={{color: '#f59e0b'}} />;
      case 'error': return <FaTimesCircle style={{color: '#ef4444'}} />;
      default: return <FaCircle style={{color: '#6b7280'}} />;
    }
  };
  
  return (
    <div className="agentic-interface">
      {/* Header */}
      <div className="agentic-header">
        <div className="header-left">
          <h1>🤖 AI Software Engineer</h1>
          <div className="status-indicator">
            <span className="status-icon">{getStatusIcon()}</span>
            <span className="status-text">{agentStatus}</span>
          </div>
        </div>
        <div className="header-right">
          <button className="close-btn" onClick={onClose}><FaTimes /></button>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="agentic-content">
        {/* Left Panel - Chat */}
        <div className="chat-panel">
          <div className="chat-header">
            <h3>💬 Conversa com o Agente</h3>
          </div>
          
          <div className="chat-messages">
            {messages.map((message) => (
              <div key={message.id} className={`message ${message.type}`}>
                <div className="message-header">
                  <span className="message-type">
                    {message.type === 'user' ? '👤' : 
                     message.type === 'agent' ? '🤖' : '⚙️'}
                  </span>
                  <span className="message-time">
                    {formatTime(message.timestamp)}
                  </span>
                </div>
                <div className="message-content">
                  {message.content}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          
          <div className="chat-input">
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Digite sua solicitação para o agente..."
              disabled={isProcessing}
              rows={3}
            />
            <button 
              onClick={sendMessage}
              disabled={isProcessing || !inputMessage.trim()}
              className="send-btn"
            >
              {isProcessing ? <FaClock /> : <FaRocket />} Enviar
            </button>
          </div>
        </div>
        
        {/* Center Panel - Logs */}
        <div className="logs-panel">
          <div className="logs-header">
            <h3><FaClipboardList /> Logs de Execução</h3>
            <button 
              className="clear-logs-btn"
              onClick={() => setLogs([])}
            >
              <FaTrash /> Limpar
            </button>
          </div>
          
          <div className="logs-content">
            {logs.map((log) => (
              <div key={log.id} className={`log-entry ${log.level || 'info'}`}>
                <span className="log-time">
                  {formatTime(log.timestamp)}
                </span>
                <span className="log-level">
                  [{log.level?.toUpperCase() || 'INFO'}]
                </span>
                <span className="log-message">
                  {log.message}
                </span>
              </div>
            ))}
            {logs.length === 0 && (
              <div className="no-logs">
                <FaEdit /> Logs de execução aparecerão aqui...
              </div>
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>
      
      {/* Current Task Indicator */}
      {currentTask && (
        <div className="current-task">
          <div className="task-icon"><FaBolt /></div>
          <div className="task-info">
            <div className="task-title">{currentTask.title}</div>
            <div className="task-progress">
              <div 
                className="task-progress-bar"
                style={{ width: `${(currentTask.progress || 0) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgenticInterface;