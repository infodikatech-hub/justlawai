from firebase_functions import https_fn
from flask import Flask, request, jsonify, make_response
from flask_cors import CORS
import os
import uuid
import json
from google import genai
import traceback
from dotenv import load_dotenv

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Load environment variables
load_dotenv()

# Configure Gemini
# Firebase Functions'da secret manager kullanmak daha iyi ama şimdilik env var veya hardcoded
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "AIzaSyDWQpuRGsR2OXAGxC20hgwCAiueijXTPr0")
if GEMINI_API_KEY:
    client = genai.Client(api_key=GEMINI_API_KEY)
else:
    client = None

# System prompt
SYSTEM_PROMPT = """Sen JustLaw adlı Türk Hukuku AI asistanısın. Görevin Türk Hukuku konusunda doğru ve güvenilir bilgi vermektir.

KURALLAR:
1. Türk Hukuku mevzuatına ve Yargıtay kararlarına dayalı yanıtlar ver
2. Mümkün olduğunca ilgili kanun maddelerini ve karar numaralarını belirt
3. Yanıtlarını açık ve anlaşılır bir dille ver
4. Hukuki tavsiye vermediğini, sadece bilgilendirme yaptığını belirt
5. Emin olmadığın konularda bunu açıkça ifade et
6. Yanıtlarını Türkçe ver

ÖNEMLİ: Sen bir hukuki danışman değilsin, sadece bilgi sağlıyorsun. Kullanıcıların önemli hukuki kararlar için mutlaka bir avukata danışmaları gerektiğini hatırlat."""

# Helper function
def generate_ai_content(prompt: str) -> str:
    if not client:
        raise Exception("Gemini API yapılandırılmamış")
    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash-exp",
            contents=prompt
        )
        return response.text
    except Exception as e:
        raise Exception(f"AI hatası: {str(e)}")

# Routes
@app.route("/")
def root():
    return jsonify({
        "message": "JustLaw API'ye Hoş Geldiniz (Firebase Functions)",
        "version": "1.0.0",
        "status": "active",
        "gemini_configured": client is not None
    })

@app.route("/api/chat", methods=["POST"])
def chat():
    if not client:
        return jsonify({"error": "Gemini API yapılandırılmamış"}), 500
    
    try:
        data = request.get_json()
        message = data.get("message")
        conversation_id = data.get("conversation_id")
        
        full_prompt = f"{SYSTEM_PROMPT}\n\nKullanıcı Sorusu: {message}\n\nYanıtınız:"
        response_text = generate_ai_content(full_prompt)
        
        return jsonify({
            "response": response_text,
            "sources": [],
            "conversation_id": conversation_id or str(uuid.uuid4())
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/dilekce", methods=["POST"])
def create_dilekce():
    if not client:
        return jsonify({"error": "Gemini API yapılandırılmamış"}), 500
        
    try:
        data = request.get_json()
        dilekce_turu = data.get("dilekce_turu")
        bilgiler = data.get("bilgiler")
        
        prompt = f"""Aşağıdaki bilgilere göre profesyonel bir {dilekce_turu} dilekçesi oluştur.

Bilgiler: {bilgiler}

Dilekçe resmi formatta olmalı ve Türk Hukuku standartlarına uygun olmalıdır."""

        response_text = generate_ai_content(prompt)
        
        return jsonify({
            "status": "success",
            "dilekce": response_text,
            "dilekce_id": str(uuid.uuid4())
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/sozlesme-analiz", methods=["POST"])
def analyze_sozlesme():
    if not client:
        return jsonify({"error": "Gemini API yapılandırılmamış"}), 500
        
    try:
        if 'file' not in request.files:
            return jsonify({"error": "Dosya yüklenmedi"}), 400
            
        file = request.files['file']
        if file.filename == '':
            return jsonify({"error": "Dosya seçilmedi"}), 400
            
        content = ""
        filename = file.filename.lower()
        
        try:
            content = file.read().decode('utf-8', errors='ignore')
        except:
            content = f"Dosya adı: {file.filename} (İçerik okunamadı)"
            
        if len(content) > 30000:
             content = content[:30000] + "...(devamı kesildi)"
             
        analiz_prompt = f"""Aşağıdaki sözleşme metnini Türk Hukuku açısından detaylı analiz et.

Dosya Adı: {file.filename}

YANITINI ŞU FORMATTA VER (Markdown kullan):

## 📊 Genel Değerlendirme
Sözleşmenin genel durumu hakkında 2-3 cümle özet.

## ⚠️ Riskli Maddeler
Her riskli madde için:
- **Madde:** [Madde içeriği veya numarası]
- **Risk:** [Neden riskli olduğu]
- **Öneri:** [Nasıl düzeltilebileceği]

## ✅ Olumlu Yönler
- Sözleşmenin güçlü yönleri

## 📝 Genel Öneriler
1. Birinci öneri
2. İkinci öneri
3. Üçüncü öneri

## ⚖️ Hukuki Uyarı
Bu analiz genel bilgilendirme amaçlıdır.

Sözleşme İçeriği:
{content}
"""
        response_text = generate_ai_content(analiz_prompt)
        
        return jsonify({
            "status": "success",
            "analiz": response_text,
            "riskler": [],
            "oneriler": []
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/legal/search", methods=["GET"])
def search_legal():
    query = request.args.get("query")
    
    if not client:
        return jsonify({"results": [], "total": 0, "message": "AI servisi kapalı"})
        
    prompt = f"""Türk Hukuku'nda "{query}" konusuyla ilgili emsal karar özetleri oluştur.
    Yargıtay, Danıştay, Anayasa Mahkemesi ve Rekabet Kurumu kararlarından örnekler ver.
    
    JSON formatında döndür:
    [
        {{"esas_no": "...", "karar_no": "...", "daire": "...", "tarih": "...", "ozet": "...", "source": "yargitay"}}
    ]
    
    Sadece JSON array döndür."""
    
    try:
        ai_text = generate_ai_content(prompt)
        import re
        json_match = re.search(r'\[[\s\S]*\]', ai_text)
        if json_match:
            results = json.loads(json_match.group())
            return jsonify({
                "results": results,
                "total": len(results),
                "message": "AI destekli sonuçlar"
            })
    except Exception as e:
        print(f"AI error: {e}")
        
    return jsonify({"results": [], "total": 0, "message": "Sonuç bulunamadı"})

# Expose Flask app as a Cloud Function
@https_fn.on_request(max_instances=10)
def api(req: https_fn.Request) -> https_fn.Response:
    with app.request_context(req.environ):
        return app.full_dispatch_request()
