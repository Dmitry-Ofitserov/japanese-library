/* ---------- kanji map ---------- */
const KSTAT = {l:'Learned', p:'Not learned yet, in your unlearned lines', n:'Not learned'};
function syncKcol(){ syncFullw(); const q=$('#kcolSeg'); if(q) q.querySelectorAll('[data-kcol]').forEach(b=>b.setAttribute('aria-pressed',+b.dataset.kcol===(S.kcols==null?1:S.kcols))); }
function renderKanji(keep){
  syncKcol();
  view.dataset.gid='';
  if(!S.deck){
    view.innerHTML='<div class="empty">Loading…</div>';
    ensureCorpus().then(()=>{ if(S.view==='kanji'){ computeKanjiStats(); renderKanji(true); } }).catch(()=>{ view.innerHTML='<div class="empty">Could not load the kanji deck.</div>'; });
    return;
  }
  computeKanjiStats();
  const q=$('#kq').value.trim().toLowerCase(), f=$('#kf').value;
  const cell=e=>{
    const hay=(e.k+' '+e.kw+' '+e.on+' '+e.kun+' '+e.story).toLowerCase();
    const dim=(q && !hay.includes(q)) || (f!=='all' && e.st!==f);
    const kk=kcls(e), kp=kcellBar(e.k), sty=kp===''?kk.sty:(kk.sty?kk.sty.slice(0,-1)+';--kp:'+kp+'%"':' style="--kp:'+kp+'%"'); return '<button class="kcell '+kk.cls+(kp===''?'':' kp')+(dim?' dim':'')+'"'+sty+' data-k="'+e.k+'" title="'+escA(e.kw)+'">'+e.k+'</button>';
  };
  const st=S.kstats;
  let h='<div class="klegend"><span><i class="sw l"></i>Learned '+st.l+'</span><span><i class="sw p"></i>Not learned, in your lines '+st.p+'</span><span><i class="sw"></i>Not learned '+(st.t-st.l-st.p)+'</span><span>Total '+st.t+'</span></div>';
  h+='<div class="minirow" aria-label="All kanji at a glance">';
  /* the deck, then kanji from your lines that are not in it, in order of first appearance; a line after #2200 and after the deck */
  const all=S.deck.concat(S.extras), nd=S.deck.length, kbl=kbBlocks(); S.mall=all;
  for(let b=0;b<all.length;b+=400){
    h+='<div class="msq" data-big="'+Math.min(b/400,Math.floor((nd-1)/400))+'"'+(b>=nd?' data-x="1"':'')+'>';
    if(b<=KNOTCH && KNOTCH<b+400) h+='<b class="mline" style="top:'+(Math.floor((KNOTCH-b)/100)*25)+'%"></b>';
    if(S.extras.length && b<=nd && nd<b+400 && nd>b) h+='<b class="mline" style="top:'+(Math.floor((nd-b)/100)*25)+'%"></b>';
    for(let k=b;k<Math.min(b+400,all.length);k+=25){
      h+='<div class="mb'+(k<nd&&S.kpick.has(k/25)?' sel':'')+(k<nd&&kbl[k/25]&&kbl[k/25].isDue?' kbdue':'')+'"'+(k<nd?' data-b="'+(k/25)+'" title="Block '+(k/25+1)+' · #'+all[k].frame+'–#'+all[Math.min(k+24,nd-1)].frame+' · tap to pick"':'')+'>';
      all.slice(k,k+25).forEach((e,j)=>{
        const hay=(e.k+' '+e.kw+' '+e.on+' '+e.kun+' '+e.story).toLowerCase(), dim=(q && !hay.includes(q)) || (f!=='all' && e.st!==f);
        const kk=kcls(e); h+='<i class="mc '+kk.cls+(dim?' dim':'')+'"'+(kk.sty?' style="background:'+kcolor(e).c+'"':'')+' data-i="'+(k+j)+'"></i>';
      });
      h+='</div>';
    }
    h+='</div>';
  }
  h+='</div>';
  h+=kPickBarHTML();
  const half=S.kcols===0, step=half?200:400;
  h+='<div class="bigs kc'+(S.fullw?' bleed':'')+'" style="--cols:'+(half?1:(S.kcols||1))+'">';
  for(let b=0;b<S.deck.length;b+=step){
    const ch=S.deck.slice(b,b+step);
    h+='<section class="big" id="big-'+(b/step)+'"><div class="bigcap">#'+ch[0].frame+' – #'+ch[ch.length-1].frame+'</div><div class="bw"><div class="bgrid'+(half?' half':'')+'">';
    for(let k=0;k<ch.length;k+=25){ const bi=(b+k)/25, kb=kbl[bi]; h+='<div class="blk'+(S.kpick.has(bi)?' sel':'')+(kb&&kb.isDue?' kbdue':'')+'" data-b="'+bi+'" title="'+escA(kb?(kb.fresh?'Block '+(bi+1)+' · new':'Block '+(bi+1)+(kb.isDue?' · due':' · next review in '+(kb.due-today())+'d')+' · reviewed '+kb.cnt+'×'):'')+'">'+ch.slice(k,k+25).map(cell).join('')+'</div>'; }
    h+='</div></div></section>';
  }
  h+='</div>';
  if(S.extras.length) h+='<section class="big" id="big-x"><div class="bigcap">Not in your deck, but in your lines ('+S.extras.length+')</div><div class="xrow">'+S.extras.map(cell).join('')+'</div></section>';
  view.innerHTML=h;
}
function ksnip(o,ch){
  const L=lineOf(o.gid,o.n); if(!L) return '';
  const hit=new Set(); L.tk.forEach((h,i)=>{ if(surf(h).includes(ch)) hit.add(i); });
  return snippet({gid:o.gid,n:o.n},ch,{hit,nolink:true});
}
function fillK(det,n){
  const k=S.kcur; if(!k) return; const rest=k.occ.slice(3);
  det.querySelector('.ilist').innerHTML = rest.slice(0,n).map(o=>ksnip(o,k.ch)).join('')+
    (rest.length>n?'<button class="more kmoreb" data-n="'+n+'">Show more ('+(rest.length-n)+' left)</button>':'');
}
function allWordMap(){
  if(S.awm) return S.awm;
  const m=new Map(), lr=new Set(S.words.map(w=>w.word));
  groupOrder().forEach(g=>{ const d=S.data.get(g.id); if(!d) return; d.lines.forEach(L=>L.b.forEach(b=>{
    wordsOf(b).forEach(x=>{ if(!m.has(x.word)) m.set(x.word,{word:x.word,reading:x.reading,meaning:x.gloss,learned:lr.has(x.word)}); }); })); });
  return (S.awm=m);
}
function kwRow(w){
  const mean=w.meaning.length>110?w.meaning.slice(0,108)+'…':w.meaning;
  return '<div class="kw"><span class="lm '+(w.learned?'on':'off')+'" title="'+(w.learned?'learned':'not learned')+'"></span><span class="kww" lang="ja">'+esc(w.word)+'</span>'+(w.reading?'<span class="wr">'+esc(w.reading)+'</span>':'')+'<span class="kwm">'+esc(mean)+'</span></div>';
}
function showKanji(ch,keep){
  const inDeck=S.deckMap.has(ch), e=kInfo(ch), perm=S.permk.has(ch);
  const occ=S.kcur&&S.kcur.ch===ch?S.kcur.occ:(S.kocc.get(ch)||[]); S.kcur={ch,occ}; S.wcur=null;
  const st=kstate(ch,e.story), sheet=$('#kd'), nl=kNavList(), ni=nl.findIndex(x=>x.k===ch);
  const nav=ni>=0?'<span class="wnav knav"><button class="wnv" data-knav="-1" aria-label="Previous kanji" title="Previous kanji (←)"'+(ni>0?'':' disabled')+'>‹</button><span class="wnp">'+(ni+1)+' / '+nl.length+'</span><button class="wnv" data-knav="1" aria-label="Next kanji" title="Next kanji (→)"'+(ni<nl.length-1?'':' disabled')+'>›</button></span>':'';
  const pb=inDeck?'<button class="nico permb'+(perm?' on':'')+'" data-permk="'+escA(ch)+'" aria-pressed="'+perm+'" title="'+(perm?'Permanently learned: never reviewed. Tap to put it back into reviews':'Mark as permanently learned: never reviewed')+'" aria-label="Permanently learned">∞</button>':'';
  sheet.classList.add('kfix'); sheet.setAttribute('aria-label','Kanji details');
  sheet.innerHTML='<div class="sin"><div class="wtop ktop"><button class="sx sxi" aria-label="Close" title="Close">×</button>'+(inDeck?kTimers(ch):'')+latSpan(learnedTs(ch))+'<span class="wshb">'+(inDeck?easyBtn('K|'+ch):'')+pb+'</span></div>'+
    '<div class="kh"><div class="kbig" lang="ja">'+esc(ch)+'</div><div class="kmeta"><div class="kt">'+esc(e.kw||(inDeck?'No keyword':'Not in your deck'))+'</div>'+
    '<div class="km">'+(e.frame?'#'+e.frame:'')+((e.on||e.kun)?(e.frame?' · ':'')+(e.on?'音 '+esc(e.on):'')+(e.on&&e.kun&&e.kun!=='—'?' · ':'')+(e.kun&&e.kun!=='—'?'訓 '+esc(e.kun):''):'')+'</div>'+
    '<div><span class="pill '+st+(perm?' perm':'')+'">'+(perm?'Permanently learned':st==='n'&&!inDeck?'Not in your deck':KSTAT[st])+'</span></div></div>'+nav+'</div>'+
    '<div class="kstory">'+(inDeck?'<button class="kedb" data-kedit title="Edit the mnemonic">Edit</button>':'')+'<div class="story">'+(e.story?esc(e.story):(inDeck?'<span class="knone">No mnemonic yet.</span>':'This kanji is not in your 3,000-kanji deck.'))+'</div></div>'+
    (()=>{ const ws=[...allWordMap().values()].filter(w=>w.word.includes(ch)).sort((a,b)=>b.learned-a.learned);
      return ws.length?'<div class="cap2">In '+ws.length+' word'+(ws.length===1?'':'s')+'</div><div class="kws">'+ws.slice(0,6).map(kwRow).join('')+'</div>'+(ws.length>6?'<details class="inst"><summary>Show '+(ws.length-6)+' more words</summary><div class="kws">'+ws.slice(6).map(kwRow).join('')+'</div></details>':''):'<div class="cap2">No words with this kanji yet</div>'; })()+
    (occ.length?'<div class="cap2">In '+occ.length+' line'+(occ.length===1?'':'s')+(occ.length>3?' · first 3':'')+'</div>'+occ.slice(0,3).map(o=>ksnip(o,ch)).join('')+
      (occ.length>3?'<details class="inst kmore"><summary>Show '+(occ.length-3)+' more</summary><div class="ilist"></div></details>':''):'<div class="cap2">Not in any line yet</div>')+'</div>';
  sheet.hidden=false; sheet.scrollTop=0; S.kdAt=Date.now();
}
function kEditStory(){
  const ch=S.kcur&&S.kcur.ch, e=ch&&S.deckMap.get(ch), box=$('#kd .kstory'); if(!e||!box) return;
  box.innerHTML='<textarea class="kta" id="kta" rows="5" aria-label="Mnemonic for '+escA(ch)+'">'+esc(e.story||'')+'</textarea><div class="kedrow"><button class="btn pri" data-ksave>Save</button><button class="btn" data-kcancel>Cancel</button><span class="hint">Ctrl + Enter saves</span></div>';
  const ta=$('#kta'); ta.focus(); ta.setSelectionRange(ta.value.length,ta.value.length);
}
function kSaveEdit(){ const ta=$('#kta'), ch=S.kcur&&S.kcur.ch; if(!ta||!ch) return; const t=ta.value.trim(), e=S.deckMap.get(ch);
  if(e && t!==(e.story||'')){ kSaveStory(ch,t); toast('Mnemonic saved'); } showKanji(ch,true);
  if(S.view==='kanji' && !S.sess){ /* search reads stories: keep the grid in step */ } }
