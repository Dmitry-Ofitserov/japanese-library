/* ----- word reviews: picked or due blocks (reading the Japanese), hard words only, or an English → Japanese round after a block review ----- */
S.wcat=new Map(); S.rvVoice=LS.get('rvVoice',true);
/* time spent reviewing each block, in milliseconds (a card's time runs from showing it to answering it, at most 2 minutes) */
S.rvt=LS.get('rvt.v1',{});
function rvTimeAdd(w,ms){ const k=wbBlockOf(w); if(!k) return; const bk=k.ch[0].e.word; S.rvt[bk]=(S.rvt[bk]||0)+ms; LS.set('rvt.v1',S.rvt); lxStatSave(); }
/* the short form of a card: its two sides, nothing else */
function cardBrief(key){ const it=S.cat.get(key)||S.wcat.get(key); if(!it) return null;
  if(it.kind==='W'){ const e=it.w; return {f:'<span lang="ja">'+furi(e.word,e.reading)+'</span>', b:esc(lxEn(e))}; }
  if(it.kind==='K'){ const k=it.k; return {f:'<span lang="ja" class="rvpk">'+esc(k.k)+'</span>', b:esc(k.kw||'—')}; }
  const L=lineOf(it.gid,it.n); return L?{f:'<span lang="ja">'+jpHTML(L)+'</span>', b:esc(L.t||'')}:null; }
setInterval(()=>{ const s=S.sess, el=document.querySelector('.rvtime b'); if(!s||!el) return; el.textContent=lxClock((s.act||0)/1000+(s.tStart?Math.min(RVCAP/1000,(performance.now()-s.tStart)/1000):0)); },1000); S.rvMix=LS.get('rvMix',false);
function kKeyOf(x,dir){ const k=x.k, key='K|'+k.k+'|'+dir; S.wcat.set(key,{kind:'K',id:k.k,dir,k}); return key; }
const xKeyOf=(x,dir)=>x.kk?kKeyOf(x,dir):wKeyOf(x,dir);
const ridOf=it=>it.kind==='K'?'K|'+it.id:it.id;
function wKeyOf(x,dir){ const e=x.e||x; if(!e.inst && S.wpend && S.wpend.get(e.word)===e) prepWord(e); const k='W|'+e.word+'|'+dir; S.wcat.set(k,{kind:'W',id:e.word,dir,w:e}); return k; }
/* mode: 'blk' block review · 'hf' hard words, Japanese shown · 'hb' hard words, English shown · 'en' English round of the last block review */
function wbStart(mode,opt){
  opt=opt||{}; const kind=opt.kind==='K'?'K':'W', bl=blocksOf(kind), sel=(opt.sel||[]).filter(i=>bl[i]); let xs=[], dir='f', blocks=[];
  /* block by block (each block's words shuffled), or with the switch on, every word of every block in one random order */
  if(mode==='blk' || mode==='enb'){ blocks=sel.length?sel.map(i=>bl[i]):bl.filter(k=>k.isDue); blocks.forEach(k=>{ xs.push(...shuffle(k.ws.slice())); }); if(S.rvMix) xs=shuffle(xs);
    if(kind==='W' && S.lxs.dir==='ej'){ mode='en'; dir='b'; } }
  else if(mode==='hf'||mode==='hb'){ dir=mode==='hb'?'b':'f'; xs=shuffle(wbHardWords(dir,sel,kind)); }
  else if(mode==='en'){ dir='b'; xs=shuffle((S.wbLast||[]).slice()); }
  if(!xs.length){ toast(mode==='blk'?'Nothing to review: pick a block, or wait for one to come due.':'No hard '+(kind==='K'?'kanji':'words')+' here.'); return; }
  try{ lxCtx().resume(); }catch(e){}
  try{ if(LX.on && !LX.paused) lxPause(); }catch(e){}
  const keys=xs.map(x=>xKeyOf(x,dir)), K=xs.length&&xs[0].kk?'K':kind;
  S.sess={keys:new Set(keys), q:keys.slice(), i:0, shown:false, seen:new Set(), ok:0, bad:0, again:0, total:keys.length, wb:mode, xs, kind:K, grid:true};
  rgVoiceLoad(S.sess);
  if(S.view==='review') renderCard(); else nav('review');
}
/* one answer's effects (hard flag, easy cleared by a miss, block progress, session counts), without moving the queue */
function wbApply(s,key,ok){
  const it=S.wcat.get(key), w=ridOf(it), first=!s.seen.has(key); s.seen.add(key);
  if(!ok && easyOf(w)) setEasy(w,false,true);
  s.res=s.res||new Map(); s.res.set(key, ok?(first?'ok':'late'):'pend');
  if(first){ wbSetHard(w,it.dir,!ok); if(ok) s.ok++; else s.bad++; if(s.wb==='blk') wbMark(w); }
  else if(!ok) s.again++;
}
function wbAnswer(s,key,ok){
  wbApply(s,key,ok);
  s.q.splice(s.i,1);
  if(!ok) requeue(s,key,s.i);
}
/* the word read aloud from its recording (never the device voice) */
async function rvSay(w){
  try{ const I=await lxaIndex(), c=I&&lxaClip(w,'ja'); if(c){ await lxaPack(c[0]); if(LX.src){ try{ LX.src.stop(); }catch(e){} } await lxaPlay(c,1); } }catch(e){}
}
/* ----- grid review: word and kanji block sessions show 10 cards at a time (5 on a phone), filled top to bottom, left column first.
   Each card has ✓ and ✗; a vote shows the answer under the card and can be changed until the next batch is shown.
   ↑ yes / ↓ no vote the next card without a vote; ← / → change the card before it to no / yes; once every card has a vote, ↑ or ↓ shows the next batch.
   Votes count when the next batch is shown: a ✗ card goes back 11–80 cards ahead.
   Time per word: the gap between one vote and the next (at most 10 s each), summed, ÷ words answered right.
   Voice: only the recordings, sped up to 1.4× (pitch kept), with the silence before each word cut off, prepared before the batch shows. ----- */
