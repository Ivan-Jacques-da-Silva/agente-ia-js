import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Landing from './landing.jsx';
import VSCodeLayout from './components/VSCodeLayout.jsx';

export default function Router({ 
  // Props para Landing
  onImportarGitHub,
  onCriarDoZero,
  agenteStatus,
  projetos,
  onAbrirProjeto,
  onDeletarProjeto,
  
  // Props para VSCodeLayout
  projeto,
  arquivos,
  arquivoAtual,
  conteudoArquivo,
  onSelecionarArquivo,
  onSalvarArquivo,
  onCriarArquivo,
  onCriarPasta,
  onRenomearArquivo,
  onDownloadArquivo,
  onAbrirPasta,
  tema,
  onToggleTema,
  conversas,
  mensagemAtual,
  onEnviarMensagem,
  onSetMensagemAtual,
  loading,
  mudancasPendentes,
  onCommitPush,
  abas,
  abaAtiva,
  onSelecionarAba,
  onFecharAba,
  onAtualizarConteudo
}) {
  return (
    <Routes>
      <Route 
        path="/" 
        element={
          <Landing 
            onImportarGitHub={onImportarGitHub}
            onCriarDoZero={onCriarDoZero}
            agenteStatus={agenteStatus}
            projetos={projetos}
            onAbrirProjeto={onAbrirProjeto}
            onDeletarProjeto={onDeletarProjeto}
          />
        } 
      />
      <Route 
        path="/projeto/:id" 
        element={
          projeto ? (
            <VSCodeLayout
              projeto={projeto}
              arquivos={arquivos}
              arquivoAtual={arquivoAtual}
              conteudoArquivo={conteudoArquivo}
              onSelecionarArquivo={onSelecionarArquivo}
              onSalvarArquivo={onSalvarArquivo}
              onCriarArquivo={onCriarArquivo}
              onCriarPasta={onCriarPasta}
              onRenomearArquivo={onRenomearArquivo}
              onDownloadArquivo={onDownloadArquivo}
              onAbrirPasta={onAbrirPasta}
              tema={tema}
              onToggleTema={onToggleTema}
              conversas={conversas}
              mensagemAtual={mensagemAtual}
              onEnviarMensagem={onEnviarMensagem}
              onSetMensagemAtual={onSetMensagemAtual}
              loading={loading}
              mudancasPendentes={mudancasPendentes}
              onCommitPush={onCommitPush}
              abas={abas}
              abaAtiva={abaAtiva}
              onSelecionarAba={onSelecionarAba}
              onFecharAba={onFecharAba}
              onAtualizarConteudo={onAtualizarConteudo}
            />
          ) : (
            <Navigate to="/" replace />
          )
        } 
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}