# Agente IA - Sistema de Desenvolvimento Autônomo

## Visão Geral

Sistema completo de agente de IA para desenvolvimento de software com interface interativa, memória persistente e fluxo de aprovação de mudanças. O sistema utiliza Ollama (LLM local) para análise de código e geração inteligente de alterações.

## Arquitetura

O projeto é estruturado em 3 workspaces principais:

### 1. Frontend (`front/`)
- **Tecnologia**: React + Vite
- **Porta**: 5000
- **Função**: Interface do usuário com editor de código, explorador de arquivos, chat interativo e sistema de aprovação de mudanças

### 2. API (`api/`)
- **Tecnologia**: Express.js
- **Porta**: 5050
- **Função**: Proxy para o agente, gerenciamento de tarefas e fila de execução

### 3. Agente (`agente/`)
- **Tecnologia**: Express.js + SQLite + Ollama
- **Porta**: 6060
- **Função**: Serviço principal do agente IA com análise de código, geração de mudanças e integração Git

## Funcionalidades

### 🤖 Agente Inteligente
- Análise automática de projetos e contexto
- Compreensão de intenções usando LLM (Ollama local)
- Geração inteligente de mudanças de código
- Memória persistente em SQLite (`~/.agente-ia/agente.db`)

### 🖼️ Análise de Imagem com IA
- Upload e análise de imagens usando modelo de visão (LLaVA)
- Streaming em tempo real com visualização progressiva
- Timeline interativa mostrando o progresso da análise
- Botão de interromper análise a qualquer momento
- Contextualização automática para o agente entender imagens

### 📊 Sistema de Memória
- Histórico completo de projetos e mudanças
- Contexto de arquivos acessados
- Conversas salvas para continuidade
- Tabelas: projetos, arquivos_contexto, mudancas_pendentes, historico, conversas

### ✅ Fluxo de Aprovação
- Mudanças propostas pelo agente aguardam aprovação
- Visualização de diff antes de aplicar
- Aprovação/rejeição individual
- Commit automático após aprovação

### 🔄 Integração Git
- Clonagem automática de repositórios
- Criação de branches automáticas
- Commits e push automáticos
- Suporte a tokens de autenticação

## Configuração no Replit

O projeto está configurado para funcionar perfeitamente no Replit:

1. **Workflow**: Executa todos os 3 serviços simultaneamente usando concurrently
2. **Porta Frontend**: 5000 (configurada para aceitar proxy do Replit)
3. **Portas Backend**: API (5050) e Agente (6060) em localhost
4. **Deployment**: Configurado para VM com build do frontend

## Como Usar

### 1. Abrir um Projeto

**Opção A - Projeto Local:**
- Informe o caminho completo no campo "Caminho Local"
- Exemplo: `/home/runner/workspace/meu-projeto`

**Opção B - Clonar Repositório:**
- Informe a URL do repositório
- Defina a branch base (padrão: main)
- O agente clonará automaticamente para `~/Downloads/agente/`

### 2. Conversar com o Agente

Digite solicitações no chat, como:
- "Alterar o título da página inicial"
- "Adicionar um botão de logout no header"
- "Criar um componente de loading"
- "Refatorar a função de validação"

### 3. Aprovar Mudanças

Quando o agente propor mudanças:
1. Clique em "X Mudança(s) Pendente(s)"
2. Revise o diff de cada mudança
3. Aprove ou rejeite individualmente
4. Mudanças aprovadas são aplicadas automaticamente

### 4. Analisar Imagens (Novo!)

Para adicionar contexto visual ao agente:
1. Clique em "📎 Selecionar Imagem"
2. Escolha uma imagem (screenshot, diagrama, mockup)
3. Clique em "🚀 Analisar Imagem"
4. Veja a análise em tempo real com streaming
5. Use "⏸️ Interromper" se quiser cancelar
6. O resultado será automaticamente contextualizado no chat

### 5. Fazer Commit

Após aprovar e testar:
- Clique em "Commit & Push"
- O agente fará commit e push automático

## Requisitos Importantes

### ⚠️ Ollama (LLM Local)

O sistema requer **Ollama** rodando localmente em `http://localhost:11434`:

```bash
# Modelos de código (obrigatório)
ollama pull qwen2.5-coder:7b
# ou
ollama pull codellama:7b

# Modelo de visão para análise de imagem (opcional)
ollama pull llava:7b
```

### Variáveis de Ambiente

**agente/.env:**
```env
AGENTE_PORTA=6060
OLLAMA_URL=http://localhost:11434
LLM_MODEL=qwen2.5-coder:7b
VISION_MODEL=llava:7b
```

**api/.env (opcional):**
```env
API_PORTA=5050
AGENTE_PORTA=6060
```

**front/.env:**
```env
VITE_API_URL=/api
VITE_AGENT_URL=/agente
```

## Estrutura de Diretórios

```
agente-ia-js/
├── agente/           # Serviço do agente IA
│   └── src/
│       ├── index.js       # API e rotas principais
│       ├── database.js    # Sistema de memória SQLite
│       ├── analisador.js  # Análise inteligente de mudanças
│       ├── llm.js         # Integração com Ollama
│       ├── ferramentas.js # Utilitários Git
│       └── memoria.js     # Sistema legado de memória
│
├── api/              # API de tarefas
│   └── src/
│       ├── index.js       # Proxy e gerenciamento
│       └── fila.js        # Fila de tarefas
│
├── front/            # Interface React
│   └── src/
│       ├── app.jsx        # Componente principal
│       └── main.jsx       # Entry point
│
└── package.json      # Configuração workspaces
```

## Limitações e Notas

1. **Ollama Local**: O sistema usa apenas Ollama local, sem APIs cloud
2. **Contexto LLM**: Limitado pelo tamanho de contexto do modelo escolhido
3. **Projetos Grandes**: Análise pode ser lenta em projetos muito grandes
4. **Segurança**: Tokens Git mantidos em memória, não salvos
5. **Banco de Dados**: SQLite local, não compartilhado

## Troubleshooting

### Porta em Uso
As portas são detectadas automaticamente. Se houver conflito, o sistema tenta as próximas 50 portas.

### Banco de Dados Corrompido
```bash
rm ~/.agente-ia/agente.db
```

### Mudanças Não Detectadas
- Verifique se o projeto foi aberto corretamente
- Certifique-se de que o agente está conectado
- Reabra o projeto se necessário

## Funcionalidades Recentes

### ✅ Análise de Imagem com Streaming (Implementado!)
- Upload e análise de imagens com LLaVA
- Visualização progressiva tipo "thinking"
- Timeline interativa com timestamps
- Botão de interromper análise
- Integração automática com chat

## Próximas Melhorias Planejadas

Com base nas instruções recebidas, o sistema pode ser aprimorado para ser mais autônomo:

- [ ] Sistema de planejamento (quebrar objetivos em passos)
- [ ] Executor de ações com sandbox
- [ ] Validador/Verificador automático (testes, lint)
- [ ] Guardrails de segurança
- [ ] Observabilidade avançada (traces, snapshots)
- [ ] Loop percepção-ação completo
- [ ] Ferramentas adicionais (navegador, shell, APIs)

## Tecnologias Utilizadas

- **Frontend**: React 18, Vite 5, Highlight.js
- **Backend**: Node.js 18+, Express 4
- **Database**: better-sqlite3
- **LLM**: Ollama (local)
- **Git**: simple-git
- **Dev Tools**: nodemon, concurrently

## Segurança

- Nenhuma informação enviada para servidores externos
- Apenas Ollama local é usado
- Tokens Git não são persistidos
- Banco de dados local (não compartilhado)
