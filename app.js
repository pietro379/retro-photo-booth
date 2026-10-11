// Retro Fotoğraf Kabini
// Her kamera için fotoğraf, o kameranın "çekim zincirini" taklit eden bir hattan geçer:
// ton/renk sapması -> flaş/vinyet/parlama -> gren -> çerçeve.
// Fotoğraf çözünürlüğü düşürülmez, yumuşatılmaz ve sıkıştırılmaz; sadece "görünüm" uygulanır.
// Tüm efektler canvas üzerinde uygulanır; indirilen dosyada da görünür.

const MAX = 2400; // çıktının en uzun kenarı için üst sınır (küçük görseller büyütülmez)
const PREVIEW_MAX = 1400; // ekrandaki önizlemenin en uzun kenarı

const canvas = document.getElementById('boothCanvas');
const ctx = canvas.getContext('2d');
const placeholder = document.getElementById('screen');
const fileInput = document.getElementById('fileInput');
const crt = document.getElementById('crt');
const hint = document.getElementById('screenHint');
const downloadBtn = document.getElementById('downloadBtn');
const fileNameInput = document.getElementById('fileName');
const fileExt = document.getElementById('fileExt');
const cameraPanel = document.getElementById('cameraPanel');
const templatePanel = document.getElementById('templatePanel');
const tabs = document.querySelectorAll('[data-tab]');
const slotBar = document.getElementById('slotBar');
const slotsEl = document.getElementById('slots');

const formatGroup = document.getElementById('formatGroup');
const formatNote = document.getElementById('formatNote');

// Kaydetme biçimleri. mime olanları tarayıcı (canvas.toBlob) üretir; diğerleri encoders.js içinde.
// optional: tarayıcı desteklemiyorsa listeden kaldırılır.
const FORMATS = {
  jpeg: { label: 'JPEG', ext: 'jpg',  mime: 'image/jpeg', note: 'Küçük dosya, her yerde açılır' },
  png:  { label: 'PNG',  ext: 'png',  mime: 'image/png',  note: 'Kayıpsız kalite' },
  webp: { label: 'WebP', ext: 'webp', mime: 'image/webp', note: 'Küçük dosya, yüksek kalite' },
  avif: { label: 'AVIF', ext: 'avif', mime: 'image/avif', note: 'En küçük dosya (yeni tarayıcılar)', optional: true },
  pdf:  { label: 'PDF',  ext: 'pdf',  note: 'Tek sayfalık belge, yazdırmaya hazır' },
  gif:  { label: 'GIF',  ext: 'gif',  note: '256 renk, eski usul görünüm' },
  bmp:  { label: 'BMP',  ext: 'bmp',  note: 'Sıkıştırmasız, çok büyük dosya' },
  tiff: { label: 'TIFF', ext: 'tiff', note: 'Sıkıştırmasız, baskı ve arşiv için' },
};

const state = {
  image: null,       // yüklenen HTMLImageElement
  photos: Array(9).fill(null), // kare sırasına göre yüklenen fotoğraflar (kamera modu 1. fotoğrafı kullanır)
  activeSlot: null,  // şablonda tıklanan kare (sonraki yükleme oraya gider)
  output: null,      // efektli, tam çözünürlüklü sonuç (indirilen dosya)
  camera: 'sx70',    // seçili kamera id'si
};

// ---------------------------------------------------------------------------
// Kamera tanımları
// ---------------------------------------------------------------------------
// Ortak alanlar:
//   tone     : ctx.filter dizesi (kontrast, doygunluk, parlaklık, ton)
//   tints    : renk sapmaları [{ c, a, op }]  (op = canvas blend modu)
//   lift     : siyahları kaldırır (soluk film görünümü)
//   flash    : yüz/ortada sert flaş parlaması, kenarlarda düşüş
//   vignette : köşe kararması
//   bloom    : parlak alanlarda taşma {a, r}
//   noise    : yakalama çözünürlüğünde sensör gürültüsü
//   grain    : son çözünürlükte film grenı
//   dust     : toz / çizik sayısı
//   stamp    : turuncu tarih damgası
const GROUPS = [
  { id: 'instant', title: 'ANINDA BASKI',      keyClass: 'k-cream' },
  { id: 'film',    title: 'FİLM & OYUN',       keyClass: 'k-red' },
  { id: 'digital', title: "DİJİTAL KOMPAKT · 2000'LER", keyClass: 'k-wine' },
  { id: 'y2010',   title: "2010'LAR",           keyClass: 'k-sand' },
];

