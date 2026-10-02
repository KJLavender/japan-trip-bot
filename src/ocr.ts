import { config } from "./config.js";

export interface OcrLine {
  text: string;
  score: number;
  box: [number, number][];
}

/** Ask the OCR sidecar (ocr/server.py). Returns undefined when it isn't configured or fails. */
export async function ocrImage(image: Buffer): Promise<OcrLine[] | undefined> {
  if (!config.ocrUrl) return undefined;
  try {
    const res = await fetch(`${config.ocrUrl}/ocr`, {
      method: "POST",
      headers: { "content-type": "application/octet-stream" },
      body: new Uint8Array(image),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return undefined;
    return ((await res.json()) as { lines: OcrLine[] }).lines;
  } catch (err) {
    console.warn("[ocr] unavailable:", (err as Error).message);
    return undefined;
  }
}
