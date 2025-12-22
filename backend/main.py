"""
JustLaw Backend - FastAPI
Türk Hukuku AI Asistanı API
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import os
import uuid
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# New google.genai package (replaces deprecated google.generativeai)
from google import genai

# Configure Gemini
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    client = genai.Client(api_key=GEMINI_API_KEY)
    print(f"Gemini configured with key: {GEMINI_API_KEY[:10]}...")
else:
    client = None
    print("WARNING: GEMINI_API_KEY not found!")

# Helper function for AI generation
def generate_ai_content(prompt: str) -> str:
    """Generate content using Gemini API."""
    if not client:
        raise HTTPException(status_code=500, detail="Gemini API yapılandırılmamış")
    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash-exp",
            contents=prompt
        )
        return response.text
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI hatası: {str(e)}")

app = FastAPI(
    title="JustLaw API",
    description="Türk Hukuku AI Asistanı Backend",
    version="1.0.0"
)

# CORS ayarları
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# System prompt for legal assistant
SYSTEM_PROMPT = """Sen JustLaw adlı Türk Hukuku AI asistanısın. Görevin Türk Hukuku konusunda doğru ve güvenilir bilgi vermektir.

KURALLAR:
1. Türk Hukuku mevzuatına ve Yargıtay kararlarına dayalı yanıtlar ver
2. Mümkün olduğunca ilgili kanun maddelerini ve karar numaralarını belirt
3. Yanıtlarını açık ve anlaşılır bir dille ver
4. Hukuki tavsiye vermediğini, sadece bilgilendirme yaptığını belirt
5. Emin olmadığın konularda bunu açıkça ifade et
6. Yanıtlarını Türkçe ver

ÖNEMLİ: Sen bir hukuki danışman değilsin, sadece bilgi sağlıyorsun. Kullanıcıların önemli hukuki kararlar için mutlaka bir avukata danışmaları gerektiğini hatırlat."""

# ============== MODELS ==============

class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    user_id: str

class ChatResponse(BaseModel):
    response: str
    sources: List[dict]
    conversation_id: str

class DilekceRequest(BaseModel):
    dilekce_turu: str
    bilgiler: dict
    user_id: str

class SozlesmeAnaliz(BaseModel):
    icerik: str
    user_id: str

# ============== ROUTES ==============

@app.get("/")
async def root():
    return {
        "message": "JustLaw API'ye Hoş Geldiniz",
        "version": "1.0.0",
        "status": "active",
        "gemini_configured": client is not None
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy", "gemini": client is not None}

@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Kullanıcı sorusuna Gemini ile yanıt üretir.
    """
    import traceback
    
    if not client:
        raise HTTPException(status_code=500, detail="Gemini API yapılandırılmamış")
    
    try:
        # Create prompt with system instructions
        full_prompt = f"{SYSTEM_PROMPT}\n\nKullanıcı Sorusu: {request.message}\n\nYanıtınız:"
        
        print(f"Sending prompt to Gemini: {request.message[:50]}...")
        
        # Generate response using helper
        response_text = generate_ai_content(full_prompt)
        
        print(f"Got response from Gemini")
        
        # Generate conversation ID if not provided
        conv_id = request.conversation_id or str(uuid.uuid4())
        
        return ChatResponse(
            response=response_text,
            sources=[],
            conversation_id=conv_id
        )
        
    except Exception as e:
        error_details = traceback.format_exc()
        print(f"Error generating response: {error_details}")
        raise HTTPException(status_code=500, detail=f"Yanıt üretilirken hata: {str(e)}")

