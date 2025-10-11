import Database from "better-sqlite3";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

const DB_DIR = path.join(os.homedir(), ".agente-ia");
const DB_PATH = path.join(DB_DIR, "agente.db");

fs.mkdirSync(DB_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS projetos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    caminho_local TEXT,
    repositorio_url TEXT,
    branch_padrao TEXT DEFAULT 'main',
    ultimo_acesso DATETIME DEFAULT CURRENT_TIMESTAMP,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT
  );

  CREATE TABLE IF NOT EXISTS arquivos_contexto (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    projeto_id INTEGER NOT NULL,
    caminho TEXT NOT NULL,
    conteudo TEXT,
    hash TEXT,
    analise TEXT,
    atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (projeto_id) REFERENCES projetos(id) ON DELETE CASCADE,
    UNIQUE(projeto_id, caminho)
  );

  CREATE TABLE IF NOT EXISTS mudancas_pendentes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    projeto_id INTEGER NOT NULL,
    arquivo TEXT NOT NULL,
    conteudo_original TEXT,
    conteudo_novo TEXT,
    diff TEXT,
    descricao TEXT,
    status TEXT DEFAULT 'pendente',
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    aplicado_em DATETIME,
    FOREIGN KEY (projeto_id) REFERENCES projetos(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS historico (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    projeto_id INTEGER NOT NULL,
    tipo TEXT NOT NULL,
    descricao TEXT,
    dados TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (projeto_id) REFERENCES projetos(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS conversas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    projeto_id INTEGER NOT NULL,
    mensagem TEXT NOT NULL,
    resposta TEXT,
    contexto TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (projeto_id) REFERENCES projetos(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS versoes_arquivo (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    projeto_id INTEGER NOT NULL,
    mudanca_id INTEGER,
    arquivo TEXT NOT NULL,
    conteudo TEXT,
    descricao TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (projeto_id) REFERENCES projetos(id) ON DELETE CASCADE,
    FOREIGN KEY (mudanca_id) REFERENCES mudancas_pendentes(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_projetos_url ON projetos(repositorio_url);
  CREATE INDEX IF NOT EXISTS idx_arquivos_projeto ON arquivos_contexto(projeto_id);
  CREATE INDEX IF NOT EXISTS idx_mudancas_projeto ON mudancas_pendentes(projeto_id);
  CREATE INDEX IF NOT EXISTS idx_mudancas_status ON mudancas_pendentes(status);
  CREATE INDEX IF NOT EXISTS idx_historico_projeto ON historico(projeto_id);
  CREATE INDEX IF NOT EXISTS idx_conversas_projeto ON conversas(projeto_id);
  CREATE INDEX IF NOT EXISTS idx_versoes_arquivo ON versoes_arquivo(projeto_id, arquivo);
`);

export function criarProjeto(nome, repositorioUrl, caminhoLocal = null, branchPadrao = "main") {
  const stmt = db.prepare(`
    INSERT INTO projetos (nome, repositorio_url, caminho_local, branch_padrao)
    VALUES (?, ?, ?, ?)
  `);
  const info = stmt.run(nome, repositorioUrl, caminhoLocal, branchPadrao);
  return info.lastInsertRowid;
}

export function buscarProjetoPorUrl(url) {
  const stmt = db.prepare("SELECT * FROM projetos WHERE repositorio_url = ? ORDER BY ultimo_acesso DESC LIMIT 1");
  return stmt.get(url);
}

export function buscarProjetoPorCaminho(caminho) {
  const stmt = db.prepare("SELECT * FROM projetos WHERE caminho_local = ? ORDER BY ultimo_acesso DESC LIMIT 1");
  return stmt.get(caminho);
}

export function buscarProjetoPorId(projetoId) {
  const stmt = db.prepare("SELECT * FROM projetos WHERE id = ?");
  return stmt.get(projetoId);
}

export function atualizarUltimoAcesso(projetoId) {
  const stmt = db.prepare("UPDATE projetos SET ultimo_acesso = CURRENT_TIMESTAMP WHERE id = ?");
  stmt.run(projetoId);
}

export function atualizarCaminhoProjeto(projetoId, caminho) {
  const stmt = db.prepare(`
    UPDATE projetos
    SET caminho_local = ?, ultimo_acesso = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  stmt.run(caminho, projetoId);
}

export function salvarContextoArquivo(projetoId, caminho, conteudo, analise = null) {
  const hash = Buffer.from(conteudo).toString("base64").slice(0, 32);
  const stmt = db.prepare(`
    INSERT INTO arquivos_contexto (projeto_id, caminho, conteudo, hash, analise, atualizado_em)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(projeto_id, caminho)
    DO UPDATE SET conteudo = excluded.conteudo, hash = excluded.hash, analise = excluded.analise, atualizado_em = CURRENT_TIMESTAMP
  `);
  stmt.run(projetoId, caminho, conteudo.slice(0, 100000), hash, analise);
}

export function buscarContextoProjeto(projetoId, limite = 50) {
  const stmt = db.prepare(`
    SELECT caminho, conteudo, analise, atualizado_em
    FROM arquivos_contexto
    WHERE projeto_id = ?
    ORDER BY atualizado_em DESC
    LIMIT ?
  `);
  return stmt.all(projetoId, limite);
}

export function criarMudancaPendente(projetoId, arquivo, original, novo, diff, descricao) {
  const stmt = db.prepare(`
    INSERT INTO mudancas_pendentes (projeto_id, arquivo, conteudo_original, conteudo_novo, diff, descricao)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(projetoId, arquivo, original, novo, diff, descricao);
  return info.lastInsertRowid;
}

export function buscarMudancasPendentes(projetoId) {
  const stmt = db.prepare(`
    SELECT * FROM mudancas_pendentes
    WHERE projeto_id = ? AND status = 'pendente'
    ORDER BY criado_em DESC
  `);
  return stmt.all(projetoId);
}

export function aprovarMudanca(mudancaId) {
  const stmt = db.prepare(`
    UPDATE mudancas_pendentes
    SET status = 'aprovada', aplicado_em = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  stmt.run(mudancaId);
}

export function rejeitarMudanca(mudancaId) {
  const stmt = db.prepare(`
    UPDATE mudancas_pendentes
    SET status = 'rejeitada', aplicado_em = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  stmt.run(mudancaId);
}

export function registrarHistorico(projetoId, tipo, descricao, dados = null) {
  const stmt = db.prepare(`
    INSERT INTO historico (projeto_id, tipo, descricao, dados)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(projetoId, tipo, descricao, dados ? JSON.stringify(dados) : null);
}

export function buscarHistorico(projetoId, limite = 50) {
  const stmt = db.prepare(`
    SELECT * FROM historico
    WHERE projeto_id = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `);
  return stmt.all(projetoId, limite);
}

export function salvarConversa(projetoId, mensagem, resposta, contexto = null) {
  const stmt = db.prepare(`
    INSERT INTO conversas (projeto_id, mensagem, resposta, contexto)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(projetoId, mensagem, resposta, contexto);
}

export function buscarConversas(projetoId, limite = 20) {
  const stmt = db.prepare(`
    SELECT * FROM conversas
    WHERE projeto_id = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `);
  return stmt.all(projetoId, limite).reverse();
}

export function listarProjetos(limite = 50) {
  const stmt = db.prepare(`
    SELECT * FROM projetos
    ORDER BY ultimo_acesso DESC
    LIMIT ?
  `);
  return stmt.all(limite);
}

export function salvarVersaoArquivo(projetoId, arquivo, conteudo, descricao = "Versão salva automaticamente", mudancaId = null) {
  const stmt = db.prepare(`
    INSERT INTO versoes_arquivo (projeto_id, mudanca_id, arquivo, conteudo, descricao)
    VALUES (?, ?, ?, ?, ?)
  `);
  const info = stmt.run(projetoId, mudancaId, arquivo, conteudo, descricao);
  return info.lastInsertRowid;
}

export function buscarVersoesArquivo(projetoId, arquivo, limite = 10) {
  const stmt = db.prepare(`
    SELECT * FROM versoes_arquivo
    WHERE projeto_id = ? AND arquivo = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `);
  return stmt.all(projetoId, arquivo, limite);
}

export function restaurarVersaoArquivo(versaoId) {
  const stmt = db.prepare("SELECT * FROM versoes_arquivo WHERE id = ?");
  return stmt.get(versaoId);
}

export { db };
