// Test harness only: serves the theme folder plus generated stand-in artwork.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png' };
const names = ['Starfall Odyssey','Neon Drift Racing','Hollow Kingdom','Iron Tactics','Ocean of Echoes','Pixel Farmstead','Shadow Protocol','Sky Citadel','Last Frontier','Crystal Caves'];
const art = (id, kind) => {
  const h = (id * 47) % 360, h2 = (h + 60) % 360, n = names[(id - 1) % 100 % 10] || 'Game';
  const [w, hh] = kind === 'hero' ? [1920, 620] : kind === 'portrait' ? [600, 900] : kind === 'logo' ? [640, 220] : kind === 'shot' ? [640, 360] : kind === 'avatar' ? [96, 96] : [460, 215];
  if (kind === 'logo') return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${hh}"><text x="0" y="150" font-family="Arial Black,Arial" font-weight="900" font-size="92" fill="#fff" letter-spacing="-3">${n.toUpperCase().split(' ')[0]}</text><text x="6" y="205" font-family="Arial" font-size="42" fill="hsl(${h},90%,75%)" letter-spacing="14">${(n.split(' ')[1]||'').toUpperCase()}</text></svg>`;
  const circles = Array.from({ length: 7 }, (_, i) => `<circle cx="${(i * 173 + id * 31) % w}" cy="${(i * 97 + id * 13) % hh}" r="${60 + (i * 37 + id) % 200}" fill="hsla(${(h + i * 25) % 360},85%,${45 + i * 4}%,.55)"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${hh}" viewBox="0 0 ${w} ${hh}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h},70%,22%)"/><stop offset="1" stop-color="hsl(${h2},80%,40%)"/></linearGradient><filter id="b"><feGaussianBlur stdDeviation="${kind === 'hero' ? 40 : 18}"/></filter></defs><rect width="100%" height="100%" fill="url(#g)"/><g filter="url(#b)">${circles}</g>${kind === 'portrait' || kind === 'header' ? `<text x="50%" y="${kind === 'portrait' ? 760 : 125}" text-anchor="middle" font-family="Arial Black,Arial" font-weight="900" font-size="${kind === 'portrait' ? 54 : 38}" fill="#fff">${n}</text>` : ''}</svg>`;
};
http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  let m;
  if ((m = /^\/assets\/(\d+)\/(library_hero|library_600x900|header|logo)\./.exec(u))) {
    const kind = { library_hero: 'hero', library_600x900: 'portrait', header: 'header', logo: 'logo' }[m[2]];
    res.writeHead(200, { 'content-type': 'image/svg+xml' }); return res.end(art(Number(m[1]), kind));
  }
  if ((m = /^\/shot\/(\d+)\/(\d)/.exec(u))) { res.writeHead(200, { 'content-type': 'image/svg+xml' }); return res.end(art(Number(m[1]) + Number(m[2]) * 7, 'shot')); }
  if (/^\/avatar\//.test(u)) { res.writeHead(200, { 'content-type': 'image/svg+xml' }); return res.end(art(u.length * 7, 'avatar')); }
  const file = path.join(ROOT, u);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(Number(process.env.PORT || 8765), () => console.log('harness on', process.env.PORT || 8765));
