/* ---------- listening: words read aloud, Japanese, a pause to recall, then English ---------- */
/* a session: the picked blocks of 20 words from the word grid, split into sets (default 20) and groups (default 4).
   Each group: every word a few times in a row, then the group in order, then shuffled; each set ends with shuffled rounds of the whole set.
   The thinking pause shrinks from the first pass to the last. */
const LXD={burst:true,f1:5,f2:2,f3:4,fp:0.8,hardOnly:false,hardJ:false,hardE:false,loop:true,eng:'rec',g1:4,g2:20,rep:3,ord:1,shf:1,mix:2,p0:2,p1:1,gap:0.7,rate:1,cue:'both',dir:'je',perm:true,easy:true,all:false,vj:'',ve:''};
S.lxs=Object.assign({},LXD,LS.get('lx.v1',{}));
if(S.lxs.hardOnly){ S.lxs.hardJ=S.lxs.hardE=true; S.lxs.hardOnly=false; }
/* once: three normal repeats on the first pass (bursts came in with this) */
if(S.lxs.v2!==1){ S.lxs.v2=1; S.lxs.rep=Math.max(3,S.lxs.rep|0); LS.set('lx.v1',S.lxs); }
/* the picked blocks: any set, each tap adds or removes one (older saves held a range) */
S.lxsel=(()=>{ const v=LS.get('lxsel2.v1',null); if(Array.isArray(v)) return v; const r=LS.get('lxsel.v1',null); if(!Array.isArray(r)) return []; const o=[]; for(let k=Math.min(r[0],r[1]);k<=Math.max(r[0],r[1]);k++) o.push(k); return o; })();
const lxSelSave = () => LS.set('lxsel2.v1',S.lxsel);
const lxSelName = sel => { const a=sel.map(k=>k+1); if(!a.length) return 'No blocks'; if(a.length===1) return 'Block '+a[0];
  const parts=[]; for(let i=0;i<a.length;){ let j=i; while(j+1<a.length && a[j+1]===a[j]+1) j++; parts.push(j>i?a[i]+'–'+a[j]:''+a[i]); i=j+1; } return 'Blocks '+parts.join(', '); };
S.lxdone=LS.get('lxdone.v1',{});
/* listening stats, all keyed by the first word of a block: finished full sessions (lxdone), finished shuffle rounds (lxmx), seconds listened (lxt); plus seconds per day and in total.
   Kept on this device and in the shared store, so the app, Chrome and a computer add up to the same numbers (the larger number wins when they differ) */
S.lxmx=LS.get('lxmx.v1',{}); S.lxhd=LS.get('lxhd.v1',{}); S.lxlast=LS.get('lxlast.v1',{}); S.lxt=LS.get('lxt.v1',{}); S.lxday=LS.get('lxday.v1',{}); S.lxtot=LS.get('lxtot.v1',0);
const lxToday = () => new Date(Math.floor((Date.now()-36e5)/864e5)*864e5).toISOString().slice(0,10);
function lxStatSave(force){ LS.set('lxdone.v1',S.lxdone); LS.set('lxmx.v1',S.lxmx); LS.set('lxhd.v1',S.lxhd); LS.set('lxlast.v1',S.lxlast); LS.set('lxt.v1',S.lxt); LS.set('lxday.v1',S.lxday); LS.set('lxtot.v1',S.lxtot);
  const now=Date.now(); if(!S.db || (!force && now-(LX.dbT||0)<20000)) return; LX.dbT=now;
  const r=o=>{ const x={}; for(const k in o) x[k]=Math.round(o[k]*10)/10; return x; };
  S.db.doc('settings/listen').set({v:JSON.stringify({done:S.lxdone,mx:S.lxmx,hd:S.lxhd,rt:S.rvt,last:S.lxlast,t:r(S.lxt),day:r(S.lxday),tot:Math.round(S.lxtot)})}).catch(()=>{}); }
function lxMerge(d){ let v; try{ v=JSON.parse(d.v||'{}'); }catch(e){ return; } let ch=false;
  const mx=(a,b)=>{ for(const k in (b||{})) if(+b[k]>(+a[k]||0)+.5){ a[k]=+b[k]; ch=true; } };
  mx(S.lxdone,v.done); mx(S.lxmx,v.mx); mx(S.lxhd,v.hd); if(v.rt){ const before=JSON.stringify(S.rvt); mx(S.rvt,v.rt); if(JSON.stringify(S.rvt)!==before) LS.set('rvt.v1',S.rvt); } mx(S.lxlast,v.last); mx(S.lxt,v.t); mx(S.lxday,v.day); if(+v.tot>S.lxtot+.5){ S.lxtot=+v.tot; ch=true; }
  if(ch){ lxStatSave(); if(S.view==='words' && !LX.on && !view.contains(document.activeElement)) renderLxPanel(); else lxPaintTotals(); } }
