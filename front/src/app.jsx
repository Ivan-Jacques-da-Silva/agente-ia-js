import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import hljs from "highlight.js/lib/common";
import "highlight.js/styles/github-dark-dimmed.css";
import "./app.css";

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
        } catch {
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

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

function createMessage(role, text, options = {}) {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role,
    text,
    pending: Boolean(options.pending),
    timestamp: options.timestamp || new Date().toISOString(),
  };
}

function mapConversasParaMensagens(lista = []) {
  const mensagens = [];
  lista.forEach((item, index) => {
    if (item.mensagem) {
      mensagens.push({
        id: `hist-${index}-user`,
        role: "user",
        text: item.mensagem,
        timestamp: item.timestamp,
      });
    }
    if (item.resposta) {
      mensagens.push({
        id: `hist-${index}-agent`,
        role: "agent",
        text: item.resposta,
        timestamp: item.timestamp,
      });
    }
  });
  return mensagens;
}

function extractFileFromDescription(descricao) {
  if (!descricao) return null;
  const match = descricao.match(/Arquivo\s+(.+?)\s+(salvo|alterado)/i);
  return match ? match[1] : null;
}

function formatTimestamp(timestamp) {
  if (!timestamp) return "";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(timestamp));
  } catch {
    return timestamp;
  }
}

