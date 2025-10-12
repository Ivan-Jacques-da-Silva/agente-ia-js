import { analisarRepositorio } from "./analisar-repo.js";
import { detectarStack } from "./detectar-stack.js";
import { prepararAmbiente } from "./preparar-ambiente.js";
import { gerarCompose } from "./gerar-compose.js";
import { subirServicos } from "./subir-servicos.js";
import { simularInterface } from "./simular-interface.js";
import { gerarRelatorio } from "./gerar-relatorio.js";
import path from "node:path";

export async function executarProvisionamento(pasta, opcoes = {}, callbackProgresso = null) {
  const {
    cenarioPath = null,
    timeoutEtapa = 120000,
    tentarReaproveitarCompose = true
  } = opcoes;
  
  const inicio = Date.now();
  const erros = [];
  const dados = {};
  
  // Função auxiliar para reportar progresso
  const reportar = (etapa, status, detalhes = {}) => {
    if (callbackProgresso) {
      callbackProgresso({ etapa, status, detalhes, timestamp: new Date().toISOString() });
    }
  };
  
  try {
    // Etapa 1: Analisar repositório
    reportar("analisar", "iniciando");
    try {
      dados.diagnostico = await analisarRepositorio(pasta);
      reportar("analisar", "concluido", { 
        arquivos: dados.diagnostico.arquivos.length,
        indicadores: dados.diagnostico.indicadores 
      });
    } catch (e) {
      erros.push({ etapa: "analisar", erro: String(e.message) });
      reportar("analisar", "falhou", { erro: String(e.message) });
      throw e;
    }
    
    // Etapa 2: Detectar stack
    reportar("detectar", "iniciando");
    try {
      dados.stack = await detectarStack(dados.diagnostico, pasta);
      reportar("detectar", "concluido", { stack: dados.stack });
    } catch (e) {
      erros.push({ etapa: "detectar", erro: String(e.message) });
      reportar("detectar", "falhou", { erro: String(e.message) });
      throw e;
    }
    
    // Etapa 3: Preparar ambiente (.env, pastas)
    reportar("preparar", "iniciando");
    try {
      dados.ambiente = await prepararAmbiente(pasta, dados.stack);
      reportar("preparar", "concluido", { 
        envCriado: dados.ambiente.envCriado,
        pastas: dados.ambiente.pastasCriadas 
      });
    } catch (e) {
      erros.push({ etapa: "preparar", erro: String(e.message) });
      reportar("preparar", "falhou", { erro: String(e.message) });
      throw e;
    }
    
    // Etapa 4: Gerar compose
    reportar("compose", "iniciando");
    try {
      dados.compose = await gerarCompose(pasta, dados.stack, tentarReaproveitarCompose);
      reportar("compose", "concluido", { 
        arquivo: dados.compose.arquivo,
        servicos: dados.compose.servicos,
        conflito: dados.compose.conflito 
      });
    } catch (e) {
      erros.push({ etapa: "compose", erro: String(e.message) });
      reportar("compose", "falhou", { erro: String(e.message) });
      throw e;
    }
    
    // Etapa 5: Subir serviços
    reportar("subir", "iniciando");
    try {
      dados.servicos = await subirServicos(pasta, dados.compose.arquivo, timeoutEtapa);
      reportar("subir", "concluido", { 
        subiu: dados.servicos.subiu,
        servicos: dados.servicos.servicos 
      });
    } catch (e) {
      erros.push({ etapa: "subir", erro: String(e.message) });
      reportar("subir", "falhou", { erro: String(e.message) });
      // Não lança erro, continua para tentar simulação mesmo sem serviços
    }
    
    // Etapa 6: Simular interface
    reportar("simular", "iniciando");
    try {
      if (dados.stack.urlFront) {
        dados.simulacao = await simularInterface(
          dados.stack.urlFront, 
          pasta, 
          cenarioPath, 
          timeoutEtapa
        );
        reportar("simular", "concluido", { 
          sucesso: dados.simulacao.sucesso,
          video: dados.simulacao.video,
          passos: dados.simulacao.passos.length 
        });
      } else {
        dados.simulacao = { sucesso: false, erro: "URL do frontend não detectada" };
        reportar("simular", "pulado", { motivo: "Frontend não detectado" });
      }
    } catch (e) {
      erros.push({ etapa: "simular", erro: String(e.message) });
      reportar("simular", "falhou", { erro: String(e.message) });
      dados.simulacao = { sucesso: false, erro: String(e.message) };
    }
    
    // Etapa 7: Gerar relatório
    reportar("relatorio", "iniciando");
    try {
      const tempoTotal = Math.floor((Date.now() - inicio) / 1000);
      const resultado = await gerarRelatorio(pasta, {
        diagnostico: dados.diagnostico,
        stack: dados.stack,
        ambiente: dados.ambiente,
        compose: dados.compose,
        servicos: dados.servicos,
        simulacao: dados.simulacao,
        tempoTotal,
        erros
      });
      
      dados.relatorio = resultado;
      reportar("relatorio", "concluido", { 
        caminho: resultado.caminho,
        tempoTotal 
      });
      
    } catch (e) {
      erros.push({ etapa: "relatorio", erro: String(e.message) });
      reportar("relatorio", "falhou", { erro: String(e.message) });
      throw e;
    }
    
    // Finalizado
    reportar("finalizado", "sucesso", { 
      tempoTotal: Math.floor((Date.now() - inicio) / 1000),
      erros: erros.length,
      relatorio: dados.relatorio?.caminho
    });
    
    return {
      sucesso: true,
      dados,
      erros,
      tempoTotal: Math.floor((Date.now() - inicio) / 1000)
    };
    
  } catch (e) {
    reportar("finalizado", "falhou", { 
      erro: String(e.message),
      erros: erros.length 
    });
    
    return {
      sucesso: false,
      dados,
      erros,
      tempoTotal: Math.floor((Date.now() - inicio) / 1000),
      erro: String(e.message)
    };
  }
}