const CAMERAS = [
  // --- Anında baskı ---
  {
    id: 'sx70', group: 'instant', kind: 'instant',
    brand: 'Polaroid', model: 'SX-70', year: 1972, meta: 'katlanır SLR',
    grain: 14, noise: 10, vignette: 0.5,
    tone: 'contrast(0.9) saturate(0.8) brightness(1.06) sepia(0.22)',
    tints: [
      { c: '#ffd9a0', a: 0.16, op: 'soft-light' },
      { c: '#9fb58a', a: 0.08, op: 'multiply' },
    ],
    lift: { c: '#4a4132', a: 0.35 },
    card: '#f3ecda',
  },
  {
    id: 'p600', group: 'instant', kind: 'instant',
    brand: 'Polaroid', model: '600 OneStep', year: 1981, meta: 'flaşlı',
    grain: 12, noise: 9, vignette: 0.4, flash: 0.55,
    tone: 'contrast(1.12) saturate(1.1) brightness(1.08) hue-rotate(-4deg)',
    tints: [
      { c: '#8fb4ff', a: 0.14, op: 'soft-light' },
      { c: '#ff9ad0', a: 0.06, op: 'soft-light' },
    ],
    lift: { c: '#2b2a3a', a: 0.28 },
    card: '#fbfaf5',
  },

  {
    id: 'instax8', group: 'instant', kind: 'instant',
    brand: 'Fujifilm', model: 'Instax Mini 8', year: 2012, meta: 'pastel baskı',
    layout: { cw: 620, ch: 987, side: 46, top: 115, pw: 528, ph: 712 },
    grain: 6, noise: 4, vignette: 0.25, flash: 0.5,
    tone: 'brightness(1.1) contrast(0.95) saturate(1.05)',
    tints: [{ c: '#bfe8e0', a: 0.1, op: 'soft-light' }],
    lift: { c: '#303a3a', a: 0.12 },
    card: '#fdfcf8',
  },

  {
    id: 'spectra', group: 'instant', kind: 'instant',
    brand: 'Polaroid', model: 'Spectra', year: 1986, meta: 'geniş kart',
    layout: { cw: 980, ch: 860, side: 90, top: 90, pw: 800, ph: 640 },
    grain: 12, noise: 8, vignette: 0.4, flash: 0.4,
    tone: 'contrast(0.95) saturate(0.9) brightness(1.06) sepia(0.12)',
    tints: [{ c: '#ffd9a0', a: 0.12, op: 'soft-light' }],
    lift: { c: '#3b3328', a: 0.25 },
    card: '#f6f1e4',
  },
  {
    id: 'onestep2', group: 'instant', kind: 'instant',
    brand: 'Polaroid', model: 'OneStep 2', year: 2017, meta: 'modern film',
    grain: 6, noise: 4, vignette: 0.25, flash: 0.35,
    tone: 'contrast(1.1) saturate(1.2) brightness(1.05)',
    tints: [{ c: '#9ec8ff', a: 0.06, op: 'soft-light' }],
    lift: { c: '#2a2a38', a: 0.18 },
    card: '#fcfcfa',
  },

  // --- Film & oyun ---
  {
    id: 'funsaver', group: 'film', kind: 'capture',
    brand: 'Kodak', model: 'FunSaver 35', year: 1987, meta: 'tek kullanımlık',
    grain: 26, noise: 10, dust: 6,
    vignette: 0.45, flash: 0.6,
    tone: 'contrast(1.28) saturate(1.55) brightness(1.04)',
    tints: [{ c: '#ffc978', a: 0.16, op: 'soft-light' }],
  },
  {
    id: 'brownie', group: 'film', kind: 'capture',
    brand: 'Kodak', model: 'Brownie Hawkeye', year: 1949, meta: 'kutu kamera',
    grain: 30, noise: 8, dust: 18,
    vignette: 0.6, border: 48, borderColor: '#efe6d1',
    tone: 'grayscale(1) sepia(0.75) contrast(1.15) brightness(1.02)',
  },
  {
    id: 'gbcam', group: 'film', kind: 'gameboy',
    brand: 'Nintendo', model: 'Game Boy Camera', year: 1998, meta: '4 ton yeşil',
  },

  {
    id: 'instamatic', group: 'film', kind: 'capture',
    brand: 'Kodak', model: 'Instamatic 126', year: 1963, meta: 'kare negatif',
    vignette: 0.4, grain: 20, noise: 6, dust: 10, border: 44, borderColor: '#f2ead7',
    tone: 'contrast(0.92) saturate(0.88) sepia(0.18) brightness(1.03)',
    tints: [{ c: '#ffcf90', a: 0.14, op: 'soft-light' }],
  },
  {
    id: 'disc4000', group: 'film', kind: 'capture',
    brand: 'Kodak', model: 'Disc 4000', year: 1982, meta: 'disk film',
    vignette: 0.35, grain: 30, noise: 10, dust: 6,
    tone: 'contrast(0.95) saturate(0.9) sepia(0.12) brightness(1.04)',
    tints: [{ c: '#ffd9a0', a: 0.16, op: 'soft-light' }],
  },
  {
    id: 'lca', group: 'film', kind: 'capture',
    brand: 'LOMO', model: 'LC-A', year: 1984, meta: 'çapraz işlem',
    vignette: 0.65, grain: 18, noise: 6, dust: 4,
    tone: 'contrast(1.3) saturate(1.5) hue-rotate(-6deg)',
    tints: [
      { c: '#20d080', a: 0.1, op: 'soft-light' },
      { c: '#ff40a0', a: 0.08, op: 'soft-light' },
    ],
  },
  {
    id: 'mju2', group: 'film', kind: 'capture',
    brand: 'Olympus', model: 'mju-II', year: 1997, meta: '35 mm kompakt',
    vignette: 0.35, flash: 0.45, grain: 14, noise: 5,
    tone: 'contrast(1.15) saturate(1.2) brightness(1.02)',
    tints: [{ c: '#ffc890', a: 0.1, op: 'soft-light' }],
  },

  // --- Dijital kompaktlar ---
  {
    id: 'mavica', group: 'digital', kind: 'capture',
    brand: 'Sony', model: 'Mavica MVC-FD71', year: 1998, meta: 'disket kaydı',
    noise: 13, vignette: 0.35,
    tone: 'contrast(0.95) saturate(0.85) brightness(1.06)',
    tints: [{ c: '#7fa0ff', a: 0.1, op: 'soft-light' }],
  },
  {
    id: 'fuji4700', group: 'digital', kind: 'capture',
    brand: 'Fujifilm', model: 'FinePix 4700 Zoom', year: 2000, meta: '2.4 MP',
    noise: 14, vignette: 0.25,
    stamp: "'00 11 4",
    tone: 'contrast(1.12) saturate(1.3) hue-rotate(-6deg)',
    tints: [{ c: '#7dffcf', a: 0.18, op: 'soft-light' }],
  },
  {
    id: 'cx4230', group: 'digital', kind: 'capture',
    brand: 'Kodak', model: 'EasyShare CX4230', year: 2002, meta: '2 MP',
    noise: 13, vignette: 0.2,
    bloom: { a: 0.1, r: 6 }, stamp: "'02 9 21",
    tone: 'contrast(1.1) saturate(1.5) brightness(1.04) sepia(0.14)',
    tints: [{ c: '#ffd36b', a: 0.26, op: 'soft-light' }],
  },
  {
    id: 'a70', group: 'digital', kind: 'capture',
    brand: 'Canon', model: 'PowerShot A70', year: 2003, meta: '3.2 MP',
    noise: 11, vignette: 0.22,
    stamp: "'03 8 14",
    tone: 'contrast(1.05) saturate(1.2) sepia(0.08)',
    tints: [{ c: '#ffb27a', a: 0.12, op: 'soft-light' }],
  },
  {
    id: 'c60', group: 'digital', kind: 'capture',
    brand: 'Olympus', model: 'Camedia C-60 Zoom', year: 2004, meta: '6 MP',
    noise: 8, vignette: 0.28,
    bloom: { a: 0.15, r: 5 }, stamp: "'04 6 12",
    tone: 'contrast(1.12) saturate(1.3) brightness(1.02)',
    tints: [{ c: '#ffcf9a', a: 0.08, op: 'soft-light' }],
  },
  {
    id: 't1', group: 'digital', kind: 'capture',
    brand: 'Sony', model: 'Cyber-shot DSC-T1', year: 2004, meta: '5 MP',
    noise: 6, vignette: 0.15, flash: 0.25,
    bloom: { a: 0.35, r: 9 },
    tone: 'contrast(1.1) brightness(1.1) saturate(1.1)',
    tints: [{ c: '#8fb4ff', a: 0.12, op: 'soft-light' }],
  },

  {
    id: 'cp2100', group: 'digital', kind: 'capture',
    brand: 'Nikon', model: 'Coolpix 2100', year: 2002, meta: '2 MP',
    vignette: 0.3, noise: 11, stamp: "'02 5 17",
    tone: 'contrast(1.08) saturate(1.15) brightness(1.03)',
    tints: [{ c: '#c0ffd0', a: 0.06, op: 'soft-light' }],
  },
  {
    id: 'fz20', group: 'digital', kind: 'capture',
    brand: 'Panasonic', model: 'Lumix DMC-FZ20', year: 2004, meta: '5 MP',
    vignette: 0.2, noise: 7, stamp: "'04 7 3",
    tone: 'contrast(1.12) saturate(1.1) brightness(1.02)',
    tints: [{ c: '#a8c4ff', a: 0.07, op: 'soft-light' }],
  },
  {
    id: 'optios4', group: 'digital', kind: 'capture',
    brand: 'Pentax', model: 'Optio S4', year: 2004, meta: '4 MP',
    vignette: 0.22, noise: 8, bloom: { a: 0.12, r: 5 }, stamp: "'04 11 28",
    tone: 'contrast(1.05) saturate(1.3) brightness(1.04)',
    tints: [{ c: '#ffd0a0', a: 0.09, op: 'soft-light' }],
  },

  // --- 2010'lar ---
  {
    id: 's95', group: 'y2010', kind: 'capture',
    brand: 'Canon', model: 'PowerShot S95', year: 2010, meta: '10 MP',
    vignette: 0.12, noise: 3,
    tone: 'contrast(1.08) saturate(1.08) brightness(1.02)',
    tints: [{ c: '#ffd2a8', a: 0.06, op: 'soft-light' }],
  },
  {
    id: 'x100', group: 'y2010', kind: 'capture',
    brand: 'Fujifilm', model: 'X100', year: 2010, meta: 'klasik ton',
    vignette: 0.3, grain: 8, noise: 2,
    tone: 'contrast(1.05) saturate(0.9) sepia(0.1)',
    tints: [
      { c: '#f3d9a4', a: 0.1, op: 'soft-light' },
      { c: '#6d8fa8', a: 0.05, op: 'soft-light' },
    ],
  },
  {
    id: 'iphone4', group: 'y2010', kind: 'capture',
    brand: 'Apple', model: 'iPhone 4', year: 2010, meta: '5 MP',
    vignette: 0.2, noise: 4, bloom: { a: 0.12, r: 5 },
    tone: 'contrast(1.05) saturate(1.1) brightness(1.03) sepia(0.06)',
    tints: [{ c: '#ffe0a8', a: 0.12, op: 'soft-light' }],
  },
  {
    id: 's3300', group: 'y2010', kind: 'capture',
    brand: 'Nikon', model: 'Coolpix S3300', year: 2012, meta: '16 MP',
    vignette: 0.12, noise: 5, flash: 0.2,
    tone: 'contrast(1.1) saturate(1.35) brightness(1.06)',
    tints: [{ c: '#9ec8ff', a: 0.08, op: 'soft-light' }],
  },
  {
    id: 'w800', group: 'y2010', kind: 'capture',
    brand: 'Sony', model: 'Cyber-shot DSC-W800', year: 2014, meta: '20 MP',
    vignette: 0.18, noise: 7, bloom: { a: 0.25, r: 7 },
    tone: 'contrast(0.95) saturate(0.95) brightness(1.08)',
    tints: [{ c: '#a8c4ff', a: 0.1, op: 'soft-light' }],
  },
  {
    id: 'rx100', group: 'y2010', kind: 'capture',
    brand: 'Sony', model: 'Cyber-shot DSC-RX100', year: 2012, meta: '1" sensör',
    vignette: 0.08, noise: 2,
    tone: 'contrast(1.12) saturate(1.05) brightness(1.02)',
    tints: [{ c: '#a8c8ff', a: 0.05, op: 'soft-light' }],
  },
  {
    id: 'galaxys4', group: 'y2010', kind: 'capture',
    brand: 'Samsung', model: 'Galaxy S4', year: 2013, meta: '13 MP',
    vignette: 0.08, noise: 3,
    tone: 'contrast(1.12) saturate(1.45) brightness(1.05)',
    tints: [{ c: '#7be0ff', a: 0.06, op: 'soft-light' }],
  },
  {
    id: 'lumia1020', group: 'y2010', kind: 'capture',
    brand: 'Nokia', model: 'Lumia 1020', year: 2013, meta: '41 MP',
    vignette: 0.1, noise: 2, bloom: { a: 0.1, r: 6 },
    tone: 'contrast(1.1) saturate(1.2) brightness(1.04)',
    tints: [{ c: '#ffe0b0', a: 0.06, op: 'soft-light' }],
  },
];

