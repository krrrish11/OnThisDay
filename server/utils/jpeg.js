export const MAX_PHOTO_BYTES = 300 * 1024; // after the browser has compressed it
export const MAX_PHOTO_SIDE = 2000; // the browser aims for 1280; this leaves headroom

const DATA_URL = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/;

/** Reads width/height from the first Start-Of-Frame segment. Returns null for anything that is not a well-formed JPEG. */
export function jpegSize(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) return null;
  if (buf[buf.length - 2] !== 0xff || buf[buf.length - 1] !== 0xd9) return null; // truncated upload
  let i = 2;
  while (i + 3 < buf.length) {
    if (buf[i] !== 0xff) return null;
    const marker = buf[i + 1];
    if (marker === 0xff) { i += 1; continue; } // fill byte
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) { i += 2; continue; } // markers with no length
    if (marker === 0xd9 || marker === 0xda) return null; // image data reached before any frame header
    const len = buf.readUInt16BE(i + 2);
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      if (i + 9 > buf.length) return null;
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  return null;
}

/** Validates a "data:image/jpeg;base64,..." string. Returns { photo } or { error }. */
export function parsePhoto(dataUrl) {
  if (typeof dataUrl !== 'string') return { error: 'Photo is not valid.' };
  if (dataUrl.length > Math.ceil((MAX_PHOTO_BYTES * 4) / 3) + 64) return { error: 'This photo is too large. Photos are limited to 300 KB after compression.' };
  const m = DATA_URL.exec(dataUrl);
  if (!m) return { error: 'Photo must be a JPEG image.' };
  const buffer = Buffer.from(m[1], 'base64');
  if (buffer.length > MAX_PHOTO_BYTES) return { error: 'This photo is too large. Photos are limited to 300 KB after compression.' };
  const size = jpegSize(buffer);
  if (!size || !size.width || !size.height) return { error: 'This file is not a valid JPEG image.' };
  if (size.width > MAX_PHOTO_SIDE || size.height > MAX_PHOTO_SIDE) return { error: `Photo is too big. Keep both sides under ${MAX_PHOTO_SIDE}px.` };
  return { photo: { buffer, mime: 'image/jpeg', ...size } };
}
