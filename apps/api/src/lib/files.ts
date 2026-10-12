/** Uploaded files are identified by their bytes, never by the declared type or the file name. */

export type ImageMime = "image/jpeg" | "image/png" | "image/webp";
export type FileMime = ImageMime | "application/pdf";

export function sniffImage(bytes: Buffer): ImageMime | null {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  if (
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export function sniffFile(bytes: Buffer): FileMime | null {
  if (bytes.subarray(0, 5).toString("ascii") === "%PDF-") return "application/pdf";
  return sniffImage(bytes);
}

export type WordMime =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document" | "application/msword";

/** PDF, images, and Word: .docx is a ZIP holding word/document.xml, .doc an OLE compound file. */
export function sniffContractFile(bytes: Buffer): FileMime | WordMime | null {
  const known = sniffFile(bytes);
  if (known) return known;
  if (bytes.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) && bytes.includes("word/")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (bytes.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))) {
    return "application/msword";
  }
  return null;
}

/** Bytes of a `data:<mime>;base64,<payload>` URL. */
export function decodeDataUrl(dataUrl: string): Buffer {
  return Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
}

/** RFC 6266 header that survives Hebrew file names. */
export function contentDisposition(name: string, disposition: "inline" | "attachment" = "inline"): string {
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `${disposition}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}
