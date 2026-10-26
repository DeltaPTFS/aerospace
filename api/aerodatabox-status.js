// AeroScope ONE — flight-specific AeroDataBox lookup. Key stays server-side.
// Beta usage: automatic requests are limited on the client; provider quotas still apply.
export default async function handler(req,res){
  try {
    res.setHeader('Cache-Control','private, no-store');
    if(req.method!=='GET')return res.status(405).json({available:false,reason:'GET only'});
    const key=process.env.AERODATABOX_API_KEY;
    if(!key)return res.status(503).json({available:false,reason:'AERODATABOX_API_KEY is missing in this deployment'});
    const hex=String(req.query?.hex||'').toLowerCase().trim();
    const callsign=String(req.query?.callsign||'').toUpperCase().replace(/\s/g,'');
    const registration=String(req.query?.registration||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
    if(!/^[0-9a-f]{6}$/.test(hex))return res.status(400).json({available:false,reason:'Valid 6-character ICAO hex required'});
    const byCallsign=/^[A-Z]{2,4}[0-9]{1,5}[A-Z]?$/.test(callsign);
    const target=byCallsign?'callsign/'+encodeURIComponent(callsign):'icao24/'+encodeURIComponent(hex);
    const uri='https://aerodatabox.p.rapidapi.com/flights/'+target+'?withAircraftImage=false&withLocation=false&withFlightPlan=false';
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),8000);
    let response;
    try {
      response=await fetch(uri,{signal:controller.signal,headers:{'X-RapidAPI-Key':key,'X-RapidAPI-Host':'aerodatabox.p.rapidapi.com',Accept:'application/json'}});
    } catch(e) {
      return res.status(502).json({available:false,reason:e?.name==='AbortError'?'Flight provider timed out':'Unable to connect to flight provider',errorType:e?.name||'NetworkError'});
    } finally {clearTimeout(timer)}
    if(response.status===204)return res.status(200).json({available:false,reason:'Provider returned no matching flight (204)'});
    if(!response.ok){
      const detail=(await response.text().catch(()=>'' )).slice(0,250);
      return res.status(502).json({available:false,reason:'Flight provider returned HTTP '+response.status,providerStatus:response.status,providerMessage:/not subscribed|subscription|forbidden|quota|limit|restricted|legal|permission/i.test(detail)?detail:null});
    }
    let payload;
    try{payload=await response.json()}catch{return res.status(502).json({available:false,reason:'Provider response was not JSON'})}
    const records=Array.isArray(payload)?payload:[];
    const matches=records.filter(f=>{
      const fhex=String(f?.aircraft?.modeS||f?.aircraft?.icao24||'').toLowerCase();
      const freg=String(f?.aircraft?.reg||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
      const fcall=String(f?.callSign||f?.callsign||'').toUpperCase().replace(/\s/g,'');
      if(fhex&&fhex!==hex)return false;
      if(registration&&freg&&freg!==registration)return false;
      if(callsign&&fcall&&fcall!==callsign)return false;
      // Flight numbers are reused: demand an independently matching aircraft identity.
      if(!(fhex===hex||(registration&&freg===registration)))return false;
      const values=[f?.departure?.scheduledTime?.utc,f?.departure?.revisedTime?.utc,f?.arrival?.scheduledTime?.utc,f?.arrival?.revisedTime?.utc].map(Date.parse).filter(Number.isFinite);
      const now=Date.now();
      return values.some(t=>t>now-36*3600000&&t<now+18*3600000);
    });
    if(matches.length!==1)return res.status(200).json({available:false,reason:matches.length?'Ambiguous flight match':'No independently verified current aircraft match'});
    const f=matches[0],dep=f.departure||{},arr=f.arrival||{};
    const apt=a=>a?{code:a.iata||a.icao||null,name:a.name||null,timeZone:a.timeZone||null}:null;
    return res.status(200).json({
      available:true,origin:apt(dep.airport),destination:apt(arr.airport),
      scheduledDeparture:dep.scheduledTime?.utc||null,estimatedDeparture:dep.revisedTime?.utc||null,actualDeparture:dep.runwayTime?.utc||null,
      scheduledArrival:arr.scheduledTime?.utc||null,estimatedArrival:arr.revisedTime?.utc||null,actualArrival:arr.runwayTime?.utc||null,
      gateOrigin:dep.gate||null,gateDestination:arr.gate||null,status:f.status||null,
      checkedAt:new Date().toISOString(),attribution:'Flight-status data: AeroDataBox',
      note:'Verified flight-instance data; times and gates may change.'
    });
  } catch(e) {
    return res.status(500).json({available:false,reason:'AeroScope flight-status handler failed',errorType:e?.name||'Error'});
  }
}
