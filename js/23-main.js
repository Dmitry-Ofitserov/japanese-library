/* ---------- start ---------- */
(async function(){
  try{
    const saved = LS.get('learned.v1',{}); Object.keys(saved).forEach(id=>S.learned.set(id,new Set(saved[id])));
    const r = await fetch('data/index.json'); if(!r.ok) throw 0;
    S.index = await r.json();
  }catch(e){ view.innerHTML='<div class="empty">Could not load the library. Check your connection and reload.</div>'; return; }
  S.index.groups.forEach(g=>{ if(!g.series) g.series='Other'; if(!g.short) g.short=g.title; });
  rebuildNames(); applyCustom();
  route(); initDb(); scheduleWords();
})();
