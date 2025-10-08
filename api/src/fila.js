import { EventEmitter } from "node:events";
export class FilaMemoria extends EventEmitter {
  #privada = []; #processando = false;
  async adicionar(job){ this.#privada.push(job); this.emit("adicionado", job); this.#tentar(); }
  async #tentar(){ if(this.#processando) return; this.#processando=true; while(this.#privada.length){ const j=this.#privada.shift(); this.emit("executar", j); await new Promise(r=>setTimeout(r,0)); } this.#processando=false; }
}
