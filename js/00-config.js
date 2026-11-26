/* Deployment configuration — the only file you must edit before publishing. */

/* Firebase web app credentials: Firebase console → Project settings → Your apps → SDK setup and configuration.
   The apiKey is not a secret (it identifies the project); access is controlled by Firestore security rules. */
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCzQVlvH7E1JfTVmNDvAuocSENTKZYyNCc',
  authDomain: 'japanese-library.firebaseapp.com',
  projectId: 'japanese-library',
  storageBucket: 'japanese-library.firebasestorage.app',
  messagingSenderId: '901822926734',
  appId: '1:901822926734:web:8edfd2e65dd510ef1ddedf'
};

/* Where data/audio/* (index.json, packs, cues) is fetched from.
   Local development: 'data/audio/' — the copy inside this folder.
   Production (99helpers free plan is too small for the audio): your Cloudflare R2 bucket,
   e.g. 'https://pub-xxxxxxxxxxxx.r2.dev/audio/' — trailing slash required. */
const AUDIO_BASE = 'data/audio/';