const CAMERA_BY_ID = Object.fromEntries(CAMERAS.map((c) => [c.id, c]));

// ---------------------------------------------------------------------------
// Şablonlar: fotoğraf kabini çıktı kartları / filmleri
// ---------------------------------------------------------------------------
// Şablonlarda fotoğraflara efekt uygulanmaz; fotoğraflar yüklendiği gibi kareye yerleşir.
// Şablondaki her kare için ayrı fotoğraf eklenir.
//   cols/rows : kare düzeni      fw/fh : kare boyutu (px)   gap : kareler arası boşluk
//   mx/my     : yan/üst kenar boşluğu (alt boşluk = my + footer)   footer : alttaki ek alan
//   paper     : kart rengi   ink : yazı rengi   edge : kare çerçeve rengi   film : 35 mm film şeridi
//   caption   : false ise alt yazı yok (tekli polaroid'lerde alt alan boş kalır)
const TEMPLATE_GROUPS = [
  { id: 'polaroid', title: 'TEKLİ POLAROID',  keyClass: 'k-cream' },
  { id: 'strip',    title: 'DİKEY ŞERİTLER',  keyClass: 'k-red' },
  { id: 'grid',     title: 'KARE & IZGARA',   keyClass: 'k-wine' },
  { id: 'film',     title: 'FİLM',            keyClass: 'k-sand' },
];

const TEMPLATES = [
  // --- Tekli polaroid ---
  {
    id: 'pol-classic', group: 'polaroid', kind: 'template', name: 'Klasik Polaroid', meta: 'beyaz kart', caption: false,
    cols: 1, rows: 1, fw: 720, fh: 720, gap: 0, mx: 80, my: 80, footer: 176,
    paper: '#fbf8ef', ink: '#3a3226', edge: 'rgba(0,0,0,.28)', iconFill: '#9a9284',
  },
  {
    id: 'pol-black', group: 'polaroid', kind: 'template', name: 'Siyah Polaroid', meta: 'siyah kart', caption: false,
    cols: 1, rows: 1, fw: 720, fh: 720, gap: 0, mx: 80, my: 80, footer: 176,
    paper: '#16120f', ink: '#e8dcc8', edge: 'rgba(255,255,255,.18)', iconFill: '#6a625a',
  },
  {
    id: 'pol-red', group: 'polaroid', kind: 'template', name: 'Kırmızı Polaroid', meta: 'kırmızı kart', caption: false,
    cols: 1, rows: 1, fw: 720, fh: 720, gap: 0, mx: 80, my: 80, footer: 176,
    paper: '#a8202b', ink: '#fbf1e0', edge: 'rgba(0,0,0,.35)', iconFill: '#f4e3c1',
  },
  {
    id: 'pol-mini', group: 'polaroid', kind: 'template', name: 'Instax Mini', meta: 'dikdörtgen kart', caption: false,
    cols: 1, rows: 1, fw: 528, fh: 712, gap: 0, mx: 46, my: 115, footer: 45,
    paper: '#fdfcf8', ink: '#3a3226', edge: 'rgba(0,0,0,.25)', iconFill: '#9a9284',
  },

  // --- Dikey şeritler ---
  {
    id: 'strip4-cream', group: 'strip', kind: 'template', name: "4'lü Şerit", meta: 'krem kart',
    cols: 1, rows: 4, fw: 400, fh: 300, gap: 20, mx: 40, my: 40, footer: 70,
    paper: '#f8f0dc', ink: '#7a1620', edge: 'rgba(0,0,0,.45)', iconFill: '#7d7468',
  },
  {
    id: 'strip4-black', group: 'strip', kind: 'template', name: "4'lü Şerit", meta: 'siyah kart',
    cols: 1, rows: 4, fw: 400, fh: 300, gap: 20, mx: 40, my: 40, footer: 70,
    paper: '#16120f', ink: '#e8dcc8', edge: 'rgba(255,255,255,.2)', iconFill: '#6a625a',
  },
  {
    id: 'strip4-red', group: 'strip', kind: 'template', name: "4'lü Şerit", meta: 'kırmızı kart',
    cols: 1, rows: 4, fw: 400, fh: 300, gap: 20, mx: 40, my: 40, footer: 70,
    paper: '#a8202b', ink: '#fbf1e0', edge: '#fbf1e0', iconFill: '#f4e3c1',
  },
  {
    id: 'strip3-white', group: 'strip', kind: 'template', name: "3'lü Şerit", meta: 'beyaz kart',
    cols: 1, rows: 3, fw: 420, fh: 315, gap: 22, mx: 42, my: 42, footer: 80,
    paper: '#fbfaf6', ink: '#3a3226', edge: 'rgba(0,0,0,.5)', iconFill: '#7d7468',
  },

  // --- Kare & ızgara ---
  {
    id: 'grid4', group: 'grid', kind: 'template', name: '2×2 Kare', meta: '4 kare · krem',
    cols: 2, rows: 2, fw: 420, fh: 420, gap: 20, mx: 40, my: 40, footer: 60,
    paper: '#f8f0dc', ink: '#7a1620', edge: 'rgba(0,0,0,.45)', iconFill: '#7d7468',
  },
  {
    id: 'grid6', group: 'grid', kind: 'template', name: '2×3 Kolaj', meta: '6 kare · beyaz',
    cols: 2, rows: 3, fw: 380, fh: 380, gap: 20, mx: 40, my: 40, footer: 60,
    paper: '#fbfaf6', ink: '#3a3226', edge: 'rgba(0,0,0,.5)', iconFill: '#7d7468',
  },
  {
    id: 'grid9', group: 'grid', kind: 'template', name: '3×3 Kolaj', meta: '9 kare · krem',
    cols: 3, rows: 3, fw: 300, fh: 300, gap: 16, mx: 36, my: 36, footer: 50,
    paper: '#fbf1e0', ink: '#a8202b', edge: 'rgba(0,0,0,.4)', iconFill: '#7d7468',
  },

  // --- Film ---
  {
    id: 'film4', group: 'film', kind: 'template', name: 'Film Şeridi', meta: '35 mm · 4 kare', film: true,
    cols: 4, rows: 1, fw: 380, fh: 285, gap: 24, mx: 50, my: 96, footer: 0,
    paper: '#16120f', ink: '#e0912f', edge: 'rgba(0,0,0,.6)', iconFill: '#e0912f',
  },
];

