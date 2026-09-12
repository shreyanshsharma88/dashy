// Static file server for a built dashboard (videos/iframes need http, not file://).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const MIME = { ".html": "text/html", ".css": "text/css", ".js": "application/javascript",
  ".json": "application/json", ".png": "image/png", ".pdf": "application/pdf",
  ".md": "text/markdown", ".txt": "text/plain", ".woff2": "font/woff2" };
export function serve(root, port, distDir = "dist") {
  const base = path.join(root, distDir);
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split("?")[0]);
    if (p === "/") p = "/index.html";
    if (p.endsWith("/")) p += "index.html";
    const fp = path.normalize(path.join(base, p));
    if (!fp.startsWith(base)) { res.writeHead(403); res.end("forbidden"); return; }
    fs.readFile(fp, (e, data) => {
      if (e) { res.writeHead(404); res.end("not found"); return; }
      res.writeHead(200, { "Content-Type": MIME[path.extname(fp).toLowerCase()] || "application/octet-stream" });
      res.end(data);
    });
  });
  return new Promise((resolve) => srv.listen(port, "127.0.0.1", () => resolve(srv)));
}