const LX={on:false,paused:false,steps:[],i:0,tok:0,wl:null,ac:null,phase:0,label:'',st:0,wake:null,sel:null,t0:0};
const LXBS=20;
const ICO_LXP='<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.2v11.6a.6.6 0 0 0 .9.5l9.2-5.8a.6.6 0 0 0 0-1L4.9 1.7a.6.6 0 0 0-.9.5z"/></svg>';
const ICO_LXPA='<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3.2" y="2.2" width="3.3" height="11.6" rx=".8"/><rect x="9.5" y="2.2" width="3.3" height="11.6" rx=".8"/></svg>';
const ICO_LXN='<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 2.8v10.4a.6.6 0 0 0 .9.5l7.6-5.2a.6.6 0 0 0 0-1L3.4 2.3a.6.6 0 0 0-.9.5z"/><rect x="11.4" y="2.4" width="2.2" height="11.2" rx=".7"/></svg>';
const ICO_LXB='<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13.5 2.8v10.4a.6.6 0 0 1-.9.5L5 8.5a.6.6 0 0 1 0-1l7.6-5.2a.6.6 0 0 1 .9.5z"/><rect x="2.4" y="2.4" width="2.2" height="11.2" rx=".7"/></svg>';
const ICO_LXF='<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 3v10a.5.5 0 0 0 .8.4L8 9V13a.5.5 0 0 0 .8.4l6.6-5a.5.5 0 0 0 0-.8l-6.6-5A.5.5 0 0 0 8 3v4L2.3 2.6a.5.5 0 0 0-.8.4z"/></svg>';
const ICO_LXS='<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="3" width="10" height="10" rx="1.5"/></svg>';
const ICO_SHUF='<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 4.5h2.6c1.6 0 2.5.8 3.4 2.2l1.9 2.9c.9 1.4 1.8 2.2 3.4 2.2h1.7M1.5 11.5h2.6c1 0 1.7-.3 2.3-.9M14.5 4.5h-1.7c-1 0-1.7.3-2.3.9M12.6 2.6l1.9 1.9-1.9 1.9M12.6 9.6l1.9 1.9-1.9 1.9"/></svg>';
const ICO_HP='<svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 12.5V10a6.5 6.5 0 0 1 13 0v2.5"/><rect x="2.8" y="11.5" width="3.6" height="5.5" rx="1.3"/><rect x="13.6" y="11.5" width="3.6" height="5.5" rx="1.3"/></svg>';
function lxSave(){ LS.set('lx.v1',S.lxs); }
function lxVoices(){ const v=synth?synth.getVoices():[]; return {ja:v.filter(x=>/^ja/i.test(x.lang)), en:v.filter(x=>/^en/i.test(x.lang))}; }
function lxVoice(k){ const V=lxVoices()[k], nm=k==='ja'?S.lxs.vj:S.lxs.ve, f=V.find(v=>v.name===nm); if(f) return f;
  if(k==='ja') return S.voice||V[0]||null;
  return V.find(v=>/en-US/i.test(v.lang)&&/google|samantha|aria|jenny|guy|zira|alex/i.test(v.name))||V.find(v=>/en-US/i.test(v.lang))||V[0]||null; }
/* the most direct translation: the first meaning, without notes in brackets */
/* notes in brackets are removed before cutting at ';' (a note can hold a ';'), and nothing Japanese is left for the English voice to spell out */
const LXJ=/[\u3040-\u30ff\u3400-\u9fff\uff66-\uff9f々〆〜～・「」『』]/g;
/* the word's short translation: the hand-picked one in lemmas.json (short), else the first sense of the dictionary gloss */
const wShort=e=>S.lem&&S.lem.short&&S.lem.short[e.word];
function lxEn(e){ const sh=wShort(e); if(sh) return sh; let s=String(e.gloss||(e.means&&e.means[0])||'');
  for(let k=0;k<3;k++) s=s.replace(/\([^()]*\)|\[[^\[\]]*\]/g,'');
  s=s.split(' / ')[0].split(';')[0].replace(/[()[\]]/g,'').replace(LXJ,' ').replace(/\s+([,.!?])/g,'$1').replace(/\s+/g,' ').replace(/^[\s,:–-]+|[\s,:–-]+$/g,'').trim();
  return s||'?'; }
const lxMora = s => [...s].filter(ch=>!SMALL.test(ch)&&!/[ー・\s]/.test(ch)).length + [...s].filter(ch=>ch==='ー').length*0.8;
/* the words in the same order and blocks as the word grid in study order, words of your episodes not learned yet included */
function lxItems(){ return wordItems(S.words.slice().sort((a,b)=>a.rank-b.rank||a.i-b.i),false,true); }
function lxShuffle(a,avoid,prev){
  if(a.length<2) return a.slice();
  for(let t=0;t<12;t++){ const b=a.slice(); for(let i=b.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [b[i],b[j]]=[b[j],b[i]]; }
    if(b[0]===avoid) continue; if(prev && b.every((x,i)=>x===prev[i])) continue; return b; }
  const r=a.slice(1).concat(a[0]); return r[0]===avoid?r.reverse():r;
}
function lxPauses(o){ return [0,1,2,3].map(i=>Math.round((o.p0+(o.p1-o.p0)*i/3)*100)/100); }
function lxPlan(words,o,hard){
  const st=[], P=lxPauses(o); let last=null, si=0, gi=-1; st.sets=[];
  const W=(x,p,stage,fk)=>{ st.push({t:'w',x,p,stage,si,gi,fk:fk||2}); last=x; };
  const C=(tone,say,label)=>st.push({t:'c',tone,say,label});
  const sets=[]; for(let i=0;i<words.length;i+=o.g2) sets.push(words.slice(i,i+o.g2));
  sets.forEach((full,k)=>{ si=k; const set=full.filter(x=>!x.skip); if(!set.length){ st.sets.push({full,gr:[]}); return; }
    const nm = !hard && o.g2===LXBS ? 'Block '+(full[0].bi+1) : 'Set '+(si+1);
    /* no undersized group at the end: the leftover words are shared out over the groups before it (17 words → 5, 4, 4, 4) */
    const ng=Math.max(1,Math.floor(set.length/o.g1)), gr=[]; let at=0;
    for(let gi=0;gi<ng;gi++){ const sz=Math.floor(set.length/ng)+(gi<set.length%ng?1:0); gr.push(set.slice(at,at+sz)); at+=sz; }
    st.sets.push({full,gr});
    gr.forEach((g,k)=>{ gi=k;
      C(gi===0?'blk':'grp', (gi===0?nm+'. ':'')+'Group '+(gi+1), nm+' · group '+(gi+1)+' of '+gr.length);
      /* a word said again straight away: the thinking pause after the first time is halved */
      /* the burst of fast repeats comes after the last normal repeat of a word's first meeting */
      g.forEach(x=>{ for(let k=0;k<o.rep;k++) W(x,k?Math.round(P[0]*50)/100:P[0],'Each word '+o.rep+'×',k===o.rep-1?1:3); });
      for(let k=0;k<o.ord;k++) g.forEach(x=>W(x,P[1],'In order'));
      let prev=g; for(let k=0;k<o.shf;k++){ const s=lxShuffle(g,last,prev); s.forEach(x=>W(x,P[2],'Shuffled')); prev=s; }
    });
    gi=-1;
    if(o.mix>0 && gr.length>1){ C('mix','All '+set.length+' words',nm+' · all '+set.length+' words mixed'); let prev=null; for(let k=0;k<o.mix;k++){ const s=lxShuffle(set,last,prev); s.forEach(x=>W(x,P[3],'Mix · round '+(k+1)+' of '+o.mix)); prev=s; } }
  });
  if(o.all && sets.length>1){ si=-1; const pl=words.filter(x=>!x.skip); C('mix','Everything','All '+pl.length+' words mixed'); lxShuffle(pl,last).forEach(x=>W(x,P[3],'Everything')); }
  C('end','Done','Done');
  return st;
}
function lxPlanShuf(words,o,prev){
  const pl=words.filter(x=>!x.skip), st=[], prevLast=prev&&prev[prev.length-1];
  st.sets=[]; for(let i=0;i<words.length;i+=LXBS) st.sets.push({full:words.slice(i,i+LXBS),gr:[]});
  const ord=lxShuffle(pl,prevLast,prev); st.order=ord;
  st.push({t:'c',tone:'mix',say:pl.length<=100&&pl.length>1?'All '+pl.length+' words':'Everything',label:'Shuffle · all '+pl.length+' words'});
  ord.forEach((x,i)=>st.push({t:'w',x,p:o.p0,stage:'Shuffle · '+(i+1)+' of '+ord.length,si:-1,gi:-1,fk:4}));
  st.push({t:'c',tone:'end',say:'Done',label:'Done'});
  return st; }
