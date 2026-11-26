/* ---------- routing & shell ---------- */
function route(){
  const h = location.hash.slice(1); S.routed=true;
  if(S.cur){ synth && synth.cancel(); endCur(); }
  closeKanji();
  if(h==='words') S.view='words'; else if(h==='kanji') S.view='kanji'; else if(h==='options') S.view='options'; else if(h==='stats') S.view='stats'; else if(h==='review') S.view='review'; else if(h==='listen') S.view='words';
  else if(h.startsWith('edit-')){ S.view='edit'; S.editId=h.slice(5); }
  else { S.view='ep'; const id = h.startsWith('ep-') ? h.slice(3) : (LS.get('lastEp',null)); S.ep = (id && meta(id)) ? id : S.index.groups[0].id; LS.set('lastEp',S.ep); }
  document.querySelectorAll('.tab').forEach(t=>t.setAttribute('aria-selected', t.dataset.v===S.view));
  $('.vol').closest('.row').hidden = ['stats','options','kanji','edit'].includes(S.view);
  $('#rowEp').hidden = S.view!=='ep'; $('#rowWords').hidden = S.view!=='words'; $('#rowKanji').hidden = S.view!=='kanji';
  { const b=$('#toNext'); if(b) b.hidden=true; }
  if(S.view==='ep'){ S.autoNext=true; fillEpSelect(); updateProgress(); renderEp(); }
  else if(S.view==='words'){ view.innerHTML='<div class="empty">Loading…</div>'; S.wShown=150; derive(); }
  else if(S.view==='options') renderOptions();
  else if(S.view==='stats'){ view.innerHTML='<div class="empty">Loading…</div>'; derive(); }
  else if(S.view==='review') renderReview();
  else if(S.view==='edit') renderEdit();
  else renderKanji();
  paintEpEdit(); if(typeof lxPaint==='function') lxPaint();
}
function nav(h){ if(location.hash==='#'+h) route(); else location.hash=h; }
function applyFlags(){ app.classList.toggle('nofur',!S.fur); app.classList.toggle('nogram',!S.gram); app.classList.toggle('notr',!S.tr); }
S.fur=LS.get('fur',true); S.gram=LS.get('gram',true); S.tr=LS.get('tr',true);
S.vol = Math.min(1,Math.max(0,+LS.get('vol',1)));
$('#vol').value=S.vol; $('#volv').textContent=Math.round(S.vol*100)+'%';
[['tFur','fur'],['tGram','gram'],['tTr','tr']].forEach(([id,k])=>{
  const b=$('#'+id); b.setAttribute('aria-pressed',S[k]);
  b.addEventListener('click',()=>{ S[k]=!S[k]; b.setAttribute('aria-pressed',S[k]); LS.set(k,S[k]); applyFlags(); });
});
applyFlags();
$('#vol').addEventListener('input',e=>{ S.vol=+e.target.value; $('#volv').textContent=Math.round(S.vol*100)+'%'; LS.set('vol',S.vol); });
document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>nav(t.dataset.v==='ep'?'ep-'+(S.ep||S.index.groups[0].id):t.dataset.v)));
$('#epSel').addEventListener('change',e=>nav('ep-'+e.target.value));
$('#epAdd').addEventListener('click',ceNew);
$('#epEdit').addEventListener('click',()=>nav('edit-'+S.ep));
$('#flt').addEventListener('change',e=>{ S.flt=e.target.value; renderEp(); });
$('#wq').addEventListener('input',()=>renderWords()); $('#wsort').addEventListener('change',()=>renderWords());
const mtip=$('#mtip');
function miniTip(e){
  if(wbMiniTip(e)) return;
  const c=e.target.closest && e.target.closest('.mc'); if(!c){ mtip.hidden=true; return; }
  const all=S.mall||S.deck, i=+c.dataset.i, k=all[i]; if(!k){ mtip.hidden=true; return; }
  mtip.innerHTML='<span class="mn">'+(k.frame?'#'+k.frame:'+'+(i-S.deck.length+1))+'</span><span class="jp" lang="ja">'+esc(k.k)+'</span><span>'+esc(k.kw||'not in your deck')+'</span>'; mtip.hidden=false;
  /* always the same spot: left edge of the strip, just above it (below it when there is no room) */
  const r=$('.minirow').getBoundingClientRect(), h=mtip.offsetHeight;
  mtip.style.left=Math.max(6,r.left)+'px';
  mtip.style.top=(r.top-h-8 > 150 ? r.top-h-8 : r.bottom+8)+'px';
}
view.addEventListener('pointermove',miniTip); view.addEventListener('pointerdown',miniTip);
view.addEventListener('pointerleave',()=>{ mtip.hidden=true; });
document.addEventListener('scroll',()=>{ mtip.hidden=true; },{passive:true});
$('#kq').addEventListener('input',()=>renderKanji()); $('#kf').addEventListener('change',()=>renderKanji());
view.addEventListener('toggle',e=>{ const d=e.target; if(d.classList && d.classList.contains('inst') && d.open) fillInst(d,40); },true);
$('#kd').addEventListener('click',e=>{
  if(e.target.closest('.sx')){ closeKanji(); return; }
  const bk=e.target.closest('.bkt'); if(bk){ toggleBucket(bk.dataset.bk); return; }
  const pk=e.target.closest('[data-permk]'); if(pk){ const ch=pk.dataset.permk; setPermK(ch,!S.permk.has(ch)); showKanji(ch,true); return; }
  const kn=e.target.closest('[data-knav]'); if(kn){ kStep(+kn.dataset.knav); return; }
  if(e.target.closest('[data-kedit]')){ kEditStory(); return; }
  if(e.target.closest('[data-ksave]')){ kSaveEdit(); return; }
  if(e.target.closest('[data-kcancel]')){ showKanji(S.kcur.ch,true); return; }
  const ez=e.target.closest('[data-easy]'); if(ez){ const w=ez.dataset.easy; setEasy(w,!easyOf(w)); if(isKr(w)) showKanji(w.slice(2),true); else if(S.wcur) showWordE(S.wcur.e); return; }
  const pm=e.target.closest('[data-perm]'); if(pm){ setPerm(pm.dataset.perm,!S.permw.has(pm.dataset.perm)); if(S.wcur) showWordE(S.wcur.e); return; }
  const wn=e.target.closest('[data-wnav]'); if(wn){ wordStep(+wn.dataset.wnav); return; }
  const kch=e.target.closest('.kchip'); if(kch){ showKanji(kch.dataset.k); return; }
  const wch=e.target.closest('.wchip'); if(wch){ openWord(wch.dataset.w); return; }
  const sy=e.target.closest('[data-say]'); if(sy){ speak({text:sy.dataset.say, rate:1}); return; }
  const wm=e.target.closest('.wmoreb'); if(wm){ fillWordLines(+wm.dataset.n+60); return; }
  const rf=e.target.closest('.ref'); if(rf && rf.closest('.wlist, .wfirst')){ jumpTo(rf.dataset.gid,+rf.dataset.n,{w:rf.dataset.w}); return; }
  if(e.target.closest('.nico')){ setTimeout(closeKanji,0); return; }
  const km=e.target.closest('.kmoreb'); if(km) fillK(km.closest('details'),+km.dataset.n+60);
});
view.addEventListener('toggle',e=>{ const d=e.target; if(d.classList && d.classList.contains('wep') && d.open) fillEp(d); },true);
$('#kd').addEventListener('toggle',e=>{ const d=e.target; if(d.classList && d.classList.contains('wep') && d.open) fillEp(d); if(d.classList && d.classList.contains('kmore') && d.open) fillK(d,40); },true);
view.addEventListener('keydown',e=>{ if((e.key==='Enter'||e.key===' ') && e.target.classList && e.target.classList.contains('wcard')){ e.preventDefault(); showWord(e.target.dataset.ws,+e.target.dataset.wi); } });
document.addEventListener('keydown',e=>{ if(e.target.id==='kta'){ if(e.key==='Enter' && (e.ctrlKey||e.metaKey)){ e.preventDefault(); kSaveEdit(); } else if(e.key==='Escape'){ e.preventDefault(); showKanji(S.kcur.ch,true); } return; }
  if((e.key==='ArrowLeft'||e.key==='ArrowRight') && !$('#kd').hidden && S.kcur && $('#kd .knav') && !/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)){ e.preventDefault(); kStep(e.key==='ArrowLeft'?-1:1); } });
