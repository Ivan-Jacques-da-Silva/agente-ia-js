import React, { useEffect, useMemo, useState } from "react";

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

function buildTree(list){
  if(!Array.isArray(list)) return [];
  const root = { children: {} };
  const ensureDir = (parent, part, fullPath)=>{
    if(!parent.children[part]){
      parent.children[part] = {
        nome: part,
        tipo: "dir",
        fullPath,
        children: {},
      };
    }
    return parent.children[part];
  };

  for(const item of list){
    if(!item || !item.path) continue;
    const partes = item.path.split("/");
    let cursor = root;
    partes.forEach((parte, idx)=>{
      const atualPath = partes.slice(0, idx+1).join("/");
      const ultimo = idx === partes.length-1;
      if(ultimo){
        if(item.tipo === "dir"){
          const dir = ensureDir(cursor, parte, atualPath);
          dir.tipo = "dir";
        }else{
          cursor.children[parte] = {
            nome: parte,
            tipo: item.tipo || "file",
            fullPath: item.path,
          };
        }
      }else{
        cursor = ensureDir(cursor, parte, atualPath);
      }
    });
  }

  const ordenar = (nodes)=>{
    return nodes.sort((a,b)=>{
      if(a.tipo === b.tipo) return a.nome.localeCompare(b.nome);
      return a.tipo === "dir" ? -1 : 1;
    });
  };

  const toArray = (node)=>{
    return ordenar(Object.values(node.children)).map((item)=>{
      if(item.tipo === "dir"){
        return {
          ...item,
          children: toArray(item),
        };
      }
      return item;
    });
  };

  return toArray(root);
}

