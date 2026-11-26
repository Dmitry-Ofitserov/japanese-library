/* ---------- word highlighting in lines + options ---------- */
const HL_DEF = { on:true,
  rules:[ {name:'Not known yet',cmp:'le',n:0,color:'#d18b00',on:true}, {name:'Seen often',cmp:'ge',n:5,color:'#1c9a55',on:true} ],
  end:{on:true,color:'#7c5cf0'}, name:{on:true,color:'#e0457b'} };
function fixHL(v){ if(v && Array.isArray(v.rules) && v.end){ if(!v.name) v.name={on:true,color:'#e0457b'}; return v; } return null; }
function loadHL(){ return fixHL(LS.get('hl.v2',null)) || JSON.parse(JSON.stringify(HL_DEF)); }
S.hl = loadHL();
document.documentElement.style.setProperty('--nc',S.hl.name.color);
let hlTimer=null;
function saveHL(){
  LS.set('hl.v2',S.hl); document.documentElement.style.setProperty('--nc',S.hl.name.color); updateRuleCounts();
  clearTimeout(hlTimer);
  hlTimer=setTimeout(()=>{ if(S.db) S.db.doc('settings/hl').set({v:JSON.stringify(S.hl)}).catch(()=>{}); },500);
}
/* a word's "stem": inflected verbs and adjectives lose their last kana, so every form counts as the same word */
function stemOf(w){
  const s=normWord(w);
  if(/[一二三四五六七八九十百千何幾]つ$/.test(s)) return {s, end:false};   // counters like 二つ are not verbs: keep the つ
  if(s.length>=2 && /[るうくぐすつぬぶむい]$/.test(s) && (KJ.test(s) || s.length>=3)) return {s:s.slice(0,-1), end:true};
  return {s, end:false};
}
function computeWordStats(){
  const order=groupOrder(), st=new Map();
  order.forEach(g=>{ const d=S.data.get(g.id); if(!d) return; d.lines.forEach(L=>L.b.forEach(b=>wordsOf(b).forEach(x=>{
    let e=st.get(x.word); if(!e){ const y=stemOf(x.word); e={s:y.s,end:y.end,forms:[],c:0,t:0}; st.set(x.word,e); }
    if(x.surf){ const f=normWord(x.surf); if(f && f!==e.s && !e.forms.includes(f)) e.forms.push(f); } }))); });
  const occ=wordOcc();
  st.forEach((e,w)=>{ const on=occ.get(w)||new Set();
    order.forEach(g=>{ const set=getLearned(g.id), d=S.data.get(g.id); if(!d) return;
      d.lines.forEach(L=>{ if(!L._n) return; if(findWord(L,null,e) || on.has(g.id+':'+L.n)){ e.t++; if(set.has(L.n)) e.c++; } }); }); });
  S.wst=st; S.wst0=st;
}
const ruleHit=(r,c)=> r.on && (r.cmp==='le' ? c<=r.n : c>=r.n);
function ruleFor(c){ return S.hl.rules.find(r=>ruleHit(r,c)); }
const KANA_ONLY=/^[぀-ゟ]+$/;
function paintLine(art,L){
  const toks=art.querySelectorAll('.jp .tk');
  toks.forEach(t=>{ t.classList.remove('hl','end'); t.style.removeProperty('--hc'); t.style.removeProperty('--ec'); });
  if(!S.hl.on || !S.wst || !L._n) return;
  const color=new Map(), units=[], seen=new Set();
  if(S.hl.name.on) nameTokens(L).forEach(ti=>color.set(ti,S.hl.name.color));
  L.b.forEach(b=>wordsOf(b).forEach(x=>{ if(seen.has(x.word)) return; seen.add(x.word);
    const e=S.wst.get(x.word); if(!e) return; const f=findWord(L,x,e); if(f) units.push({e,idx:f.idx,len:f.len}); }));
  const lastTok=new Map();
  units.forEach(u=>{
    const r=ruleFor(u.e.c); let last=-1;
    for(let k=u.idx;k<u.idx+u.len;k++){ const ti=L._m[k]; last=Math.max(last,ti); if(r && !color.has(ti)) color.set(ti,r.color); }
    lastTok.set(u,last);
  });
  const ends=new Set();
  if(S.hl.end.on) units.forEach(u=>{
    if(!u.e.end) return; let ti=lastTok.get(u)+1, chars=0, n=0;
    while(ti<L.tk.length && n<3){ const s=surf(L.tk[ti]); if(!KANA_ONLY.test(s) || color.has(ti) || ends.has(ti) || chars+s.length>4) break; ends.add(ti); chars+=s.length; n++; ti++; }
  });
  color.forEach((c,ti)=>{ const t=toks[ti]; if(t){ t.classList.add('hl'); t.style.setProperty('--hc',c); } });
  ends.forEach(ti=>{ const t=toks[ti]; if(t){ t.classList.add('end'); t.style.setProperty('--ec',S.hl.end.color); } });
}
function paintAll(){
  const id=view.dataset.gid, d=S.data.get(id); if(!d || S.view!=='ep') return;
  view.querySelectorAll('.line').forEach(a=>{ const L=lineOf(id,+a.dataset.n); if(L) paintLine(a,L); });
}
async function refreshHL(){
  try{ await ensureCorpus(); }catch(e){ return; }
  computeWordStats();
  if(S.view==='ep'){ paintAll(); paintNew(); } else if(S.view==='options') updateRuleCounts();
}
function updateRuleCounts(){
  view.querySelectorAll('.rule').forEach(el=>{
    const r=S.hl.rules[+el.dataset.i], c=el.querySelector('.rc'); if(!r||!c) return;
    c.textContent = S.wst ? [...S.wst.values()].filter(e=>ruleHit({on:true,cmp:r.cmp,n:r.n},e.c)).length+' words' : '…';
  });
}
function renderOptions(){
  view.dataset.gid='';
  const h=S.hl;
  view.innerHTML='<section class="opt"><h2>Word highlighting in lines</h2>'+
   '<p class="hint">Each word in a line’s grammar breakdown is counted by how many <b>learned</b> lines contain it. The first rule from the top that matches colours the word.</p>'+
   '<label class="orow"><input type="checkbox" data-g="on"'+(h.on?' checked':'')+'> Highlight words in the Lines tab</label>'+
   '<div class="rules">'+h.rules.map((r,i)=>
     '<div class="rule" data-i="'+i+'"><input type="checkbox" data-f="on" aria-label="Rule on"'+(r.on?' checked':'')+'>'+
     '<input type="text" class="rn" data-f="name" aria-label="Rule name" value="'+escA(r.name)+'">'+
     '<span class="rl"><select data-f="cmp" aria-label="Comparison"><option value="le"'+(r.cmp==='le'?' selected':'')+'>seen in at most</option><option value="ge"'+(r.cmp==='ge'?' selected':'')+'>seen in at least</option></select>'+
     '<input type="number" min="0" step="1" data-f="n" aria-label="Number of learned lines" value="'+r.n+'"><span>learned lines</span></span>'+
     '<input type="color" data-f="color" aria-label="Colour" value="'+r.color+'">'+
     '<span class="rb"><button data-a="up" aria-label="Move up"'+(i?'':' disabled')+'>↑</button><button data-a="down" aria-label="Move down"'+(i<h.rules.length-1?'':' disabled')+'>↓</button><button data-a="del" aria-label="Delete rule">Delete</button></span>'+
     '<span class="rc"></span></div>').join('')+'</div>'+
   '<div class="orow"><button class="btn" data-a="add">Add rule</button><button class="btn" data-a="reset">Reset to defaults</button></div>'+
   '<h2>Episodes</h2><p class="hint">The list is your study order. The arrows move an episode; its words move with it in the word library and the word grid. Untick an episode you added but are not planning to learn for now. Its unlearned lines are then left out of the unlearned counts, the yellow kanji, the dark part of the progress bars, the time estimates and the grid previews.</p><div class="rules">'+groupOrder().map((g,i,A)=>'<div class="orow rule eprow"><span class="rb"><button data-a="eup" data-id="'+escA(g.id)+'" aria-label="Study earlier"'+(i?'':' disabled')+'>↑</button><button data-a="edown" data-id="'+escA(g.id)+'" aria-label="Study later"'+(i<A.length-1?'':' disabled')+'>↓</button></span><label>'+(g.kind==='notebook'?'':'<input type="checkbox" data-g="ep" data-id="'+escA(g.id)+'"'+(S.excl.has(g.id)?'':' checked')+'> ')+'<span><b>'+esc(g.series||g.title)+'</b>'+(g.series?' · '+esc(g.title):'')+' <span class="rc">'+(g.count-getLearned(g.id).size)+' unlearned lines</span></span></label></div>').join('')+'</div>'+
   '<h2>Words progress bar</h2><p class="hint">Stage view fills the bar within the current stage. Full view always shows 0 → 12,000 with the stage ends marked. Either way the full bar flashes briefly after you learn something.</p><div class="orow"><select data-g="wscale" aria-label="Words bar scale" class="rsel"><option value="stage"'+(S.wfull?'':' selected')+'>Current stage</option><option value="full"'+(S.wfull?' selected':'')+'>Full bar, always</option></select></div>'+
   '<h2>Kanji map</h2><p class="hint">What turns a kanji green in the Kanji tab.</p><div class="orow"><select data-g="kmode" aria-label="Kanji learned rule" class="rsel"><option value="lines"'+(S.kmode==='lines'?' selected':'')+'>Appears in a learned line</option><option value="story"'+(S.kmode==='story'?' selected':'')+'>Has a story in my Excel list</option></select></div>'+
   '<h2>Kanji colouring</h2><p class="hint">Colours in the Kanji tab and its minimap. A learned kanji that is due for review takes the due colour first (and is drawn bigger); otherwise the first of your rules that matches colours it, counted by how many <b>learned words</b> contain the kanji. Learned kanji that match no rule stay green.</p>'+
   '<div class="rules">'+
     '<div class="rule kfix"><input type="checkbox" data-kg="due.on" aria-label="On"'+(S.khl.due.on?' checked':'')+'><span class="rn">Due for review</span><span class="rl">a review card of this learned kanji is due now</span><input type="color" data-kg="due.color" aria-label="Colour" value="'+S.khl.due.color+'"><span class="rc" data-kc="due"></span></div>'+
     '<div class="rule kfix"><input type="checkbox" data-kg="due2.on" aria-label="On"'+(S.khl.due2.on?' checked':'')+'><span class="rn">Due, not learned from lines</span><span class="rl">a review card is due now, but the kanji is not learned from lines yet</span><input type="color" data-kg="due2.color" aria-label="Colour" value="'+S.khl.due2.color+'"><span class="rc" data-kc="due2"></span></div>'+
     '<div class="rule kfix"><input type="checkbox" data-kg="pend.on" aria-label="On"'+(S.khl.pend.on?' checked':'')+'><span class="rn">In unlearned lines</span><span class="rl">not learned yet, but in an added episode you haven\'t paused</span><input type="color" data-kg="pend.color" aria-label="Colour" value="'+S.khl.pend.color+'"><span class="rc" data-kc="pend"></span></div>'+
     S.khl.rules.map((r,i)=>
     '<div class="rule kr" data-ki="'+i+'"><input type="checkbox" data-kf="on" aria-label="Rule on"'+(r.on?' checked':'')+'>'+
     '<input type="text" class="rn" data-kf="name" aria-label="Rule name" value="'+escA(r.name)+'">'+
     '<span class="rl"><select data-kf="cmp" aria-label="Comparison"><option value="le"'+(r.cmp==='le'?' selected':'')+'>in at most</option><option value="ge"'+(r.cmp==='ge'?' selected':'')+'>in at least</option></select>'+
     '<input type="number" min="0" step="1" data-kf="n" aria-label="Number of learned words" value="'+r.n+'"><span>learned words</span></span>'+
     '<input type="color" data-kf="color" aria-label="Colour" value="'+r.color+'">'+
     '<span class="rb"><button data-a="kup" aria-label="Move up"'+(i?'':' disabled')+'>↑</button><button data-a="kdown" aria-label="Move down"'+(i<S.khl.rules.length-1?'':' disabled')+'>↓</button><button data-a="kdel" aria-label="Delete rule">Delete</button></span>'+
     '<span class="rc" data-kc="'+i+'"></span></div>').join('')+'</div>'+
   '<div class="orow"><button class="btn" data-a="kadd">Add kanji rule</button><button class="btn" data-a="kreset">Reset kanji colours</button></div>'+
   '<h2>Character names</h2><p class="hint">Names from your name dictionary (Words tab → Names) always get this colour, however often they appear. They never count toward words or kanji.</p><div class="orow"><label><input type="checkbox" data-g="nameOn"'+(h.name.on?' checked':'')+'> Colour names</label><input type="color" data-g="nameColor" aria-label="Name colour" value="'+h.name.color+'"></div>'+
   '<h2>Backup</h2><p class="hint">Saves your learned lines, learning times, fixed new-word counts and all settings to a file. Restoring replaces what is on this page, so export first if unsure.</p><div class="orow"><button class="btn" data-a="bk-export">Download backup</button><button class="btn" data-a="bk-pick">Restore from file…</button><input type="file" id="bkfile" accept=".json,application/json" hidden></div><div id="bkmsg" class="bkmsg" role="status"></div>'+
   '<h2>Word endings</h2><p class="hint">Verbs and adjectives count as one word in every form (食べる, 食べた, 食べて…). The changing ending is marked separately with an underline.</p>'+
   '<div class="orow"><label><input type="checkbox" data-g="endOn"'+(h.end.on?' checked':'')+'> Mark endings</label><input type="color" data-g="endColor" aria-label="Ending colour" value="'+h.end.color+'"></div></section>';
  refreshHL(); updateKRuleCounts();
}
function updateKRuleCounts(){
  if(!S.deck) return; const c={};
  S.deck.forEach(e=>{ const r=kcolor(e).r; c[r]=(c[r]||0)+1; });
  view.querySelectorAll('[data-kc]').forEach(x=>{ const n=c[x.dataset.kc]||0; x.textContent=n+' kanji'; });
}
view.addEventListener('change',e=>{ if(e.target.id==='bkfile'){ readBackup(e.target.files[0]); e.target.value=''; } });
view.addEventListener('input',e=>{
  const t=e.target; if(S.view!=='options') return;
  const g=t.dataset.g, f=t.dataset.f;
  if(t.dataset.kg){ const [a,b]=t.dataset.kg.split('.'); S.khl[a][b]=b==='on'?t.checked:t.value; saveKHL(); return; }
  if(t.dataset.kf){ const r=S.khl.rules[+t.closest('.kr').dataset.ki]; if(!r) return; const kf=t.dataset.kf;
    if(kf==='on') r.on=t.checked; else if(kf==='n') r.n=Math.max(0,parseInt(t.value,10)||0); else r[kf]=t.value; saveKHL(); return; }
  if(g==='wscale'){ S.wfull=t.value==='full'; LS.set('wscale',t.value); paintBar('words'); return; }
  if(g==='ep'){ const id=t.dataset.id; if(t.checked) S.excl.delete(id); else S.excl.add(id); saveExcl(); derive(); return; }
  if(g==='kmode'){ S.kmode=t.value; LS.set('kmode',S.kmode); derive(); return; }
  if(g){ if(g==='on') S.hl.on=t.checked; else if(g==='nameOn') S.hl.name.on=t.checked; else if(g==='nameColor') S.hl.name.color=t.value; else if(g==='endOn') S.hl.end.on=t.checked; else if(g==='endColor') S.hl.end.color=t.value; saveHL(); return; }
  if(!f) return; const r=S.hl.rules[+t.closest('.rule').dataset.i]; if(!r) return;
  if(f==='on') r.on=t.checked; else if(f==='n') r.n=Math.max(0,parseInt(t.value,10)||0); else r[f]=t.value;
  saveHL();
});
view.addEventListener('click',e=>{
  const b=e.target.closest('[data-a]'); if(!b || S.view!=='options') return;
  if(b.dataset.a==='bk-export'){ exportBackup(); return; }
  if(b.dataset.a==='bk-pick'){ $('#bkfile').click(); return; }
  if(b.dataset.a==='bk-apply'){ applyBackup(); return; }
  const a=b.dataset.a;
  if(a==='eup'||a==='edown'){ moveEp(b.dataset.id,a==='eup'?-1:1); renderOptions(); return; }
  if(/^k(up|down|del|add|reset)$/.test(a)){ const K=S.khl.rules, kr=b.closest('.kr'), j=kr?+kr.dataset.ki:-1;
    if(a==='kup'&&j>0) [K[j-1],K[j]]=[K[j],K[j-1]];
    else if(a==='kdown'&&j<K.length-1) [K[j+1],K[j]]=[K[j],K[j+1]];
    else if(a==='kdel') K.splice(j,1);
    else if(a==='kadd') K.push({name:'New rule',cmp:'ge',n:3,color:'#2690f2',on:true});
    else if(a==='kreset') S.khl=JSON.parse(JSON.stringify(KHL_DEF));
    saveKHL(); renderOptions(); return; }
  const R=S.hl.rules, rl=b.closest('.rule'), i=rl?+rl.dataset.i:-1;
  if(a==='up'&&i>0) [R[i-1],R[i]]=[R[i],R[i-1]];
  else if(a==='down'&&i<R.length-1) [R[i+1],R[i]]=[R[i],R[i+1]];
  else if(a==='del') R.splice(i,1);
  else if(a==='add') R.push({name:'New rule',cmp:'ge',n:10,color:'#3b8fe0',on:true});
  else if(a==='reset') S.hl=JSON.parse(JSON.stringify(HL_DEF));
  else return;
  saveHL(); renderOptions();
});

