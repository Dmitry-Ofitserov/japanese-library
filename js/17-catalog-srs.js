/* ----- catalog: every started card with its starting state ----- */
const KIND={L:'Line',W:'Word',K:'Kanji'};
function buildCatalog(){
  const cat=new Map(), T0=t0();
  const nb=new Set(S.index.groups.filter(g=>g.kind==='notebook').map(g=>g.id));
  /* lines */
  groupOrder().forEach(g=>{ const set=getLearned(g.id); if(!set.size) return;
    [...set].sort((a,b)=>a-b).forEach(n=>{ if(!lineOf(g.id,n) || S.norv.has(g.id+':'+n)) return; const ex=nb.has(g.id);
      cat.set('L|'+g.id+':'+n+'|r',{kind:'L',id:g.id+':'+n,dir:'r',gid:g.id,n,def:{c:ex?2:0,l:ex?T0:(getAt(g.id,n)||T0)}}); }); });
  /* words from the Excel notebook start at 2 (recall at 1); others at 0 from the day they were learned */
  const exw=new Set(); groupOrder().forEach(g=>{ if(!nb.has(g.id)) return; const d=S.data.get(g.id), set=getLearned(g.id); if(!d) return;
    d.lines.forEach(L=>{ if(set.has(L.n)) L.b.forEach(b=>wordsOf(b).forEach(x=>exw.add(x.word))); }); });
  /* words are reviewed by blocks of 20 (see word blocks), not as cards */
  /* kanji are reviewed by blocks of 25 (see word blocks), not as cards */
  S.cat=cat; S._wbc=S._kbc=null; srsBadge(); paintLineStat();
  if(S.view==='review' && !S.sess && !view.contains(document.activeElement)) renderReview();
}
const stOf=key=>S.srs.get(key) || (S.cat.get(key)||S.wcat.get(key)||{}).def;
function dueCounts(now){
  const r={L:0,W:0,K:0}; if(!S.cat) return r; now=now||Date.now();
  S.cat.forEach((it,key)=>{ if(due(stOf(key))<=now) r[it.kind]++; }); r.W=wbDueN(); r.K=kbDueN(); return r;
}
function dueItems(){
  const now=Date.now(), w=new Set(), k=new Set(), ka=new Set(); if(!S.cat) return {words:0,kanji:0};
  S.cat.forEach((it,key)=>{ if(it.kind==='L' || due(stOf(key))>now) return; if(it.kind==='W') w.add(it.id); else { ka.add(it.id); if(it.k && it.k.st==='l') k.add(it.id); } });
  /* words due on the progress bar: known words in due blocks (words not learned yet are not part of the bar) */
  wbDueBlocks().forEach(k=>k.ws.forEach(x=>{ if(!x.g || wbKnown(x.e.word)) w.add(x.e.word); }));
  kbDueBlocks().forEach(b=>b.ws.forEach(x=>{ ka.add(x.k.k); if(x.k.st==='l') k.add(x.k.k); }));
  S.kdue=ka;
  return {words:w.size,kanji:k.size};
}
function srsBadge(){
  const di=dueItems(), od=S.dueItems||{}; S.dueItems=di;
  if(od.words!==di.words || od.kanji!==di.kanji){ if(bars.words.el) paintBar('words'); if(bars.kanji.el) paintBar('kanji'); }
  const b=$('#nDue'); if(!b) return; const c=dueCounts(), t=c.L+c.W+c.K; b.textContent=t>=10000?Math.round(t/1000)+'k':t; b.parentNode.title='Review · '+t+' cards due now'; b.parentNode.classList.toggle('hasdue',t>0); }

