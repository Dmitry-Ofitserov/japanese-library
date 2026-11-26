/* ----- review tab: choose what to review ----- */
S.rv=Object.assign({take:{},src:[],dir:'both',lim:false,max:100,onlyDue:false,fr:'14'}, LS.get('rv.v2',{}));
function saveRv(){ const r=S.rv; LS.set('rv.v2',{take:r.take,src:r.src,dir:r.dir,lim:r.lim,max:r.max,onlyDue:r.onlyDue,fr:r.fr,bk:r.bk}); }
const KC={L:'#1cb0f6',W:'#58cc02',K:'#a560f5'}, KN={L:'Lines',W:'Words',K:'Kanji'};
function srcLabel(s){
  if(s.t==='ep'){ const g=meta(s.gid); return (g?g.short:s.gid)+' · '+['L','W','K'].filter(k=>s.k[k]).map(k=>KN[k].toLowerCase()).join(', '); }
  return KN[s.kind]+' #'+s.a+'–'+s.b;
}
const dirOk=key=>!(S.rv.dir==='f' && /\|b$/.test(key)) && !(S.rv.dir==='b' && /\|f$/.test(key));
/* overdue-ness relative to the card's own interval: the pile's order */
const odOf=(k,now)=>{ const st=stOf(k); return (now-due(st))/(ivDays(st.c)*DAY); };
function dueByKind(now){
  const r={L:[],W:[],K:[]}; if(!S.cat) return r;
  S.cat.forEach((it,key)=>{ if(dirOk(key) && due(stOf(key))<=now) r[it.kind].push(key); });
  ['L','W','K'].forEach(k=>r[k].sort((a,b)=>odOf(b,now)-odOf(a,now)));
  return r;
}
const takeOf=(k,n)=>{ const t=S.rv.take[k]; return t==null?n:Math.min(n,Math.max(0,t)); };
function srcKeys(s){
  const keys=[];
  if(s.t==='ep'){
    const d=S.data.get(s.gid); if(!d) return keys; const set=getLearned(s.gid), ws=new Set(), ks=new Set();
    d.lines.forEach(L=>{ if(!set.has(L.n)) return;
      if(s.k.L) keys.push('L|'+s.gid+':'+L.n+'|r');
      if(s.k.W) L.b.forEach(b=>wordsOf(b).forEach(x=>ws.add(x.word)));
      if(s.k.K){ const nt=nameTokens(L); L.tk.forEach((h,i)=>{ if(nt.has(i)) return; for(const ch of surf(h)) if(KJ.test(ch)) ks.add(ch); }); } });
    ws.forEach(w=>keys.push('W|'+w+'|f','W|'+w+'|b')); ks.forEach(k=>keys.push('K|'+k+'|f','K|'+k+'|b'));
  } else if(s.kind==='W'){ const byNo=new Map((S.words||[]).map(e=>[e.no,e])); for(let i=s.a;i<=s.b;i++){ const e=byNo.get(i); if(e) keys.push('W|'+e.word+'|f','W|'+e.word+'|b'); } }
  else (S.deck||[]).forEach(k=>{ if(k.frame>=s.a && k.frame<=s.b) keys.push('K|'+k.k+'|f','K|'+k.k+'|b'); });
  return keys;
}
/* the session pile: the chosen share of each kind's due cards (most overdue first) + every card of the added sources */
function poolKeys(){
  if(!S.cat) return [];
  const now=Date.now(), db=dueByKind(now), out=new Set(), bk=new Set(S.rv.bk===false?[]:[].concat(...S.bucket.map(bkKeys)));
  bk.forEach(x=>out.add(x));
  ['L','W','K'].forEach(k=>db[k].slice(0,takeOf(k,db[k].length)).forEach(x=>out.add(x)));
  S.rv.src.forEach(s=>srcKeys(s).forEach(k=>{ if(S.cat.has(k) && dirOk(k) && (!S.rv.onlyDue || due(stOf(k))<=now)) out.add(k); }));
  let keys=[...out];
  if(S.rv.lim && S.rv.max>0 && keys.length>S.rv.max){ keys.sort((a,b)=>(bk.has(b)-bk.has(a))||odOf(b,now)-odOf(a,now)); keys=keys.slice(0,S.rv.max); }
  return keys;
}
function pileText(keys){
  const c={L:0,W:0,K:0}; keys.forEach(k=>c[k[0]]++);
  return ['L','W','K'].filter(k=>c[k]).map(k=>c[k]+' '+KN[k].toLowerCase()).join(' · ');
}
/* due-forecast chart: stacked cards per day (per week for a year) */
function forecastHTML(){
  const fr=S.rv.fr, days=fr==='365'?364:+fr, wk=fr==='365', nb=wk?52:days, t0d=startOfDay(Date.now()), end0=t0d+DAY;
  const b=Array.from({length:nb},()=>({L:0,W:0,K:0}));
  S.cat.forEach((it,key)=>{ const d=due(stOf(key)); let i=d<end0?0:Math.floor((startOfDay(d)-t0d)/DAY); if(wk) i=Math.floor(i/7); if(i<nb) b[i][it.kind]++; });
  /* a block's cards in the round it comes due (easy words only in their rounds) */
  [['W',wbBlocks()],['K',kbBlocks()]].forEach(([kd,bl])=>bl.forEach(k=>{ if(!k.act || k.due==null) return; let i=Math.max(0,k.due-today()); if(wk) i=Math.floor(i/7); if(i<nb) b[i][kd]+=k.tot; }));
  const mx=Math.max(1,...b.map(x=>x.L+x.W+x.K));
  const lab=i=>{ const d=new Date(t0d+i*(wk?7:1)*DAY); return String(d.getDate()).padStart(2,'0')+':'+String(d.getMonth()+1).padStart(2,'0'); };
  const every=nb<=31?1:Math.ceil(nb/31), vert=nb>7;
  const cw=((view.clientWidth||innerWidth)-32)/nb, wide=nb<=30 && cw>=6.3*String(Math.max(...b.map(x=>Math.max(x.L,x.W,x.K)))).length+3;
  const nums='<div class="fcn'+(wide?'':' v')+'">'+b.map(x=>{ const t=x.L+x.W+x.K;
    return '<span>'+(wide?['L','W','K'].map(k=>'<b style="color:'+(x[k]?KC[k]:'var(--muted)')+(x[k]?'':';opacity:.5')+'">'+x[k]+'</b>').join(''):(t?'<b>'+t+'</b>':''))+'</span>'; }).join('')+'</div>';
  return nums+'<div class="fc" role="img" aria-label="Cards coming due">'+b.map((x,i)=>{ const t=x.L+x.W+x.K;
      return '<div class="fcb" title="'+escA(lab(i)+(i===0?' (incl. overdue)':'')+': '+t+' cards · '+x.L+' lines · '+x.W+' words · '+x.K+' kanji')+'">'+
        ['L','W','K'].map(k=>x[k]?'<i style="height:'+(100*x[k]/mx).toFixed(2)+'%;background:'+KC[k]+'"></i>':'').join('')+'</div>'; }).join('')+
      '<span class="fcmax">'+mx+'</span></div>'+
    '<div class="fcx'+(vert?' v':'')+'">'+b.map((x,i)=>'<span>'+(i%every===0?esc(lab(i)):'')+'</span>').join('')+'</div>';
}
function renderReview(){
  view.dataset.gid='';
  if(S.sess){ renderCard(); return; }
  if(!S.cat){ view.innerHTML='<div class="empty">Loading…</div>'; derive(); return; }
  const now=Date.now(), dir=S.rv.dir;
  /* compact table: due now by direction, coming within a day, started */
  const t={}; ['L','W','K'].forEach(k=>t[k]={f:0,b:0,r:0,soon:0,all:0});
  S.cat.forEach((it,key)=>{ const d=due(stOf(key)), x=t[it.kind]; x.all++; if(d<=now) x[it.dir]++; else if(d<=now+DAY) x.soon++; });
  const db=dueByKind(now), eps=groupOrder().filter(g=>getLearned(g.id).size);
  const row=k=>{ const x=t[k], dn=x.f+x.b+x.r;
    return '<tr><th><i class="kd" style="background:'+KC[k]+'"></i>'+KN[k]+'</th><td class="n">'+dn+'</td>'+
      (k==='L'?'<td>'+x.r+'</td><td class="mut">—</td>':'<td>'+x.f+'</td><td>'+x.b+'</td>')+'<td class="mut">+'+x.soon+'</td><td class="mut">'+x.all+'</td></tr>'; };
  const sld=k=>{ const n=db[k].length, v=takeOf(k,n);
    return '<label class="sl"><span class="sll"><i class="kd" style="background:'+KC[k]+'"></i>'+KN[k]+'</span><input type="range" min="0" max="'+n+'" value="'+v+'" data-take="'+k+'"'+(n?'':' disabled')+' style="--kc:'+KC[k]+'"><output data-tv="'+k+'">'+v+' / '+n+'</output></label>'; };
  const nTot={W:(S.words||[]).length, K:(S.deck||[]).length};
  const pool=poolKeys();
  view.innerHTML='<section class="rv">'+wbSectionHTML()+kbSectionHTML()+
    '<table class="rvt"><thead><tr><th></th><th class="n">Due</th><th title="Japanese → meaning">JP → meaning</th><th title="Meaning → Japanese">meaning → JP</th><th>next 24h</th><th>started</th></tr></thead><tbody>'+row('L')+'</tbody></table>'+
    '<div class="rvsec"><div class="rvsh"><h2>Coming due</h2><div class="seg" role="group" aria-label="Range">'+[['7','7 days'],['14','14 days'],['30','30 days'],['91','3 months'],['365','1 year']].map(([v,l])=>'<button data-fr="'+v+'" aria-pressed="'+(S.rv.fr===v)+'">'+l+'</button>').join('')+'</div></div>'+forecastHTML()+
      '<div class="fcl">'+['L','W','K'].map(k=>'<span><i class="kd" style="background:'+KC[k]+'"></i>'+KN[k]+'</span>').join('')+'<span class="mut">first bar includes overdue cards</span></div></div>'+
    '<div class="rvsec"><h2>Session</h2>'+
      '<div class="rvrow"><span class="rvh">Cards</span><div class="seg" role="group" aria-label="Directions">'+[['both','Both directions'],['f','JP → meaning'],['b','Meaning → JP']].map(([v,l])=>'<button data-dir="'+v+'" aria-pressed="'+(dir===v)+'">'+l+'</button>').join('')+'</div></div>'+
      '<div class="rvrow top"><span class="rvh">Bucket<small>picked by you · always in</small></span><div class="rvchips">'+(S.bucket.length?
        S.bucket.map(id=>{ const n=bkKeys(id).length; return '<span class="rchip bkc'+(n?'':' off')+'" title="'+(n?'Review card':'No review card yet (not learned)')+'">'+(id[0]==='L'?esc(bkLabel(id)):'<span lang="ja">'+esc(bkLabel(id))+'</span>')+(n?'':' · not learned')+'<button data-bkrm="'+escA(id)+'" aria-label="Take out of the bucket">×</button></span>'; }).join('')+
        '<label class="chipc"><input type="checkbox" id="rvBk"'+(S.rv.bk===false?'':' checked')+'> include</label><button class="btn" data-a="rv-bkclear">Empty</button>'
        :'<span class="mut">Empty. Tap a tray button on a line, or the JP / EN tray buttons on a word or kanji, to put that card here. A card leaves the bucket once you remember it in a session.</span>')+'</div></div>'+
      '<div class="rvrow top"><span class="rvh">Due cards<small>most overdue first</small></span><div class="sls">'+sld('L')+'</div></div>'+
      '<div class="rvrow"><span class="rvh">Add an episode</span><select id="rvEp" aria-label="Episode">'+eps.map(g=>'<option value="'+g.id+'">'+esc(g.title)+' · '+getLearned(g.id).size+' learned lines</option>').join('')+'</select>'+
        ['L'].map(k=>'<label class="chipc"><input type="checkbox" class="rvek" value="'+k+'" checked> '+KN[k]+'</label>').join('')+'<button class="btn" data-a="rv-ep">Add</button></div>'+
      (S.rv.src.length?'<div class="rvrow"><span class="rvh">Added</span><div class="rvchips">'+S.rv.src.map((s,i)=>{ const n=srcKeys(s).filter(k=>S.cat.has(k)&&dirOk(k)).length; return '<span class="rchip">'+esc(srcLabel(s))+' · '+n+' cards<button data-rm="'+i+'" aria-label="Remove">×</button></span>'; }).join('')+
        '<label class="chipc"><input type="checkbox" id="rvOnly"'+(S.rv.onlyDue?' checked':'')+'> only their due cards</label></div></div>':'')+
      '<div class="rvrow"><span class="rvh">Limit</span><label class="chipc"><input type="checkbox" id="rvLim"'+(S.rv.lim?' checked':'')+'> at most</label><input type="number" id="rvMax" min="1" value="'+(S.rv.max||100)+'" aria-label="Maximum cards"'+(S.rv.lim?'':' disabled')+'><span class="mut">cards, most overdue first</span></div>'+
      '<div class="rvgo"><button class="btn pri" data-a="rv-start"'+(pool.length?'':' disabled')+'>Start · <span id="rvN">'+pool.length+'</span> cards</button><span class="mut" id="rvMix">'+esc(pileText(pool))+'</span></div>'+
    '</div>'+
    '<p class="hint">Cards that aren’t due yet still count when you review them, but only by the share of the interval that has passed. Reviews sync through the shared store, so your phone and computer see the same counts.</p>'+
  '</section>';
}
/* slider moves and limit edits update the start button without redrawing the page */
function updateStart(){
  const pool=poolKeys(), n=$('#rvN'), m=$('#rvMix'), b=view.querySelector('[data-a="rv-start"]');
  if(n) n.textContent=pool.length; if(m) m.textContent=pileText(pool); if(b) b.disabled=!pool.length;
}