const ITEM_BY_ID = {
  ...CAMERA_BY_ID,
  ...Object.fromEntries(TEMPLATES.map((t) => [t.id, t])),
};

// ---------------------------------------------------------------------------
// Yardımcılar
// ---------------------------------------------------------------------------
function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

// En-boy oranını koruyarak max x max kutusuna sığdırır (contain)
function fitSize(iw, ih, max) {
  const s = Math.min(max / iw, max / ih, 1); // asla büyütme
  return { w: Math.max(1, Math.round(iw * s)), h: Math.max(1, Math.round(ih * s)) };
}

// Hedef kutuyu dolduracak şekilde kaynak görselden ortadan kırpma (cover)
function coverCrop(iw, ih, bw, bh) {
  const s = Math.max(bw / iw, bh / ih);
  const sw = bw / s, sh = bh / s;
  return { sx: (iw - sw) / 2, sy: (ih - sh) / 2, sw, sh };
}

function overlay(c, w, h, color, alpha, op) {
  c.globalCompositeOperation = op;
  c.globalAlpha = alpha;
  c.fillStyle = color;
  c.fillRect(0, 0, w, h);
  c.globalCompositeOperation = 'source-over';
  c.globalAlpha = 1;
}

function applyTints(c, w, h, cam) {
  (cam.tints || []).forEach((t) => overlay(c, w, h, t.c, t.a, t.op));
}

function applyVignette(c, w, h, strength) {
  if (!strength) return;
  const r = Math.hypot(w, h) / 2;
  const g = c.createRadialGradient(w / 2, h / 2, r * 0.35, w / 2, h / 2, r);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
}

// Sert flaş: ortada sıcak parlama, kenarlarda ışık düşüşü
function applyFlash(c, w, h, k) {
  if (!k) return;
  const r = Math.max(w, h) * 0.65;
  const g = c.createRadialGradient(w / 2, h * 0.45, 0, w / 2, h * 0.45, r);
  g.addColorStop(0, `rgba(255,244,220,${0.38 * k})`);
  g.addColorStop(1, 'rgba(255,244,220,0)');
  c.globalCompositeOperation = 'screen';
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
  c.globalCompositeOperation = 'source-over';
  applyVignette(c, w, h, 0.3 * k);
}

// Parlak alanların etrafa taşması (CCD parlaması)
function applyBloom(c, src, w, h, bloom) {
  if (!bloom) return;
  const tmp = makeCanvas(w, h);
  const t = tmp.getContext('2d');
  t.filter = `brightness(1.1) contrast(2) blur(${bloom.r}px)`;
  t.drawImage(src, 0, 0);
  c.globalCompositeOperation = 'screen';
  c.globalAlpha = bloom.a;
  c.drawImage(tmp, 0, 0);
  c.globalCompositeOperation = 'source-over';
  c.globalAlpha = 1;
}

// Yumuşak film grenı: küçük bir gürültü dokusu büyütülüp "overlay" ile bindirilir.
// Tek tek piksellere dokunulmaz, bu yüzden fotoğraf pikselli görünmez.
let grainTile = null;
function getGrainTile() {
  if (grainTile) return grainTile;
  const n = 512;
  const t = makeCanvas(n, n);
  const c = t.getContext('2d');
  const img = c.createImageData(n, n);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = 128 + (Math.random() + Math.random() + Math.random() - 1.5) * 90;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }
  c.putImageData(img, 0, 0);
  grainTile = t;
  return t;
}

function addGrain(c, w, h, amt) {
  if (!amt) return;
  const size = Math.max(1.4, w / 800); // gren boyutu görsele göre ölçeklenir
  const pat = c.createPattern(getGrainTile(), 'repeat');
  pat.setTransform(new DOMMatrix().scale(size));
  c.save();
  c.globalCompositeOperation = 'overlay';
  c.globalAlpha = Math.min(1, amt / 70);
  c.fillStyle = pat;
  c.fillRect(0, 0, w, h);
  c.restore();
}

function addDust(c, w, h, count) {
  if (!count) return;
  const u = w / 1200;
  for (let i = 0; i < count; i++) {
    const x = Math.random() * w, y = Math.random() * h;
    const r = (0.6 + Math.random() * 1.8) * u;
    c.fillStyle = Math.random() < 0.6 ? 'rgba(255,255,255,.55)' : 'rgba(0,0,0,.45)';
    c.beginPath();
    c.ellipse(x, y, r, r * (0.6 + Math.random() * 0.8), Math.random() * Math.PI, 0, Math.PI * 2);
    c.fill();
  }
  // Birkaç ince dikey çizik
  c.strokeStyle = 'rgba(255,255,255,.16)';
  c.lineWidth = Math.max(1, u);
  for (let i = 0; i < 2; i++) {
    let x = Math.random() * w;
    c.beginPath();
    c.moveTo(x, 0);
    for (let y = 0; y <= h; y += h / 8) {
      x += (Math.random() - 0.5) * 3 * u;
      c.lineTo(x, y);
    }
    c.stroke();
  }
}

// Turuncu tarih damgası
function addStamp(c, w, h, text) {
  if (!text) return;
  const size = Math.round(h * 0.06);
  c.font = `${size}px VT323, monospace`;
  c.textAlign = 'right';
  c.textBaseline = 'alphabetic';
  c.shadowColor = 'rgba(255,110,0,.8)';
  c.shadowBlur = size * 0.15;
  c.fillStyle = '#ff9a2e';
  c.fillText(text, w - size * 0.8, h - size * 0.7);
  c.shadowBlur = 0;
}

function addBorder(photo, b, color) {
  const out = makeCanvas(photo.width + b * 2, photo.height + b * 2);
  const c = out.getContext('2d');
  c.fillStyle = color;
  c.fillRect(0, 0, out.width, out.height);
  c.drawImage(photo, b, b);
  c.strokeStyle = 'rgba(0,0,0,.18)';
  c.lineWidth = 2;
  c.strokeRect(b, b, photo.width, photo.height);
  return out;
}

// ---------------------------------------------------------------------------
// Hatlar
// ---------------------------------------------------------------------------

