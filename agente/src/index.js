import "dotenv/config";
import express from "express";
import cors from "cors";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { executar_fluxo } from "./fluxo.js";
import { chat_simples } from "./llm.js";
import { initMem, logEvent, saveState, loadState } from "./memoria.js";
import { clonar_repositorio, criar_branch, commit_e_push } from "./ferramentas.js";

const app = express();
// CORS (qualquer origem) e preflight via pacote oficial
app.use(cors());
app.options('*', cors());
app.use(express.json({limit:"5mb"}));

app.get("/saude", (_req, res) => { res.set("Access-Control-Allow-Origin","*"); res.json({ ok: true }); });

app.post("/executar", async (req, res) => {
  try {
    const r = await executar_fluxo(req.body);
    res.json(r);
  } catch (e) {
    res.status(500).send(e?.message || "erro");
  }
});

async function findAvailablePort(start){
  for(let p=start; p<start+50; p++){
    const ok = await new Promise((resolve)=>{
      const srv = net.createServer()
        .once("error", ()=> resolve(false))
        .once("listening", ()=> srv.close(()=> resolve(true)))
        .listen(p, "0.0.0.0");
    });
    if(ok) return p;
  }
  throw new Error("Sem porta livre encontrada");
}

let server;
async function start(){
  const base = Number(process.env.AGENTE_PORTA || 6060);
  const porta = await findAvailablePort(base);
  server = app.listen(porta, () => console.log(`Agente na porta ${porta}`));
}

function graceful(){
  if(server){
    console.log("Encerrando Agente e liberando porta...");
    try{ server.close(()=> process.exit(0)); }catch{ process.exit(0); }
  } else {
    process.exit(0);
  }
}
process.on("SIGINT", graceful);
process.on("SIGTERM", graceful);

// Estado do repositÃ³rio atual
const estado = {
  pasta: null,
  branch: null,
  url: null,
};

// util para montar Ã¡rvore de arquivos limitada
async function listar_arvore(base){
  const ignorar = new Set([".git", "node_modules", ".next", "dist", "build"]);
  const resultado = [];
  const maxItens = 5000;
  const maxProfundidade = 6;
  let count = 0;
  async function walk(dir, depth){
    if(depth>maxProfundidade) return;
    const itens = await fs.promises.readdir(dir,{withFileTypes:true});
    for(const ent of itens){
      if(count>=maxItens) return;
      if(ignorar.has(ent.name)) continue;
      const full = path.join(dir, ent.name);
      const rel = path.relative(base, full).replace(/\\/g,"/");
      resultado.push({path:rel, tipo: ent.isDirectory()?"dir":"file"});
      count++;
      if(ent.isDirectory()) await walk(full, depth+1);
    }
  }
  await walk(base, 0);
  return resultado;
}

// Utilidades de análise rápida do projeto
async function lerAte(fullPath, maxBytes = 8192){
  try{
    const buf = await fs.promises.readFile(fullPath);
    return buf.slice(0, maxBytes).toString("utf-8");
  }catch{ return ""; }
}

