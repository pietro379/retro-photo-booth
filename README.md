# Photobooth

Tarayıcıda çalışan, retro temalı bir fotoğraf kabini uygulaması. Bir fotoğraf yükle, bir kamera ya da şablon seç, flaş patlasın ve sonucu istediğin biçimde indir.

Sunucu, derleme adımı ya da paket gerektirmez. Düz HTML, CSS ve JavaScript ile yazıldı; tüm efektler Canvas API üzerinde uygulanır, bu yüzden indirilen dosyada da görünür.

## Özellikler

- **29 kamera:** Polaroid SX-70, Instax Mini 8, Kodak FunSaver, Game Boy Camera, Sony Mavica, Canon PowerShot A70, Olympus Camedia C-60, iPhone 4 ve daha fazlası. Her biri kendi renk tonu, gren, vinyet, parlama, flaş ve tarih damgası ayarlarıyla fotoğrafı o kameradan çekilmiş gibi gösterir.
- **12 şablon:** tekli polaroid kartları, 3'lü ve 4'lü dikey şeritler, 2×2, 2×3 ve 3×3 kolajlar, 35 mm film şeridi. Şablonlarda fotoğraflara efekt uygulanmaz; her kareye ayrı bir fotoğraf eklenebilir.
- **Ekrana dokunarak yükleme:** kamera modunda ekrana, şablon modunda ilgili kareye dokun.
- **Kaydetme biçimleri:** JPEG, PNG, WebP, PDF, GIF, BMP ve TIFF (tarayıcı destekliyorsa AVIF). PDF, GIF, BMP ve TIFF kodlayıcıları `encoders.js` içinde, kütüphane kullanılmadan yazıldı.
- **Fotoğraf kabini deneyimi:** açılışta fizik tabanlı perde animasyonu, indirmeden önce flaş ve deklanşör sesi (sesi kapatma düğmesiyle).
- **Dosya adı:** indirilen fotoğrafa istediğin ismi verebilirsin.

## Kullanım

`index.html` dosyasını tarayıcıda açmak yeterlidir. Yazı tipleri ve Tailwind CSS internet üzerinden yüklenir.

Geliştirirken dosyalar değiştikçe sayfayı otomatik yenileyen küçük bir sunucu kullanılabilir (Node.js gerekir, ek paket gerekmez):

```bash
node dev-server.mjs
```

Ardından `http://localhost:5173` adresini aç. Yüklenen fotoğraflar ve seçili kamera yenilemeler arasında korunur.

## Dosyalar

| Dosya | Görevi |
| --- | --- |
| `index.html` | Sayfa yapısı, tema ve stiller |
| `app.js` | Kamera ve şablon tanımları, efekt hatları, yükleme, indirme |
| `curtain.js` | Açılış perdesi animasyonu |
| `encoders.js` | PDF, GIF, BMP ve TIFF kodlayıcıları |
| `dev-server.mjs` | Otomatik yenilemeli geliştirme sunucusu |

## Notlar

- Efektler çıktı çözünürlüğünü düşürmez; fotoğraf en fazla 2400 piksel uzun kenara kadar tam çözünürlükte işlenir.
- İşletim sisteminde "hareketi azalt" açıksa perde ve flaş animasyonları atlanır.
- Kamera adları, modeller ve yıllar bilgi amaçlıdır. Efektler ilgili kameraların görünümünden esinlenmiş yaklaşımlardır.
