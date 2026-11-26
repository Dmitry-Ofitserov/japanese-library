/* ---------- data ---------- */
async function loadGroup(id){
  if(S.data.has(id)) return S.data.get(id);
  const meta = S.index.groups.find(g=>g.id===id);
  const r = await fetch(meta.file); if(!r.ok) throw new Error('HTTP '+r.status);
  const d = await r.json(); S.data.set(id,d); return d;
}
function meta(id){ return S.index.groups.find(g=>g.id===id); }
function getLearned(id){
  if(!S.learned.has(id)){
    const m = meta(id), s = new Set();
    if(m && m.preLearned) for(let n=1;n<=m.count;n++) s.add(n);
    S.learned.set(id,s);
  }
  return S.learned.get(id);
}
function persistLocal(){
  const o={}; S.localSaved.forEach(id=>{ if(S.learned.has(id)) o[id]=[...S.learned.get(id)]; });
  LS.set('learned.v1',o); LS.set('savedGroups',[...S.localSaved]);
  const at={}; S.at.forEach((v,k)=>{ at[k]=v; }); LS.set('learnedAt.v1',at); const fz={}; S.fz.forEach((v,k)=>{ fz[k]=v; }); LS.set('frozen.v1',fz);
}
const writing = new Map();
async function saveLearned(id){
  persistLocal();
  if(!S.db) return;
  S.pending.add(id);
  let q = writing.get(id); if(!q){ q={busy:false,dirty:false}; writing.set(id,q); }
  if(q.busy){ q.dirty=true; return; }
  q.busy=true;
  try{
    do{ q.dirty=false;
      await S.db.doc('learned/'+id).set({lines:[...getLearned(id)].sort((a,b)=>a-b), at:S.at.get(id)||{}, fz:S.fz.get(id)||{}});
    }while(q.dirty);
    note('');
  }catch(e){ note('Could not reach the shared store. Your ticks are kept on this device.'); }
  q.busy=false; S.pending.delete(id);
}
function counts(id){ const m=meta(id); return [getLearned(id).size, m.count]; }

