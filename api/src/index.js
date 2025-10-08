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

const AGENTE_URL = `http://localhost:${process.env.AGENTE_PORTA || 6060}`;

fila.on("executar", async (job) => {
  const t = tarefas.get(job.id);
  if (!t) return;
  t.estado = "em_execucao";
  try {
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

const porta = Number(process.env.API_PORTA || 5050);
app.listen(porta, () => console.log(`API na porta ${porta}`));