/* ----- storage: one document per bucket, a map of cards inside; each review merges one card ----- */
function hashStr(s){ let h=0; for(const ch of s) h=(h*31+ch.codePointAt(0))>>>0; return h; }
function srsDoc(key){
  const [kind,id]=key.split('|');
  if(kind==='L') return 'l-'+id.split(':')[0];
  if(kind==='K'){ const e=S.deckMap&&S.deckMap.get(id); return 'k'+Math.floor(((e&&e.frame)||0)/100); }
  return 'w'+(hashStr(id)%32);
}
const SQ=new Map();
function dbWrite(key,st){
  if(!S.db) return;
  if(!S.srsReady){ S.srsPend.set(key,st); return; }
  const doc=srsDoc(key), body={c:{[key]:st}};
  const p=(SQ.get(doc)||Promise.resolve()).then(()=>{
    const ref=S.db.doc('srs/'+doc);
    if(S.srsDocs.has(doc)) return ref.update(body);
    return ref.set(body).then(()=>{ S.srsDocs.add(doc); });
  }).catch(e=>{ note(e && e.code==='quota_exceeded' ? 'The shared store is full, so reviews are kept on this device only.' : 'A review could not be saved to the shared store. It is kept on this device.'); });
  SQ.set(doc,p);
}
function saveCard(key,st){ st.u=Date.now(); S.srs.set(key,st); srsPersist(); dbWrite(key,st); }
function srsFlushPending(){ const p=[...S.srsPend]; S.srsPend.clear(); p.forEach(([k,v])=>dbWrite(k,v)); }
function srsListen(db){
  try{ db.collection('srs').onSnapshot(snap=>{
    let changed=false;
    snap.docs.forEach(d=>{ const v=d.data()||{};
      if(d.id==='meta'){ if(v.sg) S.sg=1; if(v.t0 && v.t0!==S.t0){ S.t0=v.t0; changed=true; srsPersist(); } return; }
      S.srsDocs.add(d.id);
      Object.entries(v.c||{}).forEach(([k,st])=>{ if(kOld(k,st)) return; const cur=S.srs.get(k); if(!cur || (st.u||0)>(cur.u||0)){ S.srs.set(k,st); changed=true; } });
    });
    if(!snap.metadata.fromCache && !S.srsReady){
      S.srsReady=true;
      if(!snap.docs.some(d=>d.id==='meta')) db.doc('srs/meta').set({t0:t0()}).catch(()=>{});
      /* reviews made on this device before the store answered (or while offline) go up now */
      const remote=new Map(); snap.docs.forEach(d=>{ if(d.id!=='meta') Object.entries((d.data()||{}).c||{}).forEach(([k,st])=>remote.set(k,st)); });
      S.srs.forEach((st,k)=>{ const r=remote.get(k); if(!r || (st.u||0)>(r.u||0)) S.srsPend.set(k,st); });
      srsFlushPending();
    }
    if(changed){ srsPersist(); if(S.cat) buildCatalog(); }
  }, ()=>{}); }catch(e){}
}


/* ---------- word blocks: words are reviewed by blocks of 20 (the blocks of the word grid) ----------
   Each word keeps a small record: v = the block count it reached, d = study day its block is due, lc = when its block was last completed,
   p = when it was last reviewed in a block review (progress inside the current round), hj / he = missed on the first try reading the
   Japanese / the English (hard), k = learned through a block review although its line isn't ticked yet.
   A block's count is the lowest count of its started words, its due day the earliest; a new word in a block makes it due today.
   Kanji use the same records under the key 'K|<kanji>', in blocks of 25 (deck order); a kanji block that was never reviewed is new, not due.
   Interval after review number c: the table below (1,1,1,1,1,2,… days), then every 30 days. The due day is worked out from
   the day the block was last completed (lc) and its count, so changing the table moves every block at once.
   Easy words / kanji are shown only on review 1, 4, 7, … of their block (review number % 3 === 1); their count still goes up with the block. */
