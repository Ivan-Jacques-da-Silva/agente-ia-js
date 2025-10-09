#!/bin/bash

echo "==================================="
echo "Verificação do Sistema Agente IA"
echo "==================================="
echo ""

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar Node.js
echo -n "Verificando Node.js... "
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo -e "${GREEN}✓ Instalado ($NODE_VERSION)${NC}"
else
    echo -e "${RED}✗ Não encontrado${NC}"
    echo "  Instale Node.js 18+ de https://nodejs.org"
    exit 1
fi

# Verificar npm
echo -n "Verificando npm... "
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    echo -e "${GREEN}✓ Instalado ($NPM_VERSION)${NC}"
else
    echo -e "${RED}✗ Não encontrado${NC}"
    exit 1
fi

# Verificar Git
echo -n "Verificando Git... "
if command -v git &> /dev/null; then
    GIT_VERSION=$(git --version | cut -d' ' -f3)
    echo -e "${GREEN}✓ Instalado ($GIT_VERSION)${NC}"
else
    echo -e "${RED}✗ Não encontrado${NC}"
    echo "  Instale Git de https://git-scm.com"
    exit 1
fi

# Verificar Ollama
echo -n "Verificando Ollama... "
if command -v ollama &> /dev/null; then
    echo -e "${GREEN}✓ Instalado${NC}"

    # Verificar se está rodando
    echo -n "Verificando se Ollama está rodando... "
    if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Rodando${NC}"

        # Listar modelos disponíveis
        echo ""
        echo "Modelos disponíveis:"
        MODELS=$(curl -s http://localhost:11434/api/tags | grep -o '"name":"[^"]*"' | cut -d'"' -f4)
        if [ -z "$MODELS" ]; then
            echo -e "${YELLOW}  ⚠ Nenhum modelo baixado${NC}"
            echo "  Execute: ollama pull qwen2.5-coder:7b"
        else
            echo "$MODELS" | while read -r model; do
                echo -e "  ${GREEN}✓${NC} $model"
            done
        fi
    else
        echo -e "${RED}✗ Não está rodando${NC}"
        echo "  Execute: ollama serve"
    fi
else
    echo -e "${RED}✗ Não encontrado${NC}"
    echo "  Instale Ollama de https://ollama.com"
    exit 1
fi

# Verificar dependências do projeto
echo ""
echo -n "Verificando dependências... "
if [ -d "node_modules" ]; then
    echo -e "${GREEN}✓ Instaladas${NC}"
else
    echo -e "${YELLOW}⚠ Não instaladas${NC}"
    echo "  Execute: npm run instalar"
fi

# Verificar arquivos de configuração
echo ""
echo "Verificando arquivos de configuração:"

echo -n "  agente/.env... "
if [ -f "agente/.env" ]; then
    echo -e "${GREEN}✓ Existe${NC}"
else
    echo -e "${YELLOW}⚠ Não existe${NC}"
    echo "    Execute: cp agente/.env.example agente/.env"
fi

echo -n "  api/.env... "
if [ -f "api/.env" ]; then
    echo -e "${GREEN}✓ Existe${NC}"
else
    echo -e "${YELLOW}⚠ Não existe (opcional)${NC}"
fi

echo -n "  front/.env... "
if [ -f "front/.env" ]; then
    echo -e "${GREEN}✓ Existe${NC}"
else
    echo -e "${YELLOW}⚠ Não existe (opcional)${NC}"
fi

# Verificar banco de dados
echo ""
echo -n "Verificando banco de dados... "
DB_PATH="$HOME/.agente-ia/agente.db"
if [ -f "$DB_PATH" ]; then
    DB_SIZE=$(du -h "$DB_PATH" | cut -f1)
    echo -e "${GREEN}✓ Existe ($DB_SIZE)${NC}"
    echo "  Localização: $DB_PATH"
else
    echo -e "${YELLOW}⚠ Será criado ao iniciar${NC}"
    echo "  Localização: $DB_PATH"
fi

# Verificar portas
echo ""
echo "Verificando portas:"

check_port() {
    local port=$1
    local name=$2
    echo -n "  Porta $port ($name)... "
    if lsof -i:$port > /dev/null 2>&1; then
        echo -e "${YELLOW}⚠ Em uso${NC}"
    else
        echo -e "${GREEN}✓ Disponível${NC}"
    fi
}

check_port 5050 "API"
check_port 6060 "Agente"
check_port 5173 "Vite"

# Resumo
echo ""
echo "==================================="
echo "Resumo"
echo "==================================="
echo ""
echo "Para iniciar o sistema:"
echo "  npm run dev"
echo ""
echo "Para abrir a interface:"
echo "  http://localhost:5173"
echo ""
echo "Para baixar modelo recomendado:"
echo "  ollama pull qwen2.5-coder:7b"
echo ""
