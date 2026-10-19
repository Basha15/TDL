import * as S from './store.js';
import {sfx} from './audio.js';

const $=(q,e=document)=>e.querySelector(q);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const inp='bg-white/10 border border-white/20 rounded-lg px-3 py-2 outline-none focus:border-purple-400';
const D={easy:['Easy','text-emerald-400 border-emerald-400/40'],medium:['Medium','text-sky-400 border-sky-400/40'],
  hard:['Hard','text-purple-400 border-purple-400/40'],epic:['Epic','text-amber-300 border-amber-300/40']};
let tab='quests',reg=null,timers=[],last=null;

/* ---------- UI helpers ---------- */
function toast(m){const t=$('#toast');t.textContent=m;t.classList.remove('opacity-0');setTimeout(()=>t.classList.add('opacity-0'),2200)}
function overlay(html){const o=$('#overlay');o.innerHTML=html;o.classList.remove('hidden');lucide.createIcons()}
function closeOv(){timers.forEach(clearInterval);timers=[];const o=$('#overlay');o.classList.add('hidden');o.innerHTML=''}

/* ---------- Header + Task List ---------- */
function header(){
  const s=S.get(),n=S.need(s.level);
  $('#lvl').textContent=s.level;$('#xpTxt').textContent=`${s.xp} / ${n} XP`;
  $('#xpFill').style.width=(s.xp/n*100)+'%';
  $('#streak').textContent=`🔥 ${s.streak}-day streak · x${S.mult(s.streak)}`;
  $('#coins').textContent=s.coins;$('#gems').textContent=s.gems;
}
function render(){
  header();$('#view').innerHTML=tab==='quests'?quests():shop();lucide.createIcons();
  document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('text-purple-300',b.dataset.tab===tab));
}
function quests(){
  const{tasks}=S.get();
  const open=tasks.filter(t=>!t.done).sort((a,b)=>a.due.localeCompare(b.due));
  const done=tasks.filter(t=>t.done).slice(-3).reverse();
  return `<p class="text-xs text-slate-400 mb-2">Swipe a quest right → to complete it</p>
  <div class="space-y-3">${open.map(card).join('')||'<div class="glass p-8 text-center text-slate-300">No active quests. Tap ＋ to start one ⚔️</div>'}</div>
  ${done.length?`<h3 class="mt-6 mb-2 text-sm text-slate-400">Recently cleared</h3><div class="space-y-2 opacity-60">${done.map(t=>`<div class="glass p-3 line-through text-sm">${esc(t.title)}</div>`).join('')}</div>`:''}`;
}
function card(t){
  const[d,c]=D[t.diff],due=new Date(t.due),late=due<new Date();
  return `<div class="relative rounded-2xl overflow-hidden">
  <div class="absolute inset-0 bg-emerald-500/30 flex items-center pl-5 font-bold text-emerald-300">✓ COMPLETE</div>
  <div class="card glass p-4 relative" data-id="${t.id}"><div class="flex items-start gap-3">
    <button data-act="done" data-id="${t.id}" aria-label="Complete" class="mt-1 w-8 h-8 shrink-0 rounded-full border-2 border-emerald-400 hover:bg-emerald-400/30 grid place-items-center"><i data-lucide="check" class="w-4 h-4"></i></button>
    <div class="flex-1 min-w-0"><div class="font-semibold">${esc(t.title)}</div>
      ${t.desc?`<div class="text-sm text-slate-400">${esc(t.desc)}</div>`:''}
      <div class="flex flex-wrap gap-2 mt-2 text-xs">
        <span class="px-2 py-0.5 rounded-full border ${c}">${d} · ${S.DIFF[t.diff]} XP</span>
        <span class="${late?'text-rose-400':'text-slate-300'}">⏰ ${due.toLocaleString([],{dateStyle:'short',timeStyle:'short'})}</span>
        ${t.mins?`<span class="text-slate-400">${t.mins}m</span>`:''}${t.proof?'<span class="text-sky-300">📸 proof</span>':''}${t.repeat?'<span>🔁</span>':''}
      </div></div>
    <button data-act="del" data-id="${t.id}" aria-label="Delete" class="text-slate-500 hover:text-rose-400"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
  </div></div></div>`;
}

