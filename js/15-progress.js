/* ---------- progress bars ---------- */
const STAGES=[
  /* JLPT word counts are the usual unofficial estimates (the test publishes no lists); Newbie is the way to N5,
     Near-native ends where almost all anime dialogue is covered — a realistic ceiling for learning mostly from anime */
  {n:'Newbie',lo:0,hi:550,h:43},{n:'N5',lo:550,hi:800,h:20},
  {n:'N4',lo:800,hi:1500,h:60},{n:'N3',lo:1500,hi:3750,h:190},{n:'N2',lo:3750,hi:6000,h:220},{n:'N1',lo:6000,hi:10000,h:420},
  {n:'Near-native',lo:10000,hi:15000,h:450},{n:'Native-like',lo:15000,hi:Infinity,h:0}];
const KMAX=3000, KNOTCH=2200;
const ABSMAX=STAGES[STAGES.length-2].hi;   // last goal: 12000
const stageOf=v=>{ let i=0; STAGES.forEach((s,k)=>{ if(v>=s.lo) i=k; }); return i; };
const REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const bars = {
  words:{ el:null, shown:0, target:0, raf:0, timer:0, absT:0, twT:0, abs:false, init:false, st:-1 },
  kanji:{ el:null, shown:0, target:0, raf:0, timer:0, absT:0, twT:0, abs:false, init:false, st:0 }
};
function renderStageUI(){
  const v=bars.words.shown, st=stageOf(v), s=STAGES[st], rate=(S.pace&&S.pace.words)||0;
  $('#sname').textContent=s.n+' · '+(st+1)+'/'+STAGES.length;
  $('#weta').textContent = s.hi===Infinity ? '' : fmtEta(s.hi-v,rate);
  $('#stl').innerHTML = STAGES.map((x,i)=>{ const done=v>=x.hi;
    return '<div class="si '+(done?'done':i===st?'cur':'')+'"><span>'+(done?'✓':i===st?'●':'○')+'</span><span class="s1">'+(i+1)+'. '+x.n+'</span><span class="s2">'+x.lo+(x.hi===Infinity?'+':'–'+x.hi)+'</span><span class="s3">'+(x.h?'≈'+x.h+' h':'')+'</span><span class="s4">'+(x.hi===Infinity?'':fmtEta(x.hi-v,rate))+'</span></div>'; }).join('')+
    '<div class="snote">≈ h: rough study hours for the stage. Last column: time left at your recent pace.</div>';
  const k=bars.kanji.shown, kr=(S.pace&&S.pace.kanji)||0, goal=k<KNOTCH?KNOTCH:KMAX;
  $('#keta').textContent = k<KMAX ? '→ '+goal+' '+fmtEta(goal-k,kr) : '';
}
function paintBar(key){
  const b=bars[key], el=b.el, fill=$('.fill',el), ghost=$('.ghost',el), tot=$('.tot',el), plus=$('.plus',el), v=b.shown, t=b.target;
  let f,gf,pf,near=false; const pot=$('.pot',el);
  if(key==='words'){
    const st=stageOf(v), s=STAGES[st], inf=s.hi===Infinity, rel=x=>inf?1:x/s.hi, abs=x=>Math.min(1,x/ABSMAX), A=b.abs||S.wfull, fn=A?abs:rel;
    const pt=Math.max(S.potW||0,t); f=fn(v); gf=(A||stageOf(t)===st)?fn(t):1; pf=(A||stageOf(pt)===st)?fn(pt):1; near=!inf && (v-s.lo)/(s.hi-s.lo)>=0.9;
    { const m=$('.pbm',el), on=!A && !inf && s.lo>0; m.hidden=!on; if(on){ m.style.left=(s.lo/s.hi*100)+'%'; m.title=STAGES[st-1].n+' · '+s.lo; } }
    { const pe=$('.permf',el), pn=Math.min(v,S.permKnown||0); pe.hidden=!pn; pe.style.width=Math.min(1,Math.max(0,fn(pn)))*100+'%'; pe.title=pn+' permanently learned'; { const pc=$('.pmn',el); pc.hidden=!pn; $('b',pc).textContent=pn; pc.title=pn+' words permanently learned'; } requestAnimationFrame(()=>pe.style.setProperty('--gw',pe.offsetWidth+'px')); }
    { const ee=$('.easyf',el), pn=Math.min(v,S.permKnown||0), en=Math.min(Math.max(0,v-pn),S.easyKnown||0); ee.hidden=!en; ee.style.width=Math.min(1,Math.max(0,fn(pn+en)))*100+'%'; ee.title=en+' easy'; const ec=$('.emn',el); ec.hidden=!en; $('b',ec).textContent=en; ec.title=en+' easy words'; }
    tot.textContent=Math.round(v)+(inf?'':' / '+s.hi);
    $('.ticks',el).hidden=!A;
    if(b.st!==st){
      /* only a gain you just made levels up with the animation; data arriving while the page loads does not */
      if(b.st>=0 && st>b.st && b.init && b.anim){ el.classList.remove('levelup'); void el.offsetWidth; el.classList.add('levelup'); setTimeout(()=>el.classList.remove('levelup'),1800); }
      b.st=st; el.dataset.stage=st+1; renderStageUI();
    }
  } else {
    f=v/KMAX; gf=t/KMAX; pf=Math.max(S.potK||0,t)/KMAX; tot.textContent=Math.round(v)+' / '+KMAX;
    $('.notch',el).classList.toggle('hit',v>=KNOTCH);
    near=(v<KNOTCH&&v>=KNOTCH-90)||(v<KMAX&&v>=KMAX-90);
    { const pe=$('.permf',el), pn=Math.min(v,S.permk.size); pe.hidden=!pn; pe.style.width=Math.min(1,pn/KMAX)*100+'%'; pe.title=pn+' kanji permanently learned'; const pc=$('.pmn',el); pc.hidden=!pn; $('b',pc).textContent=pn; pc.title=pn+' kanji permanently learned'; requestAnimationFrame(()=>pe.style.setProperty('--gw',pe.offsetWidth+'px'));
      const ee=$('.easyf',el), en=Math.min(Math.max(0,v-pn),S.easyk.size); ee.hidden=!en; ee.style.width=Math.min(1,(pn+en)/KMAX)*100+'%'; ee.title=en+' easy kanji'; const ec=$('.emn',el); ec.hidden=!en; $('b',ec).textContent=en; ec.title=en+' easy kanji'; }
  }
  el.classList.toggle('near',near);
  fill.style.width=Math.min(100,Math.max(0,f*100))+'%';
  /* hatched tail of the fill: learned items that are due for review right now */
  { const dn=Math.round(Math.min(v,(S.dueItems||{})[key]||0)), clamp=x=>Math.min(1,Math.max(0,x)); let df=0;
    if(key==='words'){ const st=stageOf(v), s2=STAGES[st], A=b.abs||S.wfull; df = A ? clamp(v/ABSMAX)-clamp((v-dn)/ABSMAX) : (s2.hi===Infinity ? (v?dn/v:0) : clamp(v/s2.hi)-clamp((v-dn)/s2.hi)); }
    else df=dn/KMAX;
    /* the due part sits under the fill; the bright fill stops early, so its rounded end is the boundary */
    const de=$('.due',el); df=Math.min(df,clamp(f)); de.style.left='0'; de.style.width=clamp(f)*100+'%'; de.hidden=!(df>0);
    fill.style.width=(clamp(f)-df)*100+'%';
    { const pe=$('.permf',el); if(pe && !pe.hidden) pe.style.width=Math.min(parseFloat(pe.style.width)||0,(clamp(f)-df)*100)+'%'; }
    { const ee=$('.easyf',el); if(ee && !ee.hidden) ee.style.width=Math.min(parseFloat(ee.style.width)||0,clamp(f)*100)+'%'; }
    de.title=dn+' '+(key==='words'?'words':'kanji')+' due for review';
    const dc=$('.dn:not(.pmn):not(.emn)',el); dc.hidden=!(dn>0); $('b',dc).textContent=dn; dc.title=de.title; }
  ghost.style.width=Math.min(100,Math.max(0,gf*100))+'%'; pot.style.width=Math.min(100,Math.max(0,pf*100))+'%';
  const d=Math.round(t-v); plus.textContent=d>0?'+'+d:'';
  $('.track',el).setAttribute('aria-valuenow',Math.round(v));
}
function tween(b){ b.el.classList.add('tween'); clearTimeout(b.twT); b.twT=setTimeout(()=>b.el.classList.remove('tween'),900); }
/* after a gain: briefly show the words bar on an absolute scale (0 → goal), then go back to the stage scale */
function absPhase(key){
  if(key!=='words') return; const b=bars[key]; clearTimeout(b.absT);
  b.abs=true; paintBar(key);
  b.absT=setTimeout(()=>{ b.abs=false; paintBar(key); },4500);
}
function runBar(key){
  const b=bars[key], from=b.shown, to=b.target, t0=performance.now(), dur=900;
  const step=now=>{
    const p=Math.min(1,(now-t0)/dur), e=1-Math.pow(1-p,3);
    b.shown = p<1 ? from+(to-from)*e : to; paintBar(key);
    if(p<1) b.raf=requestAnimationFrame(step); else { b.raf=0; renderStageUI(); absPhase(key); }
  };
  b.raf=requestAnimationFrame(step);
}
function setBar(key,value,animate){
  const b=bars[key]; if(!b.el) return;
  b.anim=!!animate && b.init;
  cancelAnimationFrame(b.raf); clearTimeout(b.timer); clearTimeout(b.absT); b.raf=0; b.el.classList.remove('tween');
  if(!b.init || !animate || REDUCED || value<=b.shown){ b.abs=false; b.shown=b.target=value; b.init=true; paintBar(key); return; }
  b.abs=false; b.target=value; paintBar(key);    // 1) marker for the gain + "+N" appear at once
  b.timer=setTimeout(()=>runBar(key),1000);      // 2) hold 1s, then fill while "+N" counts down
}
function wbKnownWords(){
  let n=S.words.length, perm=S.words.filter(e=>S.permw.has(e.word)).length, easy=S.words.filter(e=>S.easyw.has(e.word)).length;
  if(S._wc) lxItems().forEach(x=>{ if(!x.g) return; const p=S.permw.has(x.e.word); if(p || wbKnown(x.e.word)){ n++; if(p) perm++; else if(S.easyw.has(x.e.word)) easy++; } });
  return {n,perm,easy}; }
