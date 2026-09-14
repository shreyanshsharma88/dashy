// Static file server for a built dashboard (videos/iframes need http, not file://).
import http from "node:http";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";

const MIME = { ".html": "text/html", ".css": "text/css", ".js": "application/javascript",
  ".json": "application/json", ".png": "image/png", ".pdf": "application/pdf",
  ".md": "text/markdown", ".txt": "text/plain", ".woff2": "font/woff2" };
export function serve(root, port, distDir = "dist") {
  const base = path.join(root, distDir);
  const handler = (req, res) => {
    let p;
    try {
      p = decodeURIComponent(req.url.split("?")[0]);
    } catch {
      res.writeHead(400); res.end("bad request"); return;
    }
    if (p === "/") p = "/index.html";
    if (p.endsWith("/")) p += "index.html";
    const fp = path.normalize(path.join(base, p));
    if (fp !== base && !fp.startsWith(base + path.sep)) { res.writeHead(403); res.end("forbidden"); return; }
    fs.readFile(fp, (e, data) => {
      if (e) { res.writeHead(404); res.end("not found"); return; }
      res.writeHead(200, { "Content-Type": MIME[path.extname(fp).toLowerCase()] || "application/octet-stream" });
      res.end(data);
    });
  };
  // occupied port -> bump to the next free one (up to +20), never crash.
  // NOTE: a pre-bind probe is required, not just EADDRINUSE: on macOS an IPv6
  // wildcard listener and our IPv4 localhost bind can coexist, so the port can
  // be *effectively* taken while listen() still succeeds.
  function portBusy(port) {
    return new Promise((resolve) => {
      const s = net.connect({ host: "127.0.0.1", port }, () => { s.destroy(); resolve(true); });
      s.on("error", () => resolve(false));
      s.setTimeout(800, () => { try { s.destroy(); } catch {} resolve(false); });
    });
  }
  return new Promise((resolve, reject) => {
    const attempt = async (p, left) => {
      if (left >= 0 && (await portBusy(p))) {
        if (left === 0) return reject(new Error("no free port near " + port));
        return attempt(p + 1, left - 1);
      }
      const srv = http.createServer(handler);
      srv.on("error", (e) => {
        if (e && e.code === "EADDRINUSE" && left > 0) attempt(p + 1, left - 1);
        else reject(e);
      });
      srv.listen(p, "127.0.0.1", () => resolve({ server: srv, port: p, url: `http://localhost:${p}/` }));
    };
    attempt(Number(port) || 8000, 20);
  });
}
