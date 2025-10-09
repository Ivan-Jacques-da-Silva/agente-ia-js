import React, { useEffect, useRef, useState } from "react";

const ORIGIN = typeof window !== "undefined" ? window.location.origin.replace(/\/$/, "") : "";

function normalizeBase(candidate) {
  if (!candidate) return null;
  const raw = String(candidate).trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) {
    return raw.replace(/\/$/, "");
  }
  if (raw.startsWith("//")) {
    if (!ORIGIN) return null;
    const protocol = ORIGIN.split(":")[0] || "http";
    return `${protocol}:${raw}`.replace(/\/$/, "");
  }
  if (raw.startsWith("/")) {
    if (!ORIGIN) return null;
    return `${ORIGIN}${raw}`.replace(/\/$/, "");
  }
  if (ORIGIN) {
    try {
      const url = new URL(raw, `${ORIGIN}/`);
      return url.toString().replace(/\/$/, "");
    } catch (e) {
      console.warn("Falha ao normalizar endpoint", raw, e);
    }
  }
  return null;
}

function uniqueCandidates(list) {
  const vistos = new Set();
  const resultado = [];
  for (const item of list) {
    const normalizado = normalizeBase(item);
    if (normalizado && !vistos.has(normalizado)) {
      vistos.add(normalizado);
      resultado.push(normalizado);
    }
  }
  return resultado;
}

const API_CANDIDATES = uniqueCandidates([
  import.meta.env.VITE_API_URL,
  "/api",
  ORIGIN ? `${ORIGIN}/api` : null,
  "http://localhost:5050",
]);

const AGENTE_CANDIDATES = uniqueCandidates([
  import.meta.env.VITE_AGENT_URL,
  "/agente",
  ORIGIN ? `${ORIGIN}/agente` : null,
  "http://localhost:6060",
]);

