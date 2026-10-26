const TYPES={A20N:'Airbus A320neo',A21N:'Airbus A321neo',A320:'Airbus A320',A321:'Airbus A321',A319:'Airbus A319',A332:'Airbus A330',A333:'Airbus A330',A339:'Airbus A330neo',A359:'Airbus A350',B738:'Boeing 737',B739:'Boeing 737',B38M:'Boeing 737 MAX',B39M:'Boeing 737 MAX',B772:'Boeing 777',B77W:'Boeing 777',B788:'Boeing 787',B789:'Boeing 787',B78X:'Boeing 787',E75L:'Embraer 175',E170:'Embraer 170',E190:'Embraer 190',CRJ9:'CRJ900'};
const ALLOWED=['Delta Air Lines','American Airlines','United Airlines','JetBlue','Southwest Airlines','Frontier Airlines','Spirit Airlines','Alaska Airlines','British Airways','Lufthansa','Air France','KLM','Emirates','Qatar Airways','Air Canada'];
export default async function handler(req,res){
 const airline=String(req.query.airline||''),rawType=String(req.query.type||'').toUpperCase(),model=TYPES[rawType];
 if(!ALLOWED.includes(airline)||!model)return res.status(404).json({error:'No representative photo lookup for this airline and model'});
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),5500);
 try{
  const term=airline+' '+model;
  const url='https://commons.wikimedia.org/w/api.php?'+new URLSearchParams({action:'query',generator:'search',gsrsearch:'filetype:bitmap '+term,gsrnamespace:'6',gsrlimit:'12',prop:'imageinfo',iiprop:'url|extmetadata',iiurlwidth:'680',format:'json',origin:'*'});
  const r=await fetch(url,{signal:controller.signal,headers:{'Accept':'application/json','User-Agent':'AeroScopeONE/0.5 (contact: aeroscopefly@gmail.com)'}});
  if(!r.ok)throw Error('Image source unavailable');
  const data=await r.json(),pages=Object.values(data?.query?.pages||{});
  const a=airline.toLowerCase(),key=model.split(' ').slice(0,2).join(' ').toLowerCase();
  const match=pages.find(p=>{const t=(p.title||'').toLowerCase(),info=p.imageinfo?.[0];return t.includes(a)&&t.includes(key)&&info?.thumburl&&/\.(jpe?g|png)$/i.test((info.url||'').split('?')[0])});
  if(!match)return res.status(404).json({error:'No confirmed photo matching this airline and aircraft model'});
  const i=match.imageinfo[0],meta=i.extmetadata||{};
  res.setHeader('Cache-Control','public, s-maxage=3600, stale-while-revalidate=86400');
  return res.status(200).json({url:i.thumburl,page:i.descriptionurl||'https://commons.wikimedia.org/wiki/'+encodeURIComponent(match.title.replace(/ /g,'_')),credit:(meta.LicenseShortName?.value||'Wikimedia Commons')});
 }catch{return res.status(503).json({error:'Representative aircraft photo source unavailable'})}
 finally{clearTimeout(timeout)}
}