/* seconds a plan takes, from step i on; speaking speed is learned from how long lines took to say */
function lxDur(steps,o,from){ const per=msPerW(o.rate)/1000; let t=0;
  for(let i=from||0;i<steps.length;i++){ const s=steps[i];
    if(s.t==='c') t+=(o.cue==='off'?0:.5)+(o.cue==='both'||o.cue==='tone'?.6:0)+(o.cue==='both'||o.cue==='voice'?1.1:0);
    else { const r=lxRec()&&LXA.idx&&LXA.idx.w[s.x.w]; t+=(r?(r[2]+r[4])/o.rate+.1:s.x.mo*per+.3+(s.x.en.length*.065/o.rate+.35)) + s.p + o.gap; } }
  return t; }
const lxFmt = s => { s=Math.max(0,Math.round(s)); return s>=60?Math.floor(s/60)+':'+String(s%60).padStart(2,'0'):s+' s'; };
const lxMin = s => s<90?Math.max(1,Math.round(s))+' s':'about '+Math.round(s/60)+' min';
function lxWords(sel,o){ const it=lxItems(), bl=[...new Set(sel)].filter(k=>it[k*LXBS]).sort((x,y)=>x-y), a=bl.length?bl[0]:0, b=bl.length?bl[bl.length-1]:0;
  const sk=w=>(o.perm && S.permw.has(w)) || (o.easy && S.easyw.has(w));
  const pick=[].concat(...bl.map(k=>it.slice(k*LXBS,(k+1)*LXBS).map(x=>Object.assign({bi:k},x)))), skip=pick.filter(x=>sk(x.e.word)).length;
  const all=pick.map((x,k)=>{ const say=speakWord(x.e), bi=x.bi; return {w:x.e.word,r:x.e.reading||'',say,en:lxEn(x.e),mo:lxMora(say)||2,g:!!x.g,k,e:x.e,bi,bk:it[bi*LXBS].e.word,skip:sk(x.e.word)}; });
  const ws=all.filter(x=>!x.skip);
  return {ws,all,skip,a,b,bl,n:it.length}; }
/* speech and sounds */
function lxSpeak(text,lang,rate){ return new Promise(res=>{
  if(!synth || !text){ res(); return; }
  const u=new SpeechSynthesisUtterance(text); u.lang=lang==='ja'?'ja-JP':'en-US'; const v=lxVoice(lang); if(v) u.voice=v; u.rate=rate; u.volume=S.vol;
  let done=false; const fin=()=>{ if(done) return; done=true; clearTimeout(t); res(); };
  u.onend=fin; u.onerror=fin; const t=setTimeout(fin,2500+text.length*450/rate); LX.u=u; synth.speak(u); }); }
/* recorded voices: data/audio/index.json maps each word to its Japanese and English clips inside packs of ~60 words (pNNN.mp3), and spoken cues to clips in cues.mp3.
   They play through Web Audio, which works where there is no speech engine (the Claude app). */
const LXA={idx:null,ip:null,bufs:new Map(),load:new Map()};
const lxRec = () => S.lxs.eng==='rec' || !synth;
function lxCtx(){ if(!LX.ac) LX.ac=new (window.AudioContext||window.webkitAudioContext)(); return LX.ac; }
const lxTO = (p,ms,what) => Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error(what+' timed out')),ms))]);
function lxaIndex(){ if(!LXA.ip) LXA.ip=lxTO(fetch(AUDIO_BASE+'index.json'),20000,'index').then(r=>{ if(!r.ok) throw new Error('index HTTP '+r.status); return r.json(); }).then(j=>{ LXA.idx=j; return j; }).catch(e=>{ LXA.ip=null; LXA.err='list of recordings: '+(e&&e.message||e); return null; }); return LXA.ip; }
/* decode with the playing context; if that fails or hangs (some app viewers), decode offline and play the result */
function lxDecode(ab){
  const go=c=>new Promise((res,rej)=>{ try{ const r=c.decodeAudioData(ab.slice(0),res,e=>rej(new Error('decode: '+(e&&e.message||'bad audio')))); if(r&&r.then) r.then(res,rej); }catch(e){ rej(e); } });
  return lxTO(go(lxCtx()),8000,'decode').catch(e=>{ const OC=window.OfflineAudioContext||window.webkitOfflineAudioContext; if(!OC) throw e; return lxTO(go(new OC(1,24000,24000)),20000,'offline decode'); }); }
