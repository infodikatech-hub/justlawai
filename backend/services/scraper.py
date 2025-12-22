"""
Mevzuat Scraper
mevzuat.gov.tr'den Türk Hukuku mevzuatını çeker
"""
import httpx
from bs4 import BeautifulSoup
from typing import List, Dict, Optional
import json
import os
import time

class MevzuatScraper:
    """
    mevzuat.gov.tr sitesinden mevzuat verilerini çeker.
    """
    
    BASE_URL = "https://www.mevzuat.gov.tr"
    
    def __init__(self):
        self.client = httpx.Client(
            timeout=30.0,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }
        )
    
    def get_kanun_listesi(self, limit: int = 100) -> List[Dict]:
        """
        Kanun listesini çeker.
        """
        kanunlar = []
        # TODO: mevzuat.gov.tr API veya scraping implementasyonu
        return kanunlar
    
    def get_kanun_detay(self, mevzuat_no: str) -> Optional[Dict]:
        """
        Belirli bir kanunun detaylarını çeker.
        """
        try:
            url = f"{self.BASE_URL}/mevzuat?MevzuatNo={mevzuat_no}"
            response = self.client.get(url)
            
            if response.status_code != 200:
                return None
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Kanun başlığı
            baslik = soup.find('h1')
            baslik_text = baslik.get_text(strip=True) if baslik else ""
            
            # Maddeler
            maddeler = []
            madde_elements = soup.find_all('div', class_='madde')
            
            for madde in madde_elements:
                madde_no = madde.find('span', class_='madde-no')
                madde_icerik = madde.find('div', class_='madde-icerik')
                
                if madde_icerik:
                    maddeler.append({
                        "madde_no": madde_no.get_text(strip=True) if madde_no else "",
                        "icerik": madde_icerik.get_text(strip=True)
                    })
            
            return {
                "mevzuat_no": mevzuat_no,
                "baslik": baslik_text,
                "maddeler": maddeler,
                "url": url
            }
            
        except Exception as e:
            print(f"Hata: {e}")
            return None
    
    def chunk_kanun(self, kanun: Dict, chunk_size: int = 1000) -> List[Dict]:
        """
        Kanunu chunk'lara böler (RAG için).
        Her madde ayrı bir chunk olarak değerlendirilir.
        """
        chunks = []
        
        for madde in kanun.get("maddeler", []):
            chunk = {
                "content": f"{kanun['baslik']}\n\n{madde['madde_no']}\n{madde['icerik']}",
                "metadata": {
                    "source": "mevzuat.gov.tr",
                    "mevzuat_no": kanun["mevzuat_no"],
                    "baslik": kanun["baslik"],
                    "madde_no": madde["madde_no"],
                    "type": "kanun"
                }
            }
            chunks.append(chunk)
        
        return chunks
    
    def close(self):
        self.client.close()


