import {color,opposite,squareName,squareIndex,uci} from './chess-core.js';
const GLYPHS={k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'};
const NAMES={k:'王',q:'后',r:'车',b:'象',n:'马',p:'兵'};
const REASONS={checkmate:'将死',stalemate:'逼和',material:'子力不足，和棋',fivefold:'五次重复，和棋',seventyfive:'七十五回合规则，和棋',threefold:'三次重复，和棋',fifty:'五十回合规则，和棋',resign:'认输'};
export class ChessPanel {
 constructor(css,{session,name='对手',demo=false,onOpen=()=>{},apiClient=null}={}) {
  this.session=session;this.name=name;this.demo=demo;this.onOpen=onOpen;this.selected=null;this.flipped=false;this.promotion=null;this.warning='';this.opened=false;this.nextSide=session.settings.side;
  this.apiClient=apiClient;this.apiBusy=false;
  this.host=document.createElement('div');this.host.id='rose-chess-host';this.root=this.host.attachShadow({mode:'open'});document.body.append(this.host);
  const style=document.createElement('style');style.textContent=css;this.root.append(style);
  const container=document.createElement('div');container.innerHTML=`<button class="launcher" aria-label="打开玫瑰棋局" title="玫瑰棋局">♞</button>
  <section class="panel" role="dialog" aria-label="玫瑰棋局" hidden>
   <header class="top"><div><span class="eyebrow">SUB ROSA · CHESS CLUB</span><span class="brand">玫瑰棋局</span><p class="sub opponent"></p></div><button class="close" data-action="close" aria-label="收起棋盘">×</button></header>
   <div class="layout"><div class="board-section"><div class="salon"><span class="salon-kicker">THE CONSERVATORY</span><h2>温室棋室</h2><p>一局棋，一段未说完的话。</p></div><div class="players"><span class="player-name"></span><span class="badge"></span></div><div class="board" role="group" aria-label="国际象棋棋盘"></div><div class="status" aria-live="polite"></div><div class="notice" aria-live="polite"></div>
    <div class="controls"><button class="btn primary" data-action="new">新开一局</button><button class="btn" data-action="undo">悔一回合</button><button class="btn" data-action="flip">翻转棋盘</button><button class="btn" data-action="resume">继续走棋</button><button class="btn" data-action="claim">申报和棋</button><button class="btn" data-action="resign">认输</button></div><p class="hint">点棋子，再点落点。圆点是合法走法；也可用方向键、回车操作。</p>
   </div><aside class="aside"><div class="card"><h3>这局的约定</h3><label class="setting">下局执棋<select data-setting="side"><option value="w">我执白，先走</option><option value="b">我执黑，后走</option></select></label><label class="setting">对手棋力<select data-setting="level"><option value="easy">轻松 · 入门</option><option value="normal">常规 · 休闲</option><option value="hard">认真 · 思考更久</option></select></label><label class="setting">自动角色发言<input type="checkbox" data-setting="api"></label><label class="setting">发言频率<select data-setting="frequency"><option value="1">每回合</option><option value="2">每两回合</option><option value="4">每四回合</option></select></label><p class="hint api-hint"></p></div>
    <details class="card api-card"><summary>独立 API 设置</summary><p class="hint">仅用于棋盘旁的角色发言，与酒馆的 API 配置分开。</p>
     <label class="api-field">接口类型<select data-api="provider"><option value="deepseek">DeepSeek</option><option value="siliconflow">硅基流动</option><option value="custom">自定义兼容接口</option></select></label>
     <label class="api-field">API 地址<input data-api="baseUrl" type="url" spellcheck="false" placeholder="https://你的接口/v1"></label>
     <label class="api-field">API Key<input data-api="apiKey" type="password" autocomplete="off" spellcheck="false" placeholder="本地免密接口可留空"></label>
     <label class="api-field">模型 ID<input data-api="model" list="rose-chess-model-list" spellcheck="false" placeholder="填写模型 ID，或加载列表后选择"><datalist id="rose-chess-model-list"></datalist></label>
     <div class="api-numbers"><label class="api-field">输出上限<input data-api="maxTokens" type="number" min="32" max="2048" step="1"></label><label class="api-field">最近聊天条数<input data-api="contextMessages" type="number" min="0" max="20" step="1"></label></div>
     <label class="setting"><span>在此浏览器保存密钥</span><input data-api="rememberKey" type="checkbox"></label><p class="hint">不勾选时，密钥只保留到刷新页面。勾选后存入当前浏览器本地存储，不随棋局备份导出。</p>
     <div class="controls"><button class="btn primary" data-action="apiSave">保存设置</button><button class="btn" data-action="apiModels">加载模型</button><button class="btn" data-action="apiTest">测试连接</button><button class="btn" data-action="apiForget">清除密钥</button></div><p class="hint api-status" role="status"></p>
    </details>
    <div class="card talk"><h3>棋盘旁的交谈 <span class="pending"></span></h3><div class="lines" role="log" aria-live="polite"></div><div class="talk-form"><textarea class="talk-input" rows="2" maxlength="500" aria-label="对角色说的话" placeholder="这一步，你怎么看？"></textarea><button class="btn" data-action="talk">让他说话</button></div></div>
    <div class="card"><h3>棋谱</h3><p class="moves"></p><div class="controls"><button class="btn" data-action="pgn">导出 PGN</button><button class="btn" data-action="save">备份棋局</button><button class="btn" data-action="load">导入备份</button><input class="import" type="file" accept=".json,application/json" hidden></div></div>
   </aside></div><footer class="footer"><span>棋局自动保存在当前浏览器</span><span>Rose Chess 1.1</span></footer><div class="promotion" hidden><div class="promotion-box" role="dialog" aria-label="选择升变棋子"><h3>兵到达底线，升变为：</h3><div class="promotion-options"><button class="btn" data-promotion="q">后 ♛</button><button class="btn" data-promotion="r">车 ♜</button><button class="btn" data-promotion="b">象 ♝</button><button class="btn" data-promotion="n">马 ♞</button><button class="btn" data-action="cancelPromotion">取消</button></div></div></div>
  </section>`;this.root.append(container);
  this.root.addEventListener('click',e=>void this.click(e));
  this.root.addEventListener('change',e=>void this.change(e));
  this.root.addEventListener('keydown',e=>this.keydown(e));
  this.el('launcher').onclick=()=>this.open();
  this.render();
  if(this.apiClient)this.fillApiFields(this.apiClient.get());
 }
 el(c){return this.root.querySelector('.'+c);}
 setSession(session,name){this.session=session;this.name=name;this.nextSide=session.settings.side;this.selected=null;this.promotion=null;this.warning='';this.render();}
 open(){this.onOpen();this.opened=true;this.el('panel').hidden=false;this.el('launcher').hidden=true;this.render();this.root.querySelector('.sq[tabindex="0"]')?.focus();}
 close(){this.opened=false;this.el('panel').hidden=true;this.el('launcher').hidden=false;this.el('launcher').focus();}
 render(){
  const s=this.session,g=s.game,st=s.status(),canPlay=!s.busy&&!st.over&&g.turn===s.settings.side;
  const focus=this.root.activeElement?.dataset.square;
  this.el('opponent').textContent=this.demo?'离线试玩 · 无需连接 API':`与你的角色 ${this.name} 对弈`;
  this.el('player-name').textContent=this.name;
  this.el('badge').textContent=`你执${s.settings.side==='w'?'白':'黑'} · ${s.busy?'对手思考中':'本地棋力'}`;
  this.el('api-hint').textContent=this.demo?'离线试玩不调用 API。安装到酒馆后，可在插件内单独配置发言接口。':'“让他说话”使用下方独立 API 设置，可能消耗该接口的额度；不使用酒馆当前 API。';
  this.el('api-card').hidden=this.demo||!this.apiClient;
  this.el('pending').textContent=s.speaking?'正在组织话语…':'';
  this.el('status').textContent=st.over?(st.winner?`${st.winner===s.settings.side?'你赢了':'对手获胜'} · ${REASONS[st.reason]||'本局结束'}`:REASONS[st.reason]||'和棋'):s.busy?'对手正在思考…':`${g.turn===s.settings.side?'轮到你走棋':'轮到对手'}${st.check?' · 将军，请应将':''}`;
  this.el('notice').textContent=this.warning;
  for(const node of this.root.querySelectorAll('[data-setting]')){
   const key=node.dataset.setting;if(node.type==='checkbox')node.checked=!!s.settings[key];else node.value=String(key==='side'?this.nextSide:s.settings[key]);
   if(key==='api')node.disabled=this.demo;
  }
  const disable=(action,v)=>{const b=this.root.querySelector(`[data-action="${action}"]`);if(b)b.disabled=v;};
  disable('undo',!g.records.length);disable('resign',st.over);disable('talk',s.speaking||s.busy||!s.speak);disable('claim',st.over||!(st.claimFifty||st.claimThreefold));
  const resume=this.root.querySelector('[data-action="resume"]');resume.hidden=st.over||g.turn===s.settings.side||s.busy;
  const board=this.el('board');board.replaceChildren();const blackBottom=(s.settings.side==='b')!==this.flipped;
  const legal=this.selected!==null&&canPlay?g.legalMoves().filter(m=>m.from===this.selected):[];
  const last=g.records.at(-1);
  for(let row=0;row<8;row++)for(let col=0;col<8;col++){
   const r=blackBottom?row:7-row,f=blackBottom?7-col:col,sq=r*16+f,p=g.board[sq];
   const b=document.createElement('button');b.className='sq'+((r+f)%2===0?' dark':'');b.dataset.square=squareName(sq);b.type='button';
   b.tabIndex=(focus?focus===squareName(sq):(row===7&&col===4))?0:-1;
   b.setAttribute('aria-label',`${squareName(sq)} ${p?(color(p)==='w'?'白':'黑')+NAMES[p.toLowerCase()]:'空格'}`);
   b.setAttribute('aria-pressed',String(sq===this.selected));
   if(last&&(last.from===sq||last.to===sq))b.classList.add('last');
   if(sq===this.selected)b.classList.add('selected');
   const target=legal.find(m=>m.to===sq);if(target)b.classList.add('legal',target.captured?'capture':'quiet');
   if(st.check&&p===(g.turn==='w'?'K':'k'))b.classList.add('check');
   if(p){const span=document.createElement('span');span.className='piece '+(color(p)==='w'?'white':'black');span.textContent=GLYPHS[p.toLowerCase()];b.append(span);}
   if(row===7){const coord=document.createElement('span');coord.className='coord';coord.textContent='abcdefgh'[f];b.append(coord);}
   if(col===0){const coord=document.createElement('span');coord.className='coord rank';coord.textContent=String(r+1);b.append(coord);}
   board.append(b);
  }
  if(focus)this.root.querySelector(`[data-square="${focus}"]`)?.focus({preventScroll:true});
  const lines=this.el('lines');lines.replaceChildren();
  if(!s.lines.length){const p=document.createElement('p');p.className='hint';p.textContent='棋盘已经摆好。你可以安静对弈，也可以让角色陪你聊上几句。';lines.append(p);}
  for(const line of s.lines){const div=document.createElement('div');div.className='line '+(line.kind==='system'?'system':'');const who=document.createElement('span');who.className='line-label';who.textContent=line.kind==='character'?this.name:line.kind==='user'?'你':'棋局提示';const text=document.createElement('span');text.textContent=line.text;div.append(who,text);lines.append(div);}lines.scrollTop=lines.scrollHeight;
  this.el('moves').textContent=g.records.map(m=>(m.color==='w'?`${m.number}. `:'')+m.san).join(' ')||'尚未落子。白棋先行。';
  this.el('moves').scrollTop=this.el('moves').scrollHeight;
  this.el('promotion').hidden=!this.promotion;
 }
 async click(e){
  const p=e.target.closest('[data-promotion]');if(p&&this.promotion){const move=this.promotion.find(m=>m.promotion===p.dataset.promotion);this.promotion=null;this.selected=null;await this.session.play(uci(move));return;}
  const square=e.target.closest('[data-square]');if(square){await this.selectSquare(squareIndex(square.dataset.square));return;}
  const a=e.target.closest('[data-action]')?.dataset.action;if(!a)return;
  if(a.startsWith('api')){await this.apiAction(a);return;}
  const s=this.session;
  if(a==='close'){this.close();return;}
  if(a==='cancelPromotion'){this.promotion=null;this.render();return;}
  if(a==='flip'){this.flipped=!this.flipped;this.render();return;}
  if(a==='new'){if(s.game.records.length&&!window.confirm('结束当前棋局，重新开始？'))return;this.selected=null;this.promotion=null;s.newGame(this.root.querySelector('[data-setting="side"]').value);}
  if(a==='undo'){this.selected=null;this.promotion=null;s.undo();}
  if(a==='resume')await s.respond();
  if(a==='claim')s.claimDraw();
  if(a==='resign'&&window.confirm('确认认输并结束本局？'))s.resign();
  if(a==='talk'){const input=this.el('talk-input'),text=input.value.trim();input.value='';await s.comment(text);}
  if(a==='pgn'){const names=s.settings.side==='w'?{white:'Player',black:this.name}:{white:this.name,black:'Player'};this.download(s.game.pgn({...names,result:s.result}),'rose-chess.pgn','application/x-chess-pgn');}
  if(a==='save')this.download(JSON.stringify({version:1,game:s.game.exportState(),finished:s.finished,lines:s.lines,settings:s.settings},null,2),'rose-chess-save.json','application/json');
  if(a==='load')this.el('import').click();
 }
 async selectSquare(sq){
  const s=this.session;if(s.busy||s.status().over||s.game.turn!==s.settings.side)return;
  this.warning='';
  if(this.selected!==null){const candidates=s.game.legalMoves().filter(m=>m.from===this.selected&&m.to===sq);
   if(candidates.length){if(candidates[0].promotion){this.promotion=candidates;this.render();this.root.querySelector('[data-promotion="q"]').focus();return;}this.selected=null;await s.play(uci(candidates[0]));return;}
  }
  if(color(s.game.board[sq])===s.settings.side)this.selected=this.selected===sq?null:sq;
  else {if(this.selected!==null)this.warning='这个落点不合法，请选择标出的格子。';this.selected=null;}
  this.render();
 }
 async change(e){
  const node=e.target,s=this.session;
  if(node.dataset.api==='provider'&&this.apiClient){const draft=this.readApiFields();this.fillApiFields({...draft,...this.apiClient.presets[node.value],provider:node.value});this.root.querySelector('#rose-chess-model-list').replaceChildren();return;}
  if(node.dataset.setting){const k=node.dataset.setting;
   if(k==='side'){this.nextSide=node.value;return;} // Applies only when starting the next game.
   s.settings[k]=node.type==='checkbox'?node.checked:k==='frequency'?Number(node.value):node.value;s.emit();return;
  }
  if(node.classList.contains('import')){
   const file=node.files?.[0];if(!file)return;
   try{if(file.size>2_000_000)throw Error('备份超过 2 MB');const data=JSON.parse(await file.text());if(data.version!==1)throw Error('备份版本不支持');
    if(!window.confirm('用导入的备份替换当前棋局？'))return;
    // Validation and session replacement are delegated to the adapter.
    await this.onImport?.(data);
   }catch(error){this.warning='导入失败：'+error.message;this.render();}finally{node.value='';}
  }
 }
 fillApiFields(config){for(const node of this.root.querySelectorAll('[data-api]')){const value=config[node.dataset.api];if(node.type==='checkbox')node.checked=value===true;else node.value=String(value??'');}}
 readApiFields(){const result={};for(const node of this.root.querySelectorAll('[data-api]'))result[node.dataset.api]=node.type==='checkbox'?node.checked:node.type==='number'?Number(node.value):node.value.trim();return result;}
 async apiAction(action){
  if(!this.apiClient||this.apiBusy)return;const status=this.el('api-status');
  try{
   if(action==='apiSave'){this.apiClient.save(this.readApiFields());status.textContent='已保存，之后的角色发言使用这组独立配置。';return;}
   if(action==='apiForget'){this.fillApiFields(this.apiClient.forget());status.textContent='已清除当前与保存的密钥。';return;}
   this.apiBusy=true;for(const b of this.root.querySelectorAll('.api-card button'))b.disabled=true;
   status.textContent=action==='apiModels'?'正在读取模型列表…':'正在测试独立 API（会发送一条短测试请求）…';
   const draft=this.readApiFields();
   if(action==='apiModels'){
    const models=await this.apiClient.listModels(draft),list=this.root.querySelector('#rose-chess-model-list');list.replaceChildren();
    for(const id of models){const option=document.createElement('option');option.value=id;list.append(option);}
    status.textContent=models.length?`已加载 ${models.length} 个模型，点击模型输入框选择；选择后请保存。`:'模型列表为空，可手动填写模型 ID。';
   }else{const text=await this.apiClient.test(draft);status.textContent='连接成功：'+text.slice(0,120)+'（请记得保存设置）';}
  }catch(error){status.textContent=error.message;}
  finally{this.apiBusy=false;for(const b of this.root.querySelectorAll('.api-card button'))b.disabled=false;}
 }
 keydown(e){
  if(e.key==='Escape'){e.preventDefault();if(this.promotion){this.promotion=null;this.render();}else this.close();return;}
  const sq=e.target.closest('[data-square]');if(!sq)return;
  const delta={ArrowLeft:-1,ArrowRight:1,ArrowUp:-8,ArrowDown:8}[e.key];
  if(delta!==undefined){e.preventDefault();const nodes=[...this.root.querySelectorAll('[data-square]')],i=nodes.indexOf(sq),next=i+delta;if(next>=0&&next<64){sq.tabIndex=-1;nodes[next].tabIndex=0;nodes[next].focus();}}
 }
 download(text,name,type){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 destroy(){this.host.remove();}
}
