import os from "node:os";
import path from "node:path";
import { pedir_plano } from "./llm.js";
import {
  clonar_repositorio,
  criar_branch,
  rodar_testes,
  aplicar_patch,
  commit_e_push,
} from "./ferramentas.js";

export async function executar_fluxo(tarefa) {
  const contexto = "Repositório alvo com testes. Faça mudanças mínimas e seguras.";
  const plano = await pedir_plano(contexto, tarefa);

  const pasta = path.join(os.tmpdir(), `tarefa_${Date.now()}`);
  await clonar_repositorio(tarefa.repositorioUrl, pasta);
  await criar_branch(pasta, `agente/${Date.now()}`);

  const antes = await rodar_testes(pasta);

  let logPatch = "";
  if (plano.passos?.includes("editar")) {
    const exemplo = `
diff --git a/README.md b/README.md
index e69de29..b1f4a1e 100644
--- a/README.md
+++ b/README.md
@@ -0,0 +1,3 @@
+# Atualização pelo Agente
+- Ajuste automático de documentação.
+
`;
    try {
      logPatch = await aplicar_patch(pasta, exemplo);
    } catch (e) {
      logPatch = String(e?.message || e);
    }
  }

  const depois = await rodar_testes(pasta);
  try {
    await commit_e_push(pasta, "feat: alteração automática via Agente");
  } catch {}
  return {
    plano,
    testesAntes: (antes || "").slice(0, 2000),
    patchSaida: (logPatch || "").slice(0, 2000),
    testesDepois: (depois || "").slice(0, 2000),
  };
}

