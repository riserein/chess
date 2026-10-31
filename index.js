import {Chess} from './chess-core.js';
import {GameSession,workerSearch} from './game.js';
import {ChessPanel} from './panel.js';
import {contextKey,createSpeaker} from './character.js';
import {ApiStore,API_PRESETS,listModels,testConnection} from './api.js';

const PREFIX='rose-chess:1:';
let panel,session,currentKey=null,unsub=null,interval=null;
const getContext=()=>window.SillyTavern?.getContext?.();
const apiStore=new ApiStore();
const apiClient={get:()=>apiStore.get(),save:data=>apiStore.save(data),forget:()=>apiStore.forget(),presets:API_PRESETS,listModels,test:testConnection};
function read(key){try{return JSON.parse(localStorage.getItem(PREFIX+key)||'null');}catch{return null;}}
function globalSettings(){return getContext()?.extensionSettings?.roseChess||{};}
function save(key,state,settings){
 try{localStorage.setItem(PREFIX+key,JSON.stringify({state,settings}));}
 catch{if(panel)panel.warning='浏览器存储不可用，请用“备份棋局”手动保存。';}
 const ctx=getContext();if(ctx?.extensionSettings){ctx.extensionSettings.roseChess={level:settings.level,api:settings.api,frequency:settings.frequency};ctx.saveSettingsDebounced?.();}
}
function sync(force=false,imported=null){
 const ctx=getContext(),key=contextKey(ctx);
 if(!force&&key===currentKey&&session)return;
 session?.dispose();currentKey=key;
 let saved=imported?{state:imported,settings:{...imported.settings,api:false}}:read(key||'practice');
 const name=key?(ctx.characters[ctx.characterId]?.name||'对手'):'练习对手';
 const opts={state:saved?.state,settings:{...globalSettings(),...saved?.settings},save:(state,settings)=>save(key||'practice',state,settings),search:workerSearch,speak:key?createSpeaker(getContext,key,()=>apiStore.get()):undefined,changed:()=>panel?.render()};
 try{session=new GameSession(opts);}catch{session=new GameSession({...opts,state:null});}
 if(!key)session.settings.api=false;
 if(panel){panel.setSession(session,name);if(!key)panel.warning='当前是本地练习；打开单个角色聊天后，可以与该角色对弈。群聊暂不支持角色发言。';panel.render();}
 if(panel?.opened)void session.respond();
}
async function boot(){
 if(document.getElementById('rose-chess-host'))return;
 const cssResponse=await fetch(new URL('./panel.css',import.meta.url));if(!cssResponse.ok)throw Error('无法读取棋盘样式文件');
 const css=(await cssResponse.text()).replaceAll('__BOTANICAL_URL__',new URL('./assets/botanical.svg',import.meta.url).href);sync(true);
 panel=new ChessPanel(css,{session,apiClient,name:currentKey?(getContext()?.characters?.[getContext()?.characterId]?.name||'对手'):'练习对手',onOpen:()=>{sync();void session.respond();}});
 panel.onImport=data=>{Chess.fromState(data.game);sync(true,data);session.emit();};
 const ctx=getContext();
 if(ctx?.eventSource&&ctx?.eventTypes?.CHAT_CHANGED){const handler=()=>sync();ctx.eventSource.on(ctx.eventTypes.CHAT_CHANGED,handler);unsub=()=>ctx.eventSource.removeListener?.(ctx.eventTypes.CHAT_CHANGED,handler);}
 // Covers hosts/forks that omit or rename the chat event; no network polling.
 interval=setInterval(()=>{try{sync();}catch(e){console.warn('[Rose Chess] Context switch:',e.message);}},1500);
 const holder=document.querySelector('#extensions_settings2')||document.querySelector('#extensions_settings');
 if(holder){const box=document.createElement('div');box.id='rose-chess-settings';const button=document.createElement('button');button.className='menu_button';button.type='button';button.textContent='♞ 打开玫瑰棋局';button.onclick=()=>panel.open();box.append(button);holder.append(box);}
}
export function onDisable(){session?.dispose();panel?.destroy();panel=null;session=null;clearInterval(interval);unsub?.();document.getElementById('rose-chess-settings')?.remove();}
export function onEnable(){start();}
function start(){setTimeout(()=>boot().catch(error=>{console.error('[Rose Chess]',error);window.toastr?.error?.('国际象棋插件未能启动：'+error.message);}),0);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
