# Início Rápido - 5 Minutos

## 1. Pré-requisitos (2 min)

```bash
# Instalar Ollama (se ainda não tiver)
# Linux/Mac:
curl -fsSL https://ollama.com/install.sh | sh

# Windows: baixar de https://ollama.com/download

# Baixar modelo de código
ollama pull qwen2.5-coder:7b
```

## 2. Instalar (1 min)

```bash
cd agente-ia-js
npm run instalar
```

## 3. Iniciar (1 min)

```bash
# Iniciar tudo
npm run dev

# Aguardar mensagens:
# - API na porta 5050
# - Agente na porta 6060
# - Local: http://localhost:5173
```

## 4. Usar (1 min)

Abra o navegador em `http://localhost:5173`

### Opção A: Projeto Local
1. Digite caminho do projeto: `/seu/projeto`
2. Clique "Abrir Projeto"
3. Converse: "Adicionar um botão na página inicial"

### Opção B: Repositório Remoto
1. Cole URL: `https://github.com/usuario/projeto.git`
2. Branch: `main`
3. Clique "Abrir Projeto"
4. Aguarde clone e análise

## 5. Fluxo Básico

```
1. Chat: "Quero adicionar validação de email"
   ↓
2. Agente analisa e propõe mudanças
   ↓
3. Botão laranja: "1 Mudança Pendente"
   ↓
4. Você revisa o diff
   ↓
5. Aprova ou rejeita
   ↓
6. Se aprovado, mudança é aplicada
   ↓
7. Clique "Commit & Push"
   ↓
8. Pronto!
```

## Comandos Úteis

```bash
# Verificar sistema
./verificar-sistema.sh

# Ver logs
npm run dev

# Parar tudo
Ctrl+C (no terminal)

# Limpar banco
rm ~/.agente-ia/agente.db
```

## Exemplo Completo

```bash
# Terminal 1
cd agente-ia-js
npm run dev

# Navegador
http://localhost:5173

# 1. Abrir projeto
Caminho Local: /home/usuario/meu-app
[Abrir Projeto]

# 2. Conversar
Chat: "Criar um componente de loading spinner"

# 3. Revisar
[1 Mudança Pendente] → Revisar diff

# 4. Aprovar
[✓ Aprovar e Aplicar]

# 5. Commitar
[Commit & Push]

# Pronto! Mudança aplicada e commitada
```

## Problemas Comuns

### Ollama não conecta
```bash
ollama serve
```

### Porta em uso
Sistema detecta automaticamente e usa próxima disponível

### Agente não responde
1. Verificar se Ollama está rodando: `curl localhost:11434/api/tags`
2. Verificar se modelo foi baixado: `ollama list`
3. Recarregar página

## Próximos Passos

- Ler [GUIA-USO.md](GUIA-USO.md) para casos avançados
- Ver [README.md](README.md) para documentação completa
- Checar [CHANGELOG.md](CHANGELOG.md) para novidades

## Dicas

1. **Seja específico:** "Adicionar botão de login no header"
2. **Mencione arquivos:** "Alterar cor em styles.css"
3. **Revise sempre:** Não aprove sem entender
4. **Commit frequente:** Após cada grupo de mudanças
5. **Use branches:** Trabalhe em branches separadas

## Atalhos

- `Enter` no chat = Enviar
- `Shift+Enter` = Nova linha
- Árvore: Clique para expandir/colapsar

Pronto! Você está usando o Agente IA.

Para ajuda: Abra issue no repositório ou consulte a documentação.