/* packs are kept on this device (Cache Storage) after their first download; a pack's key carries a fingerprint of the clips the index puts in it, so a changed pack is downloaded again */
const LXC={p:null};
function lxaCacheOpen(){ if(!LXC.p) LXC.p=(async()=>{ try{ return self.caches?await caches.open('asl-audio'):null; }catch(e){ return null; } })(); return LXC.p; }
function lxaFp(name){ const I=LXA.idx; if(!I) return '0'; const src=[], pi=I.packs.indexOf(name), fi=(I.fpacks||[]).indexOf(name);
  if(pi>=0){ for(const w in I.w){ const x=I.w[w]; if(x[0]===pi) src.push(w+':'+x.slice(1,5).join(',')); } }
  else if(fi>=0){ for(const w in I.f){ const x=I.f[w]; if(x[0]===fi) src.push(w+':'+x.slice(1).join(',')); } }
  else if(I.cue){ for(const k in I.cue) src.push(k+':'+I.cue[k].join(',')); }
  src.sort(); const s=src.join('|'); let hh=2166136261; for(let i=0;i<s.length;i++){ hh^=s.charCodeAt(i); hh=Math.imul(hh,16777619); }
  return (hh>>>0).toString(36)+'.'+src.length; }
const lxaKey=name=>new URL(AUDIO_BASE+name+'?fp='+lxaFp(name),location.href).href;
async function lxaCached(name){ try{ await lxaIndex(); const c=await lxTO(lxaCacheOpen(),3000,'cache'); if(!c) return null; const r=await c.match(lxaKey(name)); return r?await r.arrayBuffer():null; }catch(e){ return null; } }
async function lxaStore(name,ab){ try{ const c=await lxaCacheOpen(); if(!c) return; const key=lxaKey(name), base=key.split('?')[0];
  await c.put(key,new Response(ab.slice(0),{headers:{'Content-Type':'audio/mpeg'}}));
  (await c.keys()).forEach(r=>{ if(r.url.split('?')[0]===base && r.url!==key) c.delete(r).catch(()=>{}); }); }catch(e){} }
/* a pack's bytes: from this device if kept, otherwise downloaded (and kept) */
async function lxaBytes(name){
  const hit=await lxaCached(name); if(hit) return hit;
  const r=await lxTO(fetch(AUDIO_BASE+name),30000,'download'); if(!r.ok) throw new Error('HTTP '+r.status);
  const ab=await lxTO(r.arrayBuffer(),45000,'download'); lxaStore(name,ab); return ab; }
/* keep every word pack on this device; prog(done,total) */
async function lxaSaveAll(prog){
  const I=await lxaIndex(); if(!I) throw new Error('no list of recordings');
  try{ if(navigator.storage && navigator.storage.persist) await navigator.storage.persist(); }catch(e){}
  if(!(await lxaCacheOpen())) throw new Error('this browser cannot keep files');
  const all=I.packs.slice(); let done=0, bad=0; prog(0,all.length);
  const one=async n=>{ try{ if(!(await lxaCached(n))) await lxaBytes(n); }catch(e){ bad++; } prog(++done,all.length); };
  for(let i=0;i<all.length;i+=3) await Promise.all(all.slice(i,i+3).map(one));
  return bad; }
async function lxaSavedN(){ try{ const I=await lxaIndex(), c=await lxaCacheOpen(); if(!I||!c) return null; const ks=new Set((await c.keys()).map(r=>r.url)); return I.packs.filter(n=>ks.has(lxaKey(n))).length; }catch(e){ return null; } }
function lxaPack(name){
  if(!LXA.load.has(name)) LXA.load.set(name,lxaBytes(name)
    .then(lxDecode).then(b=>{ LXA.bufs.set(name,b); return b; }).catch(e=>{ LXA.load.delete(name); throw new Error(name+': '+(e&&e.message||e)); }));
  return LXA.load.get(name); }
/* the clip of a word: [pack, start, length] or null */
function lxaClip(w,lang){ const x=LXA.idx&&LXA.idx.w[w]; if(!x) return null; return lang==='ja'?[LXA.idx.packs[x[0]],x[1],x[2]]:[LXA.idx.packs[x[0]],x[3],x[4]]; }
function lxaCue(say){ const I=LXA.idx; if(!I) return []; return say.split(/\.\s*/).filter(Boolean).map(p=>I.cue[p]?['cues.mp3',I.cue[p][0],I.cue[p][1]]:null).filter(Boolean); }
/* faster or slower speech without changing the pitch (WSOLA: overlapping 32 ms slices, each one placed where it lines up best with the last) */
function lxStretch(x,r,sr){
  const N=2*Math.round((sr||24000)*.016), Hs=N/2, tol=Math.round(Hs*.42), w=new Float32Array(N); for(let i=0;i<N;i++) w[i]=.5-.5*Math.cos(2*Math.PI*i/N);
  const pad=new Float32Array(x.length+2*N); pad.set(x,N/2); x=pad;
  const y=new Float32Array(Math.ceil(x.length/r)+2*N); let out=0, prev=-1;
  for(;;){ const nom=Math.round(out*r); if(nom+N>=x.length) break; let best=nom;
    if(prev>=0){ const nat=prev+Hs; let bc=-Infinity;
      for(let d=-tol;d<=tol;d+=2){ const c=nom+d; if(c<0||c+N>x.length) continue; let sm=0; for(let i=0;i<Hs;i+=4) sm+=x[nat+i]*x[c+i]; if(sm>bc){ bc=sm; best=c; } } }
    for(let i=0;i<N;i++) y[out+i]+=x[best+i]*w[i];
    prev=best; out+=Hs; }
  return y.subarray(0,out+Hs); }