const IVB=[1,1,1,1,1,2,2,2,2,2,3,3,3,4,4,4,5,5,5,6,7,7,8,9,10,11,12,13,15,16,17,19,21,23,26,28,30], IVCAP=30;
const ivb=c=>c<=0?0:(c<=IVB.length?IVB[c-1]:IVCAP);
const wbDueDay=(st,td)=>(st.lc && st.v!=null)?SD(st.lc)+ivb(st.v):(st.d==null?td:st.d);
const isKr=w=>w.slice(0,2)==='K|';
const permOf=w=>isKr(w)?S.permk.has(w.slice(2)):S.permw.has(w);
const easyOf=w=>isKr(w)?S.easyk.has(w.slice(2)):S.easyw.has(w);
const easyRound=n=>n%3===1;
S.wb=new Map(Object.entries(LS.get('wb.v1',{}))); S.wbDocs=new Set(); S.wbReady=false; S.wbPend=new Map(); S._wbc=S._kbc=null;
let wbLsT=null;
function wbPersist(){ clearTimeout(wbLsT); wbLsT=setTimeout(()=>{ const c={}; S.wb.forEach((v,k)=>{ c[k]=v; }); LS.set('wb.v1',c); },400); }
const wbDoc=w=>'b'+(hashStr(w)%16);
const WBQ=new Map();
function wbWrite(w,st){
  if(!S.db) return;
  if(!S.wbReady){ S.wbPend.set(w,st); return; }
  const doc=wbDoc(w), body={c:{[w]:st}};
  const p=(WBQ.get(doc)||Promise.resolve()).then(()=>{ const ref=S.db.doc('wb/'+doc);
    if(S.wbDocs.has(doc)) return ref.update(body);
    return ref.set(body).then(()=>{ S.wbDocs.add(doc); }); })
    .catch(()=>{ note('A review could not be saved to the shared store. It is kept on this device.'); });
  WBQ.set(doc,p);
}
function wbSave(w,st){ st.u=Date.now(); S.wb.set(w,st); S._wbc=S._kbc=null; wbPersist(); wbWrite(w,st); }
function wbListen(db){
  try{ db.collection('wb').onSnapshot(snap=>{
    let changed=false;
    snap.docs.forEach(d=>{ S.wbDocs.add(d.id); Object.entries((d.data()||{}).c||{}).forEach(([k,st])=>{ const cur=S.wb.get(k); if(!cur || (st.u||0)>(cur.u||0)){ S.wb.set(k,st); changed=true; } }); });
    if(!snap.metadata.fromCache && !S.wbReady){
      S.wbReady=true;
      const remote=new Map(); snap.docs.forEach(d=>Object.entries((d.data()||{}).c||{}).forEach(([k,st])=>remote.set(k,st)));
      S.wb.forEach((st,k)=>{ const r=remote.get(k); if(!r || (st.u||0)>(r.u||0)) S.wbPend.set(k,st); });
      const pend=[...S.wbPend]; S.wbPend.clear(); pend.forEach(([k,v])=>wbWrite(k,v));
    }
    if(changed){ S._wbc=S._kbc=null; wbPersist(); wbRefresh(); }
  }, ()=>{}); }catch(e){}
}
/* redraw what shows block state, without losing the place on the page */
function wbRefresh(){ srsBadge(); if(S.words && S._wc) updateBars(); if(S.sess) return;
  if(S.view==='words' && S.wtab!=='names' && !(document.activeElement && view.contains(document.activeElement) && document.activeElement.matches('input,select'))){ const sy=scrollY; renderWords(true); scrollTo(0,sy); }
  else if(S.view==='review') renderReview();
  else if(S.view==='kanji' && !(document.activeElement && view.contains(document.activeElement) && document.activeElement.matches('input,select'))){ const sy=scrollY; renderKanji(true); scrollTo(0,sy); } }
const wbSt=w=>S.wb.get(w)||{};
const wbKnown=w=>!!wbSt(w).k;
/* the blocks, from the same list as the word grid in study order (words not learned yet included) */
function wbBlocks(){
  if(!S.words || !S._wc) return [];
  const td=today(); if(S._wbc && S._wbc.td===td) return S._wbc.list;
  const it=lxItems(), list=[];
  for(let b=0;b*LXBS<it.length;b++) list.push(wbBlock(it.slice(b*LXBS,(b+1)*LXBS),b,td,'W'));
  S._wbc={td,list}; wbAuto(list); return list;
}
/* kanji blocks: 25 kanji of the deck each, items shaped like word items ({e:{word:'K|<kanji>'}, k}) */
const KITEM=new Map();
function kItem(k){ let x=KITEM.get(k.k); if(!x || x.k!==k){ x={e:{word:'K|'+k.k},k,kk:1}; KITEM.set(k.k,x); } return x; }
function kbBlocks(){
  if(!S.deck) return [];
  const td=today(); if(S._kbc && S._kbc.td===td) return S._kbc.list;
  const list=[];
  for(let b=0;b*KBS<S.deck.length;b++) list.push(wbBlock(S.deck.slice(b*KBS,(b+1)*KBS).map(kItem),b,td,'K'));
  S._kbc={td,list}; wbAuto(list); return list;
}
const blocksOf=kind=>kind==='K'?kbBlocks():wbBlocks();
/* all = the block's words that are not permanent; ws = the ones shown in this round (easy ones sit out 2 rounds of 3) */
function wbBlock(ch,b,td,kind){
  const now=Date.now(), K=kind==='K', all=ch.filter(x=>!permOf(x.e.word));
  const act=all.filter(x=>K || !x.g || wbKnown(x.e.word));
  let lc=0; all.forEach(x=>{ const st=wbSt(x.e.word); if(st.lc) lc=Math.max(lc,st.lc); });
  let cnt=Infinity, dd=Infinity, nn=0, ez0=0;
  /* an easy word with no count yet (e.g. one that was permanent) goes along with its block instead of making it new */
  act.forEach(x=>{ const st=wbSt(x.e.word); if(st.v==null && easyOf(x.e.word)){ ez0++; return; } if(st.v==null){ nn++; cnt=0; if(!K) dd=Math.min(dd,td); } else { cnt=Math.min(cnt,st.v); dd=Math.min(dd,wbDueDay(st,td)); } });
  if(act.length && cnt===Infinity){ cnt=0; nn=ez0; if(!K) dd=td; }
  const c0=act.length?cnt:0, rn=c0+1, sit=!easyRound(rn);
  const ws=all.filter(x=>!(sit && easyOf(x.e.word)));
  const done=ws.filter(x=>{ const st=wbSt(x.e.word); return st.p && st.p>lc && st.p>=now-2*DAY; }).length;
  const hj=all.filter(x=>wbSt(x.e.word).hj).length, he=all.filter(x=>wbSt(x.e.word).he).length;
  const fresh=K && !!act.length && dd===Infinity;
  return {b, ch, all, ws, act:act.length, cnt:act.length?cnt:null, due:act.length&&dd!==Infinity?dd:null, isDue:!!act.length && dd<=td, nn, done, tot:ws.length, hj, he, lc, rn, ne:all.length-ws.length, fresh, kind};
}
/* a due block whose words all sit this round out (easy) moves on by itself */
const WBAUTO=new Set();
function wbAuto(list){ const td=today(), go=list.filter(k=>k.isDue && k.act && !k.tot && !WBAUTO.has(k.kind+k.b+':'+td));
  if(!go.length) return; go.forEach(k=>WBAUTO.add(k.kind+k.b+':'+td)); setTimeout(()=>{ go.forEach(k=>wbComplete(k,true)); wbRefresh(); },0); }
