/* Independent Chat Completions client. Never reads SillyTavern API settings. */
export const API_DEFAULTS=Object.freeze({provider:'deepseek',baseUrl:'https://api.deepseek.com/v1',model:'deepseek-flash',maxTokens:384,contextMessages:6,rememberKey:false,apiKey:'',configured:false});
export const API_PRESETS=Object.freeze({deepseek:{baseUrl:'https://api.deepseek.com/v1',model:'deepseek-flash'},siliconflow:{baseUrl:'https://api.siliconflow.cn/v1',model:''},custom:{baseUrl:'',model:''}});
const STORE_KEY='rose-chess:independent-api:1';
const clip=(v,n)=>String(v??'').slice(0,n);
export function normalizeApiConfig(input={}) {
 return {provider:Object.hasOwn(API_PRESETS,input.provider)?input.provider:API_DEFAULTS.provider,
  baseUrl:clip(input.baseUrl??API_DEFAULTS.baseUrl,2000).trim(),model:clip(input.model??API_DEFAULTS.model,200).trim(),
  maxTokens:Math.floor(Math.min(2048,Math.max(32,Number(input.maxTokens)||384))),contextMessages:Number.isFinite(Number(input.contextMessages))?Math.min(20,Math.max(0,Math.floor(Number(input.contextMessages)))):6,
  rememberKey:input.rememberKey===true,apiKey:clip(input.apiKey,2000).trim(),configured:input.configured===true};
}
function getStorage(){try{return globalThis.localStorage;}catch{return null;}}
export class ApiStore {
 constructor(storage=getStorage()) {this.storage=storage;let saved;try{saved=JSON.parse(storage?.getItem(STORE_KEY)||'null');}catch{}this.config=normalizeApiConfig({...API_DEFAULTS,...saved,apiKey:saved?.rememberKey===true?saved.apiKey:''});}
 get(){return {...this.config};}
 save(input){
  const next=normalizeApiConfig({...this.config,...input,configured:true});const persisted={...next};if(!next.rememberKey)delete persisted.apiKey;
  try{if(!this.storage)throw Error();this.storage.setItem(STORE_KEY,JSON.stringify(persisted));}catch{throw Error('浏览器无法保存设置；请允许本站本地存储后重试');}
  this.config=next;return this.get();
 }
 forget(){return this.save({apiKey:'',rememberKey:false});}
}
export function endpoints(config) {
 let url;try{url=new URL(config.baseUrl);}catch{throw Error('请填写完整 API 地址，例如 https://api.deepseek.com/v1');}
 const local=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
 if(url.protocol!=='https:'&&!(url.protocol==='http:'&&local))throw Error('API 地址需使用 HTTPS；本机 localhost 可使用 HTTP');
 if(url.username||url.password||url.search||url.hash)throw Error('API 地址不能包含账号、密钥、查询参数或 #；密钥请填在 API Key 栏');
 const path=url.pathname.replace(/\/+$/,'').replace(/\/(?:chat\/completions|models)$/,'');
 return {chat:url.origin+path+'/chat/completions',models:url.origin+path+'/models'};
}
function mask(text,key){return clip(key?String(text).split(key).join('[密钥已隐藏]'):text,220);}
async function apiRequest(config,path,body,{fetchFn=globalThis.fetch,timeoutMs=60000}={}) {
 const urls=endpoints(config),controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  const headers={'Accept':'application/json'};if(config.apiKey)headers.Authorization='Bearer '+config.apiKey;
  if(body)headers['Content-Type']='application/json';
  const response=await fetchFn(urls[path],{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined,signal:controller.signal,mode:'cors',credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',cache:'no-store'});
  if(!response.ok){
   let detail='';try{const data=await response.json();detail=mask(data?.error?.message||data?.message||'',config.apiKey);}catch{}
   const info={401:'API Key 无效或未填写',403:'接口拒绝访问，请检查密钥权限',404:'API 地址或模型不存在',429:'请求频率或可用额度受限',500:'API 服务暂时出错',502:'API 网关暂时出错',503:'API 服务暂时不可用'}[response.status]||'API 请求被拒绝';
   throw Error(`${info}（HTTP ${response.status}）${detail?'：'+detail:''}`);
  }
  try{return await response.json();}catch(error){if(controller.signal.aborted)throw error;throw Error('接口未返回有效 JSON，请检查是否填写了网页地址而非 API 地址');}
 }catch(error){
  if(controller.signal.aborted||error.name==='AbortError')throw Error('API 请求超时，棋局仍可继续');
  if(error instanceof TypeError)throw Error('无法连接独立 API：请检查地址、网络及接口是否允许浏览器跨域（CORS）；插件不会自动改用酒馆 API');
  throw Error(mask(error.message,config.apiKey));
 }finally{clearTimeout(timer);}
}
export async function listModels(config,options) {
 const data=await apiRequest(config,'models',null,options);
 if(!Array.isArray(data?.data))throw Error('接口未提供兼容的模型列表，可手动填写模型 ID');
 return [...new Set(data.data.map(m=>m?.id).filter(v=>typeof v==='string'&&v.length<=200))].sort();
}
export async function requestCompletion(config,messages,options) {
 if(!config.model?.trim())throw Error('请先在独立 API 设置中填写或选择模型');
 if(['deepseek','siliconflow'].includes(config.provider)&&!config.apiKey?.trim())throw Error('请在独立 API 设置中填写 API Key；未勾选保存密钥时，刷新页面后需要重新填写');
 const body={model:config.model,messages,max_tokens:config.maxTokens||384,stream:false};
 if(config.provider==='deepseek')body.thinking={type:'disabled'};
 const data=await apiRequest(config,'chat',body,options);
 let text=data?.choices?.[0]?.message?.content;
 if(Array.isArray(text))text=text.filter(p=>p?.type==='text').map(p=>p.text||'').join('');
 if(typeof text!=='string'||!text.trim())throw Error('API 未返回正文；如果使用推理模型，请尝试增加输出上限或改用对话模型');
 return text.trim();
}
export function testConnection(config,options) {
 return requestCompletion({...config,maxTokens:64},[{role:'user',content:'连接测试。请只回复：连接成功。'}],options);
}
