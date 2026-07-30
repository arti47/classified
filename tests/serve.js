/* tests/serve.js — a tiny static file server for the regression harness.
 * Dev-only: never part of the shipped app shell. */

import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

export function createServer() {
  return http.createServer(async (req, res) => {
    try {
      let path = decodeURIComponent(new URL(req.url, "http://x").pathname);
      if (path === "/") path = "/index.html";
      const file = join(ROOT, normalize(path).replace(/^(\.\.[/\\])+/, ""));
      const info = await stat(file).catch(() => null);
      if (!info || !info.isFile()) {
        res.writeHead(404, { "content-type": "text/plain" });
        res.end("not found");
        return;
      }
      const body = await readFile(file);
      res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream" });
      res.end(body);
    } catch (err) {
      res.writeHead(500, { "content-type": "text/plain" });
      res.end(String(err));
    }
  });
}

export function listen(port = 0) {
  return new Promise(resolve => {
    const server = createServer();
    server.listen(port, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  listen(8080).then(({ port }) => console.log(`Serving http://127.0.0.1:${port}`));
}
