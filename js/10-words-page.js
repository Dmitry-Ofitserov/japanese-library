/* ---------- the words page: blocks with a status bar each, and above them one panel for picking blocks, reviewing and listening ---------- */
const ICO_HPS='<svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 12.5V10a6.5 6.5 0 0 1 13 0v2.5"/><rect x="2.8" y="11.5" width="3.6" height="5.5" rx="1.3"/><rect x="13.6" y="11.5" width="3.6" height="5.5" rx="1.3"/></svg>';
function wbCls(k){ return !k.act?' wbi':k.isDue?(k.nn?' wbn':' wbd'):''; }
function wbStrip(k,on){
  const td=today(), lt=S.lxt[k.ch[0].e.word]||0, p=[];
  if(!k.act) p.push('<span class="z">not started</span>');
  else { p.push(k.isDue?(k.nn?'<span class="nw">'+k.nn+' new</span>':'<span class="du">due'+(k.due<td?' +'+(td-k.due)+'d':'')+'</span>'):'<span class="in">in '+(k.due-td)+'d</span>'); if(k.cnt) p.push('<span>×'+k.cnt+'</span>'); }
  if(k.done && k.done<k.tot) p.push('<span class="pr">'+k.done+'/'+k.tot+'</span>');
  if(k.hj) p.push('<span class="hd">'+k.hj+' hard</span>');
  if(lt>=30) p.push('<span class="ls">'+ICO_HPS+lxHM(lt)+'</span>');
  const rt=(S.rvt[k.ch[0].e.word]||0)/1000; if(rt>=1) p.push('<span class="rt">⏱ '+lxHM(rt)+'</span>');
  const tip='Block '+(k.b+1)+(k.act?(k.isDue?(k.nn?' · '+k.nn+' new words, review today':' · due'):' · next review in '+(k.due-td)+' days')+(k.cnt?' · reviewed '+k.cnt+'×':''):' · not started')+(k.done&&k.done<k.tot?' · '+k.done+' of '+k.tot+' reviewed this round':'')+(k.hj?' · '+k.hj+' hard':'')+(k.he?' · '+k.he+' hard reading the English':'')+(lt?' · listened '+lxHM(lt):'')+((S.rvt[k.ch[0].e.word]||0)>=1000?' · reviewed for '+lxHM((S.rvt[k.ch[0].e.word]||0)/1000):'')+' · tap to '+(on?'unpick':'pick');
  return '<button class="wbs" data-lb="'+k.b+'" aria-pressed="'+on+'" title="'+escA(tip)+'"><b>'+(k.b+1)+'</b>'+p.join('')+'</button>';
}
function lxPanelHTML(){
  const o=S.lxs, it=lxItems(), nb=Math.ceil(it.length/LXBS), bl=wbBlocks();
  S.lxsel=[...new Set((S.lxsel||[]).map(x=>x|0).filter(x=>x>=0&&x<nb))].sort((x,y)=>x-y);
  const W=lxWords(S.lxsel,o), P=lxPauses(o), sel=W.bl, has=sel.length;
  const selT=sel.reduce((t,k)=>t+(S.lxt[it[k*LXBS].e.word]||0),0), due=bl.filter(k=>k.isDue);
  const pickB=has?sel.map(i=>bl[i]).filter(Boolean):due, rvN=pickB.reduce((a,k)=>a+k.tot,0);
  const hf=wbHardWords('f',sel).length, hb=wbHardWords('b',sel).length, hl=wbHardWords('',sel).filter(x=>lxHardHit(wbSt(x.e.word),o)).length;
  let h='<div class="lxtot" id="lxTot">'+lxTotHTML()+'</div>';
  if(LX.on){
    h+='<div class="lxp" id="lxp"><div class="lxtop"><span id="lxLab"></span><span id="lxStg"></span></div>'+
      '<div class="lxcard"><div class="lxw" id="lxW" lang="ja"></div><div class="lxr" id="lxR" lang="ja"></div><div class="lxe" id="lxE"></div></div>'+
      '<div class="lxbar"><i id="lxFill"></i></div><div class="lxtr"><span id="lxT"></span><span id="lxPc"></span></div>'+
      '<div class="lxc"><button data-lx="prev" aria-label="Previous word" title="Previous word">'+ICO_LXB+'</button><button data-lx="pp" id="lxPP" class="lxbig"></button><button data-lx="next" aria-label="Next word" title="Next word">'+ICO_LXN+'</button><button data-lx="part" aria-label="Skip to the next part" title="Skip to the next part">'+ICO_LXF+'</button><button data-lx="stop" aria-label="Stop" title="Stop">'+ICO_LXS+'</button></div>'+
      '<div class="lxc2"><button class="hdb" data-lx="hd" id="lxHd" aria-pressed="false" title="Mark this word as hard (reading the Japanese)">Hard</button><button class="hdb" data-lx="ez" id="lxEz" aria-pressed="false" title="Easy: reviewed only every third round of its block">Easy</button><button class="hdb" data-lx="perm" title="Permanently learned: never reviewed, and skipped for the rest of this session">∞ Permanent</button></div>'+
      '<div class="lxsplit"><div class="lxgs" id="lxSet" aria-label="The words being played"></div><div class="lxkd" id="lxK" aria-label="The kanji of this word"></div></div>'+
      '<div class="lxl" id="lxL"></div>'+
      '<p class="lxnote">Keep the screen on: phones stop the voice when it locks.'+(o.loop?' The session starts again when it ends; stop it when you like.':'')+'</p></div>';
  }
  h+='<div class="lxsum wbsum"><div class="wbsel"><b>'+esc(has?lxSelName(sel):'No blocks picked')+'</b><span>'+(has?W.ws.length+' words'+(W.skip?' · '+W.skip+' permanent or easy skipped':'')+' · listened '+lxHM(selT):'Tap a block’s bar to pick it · '+due.length+' block'+(due.length===1?'':'s')+' due today')+'</span></div>'+
    '<div class="wbacts"><span class="wbal">Direction</span><span class="seg sm" role="group" aria-label="Direction"><button data-lxt="dir" data-v="je" aria-pressed="'+(o.dir!=='ej')+'" title="See or hear the Japanese, recall the English">JP → EN</button><button data-lxt="dir" data-v="ej" aria-pressed="'+(o.dir==='ej')+'" title="See or hear the English, recall the Japanese">EN → JP</button></span>'+(o.dir==='ej'?'<span class="wbnote">extra practice: block counts don’t change</span>':'')+'</div>'+
    '<div class="wbacts"><span class="wbal">Review</span><button class="lxgo" data-wb="blk"'+(rvN?'':' disabled')+' title="'+(has?'Review the picked blocks':'Review every block that is due')+'">'+(has?'Picked':'Due')+' · '+rvN+'</button><button class="lxgo lxsh" data-wb="hf"'+(hf?'':' disabled')+' title="Hard words, Japanese shown">Hard JP→EN · '+hf+'</button><button class="lxgo lxsh" data-wb="hb"'+(hb?'':' disabled')+' title="Hard words, English shown">Hard EN→JP · '+hb+'</button><span class="wbtg"><button class="tg" data-rvmix aria-pressed="'+!!S.rvMix+'" title="All words of the picked blocks in one random order, instead of block by block">Mix blocks</button></span></div>'+
    '<div class="wbacts"><span class="wbal">Listen</span>'+(LX.on?'':(()=>{ const ok=lxHardOn(o)?hl>0:has, n=lxHardOn(o)?' · '+hl+' hard':'';
        return '<button class="lxgo" data-lx="start"'+(ok?'':' disabled')+' title="Groups of words, then mixes">'+ICO_LXP+'<span>Start'+n+'</span></button><button class="lxgo lxsh" data-lx="shuf"'+(ok?'':' disabled')+' title="Every word in a random order">'+ICO_SHUF+'<span>Shuffle</span></button>'; })())+
      '<span class="wbtg">'+
      '<button class="tg" data-lxt="burst" aria-pressed="'+!!o.burst+'" title="After each word, the Japanese again, fast: '+o.f1+' times the first time, '+o.f2+' in later rounds">Bursts</button>'+
      '<button class="tg" data-lxt="hardJ" aria-pressed="'+!!o.hardJ+'" title="Add every word that is hard when you see the Japanese, from the picked blocks or from all blocks if none are picked">Hard JP→EN</button>'+
      '<button class="tg" data-lxt="hardE" aria-pressed="'+!!o.hardE+'" title="Add every word that is hard when you see the English, from the picked blocks or from all blocks if none are picked">Hard EN→JP</button></span></div>'+
    '<div class="wbacts"><span class="wbal">Pick</span><button class="tg" data-wbsel="due"'+(due.length?'':' disabled')+'>Due blocks · '+due.length+'</button><button class="tg" data-wbsel="none"'+(has?'':' disabled')+'>Clear</button></div></div>';
  if(!LX.on && LXA.err) h+='<p class="lxerr">Could not load the recordings ('+esc(LXA.err)+'). Tap Start to try again.</p>';
  if(!LX.on && LX.doneMsg) h+='<p class="lxdone">'+esc(LX.doneMsg)+'</p>';
  const V=lxVoices();
  h+='<details class="lxset"'+(S.lxOpen?' open':'')+'><summary>Listening settings</summary><div class="lxgrid">'+
    '<div class="cap2">Groups</div>'+
    lxNum('g1','Words per group',1,20,1)+lxNum('g2','Words per set',1,100,1,'a mix of the whole set after its groups')+
    '<div class="cap2">Each group</div>'+
    lxNum('rep','Each word in a row',0,5,1)+lxNum('ord','Rounds in order',0,5,1)+lxNum('shf','Rounds shuffled',0,5,1)+
    '<div class="cap2">After each set</div>'+
    lxNum('mix','Shuffled rounds of the set',0,5,1)+
    '<label class="lxf lxck"><input type="checkbox" data-lxk="all"'+(o.all?' checked':'')+'><span>A final shuffled round of everything<small>when more than one set is picked</small></span></label>'+
    '<label class="lxf lxck"><input type="checkbox" data-lxk="loop"'+(o.loop?' checked':'')+'><span>Start again when finished<small>with new random orders; each finished run is counted</small></span></label>'+
    '<div class="cap2">Timing</div>'+
    lxNum('p0','Thinking pause, first pass (s)',0.3,2,0.1,'also used in Shuffle')+lxNum('p1','Thinking pause, mix (s)',0.3,2,0.1,'passes in between: '+P[1]+' s, '+P[2]+' s')+
    lxNum('gap','Gap between words (s)',0.2,2,0.1)+
    '<div class="cap2">Bursts</div>'+
    lxNum('f1','Fast repeats, first time',0,10,1,'after the normal repeats of a new group')+lxNum('f2','Fast repeats, later rounds',0,10,1,'in order, shuffled, mixes')+lxNum('f3','Fast repeats, Shuffle',0,10,1,'each word in a Shuffle session')+lxNum('fp','Pause before a burst (s)',0.2,2,0.1)+lxNum('rate','Voice speed',0.6,1.6,0.05,'1 is normal, 1.3 is 30% faster')+
    '<div class="cap2">Sound</div>'+
    lxSelOpt('eng','Voice',[['rec','Recorded voices'],['live','Device voice']].filter(v=>v[0]==='rec'||synth))+
    lxSelOpt('dir','Order',[['je','Japanese, then English'],['ej','English, then Japanese']])+
    lxSelOpt('cue','Between parts',[['both','Chime and voice'],['voice','Voice'],['tone','Chime'],['off','Nothing']])+
    (lxRec()?'':lxSelOpt('vj','Japanese voice',[['','Default']].concat(V.ja.map(v=>[v.name,v.name])))+
    lxSelOpt('ve','English voice',[['','Default']].concat(V.en.map(v=>[v.name,v.name+' ('+v.lang+')']))))+
    '<label class="lxf lxck"><input type="checkbox" data-lxk="perm"'+(o.perm?' checked':'')+'><span>Skip permanently learned words</span></label>'+
    '<label class="lxf lxck"><input type="checkbox" data-lxk="easy"'+(o.easy?' checked':'')+'><span>Skip easy words</span></label>'+
    '<button class="tg lxrst" data-lx="reset">Reset to defaults</button>'+
    (LXA.idx&&LXA.idx.voice?'<p class="lxcred">Recorded voices: Japanese '+esc(LXA.idx.voice.ja)+', English Kokoro.</p>':'')+
    '</div></details>';
  return h;
}
/* every kanji of the word: the kanji, its number and keyword, and your story for it (an empty line where there is none yet) */
function lxKanjiHTML(w){
  const ks=[...new Set([...(w||'')].filter(ch=>KJ.test(ch)))];
  if(!ks.length) return '<div class="lxkn">No kanji in this word.</div>';
  return ks.map(ch=>{ const d=kInfo(ch);
    return '<div class="lxkr" data-k="'+escA(ch)+'" role="button" tabindex="0" title="Open '+escA(ch)+'"><b lang="ja">'+esc(ch)+'</b><div class="lxki"><div class="lxkt"><span class="kn">'+(d.frame?'#'+d.frame:'')+'</span>'+esc(d.kw||'')+'</div>'+
      (d.story?'<div class="lxks">'+esc(d.story)+'</div>':'<div class="lxks lxke" aria-label="No story yet"></div>')+'</div></div>'; }).join(''); }
