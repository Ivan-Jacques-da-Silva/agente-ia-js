import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const [arquivoAtual, setArquivoAtual] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [original, setOriginal] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [entradaChat, setEntradaChat] = useState("");
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

  const chatResizeDataRef = useRef(null);
  const chatListRef = useRef(null);

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
      const j = await parseJsonResponse(r, "Falha ao carregar mudan��as");
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
      await carregarMudancasPendentes();
    });
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

    await runWithLoading("Salvando arquivo...", async () => {
      const r = await fetch(buildUrl(agenteUrl, "/repo/save"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: arquivoAtual, conteudo }),
      });

      await parseJsonResponse(r, "Falha ao salvar arquivo");
      setOriginal(conteudo);
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
      setChatMessages((prev) =>
        prev.map((item) =>
          item.id === placeholder.id
            ? { ...item, text: j.resposta || "Sem resposta", pending: false }
            : item
        )
      );

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
      alert("Mudança aprovada e aplicada!");
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

    const toggle = () => {
      if (isDir) {
        setDiretoriosAbertos((prev) => ({ ...prev, [node.fullPath]: !aberto }));
      } else {
        abrir_arquivo(node.fullPath);
      }
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
        </button>
        {isDir && aberto && node.children && node.children.map((filho) => renderNode(filho, nivel + 1))}
      </div>
    );
  };

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
          <h2 className="section-title">Status da Conexão</h2>
          <div
            className={classNames(
              "status-card",
              agenteStatus === "ready" && "status-card--ready",
              agenteStatus === "failed" && "status-card--failed"
            )}
          >
            {agenteStatus === "ready" ? "✓ Conectado" : agenteStatus === "resolving" ? "⏳ Conectando..." : "✗ Desconectado"}
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
            <label className="field-label" htmlFor="repoUrl">URL do Repositório</label>
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
              {dirty && (
                <button
                  type="button"
                  className="button button-primary"
                  onClick={persistirArquivo}
                  disabled={loading}
                >
                  Salvar Arquivo
                </button>
              )}
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
            <span className="tab-current">{arquivoAtual || "Sem arquivo aberto"}</span>
          </div>

          {erro && <div className="error-banner">{erro}</div>}

          <div
            className="workspace-panels"
            style={{ "--chat-panel-width": chatColapsado ? "0px" : `${chatWidth}px` }}
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
                    <div className="code-surface">
                      <textarea
                        value={conteudo}
                        onChange={(e) => setConteudo(e.target.value)}
                        className="code-textarea"
                        placeholder="Selecione um arquivo para começar a edição"
                      />
                    </div>
                    {dirty && (
                      <div className="diff-bar">
                        <div className="diff-info">
                          <span>Alterações não salvas {arquivoAtual ? `em ${arquivoAtual}` : ""}</span>
                          <button
                            type="button"
                            className="button button-tertiary"
                            onClick={() => setConteudo(original)}
                            disabled={loading}
                          >
                            Descartar alterações
                          </button>
                        </div>
                      </div>
                    )}
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
                    {chatColapsado ? "Abrir" : "Fechar"}
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
            <button type="button" className="button button-tertiary" onClick={() => setMostrarMudancas(false)}>
              Fechar
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="loading-overlay">
          <div className="loading-indicator">
            <span className="loading-spinner" />
            <p className="loading-text">{loadingMessage || "Processando..."}</p>
          </div>
        </div>
      )}
    </div>
  );
}