async function analisar_repositorio(base, arvore){
  const arquivos = arvore.filter(i=>i.tipo==='file').map(i=>i.path);
  const dirsTop = new Set(arvore.map(i=> i.path.split('/')[0]));
  const totalArquivos = arquivos.length;
  const chaves = [
    'README.md','package.json','front/package.json','api/package.json','agente/package.json',
    'vite.config.js','next.config.js','tsconfig.json','front/vite.config.js','front/index.html'
  ];
  const amostras = {};
  for(const rel of chaves){
    if(arquivos.includes(rel)){
      amostras[rel] = await lerAte(path.join(base, rel));
    }
  }
  const pkgPaths = Object.keys(amostras).filter(p=>p.endsWith('package.json') && amostras[p]);
  const pkgs = [];
  for(const p of pkgPaths){
    try{ pkgs.push({ caminho:p, json: JSON.parse(amostras[p]) }); }catch{}
  }
  const deps = new Set();
  for(const {json} of pkgs){
    for(const k of Object.keys(json.dependencies||{})) deps.add(k);
    for(const k of Object.keys(json.devDependencies||{})) deps.add(k);
  }
  const tecnos = [];
  const has = (name)=> deps.has(name);
  if(has('react')) tecnos.push('React');
  if(has('next')) tecnos.push('Next.js');
  if(has('vite')) tecnos.push('Vite');
  if(has('express')) tecnos.push('Express');
  if(has('typescript')) tecnos.push('TypeScript');
  if(has('eslint')) tecnos.push('ESLint');

  const contexto = [
    `Você é um agente profissional e criativo.`,
    `Resuma o repositório de forma breve, em PT-BR, com tópicos:`,
    `- Tecnologias e frameworks (inferir)`,
    `- Estrutura de diretórios (alto nível)`,
    `- Objetivo provável do sistema`,
    `- Próximos passos recomendados`,
    `Responda em até 6 linhas.`,
    `\nMetadados:`,
    `- Total de arquivos: ${totalArquivos}`,
    `- Diretórios top: ${Array.from(dirsTop).slice(0,12).join(', ')}`,
    `- Tecnologias detectadas: ${tecnos.join(', ')||'indefinido'}`,
  ].join('\n');

  const blobs = Object.entries(amostras)
    .map(([p,c])=> `Arquivo: ${p}\n"""\n${String(c).slice(0,1200)}\n"""`)
    .join('\n\n')
    .slice(0, 6000);

  let resumo = '';
  try{
    resumo = await chat_simples('Gere um resumo objetivo do projeto.', `${contexto}\n\nAmostras:\n${blobs}`);
  }catch{}
  if(!resumo){
    resumo = `Projeto com ${totalArquivos} arquivos. Tecnologias: ${tecnos.join(', ')||'não detectadas'}. Diretórios: ${Array.from(dirsTop).slice(0,6).join(', ')}.`;
  }
  const mensagemChat = `${resumo}\n\nPosso ajudar. O que você deseja alterar primeiro?`;
  await saveState(base, { analise: { tecnos, totalArquivos, dirsTop: Array.from(dirsTop), resumo, quando: new Date().toISOString() } });
  await logEvent(base, 'analise_repo', { tecnos, totalArquivos });
  return { tecnos, totalArquivos, mensagemChat, resumo };
}

app.post("/repo/abrir", async (req,res)=>{
  try{
    const { repositorioUrl, branchBase, token } = req.body||{};
    if(!repositorioUrl) return res.status(400).json({erro:"repositorioUrl Ã© obrigatÃ³rio"});
    const pasta = path.join(os.tmpdir(), `repo_${Date.now()}`);
    await clonar_repositorio(repositorioUrl, pasta, token);
    await criar_branch(pasta, `agente/${Date.now()}`, branchBase);
    estado.pasta = pasta;
    estado.branch = branchBase || null;
    estado.url = repositorioUrl;
    const arvore = await listar_arvore(pasta);
    await initMem(pasta);
    try{ await logEvent(pasta, "repo_aberto", { url: repositorioUrl, branchBase: branchBase||null }); }catch{}
    try{ await saveState(pasta, { repoUrl: repositorioUrl, branchBase: branchBase||null }); }catch{}
    let analise = null;
    try{ analise = await analisar_repositorio(pasta, arvore); }catch{}
    res.json({ ok:true, pasta, arvore, analise });
  }catch(e){ res.status(500).json({erro:String(e?.message||e)}); }
});

app.get("/repo/tree", async (_req,res)=>{
  try{
    if(!estado.pasta) return res.status(400).json({erro:"Nenhum repositÃ³rio aberto"});
    const arvore = await listar_arvore(estado.pasta);
    res.json({arvore});
  }catch(e){ res.status(500).json({erro:String(e?.message||e)}); }
});

app.get("/repo/file", async (req,res)=>{
  try{
    if(!estado.pasta) return res.status(400).json({erro:"Nenhum repositÃ³rio aberto"});
    const rel = req.query.path;
    if(!rel) return res.status(400).json({erro:"path Ã© obrigatÃ³rio"});
    const full = path.join(estado.pasta, rel);
    const data = await fs.promises.readFile(full, "utf-8");
    try{ await logEvent(estado.pasta, "ler_arquivo", { path: rel, bytes: Buffer.byteLength(data, 'utf-8') }); }catch{}
    res.type("text/plain").send(data);
  }catch(e){ res.status(500).json({erro:String(e?.message||e)}); }
});

