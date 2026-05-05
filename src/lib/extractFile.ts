// File extraction helpers for JD uploads
import * as pdfjsLib from "pdfjs-dist";
// @ts-ignore - vite asset url
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

export async function extractPdfText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  let out = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map((it: any) => it.str);
    out += strings.join(" ") + "\n\n";
  }
  return out.trim();
}

export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function readTextFile(file: File): Promise<string> {
  return await file.text();
}

export type AttachedFile = {
  id: string;
  name: string;
  kind: "pdf" | "image" | "text";
  text?: string;
  dataUrl?: string;
};