function calculateDiff(before, after){
  if(before === after){
    return { linhas: [], adicionadas: 0, removidas: 0, truncado: false };
  }
  const linhasAntes = before.split("\n");
  const linhasDepois = after.split("\n");
  const limite = 160000;
  if(linhasAntes.length * linhasDepois.length > limite){
    return {
      linhas: [],
      adicionadas: Math.max(0, linhasDepois.length - linhasAntes.length),
      removidas: Math.max(0, linhasAntes.length - linhasDepois.length),
      truncado: true,
    };
  }

  const m = linhasAntes.length;
  const n = linhasDepois.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for(let i = m - 1; i >= 0; i--){
    for(let j = n - 1; j >= 0; j--){
      if(linhasAntes[i] === linhasDepois[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
      else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const linhas = [];
  let adicionadas = 0;
  let removidas = 0;
  let i = 0;
  let j = 0;
  let linhaAntes = 1;
  let linhaDepois = 1;

  while(i < m && j < n){
    if(linhasAntes[i] === linhasDepois[j]){
      linhas.push({ tipo: "contexto", valor: linhasAntes[i], linhaAntes, linhaDepois });
      i++; j++; linhaAntes++; linhaDepois++;
    }else if(dp[i + 1][j] >= dp[i][j + 1]){
      linhas.push({ tipo: "removida", valor: linhasAntes[i], linhaAntes, linhaDepois: "" });
      i++; linhaAntes++; removidas++;
    }else{
      linhas.push({ tipo: "adicionada", valor: linhasDepois[j], linhaAntes: "", linhaDepois });
      j++; linhaDepois++; adicionadas++;
    }
  }

  while(i < m){
    linhas.push({ tipo: "removida", valor: linhasAntes[i], linhaAntes, linhaDepois: "" });
    i++; linhaAntes++; removidas++;
  }

  while(j < n){
    linhas.push({ tipo: "adicionada", valor: linhasDepois[j], linhaAntes: "", linhaDepois });
    j++; linhaDepois++; adicionadas++;
  }

  return { linhas, adicionadas, removidas, truncado: false };
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
  const [repo,setRepo]=useState("");
  const [branchBase,setBranchBase]=useState("");
  const [erro,setErro]=useState("");

  const requireAgentReady = ()=>{
    if(agenteStatus === "failed"){ setErro("Agente indisponível. Verifique o serviço do agente."); return false; }
    if(agenteStatus !== "ready"){ setErro("Aguardando conexão com o agente..."); return false; }
    return true;
  };

  const [arvore,setArvore]=useState([]);
  const [arquivoAtual,setArquivoAtual]=useState("");
  const [conteudo,setConteudo]=useState("");
  const [original,setOriginal]=useState("");
  const [chat,setChat]=useState([]);
  const [entradaChat,setEntradaChat]=useState("");
  const [mostrarDiff,setMostrarDiff]=useState(false);
  const [explorerColapsado,setExplorerColapsado]=useState(false);
  const [chatColapsado,setChatColapsado]=useState(false);
  const [painelAberto,setPainelAberto]=useState({ conexoes:true, repositorio:true });
  const [diretoriosAbertos,setDiretoriosAbertos]=useState({});

  const dirty = conteudo !== original;
  const statusMeta = {
    ready: { texto: "Conectado", cor: "#34d399" },
    resolving: { texto: "Conectando...", cor: "#fbbf24" },
    failed: { texto: "Falha", cor: "#f87171" },
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
    try{
      const r=await fetch(buildUrl(agenteUrl, `/repo/file?path=${encodeURIComponent(p)}`));
      const t=await r.text();
      setArquivoAtual(p);
      setConteudo(t);
      setOriginal(t);
      setMostrarDiff(false);
    }catch(e){ setErro(String(e?.message||e)); }
  }

  async function persistirArquivo(){
    if(!arquivoAtual) return;
    if(!requireAgentReady()) return;
    try{
      const r = await fetch(buildUrl(agenteUrl, "/repo/save"),{
        method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({path:arquivoAtual,conteudo})
      });
      await parseJsonResponse(r, "Falha ao salvar arquivo");
      setOriginal(conteudo);
      setMostrarDiff(false);
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
    const msg = texto.trim();
    if(!msg) return;
    if(!requireAgentReady()) { setErro("Aguardando conexão com o agente para enviar mensagens."); return; }
    const novo = [...chat, {autor:"Você", texto: msg}];
    setChat(novo);
    setEntradaChat("");
    try{
      const r=await fetch(buildUrl(agenteUrl, "/chat"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mensagem:msg})});
      const j=await parseJsonResponse(r, "Falha ao enviar mensagem");
      setChat([...novo, {autor:"Agente", texto:j.resposta||""}]);
    }catch(e){ setChat([...novo, {autor:"Agente", texto:String(e?.message||e)}]); }
  }

  const arvoreEstruturada = useMemo(()=> buildTree(arvore), [arvore]);

  useEffect(()=>{
    const inicial = {};
    const visitar = (nodos)=>{
      nodos.forEach((n)=>{
        if(n.tipo === "dir"){
          inicial[n.fullPath] = true;
          if(n.children) visitar(n.children);
        }
      });
    };
    visitar(arvoreEstruturada);
    setDiretoriosAbertos((prev)=> ({ ...inicial, ...prev }));
  },[arvoreEstruturada]);

  useEffect(()=>{
    if(!dirty) setMostrarDiff(false);
  },[dirty]);

  const diffInfo = useMemo(()=> calculateDiff(original, conteudo), [original, conteudo]);

  const styles = {
    shell:{display:"flex",height:"100vh",background:"radial-gradient(circle at top,#1f2a40,#0b1120 65%)",color:"#e2e8f0",fontFamily:"'Inter', system-ui, -apple-system, BlinkMacSystemFont"},
    sidebar:{width:300,display:"flex",flexDirection:"column",gap:24,padding:"28px 22px",background:"rgba(8,15,27,0.92)",borderRight:"1px solid rgba(148,163,184,0.15)",backdropFilter:"blur(18px)"},
    brand:{display:"flex",alignItems:"center",gap:12},
    brandLogo:{width:44,height:44,borderRadius:14,background:"linear-gradient(135deg,#38bdf8,#2563eb)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700},
    brandText:{display:"flex",flexDirection:"column",gap:6,fontWeight:600},
    section:{display:"flex",flexDirection:"column",gap:12},
    sectionHeader:{display:"flex",alignItems:"center",justifyContent:"space-between",fontSize:13,fontWeight:600,letterSpacing:0.4,color:"#cbd5f5"},
    toggleBtn:{background:"transparent",border:0,color:"#94a3b8",cursor:"pointer",fontSize:16},
    statusCard:{display:"flex",flexDirection:"column",gap:8,padding:"12px 14px",borderRadius:14,background:"rgba(15,23,42,0.68)",border:"1px solid rgba(148,163,184,0.2)"},
    statusRow:{display:"flex",alignItems:"center",gap:8,fontSize:13,fontWeight:600},
    statusUrl:{fontSize:11,color:"rgba(226,232,240,0.65)",wordBreak:"break-word"},
    input:{padding:"10px 12px",borderRadius:10,border:"1px solid rgba(148,163,184,0.2)",background:"rgba(15,23,42,0.55)",color:"#f8fafc",fontSize:13},
    primaryButton:{padding:"10px 14px",borderRadius:10,border:0,background:"linear-gradient(135deg,#4f46e5,#3b82f6)",color:"#fff",fontWeight:600,cursor:"pointer",display:"flex",gap:8,alignItems:"center",justifyContent:"center",boxShadow:"0 12px 28px rgba(59,130,246,0.28)"},
    secondaryButton:{padding:"10px 14px",borderRadius:10,border:"1px solid rgba(148,163,184,0.3)",background:"rgba(15,23,42,0.35)",color:"#e2e8f0",fontWeight:500,cursor:"pointer"},
    main:{flex:1,display:"flex",flexDirection:"column",padding:"28px 30px",gap:20},
    chrome:{background:"rgba(10,12,23,0.85)",borderRadius:20,border:"1px solid rgba(148,163,184,0.16)",boxShadow:"0 30px 80px -30px rgba(15,23,42,0.6)",display:"flex",flexDirection:"column",flex:1,overflow:"hidden"},
    windowBar:{display:"flex",alignItems:"center",gap:10,padding:"16px 22px",borderBottom:"1px solid rgba(148,163,184,0.18)",background:"rgba(15,23,42,0.75)"},
    windowDots:{display:"flex",gap:8},
    windowDot:(color)=>({width:12,height:12,borderRadius:"50%",background:color,boxShadow:`0 0 0 1px rgba(0,0,0,0.25)`}),
    tabBar:{display:"flex",alignItems:"center",gap:10,padding:"12px 18px",background:"rgba(9,10,22,0.95)",borderBottom:"1px solid rgba(148,163,184,0.18)"},
    tab:{padding:"8px 14px",borderRadius:10,fontSize:13,background:"rgba(15,23,42,0.75)",color:"#94a3b8"},
    tabActive:{background:"linear-gradient(135deg,#1d4ed8,#2563eb)",color:"#e2e8f0"},
    errorBanner:{padding:"10px 18px",background:"rgba(248,113,113,0.15)",borderBottom:"1px solid rgba(248,113,113,0.45)",color:"#fecaca",fontSize:13},
    workspace:{flex:1,display:"flex",overflow:"hidden",background:"rgba(2,6,23,0.9)"},
    explorer:(colapsado)=>({width:colapsado?56:260,transition:"width .25s ease",borderRight:"1px solid rgba(148,163,184,0.12)",background:"rgba(6,11,25,0.92)",display:"flex",flexDirection:"column"}),
    explorerHeader:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px",borderBottom:"1px solid rgba(148,163,184,0.12)",fontSize:12,letterSpacing:0.3,fontWeight:600,color:"#cbd5f5"},
    explorerBody:{flex:1,overflow:"auto",padding:"12px 10px 40px",fontFamily:"ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",fontSize:12,display:"flex",flexDirection:"column",gap:4},
    treeNode:(ativo)=>({display:"flex",alignItems:"center",gap:8,padding:"6px 8px",borderRadius:8,cursor:"pointer",background:ativo?"rgba(37,99,235,0.28)":"transparent",color:"#cbd5f5",transition:"background .2s"}),
    treeIndent:(nivel)=>({marginLeft:nivel*16}),
    editorCol:{flex:1,display:"flex",flexDirection:"column"},
    editorSurface:{flex:1,position:"relative",background:"#0f172a"},
    editorTextarea:{position:"absolute",top:0,left:0,right:0,bottom:0,width:"100%",height:"100%",background:"transparent",color:"#e2e8f0",border:0,padding:"22px 28px",fontSize:14,lineHeight:1.6,fontFamily:"'Fira Code', 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace"},
    diffBar:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 18px",borderTop:"1px solid rgba(148,163,184,0.14)",background:"rgba(15,23,42,0.85)",fontSize:13},
    diffPanel:{margin:18,padding:18,background:"rgba(15,23,42,0.9)",border:"1px solid rgba(148,163,184,0.22)",borderRadius:14,display:"flex",flexDirection:"column",gap:16,maxHeight:260,overflow:"hidden"},
    diffScroll:{flex:1,overflow:"auto",background:"rgba(2,6,23,0.9)",borderRadius:10,border:"1px solid rgba(30,64,175,0.35)",fontFamily:"'Fira Code', ui-monospace",fontSize:12},
    diffLine:(tipo)=>({display:"grid",gridTemplateColumns:"60px 60px 1fr",gap:12,padding:"6px 18px",background:tipo==="adicionada"?"rgba(34,197,94,0.14)":tipo==="removida"?"rgba(248,113,113,0.12)":"transparent",color:tipo==="adicionada"?"#bbf7d0":tipo==="removida"?"#fecaca":"#cbd5f5",borderBottom:"1px solid rgba(148,163,184,0.08)"}),
    diffActions:{display:"flex",justifyContent:"flex-end",gap:12},
    chatDock:(colapsado)=>({marginTop:18,background:"rgba(8,12,25,0.92)",border:"1px solid rgba(148,163,184,0.16)",borderRadius:18,overflow:"hidden",transition:"height .25s ease",height:colapsado?54:320,display:"flex",flexDirection:"column"}),
    chatHeader:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 18px",borderBottom:"1px solid rgba(148,163,184,0.14)",fontWeight:600,fontSize:13,color:"#cbd5f5"},
    chatMessages:{flex:1,overflow:"auto",padding:"18px 22px",display:"flex",flexDirection:"column",gap:12},
    chatBubble:(autor)=>({alignSelf:autor==="Você"?"flex-end":"flex-start",maxWidth:"70%",background:autor==="Você"?"rgba(37,99,235,0.35)":"rgba(15,23,42,0.6)",border:"1px solid rgba(148,163,184,0.2)",borderRadius:autor==="Você"?"16px 16px 0 16px":"16px 16px 16px 0",padding:"12px 14px",display:"grid",gap:6,color:"#e2e8f0"}),
    chatInputRow:{display:"flex",gap:12,padding:"16px 18px",borderTop:"1px solid rgba(148,163,184,0.16)",background:"rgba(10,12,23,0.92)"},
    chatInput:{flex:1,minHeight:44,borderRadius:12,border:"1px solid rgba(148,163,184,0.25)",background:"rgba(15,23,42,0.55)",color:"#e2e8f0",padding:"10px 12px",fontSize:13,fontFamily:"'Inter', system-ui"},
  };

  const renderNode = (node, nivel=0)=>{
    const isDir = node.tipo === "dir";
    const aberto = diretoriosAbertos[node.fullPath] ?? true;
    const handleClick = ()=>{
      if(isDir){
        setDiretoriosAbertos((prev)=> ({...prev, [node.fullPath]: !aberto }));
      }else{
        abrir_arquivo(node.fullPath);
      }
    };
    return (
      <div key={node.fullPath}>
        <div style={{...styles.treeIndent(nivel), ...styles.treeNode(arquivoAtual===node.fullPath)}} onClick={handleClick}>
          <span style={{fontSize:12}}>{isDir ? (aberto ? "▾" : "▸") : ""}</span>
          <span>{isDir ? (aberto ? "📂" : "📁") : "📄"}</span>
          <span style={{whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{node.nome}</span>
        </div>
        {isDir && aberto && node.children && node.children.map((filho)=> renderNode(filho, nivel+1))}
      </div>
    );
  };

  const diffResumo = `+${diffInfo.adicionadas}  -${diffInfo.removidas}`;

  return (
    <div style={styles.shell}>
      <aside style={styles.sidebar}>
        <div style={styles.brand}>
          <div style={styles.brandLogo}>AI</div>
          <div style={styles.brandText}>
            <span style={{fontSize:15}}>Agente de Código</span>
            <span style={{fontSize:12,color:"#64748b"}}>Sessão local conectada</span>
          </div>
        </div>

        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <span>Status das conexões</span>
            <button style={styles.toggleBtn} onClick={()=>setPainelAberto((prev)=>({...prev, conexoes:!prev.conexoes}))}>{painelAberto.conexoes ? "−" : "+"}</button>
          </div>
          {painelAberto.conexoes && (
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {conexoes.map((c)=>{
                const meta = statusMeta[c.status] || statusMeta.resolving;
                return (
                  <div key={c.chave} style={styles.statusCard}>
                    <div style={styles.statusRow}>
                      <span style={{width:8,height:8,borderRadius:"50%",background:meta.cor}}></span>
                      <span>{c.titulo}</span>
                      <span style={{marginLeft:"auto",fontSize:12,color:"rgba(226,232,240,0.65)"}}>{meta.texto}</span>
                    </div>
                    <div style={styles.statusUrl}>{c.url || "Detectando endpoint..."}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <span>Repositório ativo</span>
            <button style={styles.toggleBtn} onClick={()=>setPainelAberto((prev)=>({...prev, repositorio:!prev.repositorio}))}>{painelAberto.repositorio ? "−" : "+"}</button>
          </div>
          {painelAberto.repositorio && (
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                <label style={{fontSize:11,textTransform:"uppercase",letterSpacing:0.5,color:"#64748b"}}>URL do repositório</label>
                <input style={styles.input} placeholder="https://github.com/org/projeto" value={repo} onChange={(e)=>setRepo(e.target.value)} />
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                <label style={{fontSize:11,textTransform:"uppercase",letterSpacing:0.5,color:"#64748b"}}>Branch base</label>
                <input style={styles.input} placeholder="main" value={branchBase} onChange={(e)=>setBranchBase(e.target.value)} />
              </div>
              <div style={{display:"flex",gap:10}}>
                <button style={styles.primaryButton} onClick={abrir_repo}>Abrir workspace</button>
                <button style={styles.secondaryButton} onClick={carregar_arvore}>Recarregar árvore</button>
              </div>
            </div>
          )}
        </div>
      </aside>

      <main style={styles.main}>
        <div style={styles.chrome}>
          <div style={styles.windowBar}>
            <div style={styles.windowDots}>
              <div style={styles.windowDot("#ef4444")} />
              <div style={styles.windowDot("#facc15")} />
              <div style={styles.windowDot("#22c55e")} />
            </div>
            <div style={{marginLeft:12,fontSize:13,color:"#94a3b8"}}>Editor do agente</div>
            <div style={{marginLeft:"auto",display:"flex",gap:10}}>
              <button style={styles.secondaryButton} onClick={()=>setExplorerColapsado((v)=>!v)}>{explorerColapsado?"Mostrar árvore":"Ocultar árvore"}</button>
              <button style={styles.secondaryButton} onClick={commit_push}>Commit & Push</button>
            </div>
          </div>
          <div style={styles.tabBar}>
            <div style={{...styles.tab, ...(arquivoAtual ? styles.tabActive : {})}}>{arquivoAtual || "Sem arquivo aberto"}</div>
          </div>
          {erro && <div style={styles.errorBanner}>{erro}</div>}
          <div style={styles.workspace}>
            <div style={styles.explorer(explorerColapsado)}>
              <div style={styles.explorerHeader}>
                <span>{explorerColapsado ? "" : "Explorador"}</span>
                <button style={styles.toggleBtn} onClick={()=>setExplorerColapsado((v)=>!v)}>{explorerColapsado?"▸":"▾"}</button>
              </div>
              {!explorerColapsado && (
                <div style={styles.explorerBody}>
                  {arvoreEstruturada.length ? arvoreEstruturada.map((n)=> renderNode(n)) : <div style={{color:"#475569",padding:"12px 6px"}}>Nenhum repositório carregado.</div>}
                </div>
              )}
            </div>
            <div style={styles.editorCol}>
              <div style={styles.editorSurface}>
                <textarea value={conteudo} onChange={(e)=>setConteudo(e.target.value)} style={styles.editorTextarea} placeholder="Selecione um arquivo para começar a edição" />
              </div>
              {dirty && (
                <div style={styles.diffBar}>
                  <div style={{display:"flex",flexDirection:"column"}}>
                    <span>Alterações não aplicadas {arquivoAtual ? `em ${arquivoAtual}` : ""}</span>
                    <span style={{fontSize:12,color:"#64748b"}}>Resumo {diffResumo}</span>
                  </div>
                  <div style={{display:"flex",gap:10}}>
                    <button style={styles.secondaryButton} onClick={()=>setMostrarDiff(true)}>Pré-visualizar</button>
                    <button style={styles.secondaryButton} onClick={()=>{ setConteudo(original); setMostrarDiff(false); }}>Descartar</button>
                  </div>
                </div>
              )}
              {mostrarDiff && dirty && (
                <div style={styles.diffPanel}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <div style={{fontWeight:600,fontSize:14}}>Deseja aplicar as alterações?</div>
                      <div style={{fontSize:12,color:"#94a3b8"}}>Confirme para salvar o arquivo via agente.</div>
                    </div>
                    <span style={{fontFamily:"ui-monospace",fontSize:12,color:"#60a5fa"}}>{diffResumo}</span>
                  </div>
                  {diffInfo.truncado ? (
                    <div style={{padding:12,borderRadius:10,border:"1px solid rgba(148,163,184,0.2)",background:"rgba(15,23,42,0.7)",fontSize:12,color:"#cbd5f5"}}>
                      Pré-visualização indisponível para arquivos grandes. Deseja aplicar mesmo assim?
                    </div>
                  ) : (
                    <div style={styles.diffScroll}>
                      {diffInfo.linhas.map((linha,idx)=>(
                        <div key={idx} style={styles.diffLine(linha.tipo)}>
                          <span style={{color:"#64748b"}}>{linha.linhaAntes || ""}</span>
                          <span style={{color:"#64748b"}}>{linha.linhaDepois || ""}</span>
                          <span style={{whiteSpace:"pre"}}>{(linha.tipo === "adicionada"?"+":linha.tipo === "removida"?"-":" ") + linha.valor}</span>
                        </div>
                      ))}
                      {!diffInfo.linhas.length && <div style={{padding:16,color:"#64748b"}}>Nenhuma diferença detectada.</div>}
                    </div>
                  )}
                  <div style={styles.diffActions}>
                    <button style={styles.secondaryButton} onClick={()=>setMostrarDiff(false)}>Voltar</button>
                    <button style={styles.primaryButton} onClick={persistirArquivo}>Aplicar alterações</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={styles.chatDock(chatColapsado)}>
          <div style={styles.chatHeader}>
            <span>Chat com o agente</span>
            <button style={styles.toggleBtn} onClick={()=>setChatColapsado((v)=>!v)}>{chatColapsado?"▲":"▼"}</button>
          </div>
          {!chatColapsado && (
            <>
              <div style={styles.chatMessages}>
                {chat.map((m,i)=>(
                  <div key={i} style={styles.chatBubble(m.autor)}>
                    <strong style={{fontSize:11,letterSpacing:0.6,color:"rgba(226,232,240,0.75)"}}>{m.autor}</strong>
                    <span style={{whiteSpace:"pre-wrap",fontSize:13}}>{m.texto}</span>
                  </div>
                ))}
                {!chat.length && <div style={{color:"#475569",fontSize:13}}>Converse com o agente para orientar edições e automatizar fluxos.</div>}
              </div>
              <div style={styles.chatInputRow}>
                <textarea style={styles.chatInput} placeholder="Descreva a alteração desejada..." value={entradaChat} onChange={(e)=>setEntradaChat(e.target.value)} onKeyDown={(e)=>{ if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); enviar_chat(entradaChat); } }} />
                <button style={styles.primaryButton} onClick={()=>enviar_chat(entradaChat)}>Enviar</button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
