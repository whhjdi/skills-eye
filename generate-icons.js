/**
 * generate-icons.js
 * 用 Node.js 内置模块生成扩展所需的 PNG 图标（16/48/128px）
 * 运行：node generate-icons.js
 */

const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

// ─── 简易 PNG 编码器 ─────────────────────────────────────────────────────────

function encodePNG(width, height, pixels) {
  // pixels: Uint8Array, RGBA, row-major

  function crc32(buf) {
    let crc = -1;
    const table = crc32.table || (crc32.table = (() => {
      const t = new Uint32Array(256);
      for (let i = 0; i < 256; i++) {
        let c = i;
        for (let j = 0; j < 8; j++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[i] = c;
      }
      return t;
    })());
    for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ -1) >>> 0;
  }

  function chunk(type, data) {
    const typeBytes = Buffer.from(type, 'ascii');
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const crcBuf = Buffer.concat([typeBytes, data]);
    const crcVal = Buffer.alloc(4);
    crcVal.writeUInt32BE(crc32(crcBuf));
    return Buffer.concat([len, typeBytes, data, crcVal]);
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // color type: RGB (no alpha in header; we'll use RGBA = type 6)
  ihdr[9] = 6;  // RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // Raw image data with filter byte per row
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0; // filter type None
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4;
      const dst = y * (1 + width * 4) + 1 + x * 4;
      raw[dst]     = pixels[src];
      raw[dst + 1] = pixels[src + 1];
      raw[dst + 2] = pixels[src + 2];
      raw[dst + 3] = pixels[src + 3];
    }
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ─── 绘制工具 ────────────────────────────────────────────────────────────────

function createPixels(size) {
  return new Uint8Array(size * size * 4);
}

function setPixel(pixels, size, x, y, r, g, b, a) {
  if (x < 0 || x >= size || y < 0 || y >= size) return;
  const i = (y * size + x) * 4;
  // Alpha compositing over existing pixel
  const srcA = a / 255;
  const dstA = pixels[i + 3] / 255;
  const outA = srcA + dstA * (1 - srcA);
  if (outA === 0) return;
  pixels[i]     = Math.round((r * srcA + pixels[i]     * dstA * (1 - srcA)) / outA);
  pixels[i + 1] = Math.round((g * srcA + pixels[i + 1] * dstA * (1 - srcA)) / outA);
  pixels[i + 2] = Math.round((b * srcA + pixels[i + 2] * dstA * (1 - srcA)) / outA);
  pixels[i + 3] = Math.round(outA * 255);
}

// 抗锯齿圆
function drawCircle(pixels, size, cx, cy, r, r2, g2, b2, a2, fill = true) {
  for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) {
    for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      let alpha;
      if (fill) {
        alpha = Math.max(0, Math.min(1, r - dist + 0.5));
      } else {
        // ring
        alpha = Math.max(0, Math.min(1, 0.5 - Math.abs(dist - r)));
      }
      if (alpha > 0) setPixel(pixels, size, x, y, r2, g2, b2, Math.round(alpha * a2));
    }
  }
}

// 抗锯齿线段
function drawLine(pixels, size, x1, y1, x2, y2, r, g, b, a, width = 1) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.ceil(len * 2);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = x1 + dx * t, py = y1 + dy * t;
    // draw a small circle at each point for width
    for (let oy = -Math.ceil(width); oy <= Math.ceil(width); oy++) {
      for (let ox = -Math.ceil(width); ox <= Math.ceil(width); ox++) {
        const dist = Math.sqrt(ox * ox + oy * oy);
        const alpha = Math.max(0, Math.min(1, width / 2 - dist + 0.5));
        if (alpha > 0) {
          setPixel(pixels, size, Math.round(px + ox), Math.round(py + oy), r, g, b, Math.round(alpha * a));
        }
      }
    }
  }
}

// 填充左半或右半（用于裁切）
function fillHalfCircle(pixels, size, cx, cy, r, side, ri, gi, bi) {
  // side: 'left' or 'right'
  for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) {
    for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
      if (side === 'left' && x > cx) continue;
      if (side === 'right' && x < cx) continue;
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const alpha = Math.max(0, Math.min(1, r - dist + 0.5));
      if (alpha > 0) setPixel(pixels, size, x, y, ri, gi, bi, Math.round(alpha * 255));
    }
  }
}

// ─── 图标绘制 ─────────────────────────────────────────────────────────────────
// 设计：黑色圆形背景 + 白色 skills.sh 三角形 logo（居中偏上）
//        右下角小圆角标：太阳黄色（代表主题切换功能）

