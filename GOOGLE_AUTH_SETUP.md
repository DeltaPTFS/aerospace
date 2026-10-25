# AeroScope ONE — Enable Google Sign-In

The AeroScope login and profile UI is built and published, but real sign-in needs a Firebase project.

## Firebase setup (parent/guardian or adult project administrator recommended)

1. Open https://console.firebase.google.com/ and create/select a project for AeroScope ONE.
2. Under **Build → Authentication → Sign-in method**, enable **Google** and select a support email.
3. In Authentication → Settings → Authorized domains, include **aerospace-iota.vercel.app**. Do not add wildcard domains.
4. In Project Settings → Your apps, register a **Web app** and copy its **Firebase configuration** (apiKey, authDomain, projectId, appId, plus any other standard public config fields).
5. Create **firebase-config.json** in the web project's root with the Firebase Web App configuration:

```json
{
  "apiKey": "YOUR_FIREBASE_WEB_API_KEY",
  "authDomain": "YOUR_PROJECT.firebaseapp.com",
  "projectId": "YOUR_PROJECT",
  "appId": "YOUR_APP_ID"
}
```

Only include public web app configuration values. Never upload Google OAuth client secrets, Firebase Admin private keys, service-account JSON, or billing credentials.

6. Deploy through the GitHub/Vercel workflow and open https://aerospace-iota.vercel.app/login.
7. Test login and sign-out on mobile and desktop. In browsers with restrictive cross-site storage, Firebase redirect sign-in may require extra configuration (custom auth domain or redirect handling) beyond adding authorized domains.

## Implemented routes
- **/**: Main radar, now links to **My Account**.
- **/login**: Google Sign-In. Disabled until Firebase configuration exists.
- **/profile**: Protected profile view controlled by Firebase Auth. Users who aren't signed in see a sign-in invitation.

## Important limitations
- Profile preferences save to **localStorage on the current device only**; they do not synchronize between devices.
- Account identity is handled by Firebase Authentication, but no Firestore data storage or user-database rules are deployed.
- A subscription system, payments, and Premium access controls have **not** been implemented.
- Production launch requires reviewing the privacy policy against actual collection and any new providers.
- Firebase web configuration is public by design; Firebase security rules, provider settings and API key restrictions must be set correctly.

## Troubleshooting
- “Google sign-in has not been configured yet”: firebase-config.json is missing from the deployed root.
- “auth/unauthorized-domain”: add the exact domain to Firebase authorized domains.
- Redirect loops or failure on Safari/iPhone: see Firebase's redirect best practices and consider hosting auth on the same origin.
- Account information not appearing: ensure authentication finished and the /profile route is deployed.
