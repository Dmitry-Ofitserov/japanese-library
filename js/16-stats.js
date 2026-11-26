/* ---------- stats graph ---------- */
const GC={lines:'#e8833a',words:'#3fae37',kanji:'#a560f5'}, GN={lines:'Lines',words:'Words',kanji:'Kanji'};
S.g = Object.assign({range:'30',mode:'cum',scale:'own'}, LS.get('gopt',{}));
function dayList(n){ const a=[], d=new Date(startOfDay(Date.now())); d.setDate(d.getDate()-(n-1)); for(let i=0;i<n;i++){ a.push(d.getTime()); d.setDate(d.getDate()+1); } return a; }
function seriesFor(times,baseline,days){
  const per=new Array(days.length).fill(0), idx=new Map(days.map((d,i)=>[dkey(d),i])); let before=0;
  times.forEach(t=>{ const k=dkey(t); if(idx.has(k)) per[idx.get(k)]++; else if(t<days[0]) before++; });
  let c=baseline+before; const cum=per.map(n=>(c+=n)); return {per,cum};
}
function graphModel(ev,tot){
  let n; const all=[...ev.lines,...ev.words,...ev.kanji];
  if(S.g.range==='all'){ const first=all.length?Math.min(...all):Date.now(); n=Math.max(14,Math.round((startOfDay(Date.now())-startOfDay(first))/DAY)+1); } else n=+S.g.range;
  const days=dayList(n), m={days,n,s:{}};
  ['lines','words','kanji'].forEach(k=>{ m.s[k]=seriesFor(ev[k],tot[k]-ev[k].length,days); });
  return m;
}
function graphHTML(m){
  const W=480,H=230,pl=10,pr=10,pt=10,pb=22,iw=W-pl-pr,ih=H-pt-pb, step=m.n>1?iw/(m.n-1):0;
  const src=k=>S.g.mode==='cum'?m.s[k].cum:m.s[k].per;
  let gmax=1; ['lines','words','kanji'].forEach(k=>{ gmax=Math.max(gmax,...src(k)); });
  const norm={}; ['lines','words','kanji'].forEach(k=>{
    const a=src(k), mx=Math.max(...a), mn=Math.min(...a);
    norm[k]=a.map(v=> S.g.scale==='shared' ? v/gmax : (S.g.mode==='cum' ? (mx===mn?0.5:(v-mn)/(mx-mn)) : (mx?v/mx:0)));
  });
  m.norm=norm; m.geo={W,H,pl,pr,pt,pb,iw,ih,step};
  const X=i=>pl+i*step, Y=v=>pt+(1-v)*ih;
  let grid=''; for(let i=0;i<=4;i++){ const y=pt+ih*i/4; grid+='<line x1="'+pl+'" x2="'+(W-pr)+'" y1="'+y+'" y2="'+y+'" class="gl"/>'; if(S.g.scale==='shared') grid+='<text x="'+(pl+2)+'" y="'+(y-3)+'" class="gt">'+Math.round(gmax*(1-i/4))+'</text>'; }
  let xt=''; const nt=Math.min(5,m.n); for(let i=0;i<nt;i++){ const k=Math.round(i*(m.n-1)/(nt-1||1)); xt+='<text x="'+X(k)+'" y="'+(H-6)+'" class="gt" text-anchor="'+(i===0?'start':i===nt-1?'end':'middle')+'">'+fmtDate(m.days[k])+'</text>'; }
  const lines=['lines','words','kanji'].map(k=>'<polyline fill="none" stroke="'+GC[k]+'" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" points="'+norm[k].map((v,i)=>X(i).toFixed(1)+','+Y(v).toFixed(1)).join(' ')+'"/>'+
    '<circle cx="'+X(m.n-1)+'" cy="'+Y(norm[k][m.n-1]).toFixed(1)+'" r="3.5" fill="'+GC[k]+'"/>').join('');
  const seg=(key,opts)=>'<div class="seg" role="group">'+opts.map(([v,l])=>'<button data-gk="'+key+'" data-gv="'+v+'" aria-pressed="'+(S.g[key]===v)+'">'+l+'</button>').join('')+'</div>';
  const legend=['lines','words','kanji'].map(k=>{ const a=m.s[k], gain=a.per.reduce((x,y)=>x+y,0); return '<span class="lg"><i style="background:'+GC[k]+'"></i><b>'+GN[k]+'</b> '+a.cum[m.n-1]+' <small>+'+gain+' in range</small></span>'; }).join('');
  return '<section class="gr"><div class="grh"><div class="legend">'+legend+'</div><div class="ctl">'+seg('range',[['14','14d'],['30','30d'],['90','90d'],['all','All']])+seg('mode',[['cum','Total'],['day','Per day']])+seg('scale',[['own','Own scale'],['shared','Shared']])+'</div></div>'+
    '<div class="gw"><svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Lines, words and kanji learned over time">'+grid+xt+lines+'<line id="gg" class="gg" y1="'+pt+'" y2="'+(H-pb)+'" x1="0" x2="0" hidden/><rect id="gov" x="'+pl+'" y="0" width="'+iw+'" height="'+H+'" fill="transparent"/></svg><div id="gtip" class="gtip" hidden></div></div>'+
    '<p class="hint">'+(S.g.scale==='own'?'Each line is scaled to its own range so all three are readable together; hover for real numbers.':'All three share one axis, so lines learned in the hundreds stay small next to kanji.')+(S.g.mode==='cum'?' Totals include everything learned before tracking began.':'')+'</p></section>';
}
function bindGraph(m){
  const svg=view.querySelector('.gw svg'), ov=$('#gov'), gg=$('#gg'), tip=$('#gtip'); if(!svg) return;
  const {W,pl,iw,step}=m.geo;
  const move=e=>{
    const r=svg.getBoundingClientRect(), x=(e.clientX-r.left)/r.width*W;
    const i=Math.max(0,Math.min(m.n-1,Math.round((x-pl)/(step||1)))), px=pl+i*step;
    gg.hidden=false; gg.setAttribute('x1',px); gg.setAttribute('x2',px);
    tip.innerHTML='<div class="gd">'+new Date(m.days[i]).toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short'})+'</div>'+
      ['lines','words','kanji'].map(k=>'<div><i style="background:'+GC[k]+'"></i>'+GN[k]+' <b>'+m.s[k].cum[i]+'</b> <small>'+(m.s[k].per[i]?'+'+m.s[k].per[i]:'')+'</small></div>').join('');
    tip.hidden=false; const w=svg.parentNode.getBoundingClientRect().width, tx=px/W*r.width;
    tip.style.left=Math.min(Math.max(tx-55,0),w-120)+'px';
  };
  ov.addEventListener('pointermove',move); ov.addEventListener('pointerdown',move);
  ov.addEventListener('pointerleave',()=>{ gg.hidden=true; tip.hidden=true; });
}
view.addEventListener('click',e=>{
  const b=e.target.closest('[data-gk]'); if(!b||S.view!=='stats') return;
  S.g[b.dataset.gk]=b.dataset.gv; LS.set('gopt',S.g); renderStats();
});

