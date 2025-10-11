import React, { useState, useEffect } from 'react';

export function ThinkingProcess({ steps, isActive, title = "Working" }) {
  const [expandedSteps, setExpandedSteps] = useState(new Set());

  useEffect(() => {
    if (steps.length > 0) {
      const lastIndex = steps.length - 1;
      setExpandedSteps(new Set([lastIndex]));
    }
  }, [steps.length]);

  const toggleStep = (index) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedSteps(newExpanded);
  };

  if (!steps || steps.length === 0) return null;

  return (
    <div className="thinking-process">
      <div className="thinking-header">
        <span className="thinking-title">{title}</span>
        {isActive && (
          <span className="thinking-spinner">
            <i className="fas fa-circle-notch fa-spin"></i>
          </span>
        )}
      </div>
      
      <ul className="thinking-steps-list">
        {steps.map((step, index) => {
          const isExpanded = expandedSteps.has(index);
          const hasDetails = step.details && step.details.length > 0;
          const isCompleted = step.status === 'completed';
          const isRunning = step.status === 'running';
          const isFailed = step.status === 'failed';
          
          return (
            <li 
              key={index} 
              className={`thinking-step ${isCompleted ? 'is-completed' : ''} ${isRunning ? 'is-running' : ''} ${isFailed ? 'is-failed' : ''}`}
            >
              <div 
                className="thinking-step-main"
                onClick={() => hasDetails && toggleStep(index)}
                style={{ cursor: hasDetails ? 'pointer' : 'default' }}
              >
                <span className="thinking-step-icon">
                  {isCompleted && <i className="fas fa-check-circle"></i>}
                  {isRunning && <i className="fas fa-circle-notch fa-spin"></i>}
                  {isFailed && <i className="fas fa-times-circle"></i>}
                  {!isCompleted && !isRunning && !isFailed && <i className="fas fa-circle"></i>}
                </span>
                
                <span className="thinking-step-text">{step.text || step}</span>
                
                {hasDetails && (
                  <span className="thinking-step-toggle">
                    <i className={`fas fa-chevron-${isExpanded ? 'down' : 'right'}`}></i>
                  </span>
                )}
              </div>
              
              {hasDetails && isExpanded && (
                <ul className="thinking-step-details">
                  {step.details.map((detail, detailIndex) => (
                    <li key={detailIndex} className="thinking-step-detail">
                      <i className="fas fa-angle-right"></i>
                      <span>{detail}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
      
      {isActive && (
        <div className="thinking-footer">
          <span className="thinking-status">Processando...</span>
        </div>
      )}
    </div>
  );
}