@app.post("/api/dilekce")
async def create_dilekce(request: DilekceRequest):
    """
    Dilekçe oluşturur.
    """
    if not client:
        raise HTTPException(status_code=500, detail="Gemini API yapılandırılmamış")
    
    try:
        dilekce_prompt = f"""Aşağıdaki bilgilere göre profesyonel bir {request.dilekce_turu} dilekçesi oluştur.

Bilgiler: {request.bilgiler}

Dilekçe resmi formatta olmalı ve Türk Hukuku standartlarına uygun olmalıdır."""

        response_text = generate_ai_content(dilekce_prompt)
        
        return {
            "status": "success",
            "dilekce": response_text,
            "dilekce_id": str(uuid.uuid4())
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Dilekçe oluşturulurken hata: {str(e)}")

from fastapi import UploadFile, File

@app.post("/api/sozlesme-analiz")
async def analyze_sozlesme(file: UploadFile = File(...), user_id: str = "anonymous"):
    """
    Sözleşme analizi yapar. Dosya yükleme (PDF/TXT) destekler.
    """
    if not client:
        raise HTTPException(status_code=500, detail="Gemini API yapılandırılmamış")
    
    try:
        content = ""
        filename = file.filename.lower()
        
        # Read file content based on type
        if filename.endswith(".pdf"):
            import PyPDF2
            from io import BytesIO
            
            pdf_bytes = await file.read()
            pdf_reader = PyPDF2.PdfReader(BytesIO(pdf_bytes))
            
            for page in pdf_reader.pages:
                content += page.extract_text() + "\n"
                
        elif filename.endswith(".txt"):
            content_bytes = await file.read()
            content = content_bytes.decode("utf-8")
        else:
            # Fallback for unsupported/other types - try to read as text or just use filename
            try:
                content_bytes = await file.read()
                content = content_bytes.decode("utf-8")
            except:
                content = f"Dosya adı: {file.filename} (İçerik okunamadı, lütfen analiz için genel bir değerlendirme yap.)"

        # Truncate if too long (Gemini limits)
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
        
        return {
            "status": "success",
            "analiz": response_text,
            "riskler": [],
            "oneriler": []
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Analiz sırasında hata: {str(e)}")

@app.post("/api/dilekce/generate-field")
async def generate_dilekce_field(request: dict):
    """
    Dilekçenin belirli bir alanını (konu, talep vb.) AI ile oluşturur.
    Expected keys: field_type (konu|talepler), context (other form data)
    """
    if not client:
        raise HTTPException(status_code=500, detail="Gemini API yapılandırılmamış")
        
    try:
        field_type = request.get("field_type")
        context = request.get("context", {})
        
        if field_type == "konu":
            prompt = f"""Aşağıdaki dava bilgileri için kısa, öz ve hukuki bir 'Konu' metni yaz.
            
            Dava Türü: {context.get('dilekce_turu')}
            Davacı: {context.get('davaci_adi')}
            Davalı: {context.get('davalı_adi')}
            
            Sadece konu metnini yaz, başlık veya ek açıklama koyma."""
            
        elif field_type == "talepler":
            prompt = f"""Aşağıdaki dava bilgileri için 'Sonuç ve İstem' (Talepler) kısmı yaz. Maddeler halinde olsun.
            
            Dava Türü: {context.get('dilekce_turu')}
            Konu: {context.get('konu')}
            Açıklamalar Özeti: {context.get('aciklamalar')[:500] if context.get('aciklamalar') else 'Belirtilmedi'}
            
            Sadece talep maddelerini yaz."""
        else:
            return {"text": ""}
            
        response_text = generate_ai_content(prompt)
        return {"text": response_text.strip()}
        
    except Exception as e:
        return {"text": "", "error": str(e)}

@app.get("/api/mevzuat/search")
async def search_mevzuat(query: str, limit: int = 10):
    # Placeholder for future implementation
    if not client:
        return {"results": [], "message": "Sistem hatası"}
        
    # Generate informative "fake" results via AI if database is empty
    prompt = f"""Türk Hukuku mevzuatında "{query}" ile ilgili en önemli 3 kanun maddesini bul/hatırla.
    
    Yanıtı şu JSON formatında ver:
    [
        {{
            "mevzuat_no": "Kanun No",
            "baslik": "Kanun Adı",
            "madde_no": "Madde X",
            "icerik": "Madde içeriğinin özeti..."
        }}
    ]"""
    
    try:
        response = generate_ai_content(prompt)
        import json
        import re
        json_match = re.search(r'\[[\s\S]*\]', response_text)
        if json_match:
            results = json.loads(json_match.group())
            return {"results": results, "total": len(results), "message": "AI tarafından oluşturulan mevzuat önerileri"}
    except:
        pass
        
    return {"results": [], "total": 0, "message": "Sonuç bulunamadı"}

# ============== MULTI-SOURCE LEGAL SEARCH ==============

@app.get("/api/legal/search")
async def search_all_sources(
    query: str, 
    sources: str = "yargitay,danistay,anayasa,rekabet",
    limit: int = 10
):
    """
    Birden fazla hukuki kaynaktan arama yapar.
    sources: Virgülle ayrılmış kaynak listesi (yargitay,danistay,anayasa,rekabet)
    """
    from backend.services.scraper import YargitayScraper, DanistayScraper, AnayasaMahkemesiScraper, RekabetKurumuScraper
    import asyncio
    
    source_list = [s.strip().lower() for s in sources.split(",")]
    all_results = []
    errors = []
    
    async def search_with_timeout(scraper, name, query, limit):
        try:
            results = await asyncio.wait_for(
                scraper.search_kararlar(query, limit),
                timeout=8.0
            )
            await scraper.close()
            return results
        except asyncio.TimeoutError:
            return []
        except Exception as e:
            print(f"{name} error: {e}")
            return []
    
    tasks = []
    
    if "yargitay" in source_list:
        tasks.append(("Yargıtay", search_with_timeout(YargitayScraper(), "Yargıtay", query, limit)))
    
    if "danistay" in source_list:
        tasks.append(("Danıştay", search_with_timeout(DanistayScraper(), "Danıştay", query, limit)))
    
    if "anayasa" in source_list:
        tasks.append(("AYM", search_with_timeout(AnayasaMahkemesiScraper(), "AYM", query, limit)))
    
    if "rekabet" in source_list:
        tasks.append(("Rekabet", search_with_timeout(RekabetKurumuScraper(), "Rekabet", query, limit)))
    
    # Run all searches concurrently
    if tasks:
        results = await asyncio.gather(*[t[1] for t in tasks], return_exceptions=True)
        
        for i, result in enumerate(results):
            source_name = tasks[i][0]
            if isinstance(result, list) and result:
                for r in result:
                    r['source'] = source_name.lower()
                all_results.extend(result)
            elif isinstance(result, Exception):
                errors.append(f"{source_name}: {str(result)}")
    
    # AI fallback if no results
    if not all_results and client:
        prompt = f"""Türk Hukuku'nda "{query}" konusuyla ilgili emsal karar özetleri oluştur.
        Yargıtay, Danıştay, Anayasa Mahkemesi ve Rekabet Kurumu kararlarından örnekler ver.
        
        JSON formatında döndür:
        [
            {{"esas_no": "...", "karar_no": "...", "daire": "...", "tarih": "...", "ozet": "...", "source": "yargitay"}}
        ]
        
        Sadece JSON array döndür."""
        
        try:
            ai_text = generate_ai_content(prompt)
            import json
            import re
            json_match = re.search(r'\[[\s\S]*\]', ai_text)
            if json_match:
                all_results = json.loads(json_match.group())
        except Exception as e:
            print(f"AI fallback error: {e}")
    
    return {
        "results": all_results,
        "total": len(all_results),
        "sources": source_list,
        "message": "AI destekli sonuçlar" if not all_results else "success",
        "errors": errors if errors else None
    }

# ============== UYAP UDF FORMAT ==============

from fastapi import UploadFile, File, Form
from backend.services.udf_generator import udf_generator

@app.post("/api/dilekce/udf")
async def create_dilekce_udf(
    mahkeme: str = Form(...),
    davaci_adi: str = Form(...),
    davaci_tc: str = Form(""),
    davaci_adres: str = Form(""),
    davali_adi: str = Form(...),
    davali_adres: str = Form(""),
    konu: str = Form(...),
    aciklamalar: str = Form(...),
    talepler: str = Form(...),
    dilekce_turu: str = Form("genel")
):
    """
    UYAP uyumlu UDF formatında dilekçe oluşturur.
    """
    from fastapi.responses import Response
    
    try:
        # AI ile zenginleştir
        enhanced_data = {
            'mahkeme': mahkeme,
            'davaci_adi': davaci_adi,
            'davaci_tc': davaci_tc,
            'davaci_adres': davaci_adres,
            'davali_adi': davali_adi,
            'davali_adres': davali_adres,
            'konu': konu,
            'aciklamalar': aciklamalar,
            'talepler': talepler,
            'dilekce_turu': dilekce_turu
        }
        
        if client:
            try:
                enhance_prompt = f"""Dilekçe içeriğini profesyonel hukuki dile çevir:
                Konu: {konu}
                Açıklamalar: {aciklamalar}
                Talepler: {talepler}
                
                JSON döndür: {{"konu": "...", "aciklamalar": "...", "talepler": "..."}}"""
                
                ai_text = generate_ai_content(enhance_prompt)
                import json
                import re
                json_match = re.search(r'\{[\s\S]*\}', ai_text)
                if json_match:
                    ai_data = json.loads(json_match.group())
                    enhanced_data.update(ai_data)
            except:
                pass
        
        udf_bytes = udf_generator.create_udf(enhanced_data)
        
        return Response(
            content=udf_bytes,
            media_type="application/xml",
            headers={
                "Content-Disposition": f"attachment; filename=dilekce_{dilekce_turu}.udf"
            }
        )
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"UDF oluşturulurken hata: {str(e)}")

@app.post("/api/dilekce/udf/parse")
async def parse_udf_file(file: UploadFile = File(...)):
    """
    UDF dosyasını parse eder ve içeriğini döndürür.
    """
    try:
        content = await file.read()
        data = udf_generator.parse_udf(content)
        
        return {
            "status": "success",
            "data": data
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"UDF parse hatası: {str(e)}")

@app.get("/api/yargitay/search")
async def search_yargitay(query: str, limit: int = 10):
    """
    Yargıtay kararları araması yapar. Scraper çalışmazsa AI devreye girer.
    """
    # 1. Try Scraper first (with short timeout)
    from backend.services.scraper import YargitayScraper
    import asyncio
    
    try:
        # Run scraper with timeout to avoid long waits if site is slow
        scraper = YargitayScraper()
        # Create a task for search
        try:
             # Basit senkron/asenkron wrap
            kararlar = await asyncio.wait_for(scraper.search_kararlar(query, limit), timeout=8.0)
            await scraper.close()
            
            if kararlar:
                return {
                    "results": kararlar,
                    "total": len(kararlar),
                    "message": "success"
                }
        except asyncio.TimeoutError:
            print("Yargıtay scraper timeout - switching to AI")
            # Do not close here, let it be garbage collected or handled
        except Exception as e:
            print(f"Scraper error: {e}")
            
    except Exception as e:
        print(f"General search error: {e}")

    # 2. Fallback to Gemini AI
    if client:
        print(f"Using AI fallback for query: {query}")
        prompt = f"""Türk Hukuku Yargıtay içtihatlarında "{query}" konusuyla ilgili 4 adet emsal karar özeti oluştur.
        Gerçekçi daire isimleri, esas/karar numaraları ve tarihler kullan.
        
        Her karar için tam olarak şu JSON yapısını kullan:
        [
          {{
            "esas_no": "2023/...",
            "karar_no": "2024/...",
            "daire": "... Hukuk Dairesi",
            "tarih": "DD.MM.YYYY",
            "ozet": "Kararın hukuki özeti...",
            "content": "Kararın biraz daha detaylı gerekçesi..."
          }}
        ]
        
        Sadece JSON array döndür."""
        
        try:
            response = generate_ai_content(prompt)
            import json
            import re
            
            json_match = re.search(r'\[[\s\S]*\]', response)
            if json_match:
                ai_results = json.loads(json_match.group())
                return {
                    "results": ai_results,
                    "total": len(ai_results),
                    "message": "AI tarafından oluşturulan emsal karar önerileri (Resmi kaynaklara erişilemedi)"
                }
        except Exception as e:
            print(f"AI generation error: {e}")
            
    return {
        "results": [],
        "total": 0,
        "message": "Sonuç bulunamadı (Bağlantı hatası)"
    }

# ============== PDF GENERATION ==============

from fastapi.responses import Response
from backend.services.pdf_generator import pdf_generator

class DilekcePDFRequest(BaseModel):
    mahkeme: str
    davaci_adi: str
    davaci_tc: str
    davaci_adres: str
    davali_adi: str
    davali_adres: str
    konu: str
    aciklamalar: str
    talepler: str
    dilekce_turu: str

@app.post("/api/dilekce/pdf")
async def create_dilekce_pdf(request: DilekcePDFRequest):
    """
    Dilekçe PDF'i oluşturur ve döner. AI ile tüm alanları zenginleştirir.
    """
    try:
        enhanced_data = {
            'mahkeme': request.mahkeme,
            'davaci_adi': request.davaci_adi,
            'davaci_tc': request.davaci_tc,
            'davaci_adres': request.davaci_adres,
            'davali_adi': request.davali_adi,
            'davali_adres': request.davali_adres,
            'dilekce_turu': request.dilekce_turu,
            'konu': request.konu,
            'aciklamalar': request.aciklamalar,
            'talepler': request.talepler
        }

        # AI ile zenginleştirme (Varsa)
        if model:
            try:
                # Tek bir prompt ile tüm alanları zenginleştir - GERÇEK DİLEKÇE ÖRNEKLERİ İLE
                enhance_prompt = f"""Sen deneyimli bir Türk Hukuku avukatısın. Aşağıdaki taslağı, Türk Mahkemeleri'nde kabul gören resmi dilekçe formatına çevir.

ÖRNEK DİLEKÇE FORMATI (TAKİP ET):
---
KONU: [Kısa ve net başlık, örn: "Kıdem ve İhbar Tazminatı ile Fazla Mesai Ücreti Alacağı Talebi"]

AÇIKLAMALAR:

1. Müvekkil, davalı şirkette [tarih] - [tarih] tarihleri arasında [pozisyon] olarak çalışmıştır.

2. [Olayların kronolojik ve detaylı anlatımı, maddeler halinde]

3. 4857 sayılı İş Kanunu'nun [ilgili madde] hükmü gereğince...

4. Yargıtay [Daire] Dairesi'nin [tarih] tarihli [esas/karar no] sayılı kararında da belirtildiği üzere...

SONUÇ VE İSTEM:

Yukarıda açıklanan nedenlerle;

1. Davanın KABULÜNE,
2. [Miktar] TL tutarındaki [alacak türü] alacağının yasal faiziyle birlikte davalıdan tahsiline,
3. Yargılama giderleri ve vekalet ücretinin davalı tarafa yükletilmesine,

karar verilmesini saygılarımla arz ve talep ederim.
---

ŞİMDİ BU TASLAĞA UYGULA:
- Dilekçe Türü: {request.dilekce_turu}
- Kullanıcının Konusu: {request.konu}
- Kullanıcının Açıklamaları: {request.aciklamalar}
- Kullanıcının Talepleri: {request.talepler}

ÖNEMLİ KURALLAR:
1. Açıklamalar en az 4-5 madde olsun, detaylı ve kronolojik.
2. İlgili kanun maddelerini ve Yargıtay kararlarını referans göster.
3. Talepler en az 3-4 madde olsun, net ve ölçülebilir.
4. Profesyonel ve resmi dil kullan.
5. Eksik veya belirsiz kısımları "[...]" ile işaretle ki kullanıcı doldurabilsin.

YANIT FORMATI (SADECE JSON):
{{
    "konu": "Yeni konu başlığı",
    "aciklamalar": "1. Birinci madde...\\n\\n2. İkinci madde...\\n\\n3. Üçüncü madde...",
    "talepler": "Yukarıda açıklanan nedenlerle;\\n\\n1. ...\\n2. ...\\n3. ..."
}}"""
                
                ai_response = generate_ai_content(enhance_prompt)
                
                import json
                import re
                json_match = re.search(r'\{[\s\S]*\}', ai_response_text)
                
                if json_match:
                    ai_data = json.loads(json_match.group())
                    enhanced_data['konu'] = ai_data.get('konu', request.konu)
                    enhanced_data['aciklamalar'] = ai_data.get('aciklamalar', request.aciklamalar)
                    enhanced_data['talepler'] = ai_data.get('talepler', request.talepler)
                    
            except Exception as e:
                print(f"AI zenginleştirme hatası: {e}")
                # Hata olursa orijinal verileri kullan (zaten enhanced_data'da var)
        
        # PDF oluştur
        pdf_bytes = pdf_generator.create_dilekce(enhanced_data)
        
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=dilekce_{request.dilekce_turu}.pdf"
            }
        )
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"PDF oluşturulurken hata: {str(e)}")

@app.post("/api/dilekce/generate")
async def generate_dilekce_with_ai(request: DilekceRequest):
    """
    AI ile dilekçe metni oluşturur (PDF olmadan).
    """
    if not client:
        raise HTTPException(status_code=500, detail="Gemini API yapılandırılmamış")
    
    try:
        prompt = f"""Aşağıdaki bilgilere göre profesyonel bir {request.dilekce_turu} dilekçesi oluştur.

Bilgiler: {request.bilgiler}

Dilekçe şu formatta olmalı:
1. Mahkeme başlığı
2. Davacı bilgileri
3. Davalı bilgileri
4. Konu
5. Açıklamalar (maddeler halinde)
6. Sonuç ve Talep
7. Tarih ve imza yeri

Türk Hukuku standartlarına tam uygun olmalıdır."""

        response_text = generate_ai_content(prompt)
        
        return {
            "status": "success",
            "dilekce_metni": response_text,
            "dilekce_id": str(uuid.uuid4())
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Dilekçe oluşturulurken hata: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

