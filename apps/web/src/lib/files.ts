"use client";

import { he } from "@sagarnu/i18n";
import { CONTRACT_FILE_MAX_BYTES, PAYMENT_FILE_MAX_BYTES } from "@sagarnu/schemas";

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
  if (error instanceof FileTooLargeError) return he.ui.fileTooLarge;
  if (error instanceof UnsupportedFileError) return he.ui.fileUnsupported;
  return null;
}

export const ACCEPT_RECEIPTS = "application/pdf,image/*";

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const ACCEPT_CONTRACTS = `application/pdf,.pdf,.doc,.docx,application/msword,${DOCX},image/*`;

/** PDF and Word as-is (up to 10MB); a photo of the pages becomes a JPEG large enough to read. */
export async function prepareContractFile(file: File): Promise<{ name: string; dataUrl: string }> {
  const lower = file.name.toLowerCase();
  // Windows often reports Word files with an empty type, so the extension decides.
  const mime = lower.endsWith(".pdf")
    ? "application/pdf"
    : lower.endsWith(".docx")
      ? DOCX
      : lower.endsWith(".doc")
        ? "application/msword"
        : null;
  if (mime) {
    if (file.size > CONTRACT_FILE_MAX_BYTES) throw new FileTooLargeError();
    const dataUrl = (await readAsDataUrl(file)).replace(/^data:[^;]*;/, `data:${mime};`);
    return { name: file.name, dataUrl };
  }
  if (!file.type.startsWith("image/")) throw new UnsupportedFileError();
  let dataUrl: string;
  try {
    dataUrl = await resizeImage(file, 2400, 0.85);
  } catch {
    throw new UnsupportedFileError();
  }
  if (dataUrlBytes(dataUrl) > CONTRACT_FILE_MAX_BYTES) throw new FileTooLargeError();
  return { name: file.name.replace(/\.[^.]+$/, "") + ".jpg", dataUrl };
}

/** Hebrew message for a contract file that could not be prepared. */
export function contractFileErrorMessage(error: unknown): string | null {
  if (error instanceof FileTooLargeError) return he.contract.fileTooLarge;
  if (error instanceof UnsupportedFileError) return he.contract.fileUnsupported;
  return null;
}

export function formatFileSize(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))}KB`
    : `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}