/* ---------- Swipe-to-complete ---------- */
let sw=null;
document.addEventListener('pointerdown',e=>{const c=e.target.closest('.card');if(!c||e.target.closest('button'))return;sw={c,x:e.clientX,y:e.clientY,dx:0,on:false}});
document.addEventListener('pointermove',e=>{
  if(!sw)return;const dx=e.clientX-sw.x,dy=e.clientY-sw.y;
  if(!sw.on&&Math.abs(dy)>Math.abs(dx)&&Math.abs(dy)>8){sw=null;return}
  if(Math.abs(dx)>8)sw.on=true;
  if(sw.on){sw.dx=Math.max(0,dx);sw.c.style.transition='none';sw.c.style.transform=`translateX(${sw.dx}px)`}
});
const endSwipe=ok=>{if(!sw)return;const{c,dx}=sw;sw=null;c.style.transition='';c.style.transform='';if(ok&&dx>110)startComplete(c.dataset.id)};
document.addEventListener('pointerup',()=>endSwipe(true));
document.addEventListener('pointercancel',()=>endSwipe(false));

/* ---------- Completion flow: proof → verify → loot → level-up ---------- */
function startComplete(id){const t=S.task(id);if(!t||t.done)return;t.proof?openProof(t):reward(id)}
function reward(id){const r=S.complete(id);if(!r)return;last=r;render();loot(r)}

const shrink=f=>new Promise(res=>{const i=new Image();i.onload=()=>{const k=Math.min(1,800/Math.max(i.width,i.height)),c=document.createElement('canvas');c.width=i.width*k;c.height=i.height*k;c.getContext('2d').drawImage(i,0,0,c.width,c.height);res(c.toDataURL('image/jpeg',.7))};i.src=URL.createObjectURL(f)});

const analyze=src=>new Promise(res=>{const i=new Image();i.onload=()=>{const c=document.createElement('canvas');c.width=c.height=8;const x=c.getContext('2d');x.drawImage(i,0,0,8,8);const d=x.getImageData(0,0,8,8).data,g=[];for(let k=0;k<64;k++)g.push((d[k*4]+d[k*4+1]+d[k*4+2])/3);const avg=g.reduce((a,b)=>a+b)/64,sd=Math.sqrt(g.reduce((a,b)=>a+(b-avg)**2,0)/64);res({avg,sd,hash:g.map(v=>v>avg?'1':'0').join('')})};i.onerror=()=>res(null);i.src=src});

// 100% free, runs in the browser. Set window.QUESTLOG_VERIFY_URL only if you ever add a paid/AI backend.
async function verify(t,note,img,file){
  if(window.QUESTLOG_VERIFY_URL){
    try{const r=await fetch(window.QUESTLOG_VERIFY_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:t.title,note,image:img})});if(r.ok)return await r.json()}catch{}
  }
  await new Promise(r=>setTimeout(r,1500));
  const no=reason=>({verified:false,reason});
  if(img){
    const a=await analyze(img);
    if(!a)return no('Could not read that image — try another photo.');
    if(a.sd<4||a.avg<12)return no('Photo looks blank or too dark — retake it.');
    if(file&&file.lastModified&&Date.now()-file.lastModified>864e5)return no('Photo is older than 24 hours — take a fresh one.');
    if(S.hasProof(a.hash))return no('This photo was already used as proof for another quest.');
    S.addProof(a.hash);
    return{verified:true,reason:'Photo checks passed ✔ (free local check).'};
  }
  const words=note.trim().split(/\s+/).length;
  return words>=4&&note.trim().length>=15?{verified:true,reason:'Note accepted.'}:no('Write a fuller note (at least a short sentence) or attach a photo.');
}