document.addEventListener('keydown',e=>{ if((e.key==='ArrowLeft'||e.key==='ArrowRight') && !$('#kd').hidden && S.wcur && $('#kd .wnav') && !/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)){ e.preventDefault(); wordStep(e.key==='ArrowLeft'?-1:1); } });
document.addEventListener('keydown',e=>{ if(e.key==='Escape'){ closeKanji(); const d=$('.stg'); if(d) d.open=false; } });
document.addEventListener('click',e=>{ const d=$('.stg'); if(d && d.open && !d.contains(e.target)) d.open=false; });
window.addEventListener('hashchange',()=>{ if(S.index) route(); });

view.addEventListener('click',e=>{
  const pb = e.target.closest('.play');
  if(pb){
    if(pb.dataset.w){ speak({text:pb.dataset.w, btn:pb, rate:1}); return; }
    playLine(pb.closest('.line'), pb); return;
  }
  const ref = e.target.closest('.ref');
  if(ref){ jumpTo(ref.dataset.gid,+ref.dataset.n,{w:ref.dataset.w,c:ref.dataset.c}); return; }
  const kd0 = e.target.closest('[data-kdir]'); if(kd0){ S.kdir=kd0.dataset.kdir; LS.set('kdir',S.kdir); paintKpick(); return; }
  if(e.target.closest('[data-krev]')){ kStart(); return; }
  const kh=e.target.closest('[data-khard]'); if(kh && !kh.disabled){ wbStart(kh.dataset.khard==='b'?'hb':'hf',{kind:'K',sel:[...S.kpick]}); return; }
  if(e.target.closest('[data-kdue]')){ S.kpick=new Set(kbBlocks().filter(k=>k.isDue).map(k=>k.b)); saveKpick(); paintKpick(); return; }
  if(e.target.closest('[data-kclr]')){ S.kpick.clear(); saveKpick(); paintKpick(); return; }
  const kc = e.target.closest('.kcell, .kchip'); if(kc){ showKanji(kc.dataset.k); if(kc.classList.contains('kcell')) kMarkCell(kc.dataset.k); return; }
  const wch = e.target.closest('.wchip'); if(wch){ openWord(wch.dataset.w); return; }
  const ms = e.target.closest('.msq'); if(ms){ const mi=e.target.closest('.mc'), ex=mi && S.mall && +mi.dataset.i>=S.deck.length; if(ex){ const t=$('#big-x'); if(t) t.scrollIntoView({behavior:REDUCED?'auto':'smooth',block:'start'}); return; } const mb=e.target.closest('.mb[data-b]'); if(mb){ const b=+mb.dataset.b; if(S.kpick.has(b)) S.kpick.delete(b); else S.kpick.add(b); saveKpick(); paintKpick(); } return; }
  const bkb = e.target.closest('.bkt'); if(bkb){ toggleBucket(bkb.dataset.bk); return; }
  const nv = e.target.closest('.line .norv'); if(nv){
    const art=nv.closest('.line'), id=view.dataset.gid, n=+art.dataset.n, k=id+':'+n;
    if(S.norv.has(k)) S.norv.delete(k);
    else { S.norv.add(k); const cb=art.querySelector('.lc'); if(cb && !cb.checked){ cb.checked=true; cb.dispatchEvent(new Event('change',{bubbles:true})); } }
    saveNorv(); buildCatalog(); paintLineStat(); return; }
  const sy = e.target.closest('[data-say]'); if(sy){ speak({text:sy.dataset.say, rate:1, el:sy}); return; }
  const tk = e.target.closest('.line .jp .tk'); if(tk && !tk.classList.contains('sp')){
    const art=tk.closest('.line'), gw=art.closest('[data-gid]'), L=gw&&lineOf(gw.dataset.gid,+art.dataset.n);
    const w=L&&tokWord(L,[...art.querySelectorAll('.jp .tk')].indexOf(tk)); if(w){ openWord(w); return; } }
  if(e.target.closest('.nico')) return;
  const wgc = e.target.closest('.wgc'); if(wgc){ if(wgc.dataset.pw){ openWord(wgc.dataset.pw); return; } showWord(wgc.dataset.ws,+wgc.dataset.wi); return; }
  const wc = e.target.closest('.wcard'); if(wc){ showWord(wc.dataset.ws,+wc.dataset.wi); return; }
  const im = e.target.closest('.imore'); if(im){ fillInst(im.closest('details'), +im.dataset.n+60); return; }
  if(e.target.id==='wmore'){ S.wShown+=150; renderWords(true); }
});
view.addEventListener('change',e=>{
  if(!e.target.classList.contains('lc')) return;
  const art = e.target.closest('.line'), id = view.dataset.gid, n = +art.dataset.n, set = getLearned(id);
  if(e.target.checked){ const L=lineOf(id,n); if(L && S.deckMap) setFz(id,n,newCounts(L,freshKnown())); set.add(n); if(!getAt(id,n)) setAt(id,n,Date.now()); } else { set.delete(n); if(Date.now()-getAt(id,n)<10*60000) setAt(id,n,0); setFz(id,n,null); if(S.norv.delete(id+':'+n)) saveNorv(); }
  { const la=art.querySelector('.lat'); if(la) la.textContent=latTxt(id,n); }
  art.dataset.learned = e.target.checked?1:0; paintToNext();
  S.tickAt=Date.now(); S.localSaved.add(id); saveLearned(id); updateProgress(); scheduleWords(); paintNew();
});

