/* ---------- kanji: start as new, permanently learned, review by blocks of 25, edited mnemonics ---------- */
/* every kanji review saved before this moment was cleared: kanji start as new and get their first schedule when first reviewed */
const KRESET=1795371423069, KBS=25;
const kOld=(k,st)=>k[0]==='K' && ((st&&st.u)||0)<KRESET;
/* kanji marked as permanently learned: counted as learned, never reviewed */
S.permk=new Set(LS.get('permk.v1',[]));
function savePermK(){ LS.set('permk.v1',[...S.permk]); if(S.db) S.db.doc('settings/permk').set({ids:[...S.permk]}).catch(()=>{}); }
function setPermK(ch,on){
  if(on) S.permk.add(ch); else S.permk.delete(ch);
  if(on && S.easyk.delete(ch)) saveEasyK();
  if(on){ const b=S.bucket.filter(x=>x!=='K|'+ch+'|f' && x!=='K|'+ch+'|b'); if(b.length!==S.bucket.length){ S.bucket=b; saveBucket(); } }
  savePermK(); kAfterPerm();
  toast(ch+(on?' marked as permanently learned':' back in normal reviews'));
}
function kAfterPerm(){
  S._wbc=S._kbc=null; if(S.cat) buildCatalog(); if(S.deck) computeKanjiStats(); if(S.words && S._wc) updateBars();
  if(S.view==='kanji' && !S.sess){ const sy=scrollY; renderKanji(true); scrollTo(0,sy); }
}
/* a review card for a kanji: the started card, or a new one (not scheduled until it is first answered) */
function kKey(ch,d){
  const key='K|'+ch+'|'+d; if(S.cat && S.cat.has(key)) return key;
  const k=S.deckMap && S.deckMap.get(ch); if(!k || S.permk.has(ch)) return null;
  if(!S.wcat.has(key)) S.wcat.set(key,{kind:'K',id:ch,dir:d,k,def:{c:0,l:Date.now(),nw:1}});
  return key;
}
/* after the first answer a new kanji card joins the catalog with its own schedule */
function kStarted(key){ const it=S.wcat.get(key); if(!it || !S.srs.has(key) || !S.cat) return; S.cat.set(key,Object.assign({},it,{def:S.srs.get(key)})); S.wcat.delete(key); }
const kIsNew=ch=>!S.srs.has('K|'+ch+'|f') && !S.srs.has('K|'+ch+'|b');

/* picked blocks (25 kanji each, numbered from 0 in deck order) and the review direction */
S.kpick=new Set(LS.get('kpick.v1',[])); S.kdir=LS.get('kdir','f');
function saveKpick(){ LS.set('kpick.v1',[...S.kpick]); }
function kBlock(b){ return (S.deck||[]).slice(b*KBS,(b+1)*KBS); }
function kPickInfo(){
  const bl=kbBlocks(), pk=[...S.kpick].map(b=>bl[b]).filter(Boolean);
  return {b:pk.length,n:pk.reduce((a,k)=>a+k.tot,0),nw:pk.filter(k=>k.fresh).length};
}
/* the kanji page's review panel: picked blocks (or the due ones), hard kanji, pick the due blocks */
function kPickBarHTML(){
  const p=kPickInfo(), nums=[...S.kpick].sort((a,b)=>a-b).map(b=>b+1), bl=kbBlocks(), due=bl.filter(k=>k.isDue), dn=due.reduce((a,k)=>a+k.tot,0);
  const sel=[...S.kpick], hf=wbHardWords('f',sel,'K').length, hb=wbHardWords('b',sel,'K').length, n=p.b?p.n:dn, st=bl.filter(k=>k.act && !k.fresh).length;
  return '<div class="kpbar" id="kpbar"><span class="kpi">'+(p.b?'<b>'+p.b+'</b> block'+(p.b===1?'':'s')+' picked ('+(nums.length>6?nums.slice(0,6).join(', ')+'…':nums.join(', '))+') · '+p.n+' kanji'+(p.nw?' · '+p.nw+' new':''):(due.length?'<b>'+due.length+'</b> block'+(due.length===1?'':'s')+' due · '+dn+' kanji':'No kanji blocks due')+' · '+st+' of '+bl.length+' started · tap blocks in the map to pick them')+'</span>'+
    '<button class="btn pri" data-krev'+(n?'':' disabled')+' title="字 → keyword: advances the block count">'+(p.b?'Review picked':'Review due')+' · '+n+'</button>'+
    '<button class="btn" data-khard="f"'+(hf?'':' disabled')+' title="Hard kanji, kanji shown">Hard 字→kw · '+hf+'</button><button class="btn" data-khard="b"'+(hb?'':' disabled')+' title="Hard kanji, keyword shown">Hard kw→字 · '+hb+'</button>'+
    '<button class="btn" data-kdue'+(due.length?'':' disabled')+'>Pick due · '+due.length+'</button>'+(p.b?'<button class="btn" data-kclr>Clear</button>':'')+'</div>';
}
function paintKpick(){
  view.querySelectorAll('.msq .mb[data-b]').forEach(m=>m.classList.toggle('sel',S.kpick.has(+m.dataset.b)));
  view.querySelectorAll('.blk[data-b]').forEach(m=>m.classList.toggle('sel',S.kpick.has(+m.dataset.b)));
  const bar=$('#kpbar'); if(bar) bar.outerHTML=kPickBarHTML();
}
/* review the picked blocks: block by block in deck order, kanji shuffled inside a block (or all mixed with "Mix blocks") */
function kStart(){ if(!S.deck) return; wbStart('blk',{kind:'K',sel:[...S.kpick].sort((a,b)=>a-b)}); }