const LXST=new Map();
function lxClipBuf(c,rate){ const b=LXA.bufs.get(c[0]); if(!b) return null;
  if(!rate || Math.abs(rate-1)<.01) return {b,off:Math.max(0,c[1]-.04),len:c[2]+.08};
  const key=c.join('|')+'|'+rate; let o=LXST.get(key);
  if(!o){ const sr=b.sampleRate, a=Math.max(0,Math.floor((c[1]-.04)*sr)), z=Math.min(b.length,Math.ceil((c[1]+c[2]+.04)*sr)), y=lxStretch(b.getChannelData(0).slice(a,z),rate,sr);
    const nb=lxCtx().createBuffer(1,y.length,sr); nb.getChannelData(0).set(y); o={b:nb,off:0,len:nb.duration};
    if(LXST.size>400) LXST.clear(); LXST.set(key,o); }
  return o; }
function lxaPlay(c,rate){ return new Promise(res=>{ const cb=lxClipBuf(c,rate); if(!cb){ res(false); return; }
  const ac=lxCtx(), src=ac.createBufferSource(), g=ac.createGain(); src.buffer=cb.b; g.gain.value=S.vol; src.connect(g); g.connect(ac.destination);
  let done=false; const fin=()=>{ if(done) return; done=true; clearTimeout(t); if(LX.src===src) LX.src=null; res(true); };
  src.onended=fin; const t=setTimeout(fin,cb.len*1000+1500); LX.src=src;
  try{ src.start(0,cb.off,cb.len); }catch(e){ fin(); } }); }
/* say a word (lang ja or en): its recording, or the device voice, or a soft tone when neither exists */
async function lxSay(x,lang){
  if(lxRec()){ const c=lxaClip(x.w,lang); if(c && LXA.bufs.has(c[0])){ await lxaPlay(c,S.lxs.rate); return; } }
  if(synth){ await lxSpeak(lang==='ja'?x.say:x.en,lang,S.lxs.rate); return; }
  await lxTone('miss'); }
async function lxCueSay(say){
  if(lxRec()){ const cs=lxaCue(say); if(cs.length){ for(const c of cs){ const tok=LX.tok; await lxaPlay(c); if(tok!==LX.tok) return; } return; } if(!synth) return; }
  if(synth) await lxSpeak(say,'en',1); }
/* load the packs a session needs before it starts */
/* the word packs are loaded before starting; the spoken cues load alongside (until they arrive, parts are marked by the chime) */
async function lxaPrep(ws,show){ LXA.err=''; show('Loading…'); const I=await lxaIndex(); if(!I) return false;
  lxaPack('cues.mp3').catch(()=>{});
  const need=[...new Set([].concat(...ws.map(x=>{ const c=lxaClip(x.w,'ja'), f=S.lxs.burst?lxaClipFast(x.w):null; return [c&&c[0], f&&f[0]]; })).filter(Boolean))];
  let done=0, bad=[]; show('Loading 0/'+need.length);
  await Promise.all(need.map(n=>lxaPack(n).then(()=>{ show('Loading '+(++done)+'/'+need.length); }).catch(e=>{ bad.push(e.message); })));
  if(bad.length){ LXA.err=bad.join('; '); return false; }
  return true; }
/* the fast recording of a word; without one, the normal recording sped up (or the device voice) */
function lxaClipFast(w){ const I=LXA.idx, f=I&&I.f&&I.f[w]; return f?[I.fpacks[f[0]],f[1],f[2]]:null; }
async function lxSayFast(x){
  if(lxRec()){ const f=lxaClipFast(x.w); if(f && LXA.bufs.has(f[0])){ await lxaPlay(f,1); return; }
    const c=lxaClip(x.w,'ja'); if(c && LXA.bufs.has(c[0])){ await lxaPlay(c,1.6); return; } }
  if(synth) await lxSpeak(x.say,'ja',1.8); }
function lxSleep(ms){ return new Promise(r=>{ LX.wake=r; LX.st=setTimeout(r,ms); }); }
function lxTone(kind){ return new Promise(res=>{ try{
  const ac=LX.ac||(LX.ac=new (window.AudioContext||window.webkitAudioContext)()); if(ac.state==='suspended') ac.resume();
  const sq={blk:[[523.25,0],[659.25,.13],[783.99,.26]],grp:[[659.25,0],[880,.12]],mix:[[523.25,0],[659.25,.11],[783.99,.22],[1046.5,.33]],end:[[783.99,0],[659.25,.15],[523.25,.3]],miss:[[440,0]]}[kind]||[[660,0]];
  const t0=ac.currentTime+.03; let end=0;
  sq.forEach(([f,dt])=>{ const os=ac.createOscillator(), g=ac.createGain(), t=t0+dt; os.type='sine'; os.frequency.value=f;
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(.16*Math.max(.05,S.vol),t+.015); g.gain.exponentialRampToValueAtTime(.0004,t+.5);
    os.connect(g); g.connect(ac.destination); os.start(t); os.stop(t+.55); end=Math.max(end,dt+.55); });
  setTimeout(res,end*1000+60); }catch(e){ res(); } }); }
