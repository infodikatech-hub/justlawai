"""
UYAP UDF Format Generator
UYAP (Ulusal Yargı Ağı Projesi) için UDF formatında dilekçe oluşturma
"""
import xml.etree.ElementTree as ET
from datetime import datetime
from typing import Dict, Optional
import io


class UDFGenerator:
    """
    UYAP sistemine uyumlu UDF (Universal Document Format) dosyaları oluşturur.
    UDF dosyaları XML tabanlı yapıdadır ve UYAP sistemine yüklenebilir.
    """
    
    # UYAP dilekçe türleri
    DILEKCE_TURLERI = {
        "dava": "1",
        "cevap": "2", 
        "itiraz": "3",
        "istinaf": "4",
        "temyiz": "5",
        "icra": "6",
        "sikayet": "7",
        "talep": "8",
        "beyan": "9",
        "genel": "0"
    }
    
    def __init__(self):
        self.version = "1.0"
        self.encoding = "UTF-8"
    
    def create_udf(self, data: Dict) -> bytes:
        """
        Dilekçe verilerinden UDF formatında XML dosyası oluşturur.
        
        Args:
            data: Dilekçe verileri içeren dictionary
                - mahkeme: str
                - davaci_adi: str
                - davaci_tc: str
                - davaci_adres: str
                - davali_adi: str
                - davali_adres: str
                - konu: str
                - aciklamalar: str
                - talepler: str
                - dilekce_turu: str
                - ekler: List[str] (opsiyonel)
        
        Returns:
            UDF formatında XML bytes
        """
        # Root element
        root = ET.Element("UDF")
        root.set("version", self.version)
        root.set("xmlns", "http://www.uyap.gov.tr/udf")
        
        # Metadata
        meta = ET.SubElement(root, "Metadata")
        ET.SubElement(meta, "OlusturmaTarihi").text = datetime.now().isoformat()
        ET.SubElement(meta, "Uygulama").text = "JustLaw"
        ET.SubElement(meta, "Versiyon").text = "1.0"
        
        # Dilekçe bilgileri
        dilekce = ET.SubElement(root, "Dilekce")
        ET.SubElement(dilekce, "Tur").text = self.DILEKCE_TURLERI.get(
            data.get("dilekce_turu", "genel"), "0"
        )
        ET.SubElement(dilekce, "TurAdi").text = data.get("dilekce_turu", "Genel Dilekçe")
        
        # Mahkeme bilgileri
        mahkeme = ET.SubElement(root, "Mahkeme")
        ET.SubElement(mahkeme, "Ad").text = data.get("mahkeme", "")
        ET.SubElement(mahkeme, "Il").text = ""  # Opsiyonel
        ET.SubElement(mahkeme, "Ilce").text = ""  # Opsiyonel
        
        # Davacı bilgileri
        davaci = ET.SubElement(root, "Davaci")
        ET.SubElement(davaci, "AdSoyad").text = data.get("davaci_adi", "")
        ET.SubElement(davaci, "TCKimlikNo").text = data.get("davaci_tc", "")
        ET.SubElement(davaci, "Adres").text = data.get("davaci_adres", "")
        ET.SubElement(davaci, "Telefon").text = ""  # Opsiyonel
        ET.SubElement(davaci, "Eposta").text = ""  # Opsiyonel
        
        # Davalı bilgileri
        davali = ET.SubElement(root, "Davali")
        ET.SubElement(davali, "AdSoyad").text = data.get("davali_adi", "")
        ET.SubElement(davali, "Adres").text = data.get("davali_adres", "")
        
        # İçerik
        icerik = ET.SubElement(root, "Icerik")
        ET.SubElement(icerik, "Konu").text = data.get("konu", "")
        
        # Açıklamalar (maddeler halinde)
        aciklamalar_elem = ET.SubElement(icerik, "Aciklamalar")
        aciklamalar_text = data.get("aciklamalar", "")
        
        # Maddelere ayır
        maddeler = aciklamalar_text.split("\n\n")
        for i, madde in enumerate(maddeler, 1):
            if madde.strip():
                madde_elem = ET.SubElement(aciklamalar_elem, "Madde")
                madde_elem.set("no", str(i))
                madde_elem.text = madde.strip()
        
        # Talepler
        talepler_elem = ET.SubElement(icerik, "Talepler")
        talepler_text = data.get("talepler", "")
        
        talep_maddeler = talepler_text.split("\n")
        for i, talep in enumerate(talep_maddeler, 1):
            if talep.strip() and not talep.strip().startswith("Yukarıda"):
                talep_elem = ET.SubElement(talepler_elem, "Talep")
                talep_elem.set("no", str(i))
                talep_elem.text = talep.strip()
        
        # Ekler
        ekler_elem = ET.SubElement(root, "Ekler")
        for ek in data.get("ekler", []):
            ek_elem = ET.SubElement(ekler_elem, "Ek")
            ET.SubElement(ek_elem, "Ad").text = ek
        
        # Tarih ve imza
        imza = ET.SubElement(root, "Imza")
        ET.SubElement(imza, "Tarih").text = datetime.now().strftime("%d.%m.%Y")
        ET.SubElement(imza, "Imzalayan").text = data.get("davaci_adi", "")
        
        # XML string oluştur
        tree = ET.ElementTree(root)
        buffer = io.BytesIO()
        tree.write(buffer, encoding="utf-8", xml_declaration=True)
        
        return buffer.getvalue()
    
    def parse_udf(self, udf_content: bytes) -> Dict:
        """
        UDF dosyasını parse eder ve dictionary olarak döndürür.
        
        Args:
            udf_content: UDF XML içeriği bytes olarak
            
        Returns:
            Parse edilmiş dilekçe verisi dictionary
        """
        try:
            root = ET.fromstring(udf_content)
            
            # Tüm verileri çıkar
            data = {
                "mahkeme": "",
                "davaci_adi": "",
                "davaci_tc": "",
                "davaci_adres": "",
                "davali_adi": "",
                "davali_adres": "",
                "konu": "",
                "aciklamalar": "",
                "talepler": "",
                "dilekce_turu": "",
                "ekler": []
            }
            
            # Mahkeme
            mahkeme_elem = root.find(".//Mahkeme/Ad")
            if mahkeme_elem is not None:
                data["mahkeme"] = mahkeme_elem.text or ""
            
            # Davacı
            davaci = root.find(".//Davaci")
            if davaci is not None:
                data["davaci_adi"] = (davaci.find("AdSoyad").text or "") if davaci.find("AdSoyad") is not None else ""
                data["davaci_tc"] = (davaci.find("TCKimlikNo").text or "") if davaci.find("TCKimlikNo") is not None else ""
                data["davaci_adres"] = (davaci.find("Adres").text or "") if davaci.find("Adres") is not None else ""
            
            # Davalı
            davali = root.find(".//Davali")
            if davali is not None:
                data["davali_adi"] = (davali.find("AdSoyad").text or "") if davali.find("AdSoyad") is not None else ""
                data["davali_adres"] = (davali.find("Adres").text or "") if davali.find("Adres") is not None else ""
            
            # İçerik
            icerik = root.find(".//Icerik")
            if icerik is not None:
                konu = icerik.find("Konu")
                data["konu"] = konu.text or "" if konu is not None else ""
                
                # Açıklamalar
                aciklama_maddeler = []
                for madde in icerik.findall(".//Aciklamalar/Madde"):
                    if madde.text:
                        aciklama_maddeler.append(madde.text)
                data["aciklamalar"] = "\n\n".join(aciklama_maddeler)
                
                # Talepler
                talep_maddeler = []
                for talep in icerik.findall(".//Talepler/Talep"):
                    if talep.text:
                        talep_maddeler.append(talep.text)
                data["talepler"] = "\n".join(talep_maddeler)
            
            # Dilekçe türü
            tur = root.find(".//Dilekce/TurAdi")
            if tur is not None:
                data["dilekce_turu"] = tur.text or ""
            
            # Ekler
            for ek in root.findall(".//Ekler/Ek/Ad"):
                if ek.text:
                    data["ekler"].append(ek.text)
            
            return data
            
        except Exception as e:
            print(f"UDF parse error: {e}")
            return {}


# Singleton instance
udf_generator = UDFGenerator()
