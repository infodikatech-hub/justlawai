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

@app.route("/api/payment/create", methods=["POST"])
def create_payment():
    """
    Creates a Shopier payment form and returns it as HTML for auto-submission.
    """
    import os
    import uuid
    import random
    import hashlib
    import hmac
    import base64
    
    data = request.get_json()
    user_id = data.get("user_id")
    plan_type = data.get("plan_type", "professional")
    
    if not user_id:
        return jsonify({"error": "Kullanıcı ID gerekli"}), 400
        
    prices = {
        "professional": 999,
        "enterprise": 1500
    }
    
    order_id = f"ORDER-{uuid.uuid4().hex[:8].upper()}"
    api_key = os.getenv("SHOPIER_API_KEY", "").strip()
    api_secret = os.getenv("SHOPIER_API_SECRET", "").strip()
    
    amount = prices.get(plan_type, 999)
    formatted_amount = f"{float(amount):.2f}"
    random_nr = str(random.randint(100000, 999999))
    
    # Official v4 Pattern
    buyer_name = "Mustafa"
    buyer_surname = "Kullanici"
    buyer_email = "user@justlaw.com"
    buyer_phone = "5551112233"
    billing_address = "Istiklal Cad. No:1"
    city = "Istanbul"
    country = "Turkey"
    zip_code = "34000"
    product_type = "0"
    currency = "0"
    
    data_to_sign = (f"{random_nr}{order_id}{formatted_amount}{currency}{product_type}"
                    f"{buyer_name}{buyer_surname}{buyer_email}{user_id}{buyer_phone}"
                    f"{billing_address}{city}{country}{zip_code}")
    
    signature = base64.b64encode(hmac.new(api_secret.encode('utf-8'), 
                                         data_to_sign.encode('utf-8'), 
                                         hashlib.sha256).digest()).decode('utf-8')
    
    shopier_form = f"""
    <!DOCTYPE html>
    <html>
    <head><title>Ödeme Sayfasına Yönlendiriliyorsunuz...</title></head>
    <body onload="document.getElementById('shopier_form').submit()">
        <div style="text-align:center; padding:50px; font-family:sans-serif;">
            <h3>Güvenli Ödeme Sayfasına Yönlendiriliyorsunuz...</h3>
            <p>Lütfen bekleyin, Shopier'e bağlanılıyor.</p>
        </div>
        <form id="shopier_form" action="https://www.shopier.com/ShowProduct/api_pay4.php" method="post">
            <input type="hidden" name="API_key" value="{api_key}">
            <input type="hidden" name="website_index" value="1">
            <input type="hidden" name="platform_order_id" value="{order_id}">
            <input type="hidden" name="product_name" value="JustLaw {plan_type.title()} Plan">
            <input type="hidden" name="product_type" value="{product_type}">
            <input type="hidden" name="buyer_name" value="{buyer_name}">
            <input type="hidden" name="buyer_surname" value="{buyer_surname}">
            <input type="hidden" name="buyer_email" value="{buyer_email}">
            <input type="hidden" name="buyer_account_number" value="{user_id}">
            <input type="hidden" name="buyer_phone" value="{buyer_phone}">
            <input type="hidden" name="buyer_id_nr" value="11111111111">
            <input type="hidden" name="buyer_account_age" value="0">
            <input type="hidden" name="billing_address" value="{billing_address}">
            <input type="hidden" name="city" value="{city}">
            <input type="hidden" name="country" value="{country}">
            <input type="hidden" name="zip_code" value="{zip_code}">
            <input type="hidden" name="price" value="{formatted_amount}">
            <input type="hidden" name="currency" value="{currency}">
            <input type="hidden" name="random_nr" value="{random_nr}">
            <input type="hidden" name="signature" value="{signature}">
            <input type="hidden" name="modul_version" value="1.0.4">
        </form>
    </body>
    </html>
    """
    
    return jsonify({
        "payment_html": shopier_form,
        "order_id": order_id,
        "mode": "html_content"
    })

@app.route("/api/payment/callback", methods=["POST"])
def payment_callback():
    """
    Webhook from Shopier.
    """
    import hmac
    import hashlib
    import base64
    
    try:
        data = request.form
        status = data.get("status")
        order_id = data.get("platform_order_id")
        user_id = data.get("buyer_account_number")
        incoming_signature = data.get("signature")
        random_nr = data.get("random_nr")
        
        api_secret = os.getenv("SHOPIER_API_SECRET", "").strip()
        data_to_verify = f"{random_nr}{order_id}"
        expected_signature = base64.b64encode(hmac.new(api_secret.encode('utf-8'), 
                                                      data_to_verify.encode('utf-8'), 
                                                      hashlib.sha256).digest()).decode('utf-8')
        
        if incoming_signature == expected_signature and status == "success":
            # Here we would update the user plan in Firestore
            print(f"PAYMENT SUCCESS: User {user_id}, Order {order_id}")
            return "OK", 200
        else:
            print(f"PAYMENT FAILED or INVALID: User {user_id}, Status {status}")
            return "Invalid Signature", 400
            
    except Exception as e:
        print(f"CALLBACK ERROR: {str(e)}")
        return str(e), 500

# Expose Flask app as a Cloud Function
@https_fn.on_request(max_instances=10)
def api(req: https_fn.Request) -> https_fn.Response:
    with app.request_context(req.environ):
        return app.full_dispatch_request()