async function lxWakeLock(on){ try{ if(on){ if(!LX.wl && navigator.wakeLock){ LX.wl=await navigator.wakeLock.request('screen'); LX.wl.addEventListener('release',()=>{ LX.wl=null; }); } } else if(LX.wl){ const w=LX.wl; LX.wl=null; await w.release(); } }catch(e){ LX.wl=null; } }
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible'){ if(LX.on && !LX.paused) lxWakeLock(true); }
  else if(LX.on && !LX.paused && matchMedia('(pointer:coarse)').matches) lxPause(); });
/* the player */
async function lxRun(){
  const tok=++LX.tok, o=S.lxs, je=o.dir==='je';
  while(LX.on && !LX.paused && LX.i<LX.steps.length){
    const s=LX.steps[LX.i];
    if(s.t==='c'){ LX.label=s.label; LX.phase=0; lxPaint();
      if(o.cue==='both'||o.cue==='tone'){ await lxTone(s.tone); if(tok!==LX.tok) return; }
      if(o.cue==='both'||o.cue==='voice'){ await lxCueSay(s.say); if(tok!==LX.tok) return; }
      if(o.cue!=='off'){ await lxSleep(450); if(tok!==LX.tok) return; } }
    else { const x=s.x;
      LX.phase=0; lxPaint(); await lxSay(x, je?'ja':'en'); if(tok!==LX.tok) return;
      await lxSleep(s.p*1000); if(tok!==LX.tok) return;
      LX.phase=1; lxPaint(); await lxSay(x, je?'en':'ja'); if(tok!==LX.tok) return;
      const nb=!o.burst||s.fk===3?0:(s.fk===1?o.f1:s.fk===4?(o.f3==null?4:o.f3):o.f2);
      if(nb>0){ await lxSleep((o.fp||0.8)*1000); if(tok!==LX.tok) return; LX.phase=2; lxPaint();
        for(let k=0;k<nb;k++){ await lxSayFast(x); if(tok!==LX.tok) return; if(k<nb-1){ await lxSleep(140); if(tok!==LX.tok) return; } } }
      await lxSleep(o.gap*1000); if(tok!==LX.tok) return; }
    LX.i++;
  }
  if(LX.on && !LX.paused && LX.i>=LX.steps.length) lxRunDone();
}
function lxHalt(){ LX.tok++; if(synth) synth.cancel(); if(LX.src){ try{ LX.src.stop(); }catch(e){} LX.src=null; } clearTimeout(LX.st); if(LX.wake){ const w=LX.wake; LX.wake=null; w(); } }
function lxGo(){ clearTimeout(LX.goT); LX.goT=setTimeout(lxRun,150); }
/* hard-only listening: hard JP → EN words, hard EN → JP words, or both together */
const lxHardOn=o=>!!(o.hardJ||o.hardE);
const lxHardHit=(st,o)=>!!((o.hardJ&&st.hj)||(o.hardE&&st.he));
async function lxStart(mode){
  if(mode==='hard'){ mode='full'; S.lxs.hardJ=S.lxs.hardE=true; lxSave(); }
  mode=mode==='shuf'?'shuf':'full'; const hard=lxHardOn(S.lxs);
  const o=S.lxs; let W=lxWords(S.lxsel,o);
  /* hard words only: from the picked blocks or from every block, in grid order, cut into sets of 20 and groups of 4–5 */
  if(hard){ const bl=wbBlocks(), it=lxItems(), pick=S.lxsel.length?S.lxsel.map(i=>bl[i]).filter(Boolean):bl, arr=[];
    pick.forEach(k=>k.ch.forEach(x=>{ if(S.permw.has(x.e.word)) return; if(lxHardHit(wbSt(x.e.word),S.lxs)) arr.push({x,b:k.b}); }));
    const all=arr.map(({x,b},k)=>{ const say=speakWord(x.e); return {w:x.e.word,r:x.e.reading||'',say,en:lxEn(x.e),mo:lxMora(say)||2,g:!!x.g,k,e:x.e,bi:b,bk:it[b*LXBS].e.word,skip:false}; });
    const bls=[...new Set(arr.map(a=>a.b))];
    W={ws:all,all,skip:0,a:bls[0]||0,b:bls[bls.length-1]||0,bl:bls,n:it.length};
    if(!all.length){ toast('No hard words '+(S.lxsel.length?'in the picked blocks.':'yet.')); return; } }
  if(!W.ws.length){ toast(W.bl.length?'No words to play in the picked blocks.':'Pick a block first.'); return; }
  if(S.cur && synth){ synth.cancel(); endCur(); }
  /* sound has to be switched on inside the tap, before anything is loaded */
  try{ const ac=lxCtx(); ac.resume(); const b=ac.createBuffer(1,1,22050), src=ac.createBufferSource(); src.buffer=b; src.connect(ac.destination); src.start(0); }catch(e){}
  if(lxRec()){ if(LX.prep) return; LX.prep=true; const show=t=>{ const bt=$('[data-lx="'+(mode==='shuf'?'shuf':'start')+'"] span'); if(bt) bt.textContent=t; };
    const ok=await lxaPrep(W.ws,show); LX.prep=false;
    if(!ok && !synth){ toast('Could not load the recordings.'); renderListenIf(); return; }
    LXA.err=''; }
  else if(!synth){ toast('This browser has no voice. Switch to recorded voices in the settings.'); return; }
  lxHalt(); Object.assign(LX,{on:true,paused:false,mode,hard,words:W.all,steps:mode==='shuf'?lxPlanShuf(W.all,o,null):lxPlan(W.all,o,hard),i:0,phase:0,label:'',sel:W.bl,t0:Date.now(),el:0,runs:0,lt:performance.now(),shownW:null,doneMsg:''});
  lxWakeLock(true); renderListenIf(); lxGo();
}
function lxPause(){ if(!LX.on||LX.paused) return; LX.paused=true; lxHalt(); lxWakeLock(false); lxStatSave(true); lxPaint(); }
function lxResume(){ if(!LX.on) return; if(S.cur){ synth.cancel(); endCur(); } LX.paused=false; lxWakeLock(true); lxPaint(); lxGo(); }
function lxStop(){ if(!LX.on) return; lxHalt(); LX.on=false; LX.paused=false; lxWakeLock(false); lxStatSave(true); LX.doneMsg=lxSumMsg('Listened to'); renderListenIf(); lxPaint(); }
/* skip to the next or previous word, or on to the next part (the next group or the mix) */
function lxJump(d){ if(!LX.on) return; lxHalt(); let i=LX.i;
  if(d==='part'){ i++; while(i<LX.steps.length && LX.steps[i].t!=='c') i++; }
  else { const dir=d<0?-1:1; i+=dir; while(i>0 && i<LX.steps.length && LX.steps[i].t!=='w') i+=dir; }
  LX.i=Math.max(0,Math.min(LX.steps.length-1,i));
  for(let k=LX.i;k>=0;k--) if(LX.steps[k].t==='c'){ LX.label=LX.steps[k].label; break; }
  LX.phase=0; lxPaint(); if(!LX.paused) lxGo(); }