const RG={rate:1.4, bufs:new Map(), src:null, guard:220};
const rgSize=()=>matchMedia('(max-width:640px)').matches?5:10;
/* the recording of a word as a ready buffer: sped up, starting at its first sound */
function rgBuf(w){
  if(RG.bufs.has(w)) return RG.bufs.get(w);
  const c=LXA.idx&&lxaClip(w,'ja'); if(!c) return null;
  const b=LXA.bufs.get(c[0]); if(!b) return null;
  const sr=b.sampleRate, a=Math.max(0,Math.floor((c[1]-.02)*sr)), z=Math.min(b.length,Math.ceil((c[1]+c[2]+.04)*sr));
  if(z<=a) return null;
  let y=lxStretch(b.getChannelData(0).slice(a,z),RG.rate,sr);
  let pk=0; for(let i=0;i<y.length;i++){ const v=Math.abs(y[i]); if(v>pk) pk=v; }
  if(pk<=0) return null;
  const th=Math.max(.003,pk*.04); let on=0; while(on<y.length && Math.abs(y[on])<th) on++;
  on=Math.max(0,on-Math.round(.004*sr)); y=y.slice(on);
  const fi=Math.min(y.length,Math.round(.003*sr)); for(let i=0;i<fi;i++) y[i]*=i/fi;
  const fo=Math.min(y.length,Math.round(.01*sr)); for(let i=0;i<fo;i++) y[y.length-1-i]*=i/fo;
  const nb=lxCtx().createBuffer(1,y.length,sr); nb.getChannelData(0).set(y);
  if(RG.bufs.size>600) RG.bufs.clear();
  RG.bufs.set(w,nb); return nb;
}
function rgStop(){ if(RG.src){ try{ RG.src.stop(); }catch(e){} RG.src=null; } if(LX.src){ try{ LX.src.stop(); }catch(e){} LX.src=null; } }
function rgPlay(w){
  if(!S.rvVoice || !w) return;
  const b=rgBuf(w); if(!b){ rgLoadWords([w]); return; }
  try{ const ac=lxCtx(); if(ac.state==='suspended') ac.resume().catch(()=>{});
    rgStop(); const src=ac.createBufferSource(), g=ac.createGain(); src.buffer=b; g.gain.value=S.vol; src.connect(g); g.connect(ac.destination);
    RG.src=src; src.onended=()=>{ if(RG.src===src) RG.src=null; }; src.start(0); }catch(e){}
}
/* load the packs holding these words' recordings; true when all of them arrived */
async function rgLoadWords(ws){
  const I=await lxaIndex(); if(!I) return false;
  const need=[...new Set(ws.map(w=>{ const c=lxaClip(w,'ja'); return c&&c[0]; }).filter(Boolean))];
  const r=await Promise.allSettled(need.map(n=>lxaPack(n)));
  return r.every(x=>x.status==='fulfilled');
}
const rgWordOf=key=>{ const c=S.wcat.get(key); return c&&c.kind==='W'?c.id:null; };
/* prepare the recordings of a list of cards (sync: about a millisecond a word) */
function rgPrep(keys){ if(!S.rvVoice) return; keys.forEach(k=>{ const w=rgWordOf(k); if(w) rgBuf(w); }); }
/* before the first batch: wait for the recordings (words only, voice on) */
function rgVoiceLoad(s){
  if(s.kind!=='W' || !S.rvVoice){ s.loading=false; return; }
  const first=s.q.slice(0,rgSize()).map(rgWordOf).filter(Boolean);
  s.loading=true;
  lxTO(rgLoadWords(first),30000,'recordings').catch(()=>false).then(ok=>{
    if(S.sess!==s) return; s.loading=false;
    if(!ok) toast('Some recordings could not be loaded: those words stay silent.');
    if(S.view==='review') renderCard();
    rgLoadRest(s); });
}
/* the other packs of the session, in the order their words come up, two at a time */
async function rgLoadRest(s){
  const I=await lxaIndex(); if(!I) return; const order=[];
  s.q.forEach(k=>{ const w=rgWordOf(k), c=w&&lxaClip(w,'ja'); if(c && !order.includes(c[0])) order.push(c[0]); });
  const todo=order.filter(n=>!LXA.bufs.has(n));
  for(let i=0;i<todo.length;i+=2){ if(S.sess!==s) return; await Promise.allSettled(todo.slice(i,i+2).map(n=>lxaPack(n))); }
  if(S.sess===s && s.b) rgPrep(s.b.items.map(x=>x.key));
}
/* the next batch of cards, taken off the front of the queue */
function rgNext(s){
  const size=rgSize(), items=[];
  while(s.q.length && items.length<size){ const key=s.q.shift(); if(!cardSides(key)) continue; items.push({key,vote:null,first:!s.seen.has(key),ch:0,perm:false}); }
  if(!items.length){ s.b=null; return false; }
  s.b={items,t0:performance.now(),lastAct:0}; s.nb=(s.nb||0)+1; if(s.tStart==null) s.tStart=s.b.t0;
  rgPrep(items.map(x=>x.key)); s.playFirst=true;
  return true;
}
/* the first card still waiting for a vote, or the batch length when every card has one */
const rgPtr=b=>{ const k=b.items.findIndex(x=>x.vote==null && !x.perm); return k<0?b.items.length:k; };
function rgCell(it,k){
  const c=S.wcat.get(it.key), K=c.kind==='K', f=c.dir!=='b', rid=ridOf(c), st=wbSt(rid), hard=f?st.hj:st.he, ez=easyOf(rid), nm=K?'kanji':'word';
  let front, main, dict='';
  if(K){ const kk=c.k;
    front=f?'<div class="rgw rgk" lang="ja">'+esc(kk.k)+'</div>':'<div class="rgw rgm">'+esc(kk.kw||'—')+'</div>';
    main=f?'<span class="rgmain">'+esc(kk.kw||'—')+'</span>':'<span class="rgmain rgjk" lang="ja">'+esc(kk.k)+'</span>'; }
  else { const e=c.w, en=lxEn(e), g=e.gloss&&e.gloss!==en?e.gloss:'';
    front=f?'<div class="rgw" lang="ja" data-a="rg-play" data-k="'+k+'">'+furi(e.word,e.reading)+'</div>':'<div class="rgw rgm">'+esc(en)+'</div>';
    main=f?'<span class="rgmain">'+esc(en)+'</span>':'<span class="rgmain rgjw" lang="ja" data-a="rg-play" data-k="'+k+'">'+furi(e.word,e.reading)+'</span>';
    if(f && g) dict='<div class="rgdict">'+esc(g)+'</div>'; }
  const fl='<span class="rgfl"><button class="rvfl'+(ez?' on':'')+'" data-a="rg-easy" data-k="'+k+'" aria-pressed="'+ez+'" title="'+(ez?'Easy: reviewed every third round · tap to review it every round':'Easy: review it only every third round')+'">'+ICO_EASY+'</button>'+
      '<button class="rvfl rgpm" data-a="rg-perm" data-k="'+k+'" aria-pressed="false" title="I will never forget this '+nm+': stop reviewing it forever">∞</button></span>';
  const tag=[hard?'hard':'',it.first?'':'again'].filter(Boolean).join(' · ');
  return '<div class="rgc" data-k="'+k+'">'+(tag?'<span class="rgtag">'+tag+'</span>':'')+front+
    '<div class="rga"><div class="rgr">'+main+fl+'</div>'+dict+'</div>'+
    '<div class="rgbt"><button class="rgb y" data-a="rg-v" data-v="y" data-k="'+k+'" aria-label="Remembered" title="Remembered (↑)">'+RVI.yes+'</button><button class="rgb n" data-a="rg-v" data-v="n" data-k="'+k+'" aria-label="Forgot" title="Forgot (↓)">'+RVI.no+'</button></div></div>';
}
function rgLeft(s){ return s.q.length+(s.b?s.b.items.filter(x=>x.vote==null&&!x.perm).length:0); }
function rgRender(){
  const s=S.sess; if(!s) return;
  const top=(n)=>'<div class="rvtop"><span class="rvp">'+n+' left</span>'+rvBar(s)+
    (s.kind==='W'?rvB('rv-voice',S.rvVoice?RVI.vol:RVI.mute,'rvvo'+(S.rvVoice?' on':''),S.rvVoice?'Voice on: the word is read aloud':'Voice off',''):'')+rvB('rv-quit',RVI.end,'rvend','End the session','')+'</div>';
  if(s.loading){ view.innerHTML='<section class="rvcard rgs">'+top(s.q.length)+rvCnt(s)+'<p class="rvq rgload">Loading the recordings…</p></section>'; return; }
  if(!s.b && !rgNext(s)){ finishSession(); return; }
  const b=s.b, n=b.items.length, cols=n>5?2:1, rows=Math.ceil(n/cols);
  view.innerHTML='<section class="rvcard rgs">'+top(rgLeft(s))+rvCnt(s)+rvStatHTML(s)+
    '<div class="rgg" style="--rgc:'+cols+';--rgr:'+rows+'">'+b.items.map(rgCell).join('')+'</div>'+
    '<div class="rgfoot"><button class="btn pri rgnext" data-a="rg-next" disabled>'+RVI.yes.replace('<path d="M5 12.5l4.5 4.5L19 7"/>','<path d="M12 4.5v14M6 13l6 6 6-6"/>')+'<span>'+(s.q.length?'Next '+Math.min(rgSize(),s.q.length):'Finish')+'</span><kbd>↑ / ↓</kbd></button>'+
      '<span class="rgkeys"><kbd>↑</kbd> yes <kbd>↓</kbd> no <kbd>←</kbd> <kbd>→</kbd> change the one before to no / yes</span></div></section>';
  rgPaint(true);
  if(s.playFirst){ s.playFirst=false;
    if(s.kind==='W' && b.items.length){ const it=b.items.find(x=>!x.perm), c=it&&S.wcat.get(it.key); if(c && c.dir!=='b') rgPlay(c.id); }
    setTimeout(()=>{ if(S.sess===s) rgPrep(s.q.slice(0,rgSize())); },60); }
}
/* update the batch in place: votes, the card waiting for a vote, the next button, the counters */
function rgPaint(first){
  const s=S.sess, b=s&&s.b; if(!b) return; const p=rgPtr(b);
  view.querySelectorAll('.rgc').forEach(el=>{ const k=+el.dataset.k, it=b.items[k]; if(!it) return; const c=S.wcat.get(it.key), ez=c&&easyOf(ridOf(c));
    el.classList.toggle('vy',it.vote==='y'&&!it.perm); el.classList.toggle('vn',it.vote==='n'&&!it.perm); el.classList.toggle('cur',k===p); el.classList.toggle('pm',it.perm);
    el.querySelector('.rgb.y').setAttribute('aria-pressed',it.vote==='y'); el.querySelector('.rgb.n').setAttribute('aria-pressed',it.vote==='n');
    const eb=el.querySelector('[data-a="rg-easy"]'); if(eb){ eb.classList.toggle('on',!!ez); eb.setAttribute('aria-pressed',!!ez); }
    const pb=el.querySelector('.rgpm'); if(pb){ pb.classList.toggle('on',it.perm); pb.setAttribute('aria-pressed',it.perm); } });
  const nx=view.querySelector('.rgnext'); if(nx) nx.disabled=p<b.items.length;
  const lp=view.querySelector('.rvtop .rvp'); if(lp) lp.textContent=rgLeft(s)+' left';
  if(!first){ const st=view.querySelector('.rvstat'); if(st) st.outerHTML=rvStatHTML(s); }
  rgShow(view.querySelector('.rgc.cur')||view.querySelector('.rgnext'));
}
/* keep a card in sight, below the sticky header */
function rgShow(el){
  if(!el) return; const hd=document.querySelector('header'), hb=hd?Math.max(0,hd.getBoundingClientRect().bottom):0, r=el.getBoundingClientRect();
  if(r.top<hb+4) scrollBy(0,r.top-hb-8); else if(r.bottom>innerHeight-4) scrollBy(0,Math.min(r.bottom-innerHeight+8,r.top-hb-8));
}
function rgVote(k,v){
  const s=S.sess, b=s&&s.b, it=b&&b.items[k]; if(!it || it.perm) return;
  const now=performance.now(); b.lastAct=now;
  if(it.vote==null){
    const ms=Math.min(RVCAP,Math.max(0,now-(s.tStart==null?b.t0:s.tStart))); s.tStart=now;
    s.act=(s.act||0)+ms; s.tw=s.tw||new Map(); s.tw.set(it.key,(s.tw.get(it.key)||0)+ms);
    const c=S.wcat.get(it.key); if(c) rvTimeAdd(ridOf(c),ms);
    it.vote=v;
    /* the voice: Japanese shown → the next card's word; English shown → this card's word, now that its answer shows */
    if(c && c.kind==='W'){ if(c.dir==='b') rgPlay(c.id); else { const nx=b.items.slice(k+1).find(x=>!x.perm); if(nx) rgPlay(rgWordOf(nx.key)); } }
  } else if(it.vote!==v){ it.vote=v; it.ch++; }
  else return;
  rgPaint();
}
/* the votes of the batch count: hard flags, block progress, misses back in the pile (partial: the session ends, cards without a vote are left out) */
function rgCommit(s,partial){
  const b=s.b; if(!b) return; s.b=null;
  b.items.forEach(it=>{ if(it.perm || it.vote==null) return;
    const ok=it.vote==='y'; wbApply(s,it.key,ok); if(!ok) requeue(s,it.key,0); rvDone(s,it.key,ok); });
  srsBadge();
}
function rgGo(){
  const s=S.sess, b=s&&s.b; if(!b || rgPtr(b)<b.items.length) return;
  if(b.lastAct && performance.now()-b.lastAct<RG.guard) return;
  rgCommit(s,false);
  if(!s.q.length){ finishSession(); return; }
  scrollTo(0,0); renderCard();
}
function rgEasy(k){ const s=S.sess, it=s&&s.b&&s.b.items[k]; if(!it) return; const c=S.wcat.get(it.key), w=ridOf(c); setEasy(w,!easyOf(w)); rgPaint(); }
/* ∞: the card leaves the session (both directions); tapping again puts it back */
function rgPerm(k){
  const s=S.sess, it=s&&s.b&&s.b.items[k]; if(!it) return; const c=S.wcat.get(it.key), w=ridOf(c), base=c.kind+'|'+c.id, on=!it.perm;
  if(on){ ['f','b'].forEach(d=>{ const key=base+'|'+d, i=s.q.indexOf(key); if(i>=0) s.q.splice(i,1);
      const r=(s.res||new Map()).get(key); if(s.keys&&s.keys.has(key)&&(!r||r==='pend')){ s.keys.delete(key); if(s.res) s.res.delete(key); s.total=Math.max(1,s.total-1); } }); }
  else if(s.keys && !s.keys.has(it.key)){ s.keys.add(it.key); s.total++; }
  it.perm=on;
  if(c.kind==='K') setPermK(c.id,on); else setPerm(c.id,on);
  if(on && s.wb==='blk') wbCheck(w);
  const bar=view.querySelector('.rvbar'); if(bar) bar.outerHTML=rvBar(s); const cn=view.querySelector('.rvcnt'); if(cn) cn.outerHTML=rvCnt(s);
  rgPaint();
}
function rgKey(e){
  const s=S.sess, b=s&&s.b; if(!b || s.loading) return; const k=e.key;
  if(k==='ArrowUp'||k==='ArrowDown'){ e.preventDefault(); if(e.repeat) return; const p=rgPtr(b); if(p>=b.items.length) rgGo(); else rgVote(p,k==='ArrowUp'?'y':'n'); }
  else if(k==='ArrowLeft'||k==='ArrowRight'){ e.preventDefault(); let p=rgPtr(b)-1; while(p>=0 && (b.items[p].perm || b.items[p].vote==null)) p--; if(p>=0) rgVote(p,k==='ArrowRight'?'y':'n'); }
  else if(k==='Enter'||k===' '){ e.preventDefault(); if(!e.repeat && rgPtr(b)>=b.items.length) rgGo(); }
}
function wbTagR(it,first){ const st=wbSt(ridOf(it)), hd=it.dir==='b'?st.he:st.hj;
  return [hd?'hard':'', first?'':'again'].filter(Boolean).join(' · '); }
