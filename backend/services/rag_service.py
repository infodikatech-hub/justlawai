"""
DiKaTech RAG Service
Retrieval-Augmented Generation for Turkish Legal Documents
"""
import os
from typing import List, Optional
import chromadb
from chromadb.config import Settings
import google.generativeai as genai
from sentence_transformers import SentenceTransformer

class RAGService:
    """
    RAG (Retrieval-Augmented Generation) servisi.
    Türk Hukuku metinleri üzerinde semantik arama ve yanıt üretimi yapar.
    """
    
    def __init__(self):
        # Gemini API konfigürasyonu
        genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
        self.llm = genai.GenerativeModel('gemini-2.0-flash-exp')
        
        # Embedding modeli (Türkçe destekli)
        self.embedding_model = SentenceTransformer(
            'sentence-transformers/paraphrase-multilingual-mpnet-base-v2'
        )
        
        # ChromaDB client
        self.chroma_client = chromadb.PersistentClient(
            path=os.getenv("CHROMA_PERSIST_DIRECTORY", "./chroma_db")
        )
        
        # Collection'ları oluştur veya al
        self.mevzuat_collection = self.chroma_client.get_or_create_collection(
            name="mevzuat",
            metadata={"description": "Türk Mevzuatı"}
        )
        
        self.yargitay_collection = self.chroma_client.get_or_create_collection(
            name="yargitay",
            metadata={"description": "Yargıtay Kararları"}
        )
    
    def embed_text(self, text: str) -> List[float]:
        """Metni vektöre dönüştürür."""
        return self.embedding_model.encode(text).tolist()
    
    def search_mevzuat(self, query: str, n_results: int = 5) -> List[dict]:
        """
        Mevzuat üzerinde semantik arama yapar.
        """
        query_embedding = self.embed_text(query)
        
        results = self.mevzuat_collection.query(
            query_embeddings=[query_embedding],
            n_results=n_results,
            include=["documents", "metadatas", "distances"]
        )
        
        return self._format_search_results(results)
    
    def search_yargitay(self, query: str, n_results: int = 5) -> List[dict]:
        """
        Yargıtay kararları üzerinde semantik arama yapar.
        """
        query_embedding = self.embed_text(query)
        
        results = self.yargitay_collection.query(
            query_embeddings=[query_embedding],
            n_results=n_results,
            include=["documents", "metadatas", "distances"]
        )
        
        return self._format_search_results(results)
    
    def _format_search_results(self, results: dict) -> List[dict]:
        """Arama sonuçlarını formatlar."""
        formatted = []
        if results and results.get("documents"):
            for i, doc in enumerate(results["documents"][0]):
                formatted.append({
                    "content": doc,
                    "metadata": results["metadatas"][0][i] if results.get("metadatas") else {},
                    "distance": results["distances"][0][i] if results.get("distances") else None
                })
        return formatted
    
    async def generate_response(
        self, 
        question: str, 
        context: Optional[List[dict]] = None
    ) -> dict:
        """
        Kullanıcı sorusuna RAG tabanlı yanıt üretir.
        """
        # Eğer context verilmediyse, ara
        if context is None:
            mevzuat_results = self.search_mevzuat(question)
            yargitay_results = self.search_yargitay(question)
            context = mevzuat_results + yargitay_results
        
        # Context'i prompt'a ekle
        context_text = "\n\n".join([
            f"Kaynak: {c.get('metadata', {}).get('source', 'Bilinmiyor')}\n{c['content']}"
            for c in context[:5]  # En fazla 5 kaynak
        ])
        
        prompt = f"""Sen DiKaTech hukuki asistanısın. Görevin Türk Hukuku konusunda 
doğru ve güvenilir bilgi vermektir.

KURALLAR:
1. SADECE sağlanan kaynaklara dayanarak yanıt ver
2. Her ifadeyi ilgili kanun maddesi veya karar numarası ile destekle
3. Kaynaklarda bilgi yoksa "Bu konuda kesin bilgi bulamadım" de
4. Hukuki tavsiye değil, bilgi verdiğini belirt
5. Yanıtı kullanıcının anlayacağı sadelikte ver

KAYNAKLAR:
{context_text}

KULLANICI SORUSU: {question}

YANITINIZ:"""
        
        response = self.llm.generate_content(prompt)
        
        return {
            "response": response.text,
            "sources": [
                {
                    "content": c["content"][:200] + "...",
                    "metadata": c.get("metadata", {})
                }
                for c in context[:5]
            ]
        }
    
    def add_mevzuat(self, documents: List[dict]):
        """
        Mevzuat belgelerini veritabanına ekler.
        
        Args:
            documents: [{"content": str, "metadata": dict}, ...]
        """
        ids = [f"mevzuat_{i}" for i in range(len(documents))]
        contents = [doc["content"] for doc in documents]
        metadatas = [doc.get("metadata", {}) for doc in documents]
        embeddings = [self.embed_text(content) for content in contents]
        
        self.mevzuat_collection.add(
            ids=ids,
            documents=contents,
            metadatas=metadatas,
            embeddings=embeddings
        )
    
    def add_yargitay(self, documents: List[dict]):
        """
        Yargıtay kararlarını veritabanına ekler.
        """
        ids = [f"yargitay_{i}" for i in range(len(documents))]
        contents = [doc["content"] for doc in documents]
        metadatas = [doc.get("metadata", {}) for doc in documents]
        embeddings = [self.embed_text(content) for content in contents]
        
        self.yargitay_collection.add(
            ids=ids,
            documents=contents,
            metadatas=metadatas,
            embeddings=embeddings
        )


# Singleton instance
_rag_service: Optional[RAGService] = None

def get_rag_service() -> RAGService:
    """RAG servisinin singleton instance'ını döner."""
    global _rag_service
    if _rag_service is None:
        _rag_service = RAGService()
    return _rag_service
