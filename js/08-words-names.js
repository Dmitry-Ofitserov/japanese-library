/* ---------- words ---------- */
/* ---------- loanwords (katakana spellings of foreign words, e.g. キス = kiss): listed apart, not counted as words ---------- */
S.luser = Object.assign({add:[],remove:[]}, LS.get('loans.v1',{}));
function saveLoans(){ LS.set('loans.v1',S.luser); if(S.db) S.db.doc('settings/loans').set(S.luser).catch(()=>{}); }
function isLoan(w){ if(S.luser.remove.includes(w)) return false; return S.luser.add.includes(w) || !!(S.lem && S.lem.loans && S.lem.loans.includes(w)); }
function setLoan(w,on){ S.luser.add=S.luser.add.filter(x=>x!==w); S.luser.remove=S.luser.remove.filter(x=>x!==w);
  const base=!!(S.lem && S.lem.loans && S.lem.loans.includes(w)); if(on && !base) S.luser.add.push(w); if(!on && base) S.luser.remove.push(w); saveLoans(); derive(); }
/* ---------- character names ---------- */
S.nuser = Object.assign({add:[],remove:[]}, LS.get('names.v1',{}));
function saveNames(){ LS.set('names.v1',S.nuser); if(S.db) S.db.doc('settings/names').set(S.nuser).catch(()=>{}); }
function rebuildNames(){
  const base=(S.index && S.index.names) || [], rm=new Set(S.nuser.remove.map(normWord)), seen=new Map();
  [...base,...S.nuser.add].forEach(s=>{ const n=normWord(s); if(n && !rm.has(n) && !seen.has(n)) seen.set(n,s); });
  S.nameList=[...seen].map(([n,show])=>({n,show})).sort((a,b)=>b.n.length-a.n.length);
  S.nameN=S.nameList.map(x=>x.n); S.nver=(S.nver||0)+1;
}
function addName(s){ const n=normWord(s); if(!n) return; S.nuser.remove=S.nuser.remove.filter(x=>normWord(x)!==n); if(!S.nuser.add.some(x=>normWord(x)===n) && !((S.index.names||[]).some(x=>normWord(x)===n))) S.nuser.add.push(s.trim()); saveNames(); rebuildNames(); derive(); }
function removeName(n){ S.nuser.add=S.nuser.add.filter(x=>normWord(x)!==n); if((S.index.names||[]).some(x=>normWord(x)===n) && !S.nuser.remove.includes(n)) S.nuser.remove.push(n); saveNames(); rebuildNames(); derive(); }
/* which tokens of a line are character names (cached per dictionary version) */
function nameTokens(L){
  if(!L._n) return new Set();
  if(L._ntv===S.nver) return L._nt;
  const s=new Set();
  (S.nameList||[]).forEach(nm=>{ let i=L._n?L._n.indexOf(nm.n):-1; while(i>=0){ for(let k=i;k<i+nm.n.length;k++) s.add(L._m[k]); i=L._n.indexOf(nm.n,i+nm.n.length); } });
  L._nt=s; L._ntv=S.nver; return s;
}
/* remove name parts from a bullet's headword; what is left (if anything useful) stays a normal word */
function stripNames(word){
  const comps=word.split(/[\s+＋]+/).filter(Boolean); let hit=false; const rest=[];
  comps.forEach(c=>{
    let n=normWord(c), cut=false, nm;
    while(n && (nm=S.nameN.find(x=>n===x||n.startsWith(x)))){ n=n.slice(nm.length); cut=true; }
    if(cut){ hit=true; if(n) rest.push(n); } else rest.push(c);
  });
  if(!hit) return word;
  const w=rest.join(' + ');
  return (KJ.test(w) || w.replace(/[\s+]/g,'').length>=3) ? w : null;
}
function computeNames(){
  const order=groupOrder(), rank=new Map(order.map((g,i)=>[g.id,i])), m=new Map();
  order.forEach(g=>{ const set=getLearned(g.id), d=S.data.get(g.id); if(!d) return;
    d.lines.forEach(L=>{ if(!set.has(L.n)||!L._n) return; const ts=getAt(g.id,L.n);
      S.nameList.forEach(nm=>{ if(L._n.indexOf(nm.n)<0) return; const e=m.get(nm.n);
        if(!e) m.set(nm.n,{word:nm.show,key:nm.n,reading:'',means:[],ts,src:{gid:g.id,n:L.n},isName:true}); else e.ts=Math.min(e.ts,ts); }); }); });
  /* meanings: bullets whose whole headword is exactly the name */
  order.forEach(g=>{ const d=S.data.get(g.id); if(!d) return; d.lines.forEach(L=>L.b.forEach(b=>{
    const i=b.indexOf(' - '); if(i<0) return; const head=b.slice(0,i).replace(/\s*\([^)]*\)/g,''), e=m.get(normWord(head)); if(!e) return;
    const mean=b.slice(i+3).trim(), r=b.slice(0,i).match(/\(([^)]*)\)/);
    if(r && !e.reading && /^[぀-ヿ]+$/.test(r[1])) e.reading=r[1];
    if(mean && !/^name$/i.test(mean) && e.means.length<2 && !e.means.includes(mean)) e.means.push(mean); })); });
  const names=[...m.values()];
  names.forEach((e,i)=>{
    e.i=i; e.inst=[]; const wn=normWord(e.word);
    order.forEach(g=>{ const d=S.data.get(g.id); if(!d) return; d.lines.forEach(L=>{ const idx=L._n?L._n.indexOf(wn):-1; if(idx>=0) e.inst.push({gid:g.id,n:L.n,idx,len:wn.length}); }); });
    e.first=e.inst[0]||{gid:e.src.gid,n:e.src.n,idx:-1,len:0}; e.rank=rank.get(e.first.gid)*1e6+e.first.n;
    if(!e.means.length) e.means.push('Character name');
  });
  S.names=names;
}
function renderNames(){
  view.dataset.gid='';
  const q=$('#wq').value.trim().toLowerCase();
  const ns=S.names.filter(n=>!q||(n.word+' '+n.reading+' '+n.means.join(' ')).toLowerCase().includes(q)).sort((a,b)=>a.rank-b.rank||a.i-b.i);
  view.innerHTML='<div class="nadd"><input type="text" id="nadd" placeholder="Add a name exactly as written in the subtitles" aria-label="Add a name"><button class="btn" id="nbtn">Add</button></div>'+
    '<div class="kf" style="padding:6px 0">'+S.names.length+' names from learned lines · never counted as words or kanji</div>'+
    (ns.length?'<div class="wgrid">'+ns.map(wordRow).join('')+'</div>'+(setTimeout(markOverflow),''):'<div class="empty">No names yet. Names from your dictionary show up here once a learned line contains them.</div>');
}
document.addEventListener('click',e=>{
  if(e.target.closest('.hbk')){ nav('review'); return; }
  const t=e.target.closest('[data-wt]'); if(t){ S.wtab=t.dataset.wt; LS.set('wtab',S.wtab); syncWtab(); renderWords(); return; }
  const fw=e.target.closest('[data-fullw]'); if(fw){ S.fullw=fw.dataset.fullw==='1'; LS.set('fullw',S.fullw); syncFullw(); if(S.view==='kanji') renderKanji(true); else renderWords(); return; }
  const kc=e.target.closest('[data-kcol]'); if(kc){ S.kcols=+kc.dataset.kcol; LS.set('kcols',S.kcols); syncKcol(); renderKanji(true); return; }
  const wq=e.target.closest('[data-wsq]'); if(wq){ S.wsq=+wq.dataset.wsq; LS.set('wsq',S.wsq); syncWtab(); renderWords(); return; }
  const wv=e.target.closest('[data-wv]'); if(wv){ S.wview=wv.dataset.wv; LS.set('wview',S.wview); syncWtab(); renderWords(); return; }
  const un=e.target.closest('#toast [data-undo]'); if(un){ const t=S.undo; S.undo=null; hideToast(); if(t) t(); return; }
  const rm=e.target.closest('[data-nrm]'); if(rm){ const n=rm.dataset.nrm, show=(S.nameList.find(x=>x.n===n)||{}).show||n; removeName(n); toast(show+' is a normal word again',()=>addName(show)); return; }
  const la=e.target.closest('[data-ladd]'); if(la){ const w=la.dataset.ladd; closeKanji(); setLoan(w,true); toast(w+' moved to Words → Loanwords',()=>setLoan(w,false)); return; }
  const lr=e.target.closest('[data-lrm]'); if(lr){ const w=lr.dataset.lrm; closeKanji(); setLoan(w,false); toast(w+' counts as a normal word again',()=>setLoan(w,true)); return; }
  const ad=e.target.closest('[data-nadd]'); if(ad){ const w=ad.dataset.nadd; addName(w); toast(w+' marked as a name, moved to Words → Names',()=>removeName(normWord(w))); return; }
  if(e.target.id==='nbtn'){ const i=$('#nadd'); if(i && i.value.trim()){ addName(i.value); } }
});
document.addEventListener('keydown',e=>{ if(e.key==='Enter' && e.target.id==='nadd'){ addName(e.target.value); } });
S.wtab=LS.get('wtab','words');
let toastT=null;
function toast(msg,undo){ const t=$('#toast'); S.undo=undo||null; t.innerHTML='<span>'+esc(msg)+'</span>'+(undo?'<button data-undo>Undo</button>':''); t.hidden=false; clearTimeout(toastT); toastT=setTimeout(hideToast,7000); }
function hideToast(){ const t=$('#toast'); if(t) t.hidden=true; S.undo=null; }
S.wview=LS.get('wview','cards');
S.wsq=(v=>[500,3,2,1000].includes(v)?v:({400:500,200:3,250:3,800:1000})[v]||500)(LS.get('wsq',500)); S.wview='grid';
S.kcols=LS.get('kcols',1);
S.fullw=LS.get('fullw',true);
function syncFullw(){ document.querySelectorAll('[data-fullw]').forEach(b=>b.setAttribute('aria-pressed',(b.dataset.fullw==='1')===!!S.fullw)); const w=$('#wfwSeg'); if(w) w.hidden=S.wtab==='names'||S.wview!=='grid'; }
function syncWtab(){ document.querySelectorAll('[data-wt]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.wt===S.wtab)); document.querySelectorAll('[data-wv]').forEach(b=>{ b.setAttribute('aria-pressed',b.dataset.wv===S.wview); b.parentNode.hidden=S.wtab==='names'; }); const so=$('#wsort'); if(so) so.hidden=true; syncFullw(); const q=$('#wsqSeg'); if(q){ q.hidden=S.wtab==='names'; q.querySelectorAll('[data-wsq]').forEach(b=>b.setAttribute('aria-pressed',+b.dataset.wsq===S.wsq)); } }


function parseBullet(b){
  const i = b.indexOf(' - '); if(i<0) return null;
  const head = b.slice(0,i).trim(), meaning = b.slice(i+3).trim();
  const m = head.match(/\(([^)]*)\)/);
  const word = head.replace(/\s*\([^)]*\)/g,'').replace(/\s+/g,' ').trim();
  if(!/[぀-ヿ一-鿿]/.test(word) || word.length>24 || /^note$/i.test(word)) return null;
  let reading = m?m[1]:'';
  if(!reading) reading = ({'は':'wa','を':'o','へ':'e'})[word] || '';   // particles read differently from how they are written
  const w2=stripNames(word); if(w2===null) return null;
  if(w2!==word) return { word:w2, reading:'', meaning };
  return { word, reading, meaning };
}
let dTimer=null;
function scheduleWords(){ clearTimeout(dTimer); dTimer=setTimeout(derive,250); }
async function derive(){
  try{ await ensureCorpus(); }catch(e){ return; }
  S.awm=null; buildKanjiIndex(); computeKanjiStats(); computeWordStats(); computeWords(); computeNames(); buildCatalog(); updateBars();
  if(S.view==='words') renderWords(true); else if(S.view==='kanji') renderKanji(true); else if(S.view==='ep'){ paintAll(); paintNew(); } else if(S.view==='options') updateRuleCounts(); else if(S.view==='stats') renderStats(); else if(S.view==='listen') renderListen();
}
/* order of the word library: episodes in study order, inside each the order words first appear in that episode */
function wKey(e){ const r=S._wc.rank.get(e.src.gid), sq=S.wseq&&S.wseq.get(e.src.gid), q=sq&&sq.get(e.word); return (r==null?999:r)*1e6+(q==null?(e.src.n||0):q); }
function prepWord(e){
  const {order,rank,occ,forms}=S._wc;
    e.inst=[]; const st=S.wst0 && S.wst0.get(e.word), on=occ.get(e.word)||new Set();
    order.forEach(g=>{ const d=S.data.get(g.id); if(!d) return; d.lines.forEach(L=>{
      const f=findWord(L,null,st||{s:stemOf(e.word).s,forms:[]});
      if(f) e.inst.push({gid:g.id,n:L.n,idx:f.idx,len:f.len}); else if(on.has(g.id+':'+L.n)) e.inst.push({gid:g.id,n:L.n,idx:-1,len:0}); }); });
    e.first = e.inst[0] || {gid:e.src.gid,n:e.src.n,idx:-1,len:0};
    e.rank = wKey(e);
    const pf=S.wforms && S.wforms[e.word];
    e.forms = pf ? pf.map(([f,c,gid,n,ex])=>{ const L=lineOf(gid,n); return {f,c,ex,html:L?formRuby(L,f):esc(f)}; })
                 : [...(forms.get(e.word)||new Map()).values()].sort((a,b)=>b.c-a.c);
}
function computeWords(){
  const order=groupOrder(), rank=new Map(order.map((g,i)=>[g.id,i])), map=new Map(), pend=new Map();
  S.wseq=new Map();
  order.forEach(g=>{
    const set=getLearned(g.id), d=S.data.get(g.id); if(!d) return;
    /* where each word first shows up inside this episode: its place in the episode's block of the word grid */
    const sq=new Map(); S.wseq.set(g.id,sq); d.lines.forEach(L=>L.b.forEach(b=>wordsOf(b).forEach(x=>{ if(!sq.has(x.word)) sq.set(x.word,sq.size); })));
    d.lines.forEach(L=>{ if(set.has(L.n)) return; L.b.forEach(b=>wordsOf(b).forEach(x=>{ if(!pend.has(x.word)) pend.set(x.word,{word:x.word,reading:x.reading,gloss:x.gloss,means:[],ts:Infinity,src:{gid:g.id,n:L.n}}); })); });
    if(!set.size) return;
    d.lines.forEach(L=>{ if(!set.has(L.n)) return; const ts=getAt(g.id,L.n); L.b.forEach(b=>wordsOf(b).forEach(x=>{
      let e=map.get(x.word); if(!e){ e={word:x.word,reading:x.reading,gloss:x.gloss,means:[],ts,src:{gid:g.id,n:L.n}}; map.set(x.word,e); } else e.ts=Math.min(e.ts,ts);
      if(!e.reading && x.reading) e.reading=x.reading;
      if(x.one && x.ctx && x.ctx!==e.gloss && e.means.length<2 && !e.means.includes(x.ctx)) e.means.push(x.ctx);
    })); });
  });
  const all=[...map.values()], occ=wordOcc(), forms=wordForms();
  S._wc={order,rank,occ,forms}; map.forEach((v,k)=>pend.delete(k)); S.wpend=pend;
  const words=all.filter(e=>!isLoan(e.word)), loans=all.filter(e=>isLoan(e.word));
  words.forEach((e,i)=>{ e.i=i; prepWord(e); });
  loans.forEach((e,i)=>{ e.i=i; e.isLoan=true; prepWord(e); }); loans.sort((a,b)=>a.rank-b.rank).forEach((e,i)=>{ e.i=i; }); S.loans=loans;
  words.slice().sort((a,b)=>a.rank-b.rank||a.i-b.i).forEach((e,k)=>{ e.no=k+1; });
  S.words=words; $('#nWords').textContent=words.length||'';
  /* new words per episode: a word belongs to the first group (Excel notes first, then episodes in order) where a learned line has it */
  S.newBy=new Map(); words.forEach(e=>S.newBy.set(e.src.gid,(S.newBy.get(e.src.gid)||0)+1));
  /* words not learned yet go to the first group whose (unlearned) lines have them */
  S.potBy=new Map(); pend.forEach(e=>!isLoan(e.word) && S.potBy.set(e.src.gid,(S.potBy.get(e.src.gid)||0)+1));
  if(S.view==='ep'){ fillEpSelect(); updateProgress(); }
}
const newW=id=>(S.newBy&&S.newBy.get(id))||0;
const potW=id=>(S.potBy&&S.potBy.get(id))||0;
const nwTxt=id=>{ const a=newW(id), t=a+potW(id); return t?a+'/'+t+' new words':''; };
/* the forms a word takes in the lines: the piece of each note headword that holds the word, with the line's furigana */
function wordForms(){
  const m=new Map();
  groupOrder().forEach(g=>{ const d=S.data.get(g.id); if(!d) return; d.lines.forEach(L=>L.b.forEach(b=>{
    const xs=wordsOf(b); if(!xs.length) return;
    const head=b.slice(0,b.indexOf(' - ')).replace(/\s*\([^)]*\)/g,''), pieces=head.split(/[+＋\s]+/).map(normWord).filter(Boolean);
    xs.forEach(x=>{
      const keys=[x.surf,stemOf(x.word).s,x.word].filter(Boolean).map(normWord);
      let f=pieces.find(p=>keys.some(k=>k && p.includes(k)));
      if(!f && xs.length===1 && pieces.length===1) f=pieces[0];
      if(!f || /[a-zA-Z]/.test(f)) return;
      let mm=m.get(x.word); if(!mm){ mm=new Map(); m.set(x.word,mm); }
      const o=mm.get(f); if(o){ o.c++; return; }
      mm.set(f,{f,c:1,html:formRuby(L,f)});
    }); })); });
  return m;
}
function formRuby(L,f){
  const i=L._n?L._n.indexOf(f):-1; if(i<0) return esc(f);
  const a=L._m[i], z=L._m[i+f.length-1], toks=L.tk.slice(a,z+1).filter(h=>!/^\s+$/.test(surf(h)));
  return toks.map(surf).join('')===f ? toks.join('') : esc(f);
}
/* every line whose notes contain a word, learned or not */
function wordOcc(){
  const m=new Map();
  groupOrder().forEach(g=>{ const d=S.data.get(g.id); if(!d) return; d.lines.forEach(L=>L.b.forEach(b=>wordsOf(b).forEach(x=>{
    let s=m.get(x.word); if(!s){ s=new Set(); m.set(x.word,s); } s.add(g.id+':'+L.n); }))); });
  return m;
}
function snippet(x,word,o){
  o=o||{}; const L=lineOf(x.gid,x.n), g=meta(x.gid); if(!L) return '';
  const hit=o.hit||hitsFor(L,x.idx,x.len), on=isLearnedLine(x.gid,x.n), lab=esc(g.short+' · '+(L.id||L.n)+(L.ts?' · '+L.ts.replace(/\.\d+$/,''):''));
  return '<div class="sn"><div class="cap">'+(o.nolink?'<span class="refx">'+lab+'</span>':'<button class="ref" data-gid="'+x.gid+'" data-n="'+x.n+'" data-w="'+escA(word)+'">'+lab+'</button>')+
    '<span class="lm '+(on?'on':'off')+'" role="img" aria-label="'+(on?'learned':'not learned')+'" title="'+(on?'learned':'not learned')+'"></span></div>'+
    '<div class="jp sm" lang="ja">'+jpHTML(L,hit)+'</div>'+
    (L.t?'<div class="exr">'+esc(L.t)+'</div>':'')+'</div>';
}
/* furigana for a dictionary word: kana parts of the word line up with the reading, kanji runs get what is left */
const KJR=/[一-鿿々〆ヶ]/;
const toHira=s=>s.replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60));
function furi(w,r){
  if(!r || !KJR.test(w)) return esc(w);
  const parts=w.match(/[一-鿿々〆ヶ]+|[^一-鿿々〆ヶ]+/g);
  let m=null;
  try{ m=toHira(r).match(new RegExp('^'+parts.map(p=>KJR.test(p)?'(.+?)':'('+toHira(p).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')').join('')+'$')); }catch(e){ m=null; }
  if(!m) return '<ruby>'+esc(w)+'<rt>'+esc(r)+'</rt></ruby>';
  return parts.map((p,i)=>KJR.test(p)?'<ruby>'+esc(p)+'<rt>'+esc(m[i+1])+'</rt></ruby>':esc(p)).join('');
}
const ICO_NAME='<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="5.2" r="2.7"/><path d="M2.8 14c.4-3 2.6-4.6 5.2-4.6s4.8 1.6 5.2 4.6"/></svg>';
const ICO_UNNAME='<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="5.2" r="2.7"/><path d="M2.8 14c.4-3 2.6-4.6 5.2-4.6s4.8 1.6 5.2 4.6"/><path d="M2 2l12 12"/></svg>';
const ICO_LOAN='<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1.8 12l2.6-8 2.6 8M2.7 9.4h3.4"/><path d="M9.5 6.2h4.6M11.8 4.2v1.6c0 3.1-1.3 5.2-3 6.2M11.2 8.6c.6 1.5 1.6 2.6 3 3.2"/></svg>';
function loanBtn(e){ if(e.isName || !S.lem) return '';
  return e.isLoan ? '<button class="nico on" data-lrm="'+escA(e.word)+'" title="Not a loanword: count it as a normal word" aria-label="Not a loanword">'+ICO_LOAN+'</button>'
    : (/^[\u30a0-\u30ffー・]+$/.test(e.word) ? '<button class="nico" data-ladd="'+escA(e.word)+'" title="Mark as loanword (katakana spelling of a foreign word)" aria-label="Mark as loanword">'+ICO_LOAN+'</button>' : ''); }