function renderLxPanel(){ const p=$('#lxPanel'); if(!p) return;
  if(!LXA.idx && !LXA.ip) lxaIndex().then(j=>{ if(j && !LX.on) renderLxPanel(); });
  p.innerHTML=lxPanelHTML(); lxPaint(); }
function renderListen(){ renderLxPanel(); }
/* the word playing (or the last one played, during a cue) */
function lxCurWord(){ for(let k=LX.i;k>=0;k--){ const s=LX.steps[k]; if(s && s.t==='w') return s.x; } return null; }
/* ∞ during listening: the word leaves the rest of the session at once */
function lxPermCur(){
  const x=lxCurWord(); if(!x) return; const w=x.w;
  (LX.words||[]).forEach(y=>{ if(y.w===w) y.skip=true; });
  const st=LX.steps.filter((s,i)=>i<LX.i || !(s.t==='w' && s.x.w===w)); st.sets=LX.steps.sets; st.order=LX.steps.order&&LX.steps.order.filter(y=>y.w!==w); LX.steps=st;
  if(LX.i>=LX.steps.length) LX.i=LX.steps.length-1;
  lxHalt(); LX.phase=0; LX.shownW=null;
  setPerm(w,true);
  renderLxPanel(); if(!LX.paused) lxGo();
}
function lxHardCur(){ const x=lxCurWord(); if(!x) return; const on=!wbSt(x.w).hj; wbSetHard(x.w,'f',on); wbPaintCell(x.w); lxPaint(); toast(x.w+(on?' marked as hard':' is no longer hard')); }
function lxEasyCur(){ const x=lxCurWord(); if(!x) return; setEasy(x.w,!easyOf(x.w)); wbPaintCell(x.w); lxPaint(); toast(x.w+(easyOf(x.w)?' marked as easy':' is no longer easy')); }
function lxBarVis(){ const bar=$('#lbar'); if(!bar) return; let vis=false; const p=$('#lxp'); if(S.view==='words' && p){ const r=p.getBoundingClientRect(); vis=r.bottom>60 && r.top<innerHeight-40; } bar.hidden=!LX.on || vis; }
addEventListener('scroll',()=>{ if(LX.on) lxBarVis(); },{passive:true});
document.addEventListener('click',e=>{
  if(e.target.closest('[data-rvmix]')){ S.rvMix=!S.rvMix; LS.set('rvMix',S.rvMix); renderLxPanel(); return; }
  const tg=e.target.closest('[data-lxt]'); if(tg){ const o=S.lxs, t=tg.dataset.lxt;
    if(t==='dir') o.dir=tg.dataset.v; else if(t==='burst') o.burst=!o.burst; else if(t==='hardJ') o.hardJ=!o.hardJ; else if(t==='hardE') o.hardE=!o.hardE;
    lxSave(); renderLxPanel(); if(t==='burst' && o.burst && LX.on){ const ws=(LX.words||[]); lxaIndex().then(I=>{ if(I) new Set(ws.map(x=>{ const f=lxaClipFast(x.w); return f&&f[0]; }).filter(Boolean)).forEach(n=>lxaPack(n).catch(()=>{})); }); }
    return; }
  const wb=e.target.closest('[data-wb]'); if(wb && !wb.disabled){ const m=wb.dataset.wb; wbStart(m,{sel:S.lxsel}); return; }
  const ws=e.target.closest('[data-wbsel]'); if(ws && !ws.disabled){ S.lxsel = ws.dataset.wbsel==='due' ? wbBlocks().filter(k=>k.isDue).map(k=>k.b) : []; lxSelSave(); wbPaintSel(); renderLxPanel(); return; }
  const hd=e.target.closest('[data-hard]'); if(hd){ const w=hd.dataset.hw, d=hd.dataset.hard, on=hd.getAttribute('aria-pressed')!=='true'; wbSetHard(w,d,on); wbPaintCell(w); if(S.wcur && !$('#kd').hidden) showWordE(S.wcur.e); return; }
});
/* minimap: every 500-word square as 5×5 blocks, each block's 20 words as thin bars; tap a block to jump to it */
function wbMiniHTML(items,bl,sel){
  let h='<div class="wmini" aria-label="All blocks at a glance">';
  for(let b=0;b<items.length;b+=500){
    const B0=b/20, ks=bl.slice(B0,B0+25), nd=ks.filter(k=>k.isDue).length, nn=ks.filter(k=>k.isDue&&k.nn).length, np=ks.filter(k=>sel.has(k.b)).length, nh=ks.reduce((a,k)=>a+k.hj,0), last=Math.min(B0+25,Math.ceil(items.length/20));
    h+='<div class="wmw"><div class="wmsq">';
    for(let B=b/20;B<b/20+25;B++){ const k=bl[B], ch=items.slice(B*20,B*20+20);
      if(!ch.length){ h+='<i class="wmb wme"></i>'; continue; }
      const td=today(), lcD=k&&k.lc?Math.floor((k.lc-36e5)/864e5):null, passed=k&&k.lc?td-lcD:null;
      const iv=k&&k.cnt!=null?Math.max(1,ivb(k.cnt)):0;
      const frac=k&&k.act&&iv&&passed!=null?Math.min(1,Math.max(.05,passed/iv)):0;
      h+='<button class="wmb'+(k?wbCls(k):'')+(sel.has(B)?' sel':'')+'" data-mb="'+B+'" aria-label="Block '+(B+1)+'">'+
        '<b class="wbf"'+(frac?' style="width:'+(frac*100).toFixed(1)+'%"':'')+'></b>'+
        ch.map(x=>{ const w=x.e.word, st=wbSt(w);
        return '<i class="'+(S.permw.has(w)?'p':st.hj?'h':S.easyw.has(w)?'e':(x.g && !st.k)?'g':'l')+'"></i>'; }).join('')+
        '<em>'+(B+1)+'</em>'+(k&&k.cnt?'<b class="wc">&times;'+k.cnt+'</b>':'')+
        (passed!=null?'<i class="wd">'+passed+'/'+iv+'</i>':'')+'</button>'; }
    h+='</div><div class="wmcap"><b>'+(B0+1)+'–'+last+'</b>'+(nd?'<span class="du">'+nd+' due</span>':'')+(nn?'<span class="nw">'+nn+' new</span>':'')+(np?'<span class="pk">'+np+' picked</span>':'')+(nh?'<span class="hd">'+nh+' hard</span>':'')+'</div></div>';
  }
  return h+'</div>';
}
let wbHold=0, wbQuick=0;
function wbMiniShow(c){
  const B=+c.dataset.mb, k=wbBlocks()[B]; if(!k) return;
  /* the same markup as a block of the words grid — status bar + 2×10 cells — minus the episode label */
  const cells=k.ch.map(it=>{ const e=it.e, st=wbSt(e.word), pv=it.g && !st.k;
    const n=[...e.word].reduce((a,ch)=>a+(/[\x00-\xff]/.test(ch)?0.6:1),0);
    const cls='wgc'+(S.permw.has(e.word)?' wgperm':S.easyw.has(e.word)?' wceasy':pv?' wgh':'')+(st.hj?' wghj':'')+(st.he?' wghe':'');
    const gl=(e.gloss||(e.means&&e.means[0])||'').replace(/^.*\/ /,'');
    return '<button class="'+cls+'"><span lang="ja" style="--n:'+n.toFixed(1)+'">'+esc(e.word)+'</span><small>'+esc(gl)+'</small></button>'; }).join('');
  mtip.classList.add('wbt');
  mtip.innerHTML='<div class="wblk'+wbCls(k)+(S.lxsel.includes(B)?' sel':'')+'">'+wbStrip(k,S.lxsel.includes(B))+'<div class="wbc">'+cells+'</div></div>';
  mtip.hidden=false;
  const r=$('.wmini').getBoundingClientRect(), h=mtip.offsetHeight;
  mtip.style.left=Math.max(6,r.left)+'px'; mtip.style.top=(r.bottom+8+h<innerHeight?r.bottom+8:Math.max(6,r.top-h-8))+'px';
}
/* the tooltip stays put while the pointer moves inside the minimap — only its contents change; it hides on leaving */
function wbMiniTip(e){
  const c=e.target.closest && e.target.closest('.wmb[data-mb]');
  if(e.type==='pointerdown' && c && e.pointerType!=='mouse'){
    clearTimeout(wbHold);
    wbHold=setTimeout(()=>{ wbMiniShow(c); wbQuick=Date.now(); },420);
    return true;
  }
  if(e.type==='pointermove' && e.pointerType!=='mouse'){ clearTimeout(wbHold); return false; }
  if(e.type==='click'){ if(!c){ mtip.hidden=true; return false; } if(Date.now()-wbQuick<700){ mtip.hidden=true; return true; } return false; }
  if(e.type==='pointermove'){
    if(!e.target.closest('.wmini')){ mtip.hidden=true; return false; }
    if(c) wbMiniShow(c);
    return true;
  }
  if(!c){ mtip.hidden=true; return false; }
  wbMiniShow(c); return true;
}
document.addEventListener('pointerup',()=>clearTimeout(wbHold));
/* once the block tooltip is up, it hides the moment the pointer leaves the blocks square (not on the thin gaps between blocks) */
document.addEventListener('pointermove',e=>{ if(!mtip.classList.contains('wbt')||mtip.hidden) return;
  if(!e.target.closest || !e.target.closest('.wmsq')) mtip.hidden=true; },{passive:true});
