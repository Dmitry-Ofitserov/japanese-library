/* ---------- shared store: Firebase Firestore + email/password auth ---------- */
/* The app talks to the store through two calls only: db.doc('collection/id').set(...) or
   .update(...), and db.collection(name).onSnapshot(ok,err). This file provides that
   interface on Firestore, nesting every path under users/<uid>/ so each signed-in
   account only reaches its own data. Without a configured js/00-config.js (or when the
   visitor skips signing in) the app runs from this device only, exactly as before. */

function fsStore(fs, uid){
  const pre = p => 'users/'+uid+'/'+p;
  return { doc: p => fs.doc(pre(p)), collection: n => fs.collection(pre(n)) };
}

const AUTH_MSG = {
  'auth/invalid-email': 'That email address does not look right.',
  'auth/missing-password': 'Type a password.',
  'auth/weak-password': 'The password needs at least 6 characters.',
  'auth/email-already-in-use': 'That account already exists — use Sign in.',
  'auth/invalid-credential': 'Wrong email or password.',
  'auth/wrong-password': 'Wrong email or password.',
  'auth/user-not-found': 'Wrong email or password.',
  'auth/too-many-requests': 'Too many tries — wait a minute and try again.',
  'auth/network-request-failed': 'No connection to the sign-in service.'
};
const authErr = e => AUTH_MSG[e && e.code] || (e && e.message) || 'Sign-in failed.';

/* small sign-in card; onDone(user|null) — null = continue on this device only */
function authOverlay(onDone, auth){
  const ov = document.createElement('div'); ov.className='authov';
  ov.innerHTML = '<div class="authbox"><h2>Sign in to sync</h2>'+
    '<p class="authhint">One account keeps your ticks, reviews and episodes on every device.</p>'+
    '<label>Email <input id="auEm" type="email" autocomplete="email"></label>'+
    '<label>Password <input id="auPw" type="password" autocomplete="current-password"></label>'+
    '<div class="autherr" hidden></div>'+
    '<div class="authbtns"><button class="btn" id="auIn">Sign in</button><button class="btn" id="auUp">Create account</button></div>'+
    '<button class="authskip" id="auSkip">Continue on this device only</button></div>';
  document.body.appendChild(ov);
  const err = (m)=>{ const e=ov.querySelector('.autherr'); e.textContent=m; e.hidden=!m; };
  const go = async (mode)=>{
    const em=ov.querySelector('#auEm').value.trim(), pw=ov.querySelector('#auPw').value;
    if(!em || !pw){ err('Fill in both email and password.'); return; }
    err(''); ov.querySelectorAll('button').forEach(b=>b.disabled=true);
    try{
      const u = mode==='in' ? await auth.signInWithEmailAndPassword(em,pw) : await auth.createUserWithEmailAndPassword(em,pw);
      ov.remove(); onDone(u.user);
    }catch(e){ err(authErr(e)); ov.querySelectorAll('button').forEach(b=>b.disabled=false); }
  };
  ov.querySelector('#auIn').addEventListener('click',()=>go('in'));
  ov.querySelector('#auUp').addEventListener('click',()=>go('up'));
  ov.querySelector('#auSkip').addEventListener('click',()=>{ ov.remove(); onDone(null); });
  ov.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); go('in'); } });
  ov.querySelector('#auEm').focus();
}

