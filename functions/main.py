from firebase_functions import https_fn
from flask import Flask, request, jsonify, make_response, Response
from flask_cors import CORS
import os
import uuid
import json
import io
import asyncio
from google import genai
import traceback
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, firestore

# Initialize Firebase
if not firebase_admin._apps:
    firebase_admin.initialize_app()

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Load environment variables
load_dotenv()

# Configure Gemini
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "AIzaSyDWQpuRGsR2OXAGxC20hgwCAiueijXTPr0")
if GEMINI_API_KEY:
    client = genai.Client(api_key=GEMINI_API_KEY)
else:
    client = None

# System prompt from backend/main.py
SYSTEM_PROMPT = """Sen JustLaw, Türk Hukuku konusunda uzmanlaşmış, Yargıtay içtihatlarına hakim ve mevzuatı derinlemesine bilen kıdemli bir yapay zeka hukuk asistanısın.

KİMLİK VE TON:
- Profesyonel, objektif, net ve hukuki terminolojiye hakim ancak vatandaşın anlayabileceği bir dil kullan.
- Asla varsayımda bulunma, her zaman yürürlükteki kanunlara (TMK, TCK, TBK, vb.) dayan.
- **KRİTİK:** Eğer bir Yargıtay kararının tam Esas/Karar numarasını ve tarihini kesin olarak bilmiyorsan, asla rastgele numara uydurma. Bunun yerine "Yargıtay'ın yerleşik içtihatlarına göre..." veya "Benzer kararlarda..." ifadelerini kullan.
- Bir "Avukat" titizliğiyle analiz yap ancak hukuki danışmanlık değil, "hukuki bilgi ve yönlendirme" sağladığını unutma.

YANIT STRATEJİSİ (ADIM ADIM):
1. **Hukuki Sorunu Tespit Et:** Kullanıcının yaşadığı olaydaki temel hukuki uyuşmazlığı belirle.
2. **İlgili Mevzuatı Belirt:** Kanun maddelerini (Örn: 4721 sayılı TMK m. 166) ve yerleşik Yargıtay içtihatlarını referans göster.
3. **Analiz ve Uygulama:** Mevzuatın bu somut olaya nasıl uygulanacağını açıkla. "Şu durumda haklarınız şunlardır..." gibi net ifadeler kullan.
4. **Pratik Adımlar:** Kullanıcının atması gereken somut adımları (Noter ihtarı, delil tespiti, dava açma süresi vb.) maddeler halinde sırala.

BİÇİMLENDİRME KURALLARI:
- **Kanun Maddeleri:** Kalın yaz (Örn: **TBK m. 12**).
- **Başlıklar:** Yanıtlarını mantıksal başlıklara böl (Hukuki Analiz, İzlenecek Yol, Dikkat Edilmesi Gerekenler).
- **Uyarı:** Her yanıtın sonuna, bunun bir bilgilendirme olduğunu ve "hak kaybına uğramamak için bir avukata başvurulması gerektiğini" hatırlatan standart yasal uyarıyı ekle.

HEDEF:
Kullanıcıya sadece "ne olduğunu" değil, "haklarını nasıl koruyacağını" gösteren eylem odaklı yanıtlar ver."""

# Import local services
try:
    from services.pdf_generator import pdf_generator
    from services.udf_generator import udf_generator
    from services.scraper import YargitayScraper
except ImportError:
    # Handle if run outside root or during dev
    print("Warning: Local services not found. Ensure 'services' folder exists in 'functions'.")

# Helper function
def increment_user_stat(user_id: str, field: str):
    if not user_id or user_id == "anonymous": return
    try:
        db = firestore.client()
        user_ref = db.collection("users").document(user_id)
        user_ref.update({field: firestore.Increment(1)})
    except: pass

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
        "version": "1.1.0",
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
        user_id = data.get("user_id")
        
        prompt = f"""Aşağıdaki bilgilere göre profesyonel bir {dilekce_turu} dilekçesi oluştur.
Bilgiler: {bilgiler}
Dilekçe resmi formatta olmalı ve Türk Hukuku standartlarına uygun olmalıdır."""

        response_text = generate_ai_content(prompt)
        increment_user_stat(user_id, "petition_count")

        return jsonify({
            "status": "success",
            "dilekce": response_text,
            "dilekce_id": str(uuid.uuid4())
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/dilekce/pdf", methods=["POST"])
def create_dilekce_pdf():
    try:
        data = request.get_json()
        # AI zenginleştirme (backend/main.py'deki mantık)
        pdf_bytes = pdf_generator.create_pdf(data)
        
        response = make_response(pdf_bytes)
        response.headers['Content-Type'] = 'application/pdf'
        response.headers['Content-Disposition'] = f'attachment; filename=dilekce.pdf'
        return response
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/dilekce/udf", methods=["POST"])
def create_dilekce_udf():
    try:
        data = request.get_json()
        udf_bytes = udf_generator.create_udf(data)
        
        response = make_response(udf_bytes)
        response.headers['Content-Type'] = 'application/xml'
        response.headers['Content-Disposition'] = 'attachment; filename=dilekce.udf'
        return response
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/sozlesme-analiz", methods=["POST"])
def analyze_sozlesme():
    if not client:
        return jsonify({"error": "Gemini API yapılandırılmamış"}), 500
        
    try:
        # User ID handling
        user_id = request.form.get("user_id", "anonymous")
        
        file = request.files.get('file')
        if not file:
            return jsonify({"error": "Dosya yüklenmedi"}), 400
            
        content = ""
        filename = file.filename.lower()
        
        if filename.endswith(".pdf"):
            import PyPDF2
            pdf_reader = PyPDF2.PdfReader(io.BytesIO(file.read()))
            for page in pdf_reader.pages:
                content += page.extract_text() + "\n"
        else:
            content = file.read().decode('utf-8', errors='ignore')
            
        if len(content) > 30000:
             content = content[:30000] + "..."
             
        analiz_prompt = f"Şu metni analiz et:\n{content}\nHukuki riskleri belirle."
        response_text = generate_ai_content(analiz_prompt)
        
        if user_id != "anonymous":
            increment_user_stat(user_id, "analysis_count")

        return jsonify({
            "status": "success",
            "analiz": response_text
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/legal/search", methods=["GET"])
def search_legal():
    query = request.args.get("query")
    if not query: return jsonify({"error": "Sorgu eksik"}), 400
    
    # Simple AI based search
    prompt = f'"{query}" hakkında Yargıtay emsal kararları ara ve JSON döndür.'
    try:
        ai_text = generate_ai_content(prompt)
        # Parse JSON from AI...
        return jsonify({"results": [], "message": "AI arama sonucu"})
    except:
        return jsonify({"error": "Arama hatası"}), 500

# Expose Flask app as a Cloud Function
@https_fn.on_request(max_instances=10)
def api(req: https_fn.Request) -> https_fn.Response:
    with app.request_context(req.environ):
        return app.full_dispatch_request()
