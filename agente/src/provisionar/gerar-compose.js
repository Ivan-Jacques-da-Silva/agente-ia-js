import path from "node:path";
import fs from "node:fs/promises";
import YAML from "yaml";

export async function gerarCompose(pasta, stack, tentarReaproveitar = true) {
  const composeExistente = path.join(pasta, "docker-compose.yml");
  const composeLocal = path.join(pasta, "docker-compose.local.yml");
  
  const resultados = {
    arquivo: "docker-compose.local.yml",
    conflito: false,
    servicos: []
  };
  
  // Verificar se já existe compose
  let usarLocal = false;
  if (stack.temComposeExistente && tentarReaproveitar) {
    try {
      await fs.access(composeExistente);
      usarLocal = true;
      resultados.conflito = true;
    } catch {}
  }
  
  const caminhoFinal = usarLocal ? composeLocal : composeExistente;
  resultados.arquivo = path.basename(caminhoFinal);
  
  // Montar compose
  const compose = {
    version: "3.9",
    services: {},
    volumes: {}
  };
  
  // Adicionar banco de dados se necessário
  if (stack.bancoDados) {
    const servicoDb = criarServicoBancoDados(stack);
    compose.services.db = servicoDb;
    compose.volumes.pg_data = {};
    resultados.servicos.push("db");
  }
  
  // Adicionar backend
  if (stack.tipoBack) {
    const servicoBack = criarServicoBackend(stack);
    compose.services.backend = servicoBack;
    resultados.servicos.push("backend");
  }
  
  // Adicionar frontend
  if (stack.tipoFront) {
    const servicoFront = criarServicoFrontend(stack);
    compose.services.frontend = servicoFront;
    resultados.servicos.push("frontend");
  }
  
  // Salvar arquivo
  const yamlContent = YAML.stringify(compose);
  await fs.writeFile(caminhoFinal, yamlContent, "utf8");
  
  return resultados;
}

function criarServicoBancoDados(stack) {
  const { bancoDados, portas } = stack;
  
  if (bancoDados === "postgresql") {
    return {
      image: "postgres:16",
      environment: {
        POSTGRES_USER: "${DB_USER:-app}",
        POSTGRES_PASSWORD: "${DB_PASS:-app}",
        POSTGRES_DB: "${DB_NAME:-appdb}"
      },
      ports: [`${portas.portaDb}:5432`],
      volumes: ["pg_data:/var/lib/postgresql/data"],
      healthcheck: {
        test: ["CMD-SHELL", "pg_isready -U app"],
        interval: "10s",
        timeout: "5s",
        retries: 5
      }
    };
  } else if (bancoDados === "mysql") {
    return {
      image: "mysql:8",
      environment: {
        MYSQL_USER: "${DB_USER:-app}",
        MYSQL_PASSWORD: "${DB_PASS:-app}",
        MYSQL_DATABASE: "${DB_NAME:-appdb}",
        MYSQL_ROOT_PASSWORD: "${DB_PASS:-app}"
      },
      ports: [`${portas.portaDb}:3306`],
      volumes: ["pg_data:/var/lib/mysql"]
    };
  } else if (bancoDados === "mongodb") {
    return {
      image: "mongo:7",
      environment: {
        MONGO_INITDB_ROOT_USERNAME: "${MONGO_USER:-app}",
        MONGO_INITDB_ROOT_PASSWORD: "${MONGO_PASS:-app}",
        MONGO_INITDB_DATABASE: "${MONGO_DB:-appdb}"
      },
      ports: [`${portas.portaDb}:27017`],
      volumes: ["pg_data:/data/db"]
    };
  }
  
  return {};
}

function criarServicoBackend(stack) {
  const { tipoBack, pastaBack, portas } = stack;
  const buildPath = pastaBack || ".";
  
  const servico = {
    build: `./${buildPath}`,
    env_file: [".env"],
    ports: [`${portas.portaBack}:${portas.portaBack}`],
    depends_on: []
  };
  
  if (stack.bancoDados) {
    servico.depends_on.push("db");
  }
  
  // Adicionar health check se possível
  servico.healthcheck = {
    test: ["CMD", "curl", "-f", `http://localhost:${portas.portaBack}/health`],
    interval: "10s",
    timeout: "5s",
    retries: 5,
    start_period: "30s"
  };
  
  return servico;
}

function criarServicoFrontend(stack) {
  const { tipoFront, pastaFront, portas } = stack;
  const buildPath = pastaFront || ".";
  
  const servico = {
    build: `./${buildPath}`,
    environment: {
      VITE_API_URL: `http://localhost:${portas.portaBack}`
    },
    ports: [`${portas.portaFront}:${portas.portaFront}`],
    depends_on: []
  };
  
  if (stack.tipoBack) {
    servico.depends_on.push("backend");
  }
  
  return servico;
}
