"""Tiny OCR sidecar for japan-trip-bot.

POST /ocr   body: raw image bytes  ->  {"lines": [{"text": str, "score": float, "box": [[x, y], ...]}]}
GET  /health                       ->  {"ok": true}

Uses RapidOCR with PP-OCRv5 (one model reads Japanese, Chinese and English,
including vertical text). Standard library HTTP server only; bind to localhost
or a private network, never the public internet.
"""

import json
import os
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from rapidocr import LangDet, LangRec, ModelType, OCRVersion, RapidOCR

HOST = os.environ.get("OCR_HOST", "127.0.0.1")
PORT = int(os.environ.get("OCR_PORT", "8001"))
MAX_BYTES = int(os.environ.get("OCR_MAX_MB", "10")) * 1024 * 1024
MODEL = ModelType.SERVER if os.environ.get("OCR_MODEL") == "server" else ModelType.MOBILE

engine = RapidOCR(
    params={
        "Det.ocr_version": OCRVersion.PPOCRV5,
        "Det.lang_type": LangDet.CH,
        "Det.model_type": MODEL,
        "Rec.ocr_version": OCRVersion.PPOCRV5,
        "Rec.lang_type": LangRec.CH,
        "Rec.model_type": MODEL,
    }
)
# The ONNX sessions aren't documented as thread-safe; one image at a time is fast enough.
lock = threading.Lock()


class Handler(BaseHTTPRequestHandler):
    def _json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        if self.path == "/health":
            self._json(200, {"ok": True})
        else:
            self._json(404, {"error": "not found"})

    def do_POST(self) -> None:
        if self.path != "/ocr":
            self._json(404, {"error": "not found"})
            return
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0 or length > MAX_BYTES:
            self._json(413, {"error": "image missing or too large"})
            return
        data = self.rfile.read(length)
        try:
            with lock:
                result = engine(data)
        except Exception:  # noqa: BLE001 - never leak internals to the caller
            self._json(400, {"error": "could not read image"})
            return
        lines = []
        if result.txts:
            for text, score, box in zip(result.txts, result.scores, result.boxes):
                lines.append({"text": text, "score": round(float(score), 3), "box": [[int(x), int(y)] for x, y in box]})
        self._json(200, {"lines": lines})

    def log_message(self, fmt: str, *args) -> None:  # keep logs quiet; no image content is logged
        pass


if __name__ == "__main__":
    print(f"OCR sidecar on http://{HOST}:{PORT} (PP-OCRv5 {MODEL.value})", flush=True)
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
