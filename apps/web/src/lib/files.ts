"use client";

import { PAYMENT_FILE_MAX_BYTES } from "@sagarnu/schemas";

export class FileTooLargeError extends Error {}
export class UnsupportedFileError extends Error {}

/** Phone photos are several MB; scale them down as a JPEG (quality is still fine for reading a receipt). */
export async function resizeImage(file: Blob, maxSide: number, quality = 0.85): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", quality);
}

const readAsDataUrl = (file: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

/** Bytes represented by a base64 data URL. */
const dataUrlBytes = (dataUrl: string) => Math.floor(((dataUrl.length - dataUrl.indexOf(",") - 1) * 3) / 4);

/** A PDF as-is, or an image converted to a reasonably sized JPEG (the name gets a .jpg extension). */
export async function prepareReceipt(file: File): Promise<{ name: string; dataUrl: string }> {
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    if (file.size > PAYMENT_FILE_MAX_BYTES) throw new FileTooLargeError();
    const dataUrl = (await readAsDataUrl(file)).replace(/^data:[^;]*;/, "data:application/pdf;");
    return { name: file.name, dataUrl };
  }
  return { name: file.name.replace(/\.[^.]+$/, "") + ".jpg", dataUrl: await imageToJpeg(file) };
}

async function imageToJpeg(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new UnsupportedFileError();
  let dataUrl: string;
  try {
    dataUrl = await resizeImage(file, 2000);
  } catch {
    throw new UnsupportedFileError();
  }
  if (dataUrlBytes(dataUrl) > PAYMENT_FILE_MAX_BYTES) dataUrl = await resizeImage(file, 1400, 0.75);
  if (dataUrlBytes(dataUrl) > PAYMENT_FILE_MAX_BYTES) throw new FileTooLargeError();
  return dataUrl;
}

/** Hebrew message for a failed conversion. */
export function fileErrorMessage(error: unknown): string | null {
  if (error instanceof FileTooLargeError) return "הקובץ גדול מדי (עד 5MB)";
  if (error instanceof UnsupportedFileError) return "אפשר להעלות PDF או תמונה (JPG, PNG)";
  return null;
}

export const ACCEPT_RECEIPTS = "application/pdf,image/*";

export function formatFileSize(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))}KB`
    : `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}