function nameBtn(e){
  if(e.isName) return '<button class="nico" data-nrm="'+escA(e.key)+'" title="Not a name" aria-label="Not a name">'+ICO_UNNAME+'</button>';
  return /^[^+\s]{1,12}$/.test(e.word)?'<button class="nico" data-nadd="'+escA(e.word)+'" title="Mark as name" aria-label="Mark as name">'+ICO_NAME+'</button>':'';
}
/* the kanji a word is written with: number in your deck and keyword; tap one to open it */
/* compounds count the words they are built from (lemmas.json parts) */
const partsOf=w=>((S.lem&&S.lem.parts&&S.lem.parts[w])||[]).map(p=>Array.isArray(p)?p[0]:p);
function partsStrip(w){ const ps=partsOf(w); if(!ps.length) return '';
  return '<div class="wparts"><span class="wpl">Made of</span>'+ps.map(p=>{ const d=(S.lem.words&&S.lem.words[p])||['',''];
    return '<button class="wchip" data-w="'+escA(p)+'"><b lang="ja">'+esc(p)+'</b>'+(d[0]&&d[0]!==p?'<span class="kn" lang="ja">'+esc(d[0])+'</span>':'')+'<span class="kw">'+esc((d[1]||'').split(/[;/]/)[0])+'</span></button>'; }).join('')+
    '<span class="wph">learning this word counts these too</span></div>'; }
