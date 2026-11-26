/* ---------- speech ---------- */
const synth = window.speechSynthesis || null;
let seq = 0;
function pickVoice(){
  if(!synth) return;
  const vs = synth.getVoices().filter(v=>/^ja/i.test(v.lang));
  S.voice = vs.find(v=>/kyoko|o-ren|haruka|ichiro|nanami|keita|google/i.test(v.name)) || vs[0] || null;
}
if(synth){ pickVoice(); synth.addEventListener && synth.addEventListener('voiceschanged', pickVoice);
  setTimeout(()=>{ pickVoice(); if(!S.voice) note('No Japanese voice found on this device. Install one in your system speech settings to hear the lines.'); },2000);
} else note('Voice-over is not supported in this browser.');
const surf = h => h.replace(/<rt>.*?<\/rt>/g,'').replace(/<[^>]+>/g,'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
/* what the voice gets: kanji are replaced by their furigana, so it reads exactly what the page shows */
const spokenOf = h => h.replace(/<ruby>[^<]*<rt>(.*?)<\/rt><\/ruby>/g,'$1').replace(/<[^>]+>/g,'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
const speakWord = e => /^[\u3040-\u30ff・ー]+$/.test(e.reading||'') ? e.reading : e.word.replace(/\+/g,'');
/* how long a token takes to say, in morae: small ゃゅょ etc. don't add a beat, kanji count by their reading */
const SMALL=/[ゃゅょぁぃぅぇぉゎャュョァィゥェォヮ]/;
function weight(h){
  const s = surf(h); if(/^\s+$/.test(s)) return 0.6;
  let w = 0; for(const m of h.matchAll(/<rt>(.*?)<\/rt>/g)) for(const ch of m[1]) if(!SMALL.test(ch)) w += 1;
  for(const ch of s) if(!/[一-鿿々]/.test(ch) && !SMALL.test(ch)) w += /[、。！？!?…]/.test(ch) ? 0.8 : 1;
  return w || 0.5;
}
/* speaking speed per voice and rate (ms per mora), learned from how long each finished line took */
const SPK = LS.get('spk.v1',{});
const spkKey = r => (S.voice?S.voice.name:'?')+'|'+r;
const msPerW = r => SPK[spkKey(r)] || 1000/(7.5*r);
function endCur(){
  const c = S.cur; if(!c) return;
  c.timers.forEach(clearTimeout); c.wt.forEach(clearTimeout);
  if(c.btn){ c.btn.setAttribute('aria-pressed','false'); c.btn.innerHTML = c.html; }
  if(c.el) c.el.classList.remove('saying');
  if(c.art) c.art.querySelectorAll('.tk.on').forEach(e=>e.classList.remove('on'));
  S.cur = null;
}
function speak(o){           // o: {text, spans?, weights?, art?, btn?, el?, rate}
  if(!synth) return;
  if(typeof LX!=='undefined' && LX.on && !LX.paused) lxPause();
  const same = S.cur && ((o.btn && S.cur.btn===o.btn) || (o.el && S.cur.el===o.el));
  synth.cancel(); endCur();
  if(same) return;
  const c = { btn:o.btn, el:o.el, art:o.art, html:o.btn?o.btn.innerHTML:'', timers:[], wt:[], id:++seq, t0:0 };
  S.cur = c;
  if(o.btn){ o.btn.setAttribute('aria-pressed','true'); o.btn.innerHTML = STOP; }
  if(o.el) o.el.classList.add('saying');
  const u = new SpeechSynthesisUtterance(o.text);
  u.lang='ja-JP'; if(S.voice) u.voice=S.voice; u.rate=o.rate; u.volume=S.vol;
  let gotB = false, toks = o.art ? o.art.querySelectorAll('.tk') : [];
  const mark = i => { toks.forEach((e,j)=>e.classList.toggle('on', j===i)); };
  const W = o.weights || [], totW = W.reduce((a,b)=>a+b,0);
  u.onstart = () => {
    if(S.cur!==c) return; c.t0 = performance.now();
    if(!o.weights) return;
    const per = msPerW(o.rate); let t = 0;
    W.forEach((w,i)=>{ c.timers.push(setTimeout(()=>{ if(!gotB && S.cur===c) mark(i); }, t)); t += w*per; });
  };
  /* with word boundaries from the voice: jump to the token being said, and walk through the tokens
     inside the voice's word at the learned speed (a voice "word" often covers several tokens) */
  u.onboundary = e => {
    if(S.cur!==c || !o.spans) return;
    if(e.name && e.name!=='word') return;
    if(!gotB){ gotB=true; c.timers.forEach(clearTimeout); c.timers=[]; }
    c.wt.forEach(clearTimeout); c.wt=[];
    const sp=o.spans, i = sp.findIndex(x => e.charIndex>=x[0] && e.charIndex<x[1]);
    if(i<0) return; mark(i);
    const end = e.charIndex + (e.charLength||0), per = msPerW(o.rate); let t = W[i]*per;
    for(let j=i+1; j<sp.length && sp[j][0]<end; j++){ c.wt.push(setTimeout(()=>{ if(S.cur===c) mark(j); }, t)); t += W[j]*per; }
  };
  u.onend = () => {
    if(S.cur!==c) return;
    if(c.t0 && totW>=6){ const v=(performance.now()-c.t0)/totW; if(v>40 && v<900){ const k=spkKey(o.rate); SPK[k]=SPK[k]?SPK[k]*0.6+v*0.4:v; LS.set('spk.v1',SPK); } }
    endCur();
  };
  u.onerror = () => { if(S.cur===c) endCur(); };
  setTimeout(()=>{ if(S.cur===c) synth.speak(u); }, 60);
}
function playLine(art, btn){
  const gid = art.closest('[data-gid]').dataset.gid, n = +art.dataset.n;
  const L = S.data.get(gid).lines.find(x=>x.n===n);
  let text='', spans=[], weights=[];
  L.tk.forEach(h=>{
    let s = spokenOf(h); if(/^\s+$/.test(s) || s==='…') s='、';
    spans.push([text.length, text.length+s.length]); text += s; weights.push(weight(h));
  });
  speak({ text, spans, weights, art, btn, rate: btn.dataset.rate==='slow'?SLOW:1 });
}

