import {authenticate,createSession,createUser,destroySession,sameOrigin,signupAllowed} from '../../../../lib/auth';
export const runtime='nodejs';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(req:Request,{params}:{params:Promise<{action:string}>}){
 if(!sameOrigin(req))return json({error:'Origem da solicitação inválida.'},403);
 const {action}=await params;
 if(action==='logout'){await destroySession();return json({ok:true})}
 if(!['login','signup'].includes(action))return json({error:'Operação não encontrada.'},404);
 const body=await req.json().catch(()=>null);const email=typeof body?.email==='string'?body.email.trim().toLowerCase():'',password=body?.password;
 if(!/^\S+@\S+\.\S+$/.test(email)||email.length>254||typeof password!=='string'||password.length<1||password.length>128)return json({error:'Informe e-mail e senha válidos.'},400);
 if(action==='signup'){
 if(!signupAllowed())return json({error:'O cadastro público está desativado.'},403);
 if(password.length<12)return json({error:'Use uma senha com pelo menos 12 caracteres.'},400);
 try{const user=await createUser(email,password);await createSession(user.id);return json({ok:true})}catch{return json({error:'Não foi possível criar esta conta. Se já tem uma conta, tente entrar.'},409)}
 }
 const result=await authenticate(email,password);
 if('limited' in result)return json({error:'Muitas tentativas. Aguarde 15 minutos antes de tentar novamente.'},429);
 if(!('user' in result)||!result.user)return json({error:'E-mail ou senha incorretos.'},401);
 await createSession(result.user.id);return json({ok:true});
}