document.addEventListener('pointercancel',()=>clearTimeout(wbHold));
/* tap a block in the minimap to pick or unpick it (the page stays where it is) */
document.addEventListener('click',e=>{
  const gt=e.target.closest('#wgt'); if(gt){ S.wgridShow=!S.wgridShow; LS.set('wgrid.v1',S.wgridShow); renderWords(true); scrollTo(0,0); return; }
  const m=e.target.closest('.wmb[data-mb]'); if(!m) return; const B=+m.dataset.mb;
  S.lxsel = S.lxsel.includes(B) ? S.lxsel.filter(x=>x!==B) : S.lxsel.concat(B).sort((x,y)=>x-y); lxSelSave(); LX.doneMsg=''; wbPaintSel(); renderLxPanel(); });

function wbPaintSel(){ view.querySelectorAll('.wmb[data-mb]').forEach(m=>m.classList.toggle('sel',S.lxsel.includes(+m.dataset.mb)));
  view.querySelectorAll('.wmw').forEach(w=>{ const n=[...w.querySelectorAll('.wmb.sel')].length, c=w.querySelector('.wmcap'); if(!c) return; let pk=c.querySelector('.pk'); if(!n){ if(pk) pk.remove(); return; } if(!pk){ pk=document.createElement('span'); pk.className='pk'; const hd=c.querySelector('.hd'); c.insertBefore(pk,hd); } pk.textContent=n+' picked'; }); const sel=new Set(S.lxsel); view.querySelectorAll('.wblk[data-blk]').forEach(b=>{ const on=sel.has(+b.dataset.blk); b.classList.toggle('sel',on); const s=b.querySelector('.wbs'); if(s) s.setAttribute('aria-pressed',String(on)); }); }
