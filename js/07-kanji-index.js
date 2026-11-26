/* ---------- kanji index ---------- */
function buildKanjiIndex(){
  const deck=new Map();
  S.index.groups.forEach(g=>{ const d=S.data.get(g.id); if(d && d.kanji) d.kanji.forEach(k=>deck.set(k[1],{frame:k[0],k:k[1],kw:k[2],on:k[3],kun:k[4],story:k[5]})); });
  S.deck=[...deck.values()].sort((a,b)=>a.frame-b.frame); S.deckMap=deck; kApplyStories();
  const occ=new Map();
  groupOrder().forEach(g=>{ const d=S.data.get(g.id); d.lines.forEach(L=>{
    const seen=new Set(), nt=nameTokens(L);
    L.tk.forEach((h,i)=>{ if(nt.has(i)) return; for(const ch of surf(h)){ if(KJ.test(ch) && !seen.has(ch)){ seen.add(ch); if(!occ.has(ch)) occ.set(ch,[]); occ.get(ch).push({gid:g.id,n:L.n,id:L.id||L.n}); } } });
  }); });
  S.kocc=occ;
}
S.kmode = LS.get('kmode','lines');
/* kanji colouring: two built-in states + rules on how many learned words contain the kanji (first match from the top wins) */
const KHL_DEF={ due:{on:true,color:'#e23b3b'}, due2:{on:true,color:'#ff7a66'}, pend:{on:true,color:'#e0a100'}, rules:[] };
function fixKHL(v){ if(!(v && v.due && v.pend && Array.isArray(v.rules))) return null; if(!v.due2) v.due2=JSON.parse(JSON.stringify(KHL_DEF.due2)); return v; }
S.khl = fixKHL(LS.get('khl.v1',null)) || JSON.parse(JSON.stringify(KHL_DEF));
let khlT=null;
function saveKHL(){ LS.set('khl.v1',S.khl); clearTimeout(khlT); khlT=setTimeout(()=>{ if(S.db) S.db.doc('settings/khl').set({v:JSON.stringify(S.khl)}).catch(()=>{}); },500); if(S.view==='options') updateKRuleCounts(); }
function kwCount(ch){
  if(!S.kwc || S.kwcV!==S.words){ const m=new Map(); (S.words||[]).forEach(w=>{ new Set([...w.word].filter(c=>KJ.test(c))).forEach(c=>m.set(c,(m.get(c)||0)+1)); }); S.kwc=m; S.kwcV=S.words; }
  return S.kwc.get(ch)||0;
}
/* {c: colour or null, due: bool, r: index of the matching rule} */
function kcolor(e){
  const K=S.khl;
  if(e.st==='l'){
    if(K.due.on && S.kdue && S.kdue.has(e.k)) return {c:K.due.color,due:true,r:'due'};
    const n=kwCount(e.k), i=K.rules.findIndex(r=>r.on && (r.cmp==='le'?n<=r.n:n>=r.n));
    return i>=0 ? {c:K.rules[i].color,r:i} : {c:null,r:'l'};
  }
  if(K.due2.on && S.kdue && S.kdue.has(e.k)) return {c:K.due2.color,due:true,r:'due2'};
  if(e.st==='p' && K.pend.on) return {c:K.pend.color,r:'pend'};
  return {c:null,r:'n'};
}
/* timer bar inside a kanji cell: the direction closest to due; red when either is due */
function kcellBar(ch){
  if(S.permk.has(ch)) return ''; const k=wbBlockOf('K|'+ch); if(!k || k.fresh || !k.act || k.due==null) return '';
  if(k.isDue) return '100.0'; const iv=Math.max(1,ivb(k.cnt)), f=Math.min(1,Math.max(0,1-(k.due-today())/iv));
  return (f*100).toFixed(1);
}
const kcls=e=>{ if(S.permk.has(e.k)) return {cls:'st-l kperm',sty:''}; if(S.easyk.has(e.k) && !(S.kdue && S.kdue.has(e.k))) return {cls:'st-l keasy',sty:''}; const k=kcolor(e); return {cls:(e.st==='p'&&!S.khl.pend.on?'st-n':'st-'+e.st)+(k.c?' kcol':'')+(k.due?' kdue':''), sty:k.c?' style="--kc:'+k.c+'"':''}; };
function learnedIn(ch){ const o=S.kocc.get(ch); return !!(o && o.some(x=>isLearnedLine(x.gid,x.n))); }
function kstate(ch,story){ if(S.permk.has(ch)) return 'l'; return (S.kmode==='story' ? !!story : learnedIn(ch)) ? 'l' : (pendingIn(ch)?'p':'n'); }
function pendingIn(ch){ const o=S.kocc.get(ch); return !!(o && o.some(x=>!isLearnedLine(x.gid,x.n) && !S.excl.has(x.gid))); }
function computeKanjiStats(){
  let l=0,p=0;
  S.deck.forEach(e=>{ e.st=kstate(e.k,e.story); e.ts=e.st==='l'?learnedTs(e.k,e.story):0; if(e.st==='l') l++; else if(e.st==='p') p++; });
  S.extras=[...S.kocc.keys()].filter(c=>!S.deckMap.has(c)).map(c=>{ const x=KEXTRA[c]; return {k:c,frame:x?x[0]:null,kw:x?x[1]:'',on:'',kun:'',story:'',st:kstate(c,'')}; });
  S.kstats={l,p,t:S.deck.length};
  const n=$('#nKanji'); n.textContent=l; n.parentNode.title='Kanji · '+l+' seen in learned lines ('+p+' more in unlearned lines, '+S.deck.length+' in the deck)';
}

