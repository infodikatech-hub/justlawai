/**
 * JustLaw Payment Service
 * Shopier entegrasyonu ve ödeme işlemleri
 */

import { auth } from './auth.js';

export async function startPayment(planType) {
    const user = auth.currentUser;

    if (!user) {
        alert('Ödeme yapabilmek için lütfen giriş yapın veya kayıt olun.');
        return;
    }

    try {
        const btn = document.querySelector(`.plan-btn.${planType === 'professional' ? 'pro' : 'enterprise'}`);
        const originalText = btn ? btn.innerHTML : 'Satın Al';

        if (btn) {
            btn.innerHTML = 'İşleminiz Başlıyor...';
            btn.disabled = true;
        }

        // 1. Open Popup IMMEDIATELY (Before Fetch) to bypass Blocker
        const paymentWindow = window.open('', '_blank');
        if (!paymentWindow) {
            alert('Pop-up engelleyiciniz ödeme sayfasını engellemiş olabilir. Lütfen izin verin ve tekrar deneyin.');
            if (btn) { btn.innerHTML = originalText; btn.disabled = false; }
            return;
        }

        // Write generic loading message
        paymentWindow.document.write(`
            <html><head><title>Bağlanıyor...</title></head>
            <body style="font-family:sans-serif; text-align:center; padding:50px;">
                <h3>Shopier Güvenli Ödeme Sistemine Bağlanılıyor...</h3>
                <p>Lütfen bekleyiniz, pencereyi kapatmayınız.</p>
            </body></html>
        `);

        const apiUrl = (window.API_BASE_URL || '') + '/api/payment/create';
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user_id: user.uid,
                plan_type: planType
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Sunucu Hatası (${response.status}): ${errorText}`);
        }

        const data = await response.json();

        if (data.payment_url) {
            // Redirect mode (if used)
            paymentWindow.location.href = data.payment_url;

        } else if (data.mode === 'html_content' && data.payment_html) {
            // Write real form and submit
            paymentWindow.document.open();
            paymentWindow.document.write(data.payment_html);
            paymentWindow.document.close();

        } else {
            // Error case
            paymentWindow.document.body.innerHTML = "<h3>Hata Oluştu</h3><p>Ödeme başlatılamadı.</p>";
            alert('Sunucu Hatası veya Yanıt Yok.');
            if (btn) {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        }


    } catch (error) {
        console.error('Payment error:', error);
        alert('Ödeme sistemi hatası: ' + error.message);

        const btn = document.querySelector(`.plan-btn.${planType === 'professional' ? 'pro' : 'enterprise'}`);
        if (btn) {
            btn.innerHTML = 'Satın Al';
            btn.disabled = false;
        }
    }
}

// Expose to window
window.startPayment = startPayment;
