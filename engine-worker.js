import {Chess,bestMove} from './chess-core.js';
self.onmessage=({data})=>{try{const game=Chess.fromState(data.state);self.postMessage({id:data.id,...bestMove(game,{level:data.level})});}catch(error){self.postMessage({id:data.id,error:error.message});}};
