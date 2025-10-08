import "dotenv/config";
import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { executar_fluxo } from "./fluxo.js";
import { chat_simples } from "./llm.js";
import { clonar_repositorio, criar_branch, commit_e_push } from "./ferramentas.js";

const app = express();
app.use(cors());
app.use(express.json({limit:"5mb"}));

app.get("/saude", (_req, res) => res.json({ ok: true }));

app.post("/executar", async (req, res) => {
  try {
    const r = await executar_fluxo(req.body);
    res.json(r);
  } catch (e) {
    res.status(500).send(e?.message || "erro");
  }
});

function start(porta) {
  const server = app.listen(porta, () => console.log(`Agente na porta ${porta}`));
  server.on("error", (err) => {
    if (err && err.code === "EADDRINUSE") {
      console.log(`Porta ${porta} ocupada. Tentando ${porta + 1}...`);
      start(porta + 1);
    } else {
      console.error("Falha ao subir Agente:", err);
      process.exit(1);
    }
  });
}

start(Number(process.env.AGENTE_PORTA || 6060));

// Estado do repositório atual
const estado = {
  pasta: null,
  branch: null,
  url: null,
};

// util para montar árvore de arquivos limitada
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

app.post("/repo/abrir", async (req,res)=>{
  try{
    const { repositorioUrl, branchBase } = req.body||{};
    if(!repositorioUrl) return res.status(400).json({erro:"repositorioUrl é obrigatório"});
    const pasta = path.join(os.tmpdir(), `repo_${Date.now()}`);
    await clonar_repositorio(repositorioUrl, pasta);
    await criar_branch(pasta, `agente/${Date.now()}`);
    estado.pasta = pasta;
    estado.branch = branchBase || null;
    estado.url = repositorioUrl;
    const arvore = await listar_arvore(pasta);
    res.json({ ok:true, pasta, arvore });
  }catch(e){ res.status(500).json({erro:String(e?.message||e)}); }
});

app.get("/repo/tree", async (_req,res)=>{
  try{
    if(!estado.pasta) return res.status(400).json({erro:"Nenhum repositório aberto"});
    const arvore = await listar_arvore(estado.pasta);
    res.json({arvore});
  }catch(e){ res.status(500).json({erro:String(e?.message||e)}); }
});

app.get("/repo/file", async (req,res)=>{
  try{
    if(!estado.pasta) return res.status(400).json({erro:"Nenhum repositório aberto"});
    const rel = req.query.path;
    if(!rel) return res.status(400).json({erro:"path é obrigatório"});
    const full = path.join(estado.pasta, rel);
    const data = await fs.promises.readFile(full, "utf-8");
    res.type("text/plain").send(data);
  }catch(e){ res.status(500).json({erro:String(e?.message||e)}); }
});

app.post("/repo/save", async (req,res)=>{
  try{
    if(!estado.pasta) return res.status(400).json({erro:"Nenhum repositório aberto"});
    const { path: rel, conteudo } = req.body||{};
    if(!rel) return res.status(400).json({erro:"path é obrigatório"});
    const full = path.join(estado.pasta, rel);
    await fs.promises.mkdir(path.dirname(full), {recursive:true});
    await fs.promises.writeFile(full, conteudo??"", "utf-8");
    res.json({ok:true});
  }catch(e){ res.status(500).json({erro:String(e?.message||e)}); }
});

app.post("/repo/commit", async (req,res)=>{
  try{
    if(!estado.pasta) return res.status(400).json({erro:"Nenhum repositório aberto"});
    const { mensagem } = req.body||{};
    await commit_e_push(estado.pasta, mensagem || "chore: atualizações via Agente");
    res.json({ok:true});
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
