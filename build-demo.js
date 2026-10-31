import fs from 'node:fs';
const read=f=>fs.readFileSync(new URL(f,import.meta.url),'utf8');
const strip=s=>s.replace(/^import .*?;\r?\n/gm,'').replace(/^export /gm,'');
const core=strip(read('./chess-core.js')),game=strip(read('./game.js').split('export function workerSearch')[0]),panel=strip(read('./panel.js'));
// Classic inline script works by double-click, with no server, CDN or module fetch.
// Demo uses a Blob worker containing the exact same engine, not a different AI.
const worker=core+'\nself.onmessage=({data})=>{try{self.postMessage(bestMove(Chess.fromState(data.state),{level:data.level}));}catch(e){self.postMessage({error:e.message});}};';
const boot=`const engineSource=${JSON.stringify(worker)};
const css=${JSON.stringify(read('./panel.css').replaceAll('__BOTANICAL_URL__','data:image/svg+xml,'+encodeURIComponent(read('./assets/botanical.svg'))))};
const stored=(()=>{try{return JSON.parse(localStorage.getItem('rose-chess-demo')||'null')}catch{return null}})();
let demoPanel,demoSession;
function demoSearch(state,level,signal){return new Promise((resolve,reject)=>{let w,url,timer;const stop=()=>{clearTimeout(timer);w?.terminate();if(url)URL.revokeObjectURL(url);signal.removeEventListener('abort',abort)};const abort=()=>{stop();reject(new DOMException('Canceled','AbortError'))};try{if(signal.aborted)return abort();url=URL.createObjectURL(new Blob([engineSource],{type:'text/javascript'}));w=new Worker(url);signal.addEventListener('abort',abort,{once:true});timer=setTimeout(()=>{stop();reject(Error('计算超时'))},12000);w.onmessage=e=>{stop();e.data.error?reject(Error(e.data.error)):resolve(e.data)};w.onerror=()=>{stop();reject(Error('浏览器未能加载离线棋力模块'))};w.postMessage({state,level});}catch(e){stop();reject(e)}})}
function makeSession(saved){try{return new GameSession({state:saved?.state,settings:{...saved?.settings,api:false},search:demoSearch,save:(state,settings)=>{try{localStorage.setItem('rose-chess-demo',JSON.stringify({state,settings}))}catch{}},changed:()=>demoPanel?.render()})}catch{return new GameSession({search:demoSearch,changed:()=>demoPanel?.render()})}}
demoSession=makeSession(stored);demoPanel=new ChessPanel(css,{session:demoSession,name:'练习对手',demo:true,onOpen:()=>{void demoSession.respond()}});demoPanel.onImport=data=>{Chess.fromState(data.game);demoSession.dispose();demoSession=makeSession({state:data,settings:data.settings});demoPanel.setSession(demoSession,'练习对手');demoSession.emit();void demoSession.respond()};demoPanel.open();`;
const script=(core+'\n'+game+'\n'+panel+'\n'+boot).replace(/<\/script/gi,'<\\/script');
fs.writeFileSync(new URL('./demo.html',import.meta.url),`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>玫瑰棋局 · 离线试玩</title><style>body{margin:0;min-height:100vh;background:#ded7c8;color:#514737;font:16px/1.8 Georgia,serif}main{padding:6vh 4vw;max-width:650px}h1{font-weight:400;letter-spacing:.08em}.fine{font-size:13px;opacity:.8}</style></head><body><main><p>SUB ROSA · CHESS CLUB</p><h1>玫瑰棋局</h1><p>离线试玩已打开。关闭棋盘后，点右下角的 ♞ 可以重新打开。</p><p class="fine">离线试玩不连接 API。安装插件到酒馆后，可以使用当前角色和当前 API 发言。棋局保存在当前浏览器，换设备请导出备份。</p></main><script>${script}</script></body></html>`);
console.log('Built demo.html (offline, no CDN).');
