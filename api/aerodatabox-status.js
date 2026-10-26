// AeroDataBox RapidAPI flight-status lookup for non-commercial beta testing.
// Never send the RapidAPI key to the browser. Calls are user-triggered to protect quota.
const cache=new Map();let attempted=0;
const pickTime=x=>x?.utc||null;
const local=x=>x?.local||null;
const safe=v=>typeof v==='string'?v.slice(0,180):null;
const apt=a=>a?{code:safe(a.iata)||safe(a.icao),name:safe(a.name),timeZone:safe(a.timeZone)}:null;
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');
 if(req.method!=='GET')return res.status(405).json({available:false,reason:'GET only'});
 const key=process.env.AERODATABOX_API_KEY;
 if(!key)return res.status(503).json({available:false,reason:'AeroDataBox is not configured'});
 const hex=String(req.query.hex||'').toLowerCase().trim();
 const reg=String(req.query.registration||'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'');
 const callsign=String(req.query.callsign||'').trim().toUpperCase().replace(/\s/g,'');
 if(!/^[0-9a-f]{6}$/.test(hex))return res.status(400).json({available:false,reason:'A valid ICAO aircraft identifier is required'});
 const keyCache=hex+'|'+reg+'|'+callsign;
 const previous=cache.get(keyCache);
 if(previous&&Date.now()-previous.time<30*60*1000)return res.status(200).json({...previous.data,cacheHit:true});
 // Best-effort per-function spending guard (not an account-wide quota).
 if(attempted>=80)return res.status(429).json({available:false,reason:'Beta API request limit reached on this server instance'});
 attempted++;
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),7500);
 try{
  const url='https://aerodatabox.p.rapidapi.com/flights/icao24/'+encodeURIComponent(hex)+'?withLocation=false&withAircraftImage=false';
  const response=await fetch(url,{signal:ctrl.signal,headers:{'X-RapidAPI-Key':key,'X-RapidAPI-Host':'aerodatabox.p.rapidapi.com','Accept':'application/json'}});
  if(response.status===429)return res.status(429).json({available:false,reason:'AeroDataBox usage limit reached'});
  if(!response.ok){let detail='';try{const body=await response.text();detail=body.slice(0,500)}catch{};const code=response.status;const message=code===403?'AeroDataBox denied this API request (403). Check that the RapidAPI subscription is active for this exact key and that the selected Flight Status endpoint is included in the plan.':code===401?'API key not accepted (401). Recheck your RapidAPI key and redeploy.':code===404?'No matching flight data from this endpoint (404).':`AeroDataBox returned HTTP ${code}.`;return res.status(code===403?403:502).json({available:false,reason:message,providerStatus:code,providerMessage:/invalid|subscription|forbidden|quota|unauthoriz|not subscribed|endpoint/i.test(detail)?detail.slice(0,180):null})}
  const flights=await response.json();const all=Array.isArray(flights)?flights:[];
  const now=Date.now();
  const matches=all.filter(f=>{
   const fhex=String(f.aircraft?.modeS||f.aircraft?.icao24||'').toLowerCase();
   const freg=String(f.aircraft?.reg||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
   const fcall=String(f.callSign||f.callsign||'').trim().toUpperCase().replace(/\s/g,'');
   if(fhex&&fhex!==hex)return false;
   if(reg&&freg&&freg!==reg)return false;
   if(callsign&&fcall&&fcall!==callsign)return false;
   if(!(fhex===hex||(reg&&freg===reg)))return false;
   const times=[f.departure?.revisedTime?.utc,f.departure?.scheduledTime?.utc,f.arrival?.revisedTime?.utc,f.arrival?.scheduledTime?.utc].map(x=>Date.parse(x)).filter(Number.isFinite);
   return times.some(t=>t>now-36*3600000&&t<now+18*3600000);
  });
  let result;
  if(matches.length!==1){
   result={available:false,reason:matches.length>1?'Multiple candidate flights matched; cannot safely identify one':'No current flight matched this aircraft and date'};
  }else{
   const f=matches[0],dep=f.departure||{},arr=f.arrival||{};
   result={available:true,origin:apt(dep.airport),destination:apt(arr.airport),
    scheduledDeparture:pickTime(dep.scheduledTime),estimatedDeparture:pickTime(dep.revisedTime),actualDeparture:pickTime(dep.runwayTime),
    scheduledArrival:pickTime(arr.scheduledTime),estimatedArrival:pickTime(arr.revisedTime),actualArrival:pickTime(arr.runwayTime),
    gateOrigin:safe(dep.gate),gateDestination:safe(arr.gate),terminalOrigin:safe(dep.terminal),terminalDestination:safe(arr.terminal),
    status:safe(f.status)||null,matchedRegistration:reg||null,checkedAt:new Date().toISOString(),
    attribution:'Flight-status data: AeroDataBox',note:'AeroDataBox flight-specific match. Gates and timing may change. Revised times are estimates; runway times are not gate times.'};
  }
  if(cache.size>150)cache.clear();
  cache.set(keyCache,{time:Date.now(),data:result});
  return res.status(200).json(result);
 }catch(e){return res.status(503).json({available:false,reason:'AeroDataBox request failed or timed out'})}
 finally{clearTimeout(timer)}
}
