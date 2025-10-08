import React, { useEffect, useRef, useState } from "react";

const API_DEFAULT = import.meta.env.VITE_API_URL || "http://localhost:5050";
const AGENTE_DEFAULT = import.meta.env.VITE_AGENT_URL || "http://localhost:6060";

export default function App(){
  const [apiUrl,setApiUrl]=useState(API_DEFAULT);
  const [agenteUrl,setAgenteUrl]=useState(AGENTE_DEFAULT);
  const [titulo,setTitulo]=useState("");
  const [repo,setRepo]=useState("");
  const [descricao,setDescricao]=useState("");
  const [branchBase,setBranchBase]=useState("");
  const [id,setId]=useState();
  const [status,setStatus]=useState(null);
  const [erro,setErro]=useState("");
  const timerRef = useRef(null);

  async function criar_tarefa(){
    setErro("");
    if(!titulo || !repo){ setErro("Preencha título e URL do repositório"); return; }
    try{
      const r=await fetch(`${apiUrl}/tarefas`,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({titulo,repositorioUrl:repo,descricao,branchBase})
      });
      const j=await r.json();
      if(!r.ok) throw new Error(j?.erro||"Falha ao criar tarefa");
      setId(j.id);
      setStatus(null);
    }catch(e){ setErro(String(e?.message||e)); }
  }

  async function ver_status(){
    if(!id) return;
    try{
      const r=await fetch(`${apiUrl}/tarefas/${id}`);
      const j=await r.json();
      setStatus(j);
    }catch(e){ setErro(String(e?.message||e)); }
  }

  useEffect(()=>{
    if(!id) return;
    if(timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(ver_status, 1500);
    return ()=>{ if(timerRef.current) clearInterval(timerRef.current); };
  },[id]);

  useEffect(()=>{
    // Detecta API em portas subsequentes se a padrão falhar
    let cancelado=false;
    (async()=>{
      const base = (()=>{
        try{ const u=new URL(apiUrl); return {host:u.hostname, port:Number(u.port||5050)};}catch{ return {host:"localhost",port:5050}; }
      })();
      for(let p=base.port; p<base.port+10 && !cancelado; p++){
        try{
          const url=`http://${base.host}:${p}/saude`;
          const r=await fetch(url, { method:"GET" });
          if(r.ok){ setApiUrl(`http://${base.host}:${p}`); break; }
        }catch{ /* tenta próxima */ }
      }
    })();
    return ()=>{ cancelado=true; };
  },[]);

  useEffect(()=>{
    // Detecta Agente em portas subsequentes se a padrão falhar
    let cancelado=false;
    (async()=>{
      const base = (()=>{
        try{ const u=new URL(agenteUrl); return {host:u.hostname, port:Number(u.port||6060)};}catch{ return {host:"localhost",port:6060}; }
      })();
      for(let p=base.port; p<base.port+10 && !cancelado; p++){
        try{
          const url=`http://${base.host}:${p}/saude`;
          const r=await fetch(url, { method:"GET" });
          if(r.ok){ setAgenteUrl(`http://${base.host}:${p}`); break; }
        }catch{ /* tenta próxima */ }
      }
    })();
    return ()=>{ cancelado=true; };
  },[]);

  const [arvore,setArvore]=useState([]);
  const [arquivoAtual,setArquivoAtual]=useState("");
  const [conteudo,setConteudo]=useState("");
  const [chat,setChat]=useState([]);

  async function abrir_repo(){
    setErro("");
    try{
      const r=await fetch(`${agenteUrl}/repo/abrir`,{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({repositorioUrl:repo,branchBase})
      });
      const j=await r.json();
      if(!r.ok) throw new Error(j?.erro||"Falha ao abrir repositório");
      setArvore(j.arvore||[]);
    }catch(e){ setErro(String(e?.message||e)); }
  }

  async function carregar_arvore(){
    try{ const r=await fetch(`${agenteUrl}/repo/tree`); const j=await r.json(); setArvore(j.arvore||[]);}catch{ /* ignore */ }
  }

  async function abrir_arquivo(p){
    try{ const r=await fetch(`${agenteUrl}/repo/file?path=${encodeURIComponent(p)}`); const t=await r.text(); setArquivoAtual(p); setConteudo(t);}catch(e){ setErro(String(e?.message||e)); }
  }

  async function salvar_arquivo(){
    if(!arquivoAtual) return;
    try{ await fetch(`${agenteUrl}/repo/save`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({path:arquivoAtual,conteudo})}); await carregar_arvore(); }catch(e){ setErro(String(e?.message||e)); }
  }

  async function commit_push(){
    try{ await fetch(`${agenteUrl}/repo/commit`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mensagem:`feat: atualizações em ${arquivoAtual||"repo"}`})}); }catch(e){ setErro(String(e?.message||e)); }
  }

  async function enviar_chat(texto){
    const msg = texto.trim(); if(!msg) return;
    const novo = [...chat, {autor:"Você", texto: msg}];
    setChat(novo);
    try{
      const r=await fetch(`${agenteUrl}/chat`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mensagem:msg})});
      const j=await r.json();
      setChat([...novo, {autor:"Agente", texto:j.resposta||""}]);
    }catch(e){ setChat([...novo, {autor:"Agente", texto:String(e?.message||e)}]); }
  }

  const [entradaChat,setEntradaChat]=useState("");

  const layout = {
    container:{display:"grid",gridTemplateColumns:"280px 1fr 380px",height:"100vh",fontFamily:"Inter, ui-sans-serif"},
    sidebar:{borderRight:"1px solid #e5e7eb",padding:12,overflow:"auto"},
    main:{display:"grid",gridTemplateRows:"auto 1fr auto",overflow:"hidden"},
    topbar:{display:"flex",gap:8,alignItems:"center",borderBottom:"1px solid #e5e7eb",padding:12},
    editorWrap:{padding:0,overflow:"hidden"},
    editor:{width:"100%",height:"100%",border:0,outline:"none",padding:12,fontFamily:"ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace"},
    actions:{display:"flex",gap:8,borderTop:"1px solid #e5e7eb",padding:12},
    chat:{borderLeft:"1px solid #e5e7eb",display:"grid",gridTemplateRows:"auto 1fr auto"},
    chatHead:{padding:12,borderBottom:"1px solid #e5e7eb"},
    chatBody:{padding:12,overflow:"auto",display:"grid",gap:8,alignContent:"start"},
    chatFoot:{display:"flex",gap:8,padding:12,borderTop:"1px solid #e5e7eb"},
    h1:{fontSize:18,fontWeight:700,margin:0}
  };

  return (
    <div style={layout.container}>
      <aside style={layout.sidebar}>
        <div style={{display:"grid",gap:8}}>
          <h2 style={{fontSize:16,margin:0}}>Repositório</h2>
          <input placeholder="URL do repositório" value={repo} onChange={e=>setRepo(e.target.value)} style={{padding:8,border:"1px solid #e5e7eb",borderRadius:6}}/>
          <input placeholder="Branch base (opcional)" value={branchBase} onChange={e=>setBranchBase(e.target.value)} style={{padding:8,border:"1px solid #e5e7eb",borderRadius:6}}/>
          <button onClick={abrir_repo} style={{padding:"8px 10px",background:"#2563eb",color:"#fff",border:0,borderRadius:6}}>Abrir</button>
          <button onClick={carregar_arvore} style={{padding:"8px 10px",background:"#0f172a",color:"#fff",border:0,borderRadius:6}}>Atualizar árvore</button>
          <div style={{height:1,background:"#e5e7eb"}}/>
          <div>
            <div style={{fontWeight:600,marginBottom:8}}>Arquivos</div>
            <div style={{maxHeight:"70vh",overflow:"auto",fontFamily:"ui-monospace",fontSize:12}}>
              {arvore.map((n,i)=> (
                <div key={i} onClick={()=> n.tipo==="file" && abrir_arquivo(n.path)} style={{padding:"2px 4px",cursor:n.tipo==="file"?"pointer":"default",color:n.tipo==="dir"?"#475569":"#0f172a"}}>
                  {n.tipo==="dir"?"📁":"📄"} {n.path}
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>
      <section style={layout.main}>
        <div style={layout.topbar}>
          <h1 style={layout.h1}>{arquivoAtual||"Selecione um arquivo"}</h1>
          {erro && <div style={{color:"#b91c1c",marginLeft:12}}>{erro}</div>}
        </div>
        <div style={layout.editorWrap}>
          <textarea value={conteudo} onChange={e=>setConteudo(e.target.value)} style={layout.editor} placeholder="Conteúdo do arquivo"/>
        </div>
        <div style={layout.actions}>
          <button onClick={salvar_arquivo} style={{padding:"8px 12px",background:"#059669",color:"#fff",border:0,borderRadius:6}}>Salvar</button>
          <button onClick={commit_push} style={{padding:"8px 12px",background:"#334155",color:"#fff",border:0,borderRadius:6}}>Commit & Push</button>
        </div>
      </section>
      <aside style={layout.chat}>
        <div style={layout.chatHead}><div style={{fontWeight:700}}>Chat</div><div style={{fontSize:12,color:"#475569"}}>com o Agente</div></div>
        <div style={layout.chatBody}>
          {chat.map((m,i)=> (
            <div key={i} style={{background:m.autor==="Você"?"#e0f2fe":"#f1f5f9",border:"1px solid #e5e7eb",borderRadius:8,padding:8}}>
              <div style={{fontWeight:600,fontSize:12,marginBottom:4}}>{m.autor}</div>
              <div style={{whiteSpace:"pre-wrap"}}>{m.texto}</div>
            </div>
          ))}
        </div>
        <div style={layout.chatFoot}>
          <input placeholder="Pergunte algo ao agente..." value={entradaChat} onChange={e=>setEntradaChat(e.target.value)} style={{flex:1,padding:8,border:"1px solid #e5e7eb",borderRadius:6}} onKeyDown={e=>{ if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); enviar_chat(entradaChat); setEntradaChat(""); } }}/>
          <button onClick={()=>{ enviar_chat(entradaChat); setEntradaChat(""); }} style={{padding:"8px 12px",background:"#2563eb",color:"#fff",border:0,borderRadius:6}}>Enviar</button>
        </div>
      </aside>
    </div>
  );
}

