# Anime Sentence Library — app

The claude.ai artifact, restructured as a real static web app: plain files, no build
step. For how to publish it (Firebase, R2, 99helpers), see **DEPLOY.md**.

## Project structure

```
index.html        shell: <head>, Firebase SDK tags, and the script list — load order matters
css/app.css       all styles (the original inline <style> blocks, plus the sign-in card)
js/00-config.js   THE ONLY FILE TO EDIT BEFORE PUBLISHING (Firebase keys + audio URL)
js/01..23-*.js    app code, one file per section (same order as the original single
                  file, so all globals resolve exactly as they did before):
  01-core         $, esc, LS wrapper, app state S, icons, review bucket / lists
  02-kanji-helpers  kanji state (stories, picks, highlight rules)
  03-data         loading data/index.json etc.
  04-speech       speechSynthesis + audio playback helpers
  05-lines        the lines (episode reading) view
  06-corpus       every line of every group; word/kanji derivation
  07-kanji-index  kanji highlight defaults
  08-words-names  word library, loanwords, names, scheduling
  09-listening    listening drills + recorded audio packs (Cache API, AUDIO_BASE)
  10-words-page   words page blocks, review/listen panel
  11-kanji-map    kanji grid
  12-highlight-options  word highlighting in lines + options page wiring
  13-time         exclusions, study order, per-line flags
  14-backup       export/import JSON backup
  15-progress     header progress bars (words/kanji stages)
  16-stats        stats graph + tables
  17-catalog-srs  started-cards catalog + SRS document storage
  18-review       review tab + review session
  19-word-reviews word block reviews (JP→EN, EN→JP)
  20-custom       episodes you add yourself (+ Episode editor)
  21-routing      URL routing, tabs, header/strip wiring
  22-db           Firebase adapter + sign-in (Firestore, paths under users/<uid>/)
  23-main         boot: load index, apply custom episodes, route, connect store
data/             episodes, lemmas, forms (small JSONs — ship with the site)
data/audio/       recorded packs (~19 MB) — LOCAL DEV ONLY, never uploaded to the host
README.md         this file
DEPLOY.md         step-by-step: Firebase + R2 setup, publishing, migration
```

## How the pieces fit

- **Storage:** progress lives in Firebase Firestore (per-user path), mirrored to
  browser localStorage for instant load and offline use. Without a Firebase config
  (or if you skip signing in) the app runs on this device only.
- **Audio:** `js/00-config.js` → `AUDIO_BASE` decides where recorded packs come from:
  `data/audio/` locally, an R2 bucket in production. Files are cached on the device
  after first download (Cache API), so phone and PC each fetch them once.
- **Load order:** the JS files are classic scripts sharing one global scope, listed in
  `index.html` in the original file's section order — keep that order when renaming
  or adding files.

## Local development

```
cd app
python -m http.server 8000
```

Open http://localhost:8000 . Everything works without Firebase; sync stays off until
`js/00-config.js` has real credentials.
