// Dışa aktarma kodlayıcıları: tarayıcının canvas.toBlob ile üretemediği biçimler (bağımlılık yok).
// Her fonksiyon bir canvas alır ve Blob döndürür.

// ---- BMP (24 bit, sıkıştırmasız) ------------------------------------------
function encodeBMP(cv) {
  const w = cv.width, h = cv.height;
  const data = cv.getContext('2d').getImageData(0, 0, w, h).data;
  const rowSize = Math.ceil((w * 3) / 4) * 4; // satırlar 4 bayta tamamlanır
  const imgSize = rowSize * h;
  const buf = new ArrayBuffer(54 + imgSize);
  const dv = new DataView(buf);
  const u8 = new Uint8Array(buf);

  u8[0] = 0x42; u8[1] = 0x4d;              // "BM"
  dv.setUint32(2, 54 + imgSize, true);     // dosya boyutu
  dv.setUint32(10, 54, true);              // piksel verisinin başlangıcı
  dv.setUint32(14, 40, true);              // bilgi başlığı boyutu
  dv.setInt32(18, w, true);
  dv.setInt32(22, h, true);                // pozitif: satırlar aşağıdan yukarı
  dv.setUint16(26, 1, true);               // düzlem sayısı
  dv.setUint16(28, 24, true);              // piksel başına bit
  dv.setUint32(34, imgSize, true);
  dv.setInt32(38, 2835, true);             // 72 dpi
  dv.setInt32(42, 2835, true);

  for (let y = 0; y < h; y++) {
    let o = 54 + y * rowSize;
    let i = (h - 1 - y) * w * 4;           // alt satır dosyada ilk gelir
    for (let x = 0; x < w; x++, i += 4) {
      u8[o++] = data[i + 2];               // B
      u8[o++] = data[i + 1];               // G
      u8[o++] = data[i];                   // R
    }
  }
  return new Blob([buf], { type: 'image/bmp' });
}

// ---- TIFF (RGB, 8 bit, sıkıştırmasız) -------------------------------------
function encodeTIFF(cv) {
  const w = cv.width, h = cv.height;
  const data = cv.getContext('2d').getImageData(0, 0, w, h).data;
  const pixelBytes = w * h * 3;
  const entries = 12;

  // Düzen: başlık (8) | piksel verisi | IFD | ek değerler (bit derinliği + çözünürlükler)
  let ifdOff = 8 + pixelBytes;
  if (ifdOff % 2) ifdOff++;
  const extraOff = ifdOff + 2 + entries * 12 + 4;
  const buf = new ArrayBuffer(extraOff + 22);
  const dv = new DataView(buf);
  const u8 = new Uint8Array(buf);

  u8[0] = 0x49; u8[1] = 0x49;              // "II": küçük endian
  dv.setUint16(2, 42, true);
  dv.setUint32(4, ifdOff, true);

  let o = 8;
  for (let i = 0; i < data.length; i += 4) {
    u8[o++] = data[i]; u8[o++] = data[i + 1]; u8[o++] = data[i + 2];
  }

  let p = ifdOff;
  dv.setUint16(p, entries, true); p += 2;
  const entry = (tag, type, count, value) => {
    dv.setUint16(p, tag, true);
    dv.setUint16(p + 2, type, true);
    dv.setUint32(p + 4, count, true);
    if (type === 3 && count === 1) dv.setUint16(p + 8, value, true);
    else dv.setUint32(p + 8, value, true);
    p += 12;
  };
  entry(256, 4, 1, w);                     // ImageWidth
  entry(257, 4, 1, h);                     // ImageLength
  entry(258, 3, 3, extraOff);              // BitsPerSample
  entry(259, 3, 1, 1);                     // Compression: yok
  entry(262, 3, 1, 2);                     // Photometric: RGB
  entry(273, 4, 1, 8);                     // StripOffsets
  entry(277, 3, 1, 3);                     // SamplesPerPixel
  entry(278, 4, 1, h);                     // RowsPerStrip
  entry(279, 4, 1, pixelBytes);            // StripByteCounts
  entry(282, 5, 1, extraOff + 6);          // XResolution
  entry(283, 5, 1, extraOff + 14);         // YResolution
  entry(296, 3, 1, 2);                     // ResolutionUnit: inç
  dv.setUint32(p, 0, true);                // sonraki IFD yok

  dv.setUint16(extraOff, 8, true);
  dv.setUint16(extraOff + 2, 8, true);
  dv.setUint16(extraOff + 4, 8, true);
  dv.setUint32(extraOff + 6, 72, true); dv.setUint32(extraOff + 10, 1, true);
  dv.setUint32(extraOff + 14, 72, true); dv.setUint32(extraOff + 18, 1, true);
  return new Blob([buf], { type: 'image/tiff' });
}

