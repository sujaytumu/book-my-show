import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

export const isNativeApp = () => Capacitor.isNativePlatform();

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Android WebView can't open blob: URLs in a new tab or trigger <a download>,
// so in the native app we write the PDF to cache and hand it to the share
// sheet (user can open it, save to Drive/Files, WhatsApp it, etc.).
export async function shareTicketNative(blob, filename) {
  const data = await blobToBase64(blob);
  const file = await Filesystem.writeFile({ path: filename, data, directory: Directory.Cache });
  await Share.share({ title: "Movie ticket", url: file.uri, dialogTitle: "Open or save ticket" });
}

// "Peddi" -> "peddi_ticket.pdf", "Kantara: Chapter 1" -> "kantara_chapter_1_ticket.pdf"
export function ticketFileName(title) {
  const name = String(title || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return (name || "movie") + "_ticket.pdf";
}
