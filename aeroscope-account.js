/* AeroScope ONE signed-in device preferences.
 * Public Firebase config and browser-only preferences; no location coordinates are stored.
 */
import {initializeApp,getApps} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import {getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
const PREF_PREFIX='aeroscope-live-prefs-v1-';
function prefsFor(uid){
 let prefs={};try{prefs=JSON.parse(localStorage.getItem(PREF_PREFIX+uid)||'{}')}catch{}
 return {location:prefs.location!==false,alerts:prefs.alerts!==false};
}
function publish(user){
 const state={signedIn:Boolean(user),uid:user?.uid||null,preferences:user?prefsFor(user.uid):{location:false,alerts:false}};
 window.AeroScopeAccount=state;
 window.dispatchEvent(new CustomEvent('aeroscope-account-state',{detail:state}));
}
window.AeroScopeSaveLivePrefs=(updates)=>{
 const state=window.AeroScopeAccount;
 if(!state?.signedIn||!state.uid)return false;
 const next={...prefsFor(state.uid),...updates};
 try{localStorage.setItem(PREF_PREFIX+state.uid,JSON.stringify(next))}catch{return false}
 publish({uid:state.uid});
 return true;
};
try{
 const r=await fetch('/firebase-config.json',{cache:'default'});
 if(!r.ok)throw Error('Missing Firebase configuration');
 const cfg=await r.json();
 if(!cfg.apiKey||!cfg.projectId||!cfg.authDomain||!cfg.appId)throw Error('Incomplete Firebase configuration');
 const app=getApps()[0]||initializeApp(cfg);
 onAuthStateChanged(getAuth(app),publish,()=>publish(null));
}catch{publish(null)}
