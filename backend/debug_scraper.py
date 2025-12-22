
import asyncio
from services.scraper import YargitayScraper

async def test_scraper():
    print("Scraper testi başlatılıyor...")
    scraper = YargitayScraper()
    query = "boşanma"
    try:
        print(f"'{query}' için arama yapılıyor...")
        results = await scraper.search_kararlar(query)
        print(f"Sonuç sayısı: {len(results)}")
        if results:
            print("İlk sonuç:")
            print(results[0])
        else:
            print("Sonuç bulunamadı.")
            # For debugging, we can't easily see internal variables of the class method without changing it.
            # But let's try to search for something very common like "karar"
            
        await scraper.close()
    except Exception as e:
        print(f"Scraper hatası: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_scraper())
