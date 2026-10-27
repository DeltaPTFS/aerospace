// Optional historical track integration for AeroScope ONE.
// FlyItalyADSB provides verified per-aircraft traces. Never expose its key to browsers.
// No key: return a graceful "not configured" response; existing session trails still work.
const cache=new Map();
const isHex=x=>/^[0-9a-f]{6}$/.test(x);
const clip=x=>String(x||'').trim().toUpperCase().replace(/\s/g,'').slice(0,12);
function parseDay(raw){
 if(!raw||!Array.isArray(raw.trace))return [];
 const base=Number(raw.timestamp);
 if(!Number.isFinite(base))return [];
 const data=[];
 let lastCall='';
 for(const item of raw.trace.slice(0,16000)){
  if(!Array.isArray(item))continue;
  const [offset,lat,lon,,speed,,flags,,details]=item;
  if(!Number.isFinite(offset)||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)continue;
  const call=clip(details?.flight||details?.callSign||'');
  if(call)lastCall=call;
  data.push({lat,lon,ts:(base+offset)*1000,flags:Number(flags)||0,call:lastCall,speed:Number(speed)||0});
 }
 return data;
}
function lastFlight(points,expectedCall){
 if(!points.length)return [];
 // Start with the latest reported leg; readsb flags bit 2 marks a new leg.
 let start=0;
 for(let i=1;i<points.length;i++)if(points[i].flags&2)start=i;
 let result=points.slice(start);
 // If flight identity changes, use only the final matching contiguous portion.
 const lastIdentity=[...result].reverse().find(p=>p.call)?.call||'';
 if(expectedCall&&lastIdentity&&lastIdentity!==expectedCall)return [];
 if(expectedCall){
  const mismatch=result.findLastIndex(p=>p.call&&p.call!==expectedCall);
  if(mismatch>=0)result=result.slice(mismatch+1);
 }
 return result;
}
function simplify(points,max=650){
 if(points.length<=max)return points;
 const out=[];const step=Math.ceil(points.length/(max-1));
 for(let i=0;i<points.length;i+=step)out.push(points[i]);
 if(out.at(-1)!==points.at(-1))out.push(points.at(-1));
 return out;
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, max-age=0');
 if(req.method!=='GET')return res.status(405).json({available:false,reason:'GET only'});
 const hex=String(req.query?.hex||'').trim().toLowerCase();
 const call=clip(req.query?.callsign);
 if(!isHex(hex))return res.status(400).json({available:false,reason:'Valid aircraft ICAO hex required'});
 const key=process.env.FLYITALYADSB_API_KEY;
 if(!key)return res.status(200).json({available:false,configured:false,reason:'Historical trace provider not connected; showing positions observed by AeroScope instead.'});
 // Respect privacy protections: do not redistribute historical paths for PIA/LADD identities.
 // A provider profile is used instead of guessing privacy status from missing fields.
 try{
  const privacyController=new AbortController();
  const privacyTimer=setTimeout(()=>privacyController.abort(),5500);
  let pr;
  try{pr=await fetch('https://api.flyitalyadsb.com/v2/profile/'+encodeURIComponent(hex),{signal:privacyController.signal,headers:{'X-Api-Key':key,Accept:'application/json'}})}
  finally{clearTimeout(privacyTimer)}
  if(!pr.ok)return res.status(200).json({available:false,configured:true,reason:'Aircraft privacy status could not be verified; historical playback withheld.'});
  const profile=await pr.json(),identity=profile?.identity||{};
  const flags=Number(identity.dbFlags)||0;
  if((flags&12)||identity.pia===true||identity.ladd===true)return res.status(200).json({available:false,configured:true,restricted:true,reason:((flags&8)||identity.ladd===true)?'Historical trace restricted: FAA LADD privacy flag':'Historical trace restricted: privacy ICAO address (PIA)'});
 }catch{return res.status(200).json({available:false,configured:true,reason:'Aircraft privacy verification unavailable; historical trace withheld.'})}
 const cacheKey=hex+'|'+call;
 const cached=cache.get(cacheKey);
 if(cached&&Date.now()-cached.at<10*60000)return res.status(200).json(cached.result);
 const today=new Date(),dates=[today.toISOString().slice(0,10),new Date(today.getTime()-86400000).toISOString().slice(0,10)];
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),12000);
 try{
  const tracks=[];
  let lastFailure=null,foundAny=false;
  for(const date of [...dates].reverse()){
   const u='https://api.flyitalyadsb.com/v2/history/'+encodeURIComponent(hex)+'/'+date;
   const response=await fetch(u,{signal:controller.signal,headers:{'X-Api-Key':key,'Accept':'application/json'}});
   if(response.status===404||response.status===204)continue;
   if(!response.ok){lastFailure=response.status;continue}
   const raw=await response.json();
   if(raw.icao&&String(raw.icao).toLowerCase()!==hex)continue;
   foundAny=true;
   const day=parseDay(raw);
   for(const point of day)if(point.ts<=Date.now()+300000)tracks.push(point);
  }
  if(!foundAny)return res.status(200).json({available:false,configured:true,reason:lastFailure?'Historical provider returned HTTP '+lastFailure:'No provider history reported for this aircraft on either of the past two UTC dates.'});
  const all=tracks.sort((a,b)=>a.ts-b.ts);
  const flight=lastFlight(all,call);
  if(flight.length<2)return res.status(200).json({available:false,configured:true,reason:'Not enough independently matching track points for this flight.'});
  const latest=flight.at(-1).ts;
  if(latest>Date.now()+300000||Date.now()-latest>4*3600000)return res.status(200).json({available:false,configured:true,reason:'Trace is not recent enough to safely match the currently selected flight.'});
  const selected=simplify(flight);
  const result={available:true,configured:true,provider:'FlyItalyADSB',attribution:'FlyItalyADSB (flyitalyadsb.com) · ADS-B/MLAT data · CC BY-SA 4.0',pointCount:flight.length,points:selected.map(p=>[p.lon,p.lat,p.ts]),dates,note:'Past observed positions for the latest matching flight leg; missing receiver coverage may leave gaps.'};
  if(cache.size>125)cache.clear();
  cache.set(cacheKey,{at:Date.now(),result});
  return res.status(200).json(result);
 }catch(e){return res.status(200).json({available:false,configured:true,reason:e?.name==='AbortError'?'History provider timed out':'Historical track temporarily unavailable'});}
 finally{clearTimeout(timeout)}
}