/* mnemonics edited in the app: one store document per 100 frames, newest edit wins */
S.kedit=new Map(Object.entries(LS.get('kstory.v1',{}))); S.kedDocs=new Set();
function kApplyStories(){ if(!S.deckMap) return; S.kedit.forEach((v,ch)=>{ const e=S.deckMap.get(ch); if(e) e.story=v.t; }); }
const kedDoc=ch=>{ const e=S.deckMap&&S.deckMap.get(ch); return 'k'+Math.floor(((e&&e.frame)||0)/100); };
const KQ=new Map();
function kSaveStory(ch,t){
  const v={t,u:Date.now()}; S.kedit.set(ch,v); const c={}; S.kedit.forEach((x,k)=>{ c[k]=x; }); LS.set('kstory.v1',c);
  const e=S.deckMap.get(ch); if(e) e.story=t;
  if(!S.db) return; const doc=kedDoc(ch), body={s:{[ch]:v}};
  const p=(KQ.get(doc)||Promise.resolve()).then(()=>{ const ref=S.db.doc('kstory/'+doc); if(S.kedDocs.has(doc)) return ref.update(body); return ref.set(body).then(()=>{ S.kedDocs.add(doc); }); })
    .catch(()=>{ note('The mnemonic could not be saved to the shared store. It is kept on this device.'); });
  KQ.set(doc,p);
}
function kstoryListen(db){
  try{ db.collection('kstory').onSnapshot(snap=>{
    let ch=false;
    snap.docs.forEach(d=>{ S.kedDocs.add(d.id); Object.entries((d.data()||{}).s||{}).forEach(([k,v])=>{ const cur=S.kedit.get(k); if(!cur || (v.u||0)>(cur.u||0)){ S.kedit.set(k,v); ch=true; } }); });
    if(!snap.metadata.fromCache){ const remote=new Set(); snap.docs.forEach(d=>Object.keys((d.data()||{}).s||{}).forEach(k=>remote.add(k)));
      if(!S.kedSynced){ S.kedSynced=true; S.kedit.forEach((v,k)=>{ if(!remote.has(k) && S.deckMap) kSaveStory(k,v.t); }); } }
    if(ch){ const c={}; S.kedit.forEach((x,k)=>{ c[k]=x; }); LS.set('kstory.v1',c); kApplyStories();
      if(S.kcur && !$('#kd').hidden && !$('#kd .kta')) showKanji(S.kcur.ch,true); }
  },()=>{}); }catch(e){}
}