class YargitayScraper:
    """
    karararama.yargitay.gov.tr sitesinden emsal kararları çeker.
    """
    
    BASE_URL = "https://karararama.yargitay.gov.tr"
    
    def __init__(self):
        self.client = httpx.AsyncClient(
            timeout=30.0,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }
        )
    
    async def search_kararlar(self, query: str, limit: int = 50) -> List[Dict]:
        """
        Yargıtay kararları arasında arama yapar.
        Önce ana sayfadan token/session bilgilerini alır, sonra arama yapar.
        """
        kararlar = []
        
        try:
            # 1. Ana sayfaya gidip hidden inputları (tokenları) al
            print("Yargıtay: Tokenlar alınıyor...")
            init_response = await self.client.get(self.BASE_URL)
            if init_response.status_code != 200:
                print(f"Yargıtay init failed: {init_response.status_code}")
                return kararlar

            init_soup = BeautifulSoup(init_response.text, 'html.parser')
            form_data = {}
            
            # Tüm inputları bul ve form_data'ya ekle
            for input_tag in init_soup.find_all('input'):
                if input_tag.get('name'):
                    form_data[input_tag['name']] = input_tag.get('value', '')
            
            # Arama parametresini ekle/güncelle
            form_data['aranan'] = query
            
            # 2. Arama isteği yap
            print(f"Yargıtay: '{query}' aranıyor...")
            search_url = f"{self.BASE_URL}/aramasonuc"
            
            # Referer header ekle (önemli olabilir)
            headers = {
                "Referer": self.BASE_URL,
                "Origin": self.BASE_URL
            }
            
            response = await self.client.post(search_url, data=form_data, headers=headers)
            
            if response.status_code != 200:
                print(f"Yargıtay search failed: {response.status_code}")
                return kararlar
            
            # DEBUG PRINT
            print(f"DEBUG RESPONSE: {response.text[:1000]}")
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Parse search results
            result_items = soup.find_all('div', class_='card')
            if not result_items:
                result_items = soup.find_all('tr')  # Alternative table format
            
            for item in result_items[:limit]:
                try:
                    # Extract decision info
                    title_elem = item.find(['h5', 'a', 'td'])
                    content_elem = item.find(['p', 'div'])
                    
                    if title_elem:
                        karar = {
                            'esas_no': '',
                            'karar_no': '',
                            'daire': '',
                            'tarih': '',
                            'ozet': '',
                            'content': ''
                        }
                        
                        # Try to extract text
                        title_text = title_elem.get_text(strip=True)
                        content_text = content_elem.get_text(strip=True) if content_elem else ''
                        
                        # Parse esas/karar no from title
                        import re
                        esas_match = re.search(r'E\.\s*(\d{4}/\d+)', title_text)
                        karar_match = re.search(r'K\.\s*(\d{4}/\d+)', title_text)
                        daire_match = re.search(r'(\d+)\.\s*(?:Hukuk|Ceza)\s*Dairesi', title_text)
                        tarih_match = re.search(r'(\d{2}\.\d{2}\.\d{4})', title_text)
                        
                        if esas_match:
                            karar['esas_no'] = esas_match.group(1)
                        if karar_match:
                            karar['karar_no'] = karar_match.group(1)
                        if daire_match:
                            karar['daire'] = f"{daire_match.group(1)}. Hukuk Dairesi"
                        if tarih_match:
                            karar['tarih'] = tarih_match.group(1)
                        
                        karar['ozet'] = content_text[:500] if content_text else title_text[:500]
                        karar['content'] = content_text or title_text
                        
                        if karar['ozet'] or karar['content']:
                            kararlar.append(karar)
                            
                except Exception as e:
                    print(f"Error parsing result: {e}")
                    continue
                    
        except Exception as e:
            print(f"Yargıtay search error: {e}")
        
        return kararlar

    def chunk_karar(self, karar: Dict) -> List[Dict]:
        """
        Yargıtay kararını chunk'lara böler.
        """
        chunks = []
        
        # Karar özeti chunk
        if karar.get("ozet"):
            chunks.append({
                "content": karar["ozet"],
                "metadata": {
                    "source": "yargitay.gov.tr",
                    "esas_no": karar.get("esas_no"),
                    "karar_no": karar.get("karar_no"),
                    "daire": karar.get("daire"),
                    "type": "yargitay_karar",
                    "section": "ozet"
                }
            })
        
        # Karar gerekçesi chunk
        if karar.get("gerekce"):
            chunks.append({
                "content": karar["gerekce"],
                "metadata": {
                    "source": "yargitay.gov.tr",
                    "esas_no": karar.get("esas_no"),
                    "karar_no": karar.get("karar_no"),
                    "daire": karar.get("daire"),
                    "type": "yargitay_karar",
                    "section": "gerekce"
                }
            })
        
        return chunks
    
    async def close(self):
        await self.client.aclose()


class DanistayScraper:
    """
    Danıştay Başkanlığı karar arama
    https://www.danistay.gov.tr
    """
    
    BASE_URL = "https://karararama.danistay.gov.tr"
    
    def __init__(self):
        self.client = httpx.AsyncClient(
            timeout=30.0,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }
        )
    
    async def search_kararlar(self, query: str, limit: int = 20) -> List[Dict]:
        """Danıştay kararları arasında arama yapar."""
        kararlar = []
        
        try:
            # Danıştay karar arama
            search_url = f"{self.BASE_URL}/aramasonuc"
            
            form_data = {
                "aranan": query,
                "aramaTipi": "1"
            }
            
            response = await self.client.post(search_url, data=form_data)
            
            if response.status_code == 200:
                soup = BeautifulSoup(response.text, 'html.parser')
                
                result_items = soup.find_all('div', class_='card')
                if not result_items:
                    result_items = soup.find_all('tr')
                
                for item in result_items[:limit]:
                    try:
                        title_elem = item.find(['h5', 'a', 'td'])
                        content_elem = item.find(['p', 'div'])
                        
                        if title_elem:
                            title_text = title_elem.get_text(strip=True)
                            content_text = content_elem.get_text(strip=True) if content_elem else ''
                            
                            import re
                            esas_match = re.search(r'E\.\s*(\d{4}/\d+)', title_text)
                            karar_match = re.search(r'K\.\s*(\d{4}/\d+)', title_text)
                            
                            karar = {
                                'esas_no': esas_match.group(1) if esas_match else '',
                                'karar_no': karar_match.group(1) if karar_match else '',
                                'daire': 'Danıştay',
                                'tarih': '',
                                'ozet': content_text[:500] if content_text else title_text[:500],
                                'content': content_text or title_text,
                                'source': 'danistay'
                            }
                            
                            if karar['ozet']:
                                kararlar.append(karar)
                                
                    except Exception as e:
                        print(f"Danıştay parse error: {e}")
                        continue
                        
        except Exception as e:
            print(f"Danıştay search error: {e}")
        
        return kararlar
    
    async def close(self):
        await self.client.aclose()


