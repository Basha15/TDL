// Vercel serverless function: AI proof verification with Claude vision.
// Set ANTHROPIC_API_KEY in your Vercel project env vars. Without it the app falls back to a simulated verifier.
export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).end();
  const{title,note,image}=req.body||{};
  const content=[];
  if(image){const[meta,data]=image.split(',');content.push({type:'image',source:{type:'base64',media_type:meta.match(/:(.*?);/)[1],data}})}
  content.push({type:'text',text:`Task: "${String(title).slice(0,200)}". User note: "${String(note||'').slice(0,500)}". Does this proof plausibly show the task was completed? Reply ONLY with JSON: {"verified":boolean,"reason":"one short sentence"}`});
  try{
    const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',
      headers:{'content-type':'application/json','x-api-key':process.env.ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01'},
      body:JSON.stringify({model:'claude-sonnet-5-5',max_tokens:200,messages:[{role:'user',content}]})});
    const j=await r.json();
    res.json(JSON.parse(j.content[0].text.replace(/```json|```/g,'').trim()));
  }catch{res.status(500).json({verified:false,reason:'Verifier unavailable'})}
}
