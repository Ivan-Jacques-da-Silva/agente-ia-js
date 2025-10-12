import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

export async function subirServicos(pasta, nomeArquivo = "docker-compose.yml", timeout = 30000) {
  const resultados = {
    subiu: false,
    servicos: [],
    logs: [],
    healthcheck: {}
  };
  
  try {
    // Verificar se o arquivo compose existe
    const composePath = path.join(pasta, nomeArquivo);
    await fs.access(composePath);
    
    // Executar docker compose up -d
    await executarComando(["compose", "-f", nomeArquivo, "up", "-d"], pasta);
    resultados.subiu = true;
    
    // Aguardar um pouco para os serviços iniciarem
    await new Promise(r => setTimeout(r, 10000));
    
    // Coletar logs iniciais
    const logs = await coletarLogs(pasta, nomeArquivo);
    resultados.logs = logs;
    
    // Tentar health check básico
    const health = await verificarSaude(pasta, nomeArquivo);
    resultados.healthcheck = health;
    resultados.servicos = health.servicos || [];
    
  } catch (e) {
    resultados.erro = String(e.message);
  }
  
  return resultados;
}

function executarComando(args, cwd) {
  return new Promise((resolve, reject) => {
    const processo = spawn("docker", args, { cwd, stdio: "pipe" });
    
    let stdout = "";
    let stderr = "";
    
    processo.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    
    processo.stderr.on("data", (data) => {
      stderr += data.toString();
    });
    
    processo.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`Docker falhou: ${stderr || stdout}`));
      }
    });
    
    processo.on("error", (err) => {
      reject(err);
    });
  });
}

async function coletarLogs(pasta, nomeArquivo) {
  try {
    const logs = await executarComando(
      ["compose", "-f", nomeArquivo, "logs", "--tail=50"],
      pasta
    );
    return logs.split("\n").filter(l => l.trim()).slice(0, 20);
  } catch {
    return [];
  }
}

async function verificarSaude(pasta, nomeArquivo) {
  try {
    const ps = await executarComando(
      ["compose", "-f", nomeArquivo, "ps", "--format", "json"],
      pasta
    );
    
    const servicos = [];
    const linhas = ps.split("\n").filter(l => l.trim());
    
    for (const linha of linhas) {
      try {
        const info = JSON.parse(linha);
        servicos.push({
          nome: info.Service || info.Name,
          status: info.State || info.Status,
          saude: info.Health || "unknown"
        });
      } catch {}
    }
    
    return { servicos, ok: servicos.length > 0 };
  } catch {
    return { servicos: [], ok: false };
  }
}

export async function pararServicos(pasta, nomeArquivo = "docker-compose.yml") {
  try {
    await executarComando(["compose", "-f", nomeArquivo, "down"], pasta);
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: String(e.message) };
  }
}
