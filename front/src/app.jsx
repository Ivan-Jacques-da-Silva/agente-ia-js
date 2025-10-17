import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Router from "./Router.jsx";
import { enviarChatComStreaming } from "./chat-utils.js";
import { ProjectCreationModal } from './components/ProjectCreationModal';
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
        const isDirectory = index < parts.length - 1 || item.endsWith('/');
        current[part] = {
          name: part,
          path: parts.slice(0, index + 1).join('/'),
          type: isDirectory ? 'folder' : 'file',
          children: {}
        };
      }
      current = current[part].children;
    });
  });
  
  function convertToArray(obj) {
    return Object.values(obj).map(item => ({
      ...item,
      children: item.type === 'folder' ? convertToArray(item.children) : undefined
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
  const navigate = useNavigate();
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
  const [showProjectCreationModal, setShowProjectCreationModal] = useState(false);
  const [projectCreationName, setProjectCreationName] = useState('');
  
  // Estados para construção progressiva
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildData, setBuildData] = useState(null);

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

  async function clonarRepositorioGitHub() {
    const url = prompt('Digite a URL do repositório GitHub:');
    if (!url) return;
    
    // Validar URL do GitHub
    const githubUrlPattern = /^https:\/\/github\.com\/[\w\-\.]+\/[\w\-\.]+(?:\.git)?$/;
    if (!githubUrlPattern.test(url.trim())) {
      alert('Por favor, digite uma URL válida do GitHub (ex: https://github.com/usuario/repositorio)');
      return;
    }
    
    await abrirRepoDireto(url);
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
          
          // Navegar para a tela do projeto
          navigate(`/projeto/${projeto.id}`);
          
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
    
    // Abrir o modal de criação de projeto
    setProjectCreationName(`Projeto ${Date.now()}`);
    setShowProjectCreationModal(true);
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
    console.log("enviar_chat chamado com:", texto);
    if (!requireAgentReady()) return;

    // Detectar comandos que devem ativar o agente autônomo
    const comandosAgenticos = [
      'crie uma lp',
      'crie uma landing page',
      'criar landing page',
      'criar lp',
      'gerar landing page',
      'fazer uma lp',
      'construir landing page',
      'desenvolver aplicação',
      'criar aplicativo',
      'fazer um site',
      'construir sistema',
      'desenvolver projeto'
    ];
    
    const deveUsarAgente = comandosAgenticos.some(cmd => 
      texto.toLowerCase().includes(cmd)
    );

    console.log("Deve usar agente:", deveUsarAgente);

    if (deveUsarAgente) {
      // Se não há projeto aberto, criar um novo automaticamente
      if (!projetoAtual?.id) {
        try {
          console.log("Criando novo projeto automaticamente...");
          setLoading(true);
          setLoadingMessage("Criando novo projeto...");
          
          const response = await fetch(buildUrl(agenteUrl, "/projeto/criar"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              nome: `Projeto ${Date.now()}`,
              descricao: texto
            })
          });
          
          const data = await parseJsonResponse(response, "Erro ao criar projeto");
          console.log("Resposta da criação do projeto:", data);
          
          if (data.success) {
            // Navegar para o novo projeto na interface agentic
            console.log("Navegando para:", `/agentic/${data.projeto.id}`);
            navigate(`/agentic/${data.projeto.id}`);
            return;
          } else {
            setErro("Erro ao criar projeto automaticamente");
            setLoading(false);
            return;
          }
        } catch (error) {
          console.error("Erro ao criar projeto:", error);
          setErro("Erro ao criar projeto: " + error.message);
          setLoading(false);
          return;
        }
      } else {
        // Ir direto para interface agentic com projeto existente
        console.log("Navegando para projeto existente:", `/agentic/${projetoAtual.id}`);
        navigate(`/agentic/${projetoAtual.id}`);
        return;
      }
    }

    // Para chat normal, ainda precisa de projeto aberto
    if (!projetoAtual?.id) {
      setErro("Abra um projeto ou use comandos como 'criar uma landing page' para começar");
      return;
    }

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
          
          // Se a resposta contém perguntas, adicionar mensagem especial
          if (data.needsQuestions) {
            setChatMessages(prev => {
              const lastMessage = prev[prev.length - 1];
              if (lastMessage && lastMessage.role === 'assistant') {
                return prev.slice(0, -1).concat([{
                  ...lastMessage,
                  needsQuestions: true
                }]);
              }
              return prev;
            });
          }
        },
        (mensagemErro) => {
          // onErro
          setErro(mensagemErro);
          setLoading(false);
        },
        (pensamento) => {
          // onPensamento - pode ser usado para mostrar o que o agente está pensando
          console.log("Pensamento do agente:", pensamento);
          
          // Adicionar pensamento como uma mensagem especial no chat
          setChatMessages(prev => {
            const lastMessage = prev[prev.length - 1];
            if (lastMessage && lastMessage.role === 'assistant' && lastMessage.isThinking) {
              // Atualizar pensamento existente
              return prev.slice(0, -1).concat([{
                ...lastMessage,
                content: pensamento.text,
                status: pensamento.status,
                details: pensamento.details || []
              }]);
            } else {
              // Criar nova mensagem de pensamento
              return prev.concat([{
                role: 'assistant',
                content: pensamento.text,
                timestamp: Date.now(),
                isThinking: true,
                status: pensamento.status,
                details: pensamento.details || []
              }]);
            }
          });
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

  async function abrirPastaLocal(folderData = null) {
    try {
      let projeto, files;
      
      if (folderData) {
        // Dados vindos do FolderPicker
        files = Object.keys(folderData.structure).map(name => {
          const item = folderData.structure[name];
          return item.type === 'directory' ? `${name}/` : name;
        });
        
        // Função recursiva para extrair todos os arquivos da estrutura
        function extractFiles(structure, basePath = '') {
          const result = [];
          Object.entries(structure).forEach(([name, item]) => {
            const fullPath = basePath ? `${basePath}/${name}` : name;
            if (item.type === 'directory') {
              result.push(`${fullPath}/`);
              if (item.children) {
                result.push(...extractFiles(item.children, fullPath));
              }
            } else {
              result.push(fullPath);
            }
          });
          return result;
        }
        
        files = extractFiles(folderData.structure);
        
        projeto = {
          id: `local_${Date.now()}`,
          name: folderData.name,
          type: 'local',
          path: folderData.path,
          folderData: folderData
        };
      } else {
        // Verificar se a API File System Access está disponível
        if (!window.showDirectoryPicker) {
          alert('Seu navegador não suporta a seleção de pastas. Use Chrome/Edge mais recente.');
          return;
        }

        // Abrir o seletor de pasta
        const directoryHandle = await window.showDirectoryPicker();
        
        // Ler o conteúdo da pasta
        files = [];
        
        async function readDirectory(dirHandle, path = '') {
          for await (const [name, handle] of dirHandle.entries()) {
            const fullPath = path ? `${path}/${name}` : name;
            
            if (handle.kind === 'file') {
              files.push(fullPath);
            } else if (handle.kind === 'directory') {
              files.push(`${fullPath}/`);
              await readDirectory(handle, fullPath);
            }
          }
        }
        
        await readDirectory(directoryHandle);
        
        projeto = {
          id: `local_${Date.now()}`,
          name: directoryHandle.name,
          type: 'local',
          path: directoryHandle.name,
          directoryHandle: directoryHandle
        };
      }
      
      // Atualizar o estado
      setProjetoAtual(projeto);
      setArvoreAtual(buildTree(files));
      setProjetos(prev => {
        const filtered = prev.filter(p => p.type !== 'local' || p.name !== projeto.name);
        return [...filtered, projeto];
      });
      setMostrarLandingForcado(false);
      
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Erro ao abrir pasta:', error);
        setErro('Erro ao abrir pasta local');
      }
    }
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
    console.log("enviarMensagem chamado com:", mensagem);
    enviar_chat(mensagem);
  }, []);

  const handleCloseAgentic = useCallback(() => {
    // Voltar para a página do projeto
    if (projetoAtual?.id) {
      navigate(`/projeto/${projetoAtual.id}`);
    } else {
      navigate('/');
    }
  }, [navigate, projetoAtual]);

  return (
    <>
      <Router
        // Props para Landing
        onImportarGitHub={clonarRepositorioGitHub}
        onCriarDoZero={criarProjetoDoZero}
        agenteStatus={agenteStatus}
        projetos={projetos}
        onAbrirProjeto={abrirProjetoExistente}
        onDeletarProjeto={deletarProjetoFrontend}
        
        // Props para AgenticInterface
        onCloseAgentic={handleCloseAgentic}
        
        // Props para VSCodeLayout
        projeto={projetoAtual}
        arquivos={arquivos}
        arquivoAtual={arquivoAtual}
        conteudoArquivo={conteudoArquivo}
        onSelecionarArquivo={selecionarArquivo}
        onSalvarArquivo={salvarArquivo}
        onCriarArquivo={criarArquivo}
        onCriarPasta={criarPasta}
        onRenomearArquivo={renomearArquivo}
        onDownloadArquivo={downloadArquivo}
        onAbrirPasta={abrirPastaLocal}
        tema={tema}
        onToggleTema={toggleTema}
        conversas={conversas}
        mensagemAtual={entradaChat}
        onEnviarMensagem={enviarMensagem}
        onSetMensagemAtual={setEntradaChat}
        loading={loading}
        mudancasPendentes={mudancasPendentes}
        onCommitPush={commit_push}
        abas={abas}
        abaAtiva={abaAtiva}
        onSelecionarAba={setAbaAtiva}
        onFecharAba={fecharAba}
        onAtualizarConteudo={atualizarConteudoAba}
        isBuilding={isBuilding}
        buildData={buildData}
        onBuildComplete={() => {
          setIsBuilding(false);
          setBuildData(null);
        }}
      />
      
      <ProjectCreationModal
        isOpen={showProjectCreationModal}
        onClose={() => setShowProjectCreationModal(false)}
        projectName={projectCreationName}
        onComplete={(projeto) => {
          setShowProjectCreationModal(false);
          setProjetoAtual(projeto);
          setArvoreAtual(projeto.arvore || []);
          setMostrarLandingForcado(false);
          setErro("");
          navigate(`/projeto/${projeto.id}`);
        }}
      />
    </>
  );
}
