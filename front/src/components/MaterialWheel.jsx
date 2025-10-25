import React, { useState, useEffect, useRef } from 'react';
import './MaterialWheel.css';

const MaterialWheel = ({ onMaterialSelect, selectedMaterial }) => {
  const [materials, setMaterials] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const wheelRef = useRef(null);

  // Carregar materiais e categorias
  useEffect(() => {
    loadMaterials();
    loadCategories();
  }, [selectedCategory]);

  const loadMaterials = async () => {
    try {
      setIsLoading(true);
      const params = selectedCategory !== 'all' ? `?categoria=${selectedCategory}` : '';
      const response = await fetch(`http://localhost:3001/api/materiais${params}`);
      const data = await response.json();
      
      if (data.success) {
        setMaterials(data.data);
      } else {
        setError('Erro ao carregar materiais');
      }
    } catch (err) {
      setError('Erro de conexão com o servidor');
      console.error('Erro ao carregar materiais:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/materiais/categorias');
      const data = await response.json();
      
      if (data.success) {
        setCategories(['all', ...data.data]);
      }
    } catch (err) {
      console.error('Erro ao carregar categorias:', err);
    }
  };

  // Calcular posição dos materiais na roda
  const calculatePosition = (index, total) => {
    const angle = (index * 360) / total;
    const radius = 120;
    const x = Math.cos((angle * Math.PI) / 180) * radius;
    const y = Math.sin((angle * Math.PI) / 180) * radius;
    return { x, y, angle };
  };

  const handleMaterialClick = (material) => {
    if (onMaterialSelect) {
      onMaterialSelect(material);
    }
  };

  if (isLoading) {
    return (
      <div className="material-wheel-container">
        <div className="wheel-loading">
          <div className="spinner"></div>
          <span>Carregando materiais...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="material-wheel-container">
        <div className="wheel-error">
          <span>{error}</span>
          <button onClick={loadMaterials}>Tentar novamente</button>
        </div>
      </div>
    );
  }

  return (
    <div className="material-wheel-container">
      {/* Filtro de categorias */}
      <div className="category-filter">
        {categories.map(category => (
          <button
            key={category}
            className={`category-btn ${selectedCategory === category ? 'active' : ''}`}
            onClick={() => setSelectedCategory(category)}
          >
            {category === 'all' ? 'Todos' : category}
          </button>
        ))}
      </div>

      {/* Roda de materiais */}
      <div className="material-wheel" ref={wheelRef}>
        <div className="wheel-center">
          <div className="center-icon">
            <span>🎯</span>
          </div>
          <div className="center-text">Materiais</div>
        </div>

        {materials.map((material, index) => {
          const position = calculatePosition(index, materials.length);
          const isSelected = selectedMaterial && selectedMaterial.id === material.id;
          
          return (
            <div
              key={material.id}
              className={`material-item ${isSelected ? 'selected' : ''}`}
              style={{
                transform: `translate(${position.x}px, ${position.y}px)`,
                '--material-color': material.cor
              }}
              onClick={() => handleMaterialClick(material)}
              title={material.descricao || material.nome}
            >
              <div className="material-icon">
                {material.icone === 'circle' ? '●' : material.icone}
              </div>
              <div className="material-name">{material.nome}</div>
            </div>
          );
        })}

        {/* Linhas conectoras */}
        {materials.map((_, index) => {
          const position = calculatePosition(index, materials.length);
          return (
            <div
              key={`line-${index}`}
              className="connector-line"
              style={{
                transform: `rotate(${position.angle}deg)`,
                transformOrigin: '0 0'
              }}
            />
          );
        })}
      </div>

      {/* Informações do material selecionado */}
      {selectedMaterial && (
        <div className="material-info">
          <h3>{selectedMaterial.nome}</h3>
          <p className="material-category">{selectedMaterial.categoria}</p>
          {selectedMaterial.descricao && (
            <p className="material-description">{selectedMaterial.descricao}</p>
          )}
          {selectedMaterial.propriedades && (
            <div className="material-properties">
              <h4>Propriedades:</h4>
              <pre>{JSON.stringify(selectedMaterial.propriedades, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MaterialWheel;