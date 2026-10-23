import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createCrcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) c = 0xedb88320 ^ (c >>> 1);
      else c = c >>> 1;
    }
    table[n] = c;
  }
  return table;
}

const crcTable = createCrcTable();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function writePng(width, height, rgbaBuffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type: RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace

  const ihdrChunk = createChunk('IHDR', ihdrData);

  // IDAT: Scanlines with filter byte 0
  const scanlineLength = width * 4;
  const rawIdat = Buffer.alloc(height * (scanlineLength + 1));
  for (let y = 0; y < height; y++) {
    rawIdat[y * (scanlineLength + 1)] = 0; // Filter None
    rgbaBuffer.copy(
      rawIdat,
      y * (scanlineLength + 1) + 1,
      y * scanlineLength,
      (y + 1) * scanlineLength
    );
  }
  const compressed = zlib.deflateSync(rawIdat);
  const idatChunk = createChunk('IDAT', compressed);

  // IEND
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = data.length;
  const chunk = Buffer.alloc(4 + 4 + len + 4);
  chunk.writeUInt32BE(len, 0);
  typeBuf.copy(chunk, 4);
  data.copy(chunk, 8);
  const crc = crc32(Buffer.concat([typeBuf, data]));
  chunk.writeUInt32BE(crc, 8 + len);
  return chunk;
}

function renderPostureIcon(size) {
  const buffer = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 1;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= r) {
        // Gradient rounded badge: Deep navy to cyan/teal
        const t = (x + y) / (size * 2);
        // Base badge color (#0a1628 to #0369a1)
        let red = Math.round(10 + t * 20);
        let green = Math.round(25 + t * 80);
        let blue = Math.round(45 + t * 140);
        let alpha = 255;

        // Anti-aliasing edge
        if (dist > r - 1.2) {
          alpha = Math.round(255 * (r - dist));
        }

        // Spine curve rendering (upright ergonomic spine wave)
        const nx = (x - cx) / (size * 0.4);
        const ny = (y - cy) / (size * 0.4);

        // Ergonomic spine wave: S-curve
        const waveX = 0.25 * Math.sin(ny * 2.8);
        const spineDist = Math.abs(nx - waveX);

        if (Math.abs(ny) < 0.85 && spineDist < 0.22) {
          // Emerald glow (#10b981)
          const glow = 1 - spineDist / 0.22;
          red = Math.round(red * (1 - glow) + 16 * glow);
          green = Math.round(green * (1 - glow) + 185 * glow);
          blue = Math.round(blue * (1 - glow) + 129 * glow);
        }

        // Head circle at top of spine
        const headDx = nx - 0.25 * Math.sin(-0.85 * 2.8);
        const headDy = ny - (-0.7);
        const headDist = Math.sqrt(headDx * headDx + headDy * headDy);
        if (headDist < 0.22) {
          red = 56;
          green = 189;
          blue = 248; // Sky blue head
        }

        buffer[idx] = red;
        buffer[idx + 1] = green;
        buffer[idx + 2] = blue;
        buffer[idx + 3] = alpha;
      } else {
        // Transparent
        buffer[idx] = 0;
        buffer[idx + 1] = 0;
        buffer[idx + 2] = 0;
        buffer[idx + 3] = 0;
      }
    }
  }

  return writePng(size, size, buffer);
}

const iconsDir = path.resolve('public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

[16, 48, 128].forEach((size) => {
  const png = renderPostureIcon(size);
  const dest = path.join(iconsDir, `icon${size}.png`);
  fs.writeFileSync(dest, png);
  console.log(`Generated ${dest} (${size}x${size}, ${png.length} bytes)`);
});
