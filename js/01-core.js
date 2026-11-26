const $ = (s,r) => (r||document).querySelector(s);
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
let lsFailT=0;
function lsFail(k,e){ console.warn('Could not save "'+k+'" locally:',e); const now=Date.now(); if(now-lsFailT>30000){ lsFailT=now; if(typeof toast==='function') toast('This browser refused to save data locally — your progress may not survive closing the page.'); } }
const LS = {
  get(k,d){ try{ const v=localStorage.getItem(k); return v==null?d:JSON.parse(v); }catch(e){ return d; } },
  set(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){ lsFail(k,e); } }
};
const SLOW = 0.6;
const S = { index:null, data:new Map(), learned:new Map(), localSaved:new Set(LS.get('savedGroups',[])), pending:new Set(), db:null,
  view:'ep', ep:null, flt:'all', words:[], wShown:150, kShown:120, cur:null, jump:null, voice:null };
const view = $('#view'), app = $('#app');
const ICO_PLAY='<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.2v11.6a.6.6 0 0 0 .9.5l9.2-5.8a.6.6 0 0 0 0-1L4.9 1.7a.6.6 0 0 0-.9.5z"/></svg>';
/* slow = a turtle */
const ICO_SLOW='<svg viewBox="0 0 20 16" aria-hidden="true"><path d="M2.5 11.2C2.5 7.3 5.4 4.6 9 4.6s6.3 2.7 6.3 6.6z"/><circle cx="17" cy="9.4" r="1.9"/><rect x="4" y="11" width="2.4" height="3" rx="1"/><rect x="11.2" y="11" width="2.4" height="3" rx="1"/><path d="M2.7 10.4L.6 11.6l2.3.4z"/></svg>';
const ICO_NORV='<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12.6 5.6A5 5 0 0 0 3.2 6.4"/><path d="M12.9 2.9v2.9H10"/><path d="M3.4 10.4a5 5 0 0 0 9.4-.8"/><path d="M3.1 13.1v-2.9H6"/><path d="M2 2l12 12" stroke-width="1.8"/></svg>';
const NORV = (gid,n) => { const on=S.norv.has(gid+':'+n); return '<button class="norv" aria-pressed="'+on+'" aria-label="Learned, no review" title="'+(on?'Learned, not in reviews · tap to put it back into reviews':'Mark as learned and leave it out of reviews (names only, basic grammar…)')+'">'+ICO_NORV+'</button>'; };
const ICO_BKT='<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9.5h3.3l1 1.8h3.4l1-1.8H14"/><path d="M3.7 3.5h8.6L14 9.5V13H2V9.5z"/></svg>';
/* review bucket: lines, words and kanji you picked to review next; they are pre-selected on the Review page */
/* each entry is one review card (…|f JP card, …|b EN card, …|r line); older whole-item entries are split into their cards */
const bkMig = a => [...new Set((a||[]).flatMap(id=>/\|[fbr]$/.test(id)?[id]:id[0]==='L'?[id+'|r']:[id+'|f',id+'|b']))];
S.bucket = bkMig(LS.get('bucket.v1',[]));
function saveBucket(){ LS.set('bucket.v1',S.bucket); if(S.db) S.db.doc('settings/bucket').set({ids:S.bucket}).catch(()=>{}); }
const inBucket = id => S.bucket.includes(id);
/* words marked as permanently learned: never scheduled for review again */
S.permw = new Set(LS.get('perm.v1',[]));
function savePerm(){ LS.set('perm.v1',[...S.permw]); if(S.db) S.db.doc('settings/permw').set({ids:[...S.permw]}).catch(()=>{}); }
function setPerm(w,on){
  if(on) S.permw.add(w); else S.permw.delete(w);
  if(on && S.easyw.delete(w)) saveEasy();
  if(on){ const b=S.bucket.filter(x=>x!=='W|'+w+'|f' && x!=='W|'+w+'|b'); if(b.length!==S.bucket.length){ S.bucket=b; saveBucket(); } }
  savePerm(); buildCatalog(); paintBucket(); if(S.words && S._wc) updateBars();
  if(S.view==='words' && !S.sess){ const sy=scrollY; renderWords(); scrollTo(0,sy); if(S.wcur && !$('#kd').hidden) hlCur(S.wcur.e); }
  toast(w+(on?' marked as permanently learned':' back in normal reviews'));
}
/* easy words: reviewed only on every third round of their block (1st, 4th, 7th …); a miss turns them hard and normal again */
S.easyw=new Set(LS.get('easy.v1',[])); S.easyk=new Set(LS.get('easyk.v1',[]));
function saveEasy(){ LS.set('easy.v1',[...S.easyw]); if(S.db) S.db.doc('settings/easyw').set({ids:[...S.easyw]}).catch(()=>{}); }
function saveEasyK(){ LS.set('easyk.v1',[...S.easyk]); if(S.db) S.db.doc('settings/easyk').set({ids:[...S.easyk]}).catch(()=>{}); }
/* w is a word or 'K|<kanji>' */
function setEasy(w,on,quiet){
  const K=isKr(w), id=K?w.slice(2):w, set=K?S.easyk:S.easyw; if(set.has(id)===!!on) return;
  if(on) set.add(id); else set.delete(id);
  if(on && (K?S.permk:S.permw).has(id)){ (K?S.permk:S.permw).delete(id); if(K) savePermK(); else savePerm(); }
  if(K) saveEasyK(); else saveEasy();
  S._wbc=S._kbc=null;
  if(quiet) return;
  if(K) kAfterPerm(); else { if(S.cat) buildCatalog(); if(S.words && S._wc) updateBars();
    if(S.view==='words' && !S.sess){ const sy=scrollY; renderWords(true); scrollTo(0,sy); if(S.wcur && !$('#kd').hidden) hlCur(S.wcur.e); } }
  toast(id+(on?' marked as easy: reviewed every third round':' back in every round'));
}
const ICO_EASY='<svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 15.5c5.5 0 11-4.5 11-11-6.5 0-11 5.5-11 11z"/><path d="M4.5 15.5l6-6"/></svg>';
function easyBtn(w){ const on=easyOf(w), K=isKr(w);
  return '<button class="nico easyb'+(on?' on':'')+'" data-easy="'+escA(w)+'" aria-pressed="'+on+'" title="'+(on?'Easy: reviewed every third round. Tap to review it every round':'Mark as easy: reviewed only every third round of its block')+'" aria-label="Easy">'+ICO_EASY+'</button>'; }
function permBtn(e){ if(e.isName) return ''; const on=S.permw.has(e.word);
  return '<button class="nico permb'+(on?' on':'')+'" data-perm="'+escA(e.word)+'" aria-pressed="'+on+'" title="'+(on?'Permanently learned: never reviewed. Tap to put it back into reviews':'Mark as permanently learned: its cards never come up for review again')+'" aria-label="Permanently learned">∞</button>'; }
