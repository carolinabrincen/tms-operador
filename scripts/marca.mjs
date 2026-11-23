// Aplica la marca de src/marca.json (ÚNICA fuente del nombre visible y los colores) a los archivos que no pueden
// importarla: public/manifest.webmanifest, el <title>/metas de src/index.html y los iconos provisionales.
// Uso: npm run marca  (también corre solo con npm start y npm run build). Determinista: sin cambios, git no ve diferencias.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const marca = JSON.parse(readFileSync(join(raiz, 'src/marca.json'), 'utf8'));

for (const campo of ['nombre', 'nombreCorto', 'descripcion', 'colorTema', 'colorFondo']) {
  if (typeof marca[campo] !== 'string' || !marca[campo].trim()) throw new Error(`src/marca.json: falta "${campo}"`);
}
for (const campo of ['colorTema', 'colorFondo']) {
  if (!/^#[0-9a-fA-F]{6}$/.test(marca[campo])) throw new Error(`src/marca.json: "${campo}" debe ser #RRGGBB`);
}

const escaparHtml = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---------- Iconos provisionales: camión blanco sobre el color de la marca (dentro de la zona segura "maskable") ----------
const TAMANOS = [72, 96, 128, 144, 152, 192, 384, 512];

function rgb(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

/** Figura en coordenadas 0..1: true = blanco (camión), false = fondo. */
function enCamion(x, y) {
  const rect = (x1, y1, x2, y2) => x >= x1 && x < x2 && y >= y1 && y < y2;
  const circ = (cx, cy, r) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
  const ruedas = [
    [0.3, 0.665],
    [0.42, 0.665],
    [0.72, 0.665],
  ];
  for (const [cx, cy] of ruedas) {
    if (circ(cx, cy, 0.022)) return false; // rin
    if (circ(cx, cy, 0.055)) return true;
  }
  if (rect(0.685, 0.47, 0.77, 0.52)) return false; // ventana de la cabina
  return rect(0.2, 0.36, 0.62, 0.6) || rect(0.64, 0.44, 0.8, 0.6) || rect(0.2, 0.6, 0.8, 0.63);
}

const TABLA_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = TABLA_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function bloque(tipo, datos) {
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(cuerpo));
  return Buffer.concat([largo, cuerpo, crc]);
}

function png(tamano, fondo) {
  const [fr, fg, fb] = rgb(fondo);
  const MUESTRAS = 4; // suavizado 4x4 por píxel
  const filas = [];
  for (let py = 0; py < tamano; py++) {
    const fila = Buffer.alloc(1 + tamano * 3); // filtro 0 + RGB
    for (let px = 0; px < tamano; px++) {
      let blanco = 0;
      for (let sy = 0; sy < MUESTRAS; sy++)
        for (let sx = 0; sx < MUESTRAS; sx++)
          if (enCamion((px + (sx + 0.5) / MUESTRAS) / tamano, (py + (sy + 0.5) / MUESTRAS) / tamano)) blanco++;
      const a = blanco / (MUESTRAS * MUESTRAS);
      fila[1 + px * 3] = Math.round(fr + (255 - fr) * a);
      fila[2 + px * 3] = Math.round(fg + (255 - fg) * a);
      fila[3 + px * 3] = Math.round(fb + (255 - fb) * a);
    }
    filas.push(fila);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(tamano, 0);
  ihdr.writeUInt32BE(tamano, 4);
  ihdr[8] = 8; // bits
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloque('IHDR', ihdr),
    bloque('IDAT', deflateSync(Buffer.concat(filas), { level: 9 })),
    bloque('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(join(raiz, 'public/icons'), { recursive: true });
for (const t of TAMANOS) writeFileSync(join(raiz, `public/icons/icon-${t}x${t}.png`), png(t, marca.colorTema));
writeFileSync(join(raiz, 'public/icons/apple-touch-icon.png'), png(180, marca.colorTema));
writeFileSync(join(raiz, 'public/favicon.png'), png(48, marca.colorTema));

// ---------- Manifest ----------
const manifest = {
  name: marca.nombre,
  short_name: marca.nombreCorto,
  description: marca.descripcion,
  lang: 'es-MX',
  dir: 'ltr',
  display: 'standalone',
  orientation: 'portrait',
  scope: './',
  start_url: './',
  theme_color: marca.colorTema,
  background_color: marca.colorFondo,
  icons: [
    ...TAMANOS.map((t) => ({ src: `icons/icon-${t}x${t}.png`, sizes: `${t}x${t}`, type: 'image/png', purpose: 'any' })),
    ...[192, 512].map((t) => ({ src: `icons/icon-${t}x${t}.png`, sizes: `${t}x${t}`, type: 'image/png', purpose: 'maskable' })),
  ],
};
writeFileSync(join(raiz, 'public/manifest.webmanifest'), JSON.stringify(manifest, null, 2) + '\n');

// ---------- index.html: título y metas (entre marcas para poder regenerar) ----------
const rutaIndex = join(raiz, 'src/index.html');
const index = readFileSync(rutaIndex, 'utf8');
const INICIO = '<!-- marca:inicio (generado por scripts/marca.mjs desde src/marca.json) -->';
const FIN = '<!-- marca:fin -->';
const ini = index.indexOf(INICIO);
const fin = index.indexOf(FIN);
if (ini < 0 || fin < ini) throw new Error('src/index.html: faltan las marcas marca:inicio / marca:fin');
const sangria = '    ';
const metas = [
  `<title>${escaparHtml(marca.nombre)}</title>`,
  `<meta name="description" content="${escaparHtml(marca.descripcion)}" />`,
  `<meta name="theme-color" content="${marca.colorTema}" />`,
  `<meta name="apple-mobile-web-app-title" content="${escaparHtml(marca.nombreCorto)}" />`,
].join(`\n${sangria}`);
const nuevo = `${index.slice(0, ini)}${INICIO}\n${sangria}${metas}\n${sangria}${index.slice(fin)}`;
if (nuevo !== index) writeFileSync(rutaIndex, nuevo);

console.log(`Marca aplicada: "${marca.nombre}" (${TAMANOS.length + 2} iconos, manifest e index.html).`);
