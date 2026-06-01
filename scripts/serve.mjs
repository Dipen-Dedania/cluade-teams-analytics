import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "127.0.0.1";

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

function send(res, status, body, type = "text/plain; charset=utf-8") {
  res.writeHead(status, { "content-type": type });
  res.end(body);
}

function resolveRequest(url) {
  const parsed = new URL(url, `http://${host}:${port}`);
  const decoded = decodeURIComponent(parsed.pathname);
  const safePath = path.normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  const candidate = path.join(distDir, safePath);
  const resolved = path.resolve(candidate);

  if (!resolved.startsWith(distDir)) return null;
  if (existsSync(resolved) && statSync(resolved).isFile()) return resolved;
  return path.join(distDir, "index.html");
}

if (!existsSync(path.join(distDir, "index.html"))) {
  console.error("dist/index.html not found. Run npm run build first.");
  process.exit(1);
}

createServer((req, res) => {
  const filePath = resolveRequest(req.url || "/");
  if (!filePath || !existsSync(filePath)) {
    send(res, 404, "Not found");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    "content-type": mimeTypes[ext] || "application/octet-stream",
    "cache-control": ext === ".html" ? "no-store" : "public, max-age=300"
  });
  createReadStream(filePath).pipe(res);
}).listen(port, host, () => {
  console.log(`Claude Teams Analytics available at http://${host}:${port}`);
});
