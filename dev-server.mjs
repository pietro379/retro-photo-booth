// Geliştirme sunucusu (bağımlılık yok): dosyalar değişince açık sekmeyi otomatik yeniler.
// Kullanım: node dev-server.mjs  ->  http://localhost:5173
import http from 'node:http';
import { readFile, readdir, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = Number(process.env.PORT) || 5173;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

// Sayfaya eklenen küçük istemci: sürüm değişince yeniler, yüklü fotoğrafı ve kamerayı korur
const LIVE_RELOAD = `<script>
(() => {
  try {
    const srcs = JSON.parse(sessionStorage.getItem('__dev_imgs') || '[]');
    const cam = sessionStorage.getItem('__dev_cam');
    if (srcs.length && typeof state !== 'undefined') {
      if (cam) state.camera = cam;
      let left = srcs.filter(Boolean).length;
      srcs.forEach((src, i) => {
        if (!src) return;
        const img = new Image();
        img.onload = () => { state.photos[i] = img; if (--left === 0) { syncImage(); showCanvas(); selectCamera(state.camera); } };
        img.src = src;
      });
    }
  } catch {}
  let version;
  setInterval(async () => {
    try {
      const v = await (await fetch('/__version', { cache: 'no-store' })).text();
      if (version && v !== version) {
        try {
          if (state.image) { sessionStorage.setItem('__dev_imgs', JSON.stringify(state.photos.map((p) => p && p.src))); sessionStorage.setItem('__dev_cam', state.camera); }
        } catch {}
        location.reload();
      }
      version = v;
    } catch {}
  }, 600);
})();
</script>`;

async function currentVersion() {
  let newest = 0;
  for (const name of await readdir(ROOT)) {
    if (!/\.(html|js|css)$/.test(name) || name === 'dev-server.mjs') continue;
    newest = Math.max(newest, (await stat(join(ROOT, name))).mtimeMs);
  }
  return String(newest);
}

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/__version') {
      res.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
      return res.end(await currentVersion());
    }
    let rel = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
    if (!rel || rel.endsWith('/') || rel.endsWith('\\')) rel += 'index.html';
    const file = join(ROOT, rel);
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }

    let body = await readFile(file);
    const type = TYPES[extname(file)] || 'application/octet-stream';
    if (extname(file) === '.html') body = body.toString('utf8').replace('</body>', LIVE_RELOAD + '</body>');
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404); res.end('Not found');
  }
}).listen(PORT, () => console.log(`Retro Fotoğraf Kabini: http://localhost:${PORT}`));
