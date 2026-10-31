/* Original, dependency-free 0x88 chess rules. MIT license, see LICENSE. */
export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
export const opposite = c => c === 'w' ? 'b' : 'w';
export const color = p => !p ? null : p === p.toUpperCase() ? 'w' : 'b';
export const squareName = s => 'abcdefgh'[s & 7] + (1 + (s >> 4));
export function squareIndex(s) { return /^[a-h][1-8]$/.test(s) ? (s.charCodeAt(1)-49)*16+s.charCodeAt(0)-97 : -1; }
export const uci = m => squareName(m.from) + squareName(m.to) + (m.promotion || '');
const KNIGHT = [33,31,18,14,-14,-18,-31,-33];
const BISHOP = [15,17,-15,-17];
const ROOK = [1,-1,16,-16];
const KING = [...BISHOP,...ROOK];
const onBoard = s => s >= 0 && s < 128 && !(s & 0x88);

export class Chess {
 constructor(fen = START_FEN) { this.load(fen); }
 load(fen) {
  const parts=String(fen).trim().split(/\s+/);
  if(parts.length!==6 || !/^[wb]$/.test(parts[1]) || !/^(?:-|K?Q?k?q?)$/.test(parts[2]) || !/^(?:-|[a-h][36])$/.test(parts[3]) || !/^\d+$/.test(parts[4]) || !/^[1-9]\d*$/.test(parts[5])) throw Error('FEN 格式不正确');
  const board=Array(128).fill(null), rows=parts[0].split('/');
  if(rows.length!==8)throw Error('FEN 必须有八行');
  for(let r=0;r<8;r++) {
   let f=0;
   for(const c of rows[r]) {
    if(/[1-8]/.test(c))f+=Number(c);
    else {if(!/[prnbqkPRNBQK]/.test(c)||f>=8)throw Error('FEN 棋子不正确');board[(7-r)*16+f++]=c;}
   }
   if(f!==8)throw Error('FEN 每行必须八格');
  }
  for(const k of ['K','k'])if(board.filter(p=>p===k).length!==1)throw Error('FEN 必须各有一个王');
  for(let f=0;f<8;f++)if([board[f],board[112+f]].some(p=>p?.toLowerCase()==='p'))throw Error('兵不能位于底线');
  const kings=board.map((p,i)=>p?.toLowerCase()==='k'?i:-1).filter(i=>i>=0);
  if(Math.abs((kings[0]&7)-(kings[1]&7))<=1 && Math.abs((kings[0]>>4)-(kings[1]>>4))<=1)throw Error('两王不能相邻');
  this.board=board;this.turn=parts[1];this.castling=parts[2]==='-'?'':parts[2];this.ep=parts[3]==='-'?-1:squareIndex(parts[3]);
  this.halfmove=Number(parts[4]);this.fullmove=Number(parts[5]);
  if(!Number.isSafeInteger(this.halfmove)||!Number.isSafeInteger(this.fullmove))throw Error('FEN 计数过大');
  if(this.inCheck(opposite(this.turn)))throw Error('FEN 非行棋方的王不能正在被将军');
  this.initialFen=this.fen();this.records=[];this.stack=[];this.repetitions=new Map([[this.positionKey(),1]]);
 }
 fen() {
  const rows=[];
  for(let r=7;r>=0;r--) {let row='',empty=0;for(let f=0;f<8;f++){const p=this.board[r*16+f];if(!p)empty++;else{if(empty)row+=empty;empty=0;row+=p;}}if(empty)row+=empty;rows.push(row);}
  return `${rows.join('/')} ${this.turn} ${this.castling||'-'} ${this.ep<0?'-':squareName(this.ep)} ${this.halfmove} ${this.fullmove}`;
 }
 snapshot() {return {board:this.board.slice(),turn:this.turn,castling:this.castling,ep:this.ep,halfmove:this.halfmove,fullmove:this.fullmove};}
 restore(s) {Object.assign(this,s);}
 attacked(target, by) {
  const pawn=by==='w'?'P':'p',dir=by==='w'?16:-16;
  for(const d of [dir+1,dir-1])if(onBoard(target-d)&&this.board[target-d]===pawn)return true;
  for(const d of KNIGHT)if(onBoard(target+d)&&this.board[target+d]===(by==='w'?'N':'n'))return true;
  for(const d of KING) {
   let s=target+d,step=1;
   while(onBoard(s)) {
    const p=this.board[s];
    if(p){if(color(p)===by){const t=p.toLowerCase();if(t==='q'||(step===1&&t==='k')||(BISHOP.includes(d)&&t==='b')||(ROOK.includes(d)&&t==='r'))return true;}break;}
    s+=d;step++;
   }
  }
  return false;
 }
 inCheck(c=this.turn) {const k=this.board.indexOf(c==='w'?'K':'k');return k<0||this.attacked(k,opposite(c));}
 pseudoMoves() {
  const moves=[],us=this.turn,them=opposite(us);
  const add=(from,to,extra={})=> {if(this.board[to]?.toLowerCase()==='k')return;moves.push({from,to,piece:this.board[from],captured:this.board[to],...extra});};
  for(let from=0;from<128;from++){if(from&0x88){from+=7;continue;}const p=this.board[from];if(color(p)!==us)continue;const t=p.toLowerCase();
   if(t==='p') {
    const dir=us==='w'?16:-16,start=us==='w'?1:6,last=us==='w'?7:0;
    const pawnMove=(to,extra={})=>{if((to>>4)===last)for(const promotion of ['q','r','b','n'])add(from,to,{...extra,promotion});else add(from,to,extra);};
    const one=from+dir;
    if(onBoard(one)&&!this.board[one]) {pawnMove(one);const two=one+dir;if((from>>4)===start&&!this.board[two])add(from,two,{double:true});}
    for(const d of [dir-1,dir+1]){const to=from+d;if(!onBoard(to))continue;if(color(this.board[to])===them)pawnMove(to);else if(to===this.ep&&!this.board[to]&&this.board[to-dir]===(us==='w'?'p':'P'))add(from,to,{ep:true,captured:this.board[to-dir]});}
   } else {
    const dirs=t==='n'?KNIGHT:t==='b'?BISHOP:t==='r'?ROOK:KING;
    for(const d of dirs)for(let to=from+d;onBoard(to);to+=d) {if(color(this.board[to])===us)break;add(from,to);if(this.board[to]||t==='n'||t==='k')break;}
    if(t==='k') {
     const base=us==='w'?0:112,rook=us==='w'?'R':'r';
     if(from===base+4&&!this.inCheck(us)) {
      if(this.castling.includes(us==='w'?'K':'k')&&this.board[base+7]===rook&&!this.board[base+5]&&!this.board[base+6]&&!this.attacked(base+5,them)&&!this.attacked(base+6,them))add(from,base+6,{castle:'k'});
      if(this.castling.includes(us==='w'?'Q':'q')&&this.board[base]===rook&&!this.board[base+1]&&!this.board[base+2]&&!this.board[base+3]&&!this.attacked(base+3,them)&&!this.attacked(base+2,them))add(from,base+2,{castle:'q'});
     }
    }
   }
  }
  return moves;
 }
 applyUnchecked(m) {
  const us=this.turn,dir=us==='w'?16:-16,p=this.board[m.from];
  this.board[m.to]=m.promotion?(us==='w'?m.promotion.toUpperCase():m.promotion):p;this.board[m.from]=null;
  if(m.ep)this.board[m.to-dir]=null;
  if(m.castle) {const base=us==='w'?0:112,from=base+(m.castle==='k'?7:0),to=base+(m.castle==='k'?5:3);this.board[to]=this.board[from];this.board[from]=null;}
  if(p.toLowerCase()==='k')this.castling=this.castling.replace(us==='w'?/[KQ]/g:/[kq]/g,'');
  const corners={0:'Q',7:'K',112:'q',119:'k'};
  for(const s of [m.from,m.to])if(corners[s])this.castling=this.castling.replace(corners[s],'');
  this.ep=m.double?m.from+dir:-1;
  this.halfmove=p.toLowerCase()==='p'||m.captured?0:this.halfmove+1;
  if(us==='b')this.fullmove++;
  this.turn=opposite(us);
 }
 legalMoves() {
  const us=this.turn,legal=[];
  for(const m of this.pseudoMoves()){const s=this.snapshot();this.applyUnchecked(m);if(!this.inCheck(us))legal.push(m);this.restore(s);}
  return legal;
 }
 positionKey() {
  // An en passant target only changes repetition if a *legal* EP capture exists.
  const f=this.fen().split(' ');if(this.ep>=0&&!this.legalMoves().some(m=>m.ep))f[3]='-';return f.slice(0,4).join(' ');
 }
 move(input) {
  const legal=this.legalMoves(),target=typeof input==='string'?input.toLowerCase():squareName(input.from)+squareName(input.to)+(input.promotion||'');
  const m=legal.find(m=>uci(m)===target);if(!m)return null;
  const s=this.snapshot(),type=m.piece.toLowerCase();let san='';
  if(m.castle)san=m.castle==='k'?'O-O':'O-O-O';
  else {
   if(type!=='p') {
    san=type.toUpperCase();const others=legal.filter(x=>x.to===m.to&&x.from!==m.from&&x.piece===m.piece);
    if(others.length){const file=others.some(x=>(x.from&7)===(m.from&7)),rank=others.some(x=>(x.from>>4)===(m.from>>4));san+=!file?squareName(m.from)[0]:!rank?squareName(m.from)[1]:squareName(m.from);}
   } else if(m.captured)san=squareName(m.from)[0];
   if(m.captured)san+='x';san+=squareName(m.to);if(m.promotion)san+='='+m.promotion.toUpperCase();
  }
  this.applyUnchecked(m);if(this.inCheck())san+=this.legalMoves().length?'+':'#';
  const record={...m,uci:uci(m),san,color:s.turn,number:s.fullmove};
  const key=this.positionKey();this.repetitions.set(key,(this.repetitions.get(key)||0)+1);
  this.stack.push({state:s,key});this.records.push(record);return record;
 }
 undo() {const h=this.stack.pop();if(!h)return null;const n=this.repetitions.get(h.key)||1;if(n<=1)this.repetitions.delete(h.key);else this.repetitions.set(h.key,n-1);this.restore(h.state);return this.records.pop();}
 insufficientMaterial() {
  const pieces=this.board.map((p,s)=>({p,s})).filter(x=>x.p&&x.p.toLowerCase()!=='k');
  if(!pieces.length)return true;
  if(pieces.some(x=>/[pqr]/i.test(x.p)))return false;
  if(pieces.length===1)return true;
  if(pieces.every(x=>x.p.toLowerCase()==='b'))return new Set(pieces.map(x=>((x.s&7)+(x.s>>4))%2)).size===1;
  return false;
 }
 status() {
  const moves=this.legalMoves(),check=this.inCheck(),count=this.repetitions.get(this.positionKey())||0;
  let reason=null,winner=null;
  if(!moves.length){reason=check?'checkmate':'stalemate';if(check)winner=opposite(this.turn);}
  else if(this.insufficientMaterial())reason='material';
  else if(this.halfmove>=150)reason='seventyfive';
  else if(count>=5)reason='fivefold';
  return {over:!!reason,reason,winner,check,turn:this.turn,claimThreefold:count>=3,claimFifty:this.halfmove>=100};
 }
 exportState() {return {initialFen:this.initialFen,moves:this.records.map(m=>m.uci)};}
 static fromState(state) {
  if(!state||!Array.isArray(state.moves)||state.moves.length>10000)throw Error('棋局记录无效');
  const game=new Chess(state.initialFen);for(const m of state.moves)if(typeof m!=='string'||!game.move(m))throw Error('棋局包含非法走法');return game;
 }
 pgn(names={}) {
  const st=this.status(),result=st.over?(st.winner==='w'?'1-0':st.winner==='b'?'0-1':'1/2-1/2'):'*';
  const escape=s=>String(s).replace(/[\[\]"\\\r\n]/g,' ').slice(0,120);
  const tags=[['Event','Rose Chess'],['White',names.white||'White'],['Black',names.black||'Black'],['Result',names.result||result]];
  if(this.initialFen!==START_FEN)tags.push(['SetUp','1'],['FEN',this.initialFen]);
  let body='';for(let i=0;i<this.records.length;i++){const m=this.records[i];if(m.color==='w')body+=`${m.number}. `;else if(i===0)body+=`${m.number}... `;body+=m.san+' ';}
  return tags.map(([k,v])=>`[${k} "${escape(v)}"]`).join('\n')+'\n\n'+body+(names.result||result);
 }
}

const VALUES={p:100,n:320,b:335,r:500,q:900,k:0};
export function materialScore(game) {let score=0;for(const p of game.board)if(p)score+=(color(p)==='w'?1:-1)*VALUES[p.toLowerCase()];return score;}
function evaluate(game) {
 let score=materialScore(game);
 for(let s=0;s<128;s++){if(s&0x88){s+=7;continue;}const p=game.board[s];if(!p)continue;
  const t=p.toLowerCase(),sign=color(p)==='w'?1:-1,r=color(p)==='w'?s>>4:7-(s>>4),f=s&7;
  const center=7-(Math.abs(f-3.5)+Math.abs((s>>4)-3.5));
  score+=sign*(t==='p'?r*9+center*3:t==='n'?center*13:t==='b'?center*7:t==='k'?(r<2?10:0):center*2);
 }
 return score*(game.turn==='w'?1:-1);
}
function orderMoves(moves,best='') {return moves.sort((a,b)=>order(b)-order(a));function order(m){return (uci(m)===best?50000:0)+(m.captured?10*VALUES[m.captured.toLowerCase()]-VALUES[m.piece.toLowerCase()]:0)+(m.promotion?VALUES[m.promotion]:0)+(m.castle?25:0);}}
export function bestMove(game,{level='normal',timeMs,maxDepth}={}) {
 // Always search a private position: aborts never mutate the live board.
 const pos=new Chess(game.fen()),legal=pos.legalMoves();if(!legal.length)return {move:null,nodes:0,depth:0};
 const budgets={easy:180,normal:650,hard:1600},depths={easy:2,normal:3,hard:4};
 const deadline=Date.now()+(timeMs??budgets[level]??650),limit=maxDepth??depths[level]??3;
 let nodes=0,completed=0,chosen=uci(legal[0]),score=0;const STOP=Symbol('time'),tt=new Map();
 function negamax(depth,alpha,beta,ply) {
  nodes++;if((nodes&127)===0&&Date.now()>=deadline)throw STOP;
  const moves=pos.legalMoves();if(!moves.length)return pos.inCheck()?-100000+ply:0;
  if(pos.halfmove>=150||pos.insufficientMaterial())return 0;
  if(depth<=0)return evaluate(pos);
  const key=pos.fen(),cached=tt.get(key),a0=alpha;
  if(cached&&cached.depth>=depth){if(cached.flag==='exact')return cached.score;if(cached.flag==='lower')alpha=Math.max(alpha,cached.score);else beta=Math.min(beta,cached.score);if(alpha>=beta)return cached.score;}
  let value=-Infinity,best='';
  for(const m of orderMoves(moves,cached?.move)){
   const state=pos.snapshot();pos.applyUnchecked(m);let v;
   try{v=-negamax(depth-1,-beta,-alpha,ply+1);}finally{pos.restore(state);}
   if(v>value){value=v;best=uci(m);}alpha=Math.max(alpha,v);if(alpha>=beta)break;
  }
  tt.set(key,{depth,score:value,move:best,flag:value<=a0?'upper':value>=beta?'lower':'exact'});return value;
 }
 for(let depth=1;depth<=limit;depth++){
  const candidates=[];
  try{
   for(const m of orderMoves(legal.slice(),chosen)){
    if(Date.now()>=deadline&&candidates.length)throw STOP;
    const state=pos.snapshot();pos.applyUnchecked(m);let value;
    try{value=-negamax(depth-1,-Infinity,Infinity,1);}finally{pos.restore(state);}
    candidates.push({move:uci(m),score:value});
   }
   candidates.sort((a,b)=>b.score-a.score);let pick=candidates[0];
   if(level==='easy'){const near=candidates.filter(c=>c.score>=pick.score-100);pick=near[Math.floor(Math.random()*Math.min(4,near.length))];}
   chosen=pick.move;score=pick.score;completed=depth;
  }catch(e){if(e!==STOP)throw e;break;}
  if(Math.abs(score)>90000||Date.now()>=deadline)break;
 }
 return {move:chosen,score,nodes,depth:completed};
}
