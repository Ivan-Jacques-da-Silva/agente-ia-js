# Arquitetura do Sistema Agente IA

## Visão Geral

```
┌─────────────────────────────────────────────────────────┐
│                    Navegador (Vite)                     │
│                                                         │
│  ┌──────────────────────────────────────────────────┐ │
│  │              Interface React (Front)              │ │
│  │  • Editor de código                               │ │
│  │  • Explorador de arquivos                         │ │
│  │  • Chat interativo                                │ │
│  │  • Modal de aprovação                             │ │
│  └──────────────────────────────────────────────────┘ │
│                       ↓ HTTP/JSON ↓                     │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                    API Express (Proxy)                  │
│  • Porta 5050                                           │
│  • Proxy /agente → Agente Service                       │
│  • Gerenciamento de tarefas                             │
│  • Fila de execução                                     │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│              Agente IA Service (Express)                │
│  • Porta 6060                                           │
│                                                         │
│  ┌──────────────────────────────────────────────────┐ │
│  │              Sistema de Rotas                     │ │
│  │  • /repo/abrir                                    │ │
│  │  • /repo/file, /repo/save                         │ │
│  │  • /chat/inteligente                              │ │
│  │  • /mudancas/pendentes, aprovar, rejeitar         │ │
│  └──────────────────────────────────────────────────┘ │
│                          ↓                              │
│  ┌──────────────────────────────────────────────────┐ │
│  │           Analisador Inteligente                  │ │
│  │  • analisarIntencao()                             │ │
│  │  • gerarMudancaInteligente()                      │ │
│  │  • analisarDiferencas()                           │ │
│  │  • gerarDiff()                                    │ │
│  └──────────────────────────────────────────────────┘ │
│                          ↓                              │
│  ┌──────────────────────────────────────────────────┐ │
│  │           Sistema de Memória (SQLite)             │ │
│  │  • projetos                                       │ │
│  │  • arquivos_contexto                              │ │
│  │  • mudancas_pendentes                             │ │
│  │  • historico                                      │ │
│  │  • conversas                                      │ │
│  └──────────────────────────────────────────────────┘ │
│                          ↓                              │
│  ┌──────────────────────────────────────────────────┐ │
│  │                Ferramentas Git                    │ │
│  │  • clonar_repositorio()                           │ │
│  │  • criar_branch()                                 │ │
│  │  • commit_e_push()                                │ │
│  └──────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                   Ollama (LLM Local)                    │
│  • Porta 11434                                          │
│  • Modelos: qwen2.5-coder, codellama, etc              │
│  • Endpoints: /api/generate, /api/chat                  │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                  Sistema de Arquivos                    │
│  • ~/.agente-ia/agente.db (banco SQLite)                │
│  • /tmp/repo_* (repositórios clonados)                  │
│  • Projeto local do usuário                             │
└─────────────────────────────────────────────────────────┘
```

## Fluxo de Dados

### 1. Abertura de Projeto

```
Usuario (Front) → API → Agente
                          ↓
                  ┌───────────────┐
                  │ Verificar DB  │
                  └───────────────┘
                          ↓
            ┌─────────────┴─────────────┐
            │                           │
        Existe                      Não Existe
            ↓                           ↓
    ┌──────────────┐           ┌──────────────┐
    │ Atualizar    │           │ Clonar/      │
    │ último_acesso│           │ Abrir local  │
    └──────────────┘           └──────────────┘
            ↓                           ↓
    ┌──────────────────────────────────────┐
    │    Criar/Atualizar no DB             │
    └──────────────────────────────────────┘
            ↓
    ┌──────────────────────────────────────┐
    │    Analisar estrutura                │
    │    • Ler package.json               │
    │    • Detectar tecnologias           │
    │    • Gerar resumo (LLM)             │
    └──────────────────────────────────────┘
            ↓
    ┌──────────────────────────────────────┐
    │    Retornar ao Front                 │
    │    • Árvore de arquivos             │
    │    • Conversas anteriores           │
    │    • Histórico                      │
    │    • Mudanças pendentes             │
    └──────────────────────────────────────┘
```

### 2. Chat Inteligente

```
Usuario digita mensagem → Front → API → Agente
                                          ↓
                              ┌──────────────────┐
                              │ Salvar no DB     │
                              │ (conversas)      │
                              └──────────────────┘
                                          ↓
                              ┌──────────────────────────┐
                              │ Analisar Intenção (LLM)  │
                              │ • Identificar arquivos   │
                              │ • Avaliar complexidade   │
                              │ • Detectar riscos        │
                              └──────────────────────────┘
                                          ↓
                              ┌──────────────────────────┐
                              │ Buscar Contexto (DB)     │
                              │ • Arquivos recentes      │
                              │ • Tecnologias            │
                              │ • Conversas anteriores   │
                              └──────────────────────────┘
                                          ↓
                              ┌──────────────────────────┐
                              │ Gerar Mudanças (LLM)     │
                              │ • Ler arquivos           │
                              │ • Gerar código novo      │
                              │ • Criar diff             │
                              └──────────────────────────┘
                                          ↓
                              ┌──────────────────────────┐
                              │ Criar Mudanças Pendentes │
                              │ (mudancas_pendentes)     │
                              └──────────────────────────┘
                                          ↓
                              ┌──────────────────────────┐
                              │ Registrar Histórico      │
                              │ (historico)              │
                              └──────────────────────────┘
                                          ↓
                      Retornar resposta + contador mudanças
```