const wbDueBlocks=()=>wbBlocks().filter(k=>k.isDue);
const wbDueN=()=>wbDueBlocks().reduce((a,k)=>a+k.tot,0);
const kbDueBlocks=()=>kbBlocks().filter(k=>k.isDue);
const kbDueN=()=>kbDueBlocks().reduce((a,k)=>a+k.tot,0);
function wbBlockOf(w){
  if(isKr(w)){ const ch=w.slice(2), i=(S.deck||[]).findIndex(k=>k.k===ch); return i<0?null:kbBlocks()[Math.floor(i/KBS)]; }
  return wbBlocks().find(k=>k.ch.some(x=>x.e.word===w)); }
/* one word reviewed (reading the Japanese) in a block review: progress for its block; the block counts +1 once all its words are done */
function wbMark(w){
  const st=Object.assign({},wbSt(w)); st.p=Date.now(); const k0=wbBlockOf(w);
  if(k0 && k0.ch.some(x=>x.e.word===w && x.g)) st.k=1;
  wbSave(w,st); wbCheck(w);
}
function wbCheck(w){ const k=wbBlockOf(w); if(k && k.tot && k.done>=k.tot) wbComplete(k); }
function wbComplete(k,quiet){
  const c=(k.cnt==null?0:k.cnt)+1, d=today()+ivb(c), now=Date.now(), shown=new Set(k.ws);
  (k.all||k.ws).forEach(x=>{ const st=Object.assign({},wbSt(x.e.word)); st.v=c; st.d=d; st.lc=now; if(x.g && shown.has(x)) st.k=1; wbSave(x.e.word,st); });
  if(!quiet) toast((k.kind==='K'?'Kanji block ':'Block ')+(k.b+1)+' done · reviewed '+c+'× · next '+(ivb(c)?'in '+ivb(c)+' day'+(ivb(c)===1?'':'s'):'today'));
}
function wbSetHard(w,dir,on){ const st=Object.assign({},wbSt(w)), f=dir==='b'?'he':'hj'; if(!!st[f]===!!on) return; if(on) st[f]=1; else delete st[f]; wbSave(w,st); }
/* the words of a hard-only review or hard-only listening: from the picked blocks, or every block when none is picked */
function wbHardWords(dir,sel,kind){
  const bl=blocksOf(kind), pick=sel&&sel.length?sel.map(i=>bl[i]).filter(Boolean):bl, out=[];
  pick.forEach(k=>k.ch.forEach(x=>{ if(permOf(x.e.word)) return; const st=wbSt(x.e.word); if(dir==='f'?st.hj:dir==='b'?st.he:(st.hj||st.he)) out.push(x); }));
  return out;
}
const wbNo=w=>{ const k=wbBlockOf(w); return k?k.b+1:'?'; };

