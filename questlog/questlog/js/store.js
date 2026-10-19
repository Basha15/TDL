// State, XP/level math, streaks, loot rolls, shop — persisted in localStorage.
// To use Supabase/Firebase later, replace the load/save lines only.
const KEY='questlog.v1';
export const DIFF={easy:10,medium:25,hard:50,epic:100};
export const need=l=>100+(l-1)*50;
export const mult=n=>n>=30?2:n>=14?1.75:n>=5?1.5:n>=3?1.25:1;
export const bonus=l=>l*20;
const pad=d=>new Date(d.getTime()-d.getTimezoneOffset()*6e4);
const day=(d=new Date())=>pad(d).toISOString().slice(0,10);
const local=d=>pad(d).toISOString().slice(0,16);
const fresh=()=>({xp:0,level:1,coins:0,gems:0,streak:0,lastDay:null,tasks:[],rewards:[
  {id:'r1',name:'1 Hour of Gaming',cost:200},{id:'r2',name:'Guilt-free Boba Tea',cost:500}]});
let s;try{s=JSON.parse(localStorage.getItem(KEY))}catch{}
s=s||fresh();
{const y=day(new Date(Date.now()-864e5));if(s.lastDay&&s.lastDay!==day()&&s.lastDay!==y)s.streak=0}
const save=()=>localStorage.setItem(KEY,JSON.stringify(s));
export const get=()=>s;
export const task=id=>s.tasks.find(t=>t.id===id);
export const xpOf=t=>Math.round(DIFF[t.diff]*mult(s.streak));

export function addTask(t){s.tasks.push({...t,id:crypto.randomUUID(),done:false,notified:false});save()}
export const del=id=>{s.tasks=s.tasks.filter(t=>t.id!==id);save()};
export const snooze=(id,m)=>{const t=task(id);if(t){t.snoozeUntil=Date.now()+m*6e4;t.notified=false;save()}};
export const markNotified=id=>{const t=task(id);if(t){t.notified=true;save()}};

function nextDay(due){const d=new Date(due);do d.setDate(d.getDate()+1);while(d<new Date());return local(d)}

export function complete(id){
  const t=task(id);if(!t||t.done)return null;
  const today=day(),y=day(new Date(Date.now()-864e5));
  if(s.lastDay!==today){s.streak=s.lastDay===y?s.streak+1:1;s.lastDay=today}
  const m=mult(s.streak),xp=Math.round(DIFF[t.diff]*m);
  const q=Math.random(),rarity=q<.6?'common':q<.85?'rare':q<.96?'epic':'legendary';
  let coins=Math.round(DIFF[t.diff]*{common:1,rare:1.5,epic:2.5,legendary:5}[rarity]*(.8+Math.random()*.4));
  let gems={common:0,rare:1,epic:2,legendary:5}[rarity];
  t.done=true;t.doneAt=Date.now();s.xp+=xp;
  let leveled=false;
  while(s.xp>=need(s.level)){s.xp-=need(s.level);s.level++;leveled=true;coins+=bonus(s.level);gems+=1}
  s.coins+=coins;s.gems+=gems;
  if(t.repeat){const n={...t,id:crypto.randomUUID(),done:false,notified:false,snoozeUntil:null,due:nextDay(t.due)};delete n.doneAt;s.tasks.push(n)}
  save();
  return{xp,mult:m,coins,gems,rarity,leveled,level:s.level};
}

export function redeem(id){const r=s.rewards.find(x=>x.id===id);if(!r||s.coins<r.cost)return false;s.coins-=r.cost;save();return true}
export const addReward=(name,cost)=>{s.rewards.push({id:crypto.randomUUID(),name,cost});save()};
export const delReward=id=>{s.rewards=s.rewards.filter(r=>r.id!==id);save()};

const ham=(a,b)=>[...a].reduce((n,c,i)=>n+(c!==b[i]),0);
export const hasProof=h=>(s.proofs||[]).some(x=>ham(x,h)<=4);
export const addProof=h=>{(s.proofs??=[]).push(h);s.proofs=s.proofs.slice(-200);save()};
