import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../extension/', import.meta.url));
const rootPrefix = resolve(root) + sep;
const port = Number(process.argv[2] || 4178);
const server = createServer(async (req,res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    res.setHeader('Cross-Origin-Resource-Policy','same-origin');
    res.setHeader('X-Content-Type-Options','nosniff');
    if (url.pathname === '/initial-library.json') {
      if (req.headers['sec-fetch-site'] === 'cross-site') { res.writeHead(403).end(); return; }
      const data=await readFile(new URL('../private/网申资料库-岗位版本.json',import.meta.url));
      res.setHeader('Content-Type','application/json'); res.setHeader('Cache-Control','no-store'); res.end(data); return;
    }
    const path = resolve(root, '.' + (url.pathname === '/' ? '/dashboard.html' : decodeURIComponent(url.pathname)));
    if (!path.startsWith(rootPrefix)) { res.writeHead(403).end(); return; }
    const data = await readFile(path);
    res.setHeader('Content-Type', ({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png'})[extname(path)] || 'application/octet-stream');
    res.setHeader('Cache-Control','no-store'); res.end(data);
  } catch { res.writeHead(404).end('Not found'); }
});
server.listen(port,'127.0.0.1',()=>console.log(`http://127.0.0.1:${port}/dashboard.html`));
