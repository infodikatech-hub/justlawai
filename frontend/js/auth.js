/**
 * JustLaw Authentication Service
 * Firebase Authentication işlemleri
 */

import { auth, db } from './firebase-config.js';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail,
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup,
    updateProfile
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
    doc,
    setDoc,
    getDoc,
    updateDoc,
    serverTimestamp,
    Timestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Google Auth Provider
const googleProvider = new GoogleAuthProvider();

// ============== USER REGISTRATION ==============

/**
 * Yeni kullanıcı kaydı
 * @param {string} email 
 * @param {string} password 
 * @param {string} name 
 */
export async function registerUser(email, password, name) {
    try {
        // Firebase Auth ile kullanıcı oluştur
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Profil güncelle
        await updateProfile(user, { displayName: name });

        // Firestore'a kullanıcı belgesi oluştur
        const now = new Date();
        const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 gün sonra

        await setDoc(doc(db, 'users', user.uid), {
            email: email,
            name: name,
            createdAt: serverTimestamp(),
            plan: 'trial',
            trialStartDate: Timestamp.fromDate(now),
            trialEndDate: Timestamp.fromDate(trialEnd),
            premiumEndDate: null,
            usageLimits: {
                questionsToday: 0,
                questionsLastReset: Timestamp.fromDate(now),
                dilekceThisMonth: 0,
                sozlesmeThisMonth: 0,
                monthlyResetDate: Timestamp.fromDate(now)
            }
        });

        console.log('[Auth] User registered:', user.uid);
        return { success: true, user };
    } catch (error) {
        console.error('[Auth] Registration error:', error);
        return { success: false, error: getErrorMessage(error.code) };
    }
}

// ============== USER LOGIN ==============

/**
 * E-posta ile giriş
 */
export async function loginUser(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        console.log('[Auth] User logged in:', userCredential.user.uid);
        return { success: true, user: userCredential.user };
    } catch (error) {
        console.error('[Auth] Login error:', error);
        return { success: false, error: getErrorMessage(error.code) };
    }
}

/**
 * Google ile giriş
 */
export async function loginWithGoogle() {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;

        // Kullanıcı daha önce kayıt olmamışsa Firestore'a ekle
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) {
            const now = new Date();
            const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

            await setDoc(doc(db, 'users', user.uid), {
                email: user.email,
                name: user.displayName || 'Kullanıcı',
                createdAt: serverTimestamp(),
                plan: 'trial',
                trialStartDate: Timestamp.fromDate(now),
                trialEndDate: Timestamp.fromDate(trialEnd),
                premiumEndDate: null,
                usageLimits: {
                    questionsToday: 0,
                    questionsLastReset: Timestamp.fromDate(now),
                    dilekceThisMonth: 0,
                    sozlesmeThisMonth: 0,
                    monthlyResetDate: Timestamp.fromDate(now)
                }
            });
        }

        console.log('[Auth] Google login successful:', user.uid);
        return { success: true, user };
    } catch (error) {
        console.error('[Auth] Google login error:', error);
        return { success: false, error: getErrorMessage(error.code) };
    }
}

// ============== LOGOUT ==============

/**
 * Çıkış yap
 */
export async function logoutUser() {
    try {
        await signOut(auth);
        console.log('[Auth] User logged out');
        return { success: true };
    } catch (error) {
        console.error('[Auth] Logout error:', error);
        return { success: false, error: error.message };
    }
}

// ============== PASSWORD RESET ==============

/**
 * Şifre sıfırlama e-postası gönder
 */
export async function resetPassword(email) {
    try {
        await sendPasswordResetEmail(auth, email);
        console.log('[Auth] Password reset email sent');
        return { success: true };
    } catch (error) {
        console.error('[Auth] Password reset error:', error);
        return { success: false, error: getErrorMessage(error.code) };
    }
}

// ============== AUTH STATE ==============

/**
 * Auth durumu değişikliklerini dinle
 */
export function onAuthChange(callback) {
    return onAuthStateChanged(auth, callback);
}

/**
 * Mevcut kullanıcıyı al
 */
export function getCurrentUser() {
    return auth.currentUser;
}

/**
 * Kullanıcı verilerini Firestore'dan al
 */
export async function getUserData(userId) {
    try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
            return userDoc.data();
        }
        return null;
    } catch (error) {
        console.error('[Auth] Get user data error:', error);
        return null;
    }
}

// ============== ERROR MESSAGES ==============

function getErrorMessage(errorCode) {
    const messages = {
        'auth/email-already-in-use': 'Bu e-posta adresi zaten kullanılıyor.',
        'auth/invalid-email': 'Geçersiz e-posta adresi.',
        'auth/operation-not-allowed': 'Bu giriş yöntemi etkin değil.',
        'auth/weak-password': 'Şifre en az 6 karakter olmalıdır.',
        'auth/user-disabled': 'Bu hesap devre dışı bırakılmış.',
        'auth/user-not-found': 'Bu e-posta ile kayıtlı kullanıcı bulunamadı.',
        'auth/wrong-password': 'Hatalı şifre.',
        'auth/invalid-credential': 'E-posta veya şifre hatalı.',
        'auth/too-many-requests': 'Çok fazla deneme yaptınız. Lütfen biraz bekleyin.',
        'auth/popup-closed-by-user': 'Giriş penceresi kapatıldı.',
        'auth/network-request-failed': 'Ağ hatası. İnternet bağlantınızı kontrol edin.'
    };
    return messages[errorCode] || 'Bir hata oluştu. Lütfen tekrar deneyin.';
}

// Export auth object for direct access if needed
export { auth };
