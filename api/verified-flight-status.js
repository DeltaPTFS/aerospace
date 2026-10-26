/*
 * AeroScope ONE — licensed flight-status adapter.
 * Disabled by default. Do not turn on alongside another real-time provider
 * without explicit permission under your FlightAware contract.
 *
 * Set FLIGHTAWARE_API_KEY and FLIGHTAWARE_MIXING_PERMISSION=approved
 * in server-side Vercel environment variables only after authorization.
 */
export default async function handler(req,res) {
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET') return res.status(405).json({available:false,reason:'GET only'});
 const key=process.env.FLIGHTAWARE_API_KEY;
 const permitted=process.env.FLIGHTAWARE_MIXING_PERMISSION==='approved';
 if(!key||!permitted)return res.status(503).json({available:false,reason:'Licensed flight-status integration is not active'});
 const ident=String(req.query.ident||'').trim().toUpperCase();
 const registration=String(req.query.registration||'').trim().toUpperCase().replace(/[-\s]/g,'');
 if(!/^[A-Z0-9-]{3,12}$/.test(ident)||!/^[A-Z0-9]{3,12}$/.test(registration))return res.status(400).json({available:false,reason:'Current callsign and registration are required to verify this flight'});
 const ctl=new AbortController(),timeout=setTimeout(()=>ctl.abort(),5500);
 try{
  const u=new URL('https://aeroapi.flightaware.com/aeroapi/flights/'+encodeURIComponent(ident));
  u.searchParams.set('ident_type','designator');
  u.searchParams.set('max_pages','1');
  const r=await fetch(u,{signal:ctl.signal,headers:{'x-apikey':key,'Accept':'application/json'}});
  if(!r.ok)return res.status(r.status===429?429:503).json({available:false,reason:'Flight-status provider unavailable'});
  const payload=await r.json();
  const now=Date.now();
  const exact=(payload?.flights||[]).filter(x=>{
   const reg=String(x.registration||'').replace(/[-\s]/g,'').toUpperCase();
   if(!reg||reg!==registration||x.blocked||x.cancelled)return false;
   const calls=[x.ident_icao,x.ident,x.atc_ident].filter(Boolean).map(y=>String(y).trim().toUpperCase());
   if(!calls.includes(ident))return false;
   const departure=x.actual_off||x.actual_out||x.estimated_off||x.scheduled_off||x.scheduled_out;
   const d=Date.parse(departure||'');
   // A known aircraft and flight instance; reject schedules far from the present.
   return Number.isFinite(d)&&d>now-36*3600000&&d<now+6*3600000;
  }).sort((a,b)=>{
   const date=x=>Date.parse(x.actual_off||x.actual_out||x.estimated_off||x.scheduled_off||x.scheduled_out);
   return Math.abs(date(a)-now)-Math.abs(date(b)-now);
  });
  if(exact.length!==1 || !exact[0]?.fa_flight_id){
   return res.status(200).json({available:false,reason:'No single current flight matched both callsign and aircraft registration'});
  }
  const f=exact[0],ap=x=>x?{code:x.code_iata||x.code_icao||x.code||null,name:x.name||null,timeZone:x.timezone||null}:null;
  const out={
   available:true,verifiedByRegistration:true,flightId:String(f.fa_flight_id),
   callsign:ident,registration,
   origin:ap(f.origin),destination:ap(f.destination),
   scheduledDeparture:f.scheduled_out||f.scheduled_off||null,
   actualDeparture:f.actual_out||f.actual_off||null,
   estimatedDeparture:f.estimated_out||f.estimated_off||null,
   scheduledArrival:f.scheduled_in||f.scheduled_on||null,
   estimatedArrival:f.estimated_in||f.estimated_on||null,
   actualArrival:f.actual_in||f.actual_on||null,
   gateOrigin:f.gate_origin||null,gateDestination:f.gate_destination||null,
   terminalOrigin:f.terminal_origin||null,terminalDestination:f.terminal_destination||null,
   status:f.status||null,
   source:'FlightAware AeroAPI',attribution:'Contains AeroAPI data © FlightAware LLC '+new Date().getFullYear(),
   checkedAt:new Date().toISOString()
  };
  // Cache flight status briefly to control AeroAPI billing.
  res.setHeader('Cache-Control','public, s-maxage=90, stale-while-revalidate=20');
  return res.status(200).json(out);
 }catch(e){return res.status(503).json({available:false,reason:'Flight-status service temporarily unavailable'})}
 finally{clearTimeout(timeout)}
}
