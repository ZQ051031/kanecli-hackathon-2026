import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname } from "node:path";
import { pathToFileURL } from "node:url";

const publicRoot = new URL("../public/", import.meta.url);
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

export async function startServer(port = 4173) {
  const server = createServer(async (req, res) => {
    const pathname = req.url.split("?")[0];
    const file = pathname === "/" ? "index.html" : pathname.slice(1);
    const type = types[extname(file)];
    if (!type || !/^(?:assets\/)?[a-zA-Z0-9_-]+\.[a-z0-9]+$/.test(file)) {
      res.writeHead(404).end("Not found.");
      return;
    }
    try {
      const bytes = await readFile(new URL(file, publicRoot));
      res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" }).end(bytes);
    } catch (error) {
      const missing = error.code === "ENOENT";
      res.writeHead(missing ? 404 : 500).end(missing ? "Not found." : "Unable to read file.");
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = await startServer(Number(process.env.PORT ?? 4173));
  console.log(`Checkout Healer: http://127.0.0.1:${server.address().port}/`);
}