/* ---------- stats ---------- */
function heat(label,times,cls,unit){
  const WEEKS=26, t0=startOfDay(Date.now()), counts=new Map();
  times.forEach(t=>{ const k=dkey(t); counts.set(k,(counts.get(k)||0)+1); });
  const max=Math.max(1,...counts.values());
  const first=new Date(t0); first.setDate(first.getDate()-((first.getDay()+6)%7)-(WEEKS-1)*7);
  let months='', cells='', last=-1;
  for(let w=0;w<WEEKS;w++){
    const d0=new Date(first); d0.setDate(d0.getDate()+w*7);
    if(d0.getMonth()!==last){ last=d0.getMonth(); months+='<span class="ml" style="grid-column:'+(w+2)+'">'+d0.toLocaleDateString(undefined,{month:'short'})+'</span>'; }
    for(let d=0;d<7;d++){
      const dt=new Date(first); dt.setDate(dt.getDate()+w*7+d); if(dt.getTime()>t0) continue;
      const c=counts.get(dkey(dt))||0, lv=c?Math.min(4,Math.ceil(4*c/max)):0;
      cells+='<i class="hc l'+lv+'" style="grid-column:'+(w+2)+';grid-row:'+(d+2)+'" title="'+c+' '+unit+' · '+dt.toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short',year:'numeric'})+'"></i>';
    }
  }
  const today=counts.get(dkey(t0))||0; let wk=0; for(let i=0;i<7;i++) wk+=counts.get(dkey(t0-i*DAY))||0;
  let best=0,bestK=''; counts.forEach((c,k)=>{ if(c>best){ best=c; bestK=k; } });
  let streak=0, d=counts.has(dkey(t0))?t0:t0-DAY; while(counts.has(dkey(d))){ streak++; d-=DAY; }
  const rate=paceOf(times);
  return '<section class="hm '+cls+'"><h3>'+label+' <span>'+times.length+' tracked</span></h3><div class="hwrap"><div class="heat"><span class="wl" style="grid-row:2">Mon</span><span class="wl" style="grid-row:4">Wed</span><span class="wl" style="grid-row:6">Fri</span>'+months+cells+'</div></div>'+
    '<div class="hs"><span><b>'+today+'</b> today</span><span><b>'+wk+'</b> last 7 days</span><span><b>'+(best||'–')+'</b> best day'+(best?' ('+fmtDate(new Date(bestK+'T00:00:00').getTime())+')':'')+'</span><span><b>'+streak+'</b> day streak</span><span><b>'+(rate?rate.toFixed(rate<10?1:0):'0')+'</b> / day recently</span></div></section>';
}
function renderStats(){
  view.dataset.gid='';
  const ev=S.ev||evTimes(), p=S.pace||{lines:0,words:0,kanji:0}, wv=S.words.length, kv=S.kstats?S.kstats.l:0, now=Date.now();
  const nL=S.index.groups.reduce((a,g)=>a+getLearned(g.id).size,0), left=S.index.groups.filter(g=>g.kind!=='notebook'&&!S.excl.has(g.id)).reduce((a,g)=>a+(g.count-getLearned(g.id).size),0);
  const eta=(rem,rate)=>{ const e=fmtEta(rem,rate); return rem>0&&rate&&e!=='—' ? e+' · '+fmtDate(now+rem/rate*DAY) : e; };
  const st=stageOf(wv), pa=S.paceA||p;
  const pc=(rem,key)=>[pa[key],p[key]].map(r=>'<td>'+(!rem?'✓':(r?r.toFixed(1)+'/day<br><small>'+eta(rem,r)+'</small>':'—'))+'</td>').join('');
  const gm=graphModel(ev,{lines:nL,words:wv,kanji:kv});
  view.innerHTML='<div class="stats">'+graphHTML(gm)+
    '<p class="hint">Learning times are recorded when you tick a line. Words and kanji get the time of the first learned line that contains them. Ticks made before this feature and your Excel notes count as “before tracking” ('+(nL-ev.lines.length)+' lines, '+(wv-ev.words.length)+' words, '+(kv-ev.kanji.length)+' kanji) and are not on the calendars.</p>'+
    heat('Lines learned',ev.lines,'hl1','lines')+heat('Words learned',ev.words,'hl2','words')+heat('Kanji learned',ev.kanji,'hl3','kanji')+
    '<section class="est"><h3>Estimates <span>pace per day and time left at that pace</span></h3>'+
    '<table><thead><tr><th>Goal</th><th>Left</th><th>All days</th><th>Last 7 days</th></tr></thead><tbody>'+
    STAGES.filter(s=>s.hi!==Infinity).map((s,i)=>{ const rem=Math.max(0,s.hi-wv); return '<tr class="'+(i===st?'cur':'')+'"><td>Stage '+(i+1)+'/'+STAGES.length+' · '+s.n+' <small>('+s.hi+' words, ≈'+s.h+' h)</small></td><td>'+(rem?rem+' words':'done')+'</td>'+pc(rem,'words')+'</tr>'; }).join('')+
    [[KNOTCH,'Kanji 2200 mark'],[KMAX,'All 3000 kanji']].map(([g,nm])=>{ const rem=Math.max(0,g-kv); return '<tr><td>'+nm+'</td><td>'+(rem?rem+' kanji':'done')+'</td>'+pc(rem,'kanji')+'</tr>'; }).join('')+
    '<tr><td>All lines in your episodes</td><td>'+left+' lines</td>'+pc(left,'lines')+'</tr>'+
    '</tbody></table></section></div>';
  bindGraph(gm);
}

