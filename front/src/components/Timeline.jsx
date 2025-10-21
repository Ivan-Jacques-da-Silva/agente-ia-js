import React, { useState, useEffect } from 'react';
import './Timeline.css';

const Timeline = ({ 
  steps = [], 
  currentStep = null, 
  showTimestamps = true, 
  showDuration = true,
  onStepClick = null,
  className = '' 
}) => {
  const [expandedSteps, setExpandedSteps] = useState(new Set());

  const toggleStepExpansion = (stepId) => {
    if (!onStepClick) return;
    
    setExpandedSteps(prev => {
      const newSet = new Set(prev);
      if (newSet.has(stepId)) {
        newSet.delete(stepId);
      } else {
        newSet.add(stepId);
      }
      return newSet;
    });
  };

  const getStepIcon = (status) => {
    switch (status) {
      case 'completed':
        return '✅';
      case 'in_progress':
        return '⚡';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'pending':
        return '⏸️';
      case 'skipped':
        return '⏭️';
      default:
        return '⚪';
    }
  };

  const getStepColor = (status) => {
    switch (status) {
      case 'completed':
        return '#10b981';
      case 'in_progress':
        return '#3b82f6';
      case 'error':
        return '#ef4444';
      case 'warning':
        return '#f59e0b';
      case 'pending':
        return '#6b7280';
      case 'skipped':
        return '#9ca3af';
      default:
        return '#d1d5db';
    }
  };

  const formatDuration = (startTime, endTime) => {
    if (!startTime) return '';
    
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const duration = Math.round((end - start) / 1000);
    
    if (duration < 60) {
      return `${duration}s`;
    } else if (duration < 3600) {
      const minutes = Math.floor(duration / 60);
      const seconds = duration % 60;
      return `${minutes}m ${seconds}s`;
    } else {
      const hours = Math.floor(duration / 3600);
      const minutes = Math.floor((duration % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className={`timeline-container ${className}`}>
      <div className="timeline-header">
        <h3>Progresso da Execução</h3>
        {currentStep && (
          <div className="current-step-indicator">
            <div className="pulse-dot"></div>
            <span>{currentStep}</span>
          </div>
        )}
      </div>

      <div className="timeline">
        {steps.map((step, index) => {
          const isExpanded = expandedSteps.has(step.id || index);
          const hasDetails = step.details || step.logs || step.output;
          const isClickable = hasDetails && onStepClick;

          return (
            <div 
              key={step.id || index} 
              className={`timeline-step ${step.status} ${isClickable ? 'clickable' : ''}`}
              onClick={() => isClickable && toggleStepExpansion(step.id || index)}
            >
              {/* Linha conectora */}
              {index < steps.length - 1 && (
                <div 
                  className="timeline-connector"
                  style={{ backgroundColor: getStepColor(step.status) }}
                />
              )}

              {/* Ícone do passo */}
              <div 
                className="timeline-icon"
                style={{ 
                  backgroundColor: getStepColor(step.status),
                  borderColor: getStepColor(step.status)
                }}
              >
                {step.status === 'in_progress' ? (
                  <div className="spinner"></div>
                ) : (
                  getStepIcon(step.status)
                )}
              </div>

              {/* Conteúdo do passo */}
              <div className="timeline-content">
                <div className="timeline-step-header">
                  <div className="step-title-row">
                    <h4 className="step-title">{step.title}</h4>
                    {hasDetails && (
                      <button className="expand-button">
                        {isExpanded ? '▼' : '▶'}
                      </button>
                    )}
                  </div>
                  
                  {step.description && (
                    <p className="step-description">{step.description}</p>
                  )}

                  <div className="step-metadata">
                    {showTimestamps && step.startTime && (
                      <span className="step-timestamp">
                        🕐 {formatTimestamp(step.startTime)}
                      </span>
                    )}
                    
                    {showDuration && step.startTime && (
                      <span className="step-duration">
                        ⏱️ {formatDuration(step.startTime, step.endTime)}
                      </span>
                    )}

                    {step.command && (
                      <span className="step-command">
                        💻 {step.command}
                      </span>
                    )}
                  </div>
                </div>

                {/* Detalhes expandíveis */}
                {isExpanded && hasDetails && (
                  <div className="timeline-step-details">
                    {step.details && (
                      <div className="detail-section">
                        <h5>Detalhes</h5>
                        <p>{step.details}</p>
                      </div>
                    )}

                    {step.logs && step.logs.length > 0 && (
                      <div className="detail-section">
                        <h5>Logs</h5>
                        <div className="logs-container">
                          {step.logs.map((log, logIndex) => (
                            <div key={logIndex} className={`log-entry ${log.level || 'info'}`}>
                              <span className="log-timestamp">
                                {formatTimestamp(log.timestamp)}
                              </span>
                              <span className="log-message">{log.message}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {step.output && (
                      <div className="detail-section">
                        <h5>Output</h5>
                        <pre className="output-container">{step.output}</pre>
                      </div>
                    )}

                    {step.files && step.files.length > 0 && (
                      <div className="detail-section">
                        <h5>Arquivos Modificados</h5>
                        <div className="files-list">
                          {step.files.map((file, fileIndex) => (
                            <div key={fileIndex} className="file-item">
                              <span className="file-icon">📄</span>
                              <span className="file-path">{file}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Resumo da timeline */}
      <div className="timeline-summary">
        <div className="summary-stats">
          <div className="stat">
            <span className="stat-label">Total:</span>
            <span className="stat-value">{steps.length} passos</span>
          </div>
          <div className="stat">
            <span className="stat-label">Concluídos:</span>
            <span className="stat-value">
              {steps.filter(s => s.status === 'completed').length}
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Erros:</span>
            <span className="stat-value">
              {steps.filter(s => s.status === 'error').length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Timeline;