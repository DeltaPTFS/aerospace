// A callsign-only route is not sufficient to establish a specific flight's route.
// This endpoint intentionally suppresses unverified historical route matches.
export default function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 return res.status(200).json({available:false,verified:false,reason:'A live flight-specific schedule source is required; historical callsign matches are not reliable for today.'});
}
