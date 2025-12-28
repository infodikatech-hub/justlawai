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

        // Manuel Shopier Linkleri
        const manualLinks = {
            'professional': 'https://www.shopier.com/justlawai/42631944',
            'enterprise': 'https://www.shopier.com/justlawai/42631931'
        };

        const targetUrl = manualLinks[planType];

        if (!targetUrl) {
            alert('Geçersiz plan seçimi.');
            return;
        }

        // Doğrudan yeni sekmede aç (En hızlı ve sorunsuz yöntem)
        window.open(targetUrl, '_blank');

        if (btn) {
            btn.innerHTML = 'Ödeme Sayfası Açıldı';
            setTimeout(() => {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }, 3000);
        }

    } catch (error) {
        console.error('Payment error:', error);
        alert('Ödeme sayfası açılamadı: ' + error.message);
    }
}

// Expose to window
window.startPayment = startPayment;
