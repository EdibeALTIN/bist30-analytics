# BIST-30 Deployment Rehberi

Bu rehber, projeyi **Render (backend)** + **Vercel (frontend)** mimarisiyle production ortamına almak için adım adım talimatlar içerir.

## Mimari Özet

| Katman | Teknoloji | Hosting |
|--------|-----------|---------|
| Frontend | React 18 + Vite 6 + TypeScript | Vercel |
| Backend | FastAPI + Uvicorn | Render |
| Veritabanı | SQLite (`backend/data/bist30.db`) | Render disk (repo ile birlikte) |

```
[Kullanıcı] → Vercel (React SPA) → Render (FastAPI /api/*) → SQLite
```

---

## Ön Koşullar

- [GitHub](https://github.com) hesabı
- [Render](https://render.com) hesabı (ücretsiz plan yeterli)
- [Vercel](https://vercel.com) hesabı (ücretsiz plan yeterli)
- Lokal test için: Node.js 18+, Python 3.12+

---

## 1. GitHub'a Yükleme

### 1.1 Depoyu hazırlayın

Proje kökünde `.gitignore` dosyası `node_modules/`, `.venv/`, `.env` dosyalarını hariç tutar.

**Önemli:** `backend/data/bist30.db` (~250 KB) repoda olmalıdır. Render'da SQLite dosyası bu path üzerinden okunur.

```bash
cd "BIST-30 Investment Analytics Platform 3"

git init

cp .env.example .env.local
cp backend/.env.example backend/.env

git add .
git commit -m "Production deployment hazırlığı: Render + Vercel"
```

### 1.2 GitHub'a push

```bash
git remote add origin https://github.com/KULLANICI/bist30-analytics.git
git branch -M main
git push -u origin main
```

---

## 2. Render Backend Deployment

### 2.1 Blueprint ile (önerilen)

1. [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint**
2. GitHub reposunu bağlayın
3. `render.yaml` otomatik algılanır → **Apply**

### 2.2 Manuel kurulum

1. **New** → **Web Service**
2. Repo seçin
3. Ayarlar:

| Alan | Değer |
|------|-------|
| **Root Directory** | `backend` |
| **Runtime** | Python 3 |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `uvicorn api:app --host 0.0.0.0 --port $PORT` |
| **Health Check Path** | `/api/health` |

### 2.3 Render Environment Variables

Render Dashboard → Servis → **Environment**:

| Değişken | Örnek Değer | Açıklama |
|----------|-------------|----------|
| `CORS_ORIGINS` | `https://bist30.vercel.app` | Vercel frontend URL(leri), virgülle ayrılmış |
| `BIST_DATABASE_PATH` | `data/bist30.db` | SQLite dosya yolu (backend köküne göre) |
| `PYTHON_VERSION` | `3.12.8` | Python sürümü |

> Frontend deploy edildikten sonra `CORS_ORIGINS` değerini Vercel URL'inizle güncelleyin.

### 2.4 Backend doğrulama

```bash
curl https://bist30-api.onrender.com/api/health
```

Beklenen yanıt:

```json
{"ok": true, "db_exists": true, "db_path": "..."}
```

> Render free tier servisler ~15 dk idle sonrası uyur; ilk istek 30–60 sn sürebilir.

---

## 3. Vercel Frontend Deployment

### 3.1 Proje import

1. [Vercel Dashboard](https://vercel.com/dashboard) → **Add New** → **Project**
2. GitHub reposunu seçin
3. Framework: **Vite** (otomatik algılanır)

| Alan | Değer |
|------|-------|
| **Build Command** | `npm run build` |
| **Output Directory** | `build` |
| **Install Command** | `npm install` |

### 3.2 Vercel Environment Variables

| Değişken | Değer | Ortamlar |
|----------|-------|----------|
| `VITE_API_URL` | `https://bist30-api.onrender.com` | Production, Preview |

> `VITE_API_URL` sonunda `/api` **olmamalı**. Frontend otomatik olarak `/api` ekler.

### 3.3 CORS güncellemesi

Vercel URL'inizi aldıktan sonra Render'da `CORS_ORIGINS` değişkenini güncelleyin ve servisi redeploy edin.

---

## 4. Environment Variable Referansı

### Frontend (`.env.local` / Vercel)

```env
VITE_API_URL=http://localhost:8000
VITE_API_URL=https://bist30-api.onrender.com
```

### Backend (`backend/.env` / Render)

```env
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
CORS_ORIGINS=https://bist30.vercel.app,https://www.sizindomain.com
BIST_DATABASE_PATH=data/bist30.db
```

Alternatif: tek domain için `FRONTEND_URL` (`CORS_ORIGINS` yerine).

---

## 5. Özel Domain Bağlama

### Vercel (Frontend)

1. Vercel → Project → **Settings** → **Domains**
2. Domain ekleyin (örn. `analytics.sizindomain.com`)
3. DNS kayıtlarını yapılandırın

### Render (Backend — opsiyonel)

1. Render → Service → **Settings** → **Custom Domains**
2. Örn. `api.sizindomain.com` ekleyin

Domain bağladıktan sonra:

- Vercel: `VITE_API_URL=https://api.sizindomain.com`
- Render: `CORS_ORIGINS=https://analytics.sizindomain.com`
- Her iki platformda redeploy

---

## 6. Lokal Geliştirme

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn api:app --reload --port 8000
```

### Frontend

```bash
cp .env.example .env.local
npm install
npm run dev
```

Frontend: http://localhost:3000  
Backend: http://localhost:8000

---

## 7. Bilinen Sınırlamalar

- **SQLite + Render:** Runtime yazmaları kalıcı olmayabilir; DB güncellemesi için repoya commit + redeploy gerekir.
- **Cold start:** Render free tier ilk istekte gecikme yaşatabilir.
- **CORS:** Origin tam eşleşmeli (http/https, slash yok).

---

## 8. Deployment Kontrol Listesi

- [ ] `backend/data/bist30.db` repoda
- [ ] Render `/api/health` → `db_exists: true`
- [ ] Vercel `VITE_API_URL` = Render URL
- [ ] Render `CORS_ORIGINS` = Vercel URL
- [ ] Frontend hisse listesi yükleniyor

---

## 9. Sorun Giderme

| Belirti | Çözüm |
|---------|-------|
| `Database file not found` | `BIST_DATABASE_PATH=data/bist30.db`, DB'yi commit edin |
| CORS blocked | `CORS_ORIGINS` = tam Vercel URL, redeploy |
| API localhost'a gidiyor | Vercel'de `VITE_API_URL` tanımlayıp redeploy |
| 502 / timeout | Render cold start; health endpoint'i önce çağırın |