function openProof(t){
  overlay(`<div id="pf" class="glass glow-p w-full max-w-md p-5 space-y-3"><h2 class="text-xl font-bold">📸 Submit proof</h2>
  <p class="text-sm text-slate-300">${esc(t.title)}</p>
  <input id="pimg" type="file" accept="image/*" capture="environment" class="text-sm w-full">
  <img id="prev" class="hidden rounded-lg max-h-48 mx-auto" alt="">
  <textarea id="pnote" rows="3" placeholder="Completion note (optional if you attach a photo)" class="${inp} w-full"></textarea>
  <div class="flex gap-2"><button data-act="close" class="flex-1 py-2 rounded-lg bg-white/10">Cancel</button>
  <button id="psub" class="flex-1 py-2 rounded-lg bg-emerald-500 text-black font-bold">Verify</button></div></div>`);
  $('#pimg').onchange=e=>{const f=e.target.files[0];if(f){$('#prev').src=URL.createObjectURL(f);$('#prev').classList.remove('hidden')}};
  $('#psub').onclick=async()=>{
    const f=$('#pimg').files[0],note=$('#pnote').value;
    if(!f&&note.trim().length<10)return toast('Add a photo or a longer note');
    $('#pf').innerHTML=`<div class="text-center py-8"><div class="spin mx-auto"></div><p class="mt-4 animate-pulse">Verifying proof…</p></div>`;
    const img=f?await shrink(f):null,r=await verify(t,note,img,f);
    if(r.verified){
      $('#pf').innerHTML=`<div class="text-center py-8"><div class="text-7xl pop">✅</div><p class="mt-3 text-emerald-300">${esc(r.reason)}</p></div>`;
      sfx.chime();setTimeout(()=>{closeOv();reward(t.id)},1100);
    }else{
      sfx.fail();
      $('#pf').innerHTML=`<div class="text-center py-6 space-y-3"><div class="text-7xl shake-once">❌</div><p class="text-rose-300">${esc(r.reason)}</p><button data-act="close" class="px-4 py-2 rounded-lg bg-white/10">Close</button></div>`;
    }
  };
}

/* ---------- Dopamine modals ---------- */
function loot(r){
  const R={common:['Common','text-slate-300'],rare:['Rare','text-sky-400'],epic:['Epic','text-purple-400'],legendary:['Legendary','text-amber-300']}[r.rarity];
  overlay(`<div class="text-center"><div class="flip mx-auto" id="loot" style="width:270px;height:330px"><div class="flip-inner relative w-full h-full">
    <div id="box" class="face glass absolute inset-0 grid place-items-center text-8xl shake">🎁</div>
    <div class="face back glass glow-p absolute inset-0 flex flex-col items-center justify-center gap-2 p-4">
      <div class="text-xs tracking-widest ${R[1]}">${R[0].toUpperCase()} LOOT</div>
      <div class="text-4xl font-black text-purple-300">+${r.xp} XP</div>
      ${r.mult>1?`<div class="text-orange-400 text-sm">🔥 x${r.mult} streak bonus</div>`:''}
      <div class="text-3xl text-amber-300">🪙 +${r.coins}</div>${r.gems?`<div class="text-3xl text-sky-300">💎 +${r.gems}</div>`:''}
    </div></div></div>
    <button id="cbtn" data-act="collect" class="mt-6 px-8 py-3 rounded-xl bg-gradient-to-r from-emerald-400 to-sky-400 text-black font-bold opacity-0 transition-opacity">Collect</button></div>`);
  sfx.chime();
  setTimeout(()=>{
    if(!$('#loot'))return;
    $('#loot').classList.add('open');$('#box').classList.remove('shake');sfx.coin();
    confetti({particleCount:r.rarity==='legendary'?260:120,spread:80,origin:{y:.55},colors:['#a855f7','#10b981','#38bdf8','#fbbf24']});
    $('#cbtn').classList.remove('opacity-0');
  },900);
}
function levelUp(l){
  const b=['🥉','🥈','🥇','💎','👑'][Math.min(4,Math.floor((l-1)/5))];
  overlay(`<div class="text-center flash glass p-10 rounded-3xl"><div class="text-sm tracking-[.4em] text-sky-300">★ ★ ★</div>
  <h1 class="text-5xl font-black bg-gradient-to-r from-purple-400 via-sky-300 to-emerald-300 bg-clip-text text-transparent pop">LEVEL UP!</h1>
  <div class="text-8xl my-4 pop">${b}</div><div class="text-2xl font-bold">You reached Level ${l}</div>
  <div class="text-amber-300 mt-1">Bonus: 🪙 +${S.bonus(l)} &nbsp; 💎 +1</div>
  <button data-act="close" class="mt-6 px-8 py-3 rounded-xl bg-purple-500 font-bold">Continue</button></div>`);
  sfx.levelUp();
  const fire=()=>{confetti({particleCount:70,angle:60,spread:70,origin:{x:0,y:.7}});confetti({particleCount:70,angle:120,spread:70,origin:{x:1,y:.7}})};
  fire();const iv=setInterval(fire,700);timers.push(iv);setTimeout(()=>clearInterval(iv),3500);
}

