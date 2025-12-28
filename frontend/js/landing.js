/**
 * JustLaw Landing Page JavaScript
 * Firebase Authentication Entegrasyonu
 */


// Force global assignment
const global = window;
global.toggleTheme = toggleTheme;
global.showModal = showModal;
global.closeModal = closeModal;
global.switchModal = switchModal;
global.scrollToSection = scrollToSection;
global.handleLogin = handleLogin;
global.handleRegister = handleRegister;
global.checkVerificationStatus = checkVerificationStatus;
global.resendVerificationEmail = resendVerificationEmail;
global.cancelVerification = cancelVerification;
global.handleGoogleLogin = handleGoogleLogin;
global.handleForgotPassword = handleForgotPassword;
global.installPWA = installPWA;
global.closeInstallModal = closeInstallModal;
global.toggleMobileMenu = function () { /* Will be overwritten on load */ };

// Firebase Auth imports - will be loaded after page load
let authModule = null;

// Load auth module dynamically
async function loadAuthModule() {
    try {
        // Try importing relative to document root (typical for classic scripts)
        try {
            authModule = await import('./js/auth.js');
        } catch (e) {
            console.log('Retrying import with relative path...');
            // Fallback for module-like behavior or different server config
            authModule = await import('./auth.js');
        }

        console.log('[Landing] Auth module loaded');

        // Check if user is already logged in
        authModule.onAuthChange((user) => {
            if (user) {
                // Eğer doğrulanmamışsa ve verification modalı açık DEĞİLSE, işlem yapma (kullanıcı modalda bekliyor olabilir)
                // Ancak kullanıcı sayfayı yenileyip geldiyse ve doğrulanmamışsa, onu direkt app.html'e almamalıyız.
                if (user.emailVerified) {
                    console.log('[Landing] User logged in & verified:', user.email);
                    window.location.href = 'app.html';
                } else {
                    console.log('[Landing] User logged in but NOT verified.');
                    // FALLBACK: Eğer kullanıcı giriş yapmış ama doğrulanmamışsa, modalı ZORLA aç.
                    // Bu, hesabı oluşturup sayfayı yenileyenler veya "ghost" durumdakiler için.
                    setTimeout(() => {
                        const verModal = document.getElementById('verification-modal');
                        // Eğer zaten açık değilse
                        if (verModal && !verModal.classList.contains('active')) {
                            // Önce diğerlerini kapat
                            closeModal('login');
                            closeModal('register');
                            // Email'i güncelle
                            const emailDisplay = document.getElementById('verification-email-display');
                            if (emailDisplay && user.email) emailDisplay.textContent = user.email;

                            showModal('verification');
                        }
                    }, 500); // Sayfa yükleme animasyonlarından sonra çalışsın
                }
            }
        });
    } catch (error) {
        console.error('[Landing] Failed to load auth module:', error);
        alert('Sistem Hatası: Modül yüklenemedi. Detay: ' + error.message);
    }
}

// Check for file protocol
if (window.location.protocol === 'file:') {
    console.warn('⚠️ JustLaw: file:// protokolünden çalıştırıyorsunuz. Modüller çalışmayabilir.');
    alert('⚠️ Uyarı: Uygulamayı dosya olarak açtınız. Kayıt/Giriş özelliklerinin çalışması için lütfen "python main.py" ile sunucuyu başlatıp "http://localhost:8000" adresine gidin.');
}

document.addEventListener('DOMContentLoaded', () => {
    // Load Firebase auth if not on file protocol (or try anyway)
    if (window.location.protocol !== 'file:') {
        loadAuthModule();
    } else {
        console.error('Auth module loading skipped due to file protocol');
    }

    // --- Typewriter Effect ---
    const typewriterElement = document.getElementById('typewriter-text');
    const texts = [
        "Yapay Zeka Destekli",
        "Hukuki Asistan",
        "Dilekçe Oluşturucu",
        "Emsal Karar Bulucu",
        "Sözleşme Analizörü"
    ];
    let textIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    let typeSpeed = 100;

    function type() {
        const currentText = texts[textIndex];

        if (isDeleting) {
            typewriterElement.textContent = currentText.substring(0, charIndex - 1);
            charIndex--;
            typeSpeed = 50;
        } else {
            typewriterElement.textContent = currentText.substring(0, charIndex + 1);
            charIndex++;
            typeSpeed = 100;
        }

        if (!isDeleting && charIndex === currentText.length) {
            isDeleting = true;
            typeSpeed = 2000;
        } else if (isDeleting && charIndex === 0) {
            isDeleting = false;
            textIndex = (textIndex + 1) % texts.length;
            typeSpeed = 500;
        }

        setTimeout(type, typeSpeed);
    }

    if (typewriterElement) {
        type();
    }

    // --- Feature Carousel ---
    const slides = document.querySelectorAll('.feature-slide');
    const titleElement = document.getElementById('mockup-title');
    let currentSlide = 0;
    const slideInterval = 4000;

    function nextSlide() {
        if (slides.length === 0) return;
        slides[currentSlide].classList.remove('active');
        currentSlide = (currentSlide + 1) % slides.length;
        slides[currentSlide].classList.add('active');

        if (titleElement) {
            titleElement.style.opacity = 0;
            setTimeout(() => {
                const newTitle = slides[currentSlide].getAttribute('data-title');
                if (newTitle) titleElement.textContent = newTitle;
                titleElement.style.opacity = 1;
            }, 300);
        }
    }

    if (slides.length > 0) {
        setInterval(nextSlide, slideInterval);
    }

    // Mobile Menu Toggle
    window.toggleMobileMenu = function () {
        const navLinks = document.querySelector('.nav-links');
        navLinks.style.display = navLinks.style.display === 'flex' ? 'none' : 'flex';
    };
});

