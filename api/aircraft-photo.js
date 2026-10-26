// AeroScope ONE aircraft imagery: registration photo first, then labeled representative image.
const MODEL={
 E75L:['Embraer 175','Embraer E175','ERJ-175'],E75S:['Embraer 175','Embraer E175'],
 E170:['Embraer 170'],E190:['Embraer 190'],E195:['Embraer 195'],E290:['Embraer E190 E2'],
 CRJ2:['Canadair CRJ200'],CRJ7:['Bombardier CRJ700'],CRJ9:['Bombardier CRJ900'],
 A318:['Airbus A318'],A319:['Airbus A319'],A320:['Airbus A320'],A321:['Airbus A321'],A20N:['Airbus A320neo'],A21N:['Airbus A321neo'],
 A332:['Airbus A330'],A333:['Airbus A330'],A339:['Airbus A330neo'],A359:['Airbus A350'],A35K:['Airbus A350'],A388:['Airbus A380'],
 B712:['Boeing 717'],B737:['Boeing 737'],B738:['Boeing 737-800','Boeing 737'],B739:['Boeing 737-900','Boeing 737'],B38M:['Boeing 737 MAX 8'],B39M:['Boeing 737 MAX 9'],
 B752:['Boeing 757'],B753:['Boeing 757'],B763:['Boeing 767'],B764:['Boeing 767'],B772:['Boeing 777'],B77W:['Boeing 777'],B744:['Boeing 747'],
 B788:['Boeing 787'],B789:['Boeing 787'],B78X:['Boeing 787'],C172:['Cessna 172'],C152:['Cessna 152'],C182:['Cessna 182'],
 C208:['Cessna 208'],C206:['Cessna 206'],C525:['Cessna Citation'],C560:['Cessna Citation'],C680:['Cessna Citation'],
 P28A:['Piper PA-28'],PA28:['Piper PA-28'],PA32:['Piper PA-32'],PC12:['Pilatus PC-12'],PC24:['Pilatus PC-24'],
 DA40:['Diamond DA40'],DA42:['Diamond DA42'],BE20:['Beechcraft King Air'],BE9L:['Beechcraft King Air'],B350:['Beechcraft King Air'],
 GLF4:['Gulfstream'],GLF5:['Gulfstream'],GLF6:['Gulfstream'],H60:['Sikorsky UH-60'],R44:['Robinson R44'],R22:['Robinson R22'],
 AS50:['Eurocopter AS350'],EC35:['Airbus H135'],SR22:['Cirrus SR22'],SR20:['Cirrus SR20'],AT72:['ATR 72'],AT76:['ATR 72'],DH8D:['Dash 8 Q400']
};
function safeString(v,n=90){return String(v||'').trim().slice(0,n)}
async function fetchJson(url,ms=4200){const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),ms);try{const r=await fetch(url,{signal:controller.signal,headers:{Accept:'application/json','User-Agent':'AeroScopeONE/0.6 (+https://aeroscope-one.vercel.app; aeroscopefly@gmail.com)'}});if(!r.ok)throw Error('provider HTTP '+r.status);return await r.json()}finally{clearTimeout(timeout)}}
function safeHttp(v){return typeof v==='string'&&/^https:\/\//.test(v)?v:null}
function commonsSearch(query,limit=12){
 const opts=new URLSearchParams({action:'query',generator:'search',gsrsearch:query,gsrnamespace:'6',gsrlimit:String(limit),prop:'imageinfo',iiprop:'url|extmetadata',iiurlwidth:'700',format:'json'});
 return 'https://commons.wikimedia.org/w/api.php?'+opts;
}
function normalized(v){return String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,' ')}
function isRaster(p){return /\.(?:jpe?g|png|webp)$/i.test(p.imageinfo?.[0]?.url?.split('?')[0]||'')}
function matchesType(title,type,model){
 const t=normalized(title),code=type.toLowerCase();const family=model.toLowerCase();
 const tokens=[code,family,...(MODEL[type]||[]).map(normalized)];
 if(/^e75/.test(code))tokens.push('erj 175','e 175','e175','175','erj175');
 if(/^crj/.test(code))tokens.push('crj 900','crj900','crj 700','crj700');
 if(/^c1/.test(code))tokens.push('cessna');
 return tokens.some(k=>k.length>2&&t.includes(k)) || (family.split(' ').length>1&&t.includes(family.split(' ').at(-1)));
}
async function commonsPhoto(airline,type,model){
 const plans=[];
 if(airline)plans.push({query:airline+' '+model,needAirline:true});
 plans.push({query:model+' aircraft',needAirline:false});
 for(const plan of plans){
  try{
   const data=await fetchJson(commonsSearch(plan.query),3900);
   const pages=Object.values(data?.query?.pages||{}).filter(p=>p.imageinfo?.[0]?.thumburl&&isRaster(p));
   const candidate=pages.find(p=>{
    const title=normalized(p.title);
    const airlineName=normalized(airline);
    let hasAirline=airline&&title.includes(airlineName);
    if(airline==='Republic Airways')hasAirline=/republic (airways|airlines)/.test(title);
    if(airline==='American Airlines')hasAirline=/american (airlines|eagle)/.test(title);
    return matchesType(p.title,type,model)&&(!plan.needAirline||hasAirline);
   });
   if(!candidate)continue;
   const img=candidate.imageinfo[0];
   return {url:img.thumburl,page:img.descriptionurl,credit:'Wikimedia Commons • '+(img.extmetadata?.LicenseShortName?.value||'see image license'),kind:plan.needAirline?'same-airline-model':'type-only',model,airline:plan.needAirline?airline:''};
  }catch{}
 }
 return null;
}
export default async function handler(req,res){
 const hex=safeString(req.query.hex,6).toLowerCase(),reg=safeString(req.query.reg,15).toUpperCase(),type=safeString(req.query.type,5).toUpperCase(),airline=safeString(req.query.airline);
 if(!/^[a-f0-9]{6}$/.test(hex)&&!/^[A-Z0-9-]{3,15}$/.test(reg)&&!type)return res.status(400).json({error:'Aircraft ID or type is required'});
 const model=MODEL[type]?.[0]||(/^[A-Z0-9]{2,5}$/.test(type)?type:'Aircraft');
 let result=null;
 if(/^[a-f0-9]{6}$/.test(hex)){
  try{
   const qs=new URLSearchParams();if(reg)qs.set('reg',reg);if(type)qs.set('icaoType',type);
   const p=await fetchJson('https://api.planespotters.net/pub/photos/hex/'+hex+'?'+qs,3600);
   const photo=p?.photos?.find(x=>safeHttp(x?.thumbnail_large?.src)||safeHttp(x?.thumbnail?.src));
   if(photo)result={url:safeHttp(photo.thumbnail_large?.src)||safeHttp(photo.thumbnail?.src),page:safeHttp(photo.link)||'https://www.planespotters.net/',credit:'© '+(photo.photographer||'photographer')+' / Planespotters.net',kind:'registration',model,airline};
  }catch{}
 }
 if(!result)result=await commonsPhoto(airline,type,model);
 res.setHeader('Cache-Control','public, s-maxage=3600, stale-while-revalidate=86400');
 if(result)return res.status(200).json(result);
 const searchTerm=[airline,model].filter(Boolean).join(' ')||type||reg||hex;
 return res.status(200).json({url:null,kind:'unavailable',model,searchPage:'https://commons.wikimedia.org/w/index.php?search='+encodeURIComponent(searchTerm)+'&title=Special:MediaSearch&type=image'});
}