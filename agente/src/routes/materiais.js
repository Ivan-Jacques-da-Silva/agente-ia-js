import express from 'express';
import { 
  criarMaterial, 
  listarMateriais, 
  buscarMaterialPorId, 
  atualizarMaterial, 
  excluirMaterial, 
  removerMaterialPermanente,
  listarCategoriasMateriais 
} from '../database.js';

const router = express.Router();

// GET /api/materiais - Listar todos os materiais
router.get('/', (req, res) => {
  try {
    const { categoria, ativo } = req.query;
    const materiais = listarMateriais(categoria, ativo !== 'false');
    res.json({ success: true, data: materiais });
  } catch (error) {
    console.error('Erro ao listar materiais:', error);
    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

// GET /api/materiais/categorias - Listar categorias
router.get('/categorias', (req, res) => {
  try {
    const categorias = listarCategoriasMateriais();
    res.json({ success: true, data: categorias });
  } catch (error) {
    console.error('Erro ao listar categorias:', error);
    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

// GET /api/materiais/:id - Buscar material por ID
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const material = buscarMaterialPorId(parseInt(id));
    
    if (!material) {
      return res.status(404).json({ success: false, error: 'Material não encontrado' });
    }
    
    res.json({ success: true, data: material });
  } catch (error) {
    console.error('Erro ao buscar material:', error);
    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

// POST /api/materiais - Criar novo material
router.post('/', (req, res) => {
  try {
    const { nome, categoria, cor, icone, posicaoX, posicaoY, descricao, propriedades } = req.body;
    
    if (!nome || !categoria) {
      return res.status(400).json({ 
        success: false, 
        error: 'Nome e categoria são obrigatórios' 
      });
    }
    
    const materialId = criarMaterial(
      nome, 
      categoria, 
      cor, 
      icone, 
      posicaoX, 
      posicaoY, 
      descricao, 
      propriedades
    );
    
    const novoMaterial = buscarMaterialPorId(materialId);
    res.status(201).json({ success: true, data: novoMaterial });
  } catch (error) {
    console.error('Erro ao criar material:', error);
    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

// PUT /api/materiais/:id - Atualizar material
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const dados = req.body;
    
    const materialExistente = buscarMaterialPorId(parseInt(id));
    if (!materialExistente) {
      return res.status(404).json({ success: false, error: 'Material não encontrado' });
    }
    
    atualizarMaterial(parseInt(id), dados);
    const materialAtualizado = buscarMaterialPorId(parseInt(id));
    
    res.json({ success: true, data: materialAtualizado });
  } catch (error) {
    console.error('Erro ao atualizar material:', error);
    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

// DELETE /api/materiais/:id - Excluir material (soft delete)
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { permanente } = req.query;
    
    const materialExistente = buscarMaterialPorId(parseInt(id));
    if (!materialExistente) {
      return res.status(404).json({ success: false, error: 'Material não encontrado' });
    }
    
    if (permanente === 'true') {
      removerMaterialPermanente(parseInt(id));
    } else {
      excluirMaterial(parseInt(id));
    }
    
    res.json({ success: true, message: 'Material excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir material:', error);
    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

export default router;