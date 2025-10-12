import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

export async function simularInterface(urlBase, pasta, cenarioPath = null, timeout = 60000) {
  const resultados = {
    sucesso: false,
    video: null,
    screenshots: [],
    passos: [],
    erro: null
  };
  
  let navegador = null;
  let contexto = null;
  
  try {
    // Criar pasta de vídeos se não existir
    const videosDir = path.join(pasta, "videos");
    await fs.mkdir(videosDir, { recursive: true });
    
    // Lançar navegador
    navegador = await chromium.launch({ 
      headless: true,
      timeout: timeout 
    });
    
    // Criar contexto com gravação de vídeo
    contexto = await navegador.newContext({ 
      recordVideo: { 
        dir: videosDir,
        size: { width: 1366, height: 768 }
      },
      viewport: { width: 1366, height: 768 }
    });
    
    const pagina = await contexto.newPage();
    
    // Abrir URL
    resultados.passos.push({ acao: "abrir", url: urlBase, status: "iniciando" });
    await pagina.goto(urlBase, { waitUntil: "networkidle", timeout: timeout });
    resultados.passos[0].status = "ok";
    
    // Executar cenário se fornecido
    if (cenarioPath) {
      try {
        const cenarioContent = await fs.readFile(cenarioPath, "utf8");
        const passos = JSON.parse(cenarioContent);
        
        for (const passo of passos) {
          await executarPasso(pagina, passo, pasta, resultados);
        }
      } catch (e) {
        resultados.passos.push({ 
          acao: "erro_cenario", 
          erro: String(e.message), 
          status: "falhou" 
        });
      }
    } else {
      // Cenário padrão: apenas aguardar e tirar screenshot
      await new Promise(r => setTimeout(r, 3000));
      const screenshotPath = path.join(pasta, "videos", `screenshot-${Date.now()}.png`);
      await pagina.screenshot({ path: screenshotPath, fullPage: false });
      resultados.screenshots.push(path.basename(screenshotPath));
      resultados.passos.push({ acao: "screenshot", arquivo: path.basename(screenshotPath), status: "ok" });
    }
    
    resultados.sucesso = true;
    
  } catch (e) {
    resultados.erro = String(e.message);
    
    // Tentar tirar screenshot do erro
    try {
      if (contexto) {
        const paginas = contexto.pages();
        if (paginas.length > 0) {
          const errorScreenPath = path.join(pasta, "videos", `error-${Date.now()}.png`);
          await paginas[0].screenshot({ path: errorScreenPath, fullPage: true });
          resultados.screenshots.push(path.basename(errorScreenPath));
        }
      }
    } catch {}
    
  } finally {
    // Fechar e salvar vídeo
    if (contexto) {
      await contexto.close();
      
      // Aguardar vídeo ser salvo
      await new Promise(r => setTimeout(r, 1000));
      
      // Procurar vídeo gerado
      try {
        const videosDir = path.join(pasta, "videos");
        const arquivos = await fs.readdir(videosDir);
        const videoFile = arquivos.find(f => f.endsWith(".webm"));
        if (videoFile) {
          resultados.video = videoFile;
        }
      } catch {}
    }
    
    if (navegador) {
      await navegador.close();
    }
  }
  
  return resultados;
}

async function executarPasso(pagina, passo, pasta, resultados) {
  const passoInfo = { acao: passo.acao, status: "iniciando" };
  resultados.passos.push(passoInfo);
  
  try {
    if (passo.acao === "digitar") {
      await pagina.fill(passo.seletor, passo.valor);
      passoInfo.seletor = passo.seletor;
      passoInfo.status = "ok";
      
    } else if (passo.acao === "clicar") {
      await pagina.click(passo.seletor);
      passoInfo.seletor = passo.seletor;
      passoInfo.status = "ok";
      
    } else if (passo.acao === "esperar_url") {
      await pagina.waitForURL(passo.padrao, { timeout: 10000 });
      passoInfo.padrao = passo.padrao;
      passoInfo.status = "ok";
      
    } else if (passo.acao === "esperar_texto") {
      await pagina.waitForSelector(`text=${passo.texto}`, { timeout: 10000 });
      passoInfo.texto = passo.texto;
      passoInfo.status = "ok";
      
    } else if (passo.acao === "screenshot") {
      const screenshotPath = path.join(pasta, "videos", `step-${Date.now()}.png`);
      await pagina.screenshot({ path: screenshotPath });
      resultados.screenshots.push(path.basename(screenshotPath));
      passoInfo.arquivo = path.basename(screenshotPath);
      passoInfo.status = "ok";
    }
    
  } catch (e) {
    passoInfo.status = "falhou";
    passoInfo.erro = String(e.message);
    
    // Screenshot do erro
    try {
      const errorPath = path.join(pasta, "videos", `error-step-${Date.now()}.png`);
      await pagina.screenshot({ path: errorPath, fullPage: true });
      resultados.screenshots.push(path.basename(errorPath));
      passoInfo.screenshot_erro = path.basename(errorPath);
    } catch {}
  }
}
