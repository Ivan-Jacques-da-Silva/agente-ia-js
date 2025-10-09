import React, { useEffect, useMemo, useState, useCallback } from "react";

const ORIGIN = typeof window !== "undefined" ? window.location.origin.replace(/\/$/, "") : "";

function normalizeBase(candidate) {
  if (!candidate) return null;
  const raw = String(candidate).trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw.replace(/\/$/, "");
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

function buildTree(list) {
  if (!Array.isArray(list)) return [];
  const root = { children: {} };

  const ensureDir = (parent, part, fullPath) => {
    if (!parent.children[part]) {
      parent.children[part] = { nome: part, tipo: "dir", fullPath, children: {} };
    }
    return parent.children[part];
  };

  for (const item of list) {
    if (!item || !item.path) continue;
    const partes = item.path.split("/");
    let cursor = root;

    partes.forEach((parte, idx) => {
      const atualPath = partes.slice(0, idx + 1).join("/");
      const ultimo = idx === partes.length - 1;

      if (ultimo) {
        if (item.tipo === "dir") {
          const dir = ensureDir(cursor, parte, atualPath);
          dir.tipo = "dir";
        } else {
          cursor.children[parte] = { nome: parte, tipo: item.tipo || "file", fullPath: item.path };
        }
      } else {
        cursor = ensureDir(cursor, parte, atualPath);
      }
    });
  }

  const ordenar = (nodes) => {
    return nodes.sort((a, b) => {
      if (a.tipo === b.tipo) return a.nome.localeCompare(b.nome);
      return a.tipo === "dir" ? -1 : 1;
    });
  };

  const toArray = (node) => {
    return ordenar(Object.values(node.children)).map((item) => {
      if (item.tipo === "dir") {
        return { ...item, children: toArray(item) };
      }
      return item;
    });
  };

  return toArray(root);
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
    const erro = dados?.erro || fallbackMessage || "Falha ao comunicar com o serviço";
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

export default function App() {
  const { base: agenteUrl, status: agenteStatus } = useEndpointResolver(AGENTE_CANDIDATES, "/saude");

  const [repo, setRepo] = useState("");
  const [caminhoLocal, setCaminhoLocal] = useState("");
  const [branchBase, setBranchBase] = useState("main");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);

  const [arvore, setArvore] = useState([]);
  const [arquivoAtual, setArquivoAtual] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [original, setOriginal] = useState("");
  const [chat, setChat] = useState([]);
  const [entradaChat, setEntradaChat] = useState("");
  const [explorerColapsado, setExplorerColapsado] = useState(false);
  const [chatColapsado, setChatColapsado] = useState(false);
  const [diretoriosAbertos, setDiretoriosAbertos] = useState({});
  const [projetoAtual, setProjetoAtual] = useState(null);
  const [mudancasPendentes, setMudancasPendentes] = useState([]);
  const [mostrarMudancas, setMostrarMudancas] = useState(false);
  const [historico, setHistorico] = useState([]);
  const [mostrarHistorico, setMostrarHistorico] = useState(false);

  const dirty = conteudo !== original;

  const requireAgentReady = useCallback(() => {
    if (agenteStatus === "failed") {
      setErro("Agente indisponível. Verifique o serviço do agente.");
      return false;
    }
    if (agenteStatus !== "ready") {
      setErro("Aguardando conexão com o agente...");
      return false;
    }
    return true;
  }, [agenteStatus]);

  async function abrir_repo() {
    setErro("");
    setLoading(true);
    if (!requireAgentReady()) {
      setLoading(false);
      return;
    }

    try {
      const body = {};
      if (caminhoLocal) {
        body.caminhoLocal = caminhoLocal;
      } else if (repo) {
        body.repositorioUrl = repo;
        body.branchBase = branchBase;
      } else {
        throw new Error("Informe a URL do repositório ou o caminho local");
      }

      const r = await fetch(buildUrl(agenteUrl, "/repo/abrir"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const j = await parseJsonResponse(r, "Falha ao abrir repositório");
      setArvore(j.arvore || []);
      setProjetoAtual(j.projeto);
      setChat(j.conversas || []);
      setHistorico(j.historico || []);
      await carregarMudancasPendentes();
    } catch (e) {
      setErro(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function abrir_arquivo(p) {
    if (!requireAgentReady()) return;
    try {
      const r = await fetch(buildUrl(agenteUrl, `/repo/file?path=${encodeURIComponent(p)}`));
      const t = await r.text();
      setArquivoAtual(p);
      setConteudo(t);
      setOriginal(t);
    } catch (e) {
      setErro(String(e?.message || e));
    }
  }

  async function persistirArquivo() {
    if (!arquivoAtual) return;
    if (!requireAgentReady()) return;
    setLoading(true);

    try {
      const r = await fetch(buildUrl(agenteUrl, "/repo/save"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: arquivoAtual, conteudo }),
      });

      await parseJsonResponse(r, "Falha ao salvar arquivo");
      setOriginal(conteudo);
      setErro("");
    } catch (e) {
      setErro(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function commit_push() {
    if (!requireAgentReady()) return;
    setLoading(true);

    try {
      const r = await fetch(buildUrl(agenteUrl, "/repo/commit"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensagem: `feat: atualizações em ${arquivoAtual || "projeto"}` }),
      });

      await parseJsonResponse(r, "Falha ao realizar commit");
      setErro("");
      alert("Commit realizado com sucesso!");
    } catch (e) {
      setErro(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function enviar_chat(texto) {
    const msg = texto.trim();
    if (!msg) return;
    if (!requireAgentReady()) {
      setErro("Aguardando conexão com o agente para enviar mensagens.");
      return;
    }

    const novo = [...chat, { mensagem: msg, resposta: "..." }];
    setChat(novo);
    setEntradaChat("");
    setLoading(true);

    try {
      const r = await fetch(buildUrl(agenteUrl, "/chat/inteligente"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensagem: msg }),
      });

      const j = await parseJsonResponse(r, "Falha ao enviar mensagem");
      setChat((prev) => [
        ...prev.slice(0, -1),
        { mensagem: msg, resposta: j.resposta || "Sem resposta" },
      ]);

      if (j.mudancas > 0) {
        await carregarMudancasPendentes();
        setMostrarMudancas(true);
      }
    } catch (e) {
      setChat((prev) => [
        ...prev.slice(0, -1),
        { mensagem: msg, resposta: `Erro: ${e?.message || e}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function carregarMudancasPendentes() {
    if (!requireAgentReady()) return;

    try {
      const r = await fetch(buildUrl(agenteUrl, "/mudancas/pendentes"));
      const j = await parseJsonResponse(r, "Falha ao carregar mudanças");
      setMudancasPendentes(j.mudancas || []);
    } catch (e) {
      console.error("Erro ao carregar mudanças:", e);
    }
  }

  async function aprovarMudanca(mudancaId) {
    if (!requireAgentReady()) return;
    setLoading(true);

    try {
      const r = await fetch(buildUrl(agenteUrl, "/mudancas/aprovar"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mudancaId }),
      });

      await parseJsonResponse(r, "Falha ao aprovar mudança");
      await carregarMudancasPendentes();
      setErro("");
      alert("Mudança aprovada e aplicada!");
    } catch (e) {
      setErro(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function rejeitarMudanca(mudancaId) {
    if (!requireAgentReady()) return;
    setLoading(true);

    try {
      const r = await fetch(buildUrl(agenteUrl, "/mudancas/rejeitar"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mudancaId }),
      });

      await parseJsonResponse(r, "Falha ao rejeitar mudança");
      await carregarMudancasPendentes();
      setErro("");
    } catch (e) {
      setErro(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  const arvoreEstruturada = useMemo(() => buildTree(arvore), [arvore]);

  useEffect(() => {
    const inicial = {};
    const visitar = (nodos) => {
      nodos.forEach((n) => {
        if (n.tipo === "dir") {
          inicial[n.fullPath] = true;
          if (n.children) visitar(n.children);
        }
      });
    };
    visitar(arvoreEstruturada);
    setDiretoriosAbertos((prev) => ({ ...inicial, ...prev }));
  }, [arvoreEstruturada]);

  const styles = {
    shell: {
      display: "flex",
      height: "100vh",
      background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
      color: "#e2e8f0",
      fontFamily: "'Inter', system-ui, -apple-system, BlinkMacSystemFont",
    },
    sidebar: {
      width: 320,
      display: "flex",
      flexDirection: "column",
      gap: 24,
      padding: "28px 22px",
      background: "rgba(8,15,27,0.95)",
      borderRight: "1px solid rgba(148,163,184,0.15)",
      backdropFilter: "blur(18px)",
      overflowY: "auto",
    },
    brand: {
      display: "flex",
      alignItems: "center",
      gap: 12,
    },
    brandLogo: {
      width: 48,
      height: 48,
      borderRadius: 14,
      background: "linear-gradient(135deg,#10b981,#059669)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontWeight: 700,
      fontSize: 24,
    },
    brandText: {
      display: "flex",
      flexDirection: "column",
      gap: 6,
      fontWeight: 600,
    },
    section: {
      display: "flex",
      flexDirection: "column",
      gap: 12,
    },
    sectionHeader: {
      fontSize: 13,
      fontWeight: 600,
      letterSpacing: 0.4,
      color: "#cbd5f5",
      marginBottom: 8,
    },
    statusCard: {
      padding: "12px 14px",
      borderRadius: 12,
      background: agenteStatus === "ready" ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
      border: `1px solid ${agenteStatus === "ready" ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
      fontSize: 13,
      fontWeight: 600,
    },
    input: {
      padding: "10px 12px",
      borderRadius: 10,
      border: "1px solid rgba(148,163,184,0.2)",
      background: "rgba(15,23,42,0.55)",
      color: "#f8fafc",
      fontSize: 13,
      width: "100%",
      boxSizing: "border-box",
    },
    primaryButton: {
      padding: "10px 16px",
      borderRadius: 10,
      border: 0,
      background: "linear-gradient(135deg,#10b981,#059669)",
      color: "#fff",
      fontWeight: 600,
      cursor: loading ? "not-allowed" : "pointer",
      display: "flex",
      gap: 8,
      alignItems: "center",
      justifyContent: "center",
      boxShadow: "0 12px 28px rgba(16,185,129,0.28)",
      opacity: loading ? 0.6 : 1,
    },
    secondaryButton: {
      padding: "10px 14px",
      borderRadius: 10,
      border: "1px solid rgba(148,163,184,0.3)",
      background: "rgba(15,23,42,0.35)",
      color: "#e2e8f0",
      fontWeight: 500,
      cursor: loading ? "not-allowed" : "pointer",
      opacity: loading ? 0.6 : 1,
    },
    main: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      padding: "28px 30px",
      gap: 20,
      overflow: "hidden",
    },
    chrome: {
      background: "rgba(10,12,23,0.85)",
      borderRadius: 20,
      border: "1px solid rgba(148,163,184,0.16)",
      boxShadow: "0 30px 80px -30px rgba(15,23,42,0.6)",
      display: "flex",
      flexDirection: "column",
      flex: 1,
      overflow: "hidden",
    },
    windowBar: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "16px 22px",
      borderBottom: "1px solid rgba(148,163,184,0.18)",
      background: "rgba(15,23,42,0.75)",
    },
    windowDots: {
      display: "flex",
      gap: 8,
    },
    windowDot: (color) => ({
      width: 12,
      height: 12,
      borderRadius: "50%",
      background: color,
      boxShadow: `0 0 0 1px rgba(0,0,0,0.25)`,
    }),
    tabBar: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "12px 18px",
      background: "rgba(9,10,22,0.95)",
      borderBottom: "1px solid rgba(148,163,184,0.18)",
    },
    tab: {
      padding: "8px 14px",
      borderRadius: 10,
      fontSize: 13,
      background: arquivoAtual ? "linear-gradient(135deg,#10b981,#059669)" : "rgba(15,23,42,0.75)",
      color: "#e2e8f0",
    },
    errorBanner: {
      padding: "10px 18px",
      background: "rgba(248,113,113,0.15)",
      borderBottom: "1px solid rgba(248,113,113,0.45)",
      color: "#fecaca",
      fontSize: 13,
    },
    workspace: {
      flex: 1,
      display: "flex",
      overflow: "hidden",
      background: "rgba(2,6,23,0.9)",
    },
    explorer: (colapsado) => ({
      width: colapsado ? 56 : 260,
      transition: "width .25s ease",
      borderRight: "1px solid rgba(148,163,184,0.12)",
      background: "rgba(6,11,25,0.92)",
      display: "flex",
      flexDirection: "column",
    }),
    explorerHeader: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "14px 16px",
      borderBottom: "1px solid rgba(148,163,184,0.12)",
      fontSize: 12,
      letterSpacing: 0.3,
      fontWeight: 600,
      color: "#cbd5f5",
    },
    explorerBody: {
      flex: 1,
      overflow: "auto",
      padding: "12px 10px 40px",
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      fontSize: 12,
      display: "flex",
      flexDirection: "column",
      gap: 4,
    },
    treeNode: (ativo) => ({
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "6px 8px",
      borderRadius: 8,
      cursor: "pointer",
      background: ativo ? "rgba(16,185,129,0.25)" : "transparent",
      color: "#cbd5f5",
      transition: "background .2s",
    }),
    treeIndent: (nivel) => ({
      marginLeft: nivel * 16,
    }),
    editorCol: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
    },
    editorSurface: {
      flex: 1,
      position: "relative",
      background: "#0f172a",
    },
    editorTextarea: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: "100%",
      height: "100%",
      background: "transparent",
      color: "#e2e8f0",
      border: 0,
      padding: "22px 28px",
      fontSize: 14,
      lineHeight: 1.6,
      fontFamily: "'Fira Code', 'JetBrains Mono', ui-monospace, monospace",
      resize: "none",
    },
    diffBar: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "14px 18px",
      borderTop: "1px solid rgba(148,163,184,0.14)",
      background: "rgba(15,23,42,0.85)",
      fontSize: 13,
    },
    chatDock: (colapsado) => ({
      marginTop: 18,
      background: "rgba(8,12,25,0.92)",
      border: "1px solid rgba(148,163,184,0.16)",
      borderRadius: 18,
      overflow: "hidden",
      transition: "height .25s ease",
      height: colapsado ? 54 : 320,
      display: "flex",
      flexDirection: "column",
    }),
    chatHeader: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "14px 18px",
      borderBottom: "1px solid rgba(148,163,184,0.14)",
      fontWeight: 600,
      fontSize: 13,
      color: "#cbd5f5",
    },
    chatMessages: {
      flex: 1,
      overflow: "auto",
      padding: "18px 22px",
      display: "flex",
      flexDirection: "column",
      gap: 12,
    },
    chatBubble: (isUser) => ({
      alignSelf: isUser ? "flex-end" : "flex-start",
      maxWidth: "70%",
      background: isUser ? "rgba(16,185,129,0.25)" : "rgba(15,23,42,0.6)",
      border: "1px solid rgba(148,163,184,0.2)",
      borderRadius: isUser ? "16px 16px 0 16px" : "16px 16px 16px 0",
      padding: "12px 14px",
      display: "grid",
      gap: 6,
      color: "#e2e8f0",
    }),
    chatInputRow: {
      display: "flex",
      gap: 12,
      padding: "16px 18px",
      borderTop: "1px solid rgba(148,163,184,0.16)",
      background: "rgba(10,12,23,0.92)",
    },
    chatInput: {
      flex: 1,
      minHeight: 44,
      borderRadius: 12,
      border: "1px solid rgba(148,163,184,0.25)",
      background: "rgba(15,23,42,0.55)",
      color: "#e2e8f0",
      padding: "10px 12px",
      fontSize: 13,
      fontFamily: "'Inter', system-ui",
      resize: "none",
    },
    modal: {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "rgba(0,0,0,0.7)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
    },
    modalContent: {
      background: "rgba(15,23,42,0.98)",
      border: "1px solid rgba(148,163,184,0.3)",
      borderRadius: 20,
      padding: 30,
      maxWidth: "80%",
      maxHeight: "80%",
      overflow: "auto",
      boxShadow: "0 50px 100px rgba(0,0,0,0.5)",
    },
    mudancaCard: {
      background: "rgba(6,11,25,0.8)",
      border: "1px solid rgba(148,163,184,0.2)",
      borderRadius: 14,
      padding: 18,
      marginBottom: 16,
    },
    diffPreview: {
      fontFamily: "ui-monospace, monospace",
      fontSize: 12,
      background: "rgba(2,6,23,0.9)",
      padding: 12,
      borderRadius: 10,
      maxHeight: 300,
      overflow: "auto",
      whiteSpace: "pre",
      color: "#cbd5f5",
      marginTop: 12,
    },
  };

  const renderNode = (node, nivel = 0) => {
    const isDir = node.tipo === "dir";
    const aberto = diretoriosAbertos[node.fullPath] ?? true;

    const handleClick = () => {
      if (isDir) {
        setDiretoriosAbertos((prev) => ({ ...prev, [node.fullPath]: !aberto }));
      } else {
        abrir_arquivo(node.fullPath);
      }
    };

    return (
      <div key={node.fullPath}>
        <div
          style={{ ...styles.treeIndent(nivel), ...styles.treeNode(arquivoAtual === node.fullPath) }}
          onClick={handleClick}
        >
          <span style={{ fontSize: 12 }}>{isDir ? (aberto ? "▾" : "▸") : ""}</span>
          <span>{isDir ? (aberto ? "📂" : "📁") : "📄"}</span>
          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {node.nome}
          </span>
        </div>
        {isDir && aberto && node.children && node.children.map((filho) => renderNode(filho, nivel + 1))}
      </div>
    );
  };

  return (
    <div style={styles.shell}>
      <aside style={styles.sidebar}>
        <div style={styles.brand}>
          <div style={styles.brandLogo}>🤖</div>
          <div style={styles.brandText}>
            <span style={{ fontSize: 16 }}>Agente IA</span>
            <span style={{ fontSize: 12, color: "#64748b" }}>Sistema de Desenvolvimento</span>
          </div>
        </div>

        <div style={styles.section}>
          <div style={styles.sectionHeader}>Status da Conexão</div>
          <div style={styles.statusCard}>
            {agenteStatus === "ready" ? "✓ Conectado" : agenteStatus === "resolving" ? "⏳ Conectando..." : "✗ Desconectado"}
          </div>
        </div>

        {projetoAtual && (
          <div style={styles.section}>
            <div style={styles.sectionHeader}>Projeto Atual</div>
            <div style={{ ...styles.statusCard, background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.3)" }}>
              {projetoAtual.nome}
            </div>
          </div>
        )}

        <div style={styles.section}>
          <div style={styles.sectionHeader}>Abrir Projeto</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color: "#64748b" }}>
                Caminho Local
              </label>
              <input
                style={styles.input}
                placeholder="/caminho/para/projeto"
                value={caminhoLocal}
                onChange={(e) => setCaminhoLocal(e.target.value)}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color: "#64748b" }}>
                URL do Repositório
              </label>
              <input
                style={styles.input}
                placeholder="https://github.com/org/projeto"
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color: "#64748b" }}>
                Branch Base
              </label>
              <input
                style={styles.input}
                placeholder="main"
                value={branchBase}
                onChange={(e) => setBranchBase(e.target.value)}
              />
            </div>
            <button style={styles.primaryButton} onClick={abrir_repo} disabled={loading}>
              {loading ? "Abrindo..." : "Abrir Projeto"}
            </button>
          </div>
        </div>

        {mudancasPendentes.length > 0 && (
          <div style={styles.section}>
            <button
              style={{ ...styles.primaryButton, background: "linear-gradient(135deg,#f59e0b,#d97706)" }}
              onClick={() => setMostrarMudancas(true)}
            >
              {mudancasPendentes.length} Mudança(s) Pendente(s)
            </button>
          </div>
        )}
      </aside>

      <main style={styles.main}>
        <div style={styles.chrome}>
          <div style={styles.windowBar}>
            <div style={styles.windowDots}>
              <div style={styles.windowDot("#ef4444")} />
              <div style={styles.windowDot("#facc15")} />
              <div style={styles.windowDot("#22c55e")} />
            </div>
            <div style={{ marginLeft: 12, fontSize: 13, color: "#94a3b8" }}>Editor do Agente</div>
            <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
              <button style={styles.secondaryButton} onClick={() => setExplorerColapsado((v) => !v)} disabled={loading}>
                {explorerColapsado ? "Mostrar" : "Ocultar"} Árvore
              </button>
              {dirty && (
                <button style={styles.primaryButton} onClick={persistirArquivo} disabled={loading}>
                  Salvar Arquivo
                </button>
              )}
              <button style={styles.secondaryButton} onClick={commit_push} disabled={loading}>
                Commit & Push
              </button>
            </div>
          </div>

          <div style={styles.tabBar}>
            <div style={styles.tab}>{arquivoAtual || "Sem arquivo aberto"}</div>
          </div>

          {erro && <div style={styles.errorBanner}>{erro}</div>}

          <div style={styles.workspace}>
            <div style={styles.explorer(explorerColapsado)}>
              <div style={styles.explorerHeader}>
                <span>{explorerColapsado ? "" : "Explorador"}</span>
                <button style={styles.secondaryButton} onClick={() => setExplorerColapsado((v) => !v)}>
                  {explorerColapsado ? "▸" : "▾"}
                </button>
              </div>
              {!explorerColapsado && (
                <div style={styles.explorerBody}>
                  {arvoreEstruturada.length ? (
                    arvoreEstruturada.map((n) => renderNode(n))
                  ) : (
                    <div style={{ color: "#475569", padding: "12px 6px" }}>Nenhum projeto carregado.</div>
                  )}
                </div>
              )}
            </div>

            <div style={styles.editorCol}>
              <div style={styles.editorSurface}>
                <textarea
                  value={conteudo}
                  onChange={(e) => setConteudo(e.target.value)}
                  style={styles.editorTextarea}
                  placeholder="Selecione um arquivo para começar a edição"
                />
              </div>
              {dirty && (
                <div style={styles.diffBar}>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span>Alterações não salvas {arquivoAtual ? `em ${arquivoAtual}` : ""}</span>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      style={styles.secondaryButton}
                      onClick={() => {
                        setConteudo(original);
                      }}
                      disabled={loading}
                    >
                      Descartar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={styles.chatDock(chatColapsado)}>
          <div style={styles.chatHeader}>
            <span>Chat com o Agente IA</span>
            <button style={styles.secondaryButton} onClick={() => setChatColapsado((v) => !v)}>
              {chatColapsado ? "▲" : "▼"}
            </button>
          </div>
          {!chatColapsado && (
            <>
              <div style={styles.chatMessages}>
                {chat.map((m, i) => (
                  <div key={i} style={styles.chatBubble(m.mensagem && !m.resposta)}>
                    {m.mensagem && (
                      <>
                        <strong style={{ fontSize: 11, letterSpacing: 0.6, color: "rgba(226,232,240,0.75)" }}>
                          Você
                        </strong>
                        <span style={{ whiteSpace: "pre-wrap", fontSize: 13 }}>{m.mensagem}</span>
                      </>
                    )}
                    {m.resposta && (
                      <div style={styles.chatBubble(false)}>
                        <strong style={{ fontSize: 11, letterSpacing: 0.6, color: "rgba(226,232,240,0.75)" }}>
                          Agente
                        </strong>
                        <span style={{ whiteSpace: "pre-wrap", fontSize: 13 }}>{m.resposta}</span>
                      </div>
                    )}
                  </div>
                ))}
                {!chat.length && (
                  <div style={{ color: "#475569", fontSize: 13 }}>
                    Converse com o agente para orientar edições e automatizar fluxos.
                  </div>
                )}
              </div>
              <div style={styles.chatInputRow}>
                <textarea
                  style={styles.chatInput}
                  placeholder="Descreva a alteração desejada..."
                  value={entradaChat}
                  onChange={(e) => setEntradaChat(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      enviar_chat(entradaChat);
                    }
                  }}
                />
                <button style={styles.primaryButton} onClick={() => enviar_chat(entradaChat)} disabled={loading}>
                  Enviar
                </button>
              </div>
            </>
          )}
        </div>
      </main>

      {mostrarMudancas && (
        <div style={styles.modal} onClick={() => setMostrarMudancas(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0, marginBottom: 20, color: "#10b981" }}>Mudanças Pendentes de Aprovação</h2>
            {mudancasPendentes.map((mudanca) => (
              <div key={mudanca.id} style={styles.mudancaCard}>
                <h3 style={{ marginTop: 0, fontSize: 16, color: "#e2e8f0" }}>{mudanca.arquivo}</h3>
                <p style={{ fontSize: 13, color: "#94a3b8" }}>{mudanca.descricao}</p>
                <div style={styles.diffPreview}>{mudanca.diff.slice(0, 1000)}</div>
                <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
                  <button
                    style={styles.primaryButton}
                    onClick={() => aprovarMudanca(mudanca.id)}
                    disabled={loading}
                  >
                    ✓ Aprovar e Aplicar
                  </button>
                  <button
                    style={{ ...styles.secondaryButton, background: "rgba(239,68,68,0.2)", border: "1px solid rgba(239,68,68,0.4)" }}
                    onClick={() => rejeitarMudanca(mudanca.id)}
                    disabled={loading}
                  >
                    ✗ Rejeitar
                  </button>
                </div>
              </div>
            ))}
            <button style={{ ...styles.secondaryButton, marginTop: 20 }} onClick={() => setMostrarMudancas(false)}>
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