app.post("/repo/save", async (req,res)=>{
  try{
    if(!estado.pasta) return res.status(400).json({erro:"Nenhum repositÃ³rio aberto"});
    const { path: rel, conteudo } = req.body||{};
    if(!rel) return res.status(400).json({erro:"path Ã© obrigatÃ³rio"});
    const full = path.join(estado.pasta, rel);
    await fs.promises.mkdir(path.dirname(full), {recursive:true});
    await fs.promises.writeFile(full, conteudo??"", "utf-8");
    try{ await logEvent(estado.pasta, "salvar_arquivo", { path: rel, bytes: Buffer.byteLength(conteudo??"", 'utf-8') }); }catch{}
    res.json({ok:true});
  }catch(e){ res.status(500).json({erro:String(e?.message||e)}); }
});

app.post("/repo/create", async (req,res)=>{
  try{
    if(!estado.pasta) return res.status(400).json({erro:"Nenhum repositÃ³rio aberto"});
    const { path: rel, tipo, conteudo } = req.body||{};
    if(!rel) return res.status(400).json({erro:"path Ã© obrigatÃ³rio"});
    const full = path.join(estado.pasta, rel);
    const base = path.resolve(estado.pasta);
    const normalized = path.resolve(full);
    if(!normalized.startsWith(base)) return res.status(400).json({erro:"Caminho invÃ¡lido"});
    if(tipo === "dir"){
      await fs.promises.mkdir(full, { recursive: true });
    } else {
      await fs.promises.mkdir(path.dirname(full), { recursive: true });
      await fs.promises.writeFile(full, conteudo ?? "", "utf-8");
    }
    try{ await logEvent(estado.pasta, "criar_item", { path: rel, tipo: tipo||"file" }); }catch{}
    res.json({ok:true});
  }catch(e){ res.status(500).json({erro:String(e?.message||e)}); }
});

app.post("/repo/delete", async (req,res)=>{
  try{
    if(!estado.pasta) return res.status(400).json({erro:"Nenhum repositÃ³rio aberto"});
    const { path: rel } = req.body||{};
    if(!rel) return res.status(400).json({erro:"path Ã© obrigatÃ³rio"});
    const full = path.join(estado.pasta, rel);
    const base = path.resolve(estado.pasta);
    const normalized = path.resolve(full);
    if(!normalized.startsWith(base)) return res.status(400).json({erro:"Caminho invÃ¡lido"});
    let stats;
    try{
      stats = await fs.promises.stat(full);
    }catch{
      return res.status(404).json({erro:"Item nÃ£o encontrado"});
    }
    if(stats.isDirectory()){
      await fs.promises.rm(full, { recursive: true, force: true });
    } else {
      await fs.promises.unlink(full);
    }
    try{ await logEvent(estado.pasta, "excluir_item", { path: rel }); }catch{}
    res.json({ok:true});
  }catch(e){ res.status(500).json({erro:String(e?.message||e)}); }
});

app.post("/repo/commit", async (req,res)=>{
  try{
    if(!estado.pasta) return res.status(400).json({erro:"Nenhum repositÃ³rio aberto"});
    const { mensagem } = req.body||{};
    await commit_e_push(estado.pasta, mensagem || "chore: atualizaÃ§Ãµes via Agente");
    res.json({ok:true});
  }catch(e){ res.status(500).json({erro:String(e?.message||e)}); }
});

