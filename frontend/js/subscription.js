/**
 * JustLaw Subscription Service
 * Premium abonelik ve deneme süresi yönetimi
 */

import { db } from './firebase-config.js';
import {
    doc,
    getDoc,
    updateDoc,
    Timestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Plan tanımları
export const PLANS = {
    trial: {
        name: 'Deneme',
        questionsPerDay: 5,
        dilekcePerMonth: 1,
        sozlesmePerMonth: 2,
        emsalSearch: true
    },
    professional: {
        name: 'Profesyonel',
        questionsPerDay: Infinity,
        dilekcePerMonth: 20,
        sozlesmePerMonth: 10,
        emsalSearch: true,
        price: 1200
    },
    enterprise: {
        name: 'Kurumsal',
        questionsPerDay: Infinity,
        dilekcePerMonth: Infinity,
        sozlesmePerMonth: Infinity,
        emsalSearch: true,
        apiAccess: true,
        price: 2000
    }
};

/**
 * Kullanıcının aktif planını kontrol et
 */
export async function getUserPlan(userId) {
    try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (!userDoc.exists()) {
            return { plan: 'none', isActive: false };
        }

        const userData = userDoc.data();
        const now = new Date();

        // Premium kontrol
        if (userData.premiumEndDate) {
            const premiumEnd = userData.premiumEndDate.toDate();
            if (premiumEnd > now) {
                return {
                    plan: userData.plan,
                    isActive: true,
                    endDate: premiumEnd,
                    daysLeft: Math.ceil((premiumEnd - now) / (1000 * 60 * 60 * 24))
                };
            }
        }

        // Trial kontrol
        if (userData.plan === 'trial' && userData.trialEndDate) {
            const trialEnd = userData.trialEndDate.toDate();
            if (trialEnd > now) {
                return {
                    plan: 'trial',
                    isActive: true,
                    endDate: trialEnd,
                    daysLeft: Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24))
                };
            } else {
                return {
                    plan: 'expired',
                    isActive: false,
                    message: 'Deneme süreniz doldu'
                };
            }
        }

        return { plan: 'none', isActive: false };
    } catch (error) {
        console.error('[Subscription] Error getting user plan:', error);
        return { plan: 'error', isActive: false };
    }
}

/**
 * Kullanım limiti kontrolü
 */
export async function checkUsageLimit(userId, limitType) {
    try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (!userDoc.exists()) {
            return { allowed: false, message: 'Kullanıcı bulunamadı' };
        }

        const userData = userDoc.data();
        const plan = PLANS[userData.plan] || PLANS.trial;
        const limits = userData.usageLimits || {};
        const now = new Date();

        // Günlük sıfırlama kontrolü (soru limiti için)
        if (limitType === 'question') {
            const lastReset = limits.questionsLastReset?.toDate() || new Date(0);
            const isNewDay = now.toDateString() !== lastReset.toDateString();

            if (isNewDay) {
                // Yeni gün, limiti sıfırla
                await updateDoc(doc(db, 'users', userId), {
                    'usageLimits.questionsToday': 0,
                    'usageLimits.questionsLastReset': Timestamp.fromDate(now)
                });
                limits.questionsToday = 0;
            }

            if (limits.questionsToday >= plan.questionsPerDay) {
                return {
                    allowed: false,
                    message: `Günlük soru limitinize (${plan.questionsPerDay}) ulaştınız.`,
                    limit: plan.questionsPerDay,
                    used: limits.questionsToday
                };
            }
        }

        // Aylık sıfırlama kontrolü (dilekçe ve sözleşme için)
        if (limitType === 'dilekce' || limitType === 'sozlesme') {
            const monthlyReset = limits.monthlyResetDate?.toDate() || new Date(0);
            const isNewMonth = now.getMonth() !== monthlyReset.getMonth() ||
                now.getFullYear() !== monthlyReset.getFullYear();

            if (isNewMonth) {
                await updateDoc(doc(db, 'users', userId), {
                    'usageLimits.dilekceThisMonth': 0,
                    'usageLimits.sozlesmeThisMonth': 0,
                    'usageLimits.monthlyResetDate': Timestamp.fromDate(now)
                });
                limits.dilekceThisMonth = 0;
                limits.sozlesmeThisMonth = 0;
            }

            if (limitType === 'dilekce') {
                if (limits.dilekceThisMonth >= plan.dilekcePerMonth) {
                    return {
                        allowed: false,
                        message: `Aylık dilekçe limitinize (${plan.dilekcePerMonth}) ulaştınız.`,
                        limit: plan.dilekcePerMonth,
                        used: limits.dilekceThisMonth
                    };
                }
            }

            if (limitType === 'sozlesme') {
                if (limits.sozlesmeThisMonth >= plan.sozlesmePerMonth) {
                    return {
                        allowed: false,
                        message: `Aylık sözleşme analizi limitinize (${plan.sozlesmePerMonth}) ulaştınız.`,
                        limit: plan.sozlesmePerMonth,
                        used: limits.sozlesmeThisMonth
                    };
                }
            }
        }

        return { allowed: true };
    } catch (error) {
        console.error('[Subscription] Error checking usage limit:', error);
        return { allowed: true }; // Hata durumunda izin ver
    }
}

/**
 * Kullanımı artır
 */
export async function incrementUsage(userId, usageType) {
    try {
        const fieldMap = {
            'question': 'usageLimits.questionsToday',
            'dilekce': 'usageLimits.dilekceThisMonth',
            'sozlesme': 'usageLimits.sozlesmeThisMonth'
        };

        const field = fieldMap[usageType];
        if (!field) return;

        const userDoc = await getDoc(doc(db, 'users', userId));
        if (!userDoc.exists()) return;

        const currentValue = userDoc.data().usageLimits?.[field.split('.')[1]] || 0;

        await updateDoc(doc(db, 'users', userId), {
            [field]: currentValue + 1
        });

        console.log(`[Subscription] Incremented ${usageType} usage for user ${userId}`);
    } catch (error) {
        console.error('[Subscription] Error incrementing usage:', error);
    }
}

/**
 * Plan durumu özeti
 */
export function getPlanSummary(planInfo, userData) {
    if (!planInfo.isActive) {
        return {
            status: 'expired',
            title: 'Plan Süresi Doldu',
            description: 'Premium\'a yükselterek tüm özelliklere sınırsız erişin.',
            badge: '⚠️ Süresi Doldu',
            badgeClass: 'expired'
        };
    }

    if (planInfo.plan === 'trial') {
        return {
            status: 'trial',
            title: 'Deneme Sürümü',
            description: `${planInfo.daysLeft} gün kaldı`,
            badge: '🎁 Deneme',
            badgeClass: 'trial'
        };
    }

    if (planInfo.plan === 'professional') {
        return {
            status: 'premium',
            title: 'Profesyonel Plan',
            description: `${planInfo.daysLeft} gün kaldı`,
            badge: '💎 Premium',
            badgeClass: 'premium'
        };
    }

    if (planInfo.plan === 'enterprise') {
        return {
            status: 'enterprise',
            title: 'Kurumsal Plan',
            description: `${planInfo.daysLeft} gün kaldı`,
            badge: '🏢 Kurumsal',
            badgeClass: 'enterprise'
        };
    }

    return {
        status: 'unknown',
        title: 'Plan Bilgisi',
        description: 'Plan bilgisi alınamadı',
        badge: '❓',
        badgeClass: ''
    };
}
