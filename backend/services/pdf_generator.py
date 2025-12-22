"""
JustLaw PDF Generator Service
Dilekçe ve hukuki doküman PDF oluşturma
"""
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from io import BytesIO
from datetime import datetime
import os

class PDFGenerator:
    """PDF doküman oluşturucu"""
    
    def __init__(self):
        # Register Turkish-compatible font
        self.font_name = 'Helvetica'
        self.font_name_bold = 'Helvetica-Bold'
        
        try:
            # Try to register DejaVuSans which supports Turkish characters
            import os
            font_paths = [
                # Windows
                'C:/Windows/Fonts/DejaVuSans.ttf',
                'C:/Windows/Fonts/arial.ttf',
                'C:/Windows/Fonts/tahoma.ttf',
                # Linux
                '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
                # Mac
                '/Library/Fonts/Arial.ttf',
            ]
            
            font_registered = False
            for font_path in font_paths:
                if os.path.exists(font_path):
                    try:
                        pdfmetrics.registerFont(TTFont('TurkishFont', font_path))
                        self.font_name = 'TurkishFont'
                        
                        # Try to find bold version
                        bold_path = font_path.replace('.ttf', 'bd.ttf').replace('Sans.ttf', 'Sans-Bold.ttf')
                        if os.path.exists(bold_path):
                            pdfmetrics.registerFont(TTFont('TurkishFontBold', bold_path))
                            self.font_name_bold = 'TurkishFontBold'
                        else:
                            self.font_name_bold = 'TurkishFont'
                        
                        font_registered = True
                        print(f"PDF font registered: {font_path}")
                        break
                    except Exception as e:
                        print(f"Could not register font {font_path}: {e}")
                        continue
            
            if not font_registered:
                print("Warning: No Turkish font found, using Helvetica (Turkish chars may not display)")
                
        except Exception as e:
            print(f"Font registration error: {e}")
        
        self.styles = getSampleStyleSheet()
        # Custom styles with Turkish font
        self.styles.add(ParagraphStyle(
            name='TurkishTitle',
            fontSize=16,
            leading=20,
            alignment=1,  # Center
            spaceAfter=20,
            fontName=self.font_name_bold
        ))
        self.styles.add(ParagraphStyle(
            name='TurkishBody',
            fontSize=12,
            leading=16,
            alignment=4,  # Justify
            spaceAfter=12,
            fontName=self.font_name
        ))
        self.styles.add(ParagraphStyle(
            name='TurkishRight',
            fontSize=12,
            leading=16,
            alignment=2,  # Right
            spaceAfter=12,
            fontName=self.font_name
        ))
    
    def create_dilekce(self, dilekce_data: dict) -> bytes:
        """
        Dilekçe PDF'i oluşturur.
        
        Args:
            dilekce_data: {
                'mahkeme': str,
                'davaci_adi': str,
                'davaci_tc': str,
                'davaci_adres': str,
                'davali_adi': str,
                'davali_adres': str,
                'konu': str,
                'aciklamalar': str,
                'talepler': str,
                'tarih': str (optional),
                'dilekce_turu': str
            }
        """
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=2*cm,
            leftMargin=2*cm,
            topMargin=2*cm,
            bottomMargin=2*cm
        )
        
        story = []
        
        # Başlık - Mahkeme
        mahkeme = dilekce_data.get('mahkeme', '... MAHKEMESİ HAKİMLİĞİNE')
        story.append(Paragraph(mahkeme.upper(), self.styles['TurkishTitle']))
        story.append(Spacer(1, 20))
        
        # Taraflar tablosu
        davaci_bilgi = f"""
        <b>DAVACI:</b> {dilekce_data.get('davaci_adi', '...')}<br/>
        <b>TC:</b> {dilekce_data.get('davaci_tc', '...')}<br/>
        <b>ADRES:</b> {dilekce_data.get('davaci_adres', '...')}
        """
        
        davali_bilgi = f"""
        <b>DAVALI:</b> {dilekce_data.get('davali_adi', '...')}<br/>
        <b>ADRES:</b> {dilekce_data.get('davali_adres', '...')}
        """
        
        story.append(Paragraph(davaci_bilgi, self.styles['TurkishBody']))
        story.append(Spacer(1, 10))
        story.append(Paragraph(davali_bilgi, self.styles['TurkishBody']))
        story.append(Spacer(1, 20))
        
        # Konu
        konu = dilekce_data.get('konu', 'Dava Konusu')
        story.append(Paragraph(f"<b>KONU:</b> {konu}", self.styles['TurkishBody']))
        story.append(Spacer(1, 20))
        
        # Açıklamalar
        story.append(Paragraph("<b>AÇIKLAMALAR:</b>", self.styles['TurkishBody']))
        story.append(Spacer(1, 10))
        
        aciklamalar = dilekce_data.get('aciklamalar', '')
        # Paragrafları ayır
        for i, para in enumerate(aciklamalar.split('\n\n'), 1):
            if para.strip():
                story.append(Paragraph(f"{i}. {para.strip()}", self.styles['TurkishBody']))
        
        story.append(Spacer(1, 20))
        
        # Talepler
        story.append(Paragraph("<b>SONUÇ VE TALEP:</b>", self.styles['TurkishBody']))
        story.append(Spacer(1, 10))
        
        talepler = dilekce_data.get('talepler', '')
        story.append(Paragraph(talepler, self.styles['TurkishBody']))
        story.append(Spacer(1, 30))
        
        # Tarih ve İmza
        tarih = dilekce_data.get('tarih', datetime.now().strftime('%d/%m/%Y'))
        story.append(Paragraph(f"Tarih: {tarih}", self.styles['TurkishRight']))
        story.append(Spacer(1, 10))
        story.append(Paragraph(f"Davacı: {dilekce_data.get('davaci_adi', '...')}", self.styles['TurkishRight']))
        story.append(Paragraph("İmza", self.styles['TurkishRight']))
        
        # PDF oluştur
        doc.build(story)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        
        return pdf_bytes
    
    def create_sozlesme(self, sozlesme_data: dict) -> bytes:
        """
        Sözleşme taslağı PDF'i oluşturur.
        """
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=2*cm,
            leftMargin=2*cm,
            topMargin=2*cm,
            bottomMargin=2*cm
        )
        
        story = []
        
        # Başlık
        baslik = sozlesme_data.get('baslik', 'SÖZLEŞME')
        story.append(Paragraph(baslik.upper(), self.styles['TurkishTitle']))
        story.append(Spacer(1, 20))
        
        # Taraflar
        story.append(Paragraph("<b>TARAFLAR:</b>", self.styles['TurkishBody']))
        story.append(Spacer(1, 10))
        
        taraf1 = sozlesme_data.get('taraf1', {})
        taraf2 = sozlesme_data.get('taraf2', {})
        
        story.append(Paragraph(
            f"<b>1. TARAF:</b> {taraf1.get('adi', '...')} ({taraf1.get('unvan', 'Taraf 1')})<br/>"
            f"<b>ADRES:</b> {taraf1.get('adres', '...')}", 
            self.styles['TurkishBody']
        ))
        story.append(Spacer(1, 10))
        
        story.append(Paragraph(
            f"<b>2. TARAF:</b> {taraf2.get('adi', '...')} ({taraf2.get('unvan', 'Taraf 2')})<br/>"
            f"<b>ADRES:</b> {taraf2.get('adres', '...')}", 
            self.styles['TurkishBody']
        ))
        story.append(Spacer(1, 20))
        
        # Maddeler
        maddeler = sozlesme_data.get('maddeler', [])
        for i, madde in enumerate(maddeler, 1):
            story.append(Paragraph(
                f"<b>MADDE {i} - {madde.get('baslik', '')}:</b><br/>{madde.get('icerik', '')}", 
                self.styles['TurkishBody']
            ))
            story.append(Spacer(1, 10))
        
        story.append(Spacer(1, 30))
        
        # İmza Alanları
        tarih = sozlesme_data.get('tarih', datetime.now().strftime('%d/%m/%Y'))
        story.append(Paragraph(f"<b>Tarih:</b> {tarih}", self.styles['TurkishBody']))
        story.append(Spacer(1, 20))
        
        # İmza tablosu
        imza_data = [
            ['1. TARAF', '2. TARAF'],
            [taraf1.get('adi', '...'), taraf2.get('adi', '...')],
            ['İmza:', 'İmza:'],
            ['', '']
        ]
        
        imza_table = Table(imza_data, colWidths=[8*cm, 8*cm])
        imza_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 11),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
            ('TOPPADDING', (0, 0), (-1, -1), 12),
        ]))
        story.append(imza_table)
        
        doc.build(story)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        
        return pdf_bytes


# Singleton instance
pdf_generator = PDFGenerator()
