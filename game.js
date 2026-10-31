import {Chess,opposite,uci} from './chess-core.js';

export const DEFAULTS=Object.freeze({side:'w',level:'normal',api:false,frequency:2});
export class GameSession {
 constructor({state,settings={},save=()=>{},search,speak,changed=()=>{}}={}) {
  this.settings={...DEFAULTS,...settings};this.settings.side=this.settings.side==='b'?'b':'w';
  if(!['easy','normal','hard'].includes(this.settings.level))this.settings.level='normal';
  this.settings.api=this.settings.api===true;
  if(![1,2,4].includes(Number(this.settings.frequency)))this.settings.frequency=2;
  this.game=state?.game?Chess.fromState(state.game):new Chess();
  const end=state?.finished;
  this.finished=end&&['resign','threefold','fifty'].includes(end.reason)&&['w','b',null].includes(end.winner)?{reason:end.reason,winner:end.winner}:null;
  this.lines=Array.isArray(state?.lines)?state.lines.filter(x=>x&&['system','user','character'].includes(x.kind)&&typeof x.text==='string').slice(-24).map(x=>({...x,text:x.text.slice(0,1200)})):[];
  this.save=save;this.search=search;this.speak=speak;this.changed=changed;this.revision=0;this.busy=false;this.speaking=false;this.disposed=false;this.abort=null;this.apiFlight=null;
 }
 emit(){if(this.disposed)return;this.save({game:this.game.exportState(),finished:this.finished,lines:this.lines},this.settings);this.changed();}
 status(){const s=this.game.status();return this.finished?{...s,over:true,...this.finished}:s;}
 cancel(){this.revision++;this.abort?.abort();this.abort=null;this.busy=false;}
 dispose(){this.cancel();this.disposed=true;}
 async play(move){
  if(this.disposed||this.busy||this.status().over||this.game.turn!==this.settings.side)return false;
  const record=this.game.move(move);if(!record)return false;
  this.revision++;this.emit();await this.respond();return true;
 }
 async respond(){
  if(this.disposed||this.busy||this.status().over||this.game.turn===this.settings.side)return;
  const revision=this.revision,fen=this.game.fen();this.busy=true;this.abort=new AbortController();this.changed();
  try {
   const result=await this.search(this.game.exportState(),this.settings.level,this.abort.signal);
   if(this.disposed||revision!==this.revision||fen!==this.game.fen())return;
   const record=this.game.move(typeof result==='string'?result:result.move);
   if(!record)throw Error('棋力对手没有返回合法走法');
   this.revision++;this.busy=false;this.abort=null;this.emit();
   const rounds=this.game.records.filter(m=>m.color!==this.settings.side).length;
   if(this.settings.api&&(this.status().over||rounds%Number(this.settings.frequency||2)===0))void this.comment();
  } catch(error) {
   if(this.disposed||revision!==this.revision||error.name==='AbortError')return;
   this.busy=false;this.abort=null;this.addLine('system','棋力计算失败：'+error.message+'。可点击“继续走棋”重试。');this.changed();
  }
 }
 undo(){
  if(!this.game.records.length)return;
  this.cancel();this.finished=null;this.game.undo();
  if(this.game.turn!==this.settings.side&&this.game.records.length)this.game.undo();
  this.addLine('system','已撤回到你上一手之前。');this.emit();
 }
 newGame(side=this.settings.side){this.cancel();this.settings.side=side;this.game=new Chess();this.finished=null;this.lines=[];this.emit();void this.respond();}
 resign(){if(this.status().over)return;this.cancel();this.finished={reason:'resign',winner:opposite(this.settings.side)};this.addLine('system','你已认输，本局结束。');this.emit();}
 claimDraw(){const s=this.status();if(s.over||(!s.claimThreefold&&!s.claimFifty))return false;this.cancel();this.finished={reason:s.claimThreefold?'threefold':'fifty',winner:null};this.emit();return true;}
 addLine(kind,text){this.lines.push({kind,text:String(text).slice(0,1200),at:Date.now()});this.lines=this.lines.slice(-24);}
 async comment(userText='') {
  if(this.disposed||this.speaking)return;
  if(!this.speak){this.addLine('system','离线试玩不连接 API；安装到酒馆后可让当前角色发言。');this.emit();return;}
  const rev=this.revision,fen=this.game.fen();this.speaking=true;this.changed();
  try {
   const text=await this.speak({game:this.game,side:this.settings.side,userText,lines:this.lines.slice(-6)});
   if(this.disposed||this.revision!==rev||this.game.fen()!==fen)return;
   if(userText)this.addLine('user',userText);
   if(!String(text).trim())throw Error('API 没有返回文字');
   this.addLine('character',String(text).trim());this.emit();
  }catch(error){if(!this.disposed&&this.revision===rev){this.addLine('system','角色发言未成功：'+error.message+'。棋局仍可继续。');this.emit();}}
  finally{this.speaking=false;if(!this.disposed)this.changed();}
 }
 get result(){const s=this.status();return !s.over?'*':s.winner==='w'?'1-0':s.winner==='b'?'0-1':'1/2-1/2';}
}

export function workerSearch(state,level,signal) {
 return new Promise((resolve,reject)=>{
  if(signal?.aborted){reject(new DOMException('Canceled','AbortError'));return;}
  let worker,timer;
  const clean=()=>{clearTimeout(timer);worker?.terminate();signal?.removeEventListener('abort',cancel);};
  const fail=e=>{clean();reject(e);};
  const cancel=()=>fail(new DOMException('Canceled','AbortError'));
  try{
   worker=new Worker(new URL('./engine-worker.js',import.meta.url),{type:'module'});
   signal?.addEventListener('abort',cancel,{once:true});
   timer=setTimeout(()=>fail(Error('计算超时')),12000);
   worker.onmessage=({data})=>{clean();data.error?reject(Error(data.error)):resolve(data);};
   worker.onerror=()=>fail(Error('无法加载本地棋力模块，请确认插件文件完整并刷新酒馆'));
   worker.postMessage({id:1,state,level});
  }catch(e){fail(e);}
 });
}