async function openCloudStore(){
  if(!window.firebase){ note('Sync off: Firebase SDK did not load (connection or extension blocking it).'); return null; }
  if(!window.FIREBASE_CONFIG || !FIREBASE_CONFIG.apiKey || FIREBASE_CONFIG.apiKey.indexOf('PASTE')===0){
    note('Sync off: no Firebase credentials in js/00-config.js.'); return null; }
  try{
    if(!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    const fs = firebase.firestore(), auth = firebase.auth();
    /* the first onAuthStateChanged callback carries the restored saved session (or null) —
       only show the sign-in card once that check has come back empty */
    const saved = await new Promise(res=>{ const un=auth.onAuthStateChanged(x=>{ un(); res(x); }); });
    if(saved) return fsStore(fs, saved.uid);
    return await new Promise(resolve=>{
      let done = false;
      const finish = v => { if(done) return; done=true; resolve(v); };
      authOverlay(u=>finish(u ? fsStore(fs,u.uid) : null), auth);
    });
  }catch(e){ note('Sync off: Firebase init failed — '+(e&&e.message||e)); return null; }
}

async function initDb(){
  const db = await openCloudStore();
  if(!db) return;
  S.db = db; srsListen(db); wbListen(db); kstoryListen(db);
  const timer = setTimeout(()=>note('The shared store has not answered yet. Ticks are kept on this device meanwhile.'),10000);
  db.collection('learned').onSnapshot(snap=>{
    if(!snap.metadata.fromCache) clearTimeout(timer);
    const have = new Set();
    snap.docs.forEach(d=>{
      have.add(d.id);
      if(S.pending.has(d.id) || !meta(d.id)) return;
      const lines = (d.data()||{}).lines; if(Array.isArray(lines)){ S.learned.set(d.id,new Set(lines)); S.at.set(d.id,Object.assign({},(d.data()||{}).at||{})); S.fz.set(d.id,Object.assign({},(d.data()||{}).fz||{})); }
    });
    if(!snap.metadata.fromCache && !S.synced){ S.synced=true; S.localSaved.forEach(id=>{ if(!have.has(id)) saveLearned(id); }); }
    S.localSaved = new Set([...S.localSaved, ...have]); persistLocal();
    syncUI();
  }, err=>{ clearTimeout(timer); note('Could not read the shared store. Ticks are kept on this device.'); });
  try{ let first=true; db.collection('custom').onSnapshot(snap=>{ let ch=false; const seen=new Set();
    snap.docs.forEach(d=>{ const v=d.data()||{}; seen.add(d.id); const l=S.custom[d.id]; if(!l || (v.u||0)>(l.u||0)){ S.custom[d.id]=v; ch=true; } });
    if(first){ first=false; Object.keys(S.custom).forEach(id=>{ if(!seen.has(id)) db.doc('custom/'+id).set(S.custom[id]).catch(()=>{}); }); }
    if(ch){ LS.set('custom.v1',S.custom); applyCustom(); if(S.view==='edit' && !(document.activeElement && view.contains(document.activeElement))) renderEdit(); } }, ()=>{}); }catch(e){}
  try{ db.collection('settings').onSnapshot(snap=>{ snap.docs.forEach(d=>{ if(d.id==='listen'){ try{ lxMerge(d.data()||{}); }catch(e){} return; } if(d.id==='permk'){ try{ const ids=(d.data()||{}).ids; if(Array.isArray(ids) && JSON.stringify(ids)!==JSON.stringify([...S.permk])){ S.permk=new Set(ids); LS.set('permk.v1',ids); kAfterPerm(); } }catch(e){} return; } if(d.id==='easyw'||d.id==='easyk'){ try{ const K=d.id==='easyk', ids=(d.data()||{}).ids, cur=K?S.easyk:S.easyw; if(Array.isArray(ids) && JSON.stringify(ids)!==JSON.stringify([...cur])){ if(K){ S.easyk=new Set(ids); LS.set('easyk.v1',ids); kAfterPerm(); } else { S.easyw=new Set(ids); LS.set('easy.v1',ids); S._wbc=S._kbc=null; if(S.cat) buildCatalog(); if(S.words && S._wc) updateBars(); } } }catch(e){} return; } if(d.id==='permw'){ try{ const ids=(d.data()||{}).ids; if(Array.isArray(ids) && JSON.stringify(ids)!==JSON.stringify([...S.permw])){ S.permw=new Set(ids); LS.set('perm.v1',ids); if(S.cat) buildCatalog(); } }catch(e){} return; } if(d.id==='bucket'){ try{ const ids=(d.data()||{}).ids; if(Array.isArray(ids) && JSON.stringify(bkMig(ids))!==JSON.stringify(S.bucket)){ S.bucket=bkMig(ids); LS.set('bucket.v1',S.bucket); paintBucket(); } }catch(e){} return; } if(d.id==='eord'){ try{ const ids=(d.data()||{}).ids; if(Array.isArray(ids) && JSON.stringify(ids)!==JSON.stringify(S.eord)){ S.eord=ids; LS.set('eord.v1',ids); derive(); if(S.view==='options' && !view.contains(document.activeElement)) renderOptions(); } }catch(e){} return; } if(d.id==='loans'){ try{ const v=d.data()||{}; const lu={add:v.add||[],remove:v.remove||[]}; if(JSON.stringify(lu)!==JSON.stringify(S.luser)){ S.luser=lu; LS.set('loans.v1',lu); scheduleWords(); } }catch(e){} return; } if(d.id==='names'){ try{ const v=d.data()||{}; const nu={add:v.add||[],remove:v.remove||[]}; if(JSON.stringify(nu)!==JSON.stringify(S.nuser)){ S.nuser=nu; LS.set('names.v1',nu); rebuildNames(); derive(); } }catch(e){} return; } if(d.id==='norv'){ try{ const ids=(d.data()||{}).ids; if(Array.isArray(ids) && JSON.stringify(ids.slice().sort())!==JSON.stringify([...S.norv].sort())){ S.norv=new Set(ids); LS.set('norv.v1',ids); if(S.cat) buildCatalog(); paintNorv(); } }catch(e){} return; } if(d.id==='excl'){ try{ const ids=(d.data()||{}).ids; if(Array.isArray(ids) && JSON.stringify(ids.slice().sort())!==JSON.stringify([...S.excl].sort())){ S.excl=new Set(ids); LS.set('excl.v1',ids); derive(); if(S.view==='options' && !view.contains(document.activeElement)) renderOptions(); } }catch(e){} return; } if(d.id==='khl'){ try{ const v=JSON.parse((d.data()||{}).v); if(fixKHL(v) && JSON.stringify(v)!==JSON.stringify(S.khl)){ S.khl=v; LS.set('khl.v1',v); if(S.view==='kanji') renderKanji(true); else if(S.view==='options' && !view.contains(document.activeElement)) renderOptions(); } }catch(e){} return; } if(d.id!=='hl') return;
    try{ const v=JSON.parse((d.data()||{}).v); if(fixHL(v) && JSON.stringify(v)!==JSON.stringify(S.hl)){ S.hl=v; LS.set('hl.v2',v); if(S.view==='options'){ if(!view.contains(document.activeElement)) renderOptions(); } else refreshHL(); } }catch(e){} }); easyMigrate(snap); }, ()=>{}); }catch(e){}
}
/* once (23.11.2026): every permanently learned word and kanji becomes easy instead; the old lists are kept in settings/permBackup */
function easyMigrate(snap){
  if(snap.metadata.fromCache || S.migr1 || !S.db) return; S.migr1=1;
  const doc=id=>{ const d=snap.docs.find(x=>x.id===id); return d?(d.data()||{}):null; };
  if(doc('migr1')) return;
  const pw=(doc('permw')||{}).ids||[], pk=(doc('permk')||{}).ids||[];
  S.db.doc('settings/permBackup').set({permw:pw,permk:pk,at:Date.now()}).then(()=>{
    pw.forEach(w=>S.easyw.add(w)); pk.forEach(k=>S.easyk.add(k)); S.permw=new Set(); S.permk=new Set();
    saveEasy(); saveEasyK(); savePerm(); savePermK();
    S.db.doc('settings/migr1').set({at:Date.now(),words:pw.length,kanji:pk.length}).catch(()=>{});
    S._wbc=S._kbc=null; if(S.cat) buildCatalog(); if(S.deck) computeKanjiStats(); if(S.words && S._wc) updateBars(); wbRefresh();
    if(pw.length||pk.length) toast(pw.length+' permanent words'+(pk.length?' and '+pk.length+' kanji':'')+' are now easy');
  }).catch(()=>{ S.migr1=0; });
}
function syncUI(){
  if(S.view==='ep'){
    view.querySelectorAll('.line').forEach(a=>{ const on=getLearned(S.ep).has(+a.dataset.n); a.dataset.learned=on?1:0; const cb=a.querySelector('.lc'); if(cb) cb.checked=on; });
    fillEpSelect(); updateProgress();
  }
  scheduleWords();
}

