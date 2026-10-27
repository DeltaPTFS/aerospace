// AeroScope in-site ATC library metadata. Only rights-cleared audio belongs here.
// Actual audio must be hosted on AeroScope's own approved origin with appropriate licenses.
// Premium assets MUST be served behind authenticated server-side entitlement checks.
const approvedFree=[];
const approvedEmergencies=[];
export default function handler(req,res){
 res.setHeader('Cache-Control','public, s-maxage=120');
 if(req.method!=='GET')return res.status(405).json({error:'GET only'});
 // Never return protected premium audio URLs to unauthenticated clients.
 return res.status(200).json({free:approvedFree,emergencies:approvedEmergencies,premiumCount:0,liveAvailable:false,note:'Licensed/owned ATC recordings only. Aircraft-specific audio requires an independently verified recording and subscription entitlement.'});
}
