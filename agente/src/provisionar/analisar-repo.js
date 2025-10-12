import fg from "fast-glob";
import path from "node:path";
import fs from "node:fs/promises";

export async function analisarRepositorio(pasta) {
  const padroes = [
    "**/package.json",
    "**/requirements.txt",
    "**/pyproject.toml",
    "**/pom.xml",
    "**/Dockerfile",
    "**/docker-compose.yml",
    "**/compose.yml",
    "**/prisma/schema.prisma",
    "**/vite.config.*",
    "**/next.config.*",
    "**/.env.example",
    "**/angular.json",
    "**/vue.config.*"
  ];

  const arquivos = await fg(padroes, { 
    cwd: pasta, 
    dot: true, 
    ignore: ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/build/**"] 
  });

  const dados = [];
  for (const rel of arquivos) {
    const abs = path.join(pasta, rel);
    let conteudo = "";
    try { 
      conteudo = await fs.readFile(abs, "utf8"); 
    } catch {}
    dados.push({ rel, conteudo });
  }

  // Indicadores de tecnologias
  const temFrontVite = dados.some(d => /vite\.config\./.test(d.rel));
  const temNext = dados.some(d => /next\.config\./.test(d.rel));
  const temAngular = dados.some(d => d.rel.endsWith("angular.json"));
  const temVue = dados.some(d => /vue\.config\./.test(d.rel));
  const temPrisma = dados.some(d => d.rel.includes("prisma/schema.prisma"));
  const temCompose = dados.some(d => /(docker-compose|compose)\.yml$/.test(d.rel));
  const temDockerfile = dados.some(d => d.rel.endsWith("Dockerfile"));
  const temEnvExample = dados.some(d => d.rel.endsWith(".env.example"));
  const temPython = dados.some(d => d.rel.endsWith("requirements.txt") || d.rel.endsWith("pyproject.toml"));
  const temJava = dados.some(d => d.rel.endsWith("pom.xml"));

  return { 
    arquivos: dados.map(d => d.rel), 
    dados,
    indicadores: { 
      temFrontVite, 
      temNext, 
      temAngular,
      temVue,
      temPrisma, 
      temCompose,
      temDockerfile,
      temEnvExample,
      temPython,
      temJava
    } 
  };
}