// --- Theme Toggle ---
function toggleTheme() {
    const root = document.documentElement;
    const themeIcon = document.querySelector('.theme-icon');

    if (root.classList.contains('light')) {
        root.classList.remove('light');
        if (themeIcon) themeIcon.textContent = '🌙';
        localStorage.setItem('theme', 'dark');
    } else {
        root.classList.add('light');
        if (themeIcon) themeIcon.textContent = '☀️';
        localStorage.setItem('theme', 'light');
    }
}

// Load saved theme
(function () {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        document.documentElement.classList.add('light');
        const themeIcon = document.querySelector('.theme-icon');
        if (themeIcon) themeIcon.textContent = '☀️';
    }
})();

// --- Modal Functions ---
function showModal(type) {
    const modal = document.getElementById(type + '-modal');
    if (modal) {
        modal.classList.add('active');
        // Clear previous errors
        const errorDiv = document.getElementById(type + '-error');
        if (errorDiv) {
            errorDiv.style.display = 'none';
            errorDiv.textContent = '';
        }
    }
}

function closeModal(type) {
    const modal = document.getElementById(type + '-modal');
    if (modal) modal.classList.remove('active');
}

function switchModal(type) {
    closeModal(type === 'login' ? 'register' : 'login');
    showModal(type);
}

// --- Scroll to Section ---
function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
    }
}

// --- Show Error Message ---
function showError(modalType, message) {
    const errorDiv = document.getElementById(modalType + '-error');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    }
}

// --- Set Button Loading State ---
function setButtonLoading(buttonId, loading) {
    const btn = document.getElementById(buttonId);
    if (!btn) return;

    if (loading) {
        btn.disabled = true;
        btn.dataset.originalText = btn.textContent;
        btn.textContent = 'Yükleniyor...';
    } else {
        btn.disabled = false;
        btn.textContent = btn.dataset.originalText || btn.textContent;
    }
}

// --- Firebase Auth Handlers ---

async function handleLogin(event) {
    event.preventDefault();

    if (!authModule) {
        showError('login', 'Sistem yükleniyor, lütfen bekleyin...');
        return;
    }

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
        showError('login', 'Lütfen tüm alanları doldurun.');
        return;
    }

    setButtonLoading('login-btn', true);

    const result = await authModule.loginUser(email, password);

    setButtonLoading('login-btn', false);

    if (result.success) {
        closeModal('login');
        window.location.href = 'app.html';
    } else {
        showError('login', result.error);
    }
}

async function handleRegister(event) {
    event.preventDefault();

    if (!authModule) {
        showError('register', 'Sistem yükleniyor, lütfen bekleyin...');
        return;
    }

    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const termsAccepted = document.getElementById('register-terms').checked;

    if (!name || !email || !password) {
        showError('register', 'Lütfen tüm alanları doldurun.');
        return;
    }

    if (!termsAccepted) {
        showError('register', 'Kullanım şartlarını kabul etmelisiniz.');
        return;
    }

    if (password.length < 8) {
        showError('register', 'Şifre en az 8 karakter olmalıdır.');
        return;
    }

    setButtonLoading('register-btn', true);

    const result = await authModule.registerUser(email, password, name);

    setButtonLoading('register-btn', false);

    if (result.success) {
        if (result.requiresVerification) {
            // Yeni Akış: Doğrulama Modalı Aç (Önce içeriği hazırla)
            const emailDisplay = document.getElementById('verification-email-display');
            if (emailDisplay) emailDisplay.textContent = email;

            // Önce Modalı Aç (Kullanıcı hemen görsün)
            showModal('verification');

            // Register modalını biraz gecikmeli kapat (Animasyon geçişi için)
            setTimeout(() => {
                closeModal('register');
            }, 100);

            // Kullanıcı doğrulamadan çıkış yapmasın diye gerekirse logout'u engellemiyoruz ama
            // zaten authModule.onAuthChange app.html'e göndermeyecek çünkü emailVerified false.
        } else {
            // Eski akış (veya google login sonucu gelirse)
            closeModal('register');
            window.location.href = 'app.html';
        }
    } else {
        showError('register', result.error);
    }
}