/* ---------- Add-task form ---------- */
function addForm(){
  const dt=new Date(Date.now()+36e5);dt.setMinutes(dt.getMinutes()-dt.getTimezoneOffset());
  overlay(`<form id="tf" class="glass glow-p w-full max-w-md p-5 space-y-3"><h2 class="text-xl font-bold">New Quest</h2>
  <input name="title" required maxlength="80" placeholder="Title" class="${inp} w-full">
  <textarea name="desc" rows="2" placeholder="Description" class="${inp} w-full"></textarea>
  <div class="grid grid-cols-2 gap-2">
    <label class="text-xs text-slate-400">Due<input type="datetime-local" name="due" required value="${dt.toISOString().slice(0,16)}" class="${inp} w-full mt-1"></label>
    <label class="text-xs text-slate-400">Est. minutes<input type="number" name="mins" min="1" value="30" class="${inp} w-full mt-1"></label></div>
  <div class="grid grid-cols-4 gap-2">${Object.keys(S.DIFF).map((k,i)=>`<label class="cursor-pointer"><input type="radio" name="diff" value="${k}" ${i==1?'checked':''} class="peer hidden"><div class="peer-checked:bg-purple-500/40 peer-checked:border-purple-400 border border-white/20 rounded-lg text-center py-2 text-xs">${D[k][0]}<br><b>${S.DIFF[k]} XP</b></div></label>`).join('')}</div>
  <label class="flex items-center gap-2 text-sm"><input type="checkbox" name="proof"> 📸 Require proof (AI-verified)</label>
  <label class="flex items-center gap-2 text-sm"><input type="checkbox" name="repeat"> 🔁 Repeat daily (habit)</label>
  <div class="flex gap-2"><button type="button" data-act="close" class="flex-1 py-2 rounded-lg bg-white/10">Cancel</button>
  <button class="flex-1 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-sky-400 font-bold">Add Quest</button></div></form>`);
  $('#tf').onsubmit=e=>{
    e.preventDefault();const f=new FormData(e.target);
    S.addTask({title:f.get('title').trim(),desc:f.get('desc').trim(),due:f.get('due'),diff:f.get('diff'),mins:+f.get('mins')||0,proof:!!f.get('proof'),repeat:!!f.get('repeat')});
    closeOv();askPerm();render();checkDue();
  };
}