function lxBlocksOf(ws){ return [...new Set(ws.map(x=>x.bk))]; }
function lxRunDone(){
  const C=LX.hard?S.lxhd:LX.mode==='shuf'?S.lxmx:S.lxdone; lxBlocksOf(LX.words).forEach(k=>{ C[k]=(C[k]||0)+1; }); lxStatSave(true); LX.runs++;
  if(S.lxs.loop){ const o=S.lxs; LX.steps=LX.mode==='shuf'?lxPlanShuf(LX.words,o,LX.steps.order):lxPlan(LX.words,o,LX.hard); LX.i=0; LX.phase=0; lxGo(); return; }
  lxFinish(); }
function lxFinish(){
  const sel=LX.sel, it=lxItems(); LX.on=false; LX.paused=false; lxWakeLock(false);
  /* the next blocks are picked for next time */
  const len=sel.length, nb=Math.ceil(it.length/LXBS), last=sel[sel.length-1]; if(last+1<nb){ S.lxsel=[]; for(let k=last+1;k<Math.min(nb,last+1+len);k++) S.lxsel.push(k); lxSelSave(); }
  LX.doneMsg=lxSumMsg('Finished')+' The next block is picked.';
  renderListenIf(); lxPaint(); toast(LX.doneMsg);
}
function lxSumMsg(v){ const sel=LX.sel; return v+' '+(LX.mode==='shuf'?'shuffling ':'')+(LX.hard?'the hard words of ':'')+lxSelName(sel).toLowerCase()+' after '+lxClock(LX.el)+(LX.runs?' · '+LX.runs+' full '+(LX.mode==='shuf'?'round':'run')+(LX.runs===1?'':'s'):'')+'.'; }
const lxClock = s => { s=Math.max(0,Math.floor(s)); const h=Math.floor(s/3600), m=Math.floor(s%3600/60), x=s%60; return (h?h+':'+String(m).padStart(2,'0'):m)+':'+String(x).padStart(2,'0'); };
const lxAgo = ms => { const m=Math.max(0,ms)/60000; return m<1?'now':m<60?Math.floor(m)+'m':m<1440?Math.floor(m/60)+'h':m<43200?Math.floor(m/1440)+'d':Math.floor(m/43200)+'mo'; };
const lxHM = s => { s=Math.round(s||0); if(s<60) return s?s+'s':'0m'; const h=Math.floor(s/3600), m=Math.floor(s%3600/60); return h?h+'h'+(m?' '+m+'m':''):m+'m'; };
/* the clock runs only while sound is playing; each second goes to the block of the word being played (a cue: the word after it), counted even if the session is never finished */
function lxTick(){ const now=performance.now(), dt=LX.lt?(now-LX.lt)/1000:0; LX.lt=now;
  if(!LX.on || LX.paused || LX.prep || dt<=0 || dt>90) return;
  LX.el+=dt; let ref=LX.steps[LX.i]; if(ref && ref.t!=='w') for(let k=LX.i+1;k<LX.steps.length;k++) if(LX.steps[k].t==='w'){ ref=LX.steps[k]; break; }
  if(ref && ref.t==='w'){ S.lxt[ref.x.bk]=(S.lxt[ref.x.bk]||0)+dt; S.lxlast[ref.x.bk]=Date.now(); }
  S.lxtot+=dt; const d=lxToday(); S.lxday[d]=(S.lxday[d]||0)+dt;
  lxStatSave(); lxPaintTime(); }
setInterval(lxTick,1000);
function lxPaintTime(){ const t=$('#lxT'); if(t) t.textContent=lxClock(LX.el)+(LX.runs?' · '+(LX.mode==='shuf'?'round ':'run ')+(LX.runs+1):'');
  const bt=$('#lbar .lbt'); if(bt) bt.textContent=lxClock(LX.el); lxPaintTotals(); }