// --- Verification Handlers ---

async function checkVerificationStatus() {
    setButtonLoading('check-verification-btn', true);
    const statusDiv = document.getElementById('verification-status');
    statusDiv.style.display = 'none';

    try {
        const isVerified = await authModule.checkEmailVerification();

        if (isVerified) {
            statusDiv.textContent = '✅ Doğrulama başarılı! Hesabınız oluşturuluyor...';
            statusDiv.style.color = '#4caf50'; // Green
            statusDiv.style.display = 'block';

            // Şimdi Firestore kaydını oluştur ve deneme süresini başlat
            const activationResult = await authModule.activateTrialAccount();

            if (activationResult.success) {
                setTimeout(() => {
                    window.location.href = 'app.html';
                }, 1500);
            } else {
                statusDiv.textContent = '❌ Hata: ' + activationResult.error;
                statusDiv.style.color = '#ff5252';
                statusDiv.style.display = 'block';
                setButtonLoading('check-verification-btn', false);
            }

        } else {
            statusDiv.textContent = '⚠️ Henüz doğrulanmamış. Lütfen e-postanızı kontrol edin.';
            statusDiv.style.color = '#ffb74d'; // Orange
            statusDiv.style.display = 'block';
            setButtonLoading('check-verification-btn', false);
        }
    } catch (error) {
        console.error('Verification check error:', error);
        statusDiv.textContent = '⚠️ Bir hata oluştu. Lütfen tekrar deneyin.';
        statusDiv.style.display = 'block';
        setButtonLoading('check-verification-btn', false);
    }
}

async function resendVerificationEmail() {
    const btn = document.getElementById('resend-btn');
    btn.disabled = true;
    btn.textContent = 'Gönderiliyor...';

    try {
        if (!authModule) {
            alert('Sistem henüz yüklenmedi.');
            return;
        }

        const result = await authModule.resendVerification();

        if (result.success) {
            alert('Doğrulama bağlantısı tekrar gönderildi. Lütfen spam kutunuzu da kontrol edin.');
        } else {
            alert('Hata: ' + result.error);
        }
    } catch (e) {
        console.error(e);
        alert('Beklenmeyen bir hata oluştu.');
    } finally {
        btn.textContent = 'Tekrar Gönder';
        btn.disabled = false;
    }
}

function cancelVerification() {
    closeModal('verification');
    authModule.logoutUser(); // Temiz bir başlangıç için çıkış yap
    showModal('login'); // Giriş ekranına dön
}

async function handleGoogleLogin() {
    if (!authModule) {
        alert('Sistem yükleniyor, lütfen bekleyin...');
        return;
    }

    const result = await authModule.loginWithGoogle();

    if (result.success) {
        closeModal('login');
        closeModal('register');
        window.location.href = 'app.html';
    } else {
        // Show in whichever modal is open
        const loginModal = document.getElementById('login-modal');
        if (loginModal && loginModal.classList.contains('active')) {
            showError('login', result.error);
        } else {
            showError('register', result.error);
        }
    }
}

async function handleForgotPassword(event) {
    event.preventDefault();

    if (!authModule) {
        alert('Sistem yükleniyor, lütfen bekleyin...');
        return;
    }

    const email = document.getElementById('login-email').value.trim();

    if (!email) {
        showError('login', 'Lütfen e-posta adresinizi girin.');
        return;
    }

    const result = await authModule.resetPassword(email);

    if (result.success) {
        alert('Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.');
    } else {
        showError('login', result.error);
    }
}

// ================= PWA INSTALL LOGIC =================
let deferredPrompt = null;
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallButton();
});

function showInstallButton() {
    const btn = document.getElementById('nav-install-btn');
    if (btn) btn.style.display = 'flex';
}

function installPWA() {
    if (isIOS) {
        // Show iOS Guide
        const modal = document.getElementById('install-modal');
        if (modal) {
            modal.classList.add('active');
            setTimeout(() => modal.classList.add('visible'), 10);
        }
    } else if (deferredPrompt) {
        // Android / Desktop
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('User accepted the A2HS prompt');
            }
            deferredPrompt = null;
        });
    } else {
        // Fallback for when already installed or not supported
        alert('Uygulamayı tarayıcı menüsünden "Ana Ekrana Ekle" diyerek yükleyebilirsiniz.');
    }
}

function closeInstallModal() {
    const modal = document.getElementById('install-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// Check if iOS to show button anyway (optional, or just rely on user clicking it if visible)
// For now, we only show button if beforeinstallprompt fires OR if we manually want to show it for iOS
if (isIOS) {
    showInstallButton();
}

// End of landing.js