function wbSectionHTML(){
  setTimeout(()=>{ lxaSavedN().then(n=>{ const x=$('#rgSaved'), I=LXA.idx; if(x && n!=null && I && !(($('#rgSave')||{}).disabled)) x.textContent=n>=I.packs.length?'All '+n+' packs are kept on this device':n+' of '+I.packs.length+' packs kept on this device'; }); },0);
  const bl=wbBlocks(), due=bl.filter(k=>k.isDue), dn=due.reduce((a,k)=>a+k.tot,0), nw=due.filter(k=>k.nn).length, hf=wbHardWords('f').length, hb=wbHardWords('b').length, st=bl.filter(k=>k.act).length;
  return '<div class="rvsec wbsec"><h2>Word blocks</h2><p class="wbline">'+(due.length?'<b>'+due.length+'</b> block'+(due.length===1?'':'s')+' due · '+dn+' words'+(nw?' · '+nw+' with new words':''):'No blocks due today.')+' · '+st+' of '+bl.length+' blocks started</p>'+
    '<div class="rvgo"><button class="btn pri" data-a="wb-due"'+(due.length?'':' disabled')+'>Review due blocks · '+dn+' words</button><button class="btn" data-a="wb-hard" data-hd="f"'+(hf?'':' disabled')+'>Hard words, JP → EN · '+hf+'</button><button class="btn" data-a="wb-hard" data-hd="b"'+(hb?'':' disabled')+'>Hard words, EN → JP · '+hb+'</button></div>'+
    '<p class="hint">To review particular blocks, pick them on the Words page. A day starts at 4:00 Moscow time.</p>'+
    '<div class="rvgo"><button class="btn" data-a="rg-save" id="rgSave">Keep all word recordings on this device</button><span class="mut" id="rgSaved"></span></div></div>';
}
function kbSectionHTML(){
  const bl=kbBlocks(), due=bl.filter(k=>k.isDue), dn=due.reduce((a,k)=>a+k.tot,0), hf=wbHardWords('f',[],'K').length, hb=wbHardWords('b',[],'K').length, st=bl.filter(k=>k.act && !k.fresh).length;
  return '<div class="rvsec wbsec"><h2>Kanji blocks</h2><p class="wbline">'+(due.length?'<b>'+due.length+'</b> block'+(due.length===1?'':'s')+' due · '+dn+' kanji':'No kanji blocks due today.')+' · '+st+' of '+bl.length+' blocks started</p>'+
    '<div class="rvgo"><button class="btn pri" data-a="kb-due"'+(due.length?'':' disabled')+'>Review due blocks · '+dn+' kanji</button><button class="btn" data-a="kb-hard" data-hd="f"'+(hf?'':' disabled')+'>Hard kanji, 字 → keyword · '+hf+'</button><button class="btn" data-a="kb-hard" data-hd="b"'+(hb?'':' disabled')+'>Hard kanji, keyword → 字 · '+hb+'</button></div>'+
    '<p class="hint">New blocks wait until you start them: pick them on the Kanji page.</p></div>';
}
function wbHardBtns(e){ const st=wbSt(e.word);
  return ['f','b'].map(d=>{ const on=!!st[d==='f'?'hj':'he'], t=d==='f'?'JP':'EN', side=d==='f'?'Japanese':'English';
    return '<button class="hdb'+(on?' on':'')+'" data-hard="'+d+'" data-hw="'+escA(e.word)+'" aria-pressed="'+on+'" title="'+(on?'Hard when you see the '+side+' · tap to clear':'Mark as hard when you see the '+side)+'">'+t+' hard</button>'; }).join(''); }