/* ---------- spaced repetition ----------
   Each card has a count c and the time of its last successful review l (and, after a failed review, a "come back by" time d).
   Interval for a count: 1d, 3d, 7d, 14d, 30d, 91d, 182d, 365d, then +365d per count; non-whole counts interpolate. */
const IVD=[1,3,7,14,30,91,182,365];
const ivAt=n=> n<IVD.length ? IVD[n] : 365*(n-6);
function ivDays(c){ c=Math.max(0,c); const f=Math.floor(c+1e-9), fr=Math.max(0,c-f); return ivAt(f)+(ivAt(f+1)-ivAt(f))*fr; }
const isWhole=c=>Math.abs(c-Math.round(c))<1e-6;
/* gain g (1 on time, waited/planned when early). A whole count takes the full gain; a fractional one takes 90%,
   but never ends below the next whole number when the full gain would have reached it. */
function addGain(c,g){
  if(isWhole(c)) return +(Math.round(c)+g).toFixed(4);
  const nx=Math.floor(c)+1; let v=c+0.9*g;
  if(c+g>=nx-1e-9 && v<nx) v=nx;
  return +v.toFixed(4);
}
/* a card comes due at the start (4:00) of the study day its interval reaches */
const due=st=>st.nw?Infinity:Math.min(dayStart(SD(st.l)+Math.max(1,Math.round(ivDays(st.c)))), st.d||Infinity);
const fmtCnt=c=>isWhole(c)?String(Math.round(c)):c.toFixed(2);
function fmtDur(ms){ const d=ms/DAY; if(d<1){ const h=Math.max(1,Math.round(ms/36e5)); return h+'h'; } if(d<45) return Math.round(d)+'d'; if(d<540) return Math.round(d/30.4)+'mo'; return (d/365).toFixed(1).replace(/\.0$/,'')+'y'; }

{ const o=LS.get('srs.v1',{}); S.srs=new Map(Object.entries(o.c||{}).filter(([k,v])=>!kOld(k,v))); S.t0=o.t0||0; }
S.srsDocs=new Set(); S.srsReady=false; S.srsPend=new Map();
let srsLsT=null;
function srsPersist(){ clearTimeout(srsLsT); srsLsT=setTimeout(()=>{ const c={}; S.srs.forEach((v,k)=>{ c[k]=v; }); LS.set('srs.v1',{t0:S.t0,c}); },400); }
function t0(){ if(!S.t0){ S.t0=Date.now(); srsPersist(); if(S.db && S.srsReady) S.db.doc('srs/meta').set({t0:S.t0}).catch(()=>{}); } return S.t0; }