/* ----- session ----- */
const PLAYRV=PLAY('1').replace('class="play"','class="play rvplay"');
const sibling=k=>k.replace(/\|(f|b)$/,m=>m==='|f'?'|b':'|f');
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
/* keep the two directions of one word/kanji at least 10 cards apart */
function spaceOut(q){
  const res=[], pend=q.slice();
  while(pend.length){
    let pick=0;
    for(let i=0;i<pend.length && i<400;i++){ const sb=sibling(pend[i]); if(sb===pend[i] || !res.slice(-10).includes(sb)){ pick=i; break; } }
    res.push(pend.splice(pick,1)[0]);
  }
  return res;
}
function startSession(){
  const keys=poolKeys(); if(!keys.length) return;
  S.sess={keys:new Set(keys), q:spaceOut(shuffle(keys)), i:0, shown:false, seen:new Set(), ok:0, bad:0, again:0, total:keys.length};
  renderCard();
}
/* the answer side reuses the word card, kanji sheet and line layouts */
function kanjiInfoHTML(k){
  const rd=(k.on||k.kun)?'<div class="km">'+(k.frame?'#'+k.frame+' · ':'')+(k.on?'音 '+esc(k.on):'')+(k.on&&k.kun&&k.kun!=='—'?' · ':'')+(k.kun&&k.kun!=='—'?'訓 '+esc(k.kun):'')+'</div>':'';
  const ws=[...allWordMap().values()].filter(w=>w.word.includes(k.k)).sort((a,b)=>b.learned-a.learned), occ=S.kocc.get(k.k)||[];
  return rd+'<div class="story">'+esc(k.story||'No mnemonic story in your sheet yet.')+'</div>'+
    (ws.length?'<div class="cap2">In '+ws.length+' word'+(ws.length===1?'':'s')+'</div><div class="kws">'+ws.slice(0,6).map(kwRow).join('')+'</div>':'')+
    (occ.length?'<div class="cap2">In '+occ.length+' line'+(occ.length===1?'':'s')+(occ.length>3?' · first 3':'')+'</div>'+occ.slice(0,3).map(o=>ksnip(o,k.k)).join(''):'');
}
function wordInfoHTML(e){
  return wordMeans(e)+formsBox(e)+examplesBox(e,true);
}
function cardSides(key){
  const it=S.cat.get(key)||S.wcat.get(key); if(!it) return null;
  if(it.kind==='L'){
    const L=lineOf(it.gid,it.n), g=meta(it.gid); if(!L) return null;
    return { tag:g.short+' · '+(L.id||L.n)+(L.ts?' · '+L.ts.replace(/\.\d+$/,''):''), front:'<div class="jp rvjp" lang="ja">'+jpHTML(L)+'</div><div class="rvq">What does it mean?</div>',
      back:'<div class="body rvline">'+(L.t?'<div class="tr">'+esc(L.t)+'</div>':'')+'<div class="panel"><ul>'+L.b.map(bulletHTML).join('')+'</ul>'+(L.l?'<div class="lit">'+esc(L.l)+'</div>':'')+'</div></div>', play:{line:L} };
  }
  if(it.kind==='W'){
    const e=it.w, head='<div class="wsh rvwh">'+wordHead(e,true)+'</div>'+kanjiStrip(e.word)+partsStrip(e.word);
    return it.dir==='f'
      ? { tag:'JP → meaning', front:'<div class="rvbig" lang="ja">'+furi(e.word,e.reading)+'</div>', back:head+wordInfoHTML(e), play:{word:e} }
      : { tag:'meaning → JP', front:'<div class="rvm big">'+esc(lxEn(e))+'</div><div class="rvq">Say or write it in Japanese</div>', back:head+wordInfoHTML(e), play:{word:e,back:true} };
  }
  const k=it.k, info='<div class="kh"><div class="kbig" lang="ja">'+esc(k.k)+'</div><div><div class="kt">'+esc(k.kw||'—')+'</div></div></div>'+kanjiInfoHTML(k);
  return it.dir==='f'
    ? { tag:'Kanji #'+k.frame+' · kanji → keyword', front:'<div class="rvk" lang="ja">'+esc(k.k)+'</div>', back:info }
    : { tag:'Kanji #'+k.frame+' · keyword → kanji', front:'<div class="rvm big">'+esc(k.kw||'—')+'</div><div class="rvq">Write the kanji</div>', back:info };
}
function preview(key,ok){
  const st=stOf(key), now=Date.now();
  if(!ok){ const nd=now+7*DAY; return due(st)>nd ? 'back within 7d' : 'count stays '+fmtCnt(st.c); }
  const g=Math.min(1,Math.max(0,now-st.l)/(ivDays(st.c)*DAY)), c=addGain(st.c,g);
  return fmtCnt(st.c)+' → '+fmtCnt(c)+' · next in '+fmtDur(ivDays(c)*DAY);
}
/* review screen: the previous card on the left (with its answer and an "oops" undo), the current card on the right */
const RVI={
  show:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  yes:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
  no:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>',
  inst:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 12.5l4 4L15 8"/><path d="M11 16.5l1 1L21.5 8"/></svg>',
  oops:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>',
  end:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
  vol:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
  mute:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>'
};
const rvB=(a,ico,cls,title,kbd)=>'<button class="rvib '+cls+'" data-a="'+a+'" title="'+escA(title)+'" aria-label="'+escA(title)+'">'+ico+(kbd?'<kbd>'+kbd+'</kbd>':'')+'</button>';
/* time per word: all time spent ÷ words answered right (a word missed and still coming back adds time, not a word) */
const RVCAP=10000;
function rvSpeed(s){
  const bn=s.b?s.b.items.filter(x=>x.vote==='y'&&!x.perm).length:0;
  const n=(s.wd?s.wd.size:0)+bn, per=n?s.act/n:0, last=(s.rec||[]).slice(-50), l50=last.length?last.reduce((a,k)=>a+(s.wd.get(k)||0),0)/last.length:0;
  const left=s.grid?rgLeft(s):Math.max(0,s.q.length-s.i), eta=per*left;
  return {n,per,l50,left,eta};
}
function rvStatHTML(s){
  const v=rvSpeed(s), f=ms=>(ms/1000).toFixed(2)+' s';
  return '<div class="rvstat"><span class="rvtime" title="Time in this session (at most 10 s counted per card view)">⏱ <b>'+lxClock((s.act||0)/1000)+'</b></span>'+
    '<span title="All time spent ÷ '+(s.kind==='K'?'kanji':'words')+' answered right">per '+(s.kind==='K'?'kanji':'word')+' <b>'+(v.n?f(v.per):'–')+'</b></span>'+
    '<span title="Average of the last 50 '+(s.kind==='K'?'kanji':'words')+' answered right">last 50 <b>'+(v.n?f(v.l50):'–')+'</b></span>'+
    '<span title="Cards left × time per word">left <b>'+(v.n?lxClock(v.eta/1000):'–')+'</b></span>'+
    '<span><b>'+v.n+'</b> done</span></div>';
}
function rvPrevHTML(s){
  const p=s.prev, pv=p&&cardBrief(p.key);
  if(!pv) return '<div class="rvprv empty"><span class="rvpl">Previous</span><div class="rvq">The card you just answered shows here, with its answer.</div></div>';
  const st=p.oops?'pno':p.ok?'pok':'pno', lab=p.oops?'oops · back in the pile':p.inst?'instant':p.ok?'remembered':'forgot · back in the pile';
  return '<div class="rvprv '+st+'"><span class="rvpl">'+esc(lab)+'</span><div class="rvpf">'+pv.f+'</div><div class="rvpb">'+pv.b+'</div>'+
    (p.ok&&!p.oops?rvB('rv-oops',RVI.oops,'oops','Oops, I was wrong: send it back to the pile','0'):'')+'</div>';
}
function renderCard(){
  const s=S.sess; if(!s) return;
  if(s.grid){ rgRender(); return; }
  while(s.i<s.q.length && !cardSides(s.q[s.i])) s.i++;
  if(s.i>=s.q.length){
    /* the last card: keep the previous panel up so an instant answer can still be taken back */
    if(s.prev && s.prev.ok && !s.prev.oops && !s.fin){
      view.innerHTML='<section class="rvcard rv2"><div class="rvtop"><span class="rvp">0 left</span>'+rvBar(s)+rvB('rv-quit',RVI.end,'rvend','End the session','')+'</div>'+rvCnt(s)+rvStatHTML(s)+
        '<div class="rvgrid">'+rvPrevHTML(s)+'<div class="rvcur"><div class="rvbtns one"><button class="btn pri rvfin" data-a="rv-fin">Finish <kbd>Space</kbd></button></div><div class="rvc"><div class="rvf"><div class="rvq">That was the last card. Take it back with the button on the left, or finish.</div></div></div></div></div></section>';
      return; }
    finishSession(); return; }
  const key=s.q[s.i], c=cardSides(key), first=!s.seen.has(key), it=S.cat.get(key)||S.wcat.get(key), WB=(it.kind==='W'||it.kind==='K')&&!!s.wb, st=WB?null:stOf(key), late=WB?0:Date.now()-due(st), rid=ridOf(it);
  if(s.tStart==null){ s.tStart=performance.now(); s.views=(s.views||0)+1; }
  const flags=(it.kind==='W'||it.kind==='K')?'<span class="rvflags">'+
      '<button class="rvfl'+(easyOf(rid)?' on':'')+'" data-a="rv-easy" aria-pressed="'+easyOf(rid)+'" title="'+(easyOf(rid)?'Easy: reviewed every third round · tap to review it every round':'Easy: review it only every third round')+'">'+ICO_EASY+'</button>'+
      '<button class="rvfl" data-a="rv-perm" title="I will never forget this '+(it.kind==='K'?'kanji':'word')+': stop reviewing it forever">∞</button></span>':'';
  const tagR=WB?esc(wbTagR(it,first)):(st.nw?'new':'count '+fmtCnt(st.c)+(first?(late>=0?' · due':' · early'):' · again'));
  const btns=s.shown
    ? '<div class="rvbtns two">'+rvB('rv-no',RVI.no,'bad','Forgot: back in the pile','1')+rvB('rv-yes',RVI.yes,'good','Remembered','2')+'</div>'
    : '<div class="rvbtns">'+rvB('rv-dont',RVI.no,'bad','Don’t remember: back in the pile','1')+rvB('rv-show',RVI.show,'pri','Show the answer','Space')+rvB('rv-inst',RVI.inst,'good','Knew it instantly','3')+'</div>';
  view.innerHTML='<section class="rvcard rv2"><div class="rvtop"><span class="rvp">'+(s.q.length-s.i)+' left</span>'+rvBar(s)+
      (it.kind==='W'&&WB?rvB('rv-voice',S.rvVoice?RVI.vol:RVI.mute,'rvvo'+(S.rvVoice?' on':''),S.rvVoice?'Voice on: the word is read aloud':'Voice off',''):'')+rvB('rv-quit',RVI.end,'rvend','End the session','')+'</div>'+rvCnt(s)+rvStatHTML(s)+
    '<div class="rvgrid">'+rvPrevHTML(s)+
      '<div class="rvcur">'+btns+'<div class="rvc '+it.kind.toLowerCase()+'"><div class="rvtag"><span>'+esc(c.tag)+'</span>'+flags+'<span>'+tagR+'</span></div>'+
        '<div class="rvf">'+c.front+(c.play && (c.play.line || (c.play.word && !c.play.back))?PLAYRV:'')+'</div>'+
        (s.shown?'<div class="rvb">'+c.back+(c.play && c.play.back?PLAYRV:'')+'</div>':'')+
      '</div></div></div>'+
  '</section>';
  /* the word itself is read aloud: with the question when the Japanese is shown, with the answer when the English is */
  if(WB && it.kind==='W' && S.rvVoice && ((it.dir==='f' && !s.shown) || (it.dir==='b' && s.shown))){ const tag=key+':'+s.shown+':'+s.views; if(s.said!==tag){ s.said=tag; rvSay(it.id); } }
}
/* session bar: every card of the session once — remembered first time, remembered after a miss, missed and still coming back */
function rvBar(s){
  const c={ok:0,late:0,pend:0}; (s.res||new Map()).forEach(v=>c[v]++); const T=Math.max(1,s.total), w=n=>(100*n/T).toFixed(2)+'%';
  return '<div class="rvbar" title="'+c.ok+' remembered · '+c.late+' remembered after a miss · '+c.pend+' missed, coming back · '+(s.total-c.ok-c.late-c.pend)+' not seen yet"><i class="rok" style="width:'+w(c.ok)+'"></i><i class="rlate" style="width:'+w(c.late)+'"></i><i class="rpend" style="width:'+w(c.pend)+'"></i></div>';
}
function rvCnt(s){
  const c={ok:0,late:0,pend:0}; (s.res||new Map()).forEach(v=>c[v]++);
  return '<div class="rvcnt"><span><i class="rok"></i><b>'+c.ok+'</b> remembered</span><span><i class="rlate"></i><b>'+c.late+'</b> after a miss</span><span><i class="rpend"></i><b>'+c.pend+'</b> coming back</span><span><i></i><b>'+(s.total-c.ok-c.late-c.pend)+'</b> not seen</span></div>';
}
/* a missed card goes back 11–80 cards ahead; with fewer than 20 left, anywhere from halfway to the end */
function requeue(s,key,base){
  const rem=Math.max(0,s.q.length-base); let lo,hi;
  if(rem<20){ lo=Math.floor(rem/2)+1; hi=rem+1; } else { lo=11; hi=Math.min(80,rem+1); }
  const k=lo+Math.floor(Math.random()*(hi-lo+1)); s.q.splice(base+k-1,0,key);
}
/* a card view's time, at most 10 s; the word's total grows over all its views */
function rvTiming(s,key){
  const ms=s.tStart==null?0:Math.min(RVCAP,performance.now()-s.tStart); s.tStart=null; s.act=(s.act||0)+ms;
  s.tw=s.tw||new Map(); s.tw.set(key,(s.tw.get(key)||0)+ms);
  const it=S.cat.get(key)||S.wcat.get(key); if(it && (it.kind==='W'||it.kind==='K')) rvTimeAdd(ridOf(it),ms);
}
function rvDone(s,key,ok){ s.wd=s.wd||new Map(); s.rec=s.rec||[]; if(ok){ s.wd.set(key,s.tw.get(key)||0); s.rec.push(key); } }
/* ok: remembered · inst: "knew it instantly" (no answer shown) · !ok before the answer: "don't remember" */
function answer(ok,inst){
  const s=S.sess; if(!s || s.i>=s.q.length || (!s.shown && ok && !inst)) return;
  const key=s.q[s.i], first=!s.seen.has(key), it=S.cat.get(key)||S.wcat.get(key);
  rvTiming(s,key);
  const p={key,ok,inst:!!inst,first,oops:false};
  if(s.wb && (key[0]==='W'||key[0]==='K')){ p.wb=1; p.hard0=!!wbSt(ridOf(it))[it.dir==='b'?'he':'hj']; wbAnswer(s,key,ok); }
  else {
    s.seen.add(key);
    s.res=s.res||new Map(); s.res.set(key, ok?(first?'ok':'late'):'pend');
    if(ok && inBucket(key)){ S.bucket=S.bucket.filter(x=>x!==key); saveBucket(); p.bk=1; }
    p.st0=Object.assign({},stOf(key)); p.raw=S.srs.has(key)?Object.assign({},S.srs.get(key)):null;
    if(first){
      const st=Object.assign({},stOf(key)), now=Date.now();
      if(st.nw){ saveCard(key,{c:ok?1:0,l:now,n:1,f:ok?0:1}); kStarted(key); if(ok) s.ok++; else s.bad++; }
      else if(ok){ const g=Math.min(1,Math.max(0,now-st.l)/(ivDays(st.c)*DAY)); saveCard(key,{c:addGain(st.c,g),l:now,n:(st.n||0)+1,f:st.f||0}); s.ok++; }
      else { cardFail(key,st); s.bad++; }
    } else if(!ok) s.again++;
    else { /* remembered later in the same session after a miss: +0.5 and the interval restarts from now */
      const st=stOf(key), now=Date.now(); saveCard(key,{c:+((st.c||0)+0.5).toFixed(4),l:now,n:(st.n||0)+1,f:st.f||0}); }
    s.q.splice(s.i,1);
    if(!ok) requeue(s,key,s.i);
  }
  rvDone(s,key,ok);
  s.prev=p; s.shown=false; srsBadge(); renderCard();
}
function cardFail(key,st){ const now=Date.now(), nd=now+7*DAY, ns={c:st.c,l:st.l,n:(st.n||0)+1,f:(st.f||0)+1}; const dd=Math.min(st.d||Infinity, due({c:st.c,l:st.l})>nd?nd:Infinity); if(isFinite(dd)) ns.d=dd; saveCard(key,ns); }
/* the previous card was answered as remembered, but its answer shows it was wrong: count it as a miss and send it back */
function rvOops(){
  const s=S.sess, p=s&&s.prev; if(!p || !p.ok || p.oops) return;
  p.oops=true; const key=p.key, it=S.cat.get(key)||S.wcat.get(key);
  s.res.set(key,'pend'); if(p.first){ s.ok=Math.max(0,s.ok-1); s.bad++; } else s.again++;
  if(s.wd) s.wd.delete(key); if(s.rec) s.rec=s.rec.filter(k=>k!==key);
  if(p.wb){ const w=ridOf(it); if(p.first) wbSetHard(w,it.dir,true); if(easyOf(w)) setEasy(w,false,true); }
  else {
    if(p.bk && !inBucket(key)){ S.bucket=S.bucket.concat(key); saveBucket(); }
    if(p.first){ const st=p.st0; if(st.nw) saveCard(key,{c:0,l:Date.now(),n:1,f:1}); else cardFail(key,st); }
    else if(p.raw) saveCard(key,Object.assign({},p.raw));
  }
  requeue(s,key,s.i<s.q.length?s.i+1:s.i);
  srsBadge(); renderCard();
}
