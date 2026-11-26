/* ---------- corpus: every line of every group ---------- */
/* study order: your own order (Options → Episodes) first, anything not placed yet after it in the default order (notes, then episodes) */
function groupOrder(){ const g=S.index.groups, base=g.filter(x=>x.kind==='notebook').concat(g.filter(x=>x.kind!=='notebook')), ix=new Map((S.eord||[]).map((id,i)=>[id,i]));
  const key=(x,i)=>ix.has(x.id)?ix.get(x.id):1e4+i; return base.map((x,i)=>[x,key(x,i)]).sort((a,b)=>a[1]-b[1]).map(p=>p[0]); }
function saveEord(){ LS.set('eord.v1',S.eord); if(S.db) S.db.doc('settings/eord').set({ids:S.eord}).catch(()=>{}); }
function moveEp(id,d){ const ids=groupOrder().map(g=>g.id), i=ids.indexOf(id), j=i+d; if(i<0||j<0||j>=ids.length) return; [ids[i],ids[j]]=[ids[j],ids[i]]; S.eord=ids; saveEord(); derive(); }
const PUNCT=/[\s、。，,！？!?…「」『』*～~・"]/;
const KJ=/[一-鿿]/;
/* kanji in your episodes that are not in the 3,000-kanji deck: numbered on from 3001 in the order they first appear, each with a keyword */
const KEXTRA={'濘':[3001,'mire'],'譚':[3002,'saga'],'贄':[3003,'victim'],'漲':[3004,'brim'],'掠':[3005,'graze']};
function kInfo(ch){ const d=S.deckMap&&S.deckMap.get(ch); if(d) return d; const x=KEXTRA[ch]; return x?{k:ch,frame:x[0],kw:x[1],on:'',kun:'',story:'',extra:true}:{k:ch,frame:null,kw:'',on:'',kun:'',story:'',extra:true}; }
const escA = s => esc(s).replace(/"/g,'&quot;');
let corpus=null;
function prepLines(d){ d._prep=true; d.lines.forEach(L=>{ let full='', norm='', map=[];
  L.tk.forEach((h,i)=>{ const s=surf(h); full+=s; for(let k=0;k<s.length;k++){ if(!PUNCT.test(s[k])){ norm+=s[k]; map.push(i); } } }); L._f=full; L._n=norm; L._m=map; }); return d; }
function ensureCorpus(){
  if(!corpus) corpus = Promise.all([...S.index.groups.map(g=>loadGroup(g.id)), loadLemmas()]).then(()=>{
    S.index.groups.forEach(g=>{
      const d=S.data.get(g.id); if(d._prep) return; d._prep=true;
      d.lines.forEach(L=>{
        let full='', norm='', map=[];
        L.tk.forEach((h,i)=>{ const s=surf(h); full+=s; for(let k=0;k<s.length;k++){ if(!PUNCT.test(s[k])){ norm+=s[k]; map.push(i); } } });
        L._f=full; L._n=norm; L._m=map;
      });
    });
    buildKanjiIndex();
  }).catch(e=>{ corpus=null; throw e; });
  return corpus;
}
/* dictionary-form words: each note headword maps to the words it contains (data/lemmas.json) */
async function loadLemmas(){
  if(S.lem) return;
  try{ const r=await fetch('data/lemmas.json'); if(!r.ok) throw 0; S.lem=await r.json(); }catch(e){ S.lem={heads:{},words:{}}; }
  try{ const r=await fetch('data/forms.json'); if(!r.ok) throw 0; S.wforms=(await r.json()).forms||{}; }catch(e){ S.wforms={}; }
}
const WCACHE=new Map(); let WCV=-1;
function wordsOf(b){
  const wv=S.nver+'|'+(S.lem?1:0);   // results made before lemmas.json arrived must not stick
  if(WCV!==wv){ WCACHE.clear(); WCV=wv; }
  let r=WCACHE.get(b); if(r) return r;
  r=[]; const i=b.indexOf(' - ');
  if(i>=0){
    const head=b.slice(0,i).trim(), ctx=b.slice(i+3).trim(), lm=S.lem && S.lem.heads[head];
    if(lm) lm.forEach(x=>{ const w=x[0]; if((S.nameN||[]).includes(normWord(w))) return; const d=S.lem.words[w]||['',''];
      r.push({word:w, reading:d[0], gloss:d[1]||ctx, ctx, surf:x[1]||null, one:lm.length===1}); });
    else { const p=parseBullet(b); if(p) r.push({word:p.word, reading:p.reading, gloss:p.meaning, ctx, surf:null, one:true}); }
    /* a compound also teaches the words it is made of (頭がおかしい → 頭, おかしい): count those too */
    const pt=S.lem && S.lem.parts; if(pt) r.slice().forEach(x=>(pt[x.word]||[]).forEach(p=>{
      const w=Array.isArray(p)?p[0]:p, sf=Array.isArray(p)?p[1]:null;   // [word, how it is written inside the compound]
      if(r.some(y=>y.word===w) || (S.nameN||[]).includes(normWord(w))) return; const d=S.lem.words[w]||['',''];
      r.push({word:w, reading:d[0], gloss:d[1], ctx, surf:sf, one:false, part:x.word}); }));
  }
  WCACHE.set(b,r); return r;
}
/* where a word sits in a line: its own surface in this note first, then its stem, then any surface seen elsewhere */
function findWord(L,x,e){
  if(!L._n) return null;
  const tries=[]; if(x && x.surf) tries.push(x.surf); if(e){ tries.push(e.s); e.forms.forEach(f=>tries.push(f)); } else tries.push(stemOf(x.word).s);
  for(const t of tries){ const n=normWord(t||''); if(!n) continue; const i=L._n.indexOf(n); if(i>=0) return {idx:i,len:n.length}; }
  return null;
}
const normWord = w => w.replace(/[+＋\s…*～~・、。！？!?「」]/g,'');
function lineOf(gid,n){ const d=S.data.get(gid); if(!d) return null; const L=d.lines[n-1]; return (L && L.n===n) ? L : d.lines.find(x=>x.n===n); }
function hitsFor(L,idx,len){ const s=new Set(); if(idx>=0) for(let k=idx;k<idx+len;k++) s.add(L._m[k]); return s; }
function isLearnedLine(gid,n){ return getLearned(gid).has(n); }

