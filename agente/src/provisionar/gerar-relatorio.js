import path from "node:path";
import fs from "node:fs/promises";

export async function gerarRelatorio(pasta, dados) {
  const {
    diagnostico,
    stack,
    ambiente,
    compose,
    servicos,
    simulacao,
    tempoTotal,
    erros = []
  } = dados;
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const relatorioPath = path.join(pasta, "relatorios", `relatorio-${timestamp}.json`);
  
  // Montar checklist
  const checklist = {
    analise_concluida: !!diagnostico,
    stack_detectada: !!stack,
    ambiente_preparado: !!ambiente,
    compose_gerado: !!compose,
    servicos_subidos: servicos?.subiu || false,
    simulacao_executada: simulacao?.sucesso || false,
    video_gravado: !!simulacao?.video
  };
  
  // Resumo dos serviços
  const resumoServicos = servicos?.servicos?.map(s => ({
    nome: s.nome,
    status: s.status,
    saude: s.saude
  })) || [];
  
  // URLs geradas
  const urls = {
    frontend: stack?.urlFront || null,
    backend: stack?.portas?.portaBack ? `http://localhost:${stack.portas.portaBack}` : null,
    db: stack?.portas?.portaDb ? `localhost:${stack.portas.portaDb}` : null
  };
  
  // Artefatos gerados
  const artefatos = {
    compose: compose?.arquivo || null,
    env: ambiente?.envCriado ? ".env" : null,
    pastas: ambiente?.pastasCriadas || [],
    video: simulacao?.video || null,
    screenshots: simulacao?.screenshots || []
  };
  
  // Relatório completo
  const relatorio = {
    timestamp,
    resumo: {
      projeto: path.basename(pasta),
      stack_detectada: {
        frontend: stack?.tipoFront || "não detectado",
        backend: stack?.tipoBack || "não detectado",
        banco_dados: stack?.bancoDados || "não detectado"
      },
      tempo_total_segundos: tempoTotal,
      erros_encontrados: erros.length,
      status_geral: erros.length === 0 ? "sucesso" : "parcial"
    },
    checklist,
    diagnostico: {
      arquivos_analisados: diagnostico?.arquivos?.length || 0,
      indicadores: diagnostico?.indicadores || {}
    },
    stack,
    ambiente,
    compose: {
      arquivo: compose?.arquivo,
      servicos: compose?.servicos || [],
      conflito_detectado: compose?.conflito || false
    },
    servicos: {
      subidos: servicos?.subiu || false,
      lista: resumoServicos,
      logs_iniciais: servicos?.logs?.slice(0, 10) || []
    },
    simulacao: {
      executada: simulacao?.sucesso || false,
      passos: simulacao?.passos || [],
      video: simulacao?.video,
      screenshots: simulacao?.screenshots || [],
      erro: simulacao?.erro
    },
    urls,
    artefatos,
    erros
  };
  
  // Salvar relatório
  await fs.writeFile(relatorioPath, JSON.stringify(relatorio, null, 2), "utf8");
  
  return {
    caminho: relatorioPath,
    relatorio
  };
}
