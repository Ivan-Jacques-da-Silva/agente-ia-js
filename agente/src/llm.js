import "dotenv/config";
const OLLAMA_URL=process.env.OLLAMA_URL||"http://localhost:11434"; const LLM_MODEL=process.env.LLM_MODEL||"qwen2.5-coder:7b";
const PLANO_PADRAO={ objetivos:["Entender tarefa","Editar repo","Rodar testes","Preparar PR"], passos:["analisar","planejar","editar","testar","abrir_pr"], criteriosAceite:["build ok","testes ok","mudanças mínimas e seguras"] };
export async function pedir_plano(contexto,tarefa){
  const prompt=`Você é um engenheiro de software. Gere um plano conciso:
- Objetivos
- Passos (1..N)
- Critérios de Aceite

Contexto: ${contexto}
Tarefa: ${JSON.stringify(tarefa,null,2)}
Responda em JSON com chaves: objetivos, passos, criteriosAceite.`;
  try{
    const r=await fetch(`${OLLAMA_URL}/api/generate`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:LLM_MODEL,prompt,stream:false})});
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    const data=await r.json(); const resp=data?.response||""; const ini=resp.indexOf("{"); if(ini>=0){ const j=JSON.parse(resp.slice(ini)); if(Array.isArray(j.objetivos)&&Array.isArray(j.passos)) return j; } return PLANO_PADRAO;
  }catch{ return PLANO_PADRAO; }
}
