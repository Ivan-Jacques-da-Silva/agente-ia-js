import path from "node:path";
import fs from "node:fs/promises";

export async function prepararAmbiente(pasta, stack) {
  const resultados = {
    envCriado: false,
    pastasCriadas: []
  };
  
  // Criar pasta de relatórios
  const relatoriosDir = path.join(pasta, "relatorios");
  await fs.mkdir(relatoriosDir, { recursive: true });
  resultados.pastasCriadas.push("relatorios/");
  
  // Criar pasta de vídeos
  const videosDir = path.join(pasta, "videos");
  await fs.mkdir(videosDir, { recursive: true });
  resultados.pastasCriadas.push("videos/");
  
  // Gerar .env se não existir
  const envPath = path.join(pasta, ".env");
  try {
    await fs.access(envPath);
  } catch {
    // Tenta usar .env.example existente
    const envExamplePath = path.join(pasta, ".env.example");
    let envConteudo = "";
    
    try {
      envConteudo = await fs.readFile(envExamplePath, "utf8");
    } catch {
      // Gera .env padrão baseado na stack
      envConteudo = gerarEnvPadrao(stack);
    }
    
    await fs.writeFile(envPath, envConteudo, "utf8");
    resultados.envCriado = true;
  }
  
  return resultados;
}

function gerarEnvPadrao(stack) {
  const { portaBack, portaFront, portaDb } = stack.portas;
  const { bancoDados } = stack;
  
  let env = `# Ambiente gerado automaticamente\n`;
  env += `PORTA_BACK=${portaBack}\n`;
  env += `PORTA_FRONT=${portaFront}\n`;
  env += `URL_FRONT=http://localhost:${portaFront}\n\n`;
  
  if (bancoDados) {
    env += `# Banco de dados\n`;
    env += `DB_PORT=${portaDb}\n`;
    
    if (bancoDados === "postgresql") {
      env += `DB_USER=app\n`;
      env += `DB_PASS=app\n`;
      env += `DB_NAME=appdb\n`;
      env += `DATABASE_URL=postgresql://app:app@db:${portaDb}/appdb\n`;
    } else if (bancoDados === "mysql") {
      env += `DB_USER=app\n`;
      env += `DB_PASS=app\n`;
      env += `DB_NAME=appdb\n`;
      env += `DATABASE_URL=mysql://app:app@db:${portaDb}/appdb\n`;
    } else if (bancoDados === "mongodb") {
      env += `MONGO_USER=app\n`;
      env += `MONGO_PASS=app\n`;
      env += `MONGO_DB=appdb\n`;
      env += `DATABASE_URL=mongodb://app:app@db:${portaDb}/appdb\n`;
    }
  }
  
  return env;
}
