// RFC-0014 5.5: the width and height in an image file's header. Callers read
// at most 64 KB of the file; a header past that gives null.
export const IMAGE_HEADER_BYTES = 65_536;

export function imageSize(
  bytes: Uint8Array,
): { width: number; height: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (offset: number, length: number) =>
    String.fromCharCode(...bytes.subarray(offset, offset + length));
  // PNG: the signature, then the IHDR chunk.
  if (bytes.length >= 24 && ascii(1, 3) === "PNG" && ascii(12, 4) === "IHDR")
    return { width: view.getUint32(16), height: view.getUint32(20) };
  // JPEG: walk the segments to the first start-of-frame marker.
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    // The frame header needs 9 bytes from the marker.
    while (offset + 9 <= bytes.length) {
      if (bytes[offset] !== 0xff) return null;
      const marker = bytes[offset + 1];
      // SOF0 to SOF15, without DHT (C4), JPG (C8) and DAC (CC).
      if (
        marker >= 0xc0 &&
        marker <= 0xcf &&
        marker !== 0xc4 &&
        marker !== 0xc8 &&
        marker !== 0xcc
      )
        return {
          height: view.getUint16(offset + 5),
          width: view.getUint16(offset + 7),
        };
      offset += 2 + view.getUint16(offset + 2);
    }
    return null;
  }
  // WebP: RIFF, then a lossy, lossless or extended chunk.
  if (bytes.length >= 30 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") {
    const chunk = ascii(12, 4);
    if (chunk === "VP8 ")
      return {
        width: view.getUint16(26, true) & 0x3fff,
        height: view.getUint16(28, true) & 0x3fff,
      };
    if (chunk === "VP8L") {
      const bits = view.getUint32(21, true);
      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >> 14) & 0x3fff) + 1,
      };
    }
    if (chunk === "VP8X")
      return {
        width: 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16)),
        height: 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16)),
      };
    return null;
  }
  // AVIF: an ISO media file whose first "ispe" box holds the size.
  if (ascii(4, 4) === "ftyp" && ascii(8, 4).startsWith("avi")) {
    for (let offset = 12; offset + 16 <= bytes.length; offset++)
      if (ascii(offset, 4) === "ispe")
        return {
          width: view.getUint32(offset + 8),
          height: view.getUint32(offset + 12),
        };
  }
  return null;
}