export default function App() {
  const { base: agenteUrl, status: agenteStatus } = useEndpointResolver(AGENTE_CANDIDATES, "/saude");

  const [repo, setRepo] = useState("");
  const [caminhoLocal, setCaminhoLocal] = useState("");
  const [branchBase, setBranchBase] = useState("main");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");

  const [arvore, setArvore] = useState([]);
  const [abas, setAbas] = useState([]);
  const [abaAtiva, setAbaAtiva] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [entradaChat, setEntradaChat] = useState("");
  const [expandedHistory, setExpandedHistory] = useState({});
  const [explorerColapsado, setExplorerColapsado] = useState(false);
  const [chatColapsado, setChatColapsado] = useState(false);
  const [diretoriosAbertos, setDiretoriosAbertos] = useState({});
  const [projetoAtual, setProjetoAtual] = useState(null);
  const [mudancasPendentes, setMudancasPendentes] = useState([]);
  const [mostrarMudancas, setMostrarMudancas] = useState(false);
  const [historico, setHistorico] = useState([]);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState("editor");
  const [chatWidth, setChatWidth] = useState(360);
  const [isResizingChat, setIsResizingChat] = useState(false);
  const [copiando, setCopiando] = useState(false);
  const [menuAberto, setMenuAberto] = useState(null);
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [textoBusca, setTextoBusca] = useState("");
  const [resultadosBusca, setResultadosBusca] = useState([]);
  const [indiceBuscaAtual, setIndiceBuscaAtual] = useState(0);
  const [diffViewerAberto, setDiffViewerAberto] = useState(false);
  const [diffAtual, setDiffAtual] = useState(null);
  const [indiceMudancaAtual, setIndiceMudancaAtual] = useState(0);

  const chatResizeDataRef = useRef(null);
  const chatListRef = useRef(null);
  const menuRef = useRef(null);

  const textareaRef = useRef(null);
  const gutterRef = useRef(null);
  const highlightRef = useRef(null);

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

  const runWithLoading = useCallback(async (message, task) => {
    setLoading(true);
    setLoadingMessage(message || "Processando...");
    try {
      await task();
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  }, []);

  const carregarMudancasPendentes = useCallback(async () => {
    if (!requireAgentReady()) return;
    try {
      const r = await fetch(buildUrl(agenteUrl, "/mudancas/pendentes"));
      const j = await parseJsonResponse(r, "Falha ao carregar mudanças");
      setMudancasPendentes(j.mudancas || []);
    } catch (e) {
      console.error("Erro ao carregar mudanças:", e);
    }
  }, [agenteUrl, requireAgentReady]);

  const carregarHistorico = useCallback(async () => {
    if (!requireAgentReady()) return;
    try {
      const r = await fetch(buildUrl(agenteUrl, "/historico"));
      const j = await parseJsonResponse(r, "Falha ao carregar histórico");
      setHistorico(j.historico || []);
    } catch (e) {
      console.error("Erro ao carregar histórico:", e);
    }
  }, [agenteUrl, requireAgentReady]);

  async function abrir_repo() {
    setErro("");
    if (!requireAgentReady()) return;

    await runWithLoading("Lendo repositório...", async () => {
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
      setChatMessages(mapConversasParaMensagens(j.conversas));
      setHistorico(j.historico || []);
      setActiveWorkspaceTab("editor");
      setChatColapsado(false);
      setAbas([]);
      setAbaAtiva(null);
      await carregarMudancasPendentes();
    });
  }

  async function abrir_arquivo(p) {
    if (!requireAgentReady()) return;

    // Verificar se o arquivo já está aberto em uma aba
    const abaExistente = abas.find(aba => aba.path === p);
    if (abaExistente) {
      setAbaAtiva(abaExistente.id);
      return;
    }

    try {
      const r = await fetch(buildUrl(agenteUrl, `/repo/file?path=${encodeURIComponent(p)}`));
      const t = await r.text();

      const novaAba = {
        id: `tab-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        path: p,
        nome: p.split('/').pop(),
        conteudo: t,
        original: t,
        dirty: false
      };

      setAbas(prev => [...prev, novaAba]);
      setAbaAtiva(novaAba.id);
    } catch (e) {
      setErro(String(e?.message || e));
    }
  }

  function fecharAba(abaId, e) {
    if (e) {
      e.stopPropagation();
    }

    const abaIndex = abas.findIndex(a => a.id === abaId);
    if (abaIndex === -1) return;

    const aba = abas[abaIndex];
    if (aba.dirty) {
      if (!confirm(`O arquivo ${aba.nome} tem alterações não salvas. Deseja fechar mesmo assim?`)) {
        return;
      }
    }

    const novasAbas = abas.filter(a => a.id !== abaId);
    setAbas(novasAbas);

    if (abaAtiva === abaId) {
      if (novasAbas.length > 0) {
        const proximaAba = novasAbas[Math.max(0, abaIndex - 1)];
        setAbaAtiva(proximaAba.id);
      } else {
        setAbaAtiva(null);
      }
    }
  }

  function atualizarConteudoAba(conteudoNovo) {
    if (!abaAtiva) return;

    setAbas(prev => prev.map(aba => {
      if (aba.id === abaAtiva) {
        return {
          ...aba,
          conteudo: conteudoNovo,
          dirty: conteudoNovo !== aba.original
        };
      }
      return aba;
    }));
  }

  async function persistirArquivo() {
    const abaAtual = abas.find(a => a.id === abaAtiva);
    if (!abaAtual) return;
    if (!requireAgentReady()) return;

    await runWithLoading("Salvando arquivo...", async () => {
      const r = await fetch(buildUrl(agenteUrl, "/repo/save"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: abaAtual.path, conteudo: abaAtual.conteudo }),
      });

      await parseJsonResponse(r, "Falha ao salvar arquivo");

      setAbas(prev => prev.map(aba => {
        if (aba.id === abaAtiva) {
          return { ...aba, original: aba.conteudo, dirty: false };
        }
        return aba;
      }));

      setErro("");
      await carregarMudancasPendentes();
      await carregarHistorico();
    });
  }

  async function commit_push() {
    if (!requireAgentReady()) return;

    await runWithLoading("Realizando commit...", async () => {
      const r = await fetch(buildUrl(agenteUrl, "/repo/commit"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensagem: `feat: atualizações em ${arquivoAtual || "projeto"}` }),
      });

      await parseJsonResponse(r, "Falha ao realizar commit");
      setErro("");
      await carregarHistorico();
      alert("Commit realizado com sucesso!");
    });
  }

  async function enviar_chat(texto) {
    const msg = texto.trim();
    if (!msg) return;
    if (!requireAgentReady()) {
      setErro("Aguardando conexão com o agente para enviar mensagens.");
      return;
    }

    const userMessage = createMessage("user", msg);
    const placeholder = createMessage("agent", "Digitando...", { pending: true });

    setChatMessages((prev) => [...prev, userMessage, placeholder]);
    setEntradaChat("");
    setLoading(true);
    setLoadingMessage("Consultando agente...");

    try {
      const r = await fetch(buildUrl(agenteUrl, "/chat/inteligente"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensagem: msg }),
      });

      const j = await parseJsonResponse(r, "Falha ao enviar mensagem");
      const passos = (j && (j.passos || (j.analise && j.analise.passos))) || [];
      if (Array.isArray(passos) && passos.length) {
        const passosText = [
          "Passo a passo:",
          ...passos.map((p, i) => `${i + 1}. ${p}`)
        ].join("\n");
        setChatMessages((prev) => prev.map((item) => item.id === placeholder.id
          ? { ...item, text: passosText, pending: false }
          : item
        ));
        const finalMsg = createMessage("agent", j.resposta || "Sem resposta");
        setChatMessages((prev) => [...prev, finalMsg]);
      } else {
        setChatMessages((prev) =>
          prev.map((item) =>
            item.id === placeholder.id
              ? { ...item, text: j.resposta || "Sem resposta", pending: false }
              : item
          )
        );
      }

      if (j.mudancas > 0) {
        await carregarMudancasPendentes();
        setMostrarMudancas(true);
      }
      await carregarHistorico();
    } catch (e) {
      setChatMessages((prev) =>
        prev.map((item) =>
          item.id === placeholder.id
            ? { ...item, text: `Erro: ${e?.message || e}`, pending: false }
            : item
        )
      );
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  }

  async function aprovarMudanca(mudancaId) {
    if (!requireAgentReady()) return;

    await runWithLoading("Aplicando mudança...", async () => {
      const r = await fetch(buildUrl(agenteUrl, "/mudancas/aprovar"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mudancaId }),
      });

      await parseJsonResponse(r, "Falha ao aprovar mudança");
      await carregarMudancasPendentes();
      await carregarHistorico();
      setErro("");
      alert("mudança aprovada e aplicada!");
    });
  }

  async function rejeitarMudanca(mudancaId) {
    if (!requireAgentReady()) return;

    await runWithLoading("Rejeitando mudança...", async () => {
      const r = await fetch(buildUrl(agenteUrl, "/mudancas/rejeitar"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mudancaId }),
      });

      await parseJsonResponse(r, "Falha ao rejeitar mudança");
      await carregarMudancasPendentes();
      await carregarHistorico();
      setErro("");
    });
  }

  // Copiar código inteiro do editor
  async function copiar_codigo() {
    const abaAtual = abas.find(a => a.id === abaAtiva);
    const conteudo = abaAtual?.conteudo || "";

    try {
      await navigator.clipboard.writeText(conteudo);
      setCopiando(true);
      setTimeout(() => setCopiando(false), 1500);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = conteudo;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopiando(true);
      setTimeout(() => setCopiando(false), 1500);
    }
  }

  // Sistema de busca (Ctrl+F)
  function realizarBusca(termo) {
    setTextoBusca(termo);

    const abaAtual = abas.find(a => a.id === abaAtiva);
    if (!abaAtual || !termo) {
      setResultadosBusca([]);
      setIndiceBuscaAtual(0);
      return;
    }

    const conteudo = abaAtual.conteudo;
    const linhas = conteudo.split('\n');
    const resultados = [];

    linhas.forEach((linha, numLinha) => {
      let index = 0;
      while ((index = linha.toLowerCase().indexOf(termo.toLowerCase(), index)) !== -1) {
        resultados.push({
          linha: numLinha,
          coluna: index,
          texto: linha
        });
        index += termo.length;
      }
    });

    setResultadosBusca(resultados);
    setIndiceBuscaAtual(0);

    if (resultados.length > 0) {
      scrollParaBusca(resultados[0]);
    }
  }

  function proximaBusca() {
    if (resultadosBusca.length === 0) return;
    const novoIndice = (indiceBuscaAtual + 1) % resultadosBusca.length;
    setIndiceBuscaAtual(novoIndice);
    scrollParaBusca(resultadosBusca[novoIndice]);
  }

  function buscaAnterior() {
    if (resultadosBusca.length === 0) return;
    const novoIndice = (indiceBuscaAtual - 1 + resultadosBusca.length) % resultadosBusca.length;
    setIndiceBuscaAtual(novoIndice);
    scrollParaBusca(resultadosBusca[novoIndice]);
  }

  function scrollParaBusca(resultado) {
    if (!textareaRef.current) return;

    const abaAtual = abas.find(a => a.id === abaAtiva);
    if (!abaAtual) return;

    const linhas = abaAtual.conteudo.split('\n');
    let posicao = 0;

    for (let i = 0; i < resultado.linha; i++) {
      posicao += linhas[i].length + 1;
    }
    posicao += resultado.coluna;

    textareaRef.current.focus();
    textareaRef.current.setSelectionRange(posicao, posicao + textoBusca.length);
    textareaRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // Download de arquivo
  async function downloadArquivo(filePath) {
    if (!requireAgentReady()) return;
    try {
      const r = await fetch(buildUrl(agenteUrl, `/repo/file?path=${encodeURIComponent(filePath)}`));
      const conteudoArquivo = await r.text();

      const blob = new Blob([conteudoArquivo], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filePath.split('/').pop();
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setMenuAberto(null);
    } catch (e) {
      setErro(`Erro ao baixar arquivo: ${e?.message || e}`);
    }
  }

  // Renomear arquivo (placeholder para implementação futura)
  async function renomearArquivo(filePath) {
    // TODO: Implementar modal de renomeação
    alert(`Função de renomear em desenvolvimento. Arquivo: ${filePath}`);
    setMenuAberto(null);
  }

  const arvoreEstruturada = useMemo(() => buildTree(arvore), [arvore]);

  const abaAtual = abas.find(a => a.id === abaAtiva);
  const conteudo = abaAtual?.conteudo || "";
  const dirty = abaAtual?.dirty || false;
  const arquivoAtual = abaAtual?.path || null;


  const linhasEditor = useMemo(() => {
    const total = Math.max(1, String(conteudo).split("\n").length);
    return Array.from({ length: total }, (_, i) => i + 1).join("\n");
  }, [conteudo]);

  function guessLanguage(file) {
    if (!file) return null;
    const f = String(file).toLowerCase();
    if (f.endsWith(".js")) return "javascript";
    if (f.endsWith(".jsx")) return "jsx";
    if (f.endsWith(".ts")) return "typescript";
    if (f.endsWith(".tsx")) return "tsx";
    if (f.endsWith(".json")) return "json";
    if (f.endsWith(".css")) return "css";
    if (f.endsWith(".scss") || f.endsWith(".sass")) return "scss";
    if (f.endsWith(".html") || f.endsWith(".htm")) return "xml";
    if (f.endsWith(".md")) return "markdown";
    if (f.endsWith(".yml") || f.endsWith(".yaml")) return "yaml";
    if (f.endsWith(".py")) return "python";
    if (f.endsWith(".rb")) return "ruby";
    if (f.endsWith(".go")) return "go";
    if (f.endsWith(".rs")) return "rust";
    if (f.endsWith(".java")) return "java";
    if (f.endsWith(".kt")) return "kotlin";
    if (f.endsWith(".php")) return "php";
    if (f.endsWith(".swift")) return "swift";
    if (f.endsWith(".sql")) return "sql";
    if (f.includes("dockerfile")) return "dockerfile";
    if (f.endsWith("makefile")) return "makefile";
    return null;
  }

  const highlightedHtml = useMemo(() => {
    try {
      const lang = guessLanguage(abaAtual?.path);
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(conteudo, { language: lang, ignoreIllegals: true }).value;
      }
      return hljs.highlightAuto(conteudo).value;
    } catch {
      const esc = String(conteudo).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
      return esc;
    }
  }, [conteudo, abaAtual?.path]);

  const onEditorScroll = (e) => {
    const top = e.currentTarget.scrollTop;
    if (gutterRef.current) gutterRef.current.style.transform = `translateY(-${top}px)`;
    if (highlightRef.current) highlightRef.current.style.transform = `translateY(-${top}px)`;
  };

  useEffect(() => {
    if (gutterRef.current) gutterRef.current.style.transform = "translateY(0px)";
    if (highlightRef.current) highlightRef.current.style.transform = "translateY(0px)";
  }, [arquivoAtual]);

  function parseUnifiedDiff(text) {
    if (!text || typeof text !== "string") return [];
    const lines = text.split(/\r?\n/);
    const out = [];
    let oldNo = 0, newNo = 0;
    for (const raw of lines) {
      if (raw.startsWith("@@")) {
        const m = raw.match(/@@ -([0-9]+),?([0-9]*) \+([0-9]+),?([0-9]*) @@/);
        if (m) { oldNo = parseInt(m[1], 10); newNo = parseInt(m[3], 10); }
        out.push({ type: "context", gutter: "", code: raw });
        continue;
      }
      if (raw.startsWith("+") && !raw.startsWith("+++")) {
        out.push({ type: "add", gutter: `  ${newNo++}`, code: raw });
        continue;
      }
      if (raw.startsWith("-") && !raw.startsWith("---")) {
        out.push({ type: "remove", gutter: `${oldNo++}  `, code: raw });
        continue;
      }
      if (raw.startsWith("diff ") || raw.startsWith("index ") || raw.startsWith("--- ") || raw.startsWith("+++ ")) {
        out.push({ type: "context", gutter: "", code: raw });
        continue;
      }
      out.push({ type: "context", gutter: `${oldNo} ${newNo}`, code: raw });
      oldNo++; newNo++;
    }
    return out;
  }

  function parseDiffForSplitView(diffText) {
    if (!diffText) return { original: [], modified: [], changes: [] };

    const lines = diffText.split(/\r?\n/);
    const original = [];
    const modified = [];
    const changes = [];

    let originalLineNum = 1;
    let modifiedLineNum = 1;
    let changeIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith('@@')) {
        const match = line.match(/@@ -([0-9]+),?([0-9]*) \+([0-9]+),?([0-9]*) @@/);
        if (match) {
          originalLineNum = parseInt(match[1], 10);
          modifiedLineNum = parseInt(match[3], 10);
        }
        continue;
      }

      if (line.startsWith('---') || line.startsWith('+++') || line.startsWith('diff ') || line.startsWith('index ')) {
        continue;
      }

      if (line.startsWith('+')) {
        modified.push({
          lineNum: modifiedLineNum++,
          content: line.substring(1),
          type: 'added'
        });
        original.push({
          lineNum: null,
          content: '',
          type: 'empty'
        });
        changes.push(modified.length - 1);
        changeIndex++;
      } else if (line.startsWith('-')) {
        original.push({
          lineNum: originalLineNum++,
          content: line.substring(1),
          type: 'removed'
        });
        modified.push({
          lineNum: null,
          content: '',
          type: 'empty'
        });
        changes.push(original.length - 1);
        changeIndex++;
      } else {
        original.push({
          lineNum: originalLineNum++,
          content: line.startsWith(' ') ? line.substring(1) : line,
          type: 'context'
        });
        modified.push({
          lineNum: modifiedLineNum++,
          content: line.startsWith(' ') ? line.substring(1) : line,
          type: 'context'
        });
      }
    }

    return { original, modified, changes };
  }

  function abrirDiffViewer(itemHistorico) {
    const diffData = parseDiffForSplitView(itemHistorico.diff || '');
    setDiffAtual({
      arquivo: extractFileFromDescription(itemHistorico.descricao) || 'arquivo',
      timestamp: itemHistorico.timestamp,
      tipo: itemHistorico.tipo,
      ...diffData
    });
    setIndiceMudancaAtual(0);
    setDiffViewerAberto(true);
  }

  function navegarParaMudanca(direcao) {
    if (!diffAtual || !diffAtual.changes.length) return;

    const novoIndice = direcao === 'next'
      ? Math.min(indiceMudancaAtual + 1, diffAtual.changes.length - 1)
      : Math.max(indiceMudancaAtual - 1, 0);

    setIndiceMudancaAtual(novoIndice);

    const linhaAlvo = diffAtual.changes[novoIndice];
    const elementos = document.querySelectorAll('.diff-code-line');
    if (elementos[linhaAlvo]) {
      elementos[linhaAlvo].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  const diffPaneLeftRef = useRef(null);
  const diffPaneRightRef = useRef(null);

  const sincronizarScroll = useCallback((source) => {
    if (source === 'left' && diffPaneRightRef.current && diffPaneLeftRef.current) {
      diffPaneRightRef.current.scrollTop = diffPaneLeftRef.current.scrollTop;
    } else if (source === 'right' && diffPaneLeftRef.current && diffPaneRightRef.current) {
      diffPaneLeftRef.current.scrollTop = diffPaneRightRef.current.scrollTop;
    }
  }, []);

  function renderDiff(text) {
    const rows = parseUnifiedDiff(text);
    if (!rows.length) return null;
    return (
      <div className="diff-block">
        {rows.map((r, i) => (
          <div key={i} className={"diff-line diff-line--" + (r.type === "add" ? "add" : r.type === "remove" ? "remove" : "context")}>
            <div className="diff-gutter">{r.gutter}</div>
            <div className="diff-code">{r.code}</div>
          </div>
        ))}
      </div>
    );
  }

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

  useEffect(() => {
    if (chatListRef.current) {
      chatListRef.current.scrollTop = chatListRef.current.scrollHeight;
    }
  }, [chatMessages]);

  useEffect(() => {
    if (activeWorkspaceTab === "history") {
      carregarHistorico();
    }
  }, [activeWorkspaceTab, carregarHistorico]);

  const handleChatResize = useCallback((event) => {
    if (!chatResizeDataRef.current) return;
    const delta = chatResizeDataRef.current.startX - event.clientX;
    const nextWidth = chatResizeDataRef.current.startWidth + delta;
    const clamped = Math.min(520, Math.max(260, nextWidth));
    setChatWidth(clamped);
  }, []);

  const stopChatResize = useCallback(() => {
    chatResizeDataRef.current = null;
    setIsResizingChat(false);
    window.removeEventListener("mousemove", handleChatResize);
    window.removeEventListener("mouseup", stopChatResize);
  }, [handleChatResize]);

  const startChatResize = useCallback(
    (event) => {
      if (chatColapsado) return;
      event.preventDefault();
      chatResizeDataRef.current = { startX: event.clientX, startWidth: chatWidth };
      setIsResizingChat(true);
      window.addEventListener("mousemove", handleChatResize);
      window.addEventListener("mouseup", stopChatResize);
    },
    [chatColapsado, chatWidth, handleChatResize, stopChatResize]
  );

  useEffect(() => {
    return () => {
      window.removeEventListener("mousemove", handleChatResize);
      window.removeEventListener("mouseup", stopChatResize);
    };
  }, [handleChatResize, stopChatResize]);

  const renderNode = (node, nivel = 0) => {
    const isDir = node.tipo === "dir";
    const aberto = diretoriosAbertos[node.fullPath] ?? true;
    const menuEstaAberto = menuAberto === node.fullPath;

    const toggle = () => {
      if (isDir) {
        setDiretoriosAbertos((prev) => ({ ...prev, [node.fullPath]: !aberto }));
      } else {
        abrir_arquivo(node.fullPath);
      }
    };

    const toggleMenu = (e) => {
      e.stopPropagation();
      setMenuAberto(menuEstaAberto ? null : node.fullPath);
    };

    return (
      <div key={node.fullPath} className="file-tree-branch">
        <button
          type="button"
          onClick={toggle}
          className={classNames(
            "file-tree-item",
            isDir && "file-tree-item--directory",
            isDir && aberto && "is-open",
            arquivoAtual === node.fullPath && "is-active"
          )}
          style={{ "--indent-level": nivel }}
        >
          <span className="file-tree-expander">{isDir ? (aberto ? "▾" : "▸") : ""}</span>
          <span className="file-tree-icon">{isDir ? (aberto ? "📂" : "📁") : "📄"}</span>
          <span className="file-tree-label">{node.nome}</span>

          {!isDir && (
            <div className="file-tree-actions">
              <button
                type="button"
                className="file-action-button"
                onClick={toggleMenu}
                aria-label="Mais opções"
              >
                ⋮
              </button>

              {menuEstaAberto && (
                <div className="file-context-menu" ref={menuRef}>
                  <button
                    type="button"
                    className="file-context-item"
                    onClick={(e) => {
                      e.stopPropagation();
                      renomearArquivo(node.fullPath);
                    }}
                  >
                    <span className="file-context-item-icon">✏️</span>
                    <span>Renomear</span>
                  </button>

                  <button
                    type="button"
                    className="file-context-item"
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadArquivo(node.fullPath);
                    }}
                  >
                    <span className="file-context-item-icon">⬇️</span>
                    <span>Download</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </button>
        {isDir && aberto && node.children && node.children.map((filho) => renderNode(filho, nivel + 1))}
      </div>
    );
  };

  // Atalhos de teclado
  useEffect(() => {
    const onKey = (e) => {
      // Ctrl/Cmd+Shift+C para copiar código
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        copiar_codigo();
      }

      // Ctrl/Cmd+F para busca
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setBuscaAberta(prev => !prev);
      }

      // ESC para fechar busca
      if (e.key === "Escape" && buscaAberta) {
        setBuscaAberta(false);
        setTextoBusca("");
        setResultadosBusca([]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [buscaAberta]);

  // Fechar menu ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuAberto(null);
      }
    };

    if (menuAberto) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [menuAberto]);

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="brand-header">
          <div className="brand-logo">🤖</div>
          <div className="brand-copy">
            <span className="brand-title">Agente IA</span>
            <span className="brand-subtitle">Sistema de Desenvolvimento</span>
          </div>
        </div>

        <section className="sidebar-section">
          <h2 className="section-title">Status da conexão</h2>
          <div
            className={classNames(
              "status-card",
              agenteStatus === "ready" && "status-card--ready",
              agenteStatus === "failed" && "status-card--failed"
            )}
          >
            {agenteStatus === "ready"
              ? "✓ Conectado"
              : agenteStatus === "resolving"
                ? "⏳ Conectando..."
                : "✗ Desconectado"}
          </div>
        </section>

        {projetoAtual && (
          <section className="sidebar-section">
            <h2 className="section-title">Projeto Atual</h2>
            <div className="project-card">{projetoAtual.nome}</div>
          </section>
        )}

        <section className="sidebar-section">
          <h2 className="section-title">Abrir Projeto</h2>
          <div className="field-grid">
            <label className="field-label" htmlFor="caminhoLocal">Caminho Local</label>
            <input
              id="caminhoLocal"
              className="form-input"
              placeholder="/caminho/para/projeto"
              value={caminhoLocal}
              onChange={(e) => setCaminhoLocal(e.target.value)}
            />

            <label className="field-label" htmlFor="repoUrl">URL do repositório</label>
            <input
              id="repoUrl"
              className="form-input"
              placeholder="https://github.com/org/projeto"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
            />

            <label className="field-label" htmlFor="branchBase">Branch Base</label>
            <input
              id="branchBase"
              className="form-input"
              placeholder="main"
              value={branchBase}
              onChange={(e) => setBranchBase(e.target.value)}
            />

            <button className="button button-primary" onClick={abrir_repo} disabled={loading}>
              {loading ? "Processando..." : "Abrir Projeto"}
            </button>
          </div>
        </section>

        {mudancasPendentes.length > 0 && (
          <section className="sidebar-section">
            <button
              className="button button-attention"
              type="button"
              onClick={() => setMostrarMudancas(true)}
              disabled={loading}
            >
              {mudancasPendentes.length} mudança(s) pendente(s)
            </button>
          </section>
        )}
      </aside>

      <main className="main-content">
        <div className="window-chrome">
          <div className="window-bar">
            <div className="window-dots">
              <span className="window-dot window-dot--red" />
              <span className="window-dot window-dot--yellow" />
              <span className="window-dot window-dot--green" />
            </div>
            <span className="window-title">Editor do Agente</span>
            <div className="window-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setExplorerColapsado((v) => !v)}
                disabled={loading}
              >
                {explorerColapsado ? "Mostrar árvore" : "Ocultar árvore"}
              </button>

              <button
                type="button"
                className="button button-secondary"
                onClick={commit_push}
                disabled={loading}
              >
                Commit & Push
              </button>
            </div>
          </div>

          <div className="tab-bar">
            <div className="tab-group">
              <button
                type="button"
                className={classNames("tab-item", activeWorkspaceTab === "editor" && "is-active")}
                onClick={() => setActiveWorkspaceTab("editor")}
              >
                Editor
              </button>
              <button
                type="button"
                className={classNames("tab-item", activeWorkspaceTab === "history" && "is-active")}
                onClick={() => setActiveWorkspaceTab("history")}
              >
                Histórico
              </button>
            </div>
          </div>

          {erro && <div className="error-banner">{erro}</div>}

          <div
            className="workspace-panels"
            style={{ "--chat-panel-width": chatColapsado ? "40px" : `${chatWidth}px`, position: "relative" }}
          >
            <div className="editor-stack">
              <aside className={classNames("file-explorer", explorerColapsado && "is-collapsed")}>
                <div className="file-explorer-header">
                  <span>{explorerColapsado ? "" : "Explorador"}</span>
                  <button
                    type="button"
                    className="button button-tertiary"
                    onClick={() => setExplorerColapsado((v) => !v)}
                  >
                    {explorerColapsado ? "▸" : "▾"}
                  </button>
                </div>
                {!explorerColapsado && (
                  <div className="file-tree">
                    {arvoreEstruturada.length ? (
                      arvoreEstruturada.map((nodo) => renderNode(nodo))
                    ) : (
                      <div className="empty-state">Nenhum projeto carregado.</div>
                    )}
                  </div>
                )}
              </aside>

              <section className="editor-content">
                {activeWorkspaceTab === "editor" ? (
                  <div className="editor-column">
                    {/* Barra de abas de arquivos */}
                    <div className="file-tabs-bar">
                      {abas.map(aba => (
                        <div
                          key={aba.id}
                          className={classNames("file-tab", abaAtiva === aba.id && "is-active")}
                          onClick={() => setAbaAtiva(aba.id)}
                        >
                          <span className="file-tab-icon">📄</span>
                          <span className="file-tab-name">{aba.nome}</span>
                          {aba.dirty && <span className="file-tab-dot">●</span>}
                          <button
                            type="button"
                            className="file-tab-close"
                            onClick={(e) => fecharAba(aba.id, e)}
                            aria-label="Fechar aba"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Barra de ações do arquivo */}
                    {abaAtual && (
                      <div className="editor-actions-bar">
                        <span className="editor-file-path">{abaAtual.path}</span>
                        <div className="editor-actions">
                          <button
                            type="button"
                            className="button button-tertiary"
                            onClick={() => setBuscaAberta(prev => !prev)}
                            title="Buscar no arquivo (Ctrl+F)"
                          >
                            🔍 Buscar
                          </button>
                          <button
                            type="button"
                            className="button button-tertiary"
                            onClick={copiar_codigo}
                            disabled={loading}
                            title="Copiar código (Ctrl+Shift+C)"
                          >
                            {copiando ? "✓ Copiado!" : "📋 Copiar"}
                          </button>
                          {dirty && (
                            <button
                              type="button"
                              className="button button-primary"
                              onClick={persistirArquivo}
                              disabled={loading}
                            >
                              💾 Salvar
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Barra de busca (Ctrl+F) */}
                    {buscaAberta && abaAtual && (
                      <div className="search-bar">
                        <input
                          type="text"
                          className="search-input"
                          placeholder="Buscar no arquivo..."
                          value={textoBusca}
                          onChange={(e) => realizarBusca(e.target.value)}
                          autoFocus
                        />
                        <div className="search-controls">
                          <span className="search-count">
                            {resultadosBusca.length > 0
                              ? `${indiceBuscaAtual + 1} de ${resultadosBusca.length}`
                              : textoBusca ? "0 resultados" : ""}
                          </span>
                          <button
                            type="button"
                            className="button button-tertiary"
                            onClick={buscaAnterior}
                            disabled={resultadosBusca.length === 0}
                            title="Anterior"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className="button button-tertiary"
                            onClick={proximaBusca}
                            disabled={resultadosBusca.length === 0}
                            title="Próximo"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            className="button button-tertiary"
                            onClick={() => {
                              setBuscaAberta(false);
                              setTextoBusca("");
                              setResultadosBusca([]);
                            }}
                            title="Fechar (ESC)"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="code-surface" style={{ position: "relative", display: "flex" }}>
                      <pre
                        ref={gutterRef}
                        className="editor-gutter"
                        style={{
                          margin: 0,
                          padding: "22px 8px",
                          width: 56,
                          boxSizing: "border-box",
                          textAlign: "right",
                          color: "#64748b",
                          background: "rgba(10,16,30,0.9)",
                          borderRight: "1px solid rgba(30,41,59,0.7)",
                          fontFamily: "'Fira Code', 'JetBrains Mono', monospace",
                          fontSize: 14,
                          lineHeight: 1.6,
                          whiteSpace: "pre",
                          tabSize: 2,
                          MozTabSize: 2,
                        }}
                        onWheel={(e) => {
                          if (textareaRef.current) {
                            textareaRef.current.scrollTop += e.deltaY;
                            e.preventDefault();
                          }
                        }}
                      >
                        {linhasEditor}
                      </pre>

                      <div style={{ position: "relative", flex: 1 }}>
                        <pre
                          ref={highlightRef}
                          aria-hidden
                          style={{
                            position: "absolute",
                            top: 0, left: 0, right: 0,
                            margin: 0,
                            pointerEvents: "none",
                            padding: "22px 28px",
                            fontSize: 14,
                            lineHeight: 1.6,
                            fontFamily: "'Fira Code', 'JetBrains Mono', monospace",
                            color: "#e2e8f0",
                            whiteSpace: "pre",
                            height: "auto",
                            minHeight: "100%",
                            zIndex: 0,
                          }}
                          dangerouslySetInnerHTML={{ __html: highlightedHtml }}
                        />

                        <textarea
                          ref={textareaRef}
                          value={conteudo}
                          onChange={(e) => atualizarConteudoAba(e.target.value)}
                          onScroll={onEditorScroll}
                          className="code-textarea"
                          style={{
                            width: "100%",
                            height: "100%",
                            boxSizing: "border-box",
                            background: "transparent",
                            color: "transparent",
                            WebkitTextFillColor: "transparent",
                            caretColor: "#e2e8f0",
                            fontFamily:
                              "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
                            border: 0,
                            outline: "none",
                            resize: "none",
                            whiteSpace: "pre",
                            position: "relative",
                            zIndex: 1,
                          }}
                          wrap="off"
                          placeholder="Selecione um arquivo para começar a edição"
                          spellCheck={false}
                          autoComplete="off"
                          autoCorrect="off"
                          autoCapitalize="off"
                          translate="no"
                        />
                      </div>

                      {dirty && abaAtual && (
                        <div className="diff-bar">
                          <div className="diff-info">
                            <span>alterações não salvas em {abaAtual.path}</span>
                            <button
                              type="button"
                              className="button button-tertiary"
                              onClick={() => {
                                setAbas(prev => prev.map(aba => {
                                  if (aba.id === abaAtiva) {
                                    return { ...aba, conteudo: aba.original, dirty: false };
                                  }
                                  return aba;
                                }));
                              }}
                              disabled={loading}
                            >
                              Descartar alterações
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="history-panel">
                    {historico.length ? (
                      historico.map((item) => {
                        const arquivo = extractFileFromDescription(item.descricao);
                        return (
                          <article key={`${item.timestamp}-${item.tipo}`} className="history-entry">
                            <header className="history-entry-header">
                              <span className="history-entry-type">{item.tipo.replace(/_/g, " ")}</span>
                              <span className="history-entry-time">{formatTimestamp(item.timestamp)}</span>
                            </header>
                            {arquivo && <div className="history-entry-file">{arquivo}</div>}
                            {item.descricao && <p className="history-entry-description">{item.descricao}</p>}
                            {item.diff && (
                              <div className="history-entry-actions">
                                <button
                                  type="button"
                                  className="button button-tertiary"
                                  onClick={() => abrirDiffViewer(item)}
                                >
                                  👁️ Visualizar alterações
                                </button>
                              </div>
                            )}
                          </article>
                        );
                      })
                    ) : (
                      <div className="empty-state">Nenhum histórico disponível ainda.</div>
                    )}
                  </div>
                )}
              </section>
            </div>

            {!chatColapsado && (
              <div
                className={classNames("resize-handle", isResizingChat && "is-active")}
                onMouseDown={startChatResize}
              />
            )}

            <aside className={classNames("chat-panel", chatColapsado && "is-collapsed")}>
              <div className="chat-header">
                <span className="chat-title">Chat com o Agente IA</span>
                <div className="chat-actions">
                  {mudancasPendentes.length > 0 && (
                    <button
                      type="button"
                      className="button button-tertiary"
                      onClick={() => setMostrarMudancas(true)}
                    >
                      Revisar mudanças ({mudancasPendentes.length})
                    </button>
                  )}
                  <button
                    type="button"
                    className="button button-tertiary"
                    onClick={() => setChatColapsado((v) => !v)}
                  >
                    {chatColapsado ? "Mostrar" : "Esconder"}
                  </button>
                </div>
              </div>

              <div className="chat-message-list" ref={chatListRef}>
                {chatMessages.length ? (
                  chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={classNames(
                        "chat-message",
                        msg.role === "user" ? "chat-message--user" : "chat-message--agent",
                        msg.pending && "is-pending"
                      )}
                    >
                      <span className="chat-author">{msg.role === "user" ? "Você" : "Agente"}</span>
                      <p className="chat-text">{msg.text}</p>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">Converse com o agente para orientar edições e automatizar fluxos.</div>
                )}
              </div>

              <div className="chat-composer">
                <textarea
                  className="chat-textarea"
                  placeholder="Descreva a alteração desejada..."
                  value={entradaChat}
                  onChange={(e) => setEntradaChat(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      enviar_chat(entradaChat);
                    }
                  }}
                  spellCheck={false}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                />
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => enviar_chat(entradaChat)}
                  disabled={loading}
                >
                  Enviar
                </button>
              </div>
            </aside>
          </div>
        </div>
        {/* Botão flutuante para alternar o chat (fixo, não some no scroll) */}
        <button
          type="button"
          className={classNames("chat-fab", !chatColapsado && "is-hidden")}
          onClick={() => setChatColapsado((v) => !v)}
          title={chatColapsado ? "Abrir chat" : "Esconder chat"}
          aria-label={chatColapsado ? "Abrir chat" : "Esconder chat"}
        >
          {chatColapsado ? "Abrir chat" : "Esconder chat"}
        </button>

      </main>

      {mostrarMudancas && (
        <div className="modal-layer" onClick={() => setMostrarMudancas(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">Mudanças pendentes de aprovação</h2>

            {mudancasPendentes.map((mudanca) => (
              <article key={mudanca.id} className="change-card">
                <header className="change-header">
                  <h3 className="change-title">{mudanca.arquivo}</h3>
                  <span className="change-meta">{formatTimestamp(mudanca.criado_em)}</span>
                </header>

                <p className="change-description">{mudanca.descricao}</p>
                <pre className="diff-preview">{(mudanca.diff || "").slice(0, 2000)}</pre>

                <div className="modal-actions">
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={() => aprovarMudanca(mudanca.id)}
                    disabled={loading}
                  >
                    ✓ Aprovar e aplicar
                  </button>

                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() => rejeitarMudanca(mudanca.id)}
                    disabled={loading}
                  >
                    ✗ Rejeitar
                  </button>
                </div>
              </article>
            ))}

            <button
              type="button"
              className="button button-tertiary"
              onClick={() => setMostrarMudancas(false)}
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {diffViewerAberto && diffAtual && (
        <div className="diff-viewer-modal" onClick={() => setDiffViewerAberto(false)}>
          <div className="diff-viewer-container" onClick={(e) => e.stopPropagation()}>
            <div className="diff-viewer-header">
              <div className="diff-viewer-title">
                <div className="diff-viewer-file">{diffAtual.arquivo}</div>
                <div className="diff-viewer-meta">
                  {diffAtual.tipo.replace(/_/g, ' ')} • {formatTimestamp(diffAtual.timestamp)}
                </div>
              </div>
              <div className="diff-viewer-controls">
                <div className="diff-stats">
                  <span className="diff-stat-add">
                    +{diffAtual.modified.filter(l => l.type === 'added').length}
                  </span>
                  <span className="diff-stat-remove">
                    -{diffAtual.original.filter(l => l.type === 'removed').length}
                  </span>
                </div>
                <button
                  type="button"
                  className="button button-tertiary"
                  onClick={() => setDiffViewerAberto(false)}
                >
                  ✕ Fechar
                </button>
              </div>
            </div>

            <div className="diff-split-view">
              <div className="diff-pane">
                <div className="diff-pane-header diff-pane-header--original">
                  <span>━</span>
                  Original
                </div>
                <div
                  className="diff-pane-content"
                  ref={diffPaneLeftRef}
                  onScroll={() => sincronizarScroll('left')}
                >
                  <div className="diff-line-container">
                    <div className="diff-gutter">
                      {diffAtual.original.map((line, idx) => (
                        <div key={idx} style={{ minHeight: '21px', padding: '2px 0' }}>
                          {line.lineNum || ''}
                        </div>
                      ))}
                    </div>
                    <div className="diff-code-lines">
                      {diffAtual.original.map((line, idx) => (
                        <div
                          key={idx}
                          className={classNames(
                            'diff-code-line',
                            line.type === 'removed' && 'diff-line-removed',
                            line.type === 'empty' && 'diff-line-empty',
                            line.type === 'context' && 'diff-line-context'
                          )}
                        >
                          <div className="diff-code-line-content">
                            {line.content}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="diff-separator" />

              <div className="diff-pane">
                <div className="diff-pane-header diff-pane-header--modified">
                  <span>+</span>
                  Modificado
                </div>
                <div
                  className="diff-pane-content"
                  ref={diffPaneRightRef}
                  onScroll={() => sincronizarScroll('right')}
                >
                  <div className="diff-line-container">
                    <div className="diff-gutter">
                      {diffAtual.modified.map((line, idx) => (
                        <div key={idx} style={{ minHeight: '21px', padding: '2px 0' }}>
                          {line.lineNum || ''}
                        </div>
                      ))}
                    </div>
                    <div className="diff-code-lines">
                      {diffAtual.modified.map((line, idx) => (
                        <div
                          key={idx}
                          className={classNames(
                            'diff-code-line',
                            line.type === 'added' && 'diff-line-added',
                            line.type === 'empty' && 'diff-line-empty',
                            line.type === 'context' && 'diff-line-context'
                          )}
                        >
                          <div className="diff-code-line-content">
                            {line.content}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {diffAtual.changes.length > 0 && (
                <div className="diff-navigation">
                  <button
                    type="button"
                    className="diff-nav-button"
                    onClick={() => navegarParaMudanca('prev')}
                    disabled={indiceMudancaAtual === 0}
                    title="Mudança anterior"
                  >
                    ↑
                  </button>
                  <div style={{
                    fontSize: '11px',
                    color: '#94a3b8',
                    textAlign: 'center',
                    padding: '4px',
                    fontFamily: '"Fira Code", monospace'
                  }}>
                    {indiceMudancaAtual + 1}/{diffAtual.changes.length}
                  </div>
                  <button
                    type="button"
                    className="diff-nav-button"
                    onClick={() => navegarParaMudanca('next')}
                    disabled={indiceMudancaAtual === diffAtual.changes.length - 1}
                    title="Próxima mudança"
                  >
                    ↓
                  </button>
                </div>
              )}
            </div>

            <div className="diff-viewer-footer">
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setDiffViewerAberto(false)}
              >
                Fechar visualizador
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="loading-overlay" role="status" aria-live="polite">
          <div className="loading-indicator">
            <span className="loading-spinner" />
            <p className="loading-text">{loadingMessage || "Processando..."}</p>
          </div>
        </div>
      )}
    </div>
  );
}
