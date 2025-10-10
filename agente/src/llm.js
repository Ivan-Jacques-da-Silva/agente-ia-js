import "dotenv/config";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const LLM_MODEL = process.env.LLM_MODEL || "qwen2.5-coder:7b";

const PLANO_PADRAO = {
  objetivos: ["Entender tarefa", "Editar repo", "Rodar testes", "Preparar PR"],
  passos: ["analisar", "planejar", "editar", "testar", "abrir_pr"],
  criteriosAceite: ["build ok", "testes ok", "mudan\u00e7as m\u00ednimas e seguras"],
};

async function ensureModel(model){
  try{
    const tagsResp = await fetch(`${OLLAMA_URL}/api/tags`);
    if(tagsResp.ok){
      const tags = await tagsResp.json();
      if((tags?.models||[]).some(m=>m?.name===model)) return true;
    }
  }catch{}
  try{
    const pull = await fetch(`${OLLAMA_URL}/api/pull`,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ name: model, stream:false })
    });
    return pull.ok;
  }catch{ return false; }
}

async function pickModel(){
  const preferido = LLM_MODEL;
  if(await ensureModel(preferido)) return preferido;
  const fallbacks = [
    "qwen2.5-coder:7b",
    "llama3.1:8b",
    "mistral:7b"
  ];
  for(const m of fallbacks){
    if(await ensureModel(m)) return m;
  }
  return preferido; // tenta mesmo assim
}

export async function pedir_plano(contexto, tarefa) {
  const prompt = `Voc\u00ea \u00e9 um engenheiro de software. Gere um plano conciso:\n- Objetivos\n- Passos (1..N)\n- Crit\u00e9rios de Aceite\n\nContexto: ${contexto}\nTarefa: ${JSON.stringify(tarefa, null, 2)}\nResponda em JSON com chaves: objetivos, passos, criteriosAceite.`;
  try {
    const model = await pickModel();
    const r = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt, stream: false, options:{ temperature: 0.2 } }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    const resp = data?.response || "";
    const ini = resp.indexOf("{");
    if (ini >= 0) {
      const j = JSON.parse(resp.slice(ini));
      if (Array.isArray(j.objetivos) && Array.isArray(j.passos)) return j;
    }
    return PLANO_PADRAO;
  } catch {
    return PLANO_PADRAO;
  }
}

export async function chat_simples(mensagem, contexto = ""){
  try{
    const model = await pickModel();
    const prompt = `${contexto ? `Contexto:\n${contexto}\n\n` : ""}Usu\u00e1rio: ${mensagem}\nAssistente:`;
    let r = await fetch(`${OLLAMA_URL}/api/generate`,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({model, prompt, stream:false, options:{ temperature: 0.2 }})
    });
    if(r.status===404 || r.status===405){
      // fallback para /api/chat
      r = await fetch(`${OLLAMA_URL}/api/chat`,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model,
          messages:[
            ...(contexto?[{role:"system", content: contexto }]:[]),
            {role:"user", content: mensagem}
          ],
          stream:false,
          options:{ temperature: 0.2 }
        })
      });
    }
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    return data?.response || data?.message?.content || "";
  }catch(e){
    return `Ollama indispon\u00edvel ou modelo n\u00e3o carregado. Detalhes: ${e?.message||e}`;
  }
}

export { OLLAMA_URL, LLM_MODEL };

