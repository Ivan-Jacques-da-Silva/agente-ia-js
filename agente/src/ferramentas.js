import simpleGit from "simple-git"; import { exec } from "node:child_process"; import { promisify } from "node:util"; import fs from "node:fs"; import path from "node:path";
const sh=promisify(exec);

function urlComToken(url, token){
  try{
    if(!token) return url;
    const u=new URL(url);
    if(u.protocol.startsWith('http')){
      // usa x-access-token:token@host para GitHub
      u.username='x-access-token';
      u.password=token;
      return u.toString();
    }
    return url;
  }catch{ return url; }
}

export async function clonar_repositorio(url,destino,token){
  await fs.promises.mkdir(destino,{recursive:true});
  const git=simpleGit();
  const authUrl = urlComToken(url, token||process.env.GIT_TOKEN||process.env.GITHUB_TOKEN);
  await git.clone(authUrl,destino);
}

export async function criar_branch(destino,nome,base){ const git=simpleGit(destino); if(base){ try{ await git.fetch(); await git.checkout(base); }catch{} } await git.checkoutLocalBranch(nome); }
export async function rodar_testes(destino){ const {stdout,stderr}=await sh("npm test --silent || true",{cwd:destino,timeout:120000}); return stdout+stderr; }
export async function aplicar_patch(destino,diff){ const arquivo=path.join(destino,"alteracao.patch"); await fs.promises.writeFile(arquivo,diff,"utf-8"); const {stdout,stderr}=await sh(`git apply --whitespace=fix ${arquivo}`,{cwd:destino,timeout:60000}); return stdout+stderr; }
export async function commit_e_push(destino,msg){ const git=simpleGit(destino); await git.add("./*"); await git.commit(msg); try{ await git.push("origin"); }catch{} }
