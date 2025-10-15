import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Landing from "./landing.jsx";
import VSCodeLayout from "./components/VSCodeLayout.jsx";
import { enviarChatComStreaming } from "./chat-utils.js";
import "./app.css";

const ORIGIN = typeof window !== "undefined" ? window.location.origin.replace(/\/$/, "") : "";

function normalizeBase(candidate) {
  if (!candidate) return null;
  
  // Se for uma URL completa, usar diretamente
  if (candidate.includes("://")) {
    try {
      const url = new URL(candidate);
      return url.origin + url.pathname.replace(/\/$/, "");
    } catch (e) {
      return null;
    }
  }
  
  // Se começar com /, usar o ORIGIN atual
  if (candidate.startsWith("/")) {
    return ORIGIN + candidate;
  }
  
  return null;
}

function uniqueCandidates(list) {
  const seen = new Set();
  return list.filter((item) => {
    const normalized = normalizeBase(item);
    if (!normalized || seen.has(normalized)) {
      return false;
    }
    seen.add(normalized);
    return true;
  });
}

const AGENTE_CANDIDATES = uniqueCandidates([
  "http://localhost:6060",
  import.meta.env.VITE_AGENT_URL,
  ORIGIN ? `${ORIGIN}/agente` : null,
].filter(Boolean));

function buildUrl(base, path) {
  if (!base) return null;
  
  try {
    // Se o path for absoluto (começar com /), usar diretamente com a base
    if (path.startsWith("/")) {
      const url = new URL(base);
      url.pathname = path;
      return url.toString();
    }
    
    // Caso contrário, usar como relativo
    const url = new URL(path, base);
    return url.toString();
  } catch (e) {
    return null;
  }
}

function buildTree(list) {
  const tree = {};
  
  list.forEach((item) => {
    const parts = item.split('/').filter(Boolean);
    let current = tree;
    
    parts.forEach((part, index) => {
      if (!current[part]) {
        current[part] = {
          name: part,
          fullPath: parts.slice(0, index + 1).join('/'),
          isDirectory: index < parts.length - 1,
          children: {}
        };
      }
      current = current[part].children;
    });
  });
  
  function convertToArray(obj) {
    return Object.values(obj).map(item => ({
      ...item,
      children: item.isDirectory ? convertToArray(item.children) : undefined
    }));
  }
  
  return convertToArray(tree);
}

async function parseJsonResponse(response, fallbackMessage) {
  try {
    const text = await response.text();
    if (!text.trim()) {
      return { success: false, message: fallbackMessage || "Resposta vazia do servidor" };
    }
    
    try {
      return JSON.parse(text);
    } catch (jsonError) {
      return { success: false, message: text || fallbackMessage };
    }
  } catch (error) {
    return { success: false, message: fallbackMessage || "Erro ao processar resposta" };
  }
}

function useEndpointResolver(candidates, healthPath) {
  const [state, setState] = useState({ base: null, status: "resolving" });

  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      for (const candidate of candidates) {
        if (cancelled) return;
        
        const base = normalizeBase(candidate);
        if (!base) continue;
        
        try {
          const healthUrl = buildUrl(base, healthPath);
          if (!healthUrl) continue;
          
          const response = await fetch(healthUrl, { 
            method: 'GET',
            headers: { 'Accept': 'application/json' }
          });
          
          if (response.ok && !cancelled) {
            setState({ base, status: "ready" });
            return;
          }
        } catch (error) {
          // Continue to next candidate
        }
      }
      
      if (!cancelled) {
        setState({ base: null, status: "failed" });
      }
    }

    resolve();
    return () => { cancelled = true; };
  }, [candidates, healthPath]);

  return state;
}

function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

function createMessage(role, text, options = {}) {
  return {
    role,
    content: text,
    timestamp: Date.now(),
    ...options
  };
}

function mapConversasParaMensagens(lista = []) {
  return lista.map(conversa => {
    if (conversa.role === 'user') {
      return createMessage('user', conversa.content, { 
        timestamp: conversa.timestamp,
        attachments: conversa.attachments 
      });
    } else if (conversa.role === 'assistant') {
      return createMessage('assistant', conversa.content, { 
        timestamp: conversa.timestamp,
        thinking: conversa.thinking,
        mudancas: conversa.mudancas 
      });
    }
    return conversa;
  });
}

