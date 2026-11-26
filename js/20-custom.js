/* ---------- episodes you add yourself: stored in the shared store as custom/<id> = {title, series, lines:[{ts,jp,b,l,t}], u} ---------- */
S.custom = LS.get('custom.v1',{});
const CE_RB=/([一-鿿㐀-䶿々〆ヶ]+)\[([^\]]+)\]/g;
function ceTokens(jp){                     // "漢字[かんじ] を 読む" → tokens; spaces split words, 、。！？ and full-width spaces stay as pauses
  const out=[]; String(jp||'').trim().split(/ +/).forEach((w,i)=>{ if(!w) return;
    w.split(/(　)/).forEach(p=>{ if(!p) return; if(p==='　'){ out.push(' '); return; }
      out.push(esc(p).replace(CE_RB,(m,k,r)=>'<ruby>'+k+'<rt>'+r+'</rt></ruby>')); }); });
  return out;
}
const ceSec=ts=>{ const m=String(ts||'').trim().match(/^(?:(\d+):)?(\d+):(\d+(?:\.\d+)?)$|^(\d+(?:\.\d+)?)$/); if(!m) return 0; return m[4]?+m[4]:(+(m[1]||0))*3600+(+m[2])*60+(+m[3]); };
function ceGroup(id,c){ return {id, series:c.series||'My episodes', seriesId:'custom', title:c.title||'Untitled episode', kind:'episode', custom:true, count:(c.lines||[]).length, short:c.title||'Untitled'}; }
function ceData(id,c){ return prepLines({id, custom:true, lines:(c.lines||[]).map((x,i)=>({n:i+1, ts:x.ts||'', sec:ceSec(x.ts), tk:ceTokens(x.jp), b:(x.b||[]).filter(s=>s.trim()), l:x.l||'', t:x.t||''})) }); }
function applyCustom(){
  if(!S.index) return;
  S.index.groups=S.index.groups.filter(g=>!g.custom);
  Object.entries(S.custom).sort((a,b)=>(a[1].made||0)-(b[1].made||0)).forEach(([id,c])=>{ if(c.del) return; S.index.groups.push(ceGroup(id,c)); S.data.set(id,ceData(id,c)); });
  [...S.data.keys()].forEach(id=>{ if(id.startsWith('u-') && (!S.custom[id] || S.custom[id].del)) S.data.delete(id); });
  if(S.cat) buildCatalog();
  if(S.view==='ep' && S.ep && S.routed){ if(!meta(S.ep)){ nav('ep-'+S.index.groups[0].id); return; } fillEpSelect(); updateProgress(); }
  paintEpEdit(); scheduleWords();
}
function ceSave(id){
  const c=S.custom[id]; if(!c) return; c.u=Date.now(); LS.set('custom.v1',S.custom);
  clearTimeout(ceSave.t[id]); ceSave.t[id]=setTimeout(()=>{ if(S.db) S.db.doc('custom/'+id).set(S.custom[id]).catch(()=>toast('Could not sync the episode — it is kept on this device')); },700);
  const st=$('#ceSt'); if(st) st.textContent='Saved';
}
ceSave.t={};
function ceNew(){ const id='u-'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  S.custom[id]={title:'New episode', series:'My episodes', lines:[{ts:'',jp:'',b:[],l:'',t:''}], made:Date.now()}; ceSave(id); applyCustom(); nav('edit-'+id); }
function paintEpEdit(){ const b=$('#epEdit'); if(b) b.hidden=!(S.view==='ep' && meta(S.ep) && meta(S.ep).custom); }

