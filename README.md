# DiKaTech - Türk Hukuku AI Asistanı

Türk Hukuku alanında yapay zeka destekli hukuki asistan platformu.

## 🏗️ Proje Yapısı

```
dikatech/
├── frontend/           # Flutter uygulaması (Web, iOS, Android)
├── backend/            # Python FastAPI backend
├── docs/               # Dokümantasyon
└── scripts/            # Yardımcı scriptler
```

## 🚀 Teknoloji Stack

| Katman | Teknoloji |
|--------|-----------|
| **Frontend** | Flutter 3.x (Dart) |
| **Backend** | FastAPI (Python) |
| **Database** | Firebase Firestore |
| **Vector DB** | ChromaDB |
| **Auth** | Firebase Auth |
| **LLM** | Gemini 2.0 Flash |
| **Hosting** | Firebase + Railway |

## 📦 Kurulum

### Gereksinimler
- Flutter SDK 3.x
- Python 3.11+
- Firebase CLI
- Node.js 18+

### Frontend (Flutter)
```bash
cd frontend
flutter pub get
flutter run -d chrome
```

### Backend (FastAPI)
```bash
cd backend
python -m venv venv
.\venv\Scripts\activate  # Windows
pip install -r requirements.txt
uvicorn main:app --reload
```

## 🔥 Firebase Kurulumu

1. [Firebase Console](https://console.firebase.google.com) üzerinden yeni proje oluşturun
2. Authentication > Sign-in method > Email/Password ve Google'ı aktifleştirin
3. Firestore Database oluşturun
4. Storage bucket oluşturun
5. Firebase config'i alıp `frontend/lib/firebase_options.dart` dosyasına ekleyin

## 💰 Fiyatlandırma

| Plan | Aylık Fiyat | Özellikler |
|------|-------------|------------|
| Deneme | Ücretsiz (7 gün) | Tüm özellikler |
| Profesyonel | 599₺ | Sınırsız AI, 20 dilekçe/ay |
| Kurumsal | 1.199₺ | Sınırsız her şey + API |

## 📄 Lisans

Tüm hakları saklıdır © 2024 DiKaTech
