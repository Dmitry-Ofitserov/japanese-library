/* ---------- time tracking ---------- */
const DAY=864e5;
S.excl = new Set(LS.get('excl.v1',[]));
S.eord = LS.get('eord.v1',[]);
/* lines marked "learned, no review": counted as learned but kept out of spaced repetition ("gid:n") */
S.norv = new Set(LS.get('norv.v1',[]));
function saveNorv(){ LS.set('norv.v1',[...S.norv]); if(S.db) S.db.doc('settings/norv').set({ids:[...S.norv]}).catch(()=>{}); }
S.wfull = LS.get('wscale','stage')==='full';
function saveExcl(){ LS.set('excl.v1',[...S.excl]); if(S.db) S.db.doc('settings/excl').set({ids:[...S.excl]}).catch(()=>{}); }
function computePotential(){
  const w=new Set(S.words.map(e=>e.word));
  groupOrder().forEach(g=>{ if(S.excl.has(g.id)) return; const d=S.data.get(g.id); if(!d) return; const set=getLearned(g.id);
    d.lines.forEach(L=>{ if(set.has(L.n)) return; L.b.forEach(b=>wordsOf(b).forEach(x=>{ if(!isLoan(x.word)) w.add(x.word); })); }); });
  S.potW=w.size; S.potK=S.kstats?S.kstats.l+S.kstats.p:0;
}
{ const a=LS.get('learnedAt.v1',{}); S.at=new Map(Object.keys(a).map(k=>[k,a[k]])); const f=LS.get('frozen.v1',{}); S.fz=new Map(Object.keys(f).map(k=>[k,f[k]])); }
function setFz(g,n,v){ let o=S.fz.get(g); if(!o){ o={}; S.fz.set(g,o); } if(v) o[n]=v; else delete o[n]; }
const getAt=(g,n)=>{ const o=S.at.get(g); return o?(+o[n]||0):0; };
function setAt(g,n,t){ let o=S.at.get(g); if(!o){ o={}; S.at.set(g,o); } if(t) o[n]=t; else delete o[n]; }
/* a study day runs from 4:00 to 3:59 Moscow time (UTC+3), whatever the phone's clock is set to */
const SD=t=>Math.floor((t-36e5)/DAY), dayStart=d=>d*DAY+36e5, today=()=>SD(Date.now());
const startOfDay=t=>dayStart(SD(t));
const dkey=t=>{ const d=new Date(t); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); };
function learnedTs(ch,story){
  if(S.kmode==='story') return 0;
  let m=Infinity; (S.kocc.get(ch)||[]).forEach(o=>{ if(isLearnedLine(o.gid,o.n)) m=Math.min(m,getAt(o.gid,o.n)); });
  return isFinite(m)?m:0;
}
/* header: new lines / words / kanji learned today and over the last 7 days; Lines tab: learned lines in every episode */
function paintHead(){
  const el=$('#hst'); if(!el || !S.ev) return;
  const t0=startOfDay(Date.now()), w0=t0-6*DAY, c=(a,f)=>a.filter(t=>t>=f).length;
  const col=(k,ic,nm)=>'<span class="hcl" title="'+nm+'">'+ic+'<b>'+c(S.ev[k],t0)+'</b><i>'+c(S.ev[k],w0)+'</i></span>';
  el.innerHTML='<span class="hlab"><b>Today</b><i>7 days</i></span>'+col('lines','<span class="hi"><svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4.5h12a1.5 1.5 0 0 1 1.5 1.5v6.5A1.5 1.5 0 0 1 16 14H9l-3.5 3v-3H4a1.5 1.5 0 0 1-1.5-1.5V6A1.5 1.5 0 0 1 4 4.5z"/><path d="M6 8h8M6 10.8h5"/></svg></span>','New lines')+col('words','<span class="hi ti" lang="ja">あ</span>','New words')+col('kanji','<span class="hi ti" lang="ja">字</span>','New kanji')+(S.bucket.length?'<button class="hcl hbk" title="Cards in your review bucket · open Review"><span class="hi">'+ICO_BKT+'</span><b>'+S.bucket.length+'</b><i>bucket</i></button>':'');
  paintTabCounts();
}
function paintTabCounts(){ if(!S.index) return; const n=$('#nLines'); if(n) n.textContent=S.index.groups.reduce((a,g)=>a+getLearned(g.id).size,0); }
function evTimes(){
  const lines=[]; S.index.groups.forEach(g=>{ getLearned(g.id).forEach(n=>{ const t=getAt(g.id,n); if(t>0) lines.push(t); }); });
  return { lines,
    words:(S.words||[]).map(e=>e.ts).filter(t=>t>0&&isFinite(t)),
    kanji:(S.deck||[]).filter(e=>e.st==='l'&&e.ts>0).map(e=>e.ts) };
}
/* average per day: over every day since the first tracked item, or over the last `win` days (fewer if tracking is younger) */
function paceOf(ts,win){
  if(!ts.length) return 0;
  const t0=startOfDay(Date.now()), all=Math.max(1,Math.round((t0-startOfDay(Math.min(...ts)))/DAY)+1), span=win?Math.min(win,all):all, from=t0-(span-1)*DAY;
  return ts.filter(t=>t>=from).length/span;
}
function fmtEta(rem,rate){
  if(rem<=0) return '✓'; if(!rate) return '—';
  const d=rem/rate; if(d>3650) return '—';
  if(d<=1) return '~1 d'; if(d<100) return '~'+Math.ceil(d)+' d'; if(d<730) return '~'+Math.round(d/30)+' mo'; return '~'+(d/365).toFixed(1)+' y';
}
const fmtDate=t=>new Date(t).toLocaleDateString(undefined,t-Date.now()>300*DAY?{day:'numeric',month:'short',year:'numeric'}:{day:'numeric',month:'short'});