const ceLine=(x,i)=>'<div class="cel" data-i="'+i+'"><div class="celh"><b>#'+(i+1)+'</b>'+
  '<input class="cets" data-k="ts" placeholder="0:00.00" aria-label="Time" value="'+escA(x.ts||'')+'">'+
  '<span class="celb"><button data-ce="up" aria-label="Move up"'+(i?'':' disabled')+'>↑</button><button data-ce="down" aria-label="Move down">↓</button><button data-ce="ins" aria-label="Insert a line below">+</button><button data-ce="del" aria-label="Delete line">✕</button></span></div>'+
  '<label>Line <small>words separated by spaces · furigana in brackets right after the kanji: 親父[おやじ], 見[み]ろよ</small><textarea data-k="jp" rows="1" lang="ja" placeholder="お前[まえ] の 親父[おやじ] は …">'+esc(x.jp||'')+'</textarea></label>'+
  '<div class="cepv jp" lang="ja">'+ceTokens(x.jp).map(t=>'<span class="tk">'+t+'</span>').join('')+'</div>'+
  '<label>Explanations <small>one per line: word (reading) - meaning</small><textarea data-k="b" rows="3" lang="ja" placeholder="親父 (おやじ) - old man, father">'+esc((x.b||[]).join('\n'))+'</textarea></label>'+
  '<label>Crude translation<textarea data-k="l" rows="1" placeholder="Your old-man …">'+esc(x.l||'')+'</textarea></label>'+
  '<label>Translation<textarea data-k="t" rows="1" placeholder="Your father …">'+esc(x.t||'')+'</textarea></label></div>';
function renderEdit(){
  const id=S.editId, c=S.custom[id]; view.dataset.gid='';
  if(!c || c.del){ view.innerHTML='<div class="empty">This episode no longer exists.</div>'; return; }
  const series=[...new Set(S.index.groups.map(g=>g.series))];
  view.innerHTML='<section class="ced"><div class="cetop"><a href="#ep-'+id+'" class="btn">← Lines</a><span id="ceSt" class="cest">Saved</span></div>'+
   '<div class="cemeta"><label>Episode title<input data-m="title" value="'+escA(c.title||'')+'"></label><label>Series<input data-m="series" list="ceSeries" value="'+escA(c.series||'')+'"></label>'+
   '<datalist id="ceSeries">'+series.map(s=>'<option value="'+escA(s)+'">').join('')+'</datalist></div>'+
   '<p class="hint">Changes save as you type and sync to your other devices. Ticks are kept by line number, so moving or deleting learned lines shifts them.</p>'+
   '<div class="celist">'+(c.lines||[]).map(ceLine).join('')+'</div>'+
   '<div class="orow"><button class="btn" data-ce="add">+ Add line</button><label class="btn">Import subtitles…<input type="file" id="ceFile" accept=".ass,.ssa,.srt,.vtt,.txt" hidden></label>'+
   '<button class="btn cedel" data-ce="delep">Delete episode</button></div></section>';
  view.querySelectorAll('.ced textarea').forEach(ceGrow);
}
function ceGrow(t){ t.style.height='auto'; t.style.height=(t.scrollHeight+2)+'px'; }
view.addEventListener('input',e=>{
  if(S.view!=='edit') return; const c=S.custom[S.editId]; if(!c) return; const t=e.target;
  if(t.dataset.m){ c[t.dataset.m]=t.value; ceSave(S.editId); ceLater(); return; }
  const row=t.closest('.cel'); if(!row || !t.dataset.k) return; const x=c.lines[+row.dataset.i];
  x[t.dataset.k] = t.dataset.k==='b' ? t.value.split('\n') : t.value;
  if(t.tagName==='TEXTAREA') ceGrow(t);
  if(t.dataset.k==='jp') row.querySelector('.cepv').innerHTML=ceTokens(t.value).map(s=>'<span class="tk">'+s+'</span>').join('');
  const st=$('#ceSt'); if(st) st.textContent='Saving…'; ceSave(S.editId); ceLater();
});
function ceLater(){ clearTimeout(ceLater.t); ceLater.t=setTimeout(()=>{ const id=S.editId, c=S.custom[id]; if(!c) return;
  const i=S.index.groups.findIndex(g=>g.id===id); if(i>=0) S.index.groups[i]=ceGroup(id,c); S.data.set(id,ceData(id,c)); if(S.cat) buildCatalog(); scheduleWords(); },1500); }
