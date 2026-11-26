/* ---------- backup ---------- */
const BK_APP='anime-sentence-library';
function backupObject(){
  const learned={}; S.localSaved.forEach(id=>{ if(meta(id)) learned[id]=[...getLearned(id)].sort((a,b)=>a-b); });
  const at={}; S.at.forEach((v,k)=>{ at[k]=v; }); const fz={}; S.fz.forEach((v,k)=>{ fz[k]=v; });
  const srs={}; S.srs.forEach((v,k)=>{ srs[k]=v; });
  return { app:BK_APP, version:1, exportedAt:new Date().toISOString(), learned, at, fz, srs:{t0:S.t0,c:srs}, wb:Object.fromEntries(S.wb),
    settings:{ hl:S.hl, khl:S.khl, excl:[...S.excl], norv:[...S.norv], bucket:S.bucket, eord:S.eord, permw:[...S.permw], custom:S.custom, names:S.nuser, loans:S.luser, kmode:S.kmode, wscale:S.wfull?'full':'stage', gopt:S.g, wtab:S.wtab, fur:S.fur, gram:S.gram, tr:S.tr, vol:S.vol } };
}
function bkMsg(t,bad){ const m=$('#bkmsg'); if(m){ m.textContent=t; m.className='bkmsg'+(bad?' bad':''); } }
async function exportBackup(){
  const obj=backupObject(), name='anime-library-backup-'+dkey(Date.now())+'.json', data=JSON.stringify(obj,null,1);
  try{
    const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([data],{type:'application/json'})); a.download=name; document.body.appendChild(a); a.click(); a.remove(); bkMsg('Backup downloaded ('+Object.values(obj.learned).reduce((a,l)=>a+l.length,0)+' learned lines).');
  }catch(e){ bkMsg('Could not save the backup file.',true); }
}
function readBackup(file){
  if(!file) return;
  const fr=new FileReader();
  fr.onload=()=>{
    try{
      const o=JSON.parse(fr.result);
      if(!o || o.app!==BK_APP || o.version!==1 || typeof o.learned!=='object') throw 0;
      S.bkPending=o;
      const lines=Object.entries(o.learned).filter(([id])=>meta(id)).reduce((a,[,l])=>a+l.length,0);
      const m=$('#bkmsg'); m.className='bkmsg';
      m.innerHTML='Backup from '+esc(String(o.exportedAt||'').slice(0,10))+': '+lines+' learned lines in '+Object.keys(o.learned).filter(meta).length+' group(s). <button class="btn" data-a="bk-apply">Replace my current data with this</button>';
    }catch(e){ S.bkPending=null; bkMsg('That file is not a backup from this page.',true); }
  };
  fr.onerror=()=>bkMsg('Could not read the file.',true);
  fr.readAsText(file);
}
function applyBackup(){
  const o=S.bkPending; if(!o) return;
  S.learned=new Map(); S.at=new Map(); S.fz=new Map(); S.localSaved=new Set();
  Object.entries(o.learned).forEach(([id,l])=>{ if(!meta(id)||!Array.isArray(l)) return; S.learned.set(id,new Set(l)); S.localSaved.add(id); S.at.set(id,Object.assign({},(o.at||{})[id]||{})); S.fz.set(id,Object.assign({},(o.fz||{})[id]||{})); });
  const st=o.settings||{};
  if(fixHL(st.hl)){ S.hl=st.hl; }
  if(fixKHL(st.khl)){ S.khl=st.khl; saveKHL(); }
  if(Array.isArray(st.excl)){ S.excl=new Set(st.excl); }
  if(Array.isArray(st.norv)){ S.norv=new Set(st.norv); }
  if(Array.isArray(st.bucket)){ S.bucket=bkMig(st.bucket); saveBucket(); }
  if(Array.isArray(st.permw)){ S.permw=new Set(st.permw); savePerm(); }
  if(Array.isArray(st.eord)){ S.eord=st.eord; saveEord(); }
  if(st.custom && typeof st.custom==='object'){ Object.entries(st.custom).forEach(([id,c])=>{ if(/^u-/.test(id) && c && Array.isArray(c.lines) && (!S.custom[id] || (c.u||0)>(S.custom[id].u||0))){ S.custom[id]=c; ceSave(id); } }); applyCustom(); }
  if(st.names && typeof st.names==='object'){ S.nuser={add:st.names.add||[],remove:st.names.remove||[]}; }
  if(st.loans && typeof st.loans==='object'){ S.luser={add:st.loans.add||[],remove:st.loans.remove||[]}; saveLoans(); }
  if(st.kmode) S.kmode=st.kmode;
  if(st.wscale) S.wfull=st.wscale==='full';
  if(st.gopt) S.g=Object.assign(S.g,st.gopt);
  if(st.wtab) S.wtab=st.wtab;
  LS.set('kmode',S.kmode); LS.set('wscale',S.wfull?'full':'stage'); LS.set('gopt',S.g); LS.set('wtab',S.wtab);
  saveHL(); saveExcl(); saveNorv(); saveNames(); rebuildNames();
  S.localSaved.forEach(id=>saveLearned(id)); persistLocal();
  if(o.srs && typeof o.srs.c==='object'){ S.srs=new Map(Object.entries(o.srs.c)); if(o.srs.t0) S.t0=o.srs.t0; srsPersist();
    if(S.db && S.srsReady){ const docs=new Map(); S.srs.forEach((v,k)=>{ const d=srsDoc(k); if(!docs.has(d)) docs.set(d,{}); docs.get(d)[k]=v; });
      docs.forEach((c,d)=>S.db.doc('srs/'+d).set({c}).then(()=>S.srsDocs.add(d)).catch(()=>{})); if(S.t0) S.db.doc('srs/meta').set({t0:S.t0}).catch(()=>{}); } }
  if(o.wb && typeof o.wb==='object'){ Object.entries(o.wb).forEach(([k,st])=>{ if(st && st.v!=null){ S.wb.set(k,st); S.wbPend.set(k,st); } }); wbPersist();
    if(S.db && S.wbReady){ const pend=[...S.wbPend]; S.wbPend.clear(); pend.forEach(([k,v])=>wbWrite(k,v)); } }
  S.bkPending=null; S.tickAt=0;
  derive(); fillEpSelect(); updateProgress();
  renderOptions(); bkMsg('Backup restored.');
}

