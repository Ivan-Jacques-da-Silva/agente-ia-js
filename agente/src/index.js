import "dotenv/config"; import express from "express"; import { executar_fluxo } from "./fluxo.js";
const app=express(); app.use(express.json());
app.get("/saude",(_req,res)=>res.json({ok:true}));
app.post("/executar", async (req,res)=>{ try{ const r=await executar_fluxo(req.body); res.json(r);}catch(e){ res.status(500).send(e?.message||"erro"); }});
const porta=Number(process.env.AGENTE_PORTA||6060); app.listen(porta,()=>console.log(`Agente na porta ${porta}`));