view.addEventListener('click',e=>{
  if(S.view!=='edit') return; const b=e.target.closest('[data-ce]'); if(!b) return;
  const id=S.editId, c=S.custom[id]; if(!c) return; const a=b.dataset.ce, row=b.closest('.cel'), i=row?+row.dataset.i:-1, L=c.lines;
  const blank=()=>({ts:'',jp:'',b:[],l:'',t:''});
  if(a==='add') L.push(blank());
  else if(a==='ins') L.splice(i+1,0,blank());
  else if(a==='del'){ if(b.dataset.sure!=='1'){ b.dataset.sure='1'; b.textContent='Delete?'; setTimeout(()=>{ b.dataset.sure=''; b.textContent='✕'; },2500); return; } L.splice(i,1); }
  else if(a==='up' && i>0) [L[i-1],L[i]]=[L[i],L[i-1]];
  else if(a==='down' && i<L.length-1) [L[i+1],L[i]]=[L[i],L[i+1]];
  else if(a==='delep'){ if(b.dataset.sure!=='1'){ b.dataset.sure='1'; b.textContent='Tap again to delete "'+(c.title||'episode')+'"'; return; }
    c.del=true; ceSave(id); applyCustom(); nav('ep-'+S.index.groups[0].id); toast('Episode deleted'); return; }
  else return;
  ceSave(id); const y=scrollY; renderEdit(); scrollTo(0,y); ceLater();
  if(a==='add'){ const ts=view.querySelectorAll('.cel textarea[data-k="jp"]'); const t=ts[ts.length-1]; if(t){ t.focus(); t.scrollIntoView({block:'center'}); } }
});
view.addEventListener('change',e=>{ if(S.view!=='edit' || e.target.id!=='ceFile') return; const f=e.target.files[0]; e.target.value=''; if(!f) return;
  f.text().then(txt=>{ const rows=ceParseSubs(txt, f.name); if(!rows.length){ toast('No Japanese lines found in that file'); return; }
    const c=S.custom[S.editId]; c.lines=c.lines.filter(x=>(x.jp||'').trim()||(x.b||[]).join('').trim()||x.t||x.l).concat(rows.map(r=>({ts:r.ts,jp:r.jp,b:[],l:'',t:''})));
    ceSave(S.editId); renderEdit(); ceLater(); toast(rows.length+' lines imported'); }); });
/* .ass / .srt / .vtt / plain text → [{ts, jp}] keeping lines with Japanese only */
function ceParseSubs(txt,name){
  const fmt=s=>{ const t=Math.max(0,s), m=Math.floor(t/60), r=t-m*60; return m+':'+(r<10?'0':'')+r.toFixed(2); }, JP=/[぀-ヿ一-鿿]/, out=[];
  const clean=s=>s.replace(/\{[^}]*\}/g,'').replace(/<[^>]+>/g,'').replace(/\\[Nn]/g,' ').replace(/\s+/g,' ').trim();
  if(/^\[Script Info\]|^Dialogue:/m.test(txt)){
    txt.split(/\r?\n/).forEach(l=>{ if(!l.startsWith('Dialogue:')) return; const p=l.slice(9).split(','); if(p.length<10) return;
      const t=clean(p.slice(9).join(',')); if(JP.test(t)) out.push({sec:ceSec(p[1].trim()), jp:t}); });
  } else if(/-->/.test(txt)){
    txt.split(/\r?\n\r?\n/).forEach(bl=>{ const ls=bl.split(/\r?\n/), k=ls.findIndex(x=>x.includes('-->')); if(k<0) return;
      const st=ls[k].split('-->')[0].trim().replace(',','.'), t=clean(ls.slice(k+1).join(' ')); if(JP.test(t)) out.push({sec:ceSec(st), jp:t}); });
  } else txt.split(/\r?\n/).forEach(l=>{ const t=clean(l); if(JP.test(t)) out.push({sec:0, jp:t}); });
  out.sort((a,b)=>a.sec-b.sec); const seen=new Set();
  return out.filter(x=>{ const k=x.sec+'|'+x.jp; if(seen.has(k)) return false; seen.add(k); return true; }).map(x=>({ts:x.sec?fmt(x.sec):'', jp:x.jp}));
}

