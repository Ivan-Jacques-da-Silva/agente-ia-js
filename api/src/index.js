import "dotenv/config";
import express from "express";
import cors from "cors";
import net from "node:net";
import { nanoid } from "nanoid";
import { FilaMemoria } from "./fila.js";

const app = express();
// CORS permissivo (qualquer origem) e preflight
app.use((req,res,next)=>{
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "*");
  if(req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
app.use(express.json());

const tarefas = new Map();
const fila = new FilaMemoria();

app.get("/saude", (_req, res) => res.json({ ok: true }));

// Proxy estável para o Agente (evita depender de proxy do Vite)
app.use('/proxy/agente', async (req, res) => {
  try{
    const base = await getAgenteUrl();
    const target = base + req.originalUrl.replace(/^\/proxy\/agente/, "");
    const init = { method: req.method, headers: { } };
    for (const [k,v] of Object.entries(req.headers)){
      if (["host","content-length"].includes(k)) continue;
      init.headers[k] = v;
    }
    if(req.method !== 'GET' && req.method !== 'HEAD'){
      const ct = (req.headers['content-type']||'')+'';
      if (ct.includes('application/json') && req.body && typeof req.body === 'object'){
        init.headers['content-type'] = 'application/json';
        init.body = JSON.stringify(req.body);
      } else {
        const chunks=[]; for await (const ch of req) chunks.push(ch);
        const body = Buffer.concat(chunks);
        if(body.length) init.body = body;
      }
    }
    const r = await fetch(target, init);
    const buf = Buffer.from(await r.arrayBuffer());
    res.status(r.status);
    for (const [k,v] of r.headers.entries()) res.setHeader(k, v);
    res.setHeader('Access-Control-Allow-Origin','*');
    res.send(buf);
  }catch(e){
    res.setHeader('Access-Control-Allow-Origin','*');
    res.status(502).json({ erro: String(e?.message||e) });
  }
});

// Compat: se o front chamar sem prefixo, encaminha para o Agente
app.post('/repo/abrir', async (req, res) => {
  try{
    const base = await getAgenteUrl();
    const r = await fetch(`${base}/repo/abrir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body||{}),
    });
    const text = await r.text();
    res.status(r.status);
    res.set('Access-Control-Allow-Origin','*');
    const ct = r.headers.get('content-type') || '';
    if (ct.includes('application/json')){ try{ return res.json(JSON.parse(text)); }catch{ /* fallback below */ } }
    return res.send(text);
  }catch(e){
    res.set('Access-Control-Allow-Origin','*');
    res.status(502).json({ erro: String(e?.message||e) });
  }
});

app.post("/tarefas", async (req, res) => {
  const { titulo, repositorioUrl, descricao, branchBase } = req.body || {};
  if (!titulo || !repositorioUrl)
    return res
      .status(400)
      .json({ erro: "Campos obrigatórios: titulo, repositorioUrl" });
  const id = nanoid();
  const t = {
    id,
    titulo,
    descricao,
    repositorioUrl,
    branchBase,
    estado: "criada",
    logs: [],
  };
  tarefas.set(id, t);
  await fila.adicionar({ id, dados: t });
  res.status(201).json({ id });
});

app.get("/tarefas/:id", (req, res) => {
  const t = tarefas.get(req.params.id);
  if (!t) return res.status(404).json({ erro: "Não encontrado" });
  res.json(t);
});

let AGENTE_URL_CACHE = null;
async function getAgenteUrl(){
  if (AGENTE_URL_CACHE) return AGENTE_URL_CACHE;
  const base = Number(process.env.AGENTE_PORTA || 6060);
  for(let p=base; p<base+10; p++){
    try{
      const r = await fetch(`http://localhost:${p}/saude`);
      if(r.ok){
        AGENTE_URL_CACHE = `http://localhost:${p}`;
        return AGENTE_URL_CACHE;
      }
    }catch{ /* tenta o próximo */ }
  }
  // fallback, ainda que possa falhar
  AGENTE_URL_CACHE = `http://localhost:${base}`;
  return AGENTE_URL_CACHE;
}

fila.on("executar", async (job) => {
  const t = tarefas.get(job.id);
  if (!t) return;
  t.estado = "em_execucao";
  try {
    const AGENTE_URL = await getAgenteUrl();
    const r = await fetch(`${AGENTE_URL}/executar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(job.dados),
    });
    const txt = await r.text();
    t.logs.push(txt.slice(0, 2000));
    t.estado = r.ok ? "concluida" : "falhou";
  } catch (e) {
    t.logs.push(String(e?.message || e));
    t.estado = "falhou";
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
  const base = Number(process.env.API_PORTA || 5050);
  const porta = await findAvailablePort(base);
  server = app.listen(porta, () => console.log(`API na porta ${porta}`));
}

function graceful(){
  if(server){
    console.log("Encerrando API e liberando porta...");
    try{ server.close(()=> process.exit(0)); }catch{ process.exit(0); }
  } else {
    process.exit(0);
  }
}
process.on("SIGINT", graceful);
process.on("SIGTERM", graceful);

await start();

// Proxy para o Agente: o front chama via API para evitar CORS com o Agente
async function proxyAgente(req, res){
  try{
    const base = await getAgenteUrl();
    const target = base + req.originalUrl.replace(/^\/agente/, "");
    const init = {
      method: req.method,
      headers: { "Content-Type": req.get('content-type') || 'application/json' },
    };
    if(req.method !== 'GET' && req.method !== 'HEAD'){
      init.body = req.rawBody || JSON.stringify(req.body||{});
    }
    const r = await fetch(target, init);
    const text = await r.text();
    res.set('Access-Control-Allow-Origin','*');
    res.status(r.status);
    const ct = r.headers.get('content-type') || '';
    if(ct.includes('application/json')){ try{ return res.json(JSON.parse(text)); }catch{ /* fallthrough */ } }
    return res.send(text);
  }catch(e){
    res.set('Access-Control-Allow-Origin','*');
    res.status(500).json({ erro: String(e?.message||e) });
  }
}

// Registra proxy antes e depois de start() para evitar condições de corrida
app.use('/agente', express.json({limit:'5mb'}), proxyAgente);
app.use('/agente', express.json({limit:'5mb'}), proxyAgente);