// 点是否在三角形内（重心坐标法）
function inTriangle(px, py, ax, ay, bx, by, cx2, cy2) {
  const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
  const d2 = (px - cx2) * (by - cy2) - (bx - cx2) * (py - cy2);
  const d3 = (px - ax) * (cy2 - ay) - (cx2 - ax) * (py - ay);
  const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
  const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);
  return !(hasNeg && hasPos);
}

// 点到线段的距离（用于抗锯齿三角形边缘）
function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.sqrt((px - ax) ** 2 + (py - ay) ** 2);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.sqrt((px - (ax + t * dx)) ** 2 + (py - (ay + t * dy)) ** 2);
}

function drawIcon(size) {
  const px = createPixels(size);
  const cx = size / 2, cy = size / 2;
  const outerR = size / 2 - 1;

  // ── 黑色圆形背景 ──
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const alpha = Math.max(0, Math.min(1, outerR - dist + 0.5));
      if (alpha > 0) setPixel(px, size, x, y, 0x18, 0x18, 0x1b, Math.round(alpha * 255));
    }
  }

  // ── 白色三角形（skills.sh logo：M8 1L16 15H0L8 1Z，原始坐标系 0-16）──
  // 缩放到图标尺寸，三角形占据中心约 60% 区域，稍微偏上
  const triScale = size * 0.58;
  const triOffX = cx;
  const triOffY = cy - size * 0.04; // 略微上移

  // 原始三角形顶点（基于 0-16 坐标，归一化到 -0.5~0.5）
  const triAx = triOffX + (8 / 16 - 0.5) * triScale;    // 顶点（上中）
  const triAy = triOffY + (1 / 16 - 0.5) * triScale;
  const triBx = triOffX + (16 / 16 - 0.5) * triScale;   // 右下
  const triBy = triOffY + (15 / 16 - 0.5) * triScale;
  const triCx = triOffX + (0 / 16 - 0.5) * triScale;    // 左下
  const triCy = triOffY + (15 / 16 - 0.5) * triScale;

  const edgeAA = 1.2; // 抗锯齿半径

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // 检查是否在圆内
      const ddx = x - cx, ddy = y - cy;
      if (Math.sqrt(ddx * ddx + ddy * ddy) > outerR + 1) continue;

      const inside = inTriangle(x, y, triAx, triAy, triBx, triBy, triCx, triCy);

      // 到最近边的距离（用于边缘抗锯齿）
      const d1 = distToSegment(x, y, triAx, triAy, triBx, triBy);
      const d2 = distToSegment(x, y, triBx, triBy, triCx, triCy);
      const d3 = distToSegment(x, y, triCx, triCy, triAx, triAy);
      const minDist = Math.min(d1, d2, d3);

      let alpha;
      if (inside) {
        alpha = Math.min(1, 0.5 + minDist / edgeAA);
      } else {
        alpha = Math.max(0, 0.5 - minDist / edgeAA);
      }

      if (alpha > 0) {
        setPixel(px, size, x, y, 0xff, 0xff, 0xff, Math.round(alpha * 255));
      }
    }
  }

  // ── 右下角小圆角标（太阳黄色，代表主题切换）──
  if (size >= 32) {
    const badgeR = size * 0.18;
    const badgeCx = cx + outerR * 0.62;
    const badgeCy = cy + outerR * 0.62;

    // 角标背景（深色，避免和主背景混）
    drawCircle(px, size, badgeCx, badgeCy, badgeR + 1.5, 0x18, 0x18, 0x1b, 255, true);
    // 黄色圆
    drawCircle(px, size, badgeCx, badgeCy, badgeR, 0xfb, 0xbf, 0x24, 255, true);

    // 小光线（仅在 48px 以上才画，16px 太小）
    if (size >= 48) {
      const rayCount = 8;
      const rayInner = badgeR + size * 0.025;
      const rayOuter = badgeR + size * 0.055;
      const sw = Math.max(0.7, size / 80);
      for (let i = 0; i < rayCount; i++) {
        const ang = (i / rayCount) * Math.PI * 2;
        drawLine(
          px, size,
          badgeCx + Math.cos(ang) * rayInner,
          badgeCy + Math.sin(ang) * rayInner,
          badgeCx + Math.cos(ang) * rayOuter,
          badgeCy + Math.sin(ang) * rayOuter,
          0xfb, 0xbf, 0x24, 220, sw
        );
      }
    }
  }

  return px;
}

// ─── 生成文件 ─────────────────────────────────────────────────────────────────

const iconsDir = path.join(__dirname, 'icons');

for (const size of [16, 48, 128]) {
  const pixels = drawIcon(size);
  const png = encodePNG(size, size, pixels);
  const outPath = path.join(iconsDir, `icon-${size}.png`);
  fs.writeFileSync(outPath, png);
  console.log(`Generated: icon-${size}.png (${png.length} bytes)`);
}

console.log('Done!');
