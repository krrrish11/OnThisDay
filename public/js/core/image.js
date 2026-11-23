// Shrinks a photo on the visitor's device before upload: longest side 1280px, JPEG, small enough for the free database.
// Re-encoding through a canvas also drops EXIF data, including GPS location.
export const MAX_SIDE = 1280;
export const MAX_BYTES = 300 * 1024;
export const MAX_INPUT_BYTES = 20 * 1024 * 1024;

export class PhotoError extends Error {}

async function decode(file) {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      /* fall through to <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } catch {
    throw new PhotoError('This photo could not be read. Try a JPG, PNG or WebP file.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

const toBlob = (canvas, quality) => new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));

function toDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new PhotoError('This photo could not be read.'));
    r.readAsDataURL(blob);
  });
}

/** Returns { dataUrl, blob, width, height, bytes }. Throws PhotoError with a message fit to show. */
export async function compressImage(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new PhotoError('Please choose a JPG, PNG or WebP photo.');
  if (file.size > MAX_INPUT_BYTES) throw new PhotoError('That photo is over 20 MB. Please choose a smaller one.');

  const img = await decode(file);
  const w0 = img.width || img.naturalWidth;
  const h0 = img.height || img.naturalHeight;
  let scale = Math.min(1, MAX_SIDE / Math.max(w0, h0));
  let quality = 0.7;

  for (let attempt = 0; attempt < 6; attempt++) {
    const width = Math.max(1, Math.round(w0 * scale));
    const height = Math.max(1, Math.round(h0 * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; // JPEG has no transparency
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    const blob = await toBlob(canvas, quality);
    if (!blob) throw new PhotoError('This photo could not be processed in your browser.');
    if (blob.size <= MAX_BYTES) {
      img.close?.();
      return { dataUrl: await toDataUrl(blob), blob, width, height, bytes: blob.size };
    }
    // Still too big: lower quality first, then the size.
    if (quality > 0.45) quality -= 0.12;
    else scale *= 0.8;
  }
  img.close?.();
  throw new PhotoError('This photo is still too large after shrinking. Try a simpler picture.');
}
