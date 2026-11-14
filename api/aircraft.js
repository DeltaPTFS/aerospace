export default async function handler(req,res){
 // Lightweight, no-provider-call diagnostic: confirms the deployment received
 // the secret without printing it or consuming an adsb.lol API request.
 if(req.query.health==='1'){
  res.setHeader('Cache-Control','no-store');
  return res.status(200).json({
   service:'AeroScope ONE aircraft API',
   revision:'radar-auth-diagnostic-2026-11-14',
   keyConfigured:Boolean(process.env.ADSB_LOL_API_KEY),
   keyStoredOnServer:true,
   dataEndpoint:'/api/aircraft?lat=18.4&lon=-69.7',
   note:'This check does not contact the aircraft provider or validate the API key.'
  });
 }
 const lat=Number(req.query.lat),lon=Number(req.query.lon);
 if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return res.status(400).json({error:'Invalid coordinates'});
 const apiKey=process.env.ADSB_LOL_API_KEY||'';
 const endpoints=[
  {name:'adsb.lol',url:`https://api.adsb.lol/v2/point/${lat.toFixed(1)}/${lon.toFixed(1)}/250`},
  {name:'adsb.one',url:`https://api.adsb.one/v2/point/${lat.toFixed(3)}/${lon.toFixed(3)}/250`}
 ];
 const errors=[];
 for(const feed of endpoints){
  const ctrl=new AbortController();const timeout=setTimeout(()=>ctrl.abort(),6500);
  try{
   const response=await fetch(feed.url,{signal:ctrl.signal,headers:{Accept:'application/json','User-Agent':'AeroScopeONE/0.4 (aeroscope-one.vercel.app; contact aeroscopefly@gmail.com)',...(feed.name==='adsb.lol'&&apiKey?{'x-api-key':apiKey}:{})}});
   if(response.status===429){
    const retry=Number(response.headers.get('retry-after'))||300;
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Retry-After',String(Math.max(30,Math.min(3600,retry))));
    return res.status(429).json({error:'Aircraft provider quota reached',retryAfterSeconds:Math.max(30,Math.min(3600,retry)),provider:feed.name});
   }
   if(!response.ok)throw Error('HTTP '+response.status);
   const data=await response.json();if(!Array.isArray(data.ac))throw Error('Missing aircraft list');
   // Only return aircraft with a recent reported position. Do not label old
   // transponder reports as live just because this API request was recent.
   const fresh=data.ac.filter(a=>{
    if(!Number.isFinite(a?.lat)||!Number.isFinite(a?.lon))return false;
    const age=Number(a.seen_pos);
    return Number.isFinite(age)&&age>=0&&age<=75;
   });
   res.setHeader('Cache-Control','public, s-maxage=30, stale-while-revalidate=30');
   return res.status(200).json({
    ac:fresh,source:feed.name,now:data.now||Date.now(),total:data.total??data.ac.length,
    recentCount:fresh.length,maxPositionAgeSec:75,servedAt:new Date().toISOString(),
    feedTier:apiKey?'configured-key':'limited-anonymous',
    coverage:'Receiver-dependent regional ADS-B/MLAT; not every aircraft is observable.'
   });
  }catch(e){errors.push(feed.name+' '+(e.name==='AbortError'?'timed out':e.message))}
  finally{clearTimeout(timeout)}
 }
 res.setHeader('Cache-Control','no-store');
 return res.status(503).json({error:'Aircraft feed temporarily unavailable',details:errors.join(' | '),keyConfigured:Boolean(apiKey),revision:'radar-auth-diagnostic-2026-11-14'});
}