function closeKanji(){ const k=$('#kd'); k.hidden=true; k.classList.remove('kfix'); hlCur(null); view.querySelectorAll('.kcell.wcur').forEach(x=>x.classList.remove('wcur')); }
/* mark the word whose card is open, wherever it is shown (grid cell, preview cell or word card) */
function hlCur(e){
  document.querySelectorAll('.wcur').forEach(x=>x.classList.remove('wcur'));
  if(!e) return null; const t=e.isName?'n':e.isLoan?'l':'w'; let el=null;
  view.querySelectorAll('.wgc[data-wi],.wcard[data-wi]').forEach(x=>{ if(x.dataset.ws===t && +x.dataset.wi===e.i) el=x; });
  if(!el) view.querySelectorAll('[data-pw]').forEach(x=>{ if(x.dataset.pw===e.word) el=x; });
  if(el) el.classList.add('wcur'); return el;
}
/* a plain tap outside the open word/kanji sheet closes it; a drag (scroll, text selection) does not */
let kdDown=null;
document.addEventListener('pointerdown',e=>{ kdDown=[e.clientX,e.clientY]; },true);
document.addEventListener('click',e=>{
  const sh=$('#kd'); if(!sh || sh.hidden) return;
  if(Date.now()-(S.kdAt||0)<120) return;            /* the tap that just opened or re-filled it */
  if(e.target.closest('#kd')) return;
  if(!document.contains(e.target)) return;          /* the tapped element was re-rendered away mid-click */
  if(kdDown && (Math.abs(e.clientX-kdDown[0])>8 || Math.abs(e.clientY-kdDown[1])>8)) return;
  closeKanji();
});
function jumpTo(gid,n,o){ S.jump={n,w:o.w||null,c:o.c||null}; S.flt='all'; $('#flt').value='all'; closeKanji(); nav('ep-'+gid); }

