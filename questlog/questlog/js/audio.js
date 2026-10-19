// Web Audio API arcade sounds — no asset files needed.
let ctx;
function c(){ctx??=new(window.AudioContext||window.webkitAudioContext)();if(ctx.state==='suspended')ctx.resume();return ctx}
function tone(f,t0,d,type='square',v=.08){
  const a=c(),o=a.createOscillator(),g=a.createGain(),t=a.currentTime+t0;
  o.type=type;o.frequency.setValueAtTime(f,t);
  g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.0001,t+d);
  o.connect(g).connect(a.destination);o.start(t);o.stop(t+d+.02);
}
const safe=fn=>(...a)=>{try{fn(...a)}catch{}};
export const sfx={
  chime:safe(()=>[659,880,1175].forEach((f,i)=>tone(f,i*.08,.25,'triangle'))),
  coin:safe(()=>{tone(988,0,.08);tone(1319,.07,.35)}),
  levelUp:safe(()=>[523,659,784,1047,784,1047,1319].forEach((f,i)=>tone(f,i*.11,.3,'sawtooth',.06))),
  fail:safe(()=>{tone(180,0,.25,'sawtooth',.1);tone(130,.15,.35,'sawtooth',.1)})
};