### 3. Aprovação de Mudança

```
Usuario clica "Aprovar" → Front → API → Agente
                                          ↓
                              ┌──────────────────────────┐
                              │ Buscar Mudança (DB)      │
                              │ WHERE id = mudancaId     │
                              └──────────────────────────┘
                                          ↓
                              ┌──────────────────────────┐
                              │ Aplicar no Sistema       │
                              │ • fs.writeFile()         │
                              │ • Criar diretórios       │
                              └──────────────────────────┘
                                          ↓
                              ┌──────────────────────────┐
                              │ Atualizar Status (DB)    │
                              │ status = 'aprovada'      │
                              └──────────────────────────┘
                                          ↓
                              ┌──────────────────────────┐
                              │ Registrar Histórico      │
                              │ tipo = 'mudanca_aprovada'│
                              └──────────────────────────┘
                                          ↓
                              Retornar sucesso + arquivo alterado
```

## Componentes Principais

### Front (React + Vite)

**Arquivo:** `front/src/app.jsx`

**Responsabilidades:**
- Renderizar interface do usuário
- Gerenciar estado local (arquivos, chat, etc)
- Comunicar com API via fetch
- Resolver endpoints automaticamente
- Exibir modal de mudanças pendentes

**Hooks principais:**
- `useState` - Estado de componentes
- `useEffect` - Efeitos e sincronização
- `useMemo` - Computações custosas
- `useCallback` - Callbacks otimizados
- `useEndpointResolver` - Resolver URLs

### API (Express)

**Arquivo:** `api/src/index.js`

**Responsabilidades:**
- Proxy para o Agente
- Gerenciar fila de tarefas
- Resolver porta do Agente dinamicamente
- CORS para front

**Rotas:**
- `GET /saude` - Health check
- `POST /tarefas` - Criar tarefa
- `GET /tarefas/:id` - Status da tarefa
- `POST /repo/abrir` - Proxy para agente
- `*` `/proxy/agente` - Proxy genérico

### Agente (Express + SQLite)

**Arquivo:** `agente/src/index.js`

**Responsabilidades:**
- Gerenciar projetos
- Processar chat inteligente
- Controlar mudanças pendentes
- Integrar com Git
- Integrar com Ollama

**Rotas principais:**
- `POST /repo/abrir` - Abrir projeto
- `GET /repo/tree` - Árvore de arquivos
- `GET /repo/file` - Ler arquivo
- `POST /repo/save` - Salvar arquivo
- `POST /repo/commit` - Commit e push
- `POST /chat/inteligente` - Chat com IA
- `GET /mudancas/pendentes` - Listar mudanças
- `POST /mudancas/aprovar` - Aprovar mudança
- `POST /mudancas/rejeitar` - Rejeitar mudança

### Analisador (Módulo)

**Arquivo:** `agente/src/analisador.js`

**Funções principais:**

**`analisarIntencao(mensagem, projetoId, arvore)`**
- Analisa intenção do usuário
- Identifica arquivos relevantes
- Retorna análise estruturada

**`gerarMudancaInteligente(mensagem, projetoId, pasta, arvore)`**
- Gera mudanças de código
- Usa contexto do projeto
- Retorna array de mudanças

**`analisarDiferencas(original, novo)`**
- Compara dois conteúdos
- Conta linhas adicionadas/removidas/modificadas
- Retorna estatísticas

**`gerarDiff(original, novo, arquivo)`**
- Gera diff formato git
- Linha por linha
- Formato unificado

### Database (Módulo SQLite)

**Arquivo:** `agente/src/database.js`

**Funções principais:**

**Projetos:**
- `criarProjeto(nome, url, caminho, branch)`
- `buscarProjetoPorUrl(url)`
- `buscarProjetoPorCaminho(caminho)`
- `atualizarUltimoAcesso(id)`
- `listarProjetos(limite)`

**Contexto:**
- `salvarContextoArquivo(projetoId, caminho, conteudo, analise)`
- `buscarContextoProjeto(projetoId, limite)`

**Mudanças:**
- `criarMudancaPendente(projetoId, arquivo, original, novo, diff, desc)`
- `buscarMudancasPendentes(projetoId)`
- `aprovarMudanca(id)`
- `rejeitarMudanca(id)`

**Histórico:**
- `registrarHistorico(projetoId, tipo, descricao, dados)`
- `buscarHistorico(projetoId, limite)`