function lxSet(k,v){ const o=S.lxs, num=(x,a,b)=>{ x=parseFloat(x); return isFinite(x)?Math.min(b,Math.max(a,x)):null; };
  const R={f1:[0,10],f2:[0,10],f3:[0,10],fp:[0.2,2],g1:[1,20],g2:[1,100],rep:[0,5],ord:[0,5],shf:[0,5],mix:[0,5],p0:[.3,2],p1:[.3,2],gap:[.2,2],rate:[.6,1.6]};
  if(R[k]){ let x=num(v,R[k][0],R[k][1]); if(x==null) return; if(['g1','g2','rep','ord','shf','mix','f1','f2','f3'].includes(k)) x=Math.round(x); o[k]=x; }
  else o[k]=v;
  if(o.g2<o.g1) o.g2=o.g1;
  if(o.rep+o.ord+o.shf===0) o.rep=1;
  lxSave();
}
view.addEventListener('change',e=>{ const k=e.target.dataset && e.target.dataset.lxk; if(!k||S.view!=='words') return;
  lxSet(k,e.target.type==='checkbox'?e.target.checked:e.target.value); S.lxOpen=true; renderListen(); });
view.addEventListener('toggle',e=>{ if(e.target.classList && e.target.classList.contains('lxset')) S.lxOpen=e.target.open; },true);
document.addEventListener('click',e=>{
  const lb=e.target.closest('[data-lb]'); if(lb && S.view==='words'){ const k=+lb.dataset.lb;
    S.lxsel = S.lxsel.includes(k) ? S.lxsel.filter(x=>x!==k) : S.lxsel.concat(k).sort((x,y)=>x-y); lxSelSave();
    LX.doneMsg=''; wbPaintSel(); renderLxPanel(); return; }
  const x=e.target.closest('[data-lx]'); if(!x) return; const a=x.dataset.lx;
  if(a==='start') lxStart('full'); else if(a==='shuf') lxStart('shuf'); else if(a==='hard') lxStart('hard'); else if(a==='perm') lxPermCur(); else if(a==='hd') lxHardCur(); else if(a==='ez') lxEasyCur(); else if(a==='pp') LX.paused?lxResume():lxPause(); else if(a==='stop') lxStop();
  else if(a==='next') lxJump(1); else if(a==='prev') lxJump(-1); else if(a==='part') lxJump('part');
  else if(a==='open'){ nav('words'); setTimeout(()=>scrollTo(0,0),60); }
  else if(a==='reset'){ S.lxs=Object.assign({},LXD); lxSave(); renderListen(); }
});
document.addEventListener('keydown',e=>{ if(S.view!=='words' || !LX.on || !$('#kd').hidden || /INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName)) return;
  if(e.key===' '){ e.preventDefault(); LX.paused?lxResume():lxPause(); } else if(e.key==='ArrowRight'){ e.preventDefault(); lxJump(1); } else if(e.key==='ArrowLeft'){ e.preventDefault(); lxJump(-1); } });
if(synth && synth.addEventListener) synth.addEventListener('voiceschanged',()=>{ if(S.view==='words' && !LX.on && !view.contains(document.activeElement)) renderListen(); });