// Dijital kompakt, tek kullanımlık ve kutu kamera: orijinal en-boy oranı korunur.
// Fotoğraf tam çözünürlükte işlenir; sadece renk, ışık ve gren görünümü uygulanır.
async function pipelineCapture(cam) {
  const img = state.image;
  const { naturalWidth: iw, naturalHeight: ih } = img;
  const b = cam.border || 0;
  const { w, h } = fitSize(iw, ih, MAX - b * 2);
  const u = w / 1200; // parlama yarıçapını çözünürlüğe göre ölçekler

  const photo = makeCanvas(w, h);
  const c = photo.getContext('2d');
  c.imageSmoothingQuality = 'high';
  c.filter = cam.tone || 'none';
  c.drawImage(img, 0, 0, w, h);
  c.filter = 'none';

  applyTints(c, w, h, cam);
  applyFlash(c, w, h, cam.flash);
  applyBloom(c, photo, w, h, cam.bloom && { a: cam.bloom.a, r: cam.bloom.r * u });
  applyVignette(c, w, h, cam.vignette);
  addStamp(c, w, h, cam.stamp);
  addGrain(c, w, h, (cam.grain || 0) + (cam.noise || 0));
  addDust(c, w, h, cam.dust);

  return b ? addBorder(photo, b, cam.borderColor) : photo;
}

// Anında baskı: kare fotoğraf (ortadan kırpılır) + kalın kart çerçevesi, altta boş alan
async function pipelineInstant(cam) {
  const img = state.image;
  const { naturalWidth: iw, naturalHeight: ih } = img;
  // Kart düzeni (piksel): kart boyutu, fotoğraf konumu ve boyutu
  const L = cam.layout || { cw: 880, ch: 1056, side: 80, top: 80, pw: 720, ph: 720 };
  // Kaynak büyükse kartı da büyüt (en fazla 2 kat), böylece fotoğraf küçülmez
  const f = Math.min(2, Math.max(1, Math.min(iw, ih) / Math.min(L.pw, L.ph)));
  const CW = Math.round(L.cw * f), CH = Math.round(L.ch * f);
  const side = Math.round(L.side * f), top = Math.round(L.top * f);
  const pw = Math.round(L.pw * f), ph = Math.round(L.ph * f);

  const crop = coverCrop(iw, ih, pw, ph);
  const photo = makeCanvas(pw, ph);
  const c = photo.getContext('2d');
  c.imageSmoothingQuality = 'high';
  c.filter = cam.tone || 'none';
  c.drawImage(img, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, pw, ph);
  c.filter = 'none';

  applyTints(c, pw, ph, cam);
  if (cam.lift) overlay(c, pw, ph, cam.lift.c, cam.lift.a, 'screen'); // solmuş siyahlar
  applyFlash(c, pw, ph, cam.flash);
  applyVignette(c, pw, ph, cam.vignette);
  addGrain(c, pw, ph, (cam.grain || 0) + (cam.noise || 0));

  // Kart
  const out = makeCanvas(CW, CH);
  const o = out.getContext('2d');
  o.fillStyle = cam.card;
  o.fillRect(0, 0, CW, CH);
  overlay(o, CW, CH, '#000', 0.04, 'multiply'); // kağıt tonu
  o.drawImage(photo, side, top);
  o.strokeStyle = 'rgba(0,0,0,.28)'; // fotoğraf kenarındaki kimyasal koyuluk
  o.lineWidth = 3 * f;
  o.strokeRect(side, top, pw, ph);
  return out;
}

// Game Boy Camera: 8:7 kadraj, tam çözünürlük, 4 tonlu yeşil paletle pürüzsüz tonlama (pikselleştirme yok)
const GB_STOPS = [[15, 56, 15], [48, 98, 48], [139, 172, 15], [155, 188, 15]];

async function pipelineGameboy() {
  const img = state.image;
  const { naturalWidth: iw, naturalHeight: ih } = img;
  const RATIO = 128 / 112;

  const pw = Math.max(64, Math.round(Math.min(1800, iw, ih * RATIO)));
  const ph = Math.round(pw / RATIO);
  const m = Math.round(pw * 0.125); // ekran çerçevesi payı

  const crop = coverCrop(iw, ih, pw, ph);
  const photo = makeCanvas(pw, ph);
  const c = photo.getContext('2d');
  c.imageSmoothingQuality = 'high';
  c.filter = 'grayscale(1) contrast(1.4) brightness(0.95)';
  c.drawImage(img, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, pw, ph);
  c.filter = 'none';

  // Parlaklığı 4 duraklı yeşil gradyana eşle (aralar yumuşakça karışır)
  const data = c.getImageData(0, 0, pw, ph);
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
    const pos = Math.min(0.9999, Math.max(0, lum)) * 3;
    const k = Math.floor(pos), f = pos - k;
    const a = GB_STOPS[k], b = GB_STOPS[k + 1];
    d[i]     = a[0] + (b[0] - a[0]) * f;
    d[i + 1] = a[1] + (b[1] - a[1]) * f;
    d[i + 2] = a[2] + (b[2] - a[2]) * f;
  }
  c.putImageData(data, 0, 0);

  const out = makeCanvas(pw + m * 2, ph + m * 2);
  const o = out.getContext('2d');
  o.fillStyle = `rgb(${GB_STOPS[3].join(',')})`;
  o.fillRect(0, 0, out.width, out.height);
  o.drawImage(photo, m, m);
  o.strokeStyle = `rgb(${GB_STOPS[0].join(',')})`;
  o.lineWidth = Math.max(4, m / 6);
  o.strokeRect(m - o.lineWidth / 2, m - o.lineWidth / 2, pw + o.lineWidth, ph + o.lineWidth);
  return out;
}

// Şablon: fotoğraf kabini çıktısı (polaroid / şerit / ızgara / film).
// Her kareye kendi fotoğrafı yerleşir; fotoğraflara hiçbir efekt uygulanmaz, yalnızca kareye göre ortadan kırpılır.
function roundRectPath(c, x, y, w, h, r) {
  c.beginPath();
  if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h);
}

