"use client";

// Prepares a user-picked scorecard file for the /api/scorecard/extract endpoint.
//
// Why this exists: photos from the iPhone camera roll are HEIC/HEIF, and the
// Anthropic vision API only accepts JPEG/PNG/GIF/WebP. Previously the raw HEIC
// bytes were sent with a JPEG label, which the API rejected ("Couldn't read
// that image"). Here we re-encode whatever the user picks to a real JPEG in a
// canvas. iOS Safari decodes HEIC into an <img> natively, so this works on the
// device, and it also fixes EXIF rotation and shrinks the upload.
//
// PDFs are passed straight through — the server already handles them as
// documents.

const MAX_DIM = 2400;      // longest edge after downscale — ample for OCR
const JPEG_QUALITY = 0.9;

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error("Couldn't read the file."));
    r.readAsDataURL(file);
  });
}

function b64FromDataURL(dataUrl) {
  const i = String(dataUrl).indexOf(",");
  return i >= 0 ? String(dataUrl).slice(i + 1) : String(dataUrl);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("UNDECODABLE"));
    img.src = src;
  });
}

/**
 * @param {File} file
 * @returns {Promise<{ base64: string, mediaType: string }>}
 */
export async function prepareScorecardImage(file) {
  if (!file) throw new Error("No file selected.");

  // PDFs go straight through.
  if (file.type === "application/pdf") {
    const dataUrl = await readAsDataURL(file);
    return { base64: b64FromDataURL(dataUrl), mediaType: "application/pdf" };
  }

  // Load the picked file. iOS Safari natively decodes HEIC/HEIF here — which is
  // the whole point: the camera-roll bytes are HEIC, and this turns them into
  // something we can re-encode to JPEG.
  const dataUrl = await readAsDataURL(file);
  let img;
  try {
    img = await loadImage(dataUrl);
  } catch {
    throw new Error(
      "This photo couldn't be read on this device. Try taking a screenshot of it and uploading that, or upload a JPG or PNG."
    );
  }

  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;
  if (!srcW || !srcH) {
    throw new Error("This photo couldn't be read. Try a screenshot or a JPG/PNG.");
  }

  const scale = Math.min(1, MAX_DIM / Math.max(srcW, srcH));
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't process the image on this device.");
  ctx.drawImage(img, 0, 0, w, h);

  // Prefer toBlob; fall back to toDataURL for older iOS builds that return null.
  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
  );
  if (!blob) {
    const jpegDataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    return { base64: b64FromDataURL(jpegDataUrl), mediaType: "image/jpeg" };
  }

  const outDataUrl = await readAsDataURL(blob);
  return { base64: b64FromDataURL(outDataUrl), mediaType: "image/jpeg" };
}