function wbPaintCell(w){ const st=wbSt(w); view.querySelectorAll('.wgc').forEach(c=>{ if(c.dataset.pw===w || (c.dataset.wi!=null && S.words[+c.dataset.wi] && S.words[+c.dataset.wi].word===w && c.dataset.ws==='w')){ c.classList.toggle('wghj',!!st.hj); c.classList.toggle('wghe',!!st.he); } }); }
function finishSession(){
  if(S.sess && S.sess.grid){ if(S.sess.b) rgCommit(S.sess,true); rgStop(); }
  const s=S.sess; S.sess=null; if(S.words && S._wc) updateBars();
  if(s && s.wb){
    const K=s.kind==='K', nm=K?'kanji':'words';
    if(s.wb==='blk'){ S.wbLast=s.xs.filter(x=>s.seen.has(x.kk?'K|'+x.k.k+'|f':'W|'+x.e.word+'|f')); S.wbLastKind=s.kind; }
    const lab=(K?{blk:'Kanji block review',hf:'Hard kanji · 字 → keyword',hb:'Hard kanji · keyword → 字',en:'Keyword → 字 round'}:{blk:'Block review',hf:'Hard words · JP → EN',hb:'Hard words · EN → JP',en:'EN → JP round'})[s.wb], n=(S.wbLast||[]).length;
    view.innerHTML='<section class="rv"><h2>'+lab+' done</h2><p>'+s.seen.size+' of '+s.total+' '+nm+' · '+s.ok+' right on the first try · '+s.bad+' missed, now marked hard'+(s.again?' · '+s.again+' more misses before they stuck':'')+(s.wd&&s.wd.size?' · '+(s.act/1000/s.wd.size).toFixed(2)+' s per '+(K?'kanji':'word'):'')+'.</p><div class="rvgo">'+
      (s.wb==='blk'&&n?'<button class="btn pri" data-a="wb-en">'+(K?'Keyword → 字':'EN → JP')+' round for these '+n+' '+nm+'</button>':'')+'<button class="btn" data-a="wb-back">Back to '+nm+'</button><button class="btn" data-a="rv-back">Review page</button></div></section>';
    srsBadge(); return; }
  view.innerHTML='<section class="rv"><h2>Session done</h2><p>'+s.total+' cards · '+s.ok+' remembered on the first try · '+s.bad+' forgotten'+(s.again?' · '+s.again+' more misses before they stuck':'')+'.</p><button class="btn pri" data-a="rv-back">Back to review</button></section>';
  srsBadge();
}
function playCard(btn){
  const s=S.sess; if(!s) return; const c=cardSides(s.q[s.i]); if(!c||!c.play) return;
  if(c.play.line){ speak({text:c.play.line.tk.map(h=>{ const s=spokenOf(h); return /^\s+$/.test(s)||s==='…'?'、':s; }).join(''), btn, rate:1}); return; }
  rvSay(c.play.word.word);
}
view.addEventListener('click',e=>{
  if(S.view!=='review') return;
  const t=e.target.closest('[data-a],[data-rm],[data-bkrm],[data-dir],[data-fr],.rvplay'); if(!t) return;
  if(t.dataset.bkrm!=null){ S.bucket=S.bucket.filter(x=>x!==t.dataset.bkrm); saveBucket(); renderReview(); return; }
  if(t.dataset.fr){ S.rv.fr=t.dataset.fr; saveRv(); renderReview(); return; }
  if(t.classList.contains('rvplay')){ e.stopPropagation(); playCard(t); return; }
  if(t.dataset.rm!=null){ S.rv.src.splice(+t.dataset.rm,1); saveRv(); renderReview(); return; }
  if(t.dataset.dir){ S.rv.dir=t.dataset.dir; saveRv(); renderReview(); return; }
  const a=t.dataset.a;
  if(a==='rv-ep'){ const k={}; view.querySelectorAll('.rvek').forEach(c=>{ k[c.value]=c.checked; }); if(k.L||k.W||k.K){ S.rv.src.push({t:'ep',gid:$('#rvEp').value,k}); saveRv(); renderReview(); } }
  else if(a==='rv-num'){ let x=Math.max(1,+$('#rvA').value||1), y=Math.max(1,+$('#rvB').value||1); if(y<x) [x,y]=[y,x]; const kd=$('#rvKind').value, tot=kd==='W'?(S.words||[]).length:(S.deck||[]).length; x=Math.min(x,tot); y=Math.min(y,tot); if(tot){ S.rv.nk=kd; S.rv.src.push({t:'num',kind:kd,a:x,b:y}); saveRv(); renderReview(); } }
  else if(a==='rv-start') startSession();
  else if(a==='rv-bkclear'){ S.bucket=[]; saveBucket(); renderReview(); }
  else if(a==='rv-show'){ if(S.sess){ S.sess.shown=true; renderCard(); } }
  else if(a==='rv-inst'){ if(S.sess) answer(true,true); }
  else if(a==='rv-dont'){ if(S.sess) answer(false); }
  else if(a==='rv-oops') rvOops();
  else if(a==='rv-fin'){ if(S.sess){ S.sess.fin=true; finishSession(); } }
  else if(a==='rv-easy'){ const s=S.sess; if(s && s.i<s.q.length){ const it=S.cat.get(s.q[s.i])||S.wcat.get(s.q[s.i]); if(it&&(it.kind==='W'||it.kind==='K')){ const w=ridOf(it); setEasy(w,!easyOf(w)); renderCard(); } } }
  else if(a==='wb-due') wbStart('blk',{sel:[]});
  else if(a==='wb-hard') wbStart(t.dataset.hd==='b'?'hb':'hf',{sel:[]});
  else if(a==='wb-en') wbStart('en',{kind:S.wbLastKind});
  else if(a==='wb-back') nav(S.wbLastKind==='K'?'kanji':'words');
  else if(a==='kb-due') wbStart('blk',{kind:'K',sel:[]});
  else if(a==='kb-hard') wbStart(t.dataset.hd==='b'?'hb':'hf',{kind:'K',sel:[]});
  else if(a==='rv-voice'){ S.rvVoice=!S.rvVoice; LS.set('rvVoice',S.rvVoice); if(!S.rvVoice){ if(LX.src){ try{ LX.src.stop(); }catch(_){} } rgStop(); }
    const s=S.sess; if(s && s.grid && S.rvVoice && s.kind==='W'){ const ks=(s.b?s.b.items.map(x=>x.key):[]).concat(s.q); rgLoadWords(ks.map(rgWordOf).filter(Boolean)).then(()=>{ if(S.sess===s) rgPrep(ks.slice(0,2*rgSize())); }); }
    if(s){ s.said=null; renderCard(); } }
  else if(a==='rv-perm'){ const s=S.sess; if(s && s.i<s.q.length){ const it=S.cat.get(s.q[s.i])||S.wcat.get(s.q[s.i]); if(it&&(it.kind==='W'||it.kind==='K')){ const w=ridOf(it), base=it.kind+'|'+it.id;
    ['f','b'].forEach(d=>{ const k=base+'|'+d, i=s.q.indexOf(k); if(i>=0) s.q.splice(i,1);
      const r=(s.res||new Map()).get(k); if(s.keys&&s.keys.has(k)&&(!r||r==='pend')){ s.keys.delete(k); if(s.res)s.res.delete(k); s.total=Math.max(1,s.total-1); } });
    if(it.kind==='K') setPermK(it.id,true); else setPerm(it.id,true); if(s.wb==='blk') wbCheck(w); s.shown=false; s.tStart=null; renderCard(); } } }
  else if(a==='rg-save'){ if(t.disabled) return; t.disabled=true; const sp=$('#rgSaved');
    lxaSaveAll((d,n)=>{ const x=$('#rgSaved'); if(x) x.textContent=d+' of '+n+' packs saved'; })
      .then(bad=>{ const x=$('#rgSaved'); if(x) x.textContent=bad?bad+' packs could not be saved, tap again to retry':'All recordings are kept on this device'; const b=$('#rgSave'); if(b) b.disabled=false; })
      .catch(e=>{ const x=$('#rgSaved'); if(x) x.textContent='Could not keep them: '+(e&&e.message||e); const b=$('#rgSave'); if(b) b.disabled=false; }); }
  else if(a==='rg-v') rgVote(+t.dataset.k,t.dataset.v);
  else if(a==='rg-next') rgGo();
  else if(a==='rg-play'){ const s=S.sess, it=s&&s.b&&s.b.items[+t.dataset.k]; if(it) rgPlay(rgWordOf(it.key)); }
  else if(a==='rg-easy') rgEasy(+t.dataset.k);
  else if(a==='rg-perm') rgPerm(+t.dataset.k);
  else if(a==='rv-yes') answer(true);
  else if(a==='rv-no') answer(false);
  else if(a==='rv-quit') finishSession();
  else if(a==='rv-back') renderReview();
},true);
view.addEventListener('input',e=>{
  if(S.view!=='review' || S.sess) return; const t=e.target;
  if(t.dataset.take){ const k=t.dataset.take, n=+t.max, v=+t.value; S.rv.take[k]=v>=n?null:v; saveRv(); const o=view.querySelector('[data-tv="'+k+'"]'); if(o) o.textContent=v+' / '+n; updateStart(); }
  else if(t.id==='rvMax'){ S.rv.max=Math.max(1,Math.floor(+t.value||1)); saveRv(); updateStart(); }
});
view.addEventListener('change',e=>{
  if(S.view!=='review' || S.sess) return; const t=e.target;
  if(t.id==='rvOnly'){ S.rv.onlyDue=t.checked; saveRv(); updateStart(); }
  else if(t.id==='rvBk'){ S.rv.bk=t.checked; saveRv(); updateStart(); }
  else if(t.id==='rvLim'){ S.rv.lim=t.checked; saveRv(); const m=$('#rvMax'); if(m) m.disabled=!t.checked; updateStart(); }
  else if(t.id==='rvKind'){ S.rv.nk=t.value; saveRv(); const tot=t.value==='W'?(S.words||[]).length:(S.deck||[]).length; $('#rvOf').textContent='of '+tot; const bb=$('#rvB'); if(+bb.value>tot) bb.value=tot; }
});
document.addEventListener('keydown',e=>{
  if(S.view!=='review' || !S.sess || e.target.closest('input,select,textarea')) return;
  if(e.ctrlKey||e.metaKey||e.altKey) return;
  const s=S.sess, live=s.i<s.q.length;
  if(s.grid){ rgKey(e); return; }
  if(e.key==='0'){ e.preventDefault(); rvOops(); }
  else if(!live){ if(e.key===' '||e.key==='Enter'){ e.preventDefault(); s.fin=true; finishSession(); } }
  else if(!s.shown && (e.key===' '||e.key==='Enter')){ e.preventDefault(); s.shown=true; renderCard(); }
  else if(e.key==='1'||e.key==='f'){ e.preventDefault(); answer(false); }
  else if(s.shown && (e.key==='2'||e.key==='j')){ e.preventDefault(); answer(true); }
  else if(!s.shown && e.key==='3'){ e.preventDefault(); answer(true,true); }
});


