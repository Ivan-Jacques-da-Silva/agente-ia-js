import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [count, setCount] = useState(0);
  const [message, setMessage] = useState('Bem-vindo ao seu novo projeto React!');

  useEffect(() => {
    document.title = 'Projeto 1760501016357';
  }, []);

  const handleClick = () => {
    setCount(count + 1);
    setMessage(`Você clicou ${count + 1} vez${count + 1 === 1 ? '' : 'es'}!`);
  };

  return (
    <div className="App">
      <header className="App-header">
        <div className="logo-container">
          <div className="logo">⚛️</div>
          <h1>Projeto 1760501016357</h1>
        </div>
        
        <div className="content">
          <p className="welcome-message">{message}</p>
          
          <div className="counter-section">
            <button 
              className="counter-button" 
              onClick={handleClick}
              aria-label="Incrementar contador"
            >
              Clique aqui: {count}
            </button>
          </div>

          <div className="features">
            <div className="feature-card">
              <h3>🚀 Rápido</h3>
              <p>Construído com React 18 e as melhores práticas</p>
            </div>
            <div className="feature-card">
              <h3>🎨 Moderno</h3>
              <p>Interface limpa e responsiva</p>
            </div>
            <div className="feature-card">
              <h3>🔧 Configurável</h3>
              <p>Pronto para personalização e expansão</p>
            </div>
          </div>

          <div className="getting-started">
            <h2>Próximos Passos</h2>
            <ul>
              <li>Edite <code>src/App.js</code> para personalizar esta página</li>
              <li>Adicione novos componentes em <code>src/components/</code></li>
              <li>Execute <code>npm start</code> para desenvolvimento</li>
              <li>Execute <code>npm run build</code> para produção</li>
            </ul>
          </div>
        </div>
      </header>
    </div>
  );
}

export default App;