class AnayasaMahkemesiScraper:
    """
    Anayasa Mahkemesi karar arama
    https://normkararlarbilgibankasi.anayasa.gov.tr
    """
    
    BASE_URL = "https://normkararlarbilgibankasi.anayasa.gov.tr"
    
    def __init__(self):
        self.client = httpx.AsyncClient(
            timeout=30.0,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }
        )
    
    async def search_kararlar(self, query: str, limit: int = 20) -> List[Dict]:
        """Anayasa Mahkemesi kararları arasında arama yapar."""
        kararlar = []
        
        try:
            # AYM norm denetimi kararları
            search_url = f"{self.BASE_URL}/Arama"
            
            params = {
                "aranan": query,
                "sayfa": 1
            }
            
            response = await self.client.get(search_url, params=params)
            
            if response.status_code == 200:
                soup = BeautifulSoup(response.text, 'html.parser')
                
                result_items = soup.find_all(['tr', 'div'], class_=['karar-satir', 'card'])
                
                for item in result_items[:limit]:
                    try:
                        title_elem = item.find(['a', 'td', 'h5'])
                        if title_elem:
                            title_text = title_elem.get_text(strip=True)
                            
                            import re
                            esas_match = re.search(r'E\.\s*(\d{4}/\d+)', title_text)
                            karar_match = re.search(r'K\.\s*(\d{4}/\d+)', title_text)
                            
                            karar = {
                                'esas_no': esas_match.group(1) if esas_match else '',
                                'karar_no': karar_match.group(1) if karar_match else '',
                                'daire': 'Anayasa Mahkemesi',
                                'tarih': '',
                                'ozet': title_text[:500],
                                'content': title_text,
                                'source': 'anayasa'
                            }
                            
                            if karar['ozet']:
                                kararlar.append(karar)
                                
                    except Exception as e:
                        print(f"AYM parse error: {e}")
                        continue
                        
        except Exception as e:
            print(f"AYM search error: {e}")
        
        return kararlar
    
    async def close(self):
        await self.client.aclose()


class RekabetKurumuScraper:
    """
    Rekabet Kurumu karar arama
    https://www.rekabet.gov.tr
    """
    
    BASE_URL = "https://www.rekabet.gov.tr"
    
    def __init__(self):
        self.client = httpx.AsyncClient(
            timeout=30.0,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }
        )
    
    async def search_kararlar(self, query: str, limit: int = 20) -> List[Dict]:
        """Rekabet Kurumu kararları arasında arama yapar."""
        kararlar = []
        
        try:
            # Rekabet Kurumu karar arama
            search_url = f"{self.BASE_URL}/tr/KararArama"
            
            params = {
                "SearchText": query
            }
            
            response = await self.client.get(search_url, params=params)
            
            if response.status_code == 200:
                soup = BeautifulSoup(response.text, 'html.parser')
                
                result_items = soup.find_all(['tr', 'div'], class_=['karar-item', 'list-item'])
                
                for item in result_items[:limit]:
                    try:
                        title_elem = item.find(['a', 'td', 'h5'])
                        if title_elem:
                            title_text = title_elem.get_text(strip=True)
                            
                            karar = {
                                'esas_no': '',
                                'karar_no': '',
                                'daire': 'Rekabet Kurumu',
                                'tarih': '',
                                'ozet': title_text[:500],
                                'content': title_text,
                                'source': 'rekabet'
                            }
                            
                            if karar['ozet']:
                                kararlar.append(karar)
                                
                    except Exception as e:
                        print(f"Rekabet parse error: {e}")
                        continue
                        
        except Exception as e:
            print(f"Rekabet search error: {e}")
        
        return kararlar
    
    async def close(self):
        await self.client.aclose()
