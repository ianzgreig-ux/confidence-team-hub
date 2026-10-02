import http from 'node:http';
import { readFile } from 'node:fs/promises';
const args = process.argv.slice(2);
const portIndex = args.indexOf('--port');
const port = Number(portIndex >= 0 ? args[portIndex + 1] : process.env.PORT || 4173);
const files = new Map([['/', ['index.html', 'text/html; charset=utf-8']], ['/index.html', ['index.html', 'text/html; charset=utf-8']], ['/styles.css', ['styles.css', 'text/css; charset=utf-8']]]);
http.createServer(async (req, res) => {
  const entry = files.get(new URL(req.url, 'http://localhost').pathname);
  if (!entry) { res.writeHead(404); res.end('Not found'); return; }
  try {
    const body = await readFile(new URL('../dist/' + entry[0], import.meta.url));
    res.writeHead(200, {'Content-Type': entry[1]}); res.end(body);
  } catch { res.writeHead(500); res.end('Run npm run build first.'); }
}).listen(port, '0.0.0.0', () => console.log('Hub preview on port ' + port));
