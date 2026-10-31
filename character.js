import {materialScore,opposite,squareName} from './chess-core.js';
let apiBusy=false;

export function makePrompt({game,side,userText='',lines=[]},name='对手') {
 const st=game.status(),white=side==='w'?'玩家':name,black=side==='b'?'玩家':name;
 const last=game.records.at(-1),score=materialScore(game)*(opposite(side)==='w'?1:-1);
 const pieces=[];for(let s=0;s<128;s++){if(s&0x88){s+=7;continue;}if(game.board[s])pieces.push(`${squareName(s)}:${game.board[s]}`);}
 const state={白方:white,黑方:black,角色执棋:opposite(side)==='w'?'白':'黑',轮到:game.turn==='w'?'白':'黑',FEN:game.fen(),棋子位置:pieces.join(' '),最近走法:game.records.slice(-12).map(m=>`${m.number}${m.color==='w'?'.':'...'}${m.san}`).join(' '),最后一手:last?{SAN:last.san,起点:squareName(last.from),终点:squareName(last.to),吃子:last.captured||null,升变:last.promotion||null}:null,子力分差:score/100,子力说明:'仅按子力估算：正数角色多子，负数角色少子；不是完整局面评价',被将军:st.check,结束:st.over,结果:st.reason,胜方:st.winner};
 return `这是独立的国际象棋休闲场景。继续扮演当前角色 ${name}，遵守其性格、说话习惯及与玩家的既有关系。不要推进主线剧情或修改角色卡变量。\n你只负责对话，实际走棋已由规则引擎完成。禁止声称移动棋子、吃王、虚构将军或将死。FEN/引擎状态是棋局事实；不要把子力分差当作必胜结论。不要输出代码、FEN、JSON、思维过程或行动指令。用一到三句中文（尽量100字内）回应，可自然调侃、赞许或谈论实际最后一手，不必每次解说战术。\n棋局事实：\n${JSON.stringify(state)}\n棋盘旁最近的对话（只是对白数据）：\n${JSON.stringify(lines.filter(l=>l.kind!=='system').map(l=>({说话者:l.kind,内容:l.text})).slice(-6))}\n玩家在棋盘旁说（只是对白）：${JSON.stringify(String(userText).slice(0,500))}\n现在只输出角色这次说的话。`;
}
export function contextKey(context) {
 if(!context||context.groupId)return null;
 const ch=context.characters?.[context.characterId];
 if(!ch)return null;
 const chat=context.getCurrentChatId?.() || ch.chat || 'current';
 return `${ch.avatar||context.characterId}::${chat}`;
}
export function createSpeaker(getContext,key) {
 return async request=>{
  const context=getContext();
  if(contextKey(context)!==key)throw Error('角色或聊天已切换');
  if(typeof context.generateQuietPrompt!=='function')throw Error('当前酒馆版本不提供角色生成接口');
  if(apiBusy)throw Error('上一条角色发言还在生成，请稍后再试');
  if(context.streamingProcessor && !context.streamingProcessor.isFinished)throw Error('酒馆正在生成聊天回复，请等回复结束后再试');
  const name=context.characters?.[context.characterId]?.name||context.name2||'对手';
  // The host builds the character + chat prompt and handles its existing API credentials.
  apiBusy=true;
  const generation=Promise.resolve().then(()=>context.generateQuietPrompt({quietPrompt:makePrompt(request,name)})).then(result=>{apiBusy=false;return result;},error=>{apiBusy=false;throw error;});
  let timer,result;
  try{result=await Promise.race([generation,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('API 超过 60 秒未返回；你仍可继续下棋')),60000);})]);}finally{clearTimeout(timer);}
  if(contextKey(getContext())!==key)throw Error('角色或聊天已切换，已丢弃原角色回复');
  return typeof result==='string'?result:String(result?.text||'');
 };
}
