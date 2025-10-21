/**
 * Security Panel - Painel de Configuração de Segurança
 * 
 * Interface para configurar timeout de comandos, allowlist/blocklist
 * e monitorar estatísticas de segurança do sistema
 */

import React, { useState, useEffect } from 'react';
import { 
  FaShieldAlt, 
  FaClock, 
  FaList, 
  FaBan, 
  FaCheck, 
  FaTimes, 
  FaPlus,
  FaTrash,
  FaChartBar,
  FaSync,
  FaCog
} from 'react-icons/fa';
import './SecurityPanel.css';

const SecurityPanel = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('config');
  const [config, setConfig] = useState({
    defaultTimeout: 30000,
    maxTimeout: 300000,
    allowedCommands: [],
    blockedCommands: []
  });
  const [stats, setStats] = useState({
    commandsExecuted: 0,
    commandsBlocked: 0,
    timeouts: 0,
    uptime: 0,
    activeTimeouts: 0
  });
  const [newCommand, setNewCommand] = useState('');
  const [commandToValidate, setCommandToValidate] = useState('');
  const [validationResult, setValidationResult] = useState(null);
  const [loading, setLoading] = useState(false);

  // Carregar configuração inicial
  useEffect(() => {
    if (isOpen) {
      loadConfig();
      loadStats();
    }
  }, [isOpen]);

  const loadConfig = async () => {
    try {
      const response = await fetch('/api/security/config');
      const data = await response.json();
      if (data.success) {
        setConfig(data.config);
      }
    } catch (error) {
      console.error('Erro ao carregar configuração:', error);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch('/api/security/stats');
      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    }
  };

  const saveConfig = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/security/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config })
      });
      const data = await response.json();
      if (data.success) {
        alert('Configuração salva com sucesso!');
      } else {
        alert('Erro ao salvar configuração: ' + data.error);
      }
    } catch (error) {
      alert('Erro ao salvar configuração: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const addAllowedCommand = async () => {
    if (!newCommand.trim()) return;
    
    try {
      const response = await fetch('/api/security/allow-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: newCommand.trim() })
      });
      const data = await response.json();
      if (data.success) {
        setConfig(prev => ({
          ...prev,
          allowedCommands: [...prev.allowedCommands, newCommand.trim()]
        }));
        setNewCommand('');
      } else {
        alert('Erro: ' + data.error);
      }
    } catch (error) {
      alert('Erro ao adicionar comando: ' + error.message);
    }
  };

  const removeAllowedCommand = async (command) => {
    try {
      const response = await fetch(`/api/security/allow-command/${encodeURIComponent(command)}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      if (data.success) {
        setConfig(prev => ({
          ...prev,
          allowedCommands: prev.allowedCommands.filter(cmd => cmd !== command)
        }));
      } else {
        alert('Erro: ' + data.error);
      }
    } catch (error) {
      alert('Erro ao remover comando: ' + error.message);
    }
  };

  const blockCommand = async (command) => {
    try {
      const response = await fetch('/api/security/block-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command })
      });
      const data = await response.json();
      if (data.success) {
        setConfig(prev => ({
          ...prev,
          blockedCommands: [...prev.blockedCommands, command],
          allowedCommands: prev.allowedCommands.filter(cmd => cmd !== command)
        }));
      } else {
        alert('Erro: ' + data.error);
      }
    } catch (error) {
      alert('Erro ao bloquear comando: ' + error.message);
    }
  };

  const unblockCommand = async (command) => {
    try {
      const response = await fetch(`/api/security/block-command/${encodeURIComponent(command)}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      if (data.success) {
        setConfig(prev => ({
          ...prev,
          blockedCommands: prev.blockedCommands.filter(cmd => cmd !== command)
        }));
      } else {
        alert('Erro: ' + data.error);
      }
    } catch (error) {
      alert('Erro ao desbloquear comando: ' + error.message);
    }
  };

  const validateCommand = async () => {
    if (!commandToValidate.trim()) return;
    
    try {
      const response = await fetch('/api/security/validate-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: commandToValidate.trim() })
      });
      const data = await response.json();
      if (data.success) {
        setValidationResult(data.validation);
      } else {
        alert('Erro: ' + data.error);
      }
    } catch (error) {
      alert('Erro ao validar comando: ' + error.message);
    }
  };

  const resetStats = async () => {
    if (!confirm('Tem certeza que deseja resetar as estatísticas?')) return;
    
    try {
      const response = await fetch('/api/security/reset-stats', {
        method: 'POST'
      });
      const data = await response.json();
      if (data.success) {
        loadStats();
      } else {
        alert('Erro: ' + data.error);
      }
    } catch (error) {
      alert('Erro ao resetar estatísticas: ' + error.message);
    }
  };

  const formatUptime = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  if (!isOpen) return null;

  return (
    <div className="security-panel-overlay">
      <div className="security-panel">
        <div className="security-panel-header">
          <div className="security-panel-title">
            <FaShieldAlt />
            <span>Configurações de Segurança</span>
          </div>
          <button className="security-panel-close" onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        <div className="security-panel-tabs">
          <button 
            className={`tab ${activeTab === 'config' ? 'active' : ''}`}
            onClick={() => setActiveTab('config')}
          >
            <FaCog /> Configuração
          </button>
          <button 
            className={`tab ${activeTab === 'commands' ? 'active' : ''}`}
            onClick={() => setActiveTab('commands')}
          >
            <FaList /> Comandos
          </button>
          <button 
            className={`tab ${activeTab === 'validate' ? 'active' : ''}`}
            onClick={() => setActiveTab('validate')}
          >
            <FaCheck /> Validar
          </button>
          <button 
            className={`tab ${activeTab === 'stats' ? 'active' : ''}`}
            onClick={() => setActiveTab('stats')}
          >
            <FaChartBar /> Estatísticas
          </button>
        </div>

        <div className="security-panel-content">
          {activeTab === 'config' && (
            <div className="config-tab">
              <div className="config-section">
                <h3><FaClock /> Configurações de Timeout</h3>
                <div className="config-field">
                  <label>Timeout Padrão (ms):</label>
                  <input
                    type="number"
                    value={config.defaultTimeout}
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      defaultTimeout: parseInt(e.target.value) || 30000
                    }))}
                    min="1000"
                    max="600000"
                  />
                </div>
                <div className="config-field">
                  <label>Timeout Máximo (ms):</label>
                  <input
                    type="number"
                    value={config.maxTimeout}
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      maxTimeout: parseInt(e.target.value) || 300000
                    }))}
                    min="10000"
                    max="600000"
                  />
                </div>
              </div>
              
              <div className="config-actions">
                <button 
                  className="btn-primary" 
                  onClick={saveConfig}
                  disabled={loading}
                >
                  {loading ? 'Salvando...' : 'Salvar Configuração'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'commands' && (
            <div className="commands-tab">
              <div className="commands-section">
                <h3><FaCheck /> Comandos Permitidos</h3>
                <div className="add-command">
                  <input
                    type="text"
                    placeholder="Adicionar comando..."
                    value={newCommand}
                    onChange={(e) => setNewCommand(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addAllowedCommand()}
                  />
                  <button onClick={addAllowedCommand}>
                    <FaPlus />
                  </button>
                </div>
                <div className="commands-list">
                  {config.allowedCommands.map((command, index) => (
                    <div key={index} className="command-item allowed">
                      <span>{command}</span>
                      <div className="command-actions">
                        <button 
                          className="btn-danger"
                          onClick={() => blockCommand(command)}
                          title="Bloquear comando"
                        >
                          <FaBan />
                        </button>
                        <button 
                          className="btn-danger"
                          onClick={() => removeAllowedCommand(command)}
                          title="Remover da allowlist"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="commands-section">
                <h3><FaBan /> Comandos Bloqueados</h3>
                <div className="commands-list">
                  {config.blockedCommands.map((command, index) => (
                    <div key={index} className="command-item blocked">
                      <span>{command}</span>
                      <div className="command-actions">
                        <button 
                          className="btn-success"
                          onClick={() => unblockCommand(command)}
                          title="Desbloquear comando"
                        >
                          <FaCheck />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'validate' && (
            <div className="validate-tab">
              <div className="validate-section">
                <h3><FaCheck /> Validar Comando</h3>
                <div className="validate-input">
                  <input
                    type="text"
                    placeholder="Digite o comando para validar..."
                    value={commandToValidate}
                    onChange={(e) => setCommandToValidate(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && validateCommand()}
                  />
                  <button onClick={validateCommand}>
                    Validar
                  </button>
                </div>
                
                {validationResult && (
                  <div className={`validation-result ${validationResult.allowed ? 'allowed' : 'blocked'}`}>
                    <div className="validation-status">
                      {validationResult.allowed ? (
                        <><FaCheck /> Comando Permitido</>
                      ) : (
                        <><FaTimes /> Comando Bloqueado</>
                      )}
                    </div>
                    {validationResult.reason && (
                      <div className="validation-reason">
                        <strong>Motivo:</strong> {validationResult.reason}
                      </div>
                    )}
                    {validationResult.sanitizedCommand && (
                      <div className="validation-sanitized">
                        <strong>Comando Sanitizado:</strong> {validationResult.sanitizedCommand}
                      </div>
                    )}
                    <div className="validation-timeout">
                      <strong>Timeout:</strong> {validationResult.timeout}ms
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'stats' && (
            <div className="stats-tab">
              <div className="stats-header">
                <h3><FaChartBar /> Estatísticas de Segurança</h3>
                <div className="stats-actions">
                  <button onClick={loadStats} title="Atualizar">
                    <FaSync />
                  </button>
                  <button onClick={resetStats} className="btn-danger" title="Resetar">
                    <FaTrash />
                  </button>
                </div>
              </div>
              
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-value">{stats.commandsExecuted}</div>
                  <div className="stat-label">Comandos Executados</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{stats.commandsBlocked}</div>
                  <div className="stat-label">Comandos Bloqueados</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{stats.timeouts}</div>
                  <div className="stat-label">Timeouts</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{stats.activeTimeouts}</div>
                  <div className="stat-label">Timeouts Ativos</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{formatUptime(stats.uptime)}</div>
                  <div className="stat-label">Tempo Ativo</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">
                    {stats.commandsExecuted > 0 
                      ? Math.round((stats.commandsBlocked / (stats.commandsExecuted + stats.commandsBlocked)) * 100)
                      : 0}%
                  </div>
                  <div className="stat-label">Taxa de Bloqueio</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SecurityPanel;