function buildUrl(base, path) {
  if (!base) return path;
  if (!path) return base;
  const trimmedBase = base.replace(/\/$/, "");
  const texto = String(path);
  if (/^https?:\/\//i.test(texto)) return texto;
  if (texto.startsWith("?")) return `${trimmedBase}${texto}`;
  const caminho = texto.startsWith("/") ? texto : `/${texto}`;
  return `${trimmedBase}${caminho}`;
}

async function parseJsonResponse(response, fallbackMessage) {
  const texto = await response.text();
  let dados = {};
  if (texto) {
    try {
      dados = JSON.parse(texto);
    } catch (e) {
      console.warn("Resposta não JSON recebida", texto);
      dados = {};
    }
  }
  if (!response.ok) {
    const bruto = (typeof texto === "string" ? texto.trim() : "") || "";
    const ehHtml = bruto.startsWith("<") && bruto.endsWith(">");
    const erro = (dados && dados.erro)
      || (!ehHtml && bruto)
      || fallbackMessage
      || "Falha ao comunicar com o serviço";
    throw new Error(erro);
  }
  return dados;
}

function useEndpointResolver(candidates, healthPath) {
  const [base, setBase] = useState(() => candidates[0] || "");
  const [status, setStatus] = useState("resolving");
  const signature = candidates.join("|");

  useEffect(() => {
    let active = true;
    async function resolve() {
      for (const candidate of candidates) {
        if (!candidate) continue;
        try {
          const response = await fetch(buildUrl(candidate, healthPath));
          if (response.ok) {
            if (active) {
              setBase(candidate);
              setStatus("ready");
            }
            return;
          }
        } catch (e) {
          // tenta o próximo candidato
        }
      }
      if (active) setStatus("failed");
    }
    resolve();
    return () => {
      active = false;
    };
  }, [healthPath, signature]);

  return { base, status };
}

export default function App(){
  const { base: apiUrl, status: apiStatus } = useEndpointResolver(API_CANDIDATES, "/saude");
  const { base: agenteUrl, status: agenteStatus } = useEndpointResolver(AGENTE_CANDIDATES, "/saude");
  const [titulo,setTitulo]=useState("");
  const [repo,setRepo]=useState("");
  const [descricao,setDescricao]=useState("");
  const [branchBase,setBranchBase]=useState("");
  const [id,setId]=useState();
  const [status,setStatus]=useState(null);
  const [erro,setErro]=useState("");
  const timerRef = useRef(null);

  function requireApiReady(){
    if(apiStatus === "failed"){ setErro("API indisponível. Verifique o serviço do backend."); return false; }
    if(apiStatus !== "ready"){ setErro("Aguardando conexão com a API..."); return false; }
    return true;
  }

  function requireAgentReady(){
    if(agenteStatus === "failed"){ setErro("Agente indisponível. Verifique o serviço do agente."); return false; }
    if(agenteStatus !== "ready"){ setErro("Aguardando conexão com o agente..."); return false; }
    return true;
  }

  async function criar_tarefa(){
    setErro("");
    if(!requireApiReady()) return;
    if(!titulo || !repo){ setErro("Preencha título e URL do repositório"); return; }
    try{
      const r=await fetch(buildUrl(apiUrl, "/tarefas"),{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({titulo,repositorioUrl:repo,descricao,branchBase})
      });
      const j=await parseJsonResponse(r, "Falha ao criar tarefa");
      setId(j.id);
      setStatus(null);
    }catch(e){ setErro(String(e?.message||e)); }
  }

  async function ver_status(){
    if(!id) return;
    if(!requireApiReady()) return;
    try{
      const r=await fetch(buildUrl(apiUrl, `/tarefas/${id}`));
      const j=await parseJsonResponse(r, "Falha ao consultar status");
      setStatus(j);
    }catch(e){ setErro(String(e?.message||e)); }
  }

  useEffect(()=>{
    if(!id) return;
    if(timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(ver_status, 1500);
    return ()=>{ if(timerRef.current) clearInterval(timerRef.current); };
  },[id]);

  // Estados de edição de arquivos e chat
  const [arvore,setArvore]=useState([]);
  const [arquivoAtual,setArquivoAtual]=useState("");
  const [conteudo,setConteudo]=useState("");
  const [original,setOriginal]=useState("");
  const dirty = conteudo !== original;
  const [chat,setChat]=useState([]);

  const statusMeta = {
    ready: { texto: "Conectado", cor: "#4ade80" },
    resolving: { texto: "Conectando...", cor: "#facc15" },
    failed: { texto: "Falha na conexão", cor: "#f87171" },
  };

  const conexoes = [
    { chave:"api", titulo:"API de tarefas", status: apiStatus, url: apiUrl },
    { chave:"agente", titulo:"Agente", status: agenteStatus, url: agenteUrl },
  ];

  async function abrir_repo(){
    setErro("");
    if(!requireAgentReady()) return;
    try{
      const r=await fetch(buildUrl(agenteUrl, "/repo/abrir"),{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({repositorioUrl:repo,branchBase})
      });
      const j=await parseJsonResponse(r, "Falha ao abrir repositório");
      setArvore(j.arvore||[]);
    }catch(e){ setErro(String(e?.message||e)); }
  }

  async function carregar_arvore(){
    if(!requireAgentReady()) return;
    try{
      const r=await fetch(buildUrl(agenteUrl, "/repo/tree"));
      const j=await parseJsonResponse(r, "Falha ao carregar árvore");
      setArvore(j.arvore||[]);
    }catch{ /* ignore */ }
  }

  async function abrir_arquivo(p){
    if(!requireAgentReady()) return;
    try{ const r=await fetch(buildUrl(agenteUrl, `/repo/file?path=${encodeURIComponent(p)}`)); const t=await r.text(); setArquivoAtual(p); setConteudo(t); setOriginal(t);}catch(e){ setErro(String(e?.message||e)); }
  }

  async function salvar_arquivo(){
    if(!arquivoAtual) return;
    if(!requireAgentReady()) return;
    try{
      const r = await fetch(buildUrl(agenteUrl, "/repo/save"),{
        method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({path:arquivoAtual,conteudo})
      });
      await parseJsonResponse(r, "Falha ao salvar arquivo");
      setOriginal(conteudo);
      await carregar_arvore();
    }catch(e){ setErro(String(e?.message||e)); }
  }

  async function commit_push(){
    if(!requireAgentReady()) return;
    try{
      const r = await fetch(buildUrl(agenteUrl, "/repo/commit"),{
        method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mensagem:`feat: atualizações em ${arquivoAtual||"repo"}`})
      });
      await parseJsonResponse(r, "Falha ao realizar commit");
    }catch(e){ setErro(String(e?.message||e)); }
  }

  async function enviar_chat(texto){
    const msg = texto.trim(); if(!msg) return;
    if(!requireAgentReady()) { setErro("Aguardando conexão com o agente para enviar mensagens."); return; }
    const novo = [...chat, {autor:"Você", texto: msg}];
    setChat(novo);
    try{
      const r=await fetch(buildUrl(agenteUrl, "/chat"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mensagem:msg})});
      const j=await parseJsonResponse(r, "Falha ao enviar mensagem");
      setChat([...novo, {autor:"Agente", texto:j.resposta||""}]);
    }catch(e){ setChat([...novo, {autor:"Agente", texto:String(e?.message||e)}]); }
  }

  const [entradaChat,setEntradaChat]=useState("");

  const layout = {
    page:{display:"grid",gridTemplateColumns:"320px 1fr 360px",height:"100vh",fontFamily:"'Inter', system-ui, -apple-system, BlinkMacSystemFont",background:"linear-gradient(135deg,#f8fafc,#e2e8f0)"},
    sidebar:{padding:20,overflow:"auto",background:"rgba(15,23,42,0.85)",color:"#e2e8f0",backdropFilter:"blur(12px)",display:"grid",gap:18},
    logo:{display:"flex",alignItems:"center",gap:10,fontWeight:700,fontSize:18},
    badge:{background:"rgba(148,163,184,0.25)",padding:"4px 10px",borderRadius:999,fontSize:12,letterSpacing:0.5,display:"inline-flex",alignItems:"center",gap:6},
    inputLabel:{fontSize:12,textTransform:"uppercase",letterSpacing:0.6,color:"#cbd5f5"},
    input:{padding:"10px 12px",borderRadius:10,border:"1px solid rgba(148,163,184,0.35)",background:"rgba(15,23,42,0.6)",color:"#f8fafc"},
    statusBadge:{padding:"12px 14px",borderRadius:12,background:"rgba(148,163,184,0.16)",border:"1px solid rgba(148,163,184,0.28)",display:"grid",gap:6},
    statusHeader:{display:"flex",alignItems:"center",gap:8,fontWeight:600,fontSize:13},
    statusUrl:{fontSize:11,color:"rgba(226,232,240,0.75)",wordBreak:"break-word"},
    buttonPrimary:{padding:"10px 14px",background:"linear-gradient(135deg,#3b82f6,#2563eb)",color:"#fff",border:0,borderRadius:10,fontWeight:600,boxShadow:"0 10px 25px rgba(37,99,235,0.35)",cursor:"pointer"},
    buttonSecondary:{padding:"10px 14px",background:"rgba(148,163,184,0.2)",color:"#f8fafc",border:"1px solid rgba(148,163,184,0.3)",borderRadius:10,fontWeight:500,cursor:"pointer"},
    main:{display:"grid",gridTemplateRows:"auto 1fr auto",overflow:"hidden",padding:"24px",gap:18},
    panel:{background:"rgba(255,255,255,0.82)",borderRadius:20,boxShadow:"0 25px 50px -12px rgba(15,23,42,0.25)",backdropFilter:"blur(14px)",display:"grid",gridTemplateRows:"auto 1fr auto"},
    topbar:{display:"flex",gap:12,alignItems:"center",padding:"18px 20px",borderBottom:"1px solid rgba(226,232,240,0.8)"},
    topTitle:{fontSize:18,fontWeight:700,margin:0,color:"#0f172a"},
    editorWrap:{padding:0,overflow:"hidden"},
    editor:{width:"100%",height:"100%",border:0,outline:"none",padding:20,fontSize:14,lineHeight:1.5,color:"#0f172a",background:"transparent",fontFamily:"ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace"},
    actions:{display:"flex",gap:12,padding:"16px 20px",borderTop:"1px solid rgba(226,232,240,0.8)",background:"rgba(248,250,252,0.9)"},
    chat:{padding:24,display:"grid",gridTemplateRows:"auto 1fr auto",gap:16},
    chatCard:{background:"rgba(255,255,255,0.82)",borderRadius:20,boxShadow:"0 25px 50px -12px rgba(15,23,42,0.2)",backdropFilter:"blur(14px)",display:"grid",gridTemplateRows:"auto 1fr auto"},
    chatHead:{padding:"18px 20px",borderBottom:"1px solid rgba(226,232,240,0.7)",display:"flex",flexDirection:"column",gap:4},
    chatBody:{padding:"18px 20px",overflow:"auto",display:"grid",gap:12,alignContent:"start",background:"rgba(248,250,252,0.65)",borderRadius:"0 0 20px 20px"},
    chatFoot:{display:"flex",gap:10,padding:"16px 20px",borderTop:"1px solid rgba(226,232,240,0.7)",background:"rgba(248,250,252,0.9)",borderRadius:"0 0 20px 20px"},
    tag:{fontSize:12,fontWeight:600,color:"#334155"}
  };

  return (
    <div style={layout.page}>
      <aside style={layout.sidebar}>
        <div style={layout.logo}>
          <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:36,height:36,borderRadius:12,background:"rgba(148,163,184,0.2)",color:"#38bdf8",fontWeight:700}}>AI</span>
          <div>
            Painel do Agente
            <div style={layout.badge}>Gerencie sua sessão</div>
          </div>
        </div>
        <div style={{display:"grid",gap:12}}>
          <div style={{fontWeight:600,fontSize:13,letterSpacing:0.2,color:"#cbd5f5"}}>Conexões automáticas</div>
          <div style={{display:"grid",gap:10}}>
            {conexoes.map((c)=>{
              const meta = statusMeta[c.status] || statusMeta.resolving;
              return (
                <div key={c.chave} style={layout.statusBadge}>
                  <div style={layout.statusHeader}>
                    <span style={{width:8,height:8,borderRadius:"50%",background:meta.cor}}/>
                    <span>{c.titulo}</span>
                    <span style={{marginLeft:"auto",fontSize:12,color:"rgba(226,232,240,0.75)"}}>{meta.texto}</span>
                  </div>
                  <div style={layout.statusUrl}>{c.url || "Detectando endpoint..."}</div>
                </div>
              );
            })}
          </div>
        </div>
        <div style={{height:1,background:"rgba(148,163,184,0.25)"}}/>
        <div style={{display:"grid",gap:14}}>
          <div style={{display:"grid",gap:6}}>
            <div style={layout.inputLabel}>Repositório</div>
            <input placeholder="URL do repositório" value={repo} onChange={e=>setRepo(e.target.value)} style={layout.input}/>
          </div>
          <div style={{display:"grid",gap:6}}>
            <div style={layout.inputLabel}>Branch base (opcional)</div>
            <input placeholder="main" value={branchBase} onChange={e=>setBranchBase(e.target.value)} style={layout.input}/>
          </div>
          <div style={{display:'flex',gap:10}}>
            <button onClick={abrir_repo} style={layout.buttonPrimary}>Abrir repositório</button>
            <button onClick={carregar_arvore} style={layout.buttonSecondary}>Atualizar árvore</button>
          </div>
        </div>
        <div style={{height:1,background:"rgba(148,163,184,0.25)"}}/>
        <div style={{display:"grid",gap:10}}>
          <div style={{fontWeight:600,fontSize:13,letterSpacing:0.2,color:"#cbd5f5"}}>Arquivos</div>
          <div style={{maxHeight:"60vh",overflow:"auto",fontFamily:"ui-monospace",fontSize:12,display:"grid",gap:6}}>
            {arvore.map((n,i)=> (
              <div key={i} onClick={()=> n.tipo==="file" && abrir_arquivo(n.path)} style={{padding:"6px 8px",borderRadius:10,cursor:n.tipo==="file"?"pointer":"default",display:"flex",alignItems:"center",gap:8,background:n.path===arquivoAtual?"rgba(59,130,246,0.18)":"transparent",color:n.tipo==="dir"?"#cbd5f5":"#f8fafc",transition:"all .2s"}}>
                <span>{n.tipo==="dir"?"📁":"📄"}</span>
                <span style={{overflow:"hidden",textOverflow:"ellipsis"}}>{n.path}</span>
              </div>
            ))}
            {!arvore.length && <div style={{color:"rgba(226,232,240,0.6)"}}>Nenhum repositório carregado.</div>}
          </div>
        </div>
      </aside>
      <section style={layout.main}>
        <div style={layout.panel}>
          <div style={layout.topbar}>
            <div>
              <h1 style={layout.topTitle}>{arquivoAtual||"Selecione um arquivo para editar"}</h1>
              {erro && <div style={{color:"#b91c1c",fontSize:13,fontWeight:500}}>{erro}</div>}
            </div>
            {dirty && <span style={{marginLeft:"auto",...layout.tag}}>Alterações não salvas</span>}
          </div>
          <div style={layout.editorWrap}>
            <textarea value={conteudo} onChange={e=>setConteudo(e.target.value)} style={layout.editor} placeholder="Conteúdo do arquivo"/>
          </div>
          <div style={layout.actions}>
            <button onClick={salvar_arquivo} disabled={!dirty} style={{...layout.buttonPrimary,opacity:dirty?1:0.55,boxShadow:dirty?layout.buttonPrimary.boxShadow:"none",cursor:dirty?"pointer":"not-allowed"}}>Aplicar alterações</button>
            <button onClick={commit_push} style={{...layout.buttonSecondary,background:"rgba(15,23,42,0.1)",color:"#0f172a",border:"1px solid rgba(148,163,184,0.35)"}}>Commit & Push</button>
          </div>
        </div>
      </section>
      <aside style={layout.chat}>
        <div style={layout.chatCard}>
          <div style={layout.chatHead}>
            <div style={{fontWeight:700,color:"#0f172a"}}>Chat com o agente</div>
            <div style={{fontSize:12,color:"#475569"}}>Peça contexto ou oriente o fluxo de trabalho</div>
          </div>
          <div style={layout.chatBody}>
            {chat.map((m,i)=> (
              <div key={i} style={{background:m.autor==="Você"?"rgba(59,130,246,0.18)":"rgba(15,23,42,0.05)",border:"1px solid rgba(148,163,184,0.35)",borderRadius:14,padding:12,display:"grid",gap:4}}>
                <div style={{fontWeight:600,fontSize:12,color:"#0f172a"}}>{m.autor}</div>
                <div style={{whiteSpace:"pre-wrap",fontSize:13,color:"#1e293b"}}>{m.texto}</div>
              </div>
            ))}
            {!chat.length && <div style={{fontSize:13,color:"#64748b"}}>Inicie uma conversa para receber ajuda contextual do agente.</div>}
          </div>
          <div style={layout.chatFoot}>
            <input placeholder="Pergunte algo ao agente..." value={entradaChat} onChange={e=>setEntradaChat(e.target.value)} style={{flex:1,padding:"10px 12px",borderRadius:12,border:"1px solid rgba(148,163,184,0.45)",background:"#fff",fontSize:13}} onKeyDown={e=>{ if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); enviar_chat(entradaChat); setEntradaChat(""); } }}/>
            <button onClick={()=>{ enviar_chat(entradaChat); setEntradaChat(""); }} style={{...layout.buttonPrimary,boxShadow:"0 12px 20px rgba(59,130,246,0.35)"}}>Enviar</button>
          </div>
        </div>
      </aside>
    </div>
  );
}