async function pipelineTemplate(tpl) {
  try { await document.fonts.load("20px 'Special Elite'"); } catch { /* yazı tipi yoksa yedek kullanılır */ }

  const total = tpl.cols * tpl.rows;
  const photos = state.photos.slice(0, total);

  // Kare, kaynak fotoğraftan küçük kalmasın: en büyük fotoğrafa göre kartı büyüt (en fazla 2 kat)
  let best = 1;
  photos.forEach((p) => {
    if (p) best = Math.max(best, Math.min(p.naturalWidth, p.naturalHeight) / Math.min(tpl.fw, tpl.fh));
  });
  const f = Math.min(2, best);
  const S = (v) => Math.round(v * f);
  const fw = S(tpl.fw), fh = S(tpl.fh), gap = S(tpl.gap), mx = S(tpl.mx), my = S(tpl.my), footer = S(tpl.footer);
  const W = mx * 2 + tpl.cols * fw + (tpl.cols - 1) * gap;
  const H = my * 2 + tpl.rows * fh + (tpl.rows - 1) * gap + footer;

  const out = makeCanvas(W, H);
  const o = out.getContext('2d');

  // Kart / film zemini (yalnızca kağıt dokusu; fotoğraflar sonradan çizilir)
  o.fillStyle = tpl.paper;
  o.fillRect(0, 0, W, H);
  if (!tpl.film) overlay(o, W, H, '#000', 0.03, 'multiply');
  addGrain(o, W, H, tpl.film ? 3 : 4);

  // Kareler
  o.imageSmoothingQuality = 'high';
  for (let i = 0; i < total; i++) {
    const col = i % tpl.cols, row = Math.floor(i / tpl.cols);
    const x = mx + col * (fw + gap), y = my + row * (fh + gap);
    const photo = photos[i];
    if (photo) {
      const crop = coverCrop(photo.naturalWidth, photo.naturalHeight, fw, fh);
      o.drawImage(photo, crop.sx, crop.sy, crop.sw, crop.sh, x, y, fw, fh);
    } else {
      o.fillStyle = 'rgba(0,0,0,.14)'; // henüz fotoğraf eklenmemiş kare
      o.fillRect(x, y, fw, fh);
    }
    o.strokeStyle = tpl.edge;
    o.lineWidth = tpl.film ? 2 : Math.max(2, f * 2);
    o.strokeRect(x, y, fw, fh);
  }

  o.textAlign = 'center';
  o.textBaseline = 'middle';
  o.fillStyle = tpl.ink;

  if (tpl.film) {
    // Film delikleri (üst ve alt) ve kenar yazıları
    const hw = S(26), hh = S(18), pitch = S(46), cy = my * 0.26;
    o.fillStyle = '#efe6d1';
    for (let x = pitch / 2; x < W - hw; x += pitch) {
      roundRectPath(o, x, cy - hh / 2, hw, hh, S(4)); o.fill();
      roundRectPath(o, x, H - cy - hh / 2, hw, hh, S(4)); o.fill();
    }
    o.fillStyle = tpl.ink;
    o.font = `${S(22)}px 'Special Elite', monospace`;
    o.textAlign = 'left';
    o.fillText('RETRO KABİN 400   ▸', mx, my * 0.68);
    for (let i = 0; i < tpl.cols; i++) {
      const x = mx + i * (fw + gap);
      o.fillText(`${i + 1}   ▸ ${i + 1}A`, x, H - my * 0.68);
    }
  } else if (tpl.caption !== false) {
    // Alt yazı: başlık ve tarih
    const y0 = my + tpl.rows * fh + (tpl.rows - 1) * gap;
    const room = footer + my;
    o.font = `${S(26)}px 'Special Elite', monospace`;
    o.fillText('★ RETRO KABİN ★', W / 2, y0 + room * 0.42);
    o.font = `${S(18)}px 'Special Elite', monospace`;
    o.globalAlpha = 0.75;
    o.fillText(new Date().toLocaleDateString('tr-TR'), W / 2, y0 + room * 0.72);
    o.globalAlpha = 1;
  }
  // Yerleşim bilgisi: ekranda dokunulan kareyi bulmak ve boş kareleri işaretlemek için
  out.layout = { W, H, fw, fh, gap, mx, my, cols: tpl.cols, rows: tpl.rows };
  return out;
}

const PIPELINES = {
  capture: pipelineCapture,
  instant: pipelineInstant,
  gameboy: pipelineGameboy,
  template: pipelineTemplate,
};

// ---------------------------------------------------------------------------
// Çizim: her çağrıda orijinalden baştan hesaplanır, sonra ekrandaki canvas'a aktarılır
// ---------------------------------------------------------------------------
let renderToken = 0;
let lastRender = Promise.resolve();

function render() {
  const token = ++renderToken;
  lastRender = doRender(token);
  return lastRender;
}

// Boş şablon karelerinde "+" işareti (yalnızca ekran önizlemesinde; indirilen dosyada yok)
function drawEmptyHints(layout, k) {
  const total = layout.cols * layout.rows;
  for (let i = 0; i < total; i++) {
    if (state.photos[i]) continue;
    const col = i % layout.cols, row = Math.floor(i / layout.cols);
    const cx = (layout.mx + col * (layout.fw + layout.gap) + layout.fw / 2) * k;
    const cy = (layout.my + row * (layout.fh + layout.gap) + layout.fh / 2) * k;
    const r = Math.min(layout.fw, layout.fh) * k * 0.14;
    ctx.lineCap = 'round';
    [['rgba(0,0,0,.55)', Math.max(5, r * 0.5)], ['rgba(255,255,255,.95)', Math.max(3, r * 0.3)]].forEach(([color, w]) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy);
      ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r);
      ctx.stroke();
    });
  }
}

async function doRender(token) {
  const cam = ITEM_BY_ID[state.camera]; // kamera veya şablon
  // Kamera için fotoğraf şart; şablon ise boş karelerle de çizilir (dokunup fotoğraf eklensin diye)
  if (!state.image && cam.kind !== 'template') return;
  try {
    const out = await PIPELINES[cam.kind](cam);
    if (token !== renderToken) return; // daha yeni bir istek geldi
    state.output = out; // indirme için tam çözünürlüklü sonuç

    // Ekrandaki önizleme: büyük görseli yarıya bölerek yumuşakça küçült (tırtıklı/pikselli görünmesin)
    let prev = out;
    const target = fitSize(out.width, out.height, PREVIEW_MAX);
    while (prev.width / 2 > target.w) {
      const half = makeCanvas(prev.width / 2, prev.height / 2);
      const hc = half.getContext('2d');
      hc.imageSmoothingQuality = 'high';
      hc.drawImage(prev, 0, 0, half.width, half.height);
      prev = half;
    }
    canvas.width = target.w;
    canvas.height = target.h;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(prev, 0, 0, target.w, target.h);
    if (out.layout) drawEmptyHints(out.layout, target.w / out.width);
  } catch (err) {
    console.error('Efekt uygulanamadı:', err);
  }
}

// ---------------------------------------------------------------------------
// Arayüz bağlantıları
// ---------------------------------------------------------------------------
// Kamera ve şablon tuşları aynı mantıkla üretilir; id'ler benzersiz olduğu için aynı anda yalnız biri seçili olur
function buildKeyPanels(panel, groups, items, fillKey) {
  groups.forEach((g) => {
    const sec = document.createElement('div');
    sec.innerHTML = `<h3 class="group-title">${g.title}</h3><div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5"></div>`;
    const grid = sec.querySelector('div');
    items.filter((it) => it.group === g.id).forEach((it) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.camera = it.id;
      b.className = `key ${g.keyClass}` + (it.id === state.camera ? ' active' : '');
      b.innerHTML = fillKey(it);
      b.addEventListener('click', () => selectCamera(it.id));
      grid.appendChild(b);
    });
    panel.appendChild(sec);
  });
}

// Şablonun küçük düzen ikonu (kart + kare yerleşimi)
function templateIcon(t) {
  const W = t.mx * 2 + t.cols * t.fw + (t.cols - 1) * t.gap;
  const H = t.my * 2 + t.rows * t.fh + (t.rows - 1) * t.gap + t.footer;
  const k = 38 / Math.max(W, H);
  const rects = [];
  for (let r = 0; r < t.rows; r++) {
    for (let c = 0; c < t.cols; c++) {
      const x = (t.mx + c * (t.fw + t.gap)) * k, y = (t.my + r * (t.fh + t.gap)) * k;
      rects.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(t.fw * k).toFixed(1)}" height="${(t.fh * k).toFixed(1)}" fill="${t.iconFill}"/>`);
    }
  }
  return `<svg class="tpl-icon" width="${(W * k).toFixed(0)}" height="${(H * k).toFixed(0)}" viewBox="0 0 ${(W * k).toFixed(1)} ${(H * k).toFixed(1)}" aria-hidden="true">` +
    `<rect width="100%" height="100%" rx="2" fill="${t.paper}" stroke="rgba(0,0,0,.35)"/>${rects.join('')}</svg>`;
}

