# Guia de Uso - Agente IA

## Fluxo Completo de Uso

### 1. Primeira Vez

#### Instalar Ollama
```bash
# Linux
curl -fsSL https://ollama.com/install.sh | sh

# macOS
brew install ollama

# Windows
# Baixar de https://ollama.com/download
```

#### Baixar Modelo de Código
```bash
# Modelo recomendado (7B - rápido e eficiente)
ollama pull qwen2.5-coder:7b

# Alternativas:
# ollama pull codellama:7b
# ollama pull deepseek-coder:6.7b
```

#### Instalar Dependências
```bash
cd agente-ia-js
npm run instalar
```

### 2. Iniciar Sistema

```bash
# Terminal 1: Iniciar tudo junto
npm run dev

# Ou separadamente:
# Terminal 1: API
npm run dev --workspace api

# Terminal 2: Agente
npm run dev --workspace agente

# Terminal 3: Frontend
npm run dev --workspace front
```

### 3. Acessar Interface

Abra o navegador em:
```
http://localhost:5173
```
(ou a porta exibida no console do Vite)

## Cenários de Uso

### Cenário 1: Desenvolvimento Local

**Situação:** Você tem um projeto local e quer ajuda do agente.

**Passos:**
1. Na sidebar, campo "Caminho Local", digite o caminho completo do projeto
   - Exemplo: `/home/usuario/meu-projeto`
2. Clique em "Abrir Projeto"
3. O agente analisa e carrega a estrutura
4. Comece a conversar no chat

**Exemplo de conversa:**
```
Você: "Adicionar validação de CPF no formulário de cadastro"

Agente: Analisei sua solicitação. Vou criar uma função de validação
        de CPF e integrá-la ao formulário.

[Você vê: "1 Mudança Pendente"]

Você clica para revisar:
- Arquivo: src/utils/validators.js (NOVO)
- Arquivo: src/components/CadastroForm.jsx (MODIFICADO)

Você aprova e o agente aplica as mudanças.
```

### Cenário 2: Trabalho com Repositório Remoto

**Situação:** Você quer clonar um repo e trabalhar nele.

**Passos:**
1. Na sidebar, campo "URL do Repositório"
2. Digite: `https://github.com/usuario/projeto.git`
3. Campo "Branch Base": `main` (ou a branch desejada)
4. Clique em "Abrir Projeto"
5. O agente clona para `/tmp/` e cria uma branch nova
6. Trabalhe normalmente

**Commits:**
- Mudanças aprovadas ficam no working directory
- Clique "Commit & Push" quando pronto
- O agente faz commit na branch criada e push

### Cenário 3: Refatoração Grande

**Situação:** Você quer refatorar várias partes do código.

**Estratégia:**
```
Você: "Preciso refatorar a autenticação para usar JWT"

Agente: Vou dividir isso em etapas:
1. Criar serviço de JWT
2. Atualizar middleware de autenticação
3. Modificar rotas protegidas
4. Atualizar frontend para usar tokens

[3 Mudanças Pendentes]

Você revisa e aprova uma por uma.
```

### Cenário 4: Correção de Bug

**Situação:** Há um bug e você não sabe onde está.

**Exemplo:**
```
Você: "O botão de login não está funcionando quando clico"

Agente: Vou analisar o componente de login e event handlers.

        Encontrei: O evento onClick está com sintaxe incorreta.

[1 Mudança Pendente]

- <button onClick={handleLogin()}>
+ <button onClick={handleLogin}>
```

## Comandos Úteis via Chat

### Edição de Código
- "Alterar [texto] para [novo texto] em [arquivo]"
- "Adicionar [funcionalidade] em [componente]"
- "Remover [código] de [arquivo]"
- "Renomear [variável] para [novo nome]"

### Criação
- "Criar componente [Nome] com [descrição]"
- "Criar função [nome] que [faz algo]"
- "Adicionar arquivo [caminho] com [conteúdo]"

### Análise
- "O que faz o arquivo [caminho]?"
- "Onde está implementado [funcionalidade]?"
- "Explicar o código em [arquivo]"

### Refatoração
- "Extrair [lógica] para função separada"
- "Refatorar [componente] para usar hooks"
- "Simplificar [função]"

## Aprovação de Mudanças

### Visualizar Mudanças
1. Botão laranja mostra: "X Mudança(s) Pendente(s)"
2. Clique para abrir modal
3. Cada mudança mostra:
   - Nome do arquivo
   - Descrição
   - Diff completo

