# Agente IA - Sistema de Desenvolvimento Autônomo

Sistema completo de agente de IA para desenvolvimento de software com interface interativa, memória persistente e fluxo de aprovação de mudanças.

## Características Principais

### 🤖 Agente Inteligente
- Análise automática de projetos e contexto
- Compreensão de intenções usando LLM (Ollama)
- Geração inteligente de mudanças de código
- Memória persistente de projetos e conversas

### 📊 Sistema de Memória (SQLite Local)
- Banco de dados local armazenado em `~/.agente-ia/agente.db`
- Histórico completo de projetos e mudanças
- Contexto de arquivos acessados
- Conversas salvas para continuidade

### ✅ Fluxo de Aprovação
- Mudanças propostas pelo agente aguardam aprovação
- Visualização de diff antes de aplicar
- Aprovação/rejeição individual de cada mudança
- Commit automático após aprovação

### 💻 Interface Moderna
- Editor de código integrado
- Explorador de arquivos
- Chat interativo com o agente
- Visualização de mudanças pendentes
- Histórico de ações

### 🔄 Integração Git
- Clonagem automática de repositórios
- Criação de branches automáticas
- Commits e push automáticos
- Suporte a tokens de autenticação

## Pré-requisitos

- Node.js 18+
- Ollama instalado e rodando em `http://localhost:11434`
- Git configurado

## Instalação

```bash
# 1. Instalar dependências
npm run instalar

# 2. Configurar Ollama
# Baixe um modelo de código (recomendado):
ollama pull qwen2.5-coder:7b

# Ou configure o modelo desejado em agente/.env
```

## Configuração

### agente/.env
```env
AGENTE_PORTA=6060
OLLAMA_URL=http://localhost:11434
LLM_MODEL=qwen2.5-coder:7b
```

### api/.env (opcional)
```env
API_PORTA=5050
AGENTE_PORTA=6060
```

### front/.env
```env
VITE_API_URL=/api
VITE_AGENT_URL=/agente
```

## Como Usar

### 1. Iniciar o Sistema

```bash
npm run dev
```

Isso inicia:
- API na porta 5050
- Agente na porta 6060
- Frontend no Vite (porta será exibida no console)

### 2. Abrir um Projeto

Na interface, você pode:

**Opção A: Usar um projeto local**
- Informe o caminho completo do projeto no campo "Caminho Local"
- Exemplo: `/home/usuario/projetos/meu-app`

**Opção B: Clonar um repositório**
- Informe a URL do repositório no campo "URL do Repositório"
- Defina a branch base (padrão: main)
- O agente clonará automaticamente

### 3. Conversar com o Agente

Digite suas solicitações no chat, por exemplo:

- "Alterar o título da página inicial para 'Meu App'"
- "Adicionar um botão de logout no header"
- "Criar um componente de loading"
- "Refatorar a função de validação"

O agente irá:
1. Analisar sua solicitação
2. Identificar arquivos relevantes
3. Gerar as mudanças necessárias
4. Criar mudanças pendentes para aprovação

### 4. Aprovar Mudanças

Quando o agente propor mudanças:
1. Clique no botão "X Mudança(s) Pendente(s)"
2. Revise o diff de cada mudança
3. Aprove ou rejeite individualmente
4. Mudanças aprovadas são aplicadas automaticamente

### 5. Fazer Commit

Após aprovar e testar as mudanças:
- Clique em "Commit & Push"
- O agente fará commit e push automático
- Ou edite manualmente e salve arquivos

## Estrutura do Projeto

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

## Banco de Dados Local

O banco de dados SQLite é criado automaticamente em:
```
~/.agente-ia/agente.db
```

### Tabelas:
- `projetos` - Projetos abertos e suas informações
- `arquivos_contexto` - Contexto e conteúdo de arquivos
- `mudancas_pendentes` - Mudanças aguardando aprovação
- `historico` - Log de todas as ações
- `conversas` - Histórico de conversas com o agente

## Funcionalidades Avançadas

### Sistema de Contexto
O agente mantém contexto de:
- Arquivos recentemente acessados
- Tecnologias detectadas no projeto
- Estrutura de diretórios
- Conversas anteriores

### Análise Inteligente
Quando você faz uma solicitação, o agente:
1. Analisa a intenção
2. Identifica arquivos relevantes
3. Busca contexto no histórico
4. Gera mudanças precisas

### Memória Persistente
- Projetos são lembrados entre sessões
- Conversas são recuperadas ao reabrir
- Contexto é mantido automaticamente

## Exemplos de Uso

### Exemplo 1: Alterar Texto
```
Você: "Alterar o texto 'Bem-vindo' para 'Olá' na página inicial"

Agente: Analisei sua solicitação e preparei 1 alteração(ões).
        Revise as mudanças pendentes e aprove para aplicar.

[Mudança proposta em src/pages/home.jsx]
- Bem-vindo
+ Olá
```

### Exemplo 2: Criar Componente
```
Você: "Criar um componente Button reutilizável com variantes primary e secondary"

Agente: Analisei sua solicitação e preparei 1 alteração(ões).

[Novo arquivo: src/components/Button.jsx]
+ import React from 'react';
+ export default function Button({ variant = 'primary', children, ...props }) {
+   ...
+ }
```

### Exemplo 3: Refatoração
```
Você: "Extrair a lógica de validação de email para um arquivo separado"

Agente: Analisei sua solicitação e preparei 2 alteração(ões).

[Novo arquivo: src/utils/validators.js]
[Alteração em: src/components/LoginForm.jsx]
```

## Troubleshooting

### Ollama não conecta
```bash
# Verificar se Ollama está rodando
ollama list

# Iniciar Ollama se necessário
ollama serve
```

### Porta em uso
As portas são detectadas automaticamente. Se houver conflito:
- API: tenta portas 5050-5100
- Agente: tenta portas 6060-6110

### Banco de dados corrompido
```bash
# Remover banco e recomeçar
rm ~/.agente-ia/agente.db
```

### Mudanças não são detectadas
- Verifique se o projeto foi aberto corretamente
- Certifique-se de que o agente está conectado
- Reabra o projeto se necessário

## Desenvolvimento

### Adicionar nova funcionalidade ao agente
Edite `agente/src/index.js` e adicione novas rotas.

### Modificar análise inteligente
Edite `agente/src/analisador.js` para ajustar a lógica de análise.

### Customizar interface
Edite `front/src/app.jsx` para alterar o layout e estilo.

## Segurança

- Tokens Git são mantidos em memória (não salvos)
- Banco de dados local (não compartilhado)
- Nenhuma informação enviada para servidores externos
- Apenas Ollama local é usado

## Limitações

- Funciona apenas com Ollama local (não usa APIs cloud)
- Limitado pelo contexto do modelo LLM
- Análise de projetos muito grandes pode ser lenta
- Diff visual simplificado para arquivos grandes

## Roadmap

- [ ] Suporte a múltiplos modelos LLM
- [ ] Testes automatizados antes de commit
- [ ] Integração com CI/CD
- [ ] Suporte a mais linguagens
- [ ] Melhorias no diff visual
- [ ] Exportação de logs e análises

## Licença

MIT

## Contribuindo

Contribuições são bem-vindas! Abra issues e PRs no repositório.