function lxPaintTotals(){ const e=$('#lxTot'); if(e) e.innerHTML=lxTotHTML(); }
function lxTotHTML(){ return '<span>Listening</span><b>'+lxHM(S.lxtot)+'</b><small>total</small><b>'+lxHM(S.lxday[lxToday()]||0)+'</b><small>today</small>'; }
function lxPaint(){
  const s=LX.on?LX.steps[LX.i]:null, je=S.lxs.dir==='je';
  const w=s&&s.t==='w'?s.x:null;
  const nw=LX.steps.filter(x=>x.t==='w').length, dw=LX.on?LX.steps.slice(0,LX.i).filter(x=>x.t==='w').length:0;
  const p=$('#lxp');
  if(p){
    p.classList.toggle('paused',LX.paused);
    $('#lxLab').textContent=LX.label||'Starting';
    $('#lxStg').textContent=s?(s.t==='w'?s.stage:'·'):'';
    const showA = !!w, showB = !!w && LX.phase>=1;
    $('#lxW').textContent=w?w.w:''; $('#lxR').textContent=w&&w.r&&w.r!==w.w?w.r:''; $('#lxE').textContent=w?w.en:'';
    $('#lxW').classList.toggle('lxh',!(je?showA:showB)); $('#lxR').classList.toggle('lxh',!(je?showA:showB)); $('#lxE').classList.toggle('lxh',!(je?showB:showA));
    /* the set being played, laid out like a block of the word library: columns of 10, top to bottom, then left to right; the group being repeated and the word being said are marked */
    let ref=s; if(s && s.t!=='w') for(let k=LX.i+1;k<LX.steps.length;k++) if(LX.steps[k].t==='w'){ ref=LX.steps[k]; break; }
    const box=$('#lxSet');
    if(box && ref && ref.t==='w'){
      const all=ref.si<0, sts=all?LX.steps.sets:[LX.steps.sets[ref.si]].filter(Boolean), key=all?'all':ref.si;
      if(box.dataset.k!==String(key)){ box.dataset.k=key;
        const ws=[].concat(...sts.map(t=>{ const gm=new Map(); t.gr.forEach((g,gi)=>g.forEach(x=>gm.set(x,gi))); return t.full.map(x=>[x,gm.has(x)?gm.get(x):-1]); })), cols=Math.ceil(ws.length/10);
        box.style.setProperty('--cols',cols); box.style.setProperty('--rows',Math.min(10,ws.length));
        box.innerHTML=ws.map(([x,gi])=>'<span class="lxgw'+(x.skip?' lxskip':'')+'" lang="ja" data-k="'+x.k+'" data-g="'+gi+'" style="--len:'+Math.max(3,[...x.w].length)+'"'+(x.skip?' title="Permanently learned · skipped"':'')+'>'+esc(x.w)+'</span>').join(''); }
      const mix=ref.gi<0; box.classList.toggle('mix',mix);
      box.querySelectorAll('.lxgw').forEach(e=>{ e.classList.toggle('cur',!mix && +e.dataset.g===ref.gi); e.classList.toggle('now',!!w && +e.dataset.k===w.k); });
    } else if(box){ box.innerHTML=''; box.dataset.k=''; }
    $('#lxFill').style.width=(nw?dw/nw*100:0)+'%';
    lxPaintTime(); const pc=$('#lxPc'); if(pc) pc.textContent=dw+' / '+nw;
    /* the line the word comes from and its kanji, as on the lines page and the word card */
    if(w && LX.shownW!==w.w){ LX.shownW=w.w; const K=$('#lxK'), Ln=$('#lxL'); if(K) K.innerHTML=lxKanjiHTML(w.w); if(Ln) Ln.innerHTML=lxLineHTML(w.e,w.w); }
    const pb=$('#lxPP'); if(pb){ pb.innerHTML=LX.paused?ICO_LXP:ICO_LXPA; pb.setAttribute('aria-label',LX.paused?'Resume':'Pause'); pb.title=LX.paused?'Resume (space)':'Pause (space)'; }
  }
  const bar=$('#lbar');
  { const hb=$('#lxHd'); if(hb){ const cw=lxCurWord(), on=!!(cw && wbSt(cw.w).hj); hb.setAttribute('aria-pressed',String(on)); hb.classList.toggle('on',on); } }
  if(bar){ lxBarVis();
    if(!bar.hidden){ bar.querySelector('.lbw').textContent=w?w.w+'  ·  '+(LX.phase>=1||!je?w.en:''):(LX.label||''); bar.querySelector('.lbt').textContent=lxClock(LX.el);
      const pp=bar.querySelector('[data-lx="pp"]'); pp.innerHTML=LX.paused?ICO_LXP:ICO_LXPA; pp.setAttribute('aria-label',LX.paused?'Resume':'Pause'); } }
}
function lxLineHTML(e,word){
  if(!e) return '';
  if(!e.inst && S.wpend && S.wpend.get(word)===e && typeof prepWord==='function'){ try{ prepWord(e); }catch(_){} }
  const list=((e.inst&&e.inst.length)?e.inst:[e.first||e.src]).filter(Boolean); if(!list.length) return '';
  const lr=list.filter(x=>isLearnedLine(x.gid,x.n)), cand=lr.length?lr:list;
  let x=cand.find(y=>{ const L=lineOf(y.gid,y.n); return L && L.b.some(b=>wordsOf(b).some(z=>z.word===word && !z.part)); })||cand[0];
  const L=lineOf(x.gid,x.n); if(!L) return ''; const g=meta(x.gid);
  const hit=x.idx!=null&&typeof hitsFor==='function'?hitsFor(L,x.idx,x.len):null;
  return '<div class="cap2">From '+esc(g.short||'')+'</div><div class="lxline" data-gid="'+escA(x.gid)+'">'+lineHTML({id:x.gid},L,hit)+'</div>'; }
function renderListenIf(){ if(S.view==='words') renderLxPanel(); }
function lxNum(k,lab,min,max,step,hint){ return '<label class="lxf"><span>'+lab+(hint?'<small>'+hint+'</small>':'')+'</span><input type="number" inputmode="decimal" data-lxk="'+k+'" min="'+min+'" max="'+max+'" step="'+step+'" value="'+S.lxs[k]+'"></label>'; }
function lxSelOpt(k,lab,opts){ return '<label class="lxf"><span>'+lab+'</span><select data-lxk="'+k+'">'+opts.map(([v,t])=>'<option value="'+escA(v)+'"'+(String(S.lxs[k])===String(v)?' selected':'')+'>'+esc(t)+'</option>').join('')+'</select></label>'; }
