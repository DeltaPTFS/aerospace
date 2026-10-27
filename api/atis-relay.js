// AeroScope ONE: optional ATIS Relay airport-information adapter.
// Free ATIS Relay keys are for personal testing; public-app display requires
// ATIS Relay's Commercial API terms. Fail closed until explicitly enabled.
// The key never reaches visitors. No visitor IP, location or account data is stored here.
const cache=new Map();
let nextAllowedAt=0,minuteCalls=[];
const notice='Unofficial. Not for operational use. Confirm on frequency.';
const tidy=v=>typeof v==='string'?v.trim().slice(0,6000):'';
const parseEntry=x=>x&&typeof x==='object'?{
  code:tidy(x.atisCode||x.letter||'').slice(0,8),
  text:tidy(x.dataBody||''),
  observed:typeof x.timestamp==='number'?new Date(x.timestamp).toISOString():null
}:null;
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).json({available:false,reason:'GET only'});
 const icao=String(req.query?.icao||'').trim().toUpperCase();
 if(!/^[A-Z0-9]{4}$/.test(icao))return res.status(400).json({available:false,reason:'Enter a four-character ICAO airport code, e.g. KJFK.'});
 const configured=Boolean(process.env.ATIS_RELAY_API_KEY);
 if(!configured)return res.status(200).json({available:false,configured:false,enabled:false,reason:'ATIS Relay API key has not been configured for this deployment.',notice});
 if(process.env.ATIS_RELAY_COMMERCIAL_ENABLED!=='true'){
  // Deliberately no upstream calls from a public website on a personal-only key.
  return res.status(200).json({available:false,configured:true,enabled:false,reason:'ATIS Relay is connected for a future authorized integration. Public display requires its Commercial API plan; the personal key cannot power a public site.',notice});
 }
 const prior=cache.get(icao);
 if(prior&&Date.now()-prior.at<3*60000)return res.status(200).json(prior.data);
 if(Date.now()<nextAllowedAt)return res.status(200).json({available:false,configured:true,enabled:true,reason:'ATIS Relay is rate-limiting requests. Please try again later.',notice});
 minuteCalls=minuteCalls.filter(t=>Date.now()-t<60000);
 if(minuteCalls.length>=8)return res.status(200).json({available:false,configured:true,enabled:true,reason:'Airport information updates are limited to protect the shared API quota. Try again shortly.',notice});
 minuteCalls.push(Date.now());
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),6500);
 try{
  const r=await fetch('https://atisrelay.com/api/atis_relay_airport?icao='+encodeURIComponent(icao),{
   signal:controller.signal,headers:{'X-Api-Key':process.env.ATIS_RELAY_API_KEY,'Accept':'application/json','User-Agent':'AeroScopeONE/1.0 (aeroscope-one.vercel.app; contact: aeroscopefly@gmail.com)'}
  });
  if(r.status===429){
   const seconds=Math.min(3600,Math.max(60,Number(r.headers.get('Retry-After'))||60));
   nextAllowedAt=Date.now()+seconds*1000;
   return res.status(200).json({available:false,configured:true,enabled:true,reason:'ATIS Relay rate limit reached. Try again later.',notice});
  }
  if(!r.ok)return res.status(200).json({available:false,configured:true,enabled:true,reason:'ATIS Relay returned HTTP '+r.status+'.',notice});
  const raw=await r.json();
  const d=raw?.datis||{};
  const result={
   available:true,configured:true,enabled:true,icao,airport:tidy(raw?.airport?.name||''),
   metar:tidy(raw?.metar?.report||''),
   flightRules:tidy(raw?.metar?.flight_rules||'').slice(0,24),
   atis:parseEntry(d.atis),departure:parseEntry(d.departure),arrival:parseEntry(d.arrival),
   transcript:tidy(raw?.transcript||''),
   transcriptLetter:tidy(raw?.transcript_letter||'').slice(0,8),
   transcriptAt:Number.isFinite(raw?.transcript_valid_time)?new Date(raw.transcript_valid_time*1000).toISOString():null,
   audioAvailable:false, // ATIS audio is paid; never expose upstream signed URLs.
   attribution:'ATIS Relay',notice:notice,
   checkedAt:new Date().toISOString()
  };
  if(cache.size>120)cache.clear();
  cache.set(icao,{at:Date.now(),data:result});
  return res.status(200).json(result);
 }catch(e){
  return res.status(200).json({available:false,configured:true,enabled:true,reason:e?.name==='AbortError'?'ATIS Relay timed out.':'Unable to retrieve airport ATIS at this time.',notice});
 }finally{clearTimeout(timer)}
}
