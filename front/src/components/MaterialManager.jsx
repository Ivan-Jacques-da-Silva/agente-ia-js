import React, { useState, useEffect } from 'react';
import MaterialWheel from './MaterialWheel';
import './MaterialManager.css';

const MaterialManager = () => {
  const [materials, setMaterials] = useState([]);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    categoria: '',
    cor: '#3498db',
    icone: 'circle',
    descricao: '',
    propriedades: {}
  });

  const defaultCategories = ['Metais', 'Polímeros', 'Cerâmicos', 'Compósitos', 'Naturais'];
  const defaultIcons = ['●', '■', '▲', '♦', '★', '⬢', '⬟', '◉'];

  useEffect(() => {
    loadMaterials();
  }, []);

  const loadMaterials = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/materiais');
      const data = await response.json();
      if (data.success) {
        setMaterials(data.data);
      }
    } catch (error) {
      console.error('Erro ao carregar materiais:', error);
    }
  };

  const handleMaterialSelect = (material) => {
    setSelectedMaterial(material);
    setIsEditing(false);
  };

  const handleCreateNew = () => {
    setFormData({
      nome: '',
      categoria: '',
      cor: '#3498db',
      icone: 'circle',
      descricao: '',
      propriedades: {}
    });
    setIsEditing(false);
    setShowForm(true);
  };

  const handleEdit = () => {
    if (selectedMaterial) {
      setFormData({
        nome: selectedMaterial.nome,
        categoria: selectedMaterial.categoria,
        cor: selectedMaterial.cor,
        icone: selectedMaterial.icone,
        descricao: selectedMaterial.descricao || '',
        propriedades: selectedMaterial.propriedades || {}
      });
      setIsEditing(true);
      setShowForm(true);
    }
  };

  const handleDelete = async () => {
    if (selectedMaterial && window.confirm('Tem certeza que deseja excluir este material?')) {
      try {
        const response = await fetch(`http://localhost:3001/api/materiais/${selectedMaterial.id}`, {
          method: 'DELETE'
        });
        const data = await response.json();
        
        if (data.success) {
          setSelectedMaterial(null);
          loadMaterials();
        } else {
          alert('Erro ao excluir material');
        }
      } catch (error) {
        console.error('Erro ao excluir material:', error);
        alert('Erro de conexão');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.nome || !formData.categoria) {
      alert('Nome e categoria são obrigatórios');
      return;
    }

    try {
      const url = isEditing 
        ? `http://localhost:3001/api/materiais/${selectedMaterial.id}`
        : 'http://localhost:3001/api/materiais';
      
      const method = isEditing ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();
      
      if (data.success) {
        setShowForm(false);
        setSelectedMaterial(data.data);
        loadMaterials();
      } else {
        alert('Erro ao salvar material');
      }
    } catch (error) {
      console.error('Erro ao salvar material:', error);
      alert('Erro de conexão');
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const addProperty = () => {
    const key = prompt('Nome da propriedade:');
    const value = prompt('Valor da propriedade:');
    
    if (key && value) {
      setFormData(prev => ({
        ...prev,
        propriedades: {
          ...prev.propriedades,
          [key]: value
        }
      }));
    }
  };

  const removeProperty = (key) => {
    setFormData(prev => {
      const newProps = { ...prev.propriedades };
      delete newProps[key];
      return {
        ...prev,
        propriedades: newProps
      };
    });
  };

  return (
    <div className="material-manager">
      <div className="manager-header">
        <h2>Sistema de Roda dos Materiais</h2>
        <div className="header-actions">
          <button className="btn-primary" onClick={handleCreateNew}>
            Novo Material
          </button>
          {selectedMaterial && (
            <>
              <button className="btn-secondary" onClick={handleEdit}>
                Editar
              </button>
              <button className="btn-danger" onClick={handleDelete}>
                Excluir
              </button>
            </>
          )}
        </div>
      </div>

      <div className="manager-content">
        <MaterialWheel 
          onMaterialSelect={handleMaterialSelect}
          selectedMaterial={selectedMaterial}
        />
      </div>

      {/* Modal do formulário */}
      {showForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{isEditing ? 'Editar Material' : 'Novo Material'}</h3>
              <button 
                className="close-btn"
                onClick={() => setShowForm(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="material-form">
              <div className="form-group">
                <label>Nome *</label>
                <input
                  type="text"
                  value={formData.nome}
                  onChange={(e) => handleInputChange('nome', e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Categoria *</label>
                <select
                  value={formData.categoria}
                  onChange={(e) => handleInputChange('categoria', e.target.value)}
                  required
                >
                  <option value="">Selecione uma categoria</option>
                  {defaultCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Cor</label>
                  <input
                    type="color"
                    value={formData.cor}
                    onChange={(e) => handleInputChange('cor', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Ícone</label>
                  <select
                    value={formData.icone}
                    onChange={(e) => handleInputChange('icone', e.target.value)}
                  >
                    {defaultIcons.map(icon => (
                      <option key={icon} value={icon}>{icon}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Descrição</label>
                <textarea
                  value={formData.descricao}
                  onChange={(e) => handleInputChange('descricao', e.target.value)}
                  rows="3"
                />
              </div>

              <div className="form-group">
                <label>Propriedades</label>
                <div className="properties-list">
                  {Object.entries(formData.propriedades).map(([key, value]) => (
                    <div key={key} className="property-item">
                      <span>{key}: {value}</span>
                      <button 
                        type="button"
                        onClick={() => removeProperty(key)}
                        className="remove-prop-btn"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button 
                    type="button"
                    onClick={addProperty}
                    className="add-prop-btn"
                  >
                    + Adicionar Propriedade
                  </button>
                </div>
              </div>

              <div className="form-actions">
                <button type="button" onClick={() => setShowForm(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  {isEditing ? 'Atualizar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MaterialManager;