import React, { useState, useEffect } from 'react';
import './ProjectCreationModal.css';

export function ProjectCreationModal({ isOpen, onClose, projectName, onComplete }) {
  const [progress, setProgress] = useState([]);
  const [currentStep, setCurrentStep] = useState('');
  const [isCompleted, setIsCompleted] = useState(false);
  const [error, setError] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    if (!isOpen) {
      setProgress([]);
      setCurrentStep('');
      setIsCompleted(false);
      setError(null);
      setPreviewUrl(null);
      return;
    }

    // Iniciar criação do projeto
    startProjectCreation();
  }, [isOpen, projectName]);

  const startProjectCreation = async () => {
    try {
      const response = await fetch('/api/agente/projeto/criar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nome: projectName,
          prompt: `Criar projeto React: ${projectName}`
        })
      });

      if (!response.ok) {
        throw new Error('Erro ao iniciar criação do projeto');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              handleProgressUpdate(data);
            } catch (e) {
              console.error('Erro ao parsear SSE:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Erro na criação do projeto:', error);
      setError(error.message);
    }
  };

  const handleProgressUpdate = (data) => {
    const { etapa, status, detalhes } = data;

    setProgress(prev => {
      const newProgress = [...prev];
      const existingIndex = newProgress.findIndex(p => p.etapa === etapa);
      
      if (existingIndex >= 0) {
        newProgress[existingIndex] = { etapa, status, detalhes, timestamp: Date.now() };
      } else {
        newProgress.push({ etapa, status, detalhes, timestamp: Date.now() });
      }
      
      return newProgress;
    });

    setCurrentStep(detalhes?.mensagem || `${etapa}: ${status}`);

    if (etapa === 'finalizado' && status === 'concluido') {
      setIsCompleted(true);
      if (detalhes?.servidor?.url) {
        setPreviewUrl(detalhes.servidor.url);
      }
      
      // Notificar conclusão após um pequeno delay
      setTimeout(() => {
        onComplete?.(detalhes);
      }, 2000);
    }

    if (status === 'erro') {
      setError(detalhes?.erro || detalhes?.mensagem || 'Erro desconhecido');
    }
  };

  const getStepIcon = (status) => {
    switch (status) {
      case 'iniciando':
      case 'progresso':
        return <i className="fas fa-spinner fa-spin"></i>;
      case 'concluido':
        return <i className="fas fa-check-circle text-success"></i>;
      case 'erro':
        return <i className="fas fa-times-circle text-error"></i>;
      default:
        return <i className="fas fa-circle text-muted"></i>;
    }
  };

  const getStepTitle = (etapa) => {
    const titles = {
      'inicio': 'Iniciando projeto',
      'estrutura': 'Criando estrutura de pastas',
      'package': 'Configurando package.json',
      'html': 'Criando arquivo HTML',
      'app': 'Criando componente App',
      'index': 'Criando arquivos de entrada',
      'instalacao': 'Instalando dependências',
      'servidor': 'Iniciando servidor de desenvolvimento',
      'finalizado': 'Projeto criado com sucesso!'
    };
    return titles[etapa] || etapa;
  };

  if (!isOpen) return null;

  return (
    <div className="project-creation-overlay">
      <div className="project-creation-modal">
        <div className="modal-header">
          <h2>
            <i className="fab fa-react"></i>
            Criando Projeto React
          </h2>
          {isCompleted && (
            <button className="close-button" onClick={onClose}>
              <i className="fas fa-times"></i>
            </button>
          )}
        </div>

        <div className="modal-content">
          <div className="project-info">
            <h3>{projectName}</h3>
            <p className="current-step">{currentStep}</p>
          </div>

          {error && (
            <div className="error-message">
              <i className="fas fa-exclamation-triangle"></i>
              {error}
              <button className="retry-button" onClick={() => window.location.reload()}>
                Tentar Novamente
              </button>
            </div>
          )}

          <div className="progress-steps">
            {progress.map((step, index) => (
              <div key={step.etapa} className={`progress-step ${step.status}`}>
                <div className="step-icon">
                  {getStepIcon(step.status)}
                </div>
                <div className="step-content">
                  <div className="step-title">{getStepTitle(step.etapa)}</div>
                  <div className="step-details">
                    {step.detalhes?.mensagem}
                    {step.detalhes?.arquivo && (
                      <div className="step-file">
                        <i className="fas fa-file"></i>
                        {step.detalhes.arquivo}
                      </div>
                    )}
                    {step.detalhes?.arquivos && (
                      <div className="step-files">
                        {step.detalhes.arquivos.map((arquivo, i) => (
                          <div key={i} className="step-file">
                            <i className="fas fa-file"></i>
                            {arquivo}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {previewUrl && (
            <div className="preview-section">
              <h4>Preview do Projeto</h4>
              <div className="preview-container">
                <iframe
                  src={previewUrl}
                  title="Preview do Projeto"
                  className="preview-iframe"
                  onLoad={() => console.log('Preview carregado')}
                />
              </div>
              <div className="preview-actions">
                <a 
                  href={previewUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="preview-link"
                >
                  <i className="fas fa-external-link-alt"></i>
                  Abrir em Nova Aba
                </a>
              </div>
            </div>
          )}

          {isCompleted && (
            <div className="completion-actions">
              <button className="primary-button" onClick={onClose}>
                <i className="fas fa-code"></i>
                Começar a Desenvolver
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProjectCreationModal;