# Changelog - Sistema Agente IA

## Versão 2.0.0 - Sistema Completo Funcional

### Novas Funcionalidades

#### 🗄️ Sistema de Memória Persistente (SQLite)
- Banco de dados local em `~/.agente-ia/agente.db`
- Memória de projetos entre sessões
- Histórico completo de ações
- Contexto de arquivos acessados
- Conversas salvas automaticamente

**Tabelas criadas:**
- `projetos` - Informações de projetos
- `arquivos_contexto` - Cache de contexto
- `mudancas_pendentes` - Fila de aprovação
- `historico` - Log de eventos
- `conversas` - Chat persistente

#### 🤖 Análise Inteligente de Mudanças
- Sistema de análise de intenção com IA
- Identificação automática de arquivos relevantes
- Geração contextualizada de mudanças
- Avaliação de complexidade e riscos

**Arquivo:** `agente/src/analisador.js`

#### ✅ Fluxo de Aprovação de Mudanças
- Mudanças propostas aguardam aprovação
- Visualização de diff detalhado
- Aprovação/rejeição individual
- Aplicação automática após aprovação
- Histórico de mudanças aprovadas/rejeitadas

#### 💻 Interface Moderna e Interativa

**Melhorias visuais:**
- Design moderno com gradientes
- Tema escuro profissional
- Componentes bem definidos
- Feedback visual de estados
- Modal de mudanças pendentes
- Badges de notificação

**Funcionalidades da UI:**
- Status de conexão em tempo real
- Informações do projeto atual
- Contador de mudanças pendentes
- Chat persistente com histórico
- Editor com salvamento manual
- Explorador de arquivos expansível

#### 🔄 Suporte a Projetos Locais
- Abertura de projetos locais (sem clone)
- Suporte a repositórios remotos (com clone)
- Detecção automática de projetos existentes
- Reuso de informações ao reabrir

#### 📊 Sistema de Histórico
- Log de todas as ações
- Timestamps precisos
- Tipos de eventos categorizados
- Consulta de histórico por projeto

### Endpoints da API

#### Novos Endpoints do Agente

**POST /chat/inteligente**
- Chat com análise inteligente
- Geração de mudanças automática
- Retorna número de mudanças criadas

**GET /mudancas/pendentes**
- Lista mudanças aguardando aprovação
- Filtradas por projeto

**POST /mudancas/aprovar**
- Aprova e aplica mudança
- Atualiza histórico

**POST /mudancas/rejeitar**
- Rejeita mudança
- Remove da fila

**GET /projetos**
- Lista todos os projetos
- Ordenados por último acesso

**GET /historico**
- Histórico do projeto atual
- Últimos 50 eventos

**GET /conversas**
- Conversas do projeto atual
- Últimas 50 mensagens

#### Endpoints Modificados

**POST /repo/abrir**
- Agora suporta `caminhoLocal`
- Detecta projetos existentes
- Retorna conversas e histórico
- Cria projeto no banco se novo

### Arquivos Adicionados

```
agente/src/
├── database.js         # Sistema de memória SQLite
├── analisador.js       # Análise inteligente de mudanças
└── index-backup.js     # Backup do index original

front/src/
└── app-backup.jsx      # Backup do app original

./
├── README.md           # Documentação completa atualizada
├── README-ORIGINAL.md  # README original preservado
├── GUIA-USO.md         # Guia detalhado de uso
├── CHANGELOG.md        # Este arquivo
└── verificar-sistema.sh # Script de verificação
```

### Dependências Adicionadas

**agente/package.json:**
```json
{
  "better-sqlite3": "^11.0.0"
}
```

### Mudanças de Comportamento

#### Antes (v1.0.0)
- Memória em arquivos JSON temporários
- Sem aprovação de mudanças
- Mudanças aplicadas imediatamente
- Sem histórico persistente
- UI básica sem feedback visual

#### Agora (v2.0.0)
- Memória em banco SQLite
- Fluxo de aprovação obrigatório
- Mudanças revisadas antes de aplicar
- Histórico completo de tudo
- UI moderna e interativa

### Migração

Não há migração necessária. O sistema é compatível com projetos antigos.

**Se você tinha projetos na v1.0.0:**
- Reabra os projetos normalmente
- Serão criados no novo banco
- Memória antiga em `.agent/` é ignorada (mas preservada)

### Breaking Changes

Nenhuma mudança quebra compatibilidade. Todos os endpoints anteriores ainda funcionam.

### Melhorias de Performance

- Análise de projetos otimizada (máx 5000 arquivos)
- Cache de contexto em banco
- Consultas SQL indexadas
- Carregamento assíncrono de árvore

### Segurança

- Banco de dados local (não compartilhado)
- Validação de caminhos para evitar path traversal
- Sanitização de inputs SQL
- Tokens Git não são persistidos

### Bug Fixes

- Corrigido: Árvore de arquivos não atualizava após mudanças
- Corrigido: Chat perdia contexto ao recarregar
- Corrigido: Editor não mostrava arquivo atual corretamente
- Corrigido: Conexão com agente falhava silenciosamente

### Documentação

#### Adicionada
- README.md completo com exemplos
- GUIA-USO.md com cenários práticos
- CHANGELOG.md (este arquivo)
- Comentários em código-chave

#### Atualizada
- Instruções de instalação
- Configuração de ambiente
- Exemplos de uso
- Troubleshooting

### Testes

Sistema testado com:
- Node.js 18.x, 20.x, 22.x
- Ollama 0.1.x
- Modelos: qwen2.5-coder:7b, codellama:7b
- Projetos React, Next.js, Express
- Repositórios GitHub públicos e privados

### Próximos Passos (Roadmap)

#### v2.1.0 (Planejado)
- [ ] Painel de histórico na UI
- [ ] Busca em conversas antigas
- [ ] Exportação de logs
- [ ] Configurações de UI

#### v2.2.0 (Planejado)
- [ ] Testes automatizados antes de commit
- [ ] Integração com CI/CD
- [ ] Webhooks para eventos
- [ ] API REST completa

#### v3.0.0 (Futuro)
- [ ] Suporte a múltiplos LLMs
- [ ] Plugins e extensões
- [ ] Colaboração multi-usuário
- [ ] Interface web completa

### Contribuidores

Sistema desenvolvido para uso local com Ollama.

### Agradecimentos

- Ollama team pelo runtime local de LLMs
- Comunidade open source
- Usuários beta testers

---

## Versão 1.0.0 - Sistema Base

### Funcionalidades Iniciais
- Chat básico com Ollama
- Abertura de repositórios
- Editor de código simples
- Explorador de arquivos
- Git básico (clone, commit, push)

### Estrutura Original
- Workspaces: front, api, agente
- React + Vite no frontend
- Express na API e Agente
- Memória em arquivos JSON

---

**Data da Release:** 2025-01-09
**Compatibilidade:** Node.js 18+, Ollama 0.1+
**Licença:** MIT
