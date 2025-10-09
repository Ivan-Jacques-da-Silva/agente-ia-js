Agente IA (JS) — Front React (sem TS) + API Express + Agente (Ollama)

Como rodar
- Pré‑requisitos: Node 18+ e Ollama instalado e rodando em `http://localhost:11434`.
- Instalação: `npm run instalar`
- Desenvolvimento (tudo junto): `npm run dev`
  - Antes, garanta um modelo no Ollama, por exemplo:
    - `ollama pull qwen2.5-coder:7b`
    - ou altere `LLM_MODEL` em `agente/.env` para o modelo que preferir

Ambiente (.env)
- `api/.env` (opcional):
  - `API_PORTA=5050`
  - `AGENTE_PORTA=6060`
- `agente/.env` (já configurado):
  - `AGENTE_PORTA=6060`
  - `OLLAMA_URL=http://localhost:11434`
  - `LLM_MODEL=qwen3-coder:480b-cloud` (padrão recomendado para programação entre os seus modelos)
- `front/.env` (já configurado):
  - `VITE_API_URL=/api`
  - `VITE_AGENT_URL=/agente`

Observações
- O agente consulta o Ollama via `POST /api/generate` (fallback para `POST /api/chat`) e tenta extrair JSON com `objetivos`, `passos`, `criteriosAceite`.
- Caso o modelo não retorne JSON válido, um plano padrão é usado.
- A API enfileira tarefas em memória e aciona o agente.