// Busca simples no projeto inteiro (substring ou regex opcional)
app.post("/repo/search", async (req,res)=>{
  try{
    if(!estado.pasta) return res.status(400).json({erro:"Nenhum repositÃ³rio aberto"});
    const { query, regex=false, maxResults=50 } = req.body||{};
    if(!query || typeof query!=='string') return res.status(400).json({erro:"query obrigatÃ³ria"});
    const base = estado.pasta;
    const ignorar = new Set([".git","node_modules",".next","dist","build"]);
    const maxBytes = 512*1024; // 512 KB por arquivo
    const matches = [];
    const rx = regex ? new RegExp(query, 'i') : null;
    const q = regex ? null : query.toLowerCase();

    async function walk(dir){
      const itens = await fs.promises.readdir(dir,{withFileTypes:true});
      for(const ent of itens){
        if(matches.length>=maxResults) return;
        if(ignorar.has(ent.name)) continue;
        const full = path.join(dir, ent.name);
        if(ent.isDirectory()){
          await walk(full);
        } else {
          try{
            const stat = await fs.promises.stat(full);
            if(stat.size>maxBytes) continue;
            const buf = await fs.promises.readFile(full);
            const txt = buf.toString("utf-8");
            let hit = false;
            const lines = txt.split(/\r?\n/);
            const outLines = [];
            for(let i=0;i<lines.length;i++){
              const line = lines[i];
              if(regex ? rx.test(line) : line.toLowerCase().includes(q)){
                hit = true;
                outLines.push({ number: i+1, text: line.slice(0, 400) });
                if(outLines.length>=5) break;
              }
            }
            if(hit){
              matches.push({ path: path.relative(base, full).replace(/\\/g,'/'), lines: outLines });
            }
          }catch{}
        }
      }
    }
    await walk(base);
    try{ await logEvent(base, "busca", { query, total: matches.length }); }catch{}
    res.json({ matches });
  }catch(e){ res.status(500).json({erro:String(e?.message||e)}); }
});

app.post("/chat", async (req,res)=>{
  try{
    const { mensagem } = req.body||{};
    if(!mensagem) return res.status(400).json({erro:"mensagem é obrigatória"});
    const ctx = estado.pasta ? `Repositório local: ${estado.pasta}` : "";
    const resposta = await chat_simples(mensagem, ctx);
    res.json({resposta});
  }catch(e){ res.status(500).json({erro:String(e?.message||e)}); }
});

// Saúde do Ollama
// Chat com tentativa de ediÃ§Ã£o de arquivos do repositÃ³rio
app.post("/chat2", async (req,res)=>{
  try{
    const { mensagem, arquivoAtual } = req.body||{};
    if(!mensagem) return res.status(400).json({erro:"mensagem é obrigatória"});

    if(estado.pasta){
      const arvore = await listar_arvore(estado.pasta);
      const limitar = (arr, n=600) => arr.slice(0, n);
      const treeStr = limitar(arvore, 1200).map(i=>`- ${i.path}`).join("\n");
      let atualConteudo = "";
      let atualPath = "";
      if(arquivoAtual){
        try{
          const full = path.join(estado.pasta, arquivoAtual);
          atualConteudo = await fs.promises.readFile(full, "utf-8");
          atualPath = arquivoAtual;
        }catch{}
      }

      const contexto = `VocÃª Ã© um agente que edita um Repositório local.\n`+
        `Raiz: ${estado.pasta}\n`+
        `Arquivos (parcial):\n${treeStr}\n\n`+
        (atualPath?`Arquivo atual: ${atualPath}\nConteÃºdo atual (pode estar desatualizado):\n\n"""\n${atualConteudo}\n"""\n\n`:"")+
        `InstruÃ§Ã£o do usuÃ¡rio: ${mensagem}\n\n`+
        `Tarefa: Se a instruÃ§Ã£o for uma alteraÃ§Ã£o no cÃ³digo/estilos, responda ESTRITAMENTE um JSON compacto, sem texto fora do JSON, no formato:\n`+
        `{"arquivo":"caminho/relativo", "conteudo":"arquivo inteiro atualizado", "mensagemCommit":"mensagem curta"}\n`+
        `- Escolha o arquivo correto baseado na lista e/ou no arquivo atual.\n`+
        `- Se nenhuma mudança for necessária, responda {"mensagem":"explicaÃ§Ã£o"}.`;

      const bruto = await chat_simples("Gere a resposta conforme instruÃ§Ãµes.", contexto);

      let jsonTxt = bruto;
      const i = bruto.indexOf("{");
      const j = bruto.lastIndexOf("}");
      if(i>=0 && j>i){ jsonTxt = bruto.slice(i, j+1); }
      let plano;
      try{ plano = JSON.parse(jsonTxt); }catch{}

      if(plano && typeof plano === 'object' && (plano.conteudo && plano.arquivo)){
        const rel = String(plano.arquivo).replace(/^\/+/, "");
        const full = path.join(estado.pasta, rel);
        const base = path.resolve(estado.pasta);
        const normalized = path.resolve(full);
        if(!normalized.startsWith(base)) return res.status(400).json({erro:"Caminho gerado fora do repositório"});
        await fs.promises.mkdir(path.dirname(full), {recursive:true});
        await fs.promises.writeFile(full, plano.conteudo, "utf-8");
        try{
          await commit_e_push(estado.pasta, plano.mensagemCommit || `chore: ajuste automático em ${rel}`);
        }catch{}
        return res.json({resposta: `AlteraÃ§Ã£o aplicada em ${rel}.`, aplicado:true, arquivo: rel});
      }

      return res.json({resposta: typeof bruto === 'string' ? bruto : "Sem resposta"});
    }

    const resposta = await chat_simples(mensagem, "Sem repositório aberto.");
    res.json({resposta});
  }catch(e){ res.status(500).json({erro:String(e?.message||e)}); }
});