**Conversas:**
- `salvarConversa(projetoId, mensagem, resposta, contexto)`
- `buscarConversas(projetoId, limite)`

### LLM (Módulo Ollama)

**Arquivo:** `agente/src/llm.js`

**Funções:**

**`chat_simples(mensagem, contexto)`**
- Chat básico com Ollama
- Suporta /api/generate e /api/chat
- Retorna resposta do modelo

**`pedir_plano(contexto, tarefa)`**
- Gera plano estruturado
- Retorna JSON com objetivos, passos, critérios

**`pickModel()`**
- Seleciona modelo disponível
- Tenta baixar se não existe
- Fallbacks para modelos alternativos

### Ferramentas Git (Módulo)

**Arquivo:** `agente/src/ferramentas.js`

**Funções:**
- `clonar_repositorio(url, destino, token)`
- `criar_branch(destino, nome, base)`
- `commit_e_push(destino, mensagem)`
- `rodar_testes(destino)`
- `aplicar_patch(destino, diff)`

## Banco de Dados

### Localização
```
~/.agente-ia/agente.db
```

### Schema

**projetos**
```sql
CREATE TABLE projetos (
  id INTEGER PRIMARY KEY,
  nome TEXT NOT NULL,
  caminho_local TEXT,
  repositorio_url TEXT,
  branch_padrao TEXT DEFAULT 'main',
  ultimo_acesso DATETIME,
  criado_em DATETIME,
  metadata TEXT
);
```

**arquivos_contexto**
```sql
CREATE TABLE arquivos_contexto (
  id INTEGER PRIMARY KEY,
  projeto_id INTEGER NOT NULL,
  caminho TEXT NOT NULL,
  conteudo TEXT,
  hash TEXT,
  analise TEXT,
  atualizado_em DATETIME,
  UNIQUE(projeto_id, caminho)
);
```

**mudancas_pendentes**
```sql
CREATE TABLE mudancas_pendentes (
  id INTEGER PRIMARY KEY,
  projeto_id INTEGER NOT NULL,
  arquivo TEXT NOT NULL,
  conteudo_original TEXT,
  conteudo_novo TEXT,
  diff TEXT,
  descricao TEXT,
  status TEXT DEFAULT 'pendente',
  criado_em DATETIME,
  aplicado_em DATETIME
);
```

**historico**
```sql
CREATE TABLE historico (
  id INTEGER PRIMARY KEY,
  projeto_id INTEGER NOT NULL,
  tipo TEXT NOT NULL,
  descricao TEXT,
  dados TEXT,
  timestamp DATETIME
);
```

**conversas**
```sql
CREATE TABLE conversas (
  id INTEGER PRIMARY KEY,
  projeto_id INTEGER NOT NULL,
  mensagem TEXT NOT NULL,
  resposta TEXT,
  contexto TEXT,
  timestamp DATETIME
);
```

## Segurança

### Validações
- Path traversal prevention (normalized paths)
- SQL injection prevention (prepared statements)
- Input sanitization

### Dados Sensíveis
- Tokens Git não persistidos (memória apenas)
- Banco local (não compartilhado)
- Sem comunicação externa (exceto Ollama local)

## Performance

### Otimizações
- Índices em tabelas SQLite
- Cache de contexto em DB
- Análise limitada (5000 arquivos)
- Profundidade máxima de 6 níveis
- Carregamento assíncrono

### Limites
- Conteúdo de arquivo: 100KB salvo no DB
- Diff preview: 1000 caracteres
- Histórico: 50 últimos eventos
- Conversas: 50 últimas mensagens

## Extensibilidade

### Adicionar Novo Endpoint
```javascript
// agente/src/index.js
app.post("/minha/rota", async (req, res) => {
  try {
    // sua lógica
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ erro: String(e?.message || e) });
  }
});
```

### Adicionar Nova Análise
```javascript
// agente/src/analisador.js
export async function minhaAnalise(dados) {
  // sua lógica
  return resultado;
}
```

### Adicionar Nova Tabela
```javascript
// agente/src/database.js
db.exec(`
  CREATE TABLE IF NOT EXISTS minha_tabela (
    id INTEGER PRIMARY KEY,
    campo TEXT
  );
`);

export function criarItem(campo) {
  const stmt = db.prepare("INSERT INTO minha_tabela (campo) VALUES (?)");
  stmt.run(campo);
}
```

## Monitoramento

### Logs
- Console output de cada serviço
- npm run dev mostra todos juntos
- Erros capturados e retornados ao front

### Debugging
```javascript
// Adicionar logs
console.log("Debug:", variavel);

// Verificar banco
sqlite3 ~/.agente-ia/agente.db "SELECT * FROM projetos;"
```

## Deployment

Sistema projetado para uso local. Para produção:
- Ajustar portas
- Configurar HTTPS
- Adicionar autenticação
- Isolar processos
- Usar PM2 ou similar

---

**Última atualização:** 2025-01-09
**Versão:** 2.0.0
