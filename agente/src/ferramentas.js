import simpleGit from "simple-git"; import { exec } from "node:child_process"; import { promisify } from "node:util"; import fs from "node:fs"; import path from "node:path";
const sh=promisify(exec);
export async function clonar_repositorio(url,destino){ await fs.promises.mkdir(destino,{recursive:true}); const git=simpleGit(); await git.clone(url,destino); }
export async function criar_branch(destino,nome){ const git=simpleGit(destino); await git.checkoutLocalBranch(nome); }
export async function rodar_testes(destino){ const {stdout,stderr}=await sh("npm test --silent || true",{cwd:destino,timeout:120000}); return stdout+stderr; }
export async function aplicar_patch(destino,diff){ const arquivo=path.join(destino,"alteracao.patch"); await fs.promises.writeFile(arquivo,diff,"utf-8"); const {stdout,stderr}=await sh(`git apply --whitespace=fix ${arquivo}`,{cwd:destino,timeout:60000}); return stdout+stderr; }
export async function commit_e_push(destino,msg){ const git=simpleGit(destino); await git.add("./*"); await git.commit(msg); try{ await git.push("origin"); }catch{} }
