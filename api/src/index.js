import "dotenv/config";
import express from "express";
import cors from "cors";
import { nanoid } from "nanoid";
import { FilaMemoria } from "./fila.js";

const app = express();
app.use(cors());
app.use(express.json());

const tarefas = new Map();
const fila = new FilaMemoria();

app.get("/saude", (_req, res) => res.json({ ok: true }));

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

function start(porta) {
  const server = app.listen(porta, () => console.log(`API na porta ${porta}`));
  server.on("error", (err) => {
    if (err && err.code === "EADDRINUSE") {
      console.log(`Porta ${porta} ocupada. Tentando ${porta + 1}...`);
      start(porta + 1);
    } else {
      console.error("Falha ao subir API:", err);
      process.exit(1);
    }
  });
}

start(Number(process.env.API_PORTA || 5050));
