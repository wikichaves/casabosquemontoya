#!/usr/bin/env python3
"""Static local preview with automatic refresh; never modifies the served files."""

import hashlib
import io
import json
import os
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent.parent
IGNORED = {"node_modules", "__pycache__", "scripts", "_archive", "_downloads"}
EXTENSIONS = {".html", ".css", ".js", ".json", ".svg", ".png", ".jpeg", ".jpg", ".webp", ".woff2"}


def revision():
    digest = hashlib.sha256()
    for directory, folders, files in os.walk(ROOT):
        folders[:] = sorted(name for name in folders if not name.startswith(".") and name not in IGNORED)
        for name in sorted(files):
            path = Path(directory) / name
            if name.startswith(".") or path.suffix not in EXTENSIONS:
                continue
            try:
                stat = path.stat()
            except FileNotFoundError:
                continue
            digest.update(f"{path.relative_to(ROOT)}:{stat.st_mtime_ns}:{stat.st_size}\n".encode())
    return digest.hexdigest()


def refresh_script(version):
    return ("""<script data-local-refresh>
(() => {
  const revision = VERSION;
  const scrollKey = 'cbm-preview-scroll:' + location.pathname;
  try {
    const saved = sessionStorage.getItem(scrollKey);
    if (saved !== null) {
      sessionStorage.removeItem(scrollKey);
      addEventListener('load', () => scrollTo({top: Number(saved), behavior: 'instant'}), {once: true});
    }
  } catch (_) {}
  let checking = false;
  setInterval(async () => {
    if (checking) return;
    checking = true;
    try {
      const response = await fetch('/__dev/version', {cache: 'no-store'});
      if (response.ok && (await response.json()).revision !== revision) {
        try { sessionStorage.setItem(scrollKey, String(scrollY)); } catch (_) {}
        location.reload();
      }
    } catch (_) {
      // The preview may briefly be unavailable during a server restart.
    } finally { checking = false; }
  }, 800);
})();
</script>""".replace("VERSION", json.dumps(version))).encode()


class PreviewHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        if urlsplit(self.path).path == "/__dev/version":
            body = json.dumps({"revision": revision()}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def send_head(self):
        path = Path(self.translate_path(self.path))
        if path.is_dir():
            path = path / "index.html"
        if path.is_file() and path.suffix == ".html":
            body = path.read_bytes()
            script = refresh_script(revision())
            body = body.replace(b"</body>", script + b"\n</body>") if b"</body>" in body else body + script
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            return io.BytesIO(body)
        return super().send_head()

    def log_message(self, fmt, *args):
        if urlsplit(self.path).path != "/__dev/version":
            super().log_message(fmt, *args)


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", 4321), PreviewHandler)
    print("Casa Bosque preview: http://localhost:4321 (automatic refresh enabled)", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
