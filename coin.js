// Bozuk para bölmesi: altın parayı sürükleyip yuvaya bırakınca indirme başlar.
// Asıl indirme mantığı app.js'te; burada yalnızca gizli #downloadBtn tetiklenir.
(() => {
  const COIN_COUNT = 3;
  const tray = document.getElementById('coinTray');
  const slot = document.getElementById('coinSlot');
  const hint = document.getElementById('coinHint');
  const downloadBtn = document.getElementById('downloadBtn');
  const soundBtn = document.getElementById('soundBtn');
  if (!tray || !slot || !downloadBtn) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const defaultHint = hint.textContent;
  let audioCtx = null;

  // Fotoğraf yüklenmeden indirme kapalıdır; bölme de ona göre parlar
  const syncReady = () => slot.classList.toggle('ready', !downloadBtn.disabled);
  new MutationObserver(syncReady).observe(downloadBtn, { attributes: true, attributeFilter: ['disabled'] });
  syncReady();

  // Kısa "şıng" sesi (deklanşör sesi kapalıysa çalmaz)
  function clink() {
    if (soundBtn && soundBtn.getAttribute('aria-pressed') === 'false') return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const t = audioCtx.currentTime;
      [1760, 2637].forEach((f, i) => {
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = 'triangle';
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t + i * 0.05);
        g.gain.exponentialRampToValueAtTime(0.18, t + i * 0.05 + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.05 + 0.35);
        o.connect(g).connect(audioCtx.destination);
        o.start(t + i * 0.05);
        o.stop(t + i * 0.05 + 0.4);
      });
    } catch (_) { /* ses desteklenmiyorsa sessiz kal */ }
  }

  function flashHint(text) {
    hint.textContent = text;
    clearTimeout(flashHint.t);
    flashHint.t = setTimeout(() => { hint.textContent = defaultHint; }, 2200);
  }

  function makeCoin() {
    const ghost = document.createElement('div'); // para yerinden kalkınca boşluğu tutar
    ghost.className = 'coin-ghost';
    const coin = document.createElement('div');
    coin.className = 'coin';
    coin.textContent = '₺';
    ghost.appendChild(coin);
    tray.appendChild(ghost);
    attachDrag(coin, ghost);
  }

  function overSlot(x, y) {
    const r = slot.getBoundingClientRect();
    const pad = 14;
    return x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad;
  }

  function attachDrag(coin, home) {
    let offX = 0, offY = 0, busy = false;

    coin.addEventListener('pointerdown', (e) => {
      if (busy || e.button > 0) return;
      const r = coin.getBoundingClientRect();
      offX = e.clientX - r.left;
      offY = e.clientY - r.top;
      coin.classList.remove('back');
      coin.classList.add('dragging');
      coin.style.left = `${r.left}px`;
      coin.style.top = `${r.top}px`;
      coin.setPointerCapture(e.pointerId);
      e.preventDefault();
    });

    coin.addEventListener('pointermove', (e) => {
      if (!coin.classList.contains('dragging') || busy) return;
      coin.style.left = `${e.clientX - offX}px`;
      coin.style.top = `${e.clientY - offY}px`;
      slot.classList.toggle('over', overSlot(e.clientX, e.clientY));
    });

    const finish = async (e) => {
      if (!coin.classList.contains('dragging') || busy) return;
      slot.classList.remove('over');
      const hit = overSlot(e.clientX, e.clientY);
      if (hit && !downloadBtn.disabled && !downloadBtn.dataset.busy) {
        busy = true;
        const s = slot.querySelector('.coin-slit').getBoundingClientRect();
        coin.classList.add('swallow');
        coin.style.left = `${s.left + s.width / 2 - 23}px`;
        coin.style.top = `${s.top + s.height / 2 - 23}px`;
        clink();
        downloadBtn.click();
        await new Promise((r) => setTimeout(r, reduced.matches ? 0 : 260));
        resetCoin();
        busy = false;
        return;
      }
      if (hit) { // fotoğraf yokken ya da işlem sürerken para reddedilir
        slot.classList.remove('reject');
        void slot.offsetWidth;
        slot.classList.add('reject');
        flashHint(downloadBtn.dataset.busy ? 'hazırlanıyor, biraz bekle…' : 'önce ekrana bir fotoğraf yükle');
      }
      goHome();
    };

    function goHome() {
      const h = home.getBoundingClientRect();
      coin.classList.add('back');
      coin.style.left = `${h.left}px`;
      coin.style.top = `${h.top}px`;
      setTimeout(resetCoin, reduced.matches ? 0 : 260);
    }

    function resetCoin() {
      coin.classList.remove('dragging', 'back', 'swallow');
      coin.style.left = '';
      coin.style.top = '';
    }

    coin.addEventListener('pointerup', finish);
    coin.addEventListener('pointercancel', finish);
  }

  for (let i = 0; i < COIN_COUNT; i++) makeCoin();
})();
