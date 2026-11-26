/* ---------- lines view ---------- */
/* what to read aloud for a note headword: the kana reading in brackets where there is one, else the written form */
function sayOf(h){
  const KANA=/^[\u3040-\u30ffー・]+$/;
  const out=h.split(/\s[+＋]\s/).map(seg=>{ const m=seg.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
    if(m){ const r=m[2].replace(/[+＋\s]/g,''); return KANA.test(r)?r:m[1].replace(/[+＋\s]/g,''); }
    return seg.replace(/[+＋\s]/g,''); }).join('');
  return /[\u3040-\u30ff\u4e00-\u9fff]/.test(out) && !/[a-zA-Z]/.test(out) ? out : '';
}
function bulletHTML(b){
  const i = b.indexOf(' - ');
  if(i<0) return '<li>'+esc(b)+'</li>';
  const h = b.slice(0,i);
  if(h==='Note') return '<li class="nt">Note – '+esc(b.slice(i+3))+'</li>';
  const say=sayOf(h);
  const pts=[...new Set(wordsOf(b).filter(x=>x.part).map(x=>x.word))];
  return '<li><span class="w"'+(say?' role="button" tabindex="0" data-say="'+escA(say)+'" title="Play"':'')+'>'+esc(h)+'</span> – '+esc(b.slice(i+3))+
    (pts.length?' <span class="bparts" title="This word is built from these, so they count as learned too">+ also counts '+pts.map(p=>'<span lang="ja">'+esc(p)+'</span>').join(', ')+'</span>':'')+'</li>';
}
const PUN_TOK=/^[、。，,！？!?…「」『』～~・"*：；（）()]+$/;
/* japanese text of a line: wider gaps between words, "+" between the pieces of one word */
function jpHTML(L,hit){
  let out='', prev=false;
  L.tk.forEach((h,i)=>{
    const s=surf(h), sp=/^\s+$/.test(s), pu=PUN_TOK.test(s);
    if(sp){ out+='<span class="tk sp">'+h+'</span>'; prev=false; return; }
    if(prev && !pu) out+='<span class="pl" aria-hidden="true">+</span>';
    out+='<span class="tk'+(hit&&hit.has(i)?' hit':'')+'">'+h+'</span>';
    prev=!pu;
  });
  return out;
}
const pad2=n=>String(n).padStart(2,'0');
const fmtDay=t=>{ const d=new Date(t); return pad2(d.getDate())+'.'+pad2(d.getMonth()+1)+'.'+String(d.getFullYear()).slice(2); };
function latTxt(gid,n){ const t=getLearned(gid).has(n)?getAt(gid,n):0; return t>0?fmtDay(t):''; }
const latSpan=t=>(t>0&&isFinite(t))?'<span class="wlat" title="first learned">'+fmtDay(t)+'</span>':'';
function lineHTML(g,L,hit){
  const id = L.id || L.n, on = getLearned(g.id).has(L.n), ts = L.ts ? L.ts.replace(/\.\d+$/,'') : '';
  return '<article class="line" id="l-'+L.n+'" data-n="'+L.n+'" data-learned="'+(on?1:0)+'">'+
    '<div class="rail"><div class="rh"><label class="chk" title="Mark as learned"><input type="checkbox" class="lc"'+(on?' checked':'')+' aria-label="Line '+esc(id)+' learned"><span class="box" aria-hidden="true"></span></label>'+
    '<span class="no">'+esc(id)+'</span></div>'+(ts?'<div class="ts">'+ts+'</div>':'')+'<div class="lat" title="first learned">'+latTxt(g.id,L.n)+'</div>'+
    '<div class="lst"></div></div>'+
    '<div class="body"><div class="nwr"></div>'+(L.src?'<div class="src">'+esc(L.src)+'</div>':'')+
    '<div class="jp" lang="ja">'+jpHTML(L,hit)+'</div>'+
    (L.t?'<div class="tr">'+esc(L.t)+'</div>':'')+
    '<div class="det"><div class="panel"><ul>'+L.b.map(bulletHTML).join('')+'</ul>'+(L.l?'<div class="lit">'+esc(L.l)+'</div>':'')+'</div></div></div></div><div class="btns">'+PLAY('1')+PLAY('slow')+NORV(g.id,L.n)+BKT('L|'+g.id+':'+L.n+'|r')+'</div></article>';
}
/* "+N new words / +N new kanji": live while the line is unlearned, fixed once it is ticked */
function freshKnown(){
  const w=new Set(), k=new Set();
  S.index.groups.forEach(g=>{ const d=S.data.get(g.id); if(!d) return; const set=getLearned(g.id);
    d.lines.forEach(L=>{ if(!set.has(L.n)) return;
      L.b.forEach(b=>wordsOf(b).forEach(x=>w.add(x.word)));
      const nt=nameTokens(L); L.tk.forEach((h,i)=>{ if(nt.has(i)) return; for(const ch of surf(h)) if(KJ.test(ch)) k.add(ch); }); }); });
  return {w,k};
}
function newCounts(L,known){
  const w=new Set(); L.b.forEach(b=>wordsOf(b).forEach(x=>{ if(!known.w.has(x.word)) w.add(x.word); }));
  const nt=nameTokens(L), k=new Set();
  L.tk.forEach((h,i)=>{ if(nt.has(i)) return; for(const ch of surf(h)){
    if(!KJ.test(ch) || !S.deckMap || !S.deckMap.has(ch)) continue;
    const learned = S.kmode==='story' ? !!S.deckMap.get(ch).story : known.k.has(ch); if(!learned) k.add(ch); } });
  return [w.size,k.size];
}
/* review status for one card: count, time since last success, time to due */
function cardStat(key){
  if(!S.cat || !S.cat.has(key)) return null;
  const st=stOf(key), now=Date.now(), d=due(st);
  return {c:st.c, ago:Math.max(0,now-st.l), left:d-now, iv:Math.max(0,d-st.l), isDue:d<=now, n:st.n||0};
}
/* "time since last success / whole interval", e.g. 2h/1d */
const agoIv=x=>fmtDur(x.ago)+'/'+fmtDur(x.iv);
/* small bar: share of the interval that has passed; full and red once due */
const tbar=x=>'<span class="tb'+(x.isDue?' isdue':'')+'"><i style="width:'+(x.isDue?100:Math.min(100,100*x.ago/Math.max(1,x.iv))).toFixed(1)+'%"></i></span>';
const dueTxt=x=> x.isDue ? (x.left<-36e5?'due · '+fmtDur(-x.left)+' late':'due now') : 'due in '+fmtDur(x.left);
function paintLineStat(){
  const id=view.dataset.gid; if(!id || S.view!=='ep') return;
  view.querySelectorAll('.line').forEach(a=>{
    const box=a.querySelector('.lst'); if(!box) return;
    const x=cardStat('L|'+id+':'+a.dataset.n+'|r'), nr=S.norv.has(id+':'+a.dataset.n);
    a.classList.toggle('isdue',!!(x&&x.isDue)); a.classList.toggle('isnorv',nr);
    const nb=a.querySelector('.norv'); if(nb){ nb.setAttribute('aria-pressed',nr); nb.title=nr?'Learned, not in reviews · tap to put it back into reviews':'Mark as learned and leave it out of reviews (names only, basic grammar…)'; }
    if(!x){ box.className='lst'; box.title=''; box.innerHTML=nr&&a.dataset.learned==='1'?'<span class="nrv">no review</span>':''; return; }
    box.className='lst'+(x.isDue?' isdue':'');
    box.title='Rep count '+fmtCnt(x.c)+' · '+(x.n?x.n+' review'+(x.n===1?'':'s'):'not reviewed yet')+' · last success '+fmtDur(x.ago)+' ago · '+dueTxt(x);
    box.innerHTML='<b>'+fmtCnt(x.c)+'</b><span>'+agoIv(x)+'</span>'+tbar(x);
  });
}
function paintNorv(){ if(S.view==='ep') paintLineStat(); if(S.view==='review' && !S.sess) renderReview(); }
function paintNew(){
  paintLineStat();
  const id=view.dataset.gid, d=S.data.get(id); if(!d || S.view!=='ep' || !S.deckMap) return;
  const known=freshKnown(), set=getLearned(id), fz=S.fz.get(id)||{};
  view.querySelectorAll('.line').forEach(a=>{
    const n=+a.dataset.n, L=lineOf(id,n), box=a.querySelector('.nwr'); if(!L||!box) return;
    let c, fx=false;
    if(set.has(n)){ if(fz[n]){ c=fz[n]; fx=true; } else { box.innerHTML=''; return; } } else c=newCounts(L,known);
    const t=fx?'Fixed when you marked this line learned':'New right now, based on what you have learned';
    box.innerHTML='<span class="nwc w'+(fx?' fx':'')+'" title="'+t+'">+'+c[0]+' words</span><span class="nwc k'+(fx?' fx':'')+'" title="'+t+'">+'+c[1]+' kanji</span>';
  });
}
function fillEpSelect(){
  const sel = $('#epSel'), by = new Map();
  S.index.groups.forEach(g=>{ if(!by.has(g.series)) by.set(g.series,[]); by.get(g.series).push(g); });
  sel.innerHTML = [...by].map(([s,gs])=>'<optgroup label="'+esc(s)+'">'+gs.map(g=>{ const [a,b]=counts(g.id); return '<option value="'+g.id+'">'+esc(g.title)+' · '+a+'/'+b+(nwTxt(g.id)?' · '+nwTxt(g.id):'')+(S.excl.has(g.id)?' · paused':'')+'</option>'; }).join('')+'</optgroup>').join('');
  sel.value = S.ep;
}
function updateProgress(){
  if(!S.index) return; paintTabCounts();
  if(S.ep){ const [a,b]=counts(S.ep); $('#progTxt').textContent = a+' of '+b+' learned'+(nwTxt(S.ep)?' · '+nwTxt(S.ep):''); $('#barFill').style.width = (b?100*a/b:0)+'%'; }
  const o = $('#epSel option[value="'+S.ep+'"]'); if(o && S.ep){ const [a,b]=counts(S.ep); o.textContent = meta(S.ep).title+' · '+a+'/'+b+(nwTxt(S.ep)?' · '+nwTxt(S.ep):'')+(S.excl.has(S.ep)?' · paused':''); }
}
async function renderEp(){
  const id = S.ep; view.innerHTML = '<div class="empty">Loading…</div>';
  let g; try{ g = await loadGroup(id); }catch(e){ view.innerHTML='<div class="empty">Could not load this episode. Check your connection and reload.</div>'; return; }
  if(S.ep!==id || S.view!=='ep') return;
  const set = getLearned(id);
  const lines = g.lines.filter(L => S.flt==='all' || (S.flt==='done'?set.has(L.n):!set.has(L.n)));
  view.dataset.gid = id;
  view.innerHTML = lines.length ? lines.map(L=>lineHTML(g,L)).join('') : '<div class="empty">'+(S.flt==='done'?'No learned lines in this episode yet. Tick the box next to a line when you know it.':'Every line here is marked learned.')+'</div>';
  view.querySelectorAll('.line').forEach(a=>a.dataset.gid=id);
  updateProgress();
  if(S.jump){
    const j=S.jump; S.jump=null; const el=$('#l-'+j.n);
    if(el){
      const L=g.lines.find(x=>x.n===j.n); let hits=new Set();
      if(L && L._n && j.w){ const wn=normWord(j.w), idx=L._n.indexOf(wn); if(idx>=0) hits=hitsFor(L,idx,wn.length); }
      if(L && j.c) L.tk.forEach((h,i)=>{ if(surf(h).includes(j.c)) hits.add(i); });
      el.querySelectorAll('.jp .tk').forEach((t,i)=>t.classList.toggle('hit',hits.has(i)));
      el.scrollIntoView({block:'center'}); el.classList.add('flash');
    }
  } else if(S.autoNext){ S.autoNext=false; goNext(false); }
  refreshHL(); paintToNext();
}
/* the first line not ticked yet: opening Lines lands there; the floating button brings you back to it */
function firstUnl(){ return S.view==='ep' ? view.querySelector('.line:not([data-learned="1"])') : null; }
function goNext(smooth){ const el=firstUnl(); if(!el) return; const hd=$('header'), off=(hd?hd.getBoundingClientRect().bottom:0)+12;
  scrollTo({top:Math.max(0,el.getBoundingClientRect().top+scrollY-off), behavior:smooth?'smooth':'auto'}); }
function paintToNext(){ const b=$('#toNext'); if(!b) return; const el=firstUnl();
  if(!el){ b.hidden=true; return; } const r=el.getBoundingClientRect(), hd=$('header'), top=hd?hd.getBoundingClientRect().bottom:0;
  const off=r.bottom<top || r.top>innerHeight; b.hidden=!off; b.classList.toggle('up', r.bottom<top); }
addEventListener('scroll',()=>{ if(!paintToNext._r){ paintToNext._r=requestAnimationFrame(()=>{ paintToNext._r=0; paintToNext(); }); } },{passive:true});
addEventListener('resize',()=>paintToNext());
$('#toNext').addEventListener('click',()=>goNext(true));

