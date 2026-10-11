// Açılış perdesi: kadife perde kıvrımları (pleat) yay-sönüm fiziğiyle iki yana toplanır.
// - Orta kenardaki kıvrımlar önce çekilir, diğerleri gecikmeyle ve hafif geri tepmeyle takip eder.
// - Her kıvrımın alt ucu, hareketin tersine sallanır (kumaşın ağırlığı).
// - Perde açılırken sayfaya "entering" sınıfı eklenir: kabin ve arka plan yaklaşır.
(() => {
  const root = document.documentElement;
  const cv = document.getElementById('curtain');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const finishIntro = () => root.classList.remove('intro', 'entering');
  if (!cv || reduce) {
    if (cv) cv.remove();
    finishIntro();
    return;
  }

  const ctx = cv.getContext('2d');
  const N = 22;             // taraf başına kıvrım sayısı
  const DELAY = 0.9;        // perde kapalı bekleme (s)
  const PULL = 2.1;         // her kıvrımın çekilme süresi (s)
  const STAGGER = 0.55;     // dış kıvrımların ek gecikmesi (s)
  const ENTER_AT = 1.9;     // kabine yaklaşma başlangıcı (s)
  const K = 85, C = 13;     // ana yay sertliği / sönüm (hafif geri tepme)
  const K2 = 45, C2 = 5;    // alt ucun sallanma yayı

  let W = 0, H = 0, pw = 0;
  const sides = [[], []];   // 0: sol perde, 1: sağ perde

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

  // Boyuta göre kıvrım konumlarını hesapla; mevcut hız/konum durumunu koru
  function layout(keepState) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const half = W / 2 + 6;
    pw = Math.max((half / (N - 1)) * 1.35, 40);

    sides.forEach((arr) => {
      for (let i = 0; i < N; i++) {
        const u = i / (N - 1);
        const rest = u * (half - pw);                          // kapalı konum (kenardan uzaklık)
        // Toplanmış konum: tüm perde ekranın dışında (öndeki kenarın gölgesi de dışarıda kalır)
        const fin = -pw * 1.6 - 52 + u * (pw * 0.6);
        const old = arr[i];
        arr[i] = {
          rest, fin,
          delay: (1 - u) * STAGGER,
          shade: 0.9 + 0.1 * Math.sin(i * 2.3 + 1),
          p: keepState && old ? old.p : rest,
          v: keepState && old ? old.v : 0,
          tr: keepState && old ? old.tr : 0,
          tv: keepState && old ? old.tv : 0,
        };
      }
    });
  }

  function step(t, dt) {
    let moving = 0;
    sides.forEach((arr) => arr.forEach((pl) => {
      const prog = clamp((t - DELAY - pl.delay) / PULL, 0, 1);
      const target = pl.rest + (pl.fin - pl.rest) * ease(prog);
      pl.v += (K * (target - pl.p) - C * pl.v) * dt;
      pl.p += pl.v * dt;

      // Alt uç, hareketin tersine geride kalır
      const trTarget = clamp(-pl.v * 0.055, -48, 48);
      pl.tv += (K2 * (trTarget - pl.tr) - C2 * pl.tv) * dt;
      pl.tr += pl.tv * dt;

      moving = Math.max(moving, Math.abs(pl.v), Math.abs(pl.tv), Math.abs(target - pl.p));
    }));
    return moving;
  }

  const tone = (l, a = 1) => `rgba(${Math.min(255, 74 * l)},${Math.min(255, 42 * l)},${Math.min(255, 23 * l)},${a})`;

  function drawPleat(pl, side) {
    const x0 = side === 0 ? pl.p : W - pl.p - pw;
    const off = side === 0 ? pl.tr : -pl.tr;
    const s = pl.shade;
    // u=0: öndeki (üstte görünen) kenar. Sağ perdede ışık yönü aynalanır.
    const g = ctx.createLinearGradient(x0, 0, x0 + pw, 0);
    const stops = [[0, 0.22], [0.16, 0.6], [0.45, 1.5], [0.78, 0.95], [1, 0.5]];
    stops.forEach(([u, l]) => g.addColorStop(side === 0 ? u : 1 - u, tone(l * s)));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x0, -2);
    ctx.lineTo(x0 + pw, -2);
    ctx.lineTo(x0 + pw + off, H + 4);
    ctx.lineTo(x0 + off, H + 4);
    ctx.closePath();
    ctx.fill();
  }

  function draw(t) {
    ctx.clearRect(0, 0, W, H);

    // Öndeki kenarın sahneye düşürdüğü yumuşak gölge (perdelerin altında kalır)
    sides.forEach((arr, side) => {
      const lead = arr[N - 1];
      const edge = side === 0 ? lead.p + pw : W - lead.p - pw;
      const dir = side === 0 ? 1 : -1;
      const g = ctx.createLinearGradient(edge, 0, edge + dir * 46, 0);
      g.addColorStop(0, 'rgba(0,0,0,.55)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(Math.min(edge, edge + dir * 46), 0, 46, H);
    });

    // Dıştan içe doğru çiz: içteki kıvrımlar üstte kalır
    sides.forEach((arr, side) => arr.forEach((pl) => drawPleat(pl, side)));

    // Üstte ve altta kumaş kararması (yalnızca perde piksellerine uygulanır)
    ctx.globalCompositeOperation = 'source-atop';
    const v = ctx.createLinearGradient(0, 0, 0, H);
    v.addColorStop(0, 'rgba(0,0,0,.55)');
    v.addColorStop(0.18, 'rgba(0,0,0,0)');
    v.addColorStop(0.8, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,.45)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';

    // Perde rayı: perde toplanırken yukarı kayarak kaybolur
    const railOut = ease(clamp((t - (DELAY + STAGGER + PULL * 0.7)) / 0.7, 0, 1));
    if (railOut < 1) {
      const y = -24 * railOut;
      ctx.save();
      ctx.globalAlpha = 1 - railOut;
      const rail = ctx.createLinearGradient(0, y, 0, y + 18);
      rail.addColorStop(0, '#9a7a46');
      rail.addColorStop(0.55, '#5a4120');
      rail.addColorStop(1, '#2a1c0c');
      ctx.fillStyle = rail;
      ctx.fillRect(0, y, W, 18);
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      ctx.fillRect(0, y + 18, W, 3);
      ctx.restore();
    }
  }

  layout(false);
  draw(0);

  let start = null, last = 0, entered = false, settled = false, raf = 0;

  function frame(now) {
    if (start === null) { start = now; last = now; }
    const t = (now - start) / 1000;
    let dt = Math.min(0.033, (now - last) / 1000);
    last = now;

    // Sabit adımlarla ilerlet (kararlılık için)
    const sub = Math.max(1, Math.ceil(dt / 0.008));
    let moving = 0;
    for (let k = 0; k < sub; k++) moving = step(t, dt / sub);

    draw(t);
    cv.style.background = 'transparent'; // ilk çizimden sonra opak yedek zemin kalkar

    if (!entered && t >= ENTER_AT) {
      entered = true;
      root.classList.add('entering');
      const main = document.querySelector('main');
      main.addEventListener('animationend', finishIntro, { once: true });
    }

    if (t > DELAY + PULL + STAGGER + 0.6 && moving < 0.25) {
      settled = true; // perde ekran dışına yerleşti: canvas'ı tamamen kaldır
      window.removeEventListener('resize', onResize);
      cv.remove();
      return;
    }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  // Pencere boyutu değişince (perde hâlâ hareket ederken) yeniden yerleştir
  function onResize() {
    layout(true);
    draw(start === null ? 0 : (performance.now() - start) / 1000);
  }
  window.addEventListener('resize', onResize);
})();