function kanjiStrip(w){
  const ks=[...new Set([...(w||'')].filter(ch=>KJ.test(ch)))]; if(!ks.length) return '';
  return '<div class="kstrip">'+ks.map(ch=>{ const d=kInfo(ch);
    return '<button class="kchip" data-k="'+escA(ch)+'"><b lang="ja">'+esc(ch)+'</b><span class="kn">'+(d.frame?'#'+d.frame:'—')+'</span><span class="kw">'+esc(d.kw||'')+'</span></button>'; }).join('')+'</div>';
}
function wordHead(e,big){
  return '<div class="wh">'+(e.no?'<span class="wno">#'+e.no+'</span>':'')+'<span class="ww'+(big?' big':'')+'" lang="ja" role="button" tabindex="0" data-say="'+escA(speakWord(e))+'" title="Play">'+furi(e.word,e.reading)+'</span></div>';
}
function wordMeans(e,short){
  if(e.isName) return '<div class="wm">'+e.means.map(m=>'<div>'+esc(m)+'</div>').join('')+'</div>';
  const g=e.gloss||'', ms=short?e.means.slice(0,1):e.means, main=lxEn(e);
  return '<div class="wm">'+'<div class="wmain">'+esc(main)+'</div>'+(!short && g && g!==main?'<div class="wdict">'+esc(g)+'</div>':'')+ms.map(m=>'<div class="wctx">'+esc(m)+'</div>').join('')+'</div>';
}
const formLi=f=>'<li><span class="wf" lang="ja">'+f.html+'</span>'+(f.c>1?'<i>×'+f.c+'</i>':'')+(f.ex?' <span class="wfe">– '+esc(f.ex)+'</span>':'')+'</li>';
function formsHTML(e,all){
  const fs=e.forms||[]; if(!fs.length) return '';
  return '<ul class="wfs">'+(all?fs:fs.slice(0,10)).map(formLi).join('')+'</ul>';
}
/* details panels: the 3 most seen forms, the rest behind a toggle */
function formsBox(e){
  const fs=(e.forms||[]).slice().sort((a,b)=>b.c-a.c); if(!fs.length) return '';
  return '<div class="cap2">Seen as</div><ul class="wfs">'+fs.slice(0,3).map(formLi).join('')+'</ul>'+
    (fs.length>3?'<details class="wfmore"><summary>All '+fs.length+' forms</summary><ul class="wfs">'+fs.slice(3).map(formLi).join('')+'</ul></details>':'');
}
/* examples: one random line, then the episodes with how often the word is in each; an episode opens to its lines */
function examplesBox(e,nolink){
  const list=e.inst.length?e.inst:[e.first];
  let lrn=0, unl=0; list.forEach(x=>{ if(isLearnedLine(x.gid,x.n)) lrn++; else if(!S.excl.has(x.gid)) unl++; }); const tot=lrn+unl;
  const lr=list.filter(x=>isLearnedLine(x.gid,x.n)), good=lr.filter(x=>x.idx>=0), pool=good.length?good:lr, q=pool.length?pool[Math.floor(Math.random()*pool.length)]:null;
  const by=new Map(); list.forEach(x=>{ if(!by.has(x.gid)) by.set(x.gid,[]); by.get(x.gid).push(x); });
  return '<div class="cap2">'+tot+' line'+(tot===1?'':'s')+' · '+lrn+' learned / '+unl+' unlearned</div>'+
    (q?'<div class="cap3">Quick example</div><div class="ilist wlist">'+snippet(q,e.word,{nolink})+'</div>':'')+
    '<div class="cap3">By episode</div><div class="weps">'+[...by].map(([gid,xs])=>{ const g=meta(gid)||{short:gid}, l=xs.filter(x=>isLearnedLine(x.gid,x.n)).length;
      return '<details class="wep" data-gid="'+escA(gid)+'" data-w="'+escA(e.word)+'"'+(nolink?' data-nl="1"':'')+'><summary><span class="wen">'+esc(g.short)+(g.title&&g.title!==g.short?' <small>'+esc(g.title)+'</small>':'')+'</span><span class="wec">×'+xs.length+(l?' · '+l+' learned':'')+'</span></summary><div class="ilist wlist"></div></details>'; }).join('')+'</div>';
}
function wordEntry(w){ return (S.words||[]).find(e=>e.word===w) || (S.loans||[]).find(e=>e.word===w) || (S.wpend&&S.wpend.get(w)) || (S.names||[]).find(e=>e.word===w); }
function fillEp(d){
  if(d.dataset.f) return; const e=wordEntry(d.dataset.w); if(!e) return; d.dataset.f='1';
  const xs=(e.inst.length?e.inst:[e.first]).filter(x=>x.gid===d.dataset.gid);
  d.querySelector('.wlist').innerHTML=xs.map(x=>snippet(x,e.word,{nolink:!!d.dataset.nl})).join('');
}
/* JP / EN review stats for a word or kanji: JP = the card shows the Japanese, EN = it shows the English */
function statChips(base,jpLab,enLab){
  const chip=(d,tag,lab)=>{ const x=cardStat(base+'|'+d); if(!x) return '<span class="wst"></span>';
    return '<span class="wst'+(x.isDue?' isdue':'')+'" title="'+escA(lab+': rep count '+fmtCnt(x.c)+' · '+fmtDur(x.ago)+' since the last success / interval '+fmtDur(x.iv)+' · '+dueTxt(x))+'"><span class="wsl"><i>'+tag+'</i><b>'+fmtCnt(x.c)+'</b>'+agoIv(x)+'</span>'+tbar(x)+'</span>'; };
  return chip('f','JP',jpLab)+chip('b','EN',enLab);
}
function wordStats(e){
  if(e.isName) return '';
  if(S.permw.has(e.word)) return '<span class="wst wperm" title="Permanently learned: never reviewed">∞ permanent</span>';
  const st=wbSt(e.word), k=wbBlockOf(e.word); if(!k) return '';
  return blkStatHTML(k,e.word,st);
}
/* block status of a word or kanji: due / next review, count, easy and hard marks */
function blkStatHTML(k,w,st){
  const td=today(), ez=easyOf(w); let t=(k.kind==='K'?'Kanji block ':'Block ')+(k.b+1);
  if(k.fresh) t+=' · new, not reviewed yet';
  else if(k.act){ t+=k.isDue?(k.nn?' · new words, review today':' · due'):' · next review in '+(k.due-td)+'d'; if(k.cnt) t+=' · reviewed '+k.cnt+'×'; } else t+=' · not started';
  if(ez){ const r=k.rn; let n=0; while(!easyRound(r+n)) n++; t+=n?' · easy: sits out '+(n===1?'the next round':'the next '+n+' rounds'):' · easy: in the next round'; }
  return '<span class="wst wbst">'+esc(t)+'</span>'+(ez?'<span class="wst weasy">easy</span>':'')+(st.hj?'<span class="wst whj">hard JP</span>':'')+(st.he?'<span class="wst whe">hard EN</span>':''); }