// ---- PDF (tek sayfa, görsel JPEG olarak gömülür) --------------------------
async function encodePDF(cv, title) {
  const jpegBlob = await new Promise((res) => cv.toBlob(res, 'image/jpeg', 0.95));
  const jpeg = new Uint8Array(await jpegBlob.arrayBuffer());
  const w = cv.width, h = cv.height;
  const k = 842 / Math.max(w, h);          // sayfanın uzun kenarı A4 uzunluğu (842 pt)
  const pw = (w * k).toFixed(2), ph = (h * k).toFixed(2);

  const enc = new TextEncoder();
  const parts = [];
  const offsets = [];
  let len = 0;
  const push = (x) => {
    const b = typeof x === 'string' ? enc.encode(x) : x;
    parts.push(b);
    len += b.length;
  };
  const obj = (n, body) => {
    offsets[n] = len;
    push(`${n} 0 obj\n`); push(body); push('\nendobj\n');
  };

  push('%PDF-1.4\n');
  push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])); // ikili dosya işareti
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);

  offsets[4] = len;
  push(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
  push(jpeg);
  push('\nendstream\nendobj\n');

  const content = `q ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q`;
  obj(5, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);

  // Başlık: UTF-16BE onaltılık dizge (Türkçe karakterler için)
  let hex = 'FEFF';
  for (let i = 0; i < title.length; i++) hex += title.charCodeAt(i).toString(16).padStart(4, '0');
  obj(6, `<< /Title <${hex}> /Creator (Photobooth) >>`);

  const xrefPos = len;
  let xref = 'xref\n0 7\n0000000000 65535 f \n';
  for (let n = 1; n <= 6; n++) xref += `${String(offsets[n]).padStart(10, '0')} 00000 n \n`;
  push(xref);
  push(`trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xrefPos}\n%%EOF`);
  return new Blob(parts, { type: 'application/pdf' });
}

// ---- GIF (tek kare, 256 renk, Floyd-Steinberg dithering) -------------------
function medianCut(px, n) {
  const step = Math.max(1, Math.floor(n / 50000));
  const pts = [];
  for (let p = 0; p < n; p += step) pts.push([px[p * 4], px[p * 4 + 1], px[p * 4 + 2]]);

  const info = (b) => {
    const mn = [255, 255, 255], mx = [0, 0, 0];
    for (const c of b) for (let k = 0; k < 3; k++) { if (c[k] < mn[k]) mn[k] = c[k]; if (c[k] > mx[k]) mx[k] = c[k]; }
    let ch = 0, r = mx[0] - mn[0];
    for (let k = 1; k < 3; k++) if (mx[k] - mn[k] > r) { r = mx[k] - mn[k]; ch = k; }
    return { pts: b, ch, r };
  };

  const boxes = [info(pts)];
  while (boxes.length < 256) {
    let bi = -1, best = 0;
    boxes.forEach((b, i) => {
      const score = b.r * Math.sqrt(b.pts.length);
      if (b.pts.length > 1 && b.r > 0 && score > best) { best = score; bi = i; }
    });
    if (bi < 0) break;
    const b = boxes[bi];
    b.pts.sort((x, y) => x[b.ch] - y[b.ch]);
    const mid = b.pts.length >> 1;
    boxes.splice(bi, 1, info(b.pts.slice(0, mid)), info(b.pts.slice(mid)));
  }
  return boxes.map((b) => {
    let r = 0, g = 0, bl = 0;
    for (const c of b.pts) { r += c[0]; g += c[1]; bl += c[2]; }
    const m = b.pts.length;
    return [Math.round(r / m), Math.round(g / m), Math.round(bl / m)];
  });
}