function buildPanels() {
  buildKeyPanels(cameraPanel, GROUPS, CAMERAS, (cam) =>
    `<span class="led"></span><span class="brand">${cam.brand}</span>` +
    `<span class="model">${cam.model}</span><small>${cam.year} · ${cam.meta}</small>`);
  buildKeyPanels(templatePanel, TEMPLATE_GROUPS, TEMPLATES, (t) =>
    `<span class="led"></span>${templateIcon(t)}<span class="model">${t.name}</span><small>${t.meta}</small>`);
}

// Sekmeler: görünüm değişir, seçim değişmez. Seçili öğenin sekmesinde kırmızı nokta görünür.
function showTab(name) {
  tabs.forEach((t) => {
    const on = t.dataset.tab === name;
    t.classList.toggle('active', on);
    t.setAttribute('aria-selected', String(on));
  });
  cameraPanel.classList.toggle('off', name !== 'camera');
  templatePanel.classList.toggle('off', name !== 'template');
}

function selectCamera(id) {
  const item = ITEM_BY_ID[id];
  if (!item) return;
  state.camera = id;
  state.activeSlot = null;
  document.querySelectorAll('[data-camera]').forEach((k) =>
    k.classList.toggle('active', k.dataset.camera === id));
  const type = item.kind === 'template' ? 'template' : 'camera';
  tabs.forEach((t) => t.classList.toggle('has-selection', t.dataset.tab === type));
  showTab(type);
  refreshSlots();
  updateScreen();
  render();
}

tabs.forEach((t) => t.addEventListener('click', () => showTab(t.dataset.tab)));

// Ekran durumu: fotoğraf (ya da şablon) varsa canvas, yoksa "fotoğraf yok" yazısı
function updateScreen() {
  const item = ITEM_BY_ID[state.camera];
  const isTpl = item && item.kind === 'template';
  const show = Boolean(state.image) || isTpl;
  placeholder.classList.toggle('hidden', show);
  canvas.classList.toggle('hidden', !show);
  hint.classList.toggle('hidden', !show);
  hint.textContent = isTpl ? 'BİR KAREYE DOKUN · FOTOĞRAF EKLE' : 'FOTOĞRAFI DEĞİŞTİRMEK İÇİN DOKUN';
  downloadBtn.disabled = !state.image;
}
const showCanvas = updateScreen; // geliştirme sunucusunun yenileme betiği bu adı kullanır

// state.image: ilk dolu fotoğraf (kamera efektleri bunu kullanır)
function syncImage() {
  state.image = state.photos.find(Boolean) || null;
}

function setPhoto(i, img) {
  state.photos[i] = img;
  syncImage();
  updateScreen();
  render();
  refreshSlots();
}

function removePhoto(i) {
  state.photos[i] = null;
  syncImage();
  updateScreen();
  render();
  refreshSlots();
}

// Seçili öğe şablonsa kare sayısı, değilse 1
function slotCount() {
  const item = ITEM_BY_ID[state.camera];
  return item && item.kind === 'template' ? item.cols * item.rows : 1;
}

// Şablon modunda: kare küçük resimleri + yükleme butonu etiketi
function refreshSlots() {
  const item = ITEM_BY_ID[state.camera];
  const isTpl = item && item.kind === 'template';
  const n = slotCount();
  slotBar.classList.toggle('hidden', !isTpl);
  slotsEl.innerHTML = '';
  if (!isTpl) return;

  for (let i = 0; i < n; i++) {
    const photo = state.photos[i];
    const s = document.createElement('div');
    s.className = 'slot' + (photo ? ' filled' : '') + (state.activeSlot === i ? ' target' : '');
    s.style.aspectRatio = `${item.fw} / ${item.fh}`;
    s.setAttribute('role', 'button');
    s.setAttribute('tabindex', '0');
    s.title = photo ? `${i + 1}. kareyi değiştir` : `${i + 1}. kareye fotoğraf ekle`;
    if (photo) s.style.backgroundImage = `url("${photo.src}")`;
    s.innerHTML = `<span class="n">${i + 1}</span>` +
      (photo ? '<button type="button" class="x" aria-label="Kareyi boşalt">✕</button>' : '<span class="plus">+</span>');

    const pick = () => { state.activeSlot = i; refreshSlots(); fileInput.click(); };
    s.addEventListener('click', pick);
    s.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
    const x = s.querySelector('.x');
    if (x) x.addEventListener('click', (e) => { e.stopPropagation(); removePhoto(i); });
    slotsEl.appendChild(s);
  }
}

function readImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => { console.error('Görsel çözümlenemedi:', file.name); resolve(null); };
      img.src = reader.result; // data URL
    };
    reader.onerror = () => { console.error('Dosya okunamadı:', file.name); resolve(null); };
    reader.readAsDataURL(file);
  });
}

// Seçilen dosyaları karelere dağıtır.
// Kamera: tek fotoğraf (1. kare). Şablon: tıklanan kareden başlar, sonra boş karelere sırayla yerleşir;
// hepsi doluysa baştan değiştirir.
async function addFiles(fileList) {
  const n = slotCount();
  const isTpl = ITEM_BY_ID[state.camera].kind === 'template';
  const files = [...fileList].filter((f) => f.type.startsWith('image/')).slice(0, isTpl ? n : 1);
  if (!files.length) { state.activeSlot = null; refreshSlots(); return; }
  const imgs = (await Promise.all(files.map(readImage))).filter(Boolean);
  if (!imgs.length) { state.activeSlot = null; refreshSlots(); return; }

  const order = [];
  if (!isTpl) {
    order.push(0);
  } else {
    if (state.activeSlot !== null && state.activeSlot < n) order.push(state.activeSlot);
    for (let i = 0; i < n; i++) if (!state.photos[i] && !order.includes(i)) order.push(i);
    if (!order.length) for (let i = 0; i < n; i++) order.push(i);
  }
  imgs.forEach((img, k) => { if (k < order.length) state.photos[order[k]] = img; });

  state.activeSlot = null;
  syncImage();
  updateScreen();
  render();
  refreshSlots();
}

// Ekrandaki dokunuşun denk geldiği şablon karesi (kart kenarına dokunulursa en yakın kare)
function frameAtPoint(clientX, clientY) {
  const L = state.output && state.output.layout;
  if (!L) return null;
  const r = canvas.getBoundingClientRect();
  // Canvas "object-fit: contain" ile gösteriliyor: görüntünün gerçek alanını bul
  const k = Math.min(r.width / canvas.width, r.height / canvas.height);
  const offX = (r.width - canvas.width * k) / 2, offY = (r.height - canvas.height * k) / 2;
  const scale = L.W / canvas.width; // önizleme pikselinden çıktı pikseline
  const x = ((clientX - r.left - offX) / k) * scale;
  const y = ((clientY - r.top - offY) / k) * scale;

  let best = null, bestDist = Infinity;
  for (let i = 0; i < L.cols * L.rows; i++) {
    const fx = L.mx + (i % L.cols) * (L.fw + L.gap);
    const fy = L.my + Math.floor(i / L.cols) * (L.fh + L.gap);
    const dx = Math.max(fx - x, 0, x - (fx + L.fw));
    const dy = Math.max(fy - y, 0, y - (fy + L.fh));
    const d = Math.hypot(dx, dy);
    if (d < bestDist) { bestDist = d; best = i; }
  }
  return best;
}

// Ekrana dokunmak fotoğraf seçtirir; şablonda dokunulan kareye eklenir
function openPicker(clientX, clientY) {
  const item = ITEM_BY_ID[state.camera];
  state.activeSlot = null;
  if (item.kind === 'template' && clientX !== undefined) state.activeSlot = frameAtPoint(clientX, clientY);
  refreshSlots();
  fileInput.click();
}

crt.addEventListener('click', (e) => openPicker(e.clientX, e.clientY));
crt.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPicker(); }
});