/* the kanji sheet: previous / next in deck order */
function kNavList(){ return S.mall || S.deck || []; }
function kStep(d){ const l=kNavList(), i=l.findIndex(x=>x.k===(S.kcur&&S.kcur.ch)); const n=l[i+d]; if(!n) return; showKanji(n.k,true); kMarkCell(n.k,true); }
function kMarkCell(ch,scroll){ view.querySelectorAll('.kcell.wcur').forEach(x=>x.classList.remove('wcur')); const c=view.querySelector('.kcell[data-k="'+CSS.escape(ch)+'"]'); if(c){ c.classList.add('wcur'); if(scroll) c.scrollIntoView({block:'nearest'}); } }
/* review timers in two aligned rows: direction, count, time since the last success / interval, then the bar */
function kTimers(ch){
  if(S.permk.has(ch)) return '<span class="wst wperm" title="Permanently learned: never reviewed">∞ permanent</span>';
  { const k=wbBlockOf('K|'+ch); return k?'<span class="wsts">'+blkStatHTML(k,'K|'+ch,wbSt('K|'+ch))+'</span>':''; }
  const row=(d,tag,lab)=>{ const x=cardStat('K|'+ch+'|'+d); if(!x) return '<span class="kti knw" title="'+lab+': not reviewed yet"><i>'+tag+'</i><b>new</b><span></span><span class="tb"></span></span>';
    return '<span class="kti'+(x.isDue?' isdue':'')+'" title="'+escA(lab+': rep count '+fmtCnt(x.c)+' · '+fmtDur(x.ago)+' since the last success / interval '+fmtDur(x.iv)+' · '+dueTxt(x))+'"><i>'+tag+'</i><b>'+fmtCnt(x.c)+'</b><span>'+agoIv(x)+'</span>'+tbar(x)+'</span>'; };
  return '<span class="ktim">'+row('f','JP','Kanji card (you see the kanji)')+row('b','EN','Keyword card (you see the keyword)')+'</span>';
}

const BKT2 = base => ['f','b'].map(d=>{ const id=base+'|'+d, on=inBucket(id), t=d==='f'?'JP':'EN';
  return '<button class="bkt bk2" data-bk="'+escA(id)+'" aria-pressed="'+on+'" aria-label="Review bucket, '+t+' card" title="'+(on?t+' card in the review bucket · tap to take it out':'Add the '+t+' card to the review bucket')+'">'+ICO_BKT+'<span>'+t+'</span></button>'; }).join('');
const BKT = id => { const on=inBucket(id); return '<button class="bkt" data-bk="'+escA(id)+'" aria-pressed="'+on+'" aria-label="Review bucket" title="'+(on?'In the review bucket · tap to take it out':'Add to the review bucket')+'">'+ICO_BKT+'</button>'; };
function bkLabel(id){ const dm=id.match(/\|([fbr])$/), v=id.slice(2).replace(/\|[fbr]$/,''); if(dm&&dm[1]!=='r') return v+' · '+(dm[1]==='f'?'JP':'EN'); if(id[0]==='L'){ const i=v.lastIndexOf(':'), g=meta(v.slice(0,i)); return (g?g.short:v.slice(0,i))+' · line '+v.slice(i+1); } return v; }
function bkKeys(id){ return bkMig([id]).filter(k=>S.cat && S.cat.has(k)); }
function paintBucket(){
  paintHead();
  document.querySelectorAll('.bkt').forEach(b=>{ const on=inBucket(b.dataset.bk); b.setAttribute('aria-pressed',on); if(!b.classList.contains('bk2')) b.title=on?'In the review bucket · tap to take it out':'Add to the review bucket'; });
  if(S.view==='review' && !S.sess) renderReview();
}
function toggleBucket(id){ const on=!inBucket(id); if(on) S.bucket.push(id); else S.bucket=S.bucket.filter(x=>x!==id); saveBucket(); paintBucket(); toast(bkLabel(id)+(on?' added to the review bucket':' taken out of the review bucket')); }
const PLAY = r => '<button class="play" data-rate="'+r+'" aria-pressed="false" aria-label="'+(r==='slow'?'Play slowly':'Play')+'" title="'+(r==='slow'?'Play slowly ('+SLOW+'×)':'Play')+'">'+(r==='slow'?ICO_SLOW:ICO_PLAY)+'</button>';
const STOP = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="3" width="10" height="10" rx="1.5"/></svg>';
function note(m){ const n=$('#note'); n.hidden=!m; n.textContent=m||''; }

