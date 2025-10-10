# 🖼️ Guia de Análise de Imagem com IA

## O que é?

Sistema de análise de imagem integrado ao agente, usando **Ollama + LLaVA** (100% local e gratuito). A IA "vê" a imagem e contextualiza para o agente entender visualmente o que você precisa.

## Como Funciona

### 1. **Upload de Imagem**
- Clique em "📎 Selecionar Imagem"
- Escolha qualquer imagem:
  - Screenshots de interfaces
  - Mockups de design
  - Diagramas de arquitetura
  - Prints de código
  - Wireframes
  - Fotos de quadros brancos

### 2. **Análise com Streaming**
- Clique em "🚀 Analisar Imagem"
- Veja a análise acontecendo em **tempo real**:
  - 🔍 "Analisando imagem..."
  - 💭 Texto aparecendo progressivamente (como eu penso)
  - ⏱️ Timeline com timestamps
  - ✅ "Análise completa!"

### 3. **Controles**
- **⏸️ Interromper**: Cancela análise a qualquer momento
- **🗑️ Limpar**: Remove imagem e histórico

### 4. **Integração Automática**
- Resultado vai direto pro chat
- Agente usa contexto da imagem
- Pode fazer mudanças baseado no visual

## Exemplos de Uso

### 📱 Screenshot de Interface
```
Você envia: [Screenshot de uma tela com botão quebrado]
IA analisa: "Vejo uma interface com botão azul desalinhado no canto superior direito..."
Você pede: "Corrige esse botão que a IA viu"
```

### 🎨 Mockup de Design  
```
Você envia: [Mockup do Figma]
IA analisa: "Design mostra header com logo à esquerda, menu centralizado..."
Você pede: "Implementa esse layout que a IA descreveu"
```

### 📊 Diagrama de Arquitetura
```
Você envia: [Diagrama de fluxo]
IA analisa: "Diagrama mostra banco de dados conectado à API REST..."
Você pede: "Cria essa arquitetura baseado no diagrama"
```

## Tecnologia

### Backend (100% Local)
- **Ollama** rodando em `localhost:11434`
- **Modelo LLaVA 7B** para visão
- **Streaming SSE** (Server-Sent Events)
- **Cancelamento** via close connection

### Frontend
- **Upload de imagem** (base64)
- **Timeline progressiva** com animações
- **Visualização tipo "thinking"** (como assistentes IA)
- **Integração automática** com chat

## Instalação do Modelo

```bash
# Baixar modelo de visão (primeira vez)
ollama pull llava:7b

# Verificar se está disponível
ollama list | grep llava
```

## Configuração

**agente/.env**:
```env
VISION_MODEL=llava:7b
OLLAMA_URL=http://localhost:11434
```

## Características Técnicas

### ✨ Streaming Visual
- Texto aparece progressivamente
- Cursor piscante durante análise
- Animações de fade-in
- Scroll automático

### 🎯 Timeline Interativa
- Timestamp de cada evento
- Status visual com cores:
  - 🔵 Azul = processando
  - 🟢 Verde = sucesso
  - 🔴 Vermelho = erro
- Histórico completo navegável

### ⚡ Performance
- Análise local (sem latência de API)
- Cancelamento instantâneo
- Memória persistente no SQLite
- Hot reload no frontend

## Limitações

- **Modelo local**: Depende de Ollama instalado
- **Tamanho**: Imagens muito grandes podem demorar
- **Qualidade**: LLaVA 7B é bom mas não perfeito
- **Idioma**: Respostas podem vir em inglês (depende do modelo)

## Dicas

1. **Imagens claras**: Use screenshots nítidos
2. **Contexto**: Adicione descrição no prompt se quiser
3. **Interrompa**: Se demorar demais, cancele e tente de novo
4. **Combine**: Use análise + chat para refinar

## Próximos Passos

- [ ] Suporte a múltiplas imagens
- [ ] Comparação lado a lado
- [ ] Extração de texto (OCR)
- [ ] Geração de código direto da imagem
- [ ] Templates de prompts por tipo de imagem

---

**100% Local | 100% Grátis | 100% Open Source** 🚀
