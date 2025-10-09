import fs from "node:fs";
import path from "node:path";

function dirAgente(base){
  return path.join(base, ".agent");
}

async function ensureDir(p){
  await fs.promises.mkdir(p, { recursive: true });
}

export async function initMem(base){
  const dir = dirAgente(base);
  await ensureDir(dir);
  const statePath = path.join(dir, "state.json");
  try{ await fs.promises.access(statePath); }
  catch{ await fs.promises.writeFile(statePath, JSON.stringify({ createdAt: new Date().toISOString() }, null, 2), "utf-8"); }
}

export async function logEvent(base, tipo, dados={}){
  try{
    await initMem(base);
    const linha = JSON.stringify({ ts: new Date().toISOString(), tipo, ...dados })+"\n";
    await fs.promises.appendFile(path.join(dirAgente(base), "history.jsonl"), linha, "utf-8");
  }catch{}
}

export async function loadState(base){
  try{
    const raw = await fs.promises.readFile(path.join(dirAgente(base), "state.json"), "utf-8");
    return JSON.parse(raw||"{}")||{};
  }catch{ return {}; }
}

export async function saveState(base, patch){
  try{
    await initMem(base);
    const atual = await loadState(base);
    const novo = { ...atual, ...patch, updatedAt: new Date().toISOString() };
    await fs.promises.writeFile(path.join(dirAgente(base), "state.json"), JSON.stringify(novo, null, 2), "utf-8");
    return novo;
  }catch{ return null; }
}