/* ---------- Reward shop ---------- */
function shop(){
  const s=S.get();
  return `<div class="grid gap-3 sm:grid-cols-2">${s.rewards.map(r=>`<div class="glass p-4 flex items-center justify-between gap-3">
    <div><div class="font-semibold">${esc(r.name)}</div><div class="text-amber-300 text-sm">🪙 ${r.cost}</div></div>
    <div class="flex items-center gap-2"><button data-act="redeem" data-id="${r.id}" ${s.coins<r.cost?'disabled':''} class="px-3 py-1.5 rounded-lg bg-emerald-500 text-black font-semibold disabled:opacity-30">Redeem</button>
    <button data-act="delr" data-id="${r.id}" aria-label="Remove" class="text-slate-500 hover:text-rose-400"><i data-lucide="x" class="w-4 h-4"></i></button></div></div>`).join('')}</div>
  <div class="glass p-4 mt-4"><div class="font-semibold mb-2">Add a custom reward</div>
  <div class="flex gap-2"><input id="rn" placeholder="e.g. Guilt-free boba tea" class="${inp} flex-1 min-w-0"><input id="rc" type="number" min="1" placeholder="Coins" class="${inp} w-24">
  <button data-act="addr" class="px-3 rounded-lg bg-purple-500 font-semibold">Add</button></div></div>`;
}

/* ---------- Notification manager ---------- */
async function askPerm(){
  if('Notification' in window&&Notification.permission==='default'&&await Notification.requestPermission()==='granted')toast('Quest alerts enabled 🔔');
}
function notify(t){
  if(!reg||Notification.permission!=='granted')return;
  const m=Math.max(0,Math.round((new Date(t.due)-Date.now())/6e4));
  reg.showNotification('⏰ Quest incoming!',{
    body:`Your task '${t.title}' starts ${m>0?`in ${m} minutes`:'now'}! Clear it to claim ${S.xpOf(t)} XP!`,
    icon:'icons/icon.svg',tag:t.id,data:{id:t.id},vibrate:[100,50,100],
    actions:[{action:'complete',title:'✅ Mark Complete'},{action:'snooze',title:'💤 Snooze 10m'}]
  });
}
function checkDue(){
  const now=Date.now();
  S.get().tasks.forEach(t=>{
    if(t.done||t.notified)return;
    const start=new Date(t.due).getTime(),fire=t.snoozeUntil||start-10*6e4;
    if(now>=fire&&now<start+60*6e4){notify(t);S.markNotified(t.id)}
  });
}
function act(a,id){
  if(!S.task(id))return;
  if(a==='complete')startComplete(id);
  else if(a==='snooze'){S.snooze(id,10);toast('Snoozed 10 min 💤')}
}
async function initNotif(){
  if(!('serviceWorker' in navigator))return;
  try{
    reg=await navigator.serviceWorker.register('sw.js');
    navigator.serviceWorker.addEventListener('message',e=>act(e.data?.action,e.data?.id));
    const p=new URLSearchParams(location.search);
    if(p.get('action')){act(p.get('action'),p.get('id'));history.replaceState({},'',location.pathname)}
    await navigator.serviceWorker.ready;checkDue();
    setInterval(checkDue,3e4);document.addEventListener('visibilitychange',checkDue);
  }catch(e){console.warn('SW registration failed',e)}
}

/* ---------- Global click delegation ---------- */
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-act],[data-tab]');if(!b)return;
  const{act:a,id,tab:t}=b.dataset;
  if(t){tab=t;render();return}
  ({
    done:()=>startComplete(id),
    del:()=>{S.del(id);render()},
    add:addForm,
    close:closeOv,
    collect:()=>{closeOv();if(last?.leveled){const l=last.level;last=null;setTimeout(()=>levelUp(l),250)}},
    redeem:()=>{if(S.redeem(id)){sfx.coin();confetti({particleCount:60,spread:70,origin:{y:.7}});toast('Reward redeemed! Enjoy 🎉');render()}},
    delr:()=>{S.delReward(id);render()},
    addr:()=>{const n=$('#rn').value.trim(),c=+$('#rc').value;if(n&&c>0){S.addReward(n,c);render()}}
  })[a]?.();
});

render();initNotif();