fileInput.addEventListener('change', () => {
  addFiles(fileInput.files);
  fileInput.value = ''; // aynı dosya tekrar seçilebilsin
});

// Dosya penceresi iptal edilirse kare seçimi kalkar
fileInput.addEventListener('cancel', () => { state.activeSlot = null; refreshSlots(); });

// Dosya adı: kullanıcının verdiği isim (dosya sisteminde sorun çıkaracak karakterler temizlenir)
function cleanFileName(raw) {
  return raw
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .slice(0, 60)
    .trim();
}

function selectedFormatKey() {
  const r = document.querySelector('input[name="format"]:checked');
  return r ? r.value : 'png';
}

function selectedFormat() {
  return FORMATS[selectedFormatKey()];
}

// Ad kutusunun yanındaki uzantı etiketi ve biçim açıklaması
function updateExt() {
  const f = selectedFormat();
  fileExt.textContent = `.${f.ext}`;
  formatNote.textContent = f.note;
}

// Tarayıcı bu MIME türünü canvas'tan üretebiliyor mu? (AVIF gibi yeni biçimler için)
function canEncode(mime) {
  return new Promise((resolve) => {
    const c = makeCanvas(2, 2);
    c.toBlob((b) => resolve(Boolean(b) && b.type === mime), mime);
  });
}

function buildFormats() {
  Object.entries(FORMATS).forEach(([key, f]) => {
    const label = document.createElement('label');
    label.dataset.format = key;
    label.innerHTML = `<input type="radio" name="format" value="${key}"${key === 'png' ? ' checked' : ''}><span>${f.label}</span>`;
    label.querySelector('input').addEventListener('change', updateExt);
    formatGroup.appendChild(label);
  });
  // Desteklenmeyen isteğe bağlı biçimleri gizle
  Object.entries(FORMATS).filter(([, f]) => f.optional).forEach(async ([key, f]) => {
    if (await canEncode(f.mime)) return;
    const label = formatGroup.querySelector(`[data-format="${key}"]`);
    if (label.querySelector('input').checked) formatGroup.querySelector('[value="png"]').checked = true;
    label.remove();
    updateExt();
  });
}

// Seçili biçime göre dosyayı üretir
async function exportBlob(key, title) {
  const cv = state.output; // tam çözünürlüklü, efektli sonuç
  switch (key) {
    case 'bmp': return encodeBMP(cv);
    case 'tiff': return encodeTIFF(cv);
    case 'gif': return encodeGIF(cv);
    case 'pdf': return encodePDF(cv, title);
    default: {
      const f = FORMATS[key];
      return new Promise((resolve) => cv.toBlob(resolve, f.mime, 0.95)); // kalite JPEG/WebP/AVIF için
    }
  }
}

// Fotoğraf kabini flaşı: tüm ekranı beyaza boğar ve söner. Flaş en parlak olunca devam edilir.
const flashEl = document.getElementById('flash');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// Deklanşör sesi: dosya kullanmadan Web Audio ile üretilir (perde açılır, perde kapanır, hafif tok ses)
const soundBtn = document.getElementById('soundBtn');
let soundOn = true;
try { soundOn = localStorage.getItem('photobooth-sound') !== '0'; } catch { /* depolama kapalıysa varsayılan: açık */ }
let audioCtx = null;

function refreshSoundBtn() {
  soundBtn.textContent = soundOn ? '🔊' : '🔇';
  soundBtn.setAttribute('aria-pressed', String(soundOn));
  soundBtn.title = `Deklanşör sesi: ${soundOn ? 'açık' : 'kapalı'}`;
}

soundBtn.addEventListener('click', () => {
  soundOn = !soundOn;
  try { localStorage.setItem('photobooth-sound', soundOn ? '1' : '0'); } catch { /* sorun değil */ }
  refreshSoundBtn();
  if (soundOn) playShutter(); // açıldığını duyur
});

function playShutter() {
  if (!soundOn) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    const ac = audioCtx, t0 = ac.currentTime;
    const master = ac.createGain();
    master.gain.value = 0.6;
    master.connect(ac.destination);

    // Hızla sönen, filtrelenmiş gürültü patlaması (mekanik "tık")
    const click = (start, dur, freq, q, gain) => {
      const len = Math.max(1, Math.floor(ac.sampleRate * dur));
      const buf = ac.createBuffer(1, len, ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
      const src = ac.createBufferSource();
      src.buffer = buf;
      const bp = ac.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = q;
      const g = ac.createGain();
      g.gain.value = gain;
      src.connect(bp); bp.connect(g); g.connect(master);
      src.start(t0 + start);
    };
    click(0, 0.03, 3200, 1.2, 1.0);     // perde açılır
    click(0.075, 0.05, 1500, 1.0, 0.9); // perde kapanır

    // Gövdeden gelen tok ses
    const osc = ac.createOscillator();
    const og = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, t0);
    osc.frequency.exponentialRampToValueAtTime(70, t0 + 0.08);
    og.gain.setValueAtTime(0.5, t0);
    og.gain.exponentialRampToValueAtTime(0.001, t0 + 0.09);
    osc.connect(og); og.connect(master);
    osc.start(t0); osc.stop(t0 + 0.1);
  } catch (err) {
    console.warn('Ses çalınamadı:', err);
  }
}

function fireFlash() {
  playShutter(); // flaşla aynı anda
  if (!flashEl || reducedMotion.matches) return Promise.resolve(); // hareket azaltma açıksa flaş yok (ses kalır)
  return new Promise((resolve) => {
    flashEl.classList.remove('fire');
    void flashEl.offsetWidth; // animasyonu baştan başlat
    flashEl.classList.add('fire');
    flashEl.addEventListener('animationend', () => flashEl.classList.remove('fire'), { once: true });
    setTimeout(resolve, 200); // flaş tam parlakken dosya hazırlanmaya başlar
  });
}

// Dışa aktarma: flaş patlar, sonra seçili biçime çevrilip verilen isimle indirilir
downloadBtn.addEventListener('click', async () => {
  if (!state.image || downloadBtn.dataset.busy) return;

  const key = selectedFormatKey();
  const { ext } = FORMATS[key];
  const name = cleanFileName(fileNameInput.value) || `photobooth-${state.camera}`; // isim boşsa varsayılan

  // Çift tıklamayı engelle; GIF/TIFF gibi biçimler birkaç saniye sürebilir
  const label = downloadBtn.textContent;
  downloadBtn.dataset.busy = '1';
  downloadBtn.disabled = true;
  await fireFlash(); // "fotoğraf çekildi"
  await lastRender; // efekt hesaplaması bitmeden indirme
  downloadBtn.textContent = '⏳ HAZIRLANIYOR';
  await new Promise((r) => setTimeout(r, 30)); // arayüz güncellensin
  try {
    const blob = await exportBlob(key, name);
    if (!blob) throw new Error('Dosya üretilemedi');
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${name}.${ext}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 15000);
  } catch (err) {
    console.error('Kaydedilemedi:', err);
    alert('Dosya bu biçimde kaydedilemedi. Başka bir biçim deneyin.');
  } finally {
    delete downloadBtn.dataset.busy;
    downloadBtn.textContent = label;
    downloadBtn.disabled = !state.image;
  }
});

// Ad kutusunda Enter: indir
fileNameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !downloadBtn.disabled) { e.preventDefault(); downloadBtn.click(); }
});

buildFormats();
updateExt();
refreshSoundBtn();

buildPanels();
tabs.forEach((t) => t.classList.toggle('has-selection', t.dataset.tab === 'camera'));
refreshSlots();
updateScreen();

