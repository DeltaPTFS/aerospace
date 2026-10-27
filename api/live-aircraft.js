// Live, selected-aircraft position refresh for AeroScope ONE.
// A focused feed avoids re-rendering every map marker just to update one aircraft.
// Cache shared responses briefly to conserve FlyItalyADSB's per-key quota.
const cached=new Map();
export default async function handler(req,res){
 res.setHeader('Cache-Control','public, s-maxage=4, stale-while-revalidate=2');
 if(req.method!=='GET')return res.status(405).json({available:false,reason:'GET only'});
 const hex=String(req.query?.hex||'').trim().toLowerCase();
 if(!/^[0-9a-f]{6}$/.test(hex))return res.status(400).json({available:false,reason:'Invalid ICAO hex'});
 const key=process.env.FLYITALYADSB_API_KEY;
 if(!key)return res.status(503).json({available:false,reason:'Fast live tracking not configured'});
 const saved=cached.get(hex);
 if(saved&&Date.now()-saved.at<4000)return res.status(200).json(saved.data);
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),4800);
 try {
  const r=await fetch('https://api.flyitalyadsb.com/v2/icao/'+hex,{signal:controller.signal,headers:{'X-Api-Key':key,Accept:'application/json'}});
  if(!r.ok)return res.status(r.status===429?429:502).json({available:false,reason:r.status===429?'Live provider rate limit reached':'Live provider returned HTTP '+r.status});
  const raw=await r.json();
  const candidates=Array.isArray(raw?.ac)?raw.ac:Array.isArray(raw)?raw:raw?.hex?[raw]:[];
  const a=candidates.find(x=>String(x?.hex||'').toLowerCase()===hex);
  if(!a)return res.status(200).json({available:false,reason:'Aircraft not currently reported by fast feed'});
  const take=v=>Number.isFinite(v)?v:null;
  const result={available:true,source:'FlyItalyADSB',attribution:'Live aircraft data © FlyItalyADSB (CC BY-SA 4.0)',aircraft:{
   hex,dbFlags:Number.isFinite(a.dbFlags)?a.dbFlags:0,
   flight:typeof a.flight==='string'?a.flight.trim().slice(0,15):null,
   r:typeof a.r==='string'?a.r.slice(0,20):null,
   t:typeof a.t==='string'?a.t.slice(0,12):null,
   lat:take(a.lat),lon:take(a.lon),alt_baro:a.alt_baro==='ground'?'ground':take(a.alt_baro),
   alt_geom:take(a.alt_geom),gs:take(a.gs),track:take(a.track),baro_rate:take(a.baro_rate),
   squawk:typeof a.squawk==='string'?a.squawk.slice(0,8):null,seen_pos:take(a.seen_pos),
   seen:take(a.seen),type:typeof a.type==='string'?a.type.slice(0,30):null
  },receivedAt:new Date().toISOString()};
  if(cached.size>240)cached.clear();
  cached.set(hex,{at:Date.now(),data:result});
  return res.status(200).json(result);
 }catch(e){return res.status(503).json({available:false,reason:e?.name==='AbortError'?'Live feed timed out':'Live feed temporarily unavailable'});}
 finally{clearTimeout(timer)}
}
