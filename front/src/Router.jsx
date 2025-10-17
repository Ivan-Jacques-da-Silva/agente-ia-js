import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Landing from './landing.jsx';
import IDELayout from './components/IDELayout.jsx';
import AgenticInterface from './components/AgenticInterface.jsx';

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
  
  // Props para construção progressiva
  isBuilding,
  buildData,
  onBuildComplete,
  onEnviarMensagem,
  onSetMensagemAtual,
  loading,
  mudancasPendentes,
  onCommitPush,
  abas,
  abaAtiva,
  onSelecionarAba,
  onFecharAba,
  onAtualizarConteudo,
  
  // Props para interface agentic
  onCloseAgentic
}) {
  return (
    <Routes>
      <Route 
        path="/" 
        element={
          <IDELayout
            currentProject={projeto}
            fileTree={arquivos}
            openTabs={abas}
            activeTab={abaAtiva}
            fileContents={conteudoArquivo}
            chatMessages={conversas}
            isLoading={loading}
            theme={tema}
            projects={projetos}
            isBuilding={isBuilding}
            buildData={buildData}
            onOpenFolder={onAbrirPasta}
            onCreateProject={onCriarDoZero}
            onCloneRepository={onImportarGitHub}
            onDeleteProject={onDeletarProjeto}
            onFileSelect={onSelecionarArquivo}
            onFileChange={onSalvarArquivo}
            onTabClose={onFecharAba}
            onTabSwitch={onSelecionarAba}
            onSendMessage={onEnviarMensagem}
            onThemeToggle={onToggleTema}
            onBuildComplete={onBuildComplete}
            onCreateFile={onCriarArquivo}
            onCreateFolder={onCriarPasta}
            onDeleteFile={() => {}}
            onRenameFile={onRenomearArquivo}
          />
        } 
      />
      <Route 
        path="/landing" 
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
            <IDELayout
              currentProject={projeto}
              fileTree={arquivos}
              openTabs={abas}
              activeTab={abaAtiva}
              fileContents={conteudoArquivo}
              chatMessages={conversas}
              isLoading={loading}
              theme={tema}
              projects={projetos}
              isBuilding={isBuilding}
              buildData={buildData}
              onOpenFolder={onAbrirPasta}
              onCreateProject={onCriarDoZero}
              onCloneRepository={onImportarGitHub}
              onDeleteProject={onDeletarProjeto}
              onFileSelect={onSelecionarArquivo}
              onFileChange={onSalvarArquivo}
              onTabClose={onFecharAba}
              onTabSwitch={onSelecionarAba}
              onSendMessage={onEnviarMensagem}
              onThemeToggle={onToggleTema}
              onBuildComplete={onBuildComplete}
              onCreateFile={onCriarArquivo}
              onCreateFolder={onCriarPasta}
              onDeleteFile={() => {}}
              onRenameFile={onRenomearArquivo}
            />
          ) : (
            <Navigate to="/" replace />
          )
        } 
      />
      <Route 
        path="/agentic/:projectId" 
        element={
          <AgenticInterface
            projectId={window.location.pathname.split('/')[2]}
            onClose={onCloseAgentic}
          />
        } 
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}