function ditherToPalette(px, w, h, pal) {
  const n = pal.length;
  const cache = new Int16Array(32768).fill(-1);
  const nearest = (r, g, b) => {
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    let v = cache[key];
    if (v >= 0) return v;
    let best = 0, bd = Infinity;
    for (let i = 0; i < n; i++) {
      const dr = r - pal[i][0], dg = g - pal[i][1], db = b - pal[i][2];
      const d = dr * dr * 3 + dg * dg * 4 + db * db * 2;
      if (d < bd) { bd = d; best = i; }
    }
    cache[key] = best;
    return best;
  };
  const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

  const out = new Uint8Array(w * h);
  let cur = new Float32Array((w + 2) * 3);
  let nxt = new Float32Array((w + 2) * 3);
  for (let y = 0; y < h; y++) {
    nxt.fill(0);
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, e = (x + 1) * 3;
      const r = clamp(px[i] + cur[e]), g = clamp(px[i + 1] + cur[e + 1]), b = clamp(px[i + 2] + cur[e + 2]);
      const idx = nearest(r | 0, g | 0, b | 0);
      out[y * w + x] = idx;
      const c = pal[idx];
      const er = r - c[0], eg = g - c[1], eb = b - c[2];
      // Hatayı komşu piksellere dağıt (7/16 sağ, 3/16 sol-alt, 5/16 alt, 1/16 sağ-alt)
      cur[e + 3] += er * 0.4375; cur[e + 4] += eg * 0.4375; cur[e + 5] += eb * 0.4375;
      nxt[e - 3] += er * 0.1875; nxt[e - 2] += eg * 0.1875; nxt[e - 1] += eb * 0.1875;
      nxt[e] += er * 0.3125; nxt[e + 1] += eg * 0.3125; nxt[e + 2] += eb * 0.3125;
      nxt[e + 3] += er * 0.0625; nxt[e + 4] += eg * 0.0625; nxt[e + 5] += eb * 0.0625;
    }
    [cur, nxt] = [nxt, cur];
  }
  return out;
}

function gifLZW(indices, minCode) {
  const clear = 1 << minCode, eoi = clear + 1;
  const out = [];
  let bitBuf = 0, bitCnt = 0, codeSize = minCode + 1, next = eoi + 1;
  const emit = (code) => {
    bitBuf |= code << bitCnt;
    bitCnt += codeSize;
    while (bitCnt >= 8) { out.push(bitBuf & 255); bitBuf >>>= 8; bitCnt -= 8; }
  };

  let dict = new Map();
  emit(clear);
  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];
    const key = (prefix << 8) | k;
    const hit = dict.get(key);
    if (hit !== undefined) { prefix = hit; continue; }
    emit(prefix);
    if (next === 4096) {                       // tablo doldu: sıfırla
      emit(clear);
      dict = new Map();
      next = eoi + 1;
      codeSize = minCode + 1;
    } else {
      if (next >= (1 << codeSize)) codeSize++;
      dict.set(key, next++);
    }
    prefix = k;
  }
  emit(prefix);
  emit(eoi);
  if (bitCnt > 0) out.push(bitBuf & 255);
  return out;
}

function encodeGIF(cv, maxSide = 2000) {
  let src = cv;
  const s = Math.min(1, maxSide / Math.max(cv.width, cv.height)); // GIF dosyası çok şişmesin
  if (s < 1) {
    src = document.createElement('canvas');
    src.width = Math.round(cv.width * s);
    src.height = Math.round(cv.height * s);
    const sc = src.getContext('2d');
    sc.imageSmoothingQuality = 'high';
    sc.drawImage(cv, 0, 0, src.width, src.height);
  }
  const w = src.width, h = src.height;
  const px = src.getContext('2d').getImageData(0, 0, w, h).data;
  const pal = medianCut(px, w * h);
  const indices = ditherToPalette(px, w, h, pal);
  const lzw = gifLZW(indices, 8);

  const bytes = [];
  const u16 = (v) => bytes.push(v & 255, (v >> 8) & 255);
  for (const ch of 'GIF89a') bytes.push(ch.charCodeAt(0));
  u16(w); u16(h);
  bytes.push(0xf7, 0, 0);                      // genel renk tablosu, 256 renk
  for (let i = 0; i < 256; i++) {
    const c = pal[i] || [0, 0, 0];
    bytes.push(c[0], c[1], c[2]);
  }
  bytes.push(0x2c); u16(0); u16(0); u16(w); u16(h); bytes.push(0);
  bytes.push(8);                               // en küçük LZW kod boyutu
  for (let i = 0; i < lzw.length; i += 255) {
    const n = Math.min(255, lzw.length - i);
    bytes.push(n);
    for (let j = 0; j < n; j++) bytes.push(lzw[i + j]);
  }
  bytes.push(0, 0x3b);
  return new Blob([new Uint8Array(bytes)], { type: 'image/gif' });
}