function updateBars(){
  const anim = Date.now()-(S.tickAt||0) < 4000;
  computePotential(); S.ev=evTimes(); paintHead(); S.pace={ lines:paceOf(S.ev.lines,7), words:paceOf(S.ev.words,7), kanji:paceOf(S.ev.kanji,7) }; S.paceA={ lines:paceOf(S.ev.lines), words:paceOf(S.ev.words), kanji:paceOf(S.ev.kanji) };
  const kw=wbKnownWords(); S.permKnown=kw.perm; S.easyKnown=kw.easy; S.knownN=kw.n;
  setBar('words',kw.n,anim);
  setBar('kanji',S.kstats?S.kstats.l:0,anim);
  renderStageUI();
  const tw=bars.words.el.querySelector('.track'), tk=bars.kanji.el.querySelector('.track');
  $('.potn b',bars.words.el).textContent=Math.max(S.potW,S.knownN); $('.potn b',bars.kanji.el).textContent=Math.max(S.potK,S.kstats?S.kstats.l:0);
  tw.title=S.knownN+' words known ('+S.permKnown+' permanently, '+(S.easyKnown||0)+' easy) · after learning every added line: '+Math.max(S.potW,S.knownN)+' words';
  tk.title='After learning every added line: '+Math.max(S.potK,S.kstats?S.kstats.l:0)+' kanji (+'+Math.max(0,S.potK-(S.kstats?S.kstats.l:0))+' kanji)';
}
$('.ticks',$('#pb-words')).innerHTML=STAGES.slice(0,-2).map(x=>'<i style="left:'+(x.hi/ABSMAX*100)+'%" title="'+x.hi+'"></i>').join('');
$('#pb-words .track').addEventListener('click',()=>absPhase('words'));
bars.words.el=$('#pb-words'); bars.kanji.el=$('#pb-kanji');
setInterval(()=>{ if(S.cat) srsBadge(); },60000);
paintBar('words'); paintBar('kanji'); renderStageUI();

