export default async function handler(req,res){
 const callsign=String(req.query.callsign||'').trim().toUpperCase();
 if(!/^[A-Z0-9-]{3,12}$/.test(callsign))return res.status(400).json({error:'A valid callsign is required'});
 const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),5500);
 try{
  const response=await fetch('https://api.adsbdb.com/v0/callsign/'+encodeURIComponent(callsign),{signal:ctl.signal,headers:{Accept:'application/json','User-Agent':'AeroScopeONE/0.7 (aeroscope-one.vercel.app)'}});
  if(!response.ok)throw Error('No route available');
  const body=await response.json(),route=body?.response?.flightroute;
  if(!route?.origin||!route?.destination)return res.status(200).json({available:false,reason:'No reported route for this callsign'});
  const airport=x=>({name:String(x?.name||''),city:String(x?.municipality||''),iata:String(x?.iata_code||''),icao:String(x?.icao_code||'')});
  res.setHeader('Cache-Control','public,s-maxage=600,stale-while-revalidate=1800');
  return res.status(200).json({available:true,origin:airport(route.origin),destination:airport(route.destination),airline:route.airline?.name||null,note:'Route database match, not a confirmed flight plan. Route may be historical or reused.'});
 }catch{return res.status(200).json({available:false,reason:'Route not found or provider unavailable'})}
 finally{clearTimeout(t)}
}