function extractFileFromDescription(descricao) {
  const match = descricao.match(/arquivo:\s*(.+)/i);
  return match ? match[1].trim() : null;
}

function formatTimestamp(timestamp) {
  if (!timestamp) return '';
  
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'agora';
  if (diffMins < 60) return `${diffMins}min atrás`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h atrás`;
  return date.toLocaleDateString();
}

export default function App() {
  const { base: agenteUrl, status: agenteStatus } = useEndpointResolver(AGENTE_CANDIDATES, "/saude");

  const [repo, setRepo] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [caminhoLocal, setCaminhoLocal] = useState("");
  const [branchBase, setBranchBase] = useState("main");
  const [projetoSemRepo, setProjetoSemRepo] = useState(false);
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [mostrarLandingForcado, setMostrarLandingForcado] = useState(true);

  const [arvore, setArvore] = useState([]);
  const [abas, setAbas] = useState([]);
  const [abaAtiva, setAbaAtiva] = useState(null);
  
  const [chatSessions, setChatSessions] = useState(() => {
    const saved = localStorage.getItem('chatSessions');
    return saved ? JSON.parse(saved) : [{
      id: 1,
      name: 'Conversa Principal',
      messages: [],
      createdAt: Date.now()
    }];
  });
  const [activeChatId, setActiveChatId] = useState(1);
  const [chatMessages, setChatMessages] = useState([]);
  const [entradaChat, setEntradaChat] = useState("");
  const [expandedHistory, setExpandedHistory] = useState({});
  const [explorerColapsado, setExplorerColapsado] = useState(false);
  const [chatColapsado, setChatColapsado] = useState(false);
  const [sidebarColapsada, setSidebarColapsada] = useState(false);
  const [tema, setTema] = useState(() => {
    return localStorage.getItem('tema') || 'dark';
  });
  const [diretoriosAbertos, setDiretoriosAbertos] = useState({});
  const [projetoAtual, setProjetoAtual] = useState(null);
  const [arvoreAtual, setArvoreAtual] = useState([]);
  const [historicoAtual, setHistoricoAtual] = useState([]);
  const [mudancasPendentes, setMudancasPendentes] = useState([]);
  const [mostrarMudancas, setMostrarMudancas] = useState(false);
  const [historico, setHistorico] = useState([]);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState("editor");
  const [chatWidth, setChatWidth] = useState(720);
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
  const [executarProvisionamento, setExecutarProvisionamento] = useState(false);
  const [progressoProvisionamento, setProgressoProvisionamento] = useState(null);
  const [projetos, setProjetos] = useState([]);

  const requireAgentReady = useCallback(() => {
    if (agenteStatus !== "ready") {
      setErro("Agente não está conectado. Verifique a conexão.");
      return false;
    }
    if (!agenteUrl) {
      setErro("URL do agente não está disponível.");
      return false;
    }
    return true;
  }, [agenteStatus, agenteUrl]);

  const runWithLoading = useCallback(async (message, task) => {
    setLoading(true);
    setLoadingMessage(message);
    try {
      await task();
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  }, []);

  // Aplicar tema
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', tema);
    localStorage.setItem('tema', tema);
  }, [tema]);

  const toggleTema = () => {
    setTema(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const erroVisivel = useMemo(() => {
    if (erro) return erro;
    
    if (projetoSemRepo) {
      return "Este projeto não possui repositório Git configurado. Algumas funcionalidades podem estar limitadas.";
    }
    
    if (agenteStatus === "failed") {
      return "Não foi possível conectar ao agente. Verifique se o serviço está rodando.";
    }
    
    return null;
  }, [erro, projetoSemRepo, agenteStatus]);

  const carregarMudancasPendentes = useCallback(async () => {
    if (!requireAgentReady() || !projetoAtual?.id) return;
    
    try {
      const response = await fetch(buildUrl(agenteUrl, `/mudancas-pendentes/${projetoAtual.id}`));
      const data = await parseJsonResponse(response, "Erro ao carregar mudanças pendentes");
      if (data.success) {
        setMudancasPendentes(data.mudancas || []);
      }
    } catch (error) {
      console.error("Erro ao carregar mudanças pendentes:", error);
    }
  }, [agenteUrl, requireAgentReady, projetoAtual]);

  const carregarHistorico = useCallback(async () => {
    if (!requireAgentReady() || !projetoAtual?.id) return;
    
    try {
      const response = await fetch(buildUrl(agenteUrl, `/historico/${projetoAtual.id}`));
      const data = await parseJsonResponse(response, "Erro ao carregar histórico");
      if (data.success) {
        setHistoricoAtual(data.historico || []);
      }
    } catch (error) {
      console.error("Erro ao carregar histórico:", error);
    }
  }, [agenteUrl, requireAgentReady, projetoAtual]);

  async function abrir_repo() {
    if (!requireAgentReady()) return;

    await runWithLoading("Abrindo repositório...", async () => {
      try {
        const response = await fetch(buildUrl(agenteUrl, "/repo/abrir"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            repo: repo.trim(), 
            repoUrl: repoUrl.trim(),
            caminhoLocal: caminhoLocal.trim(),
            branchBase: branchBase.trim() || "main"
          }),
        });

        const data = await parseJsonResponse(response, "Erro ao abrir repositório");
        
        if (data.success) {
          setProjetoAtual(data.projeto);
          setArvoreAtual(data.arvore || []);
          setMostrarLandingForcado(false);
          setErro("");
        } else {
          setErro(data.message || "Erro desconhecido ao abrir repositório");
        }
      } catch (error) {
        setErro("Erro de conexão ao tentar abrir repositório");
      }
    });
  }

  async function abrirRepoDireto(url) {
    setRepoUrl(url);
    setRepo("");
    setCaminhoLocal("");
    await abrir_repo();
  }

  async function abrirProjetoExistente(projeto) {
    if (!requireAgentReady()) return;

    await runWithLoading("Carregando projeto...", async () => {
      try {
        const response = await fetch(buildUrl(agenteUrl, `/projeto/${projeto.id}`));
        const data = await parseJsonResponse(response, "Erro ao carregar projeto");
        
        if (data.success) {
          setProjetoAtual(data.projeto);
          setArvoreAtual(data.arvore || []);
          setMostrarLandingForcado(false);
          setErro("");
          
          // Carregar árvore de arquivos
          const treeResponse = await fetch(buildUrl(agenteUrl, `/repo/tree?projeto=${projeto.id}`));
          const treeData = await parseJsonResponse(treeResponse, "Erro ao carregar árvore de arquivos");
          if (treeData.success) {
            setArvore(treeData.arquivos || []);
          }
        } else {
          setErro(data.message || "Erro ao carregar projeto");
        }
      } catch (error) {
        setErro("Erro de conexão ao carregar projeto");
      }
    });
  }

  async function criarProjetoDoZero(promptInicial) {
    console.log("criarProjetoDoZero chamada com:", promptInicial);
    console.log("agenteStatus:", agenteStatus);
    console.log("agenteUrl:", agenteUrl);
    
    if (!requireAgentReady()) {
      console.log("requireAgentReady retornou false");
      return;
    }

    await runWithLoading("Criando projeto...", async () => {
      try {
        console.log("Enviando requisição para criar projeto...");
        const response = await fetch(buildUrl(agenteUrl, "/projeto/criar"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            nome: `Projeto ${Date.now()}`,
            descricao: promptInicial || "Projeto criado do zero"
          }),
        });

        console.log("Resposta recebida:", response.status);
        const data = await parseJsonResponse(response, "Erro ao criar projeto");
        console.log("Dados da resposta:", data);
        
        if (data.success) {
          setProjetoAtual(data.projeto);
          setArvoreAtual(data.arvore || []);
          setMostrarLandingForcado(false);
          setErro("");
          
          // Se há prompt inicial, enviar para o chat
          if (promptInicial) {
            console.log("Enviando prompt inicial para o chat:", promptInicial);
            setEntradaChat(promptInicial);
            await enviar_chat(promptInicial);
          }
        } else {
          console.log("Erro na resposta:", data.message);
          setErro(data.message || "Erro ao criar projeto");
        }
      } catch (error) {
        console.error("Erro ao criar projeto:", error);
        setErro("Erro de conexão ao criar projeto");
      }
    });
  }

  async function abrir_arquivo(p) {
    if (!requireAgentReady() || !projetoAtual?.id) return;

    try {
      const response = await fetch(buildUrl(agenteUrl, `/repo/file?projeto=${projetoAtual.id}&arquivo=${encodeURIComponent(p)}`));
      const data = await parseJsonResponse(response, "Erro ao abrir arquivo");
      
      if (data.success) {
        const novaAba = {
          id: Date.now(),
          path: p,
          conteudo: data.conteudo || "",
          dirty: false
        };
        
        setAbas(prev => {
          const existente = prev.find(aba => aba.path === p);
          if (existente) {
            setAbaAtiva(existente.id);
            return prev;
          }
          const novasAbas = [...prev, novaAba];
          setAbaAtiva(novaAba.id);
          return novasAbas;
        });
      } else {
        setErro(data.message || "Erro ao abrir arquivo");
      }
    } catch (error) {
      setErro("Erro de conexão ao abrir arquivo");
    }
  }

  function fecharAba(abaId, e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    setAbas(prev => {
      const novasAbas = prev.filter(aba => aba.id !== abaId);
      
      if (abaAtiva === abaId) {
        if (novasAbas.length > 0) {
          const index = prev.findIndex(aba => aba.id === abaId);
          const proximaAba = novasAbas[Math.min(index, novasAbas.length - 1)];
          setAbaAtiva(proximaAba.id);
        } else {
          setAbaAtiva(null);
        }
      }
      
      return novasAbas;
    });
  }

  function atualizarConteudoAba(conteudoNovo) {
    if (!abaAtiva) return;
    
    setAbas(prev => prev.map(aba => 
      aba.id === abaAtiva 
        ? { ...aba, conteudo: conteudoNovo, dirty: true }
        : aba
    ));
  }

  async function persistirArquivo() {
    if (!requireAgentReady() || !projetoAtual?.id || !abaAtiva) return;

    const aba = abas.find(a => a.id === abaAtiva);
    if (!aba) return;

    try {
      const response = await fetch(buildUrl(agenteUrl, "/repo/save"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projeto: projetoAtual.id,
          arquivo: aba.path,
          conteudo: aba.conteudo
        }),
      });

      const data = await parseJsonResponse(response, "Erro ao salvar arquivo");
      
      if (data.success) {
        setAbas(prev => prev.map(a => 
          a.id === abaAtiva ? { ...a, dirty: false } : a
        ));
        setErro("");
      } else {
        setErro(data.message || "Erro ao salvar arquivo");
      }
    } catch (error) {
      setErro("Erro de conexão ao salvar arquivo");
    }
  }

  async function restaurarCodigo(caminhoArquivo, conteudo) {
    if (!requireAgentReady() || !projetoAtual?.id) return;

    try {
      const response = await fetch(buildUrl(agenteUrl, "/repo/save"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projeto: projetoAtual.id,
          arquivo: caminhoArquivo,
          conteudo: conteudo
        }),
      });

      const data = await parseJsonResponse(response, "Erro ao restaurar código");
      
      if (data.success) {
        // Atualizar aba se estiver aberta
        setAbas(prev => prev.map(aba => 
          aba.path === caminhoArquivo 
            ? { ...aba, conteudo: conteudo, dirty: false }
            : aba
        ));
        setErro("");
      } else {
        setErro(data.message || "Erro ao restaurar código");
      }
    } catch (error) {
      setErro("Erro de conexão ao restaurar código");
    }
  }

  async function commit_push() {
    if (!requireAgentReady() || !projetoAtual?.id) return;

    await runWithLoading("Fazendo commit e push...", async () => {
      try {
        const response = await fetch(buildUrl(agenteUrl, "/repo/commit"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projeto: projetoAtual.id,
            mensagem: "Alterações via Agente IA"
          }),
        });

        const data = await parseJsonResponse(response, "Erro ao fazer commit");
        
        if (data.success) {
          setErro("");
          await carregarHistorico();
        } else {
          setErro(data.message || "Erro ao fazer commit");
        }
      } catch (error) {
        setErro("Erro de conexão ao fazer commit");
      }
    });
  }

  async function enviar_chat(texto) {
    if (!requireAgentReady() || !projetoAtual?.id) return;

    const mensagemUsuario = createMessage('user', texto, { attachments: [] });
    
    setChatMessages(prev => [...prev, mensagemUsuario]);
    setEntradaChat("");
    setLoading(true);

    try {
      await enviarChatComStreaming(
        texto,
        buildUrl(agenteUrl, "/chat/stream"),
        (conteudo) => {
          // onEtapa - adiciona conteúdo à mensagem do assistente
          setChatMessages(prev => {
            const lastMessage = prev[prev.length - 1];
            if (lastMessage && lastMessage.role === 'assistant') {
              return prev.slice(0, -1).concat([{
                ...lastMessage,
                content: lastMessage.content + conteudo
              }]);
            } else {
              return prev.concat([createMessage('assistant', conteudo)]);
            }
          });
        },
        (data) => {
          // onCompleto
          setLoading(false);
          carregarMudancasPendentes();
        },
        (mensagemErro) => {
          // onErro
          setErro(mensagemErro);
          setLoading(false);
        },
        (pensamento) => {
          // onPensamento - pode ser usado para mostrar o que o agente está pensando
          console.log("Pensamento do agente:", pensamento);
        }
      );
    } catch (error) {
      setErro("Erro ao enviar mensagem para o chat");
      setLoading(false);
    }
  }

  // Salvar sessões de chat no localStorage
  useEffect(() => {
    localStorage.setItem('chatSessions', JSON.stringify(chatSessions));
  }, [chatSessions]);

  // Carregar mensagens da sessão ativa
  useEffect(() => {
    const activeSession = chatSessions.find(s => s.id === activeChatId);
    if (activeSession) {
      setChatMessages(mapConversasParaMensagens(activeSession.messages));
    } else {
      setChatMessages([]);
    }
  }, [activeChatId, chatSessions]);

  const mostrarLanding = mostrarLandingForcado || !projetoAtual?.id;

  // Carregar projetos na inicialização
  useEffect(() => {
    if (agenteStatus === "ready" && agenteUrl) {
      fetch(buildUrl(agenteUrl, "/projetos"))
        .then(response => parseJsonResponse(response, "Erro ao carregar projetos"))
        .then(data => {
          if (data.success) {
            setProjetos(data.projetos || []);
          }
        })
        .catch(error => {
          console.error("Erro ao carregar projetos:", error);
        });
    }
  }, [agenteStatus, agenteUrl]);

  function criarNovoChat() {
    const novoId = Math.max(...chatSessions.map(s => s.id)) + 1;
    const novaSession = {
      id: novoId,
      name: `Conversa ${novoId}`,
      messages: [],
      createdAt: Date.now()
    };
    
    setChatSessions(prev => [...prev, novaSession]);
    setActiveChatId(novoId);
  }

  function renomearChat(chatId, novoNome) {
    setChatSessions(prev => prev.map(session => 
      session.id === chatId ? { ...session, name: novoNome } : session
    ));
  }

  function deletarChat(chatId) {
    if (chatSessions.length <= 1) return; // Manter pelo menos uma sessão
    
    setChatSessions(prev => {
      const novasSessions = prev.filter(s => s.id !== chatId);
      if (activeChatId === chatId) {
        setActiveChatId(novasSessions[0].id);
      }
      return novasSessions;
    });
  }

  function voltarParaInicio() {
    setMostrarLandingForcado(true);
    setProjetoAtual(null);
    setArvoreAtual([]);
    setAbas([]);
    setAbaAtiva(null);
  }

  async function deletarProjetoFrontend(p) {
    if (!requireAgentReady()) return;

    try {
      const response = await fetch(buildUrl(agenteUrl, `/projeto/${p.id}`), {
        method: "DELETE"
      });

      const data = await parseJsonResponse(response, "Erro ao deletar projeto");
      
      if (data.success) {
        setProjetos(prev => prev.filter(projeto => projeto.id !== p.id));
        if (projetoAtual?.id === p.id) {
          voltarParaInicio();
        }
      } else {
        setErro(data.message || "Erro ao deletar projeto");
      }
    } catch (error) {
      setErro("Erro de conexão ao deletar projeto");
    }
  }

  // Preparar dados para o VSCodeLayout
  const arquivos = useMemo(() => buildTree(arvore), [arvore]);
  const abaAtual = abas.find(aba => aba.id === abaAtiva);
  const arquivoAtual = abaAtual?.path || null;
  const conteudoArquivo = abaAtual?.conteudo || "";
  const conversas = chatMessages;

  const selecionarArquivo = useCallback((caminho) => {
    abrir_arquivo(caminho);
  }, []);

  const salvarArquivo = useCallback((caminho, conteudo) => {
    // Atualizar conteúdo da aba e marcar como dirty
    setAbas(prev => prev.map(aba => 
      aba.path === caminho 
        ? { ...aba, conteudo, dirty: true }
        : aba
    ));
    
    // Salvar automaticamente
    persistirArquivo();
  }, []);

  const criarArquivo = useCallback(async (caminho) => {
    if (!requireAgentReady() || !projetoAtual?.id) return;

    try {
      const response = await fetch(buildUrl(agenteUrl, "/repo/save"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projeto: projetoAtual.id,
          arquivo: caminho,
          conteudo: ""
        }),
      });

      const data = await parseJsonResponse(response, "Erro ao criar arquivo");
      
      if (data.success) {
        // Recarregar árvore de arquivos
        const treeResponse = await fetch(buildUrl(agenteUrl, `/repo/tree?projeto=${projetoAtual.id}`));
        const treeData = await parseJsonResponse(treeResponse, "Erro ao carregar árvore");
        if (treeData.success) {
          setArvore(treeData.arquivos || []);
        }
        
        // Abrir o arquivo criado
        abrir_arquivo(caminho);
      } else {
        setErro(data.message || "Erro ao criar arquivo");
      }
    } catch (error) {
      setErro("Erro de conexão ao criar arquivo");
    }
  }, [requireAgentReady, projetoAtual, agenteUrl]);

  const criarPasta = useCallback(async (caminho) => {
    // Implementar criação de pasta se necessário
    console.log("Criar pasta:", caminho);
  }, []);

  const renomearArquivo = useCallback(async (caminhoAntigo, caminhoNovo) => {
    // Implementar renomeação se necessário
    console.log("Renomear arquivo:", caminhoAntigo, "para", caminhoNovo);
  }, []);

  const downloadArquivo = useCallback(async (caminho) => {
    if (!requireAgentReady() || !projetoAtual?.id) return;

    try {
      const response = await fetch(buildUrl(agenteUrl, `/repo/file?projeto=${projetoAtual.id}&arquivo=${encodeURIComponent(caminho)}`));
      const data = await parseJsonResponse(response, "Erro ao baixar arquivo");
      
      if (data.success) {
        const blob = new Blob([data.conteudo], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = caminho.split('/').pop();
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        setErro(data.message || "Erro ao baixar arquivo");
      }
    } catch (error) {
      setErro("Erro de conexão ao baixar arquivo");
    }
  }, [requireAgentReady, projetoAtual, agenteUrl]);

  const enviarMensagem = useCallback((mensagem) => {
    enviar_chat(mensagem);
  }, []);

  if (mostrarLanding) {
    return (
      <Landing
        onImportarGitHub={abrirRepoDireto}
        onCriarDoZero={criarProjetoDoZero}
        agenteStatus={agenteStatus}
        projetos={projetos}
        onAbrirProjeto={abrirProjetoExistente}
        onDeletarProjeto={deletarProjetoFrontend}
      />
    );
  }

  return (
    <VSCodeLayout
      currentProject={projetoAtual}
      fileTree={arquivos}
      openTabs={abas}
      activeTab={abaAtiva}
      fileContents={conteudoArquivo}
      chatMessages={conversas}
      isLoading={loading}
      theme={tema}
      onOpenFolder={voltarParaInicio}
      onCreateProject={criarProjetoDoZero}
      onCloneRepository={abrirRepoDireto}
      onFileSelect={selecionarArquivo}
      onFileChange={atualizarConteudoAba}
      onTabClose={fecharAba}
      onTabSwitch={setAbaAtiva}
      onSendMessage={enviarMensagem}
      onThemeToggle={toggleTema}
    />
  );
}