const ARROW='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M15.5 8.5L19 12l-3.5 3.5"/></svg>';
function wordRow(e){
  const xs=e.isName?[]:['f','b'].map(d=>cardStat('W|'+e.word+'|'+d)), dueW=xs.some(x=>x&&x.isDue);
  return '<div class="wcard'+(e.isName?' nm':'')+(dueW?' wdue':'')+(S.permw.has(e.word)?' wcperm':S.easyw.has(e.word)?' wceasy':'')+'" data-wi="'+e.i+'" data-ws="'+(e.isName?'n':e.isLoan?'l':'w')+'" tabindex="0"><div class="wbody">'+
    wordHead(e)+wordMeans(e,true)+formsHTML(e)+'<span class="wmore" aria-label="More">'+ARROW+'</span></div>'+
    (e.isName?'':'<div class="wft"><span class="wsts">'+wordStats(e)+'</span></div>')+'</div>';
}
/* full card in the bottom sheet: every form, every line */
/* which word of the notes a token of the line belongs to */
function tokWord(L,i){
  if(!L._tw || L._twv!==S.nver+'|'+(S.lem?1:0)){ L._tw=new Map(); L._twv=S.nver+'|'+(S.lem?1:0);
    L.b.forEach(b=>wordsOf(b).forEach(x=>{ const f=findWord(L,x,S.wst0&&S.wst0.get(x.word)); if(!f||f.idx<0) return;
      for(let k=f.idx;k<f.idx+f.len;k++){ const t=L._m[k]; if(!L._tw.has(t)) L._tw.set(t,x.word); } })); }
  return L._tw.get(i);
}
function openWord(w){
  let i=(S.words||[]).findIndex(e=>e.word===w); if(i>=0){ showWord('w',i); return; }
  i=(S.loans||[]).findIndex(e=>e.word===w); if(i>=0){ showWord('l',i); return; }
  const e=S.wpend&&S.wpend.get(w); if(!e) return; if(!e.inst) prepWord(e); showWordE(e);
}
function showWord(ws,i){
  const e=(ws==='n'?S.names:ws==='l'?S.loans:S.words)[i]; if(!e) return; showWordE(e);
}
function showWordE(e){
  const list=e.inst.length?e.inst:[e.first]; S.wcur={e,list};
  const sh=$('#kd'); sh.setAttribute('aria-label','Word details'); sh.classList.remove('kfix'); S.kcur=null;
  const nl=wordNavList(e), ni=nl?nl.indexOf(e):-1;
  const nav=nl&&ni>=0?'<span class="wnav"><button class="wnv" data-wnav="-1" aria-label="Previous word" title="Previous word (←)"'+(ni>0?'':' disabled')+'>‹</button><span class="wnp">'+(ni+1)+' / '+nl.length+'</span><button class="wnv" data-wnav="1" aria-label="Next word" title="Next word (→)"'+(ni<nl.length-1?'':' disabled')+'>›</button></span>':'';
  sh.innerHTML='<div class="sin"><div class="wtop"><button class="sx sxi" aria-label="Close" title="Close">×</button><span class="wsts big">'+wordStats(e)+latSpan(e.ts)+'</span><span class="wshb">'+loanBtn(e)+nameBtn(e)+(e.isName?'':easyBtn(e.word))+permBtn(e)+(e.isName?'':wbHardBtns(e))+'</span>'+nav+'</div><div class="kh wsh">'+wordHead(e,true)+'</div>'+
    kanjiStrip(e.word)+partsStrip(e.word)+wordMeans(e)+firstLineBox(e)+formsBox(e)+examplesBox(e,false)+'</div>';
  sh.hidden=false; sh.scrollTop=0; S.kdAt=Date.now(); hlCur(e);
}
/* previous / next in the library: words by number, loanwords and names in their own order */
function wordNavList(e){
  if(e.isName) return (S.names||[]).slice().sort((a,b)=>a.rank-b.rank||a.i-b.i);
  if(e.isLoan) return (S.loans||[]).slice().sort((a,b)=>a.i-b.i);
  if((S.words||[]).includes(e)) return S.words.slice().sort((a,b)=>a.no-b.no);
  return null;
}
function wordStep(d){ const e=S.wcur&&S.wcur.e, nl=e&&wordNavList(e); if(!nl) return; const n=nl[nl.indexOf(e)+d]; if(n){ showWordE(n); const el=hlCur(n); if(el) el.scrollIntoView({block:'nearest'}); } }
/* the line where the word first appeared (learned lines first), with the word marked and its meaning in that line from the notes */
function firstLineBox(e){
  if(e.isName) return '';
  const list=e.inst.length?e.inst:[e.first], lr=list.filter(x=>isLearnedLine(x.gid,x.n)), cand=lr.length?lr:list; if(!cand.length) return '';
  const nw=normWord(e.word), headOf=b=>{ const i=b.indexOf(' - '); return i>=0?b.slice(0,i):''; }, ctxOf=b=>{ const i=b.indexOf(' - '); return i>=0?b.slice(i+3):b; };
  /* the first line that explains the word itself; failing that, the first line where it is part of a bigger word */
  const find=test=>{ for(const x of cand){ const L=lineOf(x.gid,x.n); if(!L) continue; for(const b of L.b) if(test(b)) return {x,b}; } return null; };
  let pick=find(b=>wordsOf(b).some(y=>y.word===e.word && !y.part)), how='own';
  if(!pick){ pick=find(b=>wordsOf(b).some(y=>y.word===e.word)) || find(b=>normWord(headOf(b).replace(/\s*\([^)]*\)/g,'')).includes(nw)); how='part'; }
  const x=pick?pick.x:cand[0], b=pick&&pick.b, head=b?headOf(b):'', ctx=b?ctxOf(b):'';
  return '<div class="cap2">'+(how==='own'?'First seen in':'Studied only inside a bigger word')+'</div><div class="wfirst">'+snippet(x,e.word)+
    (ctx?'<div class="wfctx">'+(how==='part'?'<span class="wfl">'+esc(e.word)+' is part of</span>':'')+(head?'<b lang="ja">'+esc(head)+'</b> – ':'')+esc(ctx)+'</div>':'')+'</div>';
}
function fillWordLines(n){
  const c=S.wcur, box=$('#kd .wlist'); if(!c||!box) return;
  box.innerHTML=c.list.slice(0,n).map(x=>snippet(x,c.e.word)).join('')+(c.list.length>n?'<button class="more wmoreb" data-n="'+n+'">Show more ('+(c.list.length-n)+' left)</button>':'');
}
/* review rows for the details panels (word sheet, kanji sheet) */
function reviewRows(list){
  const rows=list.map(([k,lab])=>{ const x=cardStat(k); if(!x) return '';
    return '<div class="rrow'+(x.isDue?' isdue':'')+'"><span>'+esc(lab)+'</span><b>'+fmtCnt(x.c)+'</b><span title="since the last success / interval">'+agoIv(x)+'</span><span>'+(x.n?x.n+' review'+(x.n===1?'':'s'):'no reviews yet')+'</span><span class="dt">'+esc(dueTxt(x))+'</span></div>'; }).join('');
  return rows?'<div class="cap2">Review</div><div class="rvrs">'+rows+'</div>':'';
}
function markOverflow(){ requestAnimationFrame(()=>view.querySelectorAll('.wcard .wbody').forEach(c=>c.closest('.wcard').classList.toggle('ovf',c.scrollHeight>c.clientHeight+2))); }
function fillInst(d,n){
  const w=(d.dataset.ws==='n'?S.names:d.dataset.ws==='l'?S.loans:S.words)[+d.dataset.wi]; if(!w) return;
  const list=w.inst.length?w.inst:[w.first];
  d.querySelector('.ilist').innerHTML = '<div class="cap2">First appearance</div>'+snippet(list[0],w.word)+
    (list.length>1?'<div class="cap2">Other lines</div>'+list.slice(1,n).map(x=>snippet(x,w.word)).join(''):'')+
    (list.length>n?'<button class="more imore" data-n="'+n+'">Show more ('+(list.length-n)+' left)</button>':'');
}
function renderWords(keep){
  syncWtab(); if(S.wtab==='names'){ renderNames(); return; }
  S.wview='grid'; const q=$('#wq').value.trim().toLowerCase(), so='first', LOAN=S.wtab==='loans', src=LOAN?(S.loans||[]):S.words;
  if(!keep) S.wShown=150;
  if(LOAN && !src.length){ view.dataset.gid=''; view.innerHTML='<div class="empty">No loanwords yet. Katakana spellings of foreign words (キス, ボール, パワー…) from your learned lines show up here. They are not counted as words.</div>'; return; }
  if(!S.words.length){ view.innerHTML='<div class="empty">No words yet. Tick the box next to a line in the Lines tab and every word from its grammar breakdown is added here.</div>'; return; }
  const match=w=>!q || (w.word+' '+w.reading+' '+(wShort(w)||'')+' '+(w.gloss||'')+' '+w.means.join(' ')+' #'+w.no).toLowerCase().includes(q);
  if(S.wview==='grid'){ renderWordGrid(src.slice().sort(so==='kana'?(a,b)=>(a.reading||a.word).localeCompare(b.reading||b.word,'ja'):so==='seen'?(a,b)=>b.inst.length-a.inst.length||a.rank-b.rank:(a,b)=>a.rank-b.rank||a.i-b.i),match,LOAN,so==='first'); return; }
  let ws=src.filter(w=>!q || (w.word+' '+w.reading+' '+(wShort(w)||'')+' '+(w.gloss||'')+' '+w.means.join(' ')+' #'+w.no).toLowerCase().includes(q));
  if(!ws.length){ view.innerHTML='<div class="empty">No words match “'+esc(q)+'”.</div>'; return; }
  if(so==='kana') ws=ws.slice().sort((a,b)=>(a.reading||a.word).localeCompare(b.reading||b.word,'ja'));
  else if(so==='seen') ws=ws.slice().sort((a,b)=>b.inst.length-a.inst.length||a.rank-b.rank);
  else ws=ws.slice().sort((a,b)=>a.rank-b.rank||a.i-b.i);
  const nl=S.index.groups.reduce((a,g)=>a+getLearned(g.id).size,0);
  view.dataset.gid='';
  view.innerHTML='<div class="kf" style="padding:6px 0">'+ws.length+(LOAN?' loanwords · not counted as words':' words from '+nl+' learned lines')+'</div>'+'<div class="wgrid">'+ws.slice(0,S.wShown).map(wordRow).join('')+'</div>'+
    (ws.length>S.wShown?'<button class="more" id="wmore">Show more</button>':'');
  markOverflow();
}