### Aprovar
- Botão verde "✓ Aprovar e Aplicar"
- Mudança é aplicada imediatamente
- Arquivo é salvo no disco

### Rejeitar
- Botão vermelho "✗ Rejeitar"
- Mudança é descartada
- Não afeta o código

### Dicas
- Revise sempre antes de aprovar
- Teste após aplicar mudanças críticas
- Aprove mudanças relacionadas juntas
- Faça commit após cada grupo de aprovações

## Edição Manual

Você também pode editar arquivos manualmente:

1. Clique no arquivo no explorador
2. Edite no editor central
3. Botão "Salvar Arquivo" aparece quando há mudanças
4. Clique para salvar

**Nota:** Edições manuais não passam por aprovação.

## Commits e Git

### Commit Automático
- Após aprovar mudanças, clique "Commit & Push"
- Agente cria commit com mensagem descritiva
- Push para branch atual

### Commit Manual
- Faça mudanças (aprovadas ou manuais)
- Clique "Commit & Push"
- Commit é feito com todas as mudanças

### Branch
- Ao abrir repositório remoto, agente cria branch `agente/[timestamp]`
- Trabalhe nessa branch
- Faça merge/PR manualmente depois

## Memória e Contexto

### Como Funciona
O agente lembra:
- Projetos já abertos
- Arquivos acessados recentemente
- Conversas anteriores
- Tecnologias do projeto

### Reabrindo Projeto
- Ao reabrir, o agente carrega:
  - Últimas conversas
  - Arquivos de contexto
  - Histórico de ações

### Limpando Memória
```bash
# Remover banco de dados
rm ~/.agente-ia/agente.db

# Sistema recomeça do zero
```

## Histórico

### Visualizar Histórico
- Cada ação é registrada:
  - Projeto aberto/reaberto
  - Arquivos salvos
  - Mudanças propostas/aprovadas/rejeitadas
  - Commits realizados

### Uso Futuro
- Em desenvolvimento: painel de histórico na UI
- Por enquanto: histórico está no banco de dados

## Performance

### Projetos Grandes
- Agente analisa até 5000 arquivos
- Profundidade máxima: 6 níveis
- Ignora: node_modules, .git, dist, build

### Respostas Lentas
- Depende do modelo Ollama
- Modelos menores (7B) são mais rápidos
- Modelos maiores (30B+) são mais precisos

### Otimização
```bash
# Use modelo menor para velocidade
ollama pull qwen2.5-coder:7b

# Configure em agente/.env
LLM_MODEL=qwen2.5-coder:7b
```

## Troubleshooting Comum

### "Aguardando conexão com o agente"
- Verifique se `npm run dev` está rodando
- Verifique se porta 6060 está livre
- Recarregue a página

### "Ollama indisponível"
```bash
# Verificar se está rodando
curl http://localhost:11434/api/tags

# Se não estiver, inicie:
ollama serve
```

### Mudanças não aparecem
- Verifique se projeto está aberto
- Recarregue árvore de arquivos
- Reabra o projeto

### Erro ao clonar repositório
- Verifique URL do repositório
- Para repos privados, configure token Git
- Verifique conexão internet

### Banco de dados travado
```bash
# Parar todos os processos
pkill -f agente

# Remover banco
rm ~/.agente-ia/agente.db

# Reiniciar
npm run dev
```

## Boas Práticas

### 1. Commits Frequentes
- Aprove mudanças em grupos lógicos
- Faça commit após cada grupo
- Não acumule muitas mudanças

### 2. Revisão Cuidadosa
- Sempre revise o diff
- Teste funcionalidades críticas
- Não aprove mudanças que não entende

### 3. Comunicação Clara
- Seja específico nas solicitações
- Mencione arquivos se souber
- Use exemplos quando possível

### 4. Backup
- Trabalhe em branches separadas
- Faça backup antes de mudanças grandes
- Use controle de versão

### 5. Segurança
- Não compartilhe banco de dados
- Não commite credenciais
- Revise código gerado por IA

## Próximos Passos

Depois de dominar o básico:
1. Experimente refatorações complexas
2. Use para aprender novos padrões
3. Automatize tarefas repetitivas
4. Integre em seu fluxo de trabalho

## Suporte

- Issues: Abra no repositório do projeto
- Docs: Este arquivo e README.md
- Comunidade: Discord/Slack (se disponível)
