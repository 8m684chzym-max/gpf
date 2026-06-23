# Scorecard image fix (iPhone HEIC photos)

## What was broken
Photos from the iPhone camera roll are **HEIC**. The app read the raw bytes and
sent them to Anthropic labelled as `image/jpeg` (because `SUPPORTED_TYPES` in
`src/lib/anthropic.js` doesn't include HEIC). Anthropic rejected the mismatch,
which surfaced as **"Couldn't read that image."** "Take a photo" worked only
because the camera captures straight to JPEG.

## The fix
A new client helper converts whatever the user picks into a real JPEG (in a
canvas) before upload. iOS Safari decodes HEIC into an `<img>` natively, so this
works on-device. Bonus: it fixes EXIF rotation and shrinks the upload, so the
~7.5 MB server limit is never hit. PDFs pass straight through.

No new npm packages. No server changes required.

---

## Step 1 — add the new file
Copy `src/lib/scorecardImage.js` (included in this zip) into your repo at the
same path: `src/lib/scorecardImage.js`.

## Step 2 — two edits in `src/app/(app)/submit/page.jsx`

### Edit A — add the import
Near the top, next to `import { api } from "@/lib/client";`, add:

```js
import { prepareScorecardImage } from "@/lib/scorecardImage";
```

### Edit B — use it inside `handleFile`
Find these two lines:

```js
      const imageBase64 = await fileToB64(file);
      const r = await api("/api/scorecard/extract", { method: "POST", body: JSON.stringify({ imageBase64, mediaType: file.type }) });
```

Replace them with:

```js
      const { base64: imageBase64, mediaType } = await prepareScorecardImage(file);
      const r = await api("/api/scorecard/extract", { method: "POST", body: JSON.stringify({ imageBase64, mediaType }) });
```

That's the whole fix. `fileToB64` is now unused — you can delete it or leave it.

---

## Optional — the earlier UI cleanup (remove the redundant "Files" button)
Still in `src/app/(app)/submit/page.jsx`.

Remove the third button so only "Take a photo" and "Camera roll" remain:

```jsx
            <button className="btn btn-ghost" type="button" onClick={() => filesRef.current?.click()}><FileText size={15} /> Files (JPG, PNG, PDF)</button>
```

Remove its hidden input:

```jsx
        <input ref={filesRef} type="file" accept="image/jpeg,image/png,application/pdf" hidden onChange={pick} />
```

And the now-unused ref declaration `const filesRef = useRef();`.

(The `prepareScorecardImage` helper still handles PDFs correctly if you keep the
Files button, so this step is purely cosmetic.)

---

## How to test
1. Apply the changes and run locally (`npm run dev`) or deploy to Vercel.
2. On an iPhone, open the app → Submit → Upload scorecard → **Camera roll** →
   pick a normal photo. It should now read instead of erroring.
