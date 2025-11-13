/*
  script.js - full game logic and UI wiring
  Sections: Helpers, Board/State, Move Generation, Legality & Check, Move Execution & History,
  UI, Timers, Undo/Redo, Init
*/
(function(){
  'use strict';

  /* =================== Constants & Globals =================== */
  const FILES = ['a','b','c','d','e','f','g','h'];
  const RANKS = [1,2,3,4,5,6,7,8];
  const PIECE_UNICODE = {
    pawn:   {white:'♙', black:'♟'},
    rook:   {white:'♖', black:'♜'},
    knight: {white:'♘', black:'♞'},
    bishop: {white:'♗', black:'♝'},
    queen:  {white:'♕', black:'♛'},
    king:   {white:'♔', black:'♚'}
  };

  // State
  let board = null; // 8x8 array [file][rank] or map keyed 'a1'
  let currentTurn = 'white';
  let moveHistory = [];
  let redoStack = [];
  let gamePaused = true;
  let gameOver = false;
  let lastMove = null;
  let lastMoveHighlight = null;
  let selectedSquare = null;
  let captured = {white:[], black:[]};
  let timers = {white:600, black:600, iv:null};
  let timerInterval = null;
  let lastMoveMeta = null; // for en-passant detection

  // Cached DOM
  const DOM = {};

  /* =================== Helpers =================== */
  function sq(f,r){ return `${f}${r}` }
  function inBounds(fileIdx,rankIdx){ return fileIdx>=0&&fileIdx<8&&rankIdx>=0&&rankIdx<8 }
  function fileRankToIdx(f,r){ return [FILES.indexOf(f), RANKS.indexOf(r)+0] }
  function idxToFileRank(fi,ri){ return [FILES[fi], RANKS[ri]] }
  function clonePiece(p){ return p ? {...p} : null; }
  function cloneBoard(b){ const nb={}; for(let k in b) nb[k]=b[k]?{...b[k]}:null; return nb }
  function formatTime(secs){ const m=Math.floor(secs/60), s=secs%60; return `${m}:${s.toString().padStart(2,'0')}` }

  /* =================== Board & State initialization =================== */
  function initBoard(){
    board = {};
    // clear
    for(let f of FILES) for(let r of RANKS) board[sq(f,r)] = null;
    // pawns
    for(let i=0;i<8;i++){ board[sq(FILES[i],2)] = {type:'pawn', color:'white', moved:false, id:`w-p-${i}`}; board[sq(FILES[i],7)] = {type:'pawn', color:'black', moved:false, id:`b-p-${i}`}; }
    // rooks
    board['a1']={type:'rook', color:'white', moved:false, id:'w-r-a1'}; board['h1']={type:'rook', color:'white', moved:false, id:'w-r-h1'};
    board['a8']={type:'rook', color:'black', moved:false, id:'b-r-a8'}; board['h8']={type:'rook', color:'black', moved:false, id:'b-r-h8'};
    // knights
    board['b1']={type:'knight', color:'white', moved:false, id:'w-n-b1'}; board['g1']={type:'knight', color:'white', moved:false, id:'w-n-g1'};
    board['b8']={type:'knight', color:'black', moved:false, id:'b-n-b8'}; board['g8']={type:'knight', color:'black', moved:false, id:'b-n-g8'};
    // bishops
    board['c1']={type:'bishop', color:'white', moved:false, id:'w-b-c1'}; board['f1']={type:'bishop', color:'white', moved:false, id:'w-b-f1'};
    board['c8']={type:'bishop', color:'black', moved:false, id:'b-b-c8'}; board['f8']={type:'bishop', color:'black', moved:false, id:'b-b-f8'};
    // queens
    board['d1']={type:'queen', color:'white', moved:false, id:'w-q'}; board['d8']={type:'queen', color:'black', moved:false, id:'b-q'};
    // kings
    board['e1']={type:'king', color:'white', moved:false, id:'w-k'}; board['e8']={type:'king', color:'black', moved:false, id:'b-k'};

    moveHistory = []; redoStack = []; captured = {white:[], black:[]}; currentTurn='white'; gamePaused=true; gameOver=false; lastMove=null; lastMoveMeta=null; selectedSquare=null;
  }

  function renderBoard(full=false){
    const boardEl = DOM.board;
    // create cells if empty
    if(boardEl.children.length===0 || full){
      boardEl.innerHTML='';
      // ranks 8->1 to show white at bottom
      for(let r=8;r>=1;r--){
        for(let f=0;f<8;f++){
          const s = sq(FILES[f],r);
          const cell = document.createElement('div');
          cell.className = 'cell '+(((f+r)%2===0)?'light':'dark');
          cell.dataset.square = s;
          cell.setAttribute('role','gridcell');
          cell.tabIndex = 0;
          cell.addEventListener('click', handleCellClick);
          cell.addEventListener('keydown', handleCellKeyDown);
          const label = document.createElement('div'); label.className='label'; label.textContent=s;
          cell.appendChild(label);
          boardEl.appendChild(cell);
        }
      }
    }
    // update pieces
    for(let i=0;i<boardEl.children.length;i++){
      const cell = boardEl.children[i]; const s = cell.dataset.square; const p = board[s];
      cell.innerHTML='';
      const label = document.createElement('div'); label.className='label'; label.textContent=s; cell.appendChild(label);
      if(p){
        const span = document.createElement('div'); span.className='piece'; span.textContent = PIECE_UNICODE[p.type][p.color]; span.setAttribute('aria-hidden','true');
        cell.appendChild(span);
      }
      cell.classList.remove('selected','last-move','in-check');
    }
    // last move highlight
    if(lastMove){
      markLastMove(lastMove.from, lastMove.to);
    }
    // highlight check if any
    const inCheckColor = isKingInCheck(currentTurn) ? currentTurn : null;
    if(inCheckColor){
      const kingSq = findKingSquare(inCheckColor);
      if(kingSq){ getCell(kingSq).classList.add('in-check'); }
    }
    updateCapturedAreas(); updateTimersDisplay(); updateTurnIndicator();
  }

  /* =================== Move Generation =================== */
  function exploreDirections(from, dirs, color){
    const res = [];
    const [f0,r0] = [FILES.indexOf(from[0]), parseInt(from[1])-1];
    for(const d of dirs){
      let fi=f0+d[0], ri=r0+d[1];
      while(inBounds(fi,ri)){
        const s = sq(FILES[fi], ri+1);
        if(board[s]===null){ res.push(s); }
        else{ if(board[s].color!==color) res.push(s); break; }
        fi+=d[0]; ri+=d[1];
      }
    }
    return res;
  }

  function getPawnMoves(from){
    const p = board[from]; if(!p) return [];
    const dir = p.color==='white'?1:-1; const [f,r] = [FILES.indexOf(from[0]), parseInt(from[1])];
    const moves = [];
    const one = sq(FILES[f], r+dir);
    if(inBounds(f, (r-1)+dir) && board[one]===null) moves.push(one);
    // double
    const startRank = p.color==='white'?2:7;
    const two = sq(FILES[f], r+2*dir);
    if(r===startRank && board[one]===null && board[two]===null) moves.push(two);
    // captures
    for(const df of [-1,1]){
      const fi = f+df; const ri = r+dir;
      if(inBounds(fi,ri-1)){
        const s = sq(FILES[fi],ri);
        if(board[s] && board[s].color!==p.color) moves.push(s);
        // en-passant
        if(lastMoveMeta && lastMoveMeta.piece && lastMoveMeta.piece.type==='pawn' && Math.abs(lastMoveMeta.rfrom-lastMoveMeta.rto)===2){
          const lmFile = lastMoveMeta.to[0]; const lmRank = lastMoveMeta.to[1];
          if(FILES[fi]===lmFile && (ri)===parseInt(lmRank) && Math.abs(fi - FILES.indexOf(lmFile))===0){
            // adjacent pawn double-step captured by en-passant target square
            const epCaptureSq = sq(FILES[fi], r+dir);
            moves.push(epCaptureSq);
          }
        }
      }
    }
    return moves;
  }

  function getKnightMoves(from){
    const p = board[from]; if(!p) return [];
    const [f0,r0] = [FILES.indexOf(from[0]), parseInt(from[1])];
    const steps = [[1,2],[2,1],[2,-1],[1,-2],[-1,-2],[-2,-1],[-2,1],[-1,2]];
    const res=[];
    for(const s of steps){ const fi=f0+s[0], ri=r0-1+s[1]; if(inBounds(fi,ri)){
      const sqn = sq(FILES[fi],ri+1); if(!board[sqn]|| board[sqn].color!==p.color) res.push(sqn);
    }}
    return res;
  }

  function getBishopMoves(from){ return exploreDirections(from, [[1,1],[1,-1],[-1,1],[-1,-1]], board[from].color) }
  function getRookMoves(from){ return exploreDirections(from, [[1,0],[-1,0],[0,1],[0,-1]], board[from].color) }
  function getQueenMoves(from){ return exploreDirections(from, [[1,1],[1,-1],[-1,1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]], board[from].color) }

  function getKingMoves(from){
    const p = board[from]; if(!p) return [];
    const [f0,r0] = [FILES.indexOf(from[0]), parseInt(from[1])-1];
    const res=[];
    for(let df=-1;df<=1;df++) for(let dr=-1;dr<=1;dr++){ if(df===0&&dr===0) continue; const fi=f0+df, ri=r0+dr; if(inBounds(fi,ri)){
      const s=sq(FILES[fi],ri+1); if(!board[s]|| board[s].color!==p.color) res.push(s);
    }}
    // castling
    if(!p.moved && !isKingInCheck(p.color)){
      // kingside
      const rank = p.color==='white'?1:8; const fK=FILES.indexOf(from[0]);
      const rookKSq = sq('h', rank);
      const rookQSq = sq('a', rank);
      const rookK = board[rookKSq];
      if(rookK && rookK.type==='rook' && !rookK.moved){
        const between = [sq('f',rank), sq('g',rank)]; if(between.every(s=>board[s]===null) && between.every(s=>!isSquareAttacked(s, oppositeColor(p.color)))) res.push(sq('g',rank));
      }
      // queenside
      const rookQ = board[rookQSq];
      if(rookQ && rookQ.type==='rook' && !rookQ.moved){
        const between = [sq('b',rank), sq('c',rank), sq('d',rank)]; if(between.every(s=>board[s]===null) && ['c','d'].map(f=>sq(f,rank)).every(s=>!isSquareAttacked(s, oppositeColor(p.color)))) res.push(sq('c',rank));
      }
    }
    return res;
  }

  function oppositeColor(c){ return c==='white'?'black':'white' }

  /* =================== Legality & Check detection =================== */
  function isSquareAttacked(square, byColor){
    // iterate opponent pieces and see if any of their candidate moves include square (use attack patterns)
    for(const k in board){ const p=board[k]; if(p && p.color===byColor){
      let attacks=[];
      if(p.type==='pawn'){
        const dir = p.color==='white'?1:-1; const f=FILES.indexOf(k[0]); const r=parseInt(k[1]);
        for(const df of [-1,1]){ const fi=f+df, ri=r+dir; if(inBounds(fi,ri-1)) attacks.push(sq(FILES[fi],ri)); }
      } else if(p.type==='knight') attacks = getKnightMoves(k);
      else if(p.type==='bishop') attacks = getBishopMoves(k);
      else if(p.type==='rook') attacks = getRookMoves(k);
      else if(p.type==='queen') attacks = getQueenMoves(k);
      else if(p.type==='king'){
        // king attacks adjacent squares
        const [f0,r0] = [FILES.indexOf(k[0]), parseInt(k[1])-1];
        for(let df=-1;df<=1;df++) for(let dr=-1;dr<=1;dr++){ if(df===0&&dr===0) continue; const fi=f0+df, ri=r0+dr; if(inBounds(fi,ri)) attacks.push(sq(FILES[fi],ri+1)); }
      }
      if(attacks.includes(square)) return true;
    }}
    return false;
  }

  function findKingSquare(color){ for(const k in board){ const p=board[k]; if(p && p.type==='king' && p.color===color) return k } return null }

  function isKingInCheck(color){ const ksq = findKingSquare(color); if(!ksq) return false; return isSquareAttacked(ksq, oppositeColor(color)); }

  function getAllLegalMovesForColor(color){
    const all = {};
    for(const k in board){ const p=board[k]; if(p && p.color===color){ const candidates = getCandidates(k); const legal = candidates.filter(to=>isMoveLegal(k,to)); if(legal.length) all[k]=legal; }}
    return all;
  }

  function getCandidates(from){ const p = board[from]; if(!p) return []; switch(p.type){
    case 'pawn': return getPawnMoves(from);
    case 'knight': return getKnightMoves(from);
    case 'bishop': return getBishopMoves(from);
    case 'rook': return getRookMoves(from);
    case 'queen': return getQueenMoves(from);
    case 'king': return getKingMoves(from);
  }
}

  function isMoveLegal(from, to){
    // simulate apply and test king not in check
    const snapshot = {fromPiece: board[from] ? {...board[from]} : null, toPiece: board[to] ? {...board[to]}:null, lastMoveMeta: lastMoveMeta?{...lastMoveMeta}:null};
    const meta = applyMoveInternal(from,to,{test:true});
    const inCheck = isKingInCheck(snapshot.fromPiece.color);
    // undo simulation
    undoApplyInternal(meta);
    lastMoveMeta = snapshot.lastMoveMeta;
    return !inCheck;
  }

  /* =================== Move Execution & History =================== */
  function applyMoveInternal(from,to,opts={}){
    // return an object that can be used to undo
    const moving = board[from]; if(!moving) return null;
    const capturedPiece = board[to] ? {...board[to]} : null;
    const meta = {from,to,moving:{...moving},captured:capturedPiece, special:null, prevMovedFrom:moving.moved, prevLastMoveMeta:lastMoveMeta?{...lastMoveMeta}:null };
    // handle en-passant capture: pawn moves diagonally to empty square when last move was double step
    if(moving.type==='pawn' && !capturedPiece && from[0]!==to[0]){
      // en-passant capture; captured pawn is behind the to square
      const dir = moving.color==='white'? -1 : 1; // because board orientation
      const capSq = sq(to[0], parseInt(to[1])+dir);
      meta.special = {type:'en-passant', capturedSq:capSq, capturedPiece: board[capSq]?{...board[capSq]}:null};
      board[capSq] = null;
    }
    // castling
    if(moving.type==='king' && Math.abs(FILES.indexOf(from[0]) - FILES.indexOf(to[0]))>1){
      // kingside or queenside
      const rank = parseInt(from[1]);
      if(to[0]==='g'){
        const rookFrom = sq('h',rank), rookTo = sq('f',rank); meta.special={type:'castle', rookFrom, rookTo, rook:{...board[rookFrom]}}; board[rookTo]=board[rookFrom]; board[rookTo].moved=true; board[rookFrom]=null;
      } else if(to[0]==='c'){
        const rookFrom = sq('a',rank), rookTo = sq('d',rank); meta.special={type:'castle', rookFrom, rookTo, rook:{...board[rookFrom]}}; board[rookTo]=board[rookFrom]; board[rookTo].moved=true; board[rookFrom]=null;
      }
    }
    // normal move
    board[to] = {...moving, moved:true}; board[from]=null;

    // promotion check - handled outside by commit flow that shows modal
    // update lastMoveMeta for en-passant detection
    meta.prevLastMoveMeta = lastMoveMeta?{...lastMoveMeta}:null;
    lastMoveMeta = {piece:meta.moving, from, to, rfrom:parseInt(from[1]), rto:parseInt(to[1])};
    return meta;
  }

  function undoApplyInternal(meta){
    if(!meta) return;
    board[meta.from] = {...meta.moving}; board[meta.from].moved = meta.prevMovedFrom;
    board[meta.to] = meta.captured?{...meta.captured}:null;
    if(meta.special){
      if(meta.special.type==='en-passant'){
        board[meta.special.capturedSq] = meta.special.capturedPiece?{...meta.special.capturedPiece}:null; board[meta.to]=null;
      } else if(meta.special.type==='castle'){
        board[meta.special.rookFrom] = {...meta.special.rook}; board[meta.special.rookTo]=null;
      }
    }
    lastMoveMeta = meta.prevLastMoveMeta?{...meta.prevLastMoveMeta}:null;
  }

  function commitMove(from,to){
    const preMeta = applyMoveInternal(from,to);
    // check promotion
    if(preMeta && preMeta.moving.type==='pawn' && (to[1]==='8' || to[1]==='1')){
      // show promotion overlay and wait; store preMeta and selection
      showPromotionModal(preMeta, (choice)=>{
        // replace pawn
        board[to] = {type:choice, color:preMeta.moving.color, moved:true, id:preMeta.moving.id+'-prom-'+choice};
        finalizeCommit(preMeta);
      });
      return;
    }
    finalizeCommit(preMeta);
  }

  function finalizeCommit(meta){
    // capture accounting
    if(meta.captured){ captured[meta.captured.color].push(meta.captured); }
    moveHistory.push({...meta, timestamp:Date.now()}); redoStack=[]; lastMove = {from:meta.from,to:meta.to};
    // flip turn
    currentTurn = oppositeColor(currentTurn);
    // timers
    stopTimer(); startTimer(currentTurn);
    // UI updates
    renderBoard();
    // game end checks
    const opp = currentTurn; const inCheck = isKingInCheck(opp); const moves = getAllLegalMovesForColor(opp);
    if(inCheck && Object.keys(moves).length===0){ gameOver=true; gamePaused=true; showGameEndModal('Checkmate!', oppositeColor(opp)+' Wins!'); }
    else if(!inCheck && Object.keys(moves).length===0){ gameOver=true; gamePaused=true; showGameEndModal('Stalemate', 'It\'s a Draw!'); }
    else if(inCheck){ showToast(oppositeColor(opp)+' gave check','info'); }
  }

  function makeMove(from,to){
    if(gamePaused || gameOver) return showToast('Game is paused or over','error');
    const p = board[from]; if(!p) return;
    if(p.color!==currentTurn) return showToast('Not your turn','error');
    const candidates = getCandidates(from).filter(t=>isMoveLegal(from,t));
    if(!candidates.includes(to)) return showToast('Illegal move','error');
    commitMove(from,to);
  }

  /* =================== Undo / Redo =================== */
  function undo(){ if(moveHistory.length===0) return showToast('Nothing to undo','info'); const meta = moveHistory.pop(); // undo commit
    // reverse
    undoApplyInternal(meta);
    // restore captured array if any
    if(meta.captured){ const arr=captured[meta.captured.color]; if(arr && arr.length) arr.pop(); }
    redoStack.push(meta); currentTurn = oppositeColor(currentTurn); gameOver=false; renderBoard(); }

  function redo(){ if(redoStack.length===0) return showToast('Nothing to redo','info'); const meta = redoStack.pop(); // reapply
    // reapply move: reapply effect similar to applyMoveInternal but without prompting
    const reapply = applyMoveInternal(meta.from, meta.to); moveHistory.push({...reapply, timestamp:Date.now()}); currentTurn = oppositeColor(currentTurn); renderBoard(); }

  /* =================== UI Helpers =================== */
  function getCell(s){ return DOM.board.querySelector(`[data-square='${s}']`) }
  function clearHighlights(){ for(const c of DOM.board.children){ c.querySelectorAll('.move-dot, .capture-dot').forEach(x=>x.remove()); c.classList.remove('selected'); } }
  function showPossibleMoves(from){ clearHighlights(); selectedSquare = from; const cell = getCell(from); if(cell) cell.classList.add('selected'); const p = board[from]; if(!p) return; const cand = getCandidates(from).filter(t=>isMoveLegal(from,t));
    for(const t of cand){ const target = getCell(t); if(!target) continue; if(board[t]){ const cd = document.createElement('div'); cd.className='capture-dot'; target.appendChild(cd); } else { const d = document.createElement('div'); d.className='move-dot'; target.appendChild(d); } }
  }

  function markLastMove(from,to){ const fcell = getCell(from); const tcell = getCell(to); if(fcell) fcell.classList.add('last-move'); if(tcell) tcell.classList.add('last-move'); }

  function updateCapturedAreas(){ const w = DOM.capturedWhite; const b = DOM.capturedBlack; w.innerHTML=''; b.innerHTML=''; for(const p of captured.white){ const s=document.createElement('div'); s.className='capt'; s.textContent = PIECE_UNICODE[p.type].white; w.appendChild(s);} for(const p of captured.black){ const s=document.createElement('div'); s.className='capt'; s.textContent = PIECE_UNICODE[p.type].black; b.appendChild(s);} }

  function updateTurnIndicator(){ // visual indicator via timers or styles
    // noop for now
  }

  function showToast(msg, type='info', ttl=3000){ const t = document.createElement('div'); t.className='toast '+type; t.textContent=msg; DOM.toast.appendChild(t); setTimeout(()=>{ t.classList.add('fade'); t.remove(); }, ttl); }

  /* =================== Promotion modal =================== */
  function showPromotionModal(preMeta, onPick){ DOM.promotionOverlay.classList.remove('hidden'); DOM.promoChoices.innerHTML=''; const choices=['queen','rook','bishop','knight']; for(const c of choices){ const b=document.createElement('button'); b.textContent = PIECE_UNICODE[c][preMeta.moving.color]; b.addEventListener('click', ()=>{ DOM.promotionOverlay.classList.add('hidden'); onPick(c); }); DOM.promoChoices.appendChild(b); } }

  /* =================== Game End modal =================== */
  function showGameEndModal(title, message){ DOM.gameendTitle.textContent = title; DOM.gameendMessage.textContent = message; DOM.gameendOverlay.classList.remove('hidden'); }

  /* =================== UI Event Handlers =================== */
  function handleCellClick(e){ const cell = e.currentTarget; const s = cell.dataset.square; if(selectedSquare===null){ // no selection
    if(board[s] && board[s].color===currentTurn){ showPossibleMoves(s); } else { showToast('Select a piece of your color','info'); }
  } else if(selectedSquare===s){ clearHighlights(); selectedSquare=null; }
  else{ // attempt move
    if(board[s] && board[s].color===currentTurn){ // switch selection
      showPossibleMoves(s);
    } else { makeMove(selectedSquare, s); clearHighlights(); selectedSquare=null; }
  }}

  function handleCellKeyDown(e){ const el = e.currentTarget; if(e.key==='Enter'){ el.click(); } }

  /* =================== Timers =================== */
  let activeTimerColor = null;
  function startTimer(color){ stopTimer(); activeTimerColor = color; DOM.timerWhite.classList.toggle('active', color==='white'); DOM.timerBlack.classList.toggle('active', color==='black'); timerInterval = setInterval(()=>{ if(gamePaused||gameOver) return; timers[color]--; if(timers[color]<=0){ clearInterval(timerInterval); gameOver=true; gamePaused=true; showGameEndModal('Time\'s Up!', oppositeColor(color)+' Wins!'); } updateTimersDisplay(); },1000); }
  function stopTimer(){ if(timerInterval) clearInterval(timerInterval); timerInterval=null; activeTimerColor=null; DOM.timerWhite.classList.remove('active'); DOM.timerBlack.classList.remove('active'); }
  function updateTimersDisplay(){ DOM.timerWhite.textContent = `White: ${formatTime(timers.white)}`; DOM.timerBlack.textContent = `Black: ${formatTime(timers.black)}`; }

  /* =================== Controls binding =================== */
  let isDarkMode = false;
  function bindControls(){ DOM.btnStart.addEventListener('click', ()=>{ DOM.startOverlay.classList.remove('hidden'); });
    DOM.overlayStart.addEventListener('click', ()=>{ const mins = Math.max(1, parseInt(DOM.inputMinutes.value)||10); timers.white = timers.black = mins*60; gamePaused=false; DOM.startOverlay.classList.add('hidden'); startTimer(currentTurn); renderBoard(true); });
    DOM.btnPause.addEventListener('click', ()=>{ gamePaused=true; stopTimer(); DOM.pausedOverlay.classList.remove('hidden'); });
    DOM.overlayResume.addEventListener('click', ()=>{ gamePaused=false; DOM.pausedOverlay.classList.add('hidden'); startTimer(currentTurn); });
    DOM.btnRestart.addEventListener('click', ()=>{ initBoard(); renderBoard(true); DOM.startOverlay.classList.remove('hidden'); stopTimer(); });
    DOM.btnUndo.addEventListener('click', ()=>{ undo(); });
    DOM.btnRedo.addEventListener('click', ()=>{ redo(); });
    DOM.themeToggle.addEventListener('click', ()=>{ isDarkMode = !isDarkMode; document.documentElement.classList.toggle('dark-ui', isDarkMode); DOM.themeToggle.classList.toggle('dark', isDarkMode); DOM.themeToggle.textContent = isDarkMode ? '🌙 Dark' : '☀️ Light'; });
    DOM.overlayPlayAgain.addEventListener('click', ()=>{ DOM.gameendOverlay.classList.add('hidden'); initBoard(); renderBoard(true); DOM.startOverlay.classList.remove('hidden'); stopTimer(); });
  }

  /* =================== Init =================== */
  function init(){
    // cache DOM
    DOM.board = document.getElementById('board'); DOM.capturedWhite = document.getElementById('captured-white'); DOM.capturedBlack = document.getElementById('captured-black'); DOM.timerWhite = document.getElementById('timer-white'); DOM.timerBlack = document.getElementById('timer-black'); DOM.toast = document.getElementById('toast-container');
    DOM.startOverlay = document.getElementById('start-overlay'); DOM.promotionOverlay = document.getElementById('promotion-overlay'); DOM.pausedOverlay = document.getElementById('paused-overlay'); DOM.gameendOverlay = document.getElementById('gameend-overlay'); DOM.gameendTitle = document.getElementById('gameend-title'); DOM.gameendMessage = document.getElementById('gameend-message'); DOM.promoChoices = document.getElementById('promo-choices');
    DOM.btnStart = document.getElementById('btn-start'); DOM.btnPause = document.getElementById('btn-pause'); DOM.btnRestart = document.getElementById('btn-restart'); DOM.btnUndo = document.getElementById('btn-undo'); DOM.btnRedo = document.getElementById('btn-redo'); DOM.themeToggle = document.getElementById('btn-theme'); DOM.inputMinutes = document.getElementById('input-minutes'); DOM.overlayStart = document.getElementById('overlay-start'); DOM.overlayResume = document.getElementById('overlay-resume'); DOM.overlayPlayAgain = document.getElementById('overlay-playagain');

    bindControls(); initBoard(); renderBoard(true); DOM.startOverlay.classList.remove('hidden');
    // keyboard navigation basic
    window.addEventListener('keydown',(e)=>{
      if(e.key==='Escape'){ clearHighlights(); selectedSquare=null; }
    });
  }

  // expose for manual testing in console
  window.chess = { init, board, getCell, makeMove, undo, redo };

  init();

})();
