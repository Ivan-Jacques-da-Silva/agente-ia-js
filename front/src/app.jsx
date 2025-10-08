import React, { useState } from "react";
const API = import.meta.env.VITE_API_URL || "http://localhost:5050";
export default function App(){
  const [titulo,setTitulo]=useState(""); const [repo,setRepo]=useState(""); const [id,setId]=useState(); const [status,setStatus]=useState(null);
  async function criar_tarefa(){ const r=await fetch(`${API}/tarefas`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({titulo,repositorioUrl:repo})}); const j=await r.json(); setId(j.id); }
  async function ver_status(){ if(!id) return; const r=await fetch(`${API}/tarefas/${id}`); const j=await r.json(); setStatus(j); }
  return (<div style={{maxWidth:800,margin:"40px auto",fontFamily:"ui-sans-serif"}}>
    <h1 style={{fontSize:24,fontWeight:700}}>Agente IA — Painel</h1>
    <div style={{display:"grid",gap:8,marginTop:16}}>
      <input placeholder="Título da tarefa" value={titulo} onChange={e=>setTitulo(e.target.value)} style={{padding:8,border:"1px solid #ccc",borderRadius:6}}/>
      <input placeholder="URL do repositório git" value={repo} onChange={e=>setRepo(e.target.value)} style={{padding:8,border:"1px solid #ccc",borderRadius:6}}/>
      <div style={{display:"flex",gap:8}}>
        <button onClick={criar_tarefa} style={{padding:"8px 12px",background:"#2563eb",color:"#fff",border:0,borderRadius:6}}>Criar tarefa</button>
        <button onClick={ver_status} style={{padding:"8px 12px",background:"#0f172a",color:"#fff",border:0,borderRadius:6}}>Ver status</button>
      </div>
    </div>
    {id && <p style={{marginTop:12}}>ID da tarefa: <b>{id}</b></p>}
    {status && <pre style={{background:"#fff",border:"1px solid #e5e7eb",padding:12,borderRadius:8,marginTop:12,overflow:"auto"}}>{JSON.stringify(status,null,2)}</pre>}
  </div>);
}
