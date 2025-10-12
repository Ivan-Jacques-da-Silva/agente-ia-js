import path from "node:path";

export async function detectarStack(diagnostico, pasta) {
  const { indicadores, dados } = diagnostico;
  
  // Detectar tipo de frontend
  let tipoFront = null;
  if (indicadores.temNext) tipoFront = "next";
  else if (indicadores.temFrontVite) tipoFront = "vite";
  else if (indicadores.temAngular) tipoFront = "angular";
  else if (indicadores.temVue) tipoFront = "vue";
  
  // Detectar tipo de backend
  let tipoBack = null;
  const packageJsons = dados.filter(d => d.rel.endsWith("package.json"));
  
  for (const pkg of packageJsons) {
    try {
      const json = JSON.parse(pkg.conteudo);
      if (json.dependencies?.express || json.dependencies?.fastify) {
        tipoBack = "node";
        break;
      }
    } catch {}
  }
  
  if (indicadores.temPython) tipoBack = "python";
  if (indicadores.temJava) tipoBack = "java";
  
  // Detectar banco de dados
  let bancoDados = null;
  if (indicadores.temPrisma) {
    const prismaSchema = dados.find(d => d.rel.includes("prisma/schema.prisma"));
    if (prismaSchema?.conteudo.includes("postgresql")) bancoDados = "postgresql";
    else if (prismaSchema?.conteudo.includes("mysql")) bancoDados = "mysql";
    else if (prismaSchema?.conteudo.includes("mongodb")) bancoDados = "mongodb";
  }
  
  // Descobrir pastas de front/back
  const provaveisFront = ["front", "frontend", "web", "app", "client"];
  const provaveisBack = ["back", "backend", "api", "server"];
  
  function existeDir(nome) {
    return diagnostico.arquivos.some(r => r.startsWith(`${nome}/`));
  }
  
  const pastaFront = provaveisFront.find(existeDir) || null;
  const pastaBack = provaveisBack.find(existeDir) || null;
  
  // Definir portas padrão
  const portaBack = 5052;
  const portaFront = 5173;
  const portaDb = bancoDados === "postgresql" ? 5432 : bancoDados === "mysql" ? 3306 : 27017;
  
  // URL do frontend para simulação
  const urlFront = `http://localhost:${portaFront}`;
  
  return {
    tipoFront,
    tipoBack,
    bancoDados,
    pastaFront,
    pastaBack,
    portas: { portaBack, portaFront, portaDb },
    urlFront,
    temComposeExistente: indicadores.temCompose,
    temDockerfile: indicadores.temDockerfile
  };
}