/* the grid's cells: in study order, words of your episodes you haven't learned yet are shown as previews inside their episode */
function wordItems(ws,loan,byEp){ const rank=S._wc.rank; let items=ws.map(e=>({e,k:e.rank}));
  if(byEp && !loan && S.wpend){ [...S.wpend.values()].forEach(e=>{ if(isLoan(e.word) || S.excl.has(e.src.gid) || !rank.has(e.src.gid)) return; items.push({e,g:true,k:wKey(e)}); });
    items.sort((a,b)=>a.k-b.k); }
  return items; }
/* words as a map: cards 5:1, 20 per block (2 columns × 10 rows, filled top to bottom, then left to right), 25 blocks per 500-word square */
function renderWordGrid(ws,match,loan,byEp){
  view.dataset.gid='';
  /* squares of 25 blocks; a block is 20 words in 2 columns × 10 rows with a status bar on top; 5, 3 or 2 blocks to a row, or two 5-block squares side by side */
  const two=S.wsq===1000, bpr=S.wsq===3?3:S.wsq===2?2:5, BS=20, SQ=500;
  const rank=S._wc.rank, items=wordItems(ws,loan,byEp), WB=!loan && byEp, bl=WB?wbBlocks():[], sel=new Set(S.lxsel||[]);
  const nPrev=items.filter(x=>x.g && !wbKnown(x.e.word)).length;
  const cell=(it,pos,lab)=>{ const e=it.e, ep=byEp?rank.get(e.src.gid):-1, n=[...e.word].reduce((a,ch)=>a+(/[\x00-\xff]/.test(ch)?0.6:1),0), st=WB?wbSt(e.word):{}, pv=it.g && !st.k;
    const at=' data-e="'+(ep==null?-1:ep)+'"'+pos+(lab?' data-lab="'+escA(lab)+'"':'')+' title="'+escA((pv?'Not learned yet · ':'')+(st.hj?'Hard · ':'')+(st.he?'Hard reading the English · ':'')+(e.reading?e.reading+' · ':'')+(e.gloss||(e.means&&e.means[0])||''))+'"';
    const sp='<span lang="ja" style="--n:'+n.toFixed(1)+'">'+esc(e.word)+'</span>';
    const cls='wgc'+(S.permw.has(e.word)?' wgperm':S.easyw.has(e.word)?' wgeasy':pv?' wgh':'')+(st.hj?' wghj':'')+(st.he?' wghe':'')+(match(e)?'':' dim');
    return it.g ? '<button class="'+cls+'" data-pw="'+escA(e.word)+'"'+at+'>'+sp+'</button>' : '<button class="'+cls+'" data-ws="'+(loan?'l':'w')+'" data-wi="'+e.i+'"'+at+'>'+sp+'</button>'; };
  let h='<div class="kf" style="padding:6px 0">'+ws.length+(loan?' loanwords':' words')+(nPrev?' · '+nPrev+' not learned yet from your episodes (purple)':'')+' · tap a word to open it'+(WB?', a block’s bar to pick the block':'')+'</div><div class="bigs'+(two?' two':'')+(S.fullw?' bleed':'')+'">';
  for(let b=0;b<items.length;b+=SQ){
    const ch=items.slice(b,b+SQ), nl=ch.filter(x=>!x.g || (WB && wbKnown(x.e.word))).length;
    h+='<section class="big"><div class="bigcap">Square '+(b/SQ+1)+' · '+nl+' learned'+(ch.length>nl?' · '+(ch.length-nl)+' to come':'')+'</div><div class="bw"><div class="wbig" style="--bpr:'+bpr+'">';
    /* always a full square of 25 blocks: places for words still to come are drawn empty */
    let prev=null;
    for(let k=0;k<SQ;k+=BS){ const bi=k/BS, B=b/BS+bi, br=Math.floor(bi/bpr), bc=bi%bpr; let inner='';
      for(let j=0;j<BS;j++){ const it=ch[k+j], pos=' data-gc="'+(bc*2+Math.floor(j/10))+'" data-gr="'+(br*10+(j%10))+'"';
        if(!it){ inner+='<i class="wge" data-e="-1"'+pos+'></i>'; continue; }
        const gid=it.e.src.gid, lab=byEp && gid!==prev ? ((meta(gid)||{}).short||gid) : ''; prev=gid; inner+=cell(it,pos,lab); }
      const kb=WB&&bl[B];
      h+='<div class="wblk'+(ch.length>k?'':' wbe')+(kb?wbCls(kb)+(sel.has(B)?' sel':''):'')+'" data-blk="'+B+'">'+(kb?wbStrip(kb,sel.has(B)):'<div class="wbs z">'+(ch.length>k?'<b>'+(B+1)+'</b>':'&nbsp;')+'</div>')+'<div class="wbc">'+inner+'</div></div>'; }
    h+=(byEp?'<svg class="wseam" aria-hidden="true"></svg>':'')+'</div></div></section>';
  }
  h+='</div>';
  view.innerHTML=(WB?wbMiniHTML(items,bl,sel)+'<div id="lxPanel" class="lx"></div>':'')+h;
  if(WB) renderLxPanel();
  const hd=$('header'); if(hd) document.documentElement.style.setProperty('--hdr',Math.round(hd.getBoundingClientRect().height)+'px');
  fitWG(); requestAnimationFrame(wgSeams); if(document.fonts && document.fonts.ready) document.fonts.ready.then(()=>{ fitWG(); wgSeams(); });
}
/* one thin line around each episode's words, drawn through the gaps between cards; the grid's own left and right edges only get a line where an episode starts or ends */
function wgSeams(){
  view.querySelectorAll('.wbig').forEach(big=>{
    const svg=big.querySelector('.wseam'); if(!svg) return;
    big.querySelectorAll('.eplab').forEach(x=>x.remove());
    const B=big.getBoundingClientRect(), G=new Map(), L=[], R=[], T=[], Bo=[]; let nc=0,nr=0;
    big.querySelectorAll('[data-gc]').forEach(el=>{ const gc=+el.dataset.gc, gr=+el.dataset.gr, r=el.getBoundingClientRect();
      G.set(gr*100+gc,+el.dataset.e); nc=Math.max(nc,gc+1); nr=Math.max(nr,gr+1);
      L[gc]=r.left-B.left; R[gc]=r.right-B.left; T[gr]=r.top-B.top; Bo[gr]=r.bottom-B.top; });
    if(!nc) return;
    const X=[], Y=[];
    for(let c=0;c<=nc;c++) X[c]= c===0?L[0]-1.5 : c===nc?R[nc-1]+1.5 : (R[c-1]+L[c])/2;
    /* between rows of blocks the line runs above the next block's status bar */
    const sH=((big.querySelector('.wbs')||{}).offsetHeight||0)+3;
    for(let r=0;r<=nr;r++) Y[r]= r===0?T[0]-sH-1.5 : r===nr?Bo[nr-1]+1.5 : r%10===0?(Bo[r-1]+T[r]-sH)/2 : (Bo[r-1]+T[r])/2;
    const ep=(r,c)=>{ const v=G.get(r*100+c); return v==null||c<0||c>=nc?-1:v; }, FR={}, LR={};
    G.forEach((e,key)=>{ if(e<0) return; const br=Math.floor(Math.floor(key/100)/10); if(!(e in FR)||br<FR[e]) FR[e]=br; if(!(e in LR)||br>LR[e]) LR[e]=br; });
    let d=''; const f=v=>v.toFixed(1);
    for(let r=0;r<nr;r++) for(let c=0;c<nc;c++){ const e=ep(r,c); if(e<0) continue; const br=Math.floor(r/10);
      if(ep(r-1,c)!==e) d+='M'+f(X[c])+' '+f(Y[r])+'H'+f(X[c+1]);
      if(ep(r+1,c)<0) d+='M'+f(X[c])+' '+f(Y[r+1])+'H'+f(X[c+1]);
      if((c>0 || br===FR[e]) && ep(r,c-1)!==e) d+='M'+f(X[c])+' '+f(Y[r])+'V'+f(Y[r+1]);
      if((c<nc-1 || br===LR[e]) && ep(r,c+1)<0) d+='M'+f(X[c+1])+' '+f(Y[r])+'V'+f(Y[r+1]);
    }
    svg.setAttribute('viewBox','0 0 '+B.width+' '+B.height); svg.innerHTML='<path d="'+d+'"/>';
    big.querySelectorAll('[data-lab]').forEach(el=>{ const c=+el.dataset.gc, r=+el.dataset.gr, s=document.createElement('span');
      s.className='eplab'; s.textContent=el.dataset.lab; s.style.left=(X[c]+3)+'px'; s.style.top=Math.max(Y[r],7)+'px'; big.appendChild(s); });
  });
}
/* phones can enforce a minimum font size, so measure each word and shrink it with a transform until it fits its card */
function fitWG(){ requestAnimationFrame(()=>view.querySelectorAll('.wgc span').forEach(s=>{ s.style.transform='translate(-50%,-50%)';
  const cw=s.parentNode.clientWidth*0.9, ch=s.parentNode.clientHeight*0.9, w=s.offsetWidth, h=s.offsetHeight;
  const f=Math.min(1, w?cw/w:1, h?ch/h:1); if(f<1) s.style.transform='translate(-50%,-50%) scale('+f.toFixed(3)+')'; })); }
function setPW(){ document.documentElement.style.setProperty('--pw',(document.documentElement.clientWidth-20)+'px'); }
setPW(); addEventListener('resize',setPW);
addEventListener('resize',()=>{ if(S.view==='words' && S.wview==='grid'){ clearTimeout(fitWG.t); fitWG.t=setTimeout(()=>{ fitWG(); wgSeams(); },150); } });
