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
    updateProfile,
    deleteUser,
    sendEmailVerification
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
    doc,
    setDoc,
    getDoc,
    updateDoc,
    deleteDoc,
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
        // 1. Firebase Auth ile kullanıcı oluştur (Sadece Auth)
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 2. Profil güncelle
        try {
            await updateProfile(user, { displayName: name });
        } catch (e) {
            console.warn('[Auth] Profile update failed:', e);
        }

        // 3. E-posta doğrulama gönder
        try {
            await sendEmailVerification(user);
            console.log('[Auth] Verification email sent');
        } catch (emailError) {
            console.error('[Auth] Email Verification Error:', emailError);
            throw emailError;
        }

        console.log('[Auth] User auth created (Pending Verification):', user.uid);
        // requiresVerification: true -> Landing.js bunu görüp modal açacak
        return { success: true, user, requiresVerification: true };

    } catch (error) {
        console.error('[Auth] Registration error:', error);
        return { success: false, error: getErrorMessage(error.code) };
    }
}

/**
 * E-posta doğrulandıktan sonra Deneme Hesabını Başlat
 * (Firestore kaydını YENİ oluşturur, böylece 7 gün şimdi başlar)
 */
export async function activateTrialAccount() {
    const user = auth.currentUser;
    if (!user) return { success: false, error: 'Oturum bulunamadı.' };

    try {
        // Kullanıcıyı yenile (Doğrulama durumunu güncellemek için)
        await user.reload();

        if (!user.emailVerified) {
            return { success: false, error: 'E-posta henüz doğrulanmamış.' };
        }

        // Firestore kontrolü (Zaten var mı?)
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            console.log('[Auth] Account already active');
            return { success: true, user };
        }

        // Hesabı ŞİMDİ başlat (Trial Start = Now)
        const now = new Date();
        const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 gün

        await setDoc(docRef, {
            email: user.email,
            name: user.displayName || 'Kullanıcı',
            createdAt: serverTimestamp(),
            plan: 'free',
            trialStartDate: null,
            trialEndDate: null,
            premiumEndDate: null,
            usageLimits: null // Sınırsız
        });

        console.log('[Auth] Trial activated for:', user.uid);
        return { success: true, user };

    } catch (error) {
        console.error('[Auth] Activation error:', error);
        return { success: false, error: getErrorMessage(error.code) || error.message };
    }
}

/**
 * E-posta doğrulama durumunu kontrol et
 */
export async function checkEmailVerification() {
    const user = auth.currentUser;
    if (!user) return false;
    await user.reload();
    return user.emailVerified;
}

// ============== USER LOGIN ==============

/**
 * E-posta ile giriş
 */
export async function loginUser(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);

        // E-posta doğrulama kontrolü
        if (!userCredential.user.emailVerified) {
            await signOut(auth);
            return { success: false, error: 'Lütfen giriş yapmadan önce e-posta adresinizi doğrulayın.' };
        }

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
                plan: 'free',
                trialStartDate: null,
                trialEndDate: null,
                premiumEndDate: null,
                usageLimits: null // Sınırsız
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

// ============== ACCOUNT DELETION ==============

/**
 * Hesabı Sil
 */
export async function deleteAccount() {
    const user = auth.currentUser;
    if (!user) return { success: false, error: 'Kullanıcı oturumu açık değil.' };

    try {
        // 1. Firestore verisini sil
        await deleteDoc(doc(db, 'users', user.uid));

        // 2. Auth kullanıcısını sil
        await deleteUser(user);

        console.log('[Auth] Account deleted');
        return { success: true };
    } catch (error) {
        console.error('[Auth] Delete account error:', error);
        if (error.code === 'auth/requires-recent-login') {
            return { success: false, error: 'Hesap silmek için lütfen çıkış yapıp tekrar giriş yapın.' };
        }
        return { success: false, error: getErrorMessage(error.code) };
    }
}

// Expose to window for app.js access
window.deleteAccount = deleteAccount;

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


/**
 * Doğrulama e-postasını tekrar gönder
 */
export async function resendVerification() {
    const user = auth.currentUser;
    if (!user) return { success: false, error: 'Kullanıcı bulunamadı.' };

    try {
        await sendEmailVerification(user);
        return { success: true };
    } catch (error) {
        console.error('[Auth] Resend error:', error);
        return { success: false, error: error.message };
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


// Export auth object and helpers
export { auth };

// Expose internal helpers for advanced usage if needed
window.checkEmailVerification = checkEmailVerification;
window.activateTrialAccount = activateTrialAccount;
