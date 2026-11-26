# DEPLOY — porting the app to the free stack

What to do once, in order: Firebase (progress sync) → Cloudflare R2 (audio) →
publish to 99helpers → migrate your old progress. Everything below is on free tiers,
no credit card. Total time: ~30 minutes.

## 1. Firebase — accounts and progress sync

1. console.firebase.google.com → **Add project** (name it, analytics optional).
2. **Build → Authentication → Get started → Email/Password → Enable → Save.**
3. **Build → Firestore Database → Create database** — pick a location, start in
   *production mode*.
4. Firestore → **Rules** tab — replace with this and publish:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

   This is what makes the database safe on a public URL: every signed-in user can
   touch only their own `users/<their-id>/…` subtree, nobody else's.
5. Project settings (gear) → **Your apps → Web (`</>`)** → register a app, copy the
   shown `firebaseConfig` values into `js/00-config.js` (replace every `PASTE_*`).

Free tier: 1 GiB stored, tens of thousands of reads/writes per day — years of
personal use. First sign-in on the site creates the account; each device stays
signed in until you sign out.

## 2. Cloudflare R2 — hosting the audio packs

`data/audio/` (~19 MB) does not fit the 99helpers free plan (10 MB), so it goes to
R2 (10 GB free, free reads):

1. dash.cloudflare.com → free account → **R2 Object Storage → Create bucket**
   (e.g. `asl-audio`).
2. Upload the **contents** of `app/data/audio/` (the .mp3 files + index.json) into a
   folder `audio/` in the bucket.
3. Bucket → **Settings → Public access**: enable the `r2.dev` URL and copy it
   (looks like `https://pub-xxxxxxxx.r2.dev`).
4. Bucket → **Settings → CORS policy** — paste:

```json
[ { "AllowedOrigins": ["*"], "AllowedMethods": ["GET"], "AllowedHeaders": ["*"] } ]
```

5. In `js/00-config.js` set
   `AUDIO_BASE = 'https://pub-xxxxxxxx.r2.dev/audio/'` (keep the trailing slash).

The app downloads each pack once per device and keeps it in the browser Cache API,
so the bucket is barely used afterwards — phone and PC both play offline.

## 3. Publish to 99helpers

1. Zip the `app` folder **without `data/audio/`** (index.html, css/, js/, data/
   without audio, README/DEPLOY — about 2 MB).
2. 99helpers.com → host a website → drop the zip → pick the address → publish.
3. Open the site, sign in (Create account) — ticks and reviews now sync to Firebase.
4. Updates later: republish a new zip to the same address (link never changes; last
   5 versions kept for rollback). If a change doesn't appear: Ctrl+F5, and consider
   bumping `?v=N` on the changed `<script>` tag in index.html to bust caches.

## 4. Migrate your old progress

1. Open the old artifact (the one in `versions/1795506106-2501/`, served over HTTP
   locally) → **Options → back up → export** → saves a JSON file.
2. On the new site → **Options → import** → confirm. Everything (ticks, SRS cards,
   settings, custom episodes) moves into Firestore.
3. Do this signed in on the device where you want the data; other devices get it
   from the cloud automatically.

## 5. Adding a new episode later

- Episodes are JSON files in `data/` — `jojo-p1-e01.json` is the schema example
  (lines with timestamps, JP tokens, base forms, translation).
- Word audio for new episodes: VOICEVOX (Japanese) + Kokoro (English) on your PC —
  the same engines used originally (recorded in `data/audio/index.json` → `voice`).
  Generate clips for **new words only**, reuse existing packs for everything else,
  extend `index.json`, upload new packs to the R2 bucket, ship the episode JSON
  with the site.
- One-off custom episodes can be added in the app itself (**+ Episode**) — they are
  stored per-account in Firestore, no deploy needed.