// Chat aprimorado com leitura de contexto do projeto
app.post("/chat3", async (req,res)=>{
  try{
    const { mensagem, arquivoAtual } = req.body||{};
    if(!mensagem) return res.status(400).json({erro:"mensagem é obrigatória"});

    if(estado.pasta){
      const arvore = await listar_arvore(estado.pasta);
      const limitar = (arr, n=600) => arr.slice(0, n);
      const treeStr = limitar(arvore, 1200).map(i=>`- ${i.path}`).join("\n");
      let atualConteudo = "";
      let atualPath = "";
      if(arquivoAtual){
        try{
          const full = path.join(estado.pasta, arquivoAtual);
          atualConteudo = await fs.promises.readFile(full, "utf-8");
          atualPath = arquivoAtual;
        }catch{}
      }

      // HeurÃ­sticas de contexto: termos entre aspas e "tela inicial"
      const quoted = Array.from(mensagem.matchAll(/["']([^"']+)["']/g)).map(m=>m[1]).filter(Boolean);
      const wantsHome = /tela\s+inicial|p[aÃ¡]gina\s+inicial|\bhome\b|landing/i.test(mensagem);
      const candidatosEntrada = [
        'src/app.jsx','src/App.jsx','src/app.tsx','src/App.tsx','src/main.jsx','src/main.tsx','src/index.jsx','src/index.tsx',
        'pages/index.jsx','pages/index.tsx','src/pages/index.jsx','src/pages/index.tsx',
        'index.html','public/index.html','src/index.html'
      ];
      const arquivosProjeto = arvore.filter(i=>i.tipo==='file').map(i=>i.path);
      const setArv = new Set(arquivosProjeto);
      const candidatosExistentes = candidatosEntrada.filter(p=>setArv.has(p));

      // Busca simples por termos citados (limite de arquivos e tamanho)
      const relevantesSet = new Set();
      const relevantes = [];
      const maxBytes = 512*1024;
      if(quoted.length){
        const termos = quoted.slice(0,3);
        for(const termo of termos){
          const alvo = termo.toLowerCase();
          for(const rel of arquivosProjeto){
            if(relevantes.length>=8) break;
            try{
              const full = path.join(estado.pasta, rel);
              const st = await fs.promises.stat(full);
              if(st.size>maxBytes) continue;
              const txt = await fs.promises.readFile(full, 'utf-8');
              if(txt.toLowerCase().includes(alvo)){
                if(!relevantesSet.has(rel)){
                  relevantesSet.add(rel);
                  relevantes.push({ path: rel, motivo: `contÃ©m "${termo}"` });
                }
              }
            }catch{}
          }
          if(relevantes.length>=8) break;
        }
      }

      if(wantsHome){
        for(const p of candidatosExistentes){
          if(relevantes.length>=10) break;
          if(!relevantesSet.has(p)){
            relevantesSet.add(p);
            relevantes.push({ path: p, motivo: 'candidato de tela inicial' });
          }
        }
      }

      // Carregar conteÃºdo dos candidatos relevantes (recorte)
      const blobs = [];
      for(const r of relevantes.slice(0,10)){
        try{
          const full = path.join(estado.pasta, r.path);
          const txt = await fs.promises.readFile(full, 'utf-8');
          const recorte = txt.length>8000 ? txt.slice(0,8000) : txt;
          blobs.push({ path: r.path, motivo: r.motivo, conteudo: recorte });
        }catch{}
      }
      if(blobs.length){ try{ await logEvent(estado.pasta, 'contexto_relevante', { arquivos: blobs.map(b=>b.path) }); }catch{} }

      const contexto = `VocÃª Ã© um agente que edita um Repositório local.\n`+
        `Raiz: ${estado.pasta}\n`+
        `Arquivos (parcial):\n${treeStr}\n\n`+
        (atualPath?`Arquivo atual: ${atualPath}\nConteÃºdo atual (pode estar desatualizado):\n\n"""\n${atualConteudo}\n"""\n\n`:"")+
        (blobs.length?`Arquivos relevantes (recorte):\n${blobs.map(b=>`[${b.path}] (motivo: ${b.motivo})\n"""\n${b.conteudo}\n"""`).join("\n\n")}\n\n`:"")+
        `InstruÃ§Ã£o do usuÃ¡rio: ${mensagem}\n\n`+
        `Tarefa: Se a instruÃ§Ã£o for uma alteraÃ§Ã£o no cÃ³digo/estilos, responda ESTRITAMENTE um JSON compacto, sem texto fora do JSON, no formato:\n`+
        `{"arquivo":"caminho/relativo", "conteudo":"arquivo inteiro atualizado", "mensagemCommit":"mensagem curta"}\n`+
        `- Escolha o arquivo correto baseado na lista e/ou no arquivo atual.\n`+
        `- Se nenhuma mudança for necessária, responda {"mensagem":"explicaÃ§Ã£o"}.`;

      const bruto = await chat_simples("Gere a resposta conforme instruÃ§Ãµes.", contexto);

      let jsonTxt = bruto;
      const i = bruto.indexOf("{");
      const j = bruto.lastIndexOf("}");
      if(i>=0 && j>i){ jsonTxt = bruto.slice(i, j+1); }
      let plano;
      try{ plano = JSON.parse(jsonTxt); }catch{}

      if(plano && typeof plano === 'object' && (plano.conteudo && plano.arquivo)){
        const rel = String(plano.arquivo).replace(/^\/+/, "");
        const full = path.join(estado.pasta, rel);
        const base = path.resolve(estado.pasta);
        const normalized = path.resolve(full);
        if(!normalized.startsWith(base)) return res.status(400).json({erro:"Caminho gerado fora do repositório"});
        await fs.promises.mkdir(path.dirname(full), {recursive:true});
        await fs.promises.writeFile(full, plano.conteudo, "utf-8");
        try{
          await commit_e_push(estado.pasta, plano.mensagemCommit || `chore: ajuste automático em ${rel}`);
        }catch{}
        try{ await logEvent(estado.pasta, 'alteracao_aplicada', { arquivo: rel, mensagemCommit: plano.mensagemCommit||null }); }catch{}
        return res.json({resposta: `AlteraÃ§Ã£o aplicada em ${rel}.`, aplicado:true, arquivo: rel});
      }

      return res.json({resposta: typeof bruto === 'string' ? bruto : "Sem resposta"});
    }

    const resposta = await chat_simples(mensagem, "Sem repositório aberto.");
    res.json({resposta});
  }catch(e){ res.status(500).json({erro:String(e?.message||e)}); }
});

app.get("/ollama/saude", async (_req,res)=>{
  try{
    const r = await fetch(`${process.env.OLLAMA_URL || "http://localhost:11434"}/api/tags`);
    if(!r.ok) return res.status(502).json({ok:false, status:r.status});
    const j = await r.json();
    const modelos = (j?.models||[]).map(m=>m?.name);
    const selecionado = process.env.LLM_MODEL || "qwen3-coder:480b-cloud";
    const disponivel = modelos.includes(selecionado);
    res.json({ok:true, modelos, selecionado, disponivel});
  }catch(e){ res.status(500).json({ok:false, erro:String(e?.message||e)}); }
});

// iniciar servidor somente apÃ³s rotas registradas
await start();



