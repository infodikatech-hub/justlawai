/**
 * JustLaw Landing Page JavaScript
 * Firebase Authentication Entegrasyonu
 */

// Firebase Auth imports - will be loaded after page load
let authModule = null;

// Load auth module dynamically
async function loadAuthModule() {
    try {
        authModule = await import('./auth.js');
        console.log('[Landing] Auth module loaded');

        // Check if user is already logged in
        authModule.onAuthChange((user) => {
            if (user) {
                console.log('[Landing] User logged in:', user.email);
                // Redirect to app
                window.location.href = 'index.html';
            }
        });
    } catch (error) {
        console.error('[Landing] Failed to load auth module:', error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Load Firebase auth
    loadAuthModule();

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
        window.location.href = 'index.html';
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
        closeModal('register');
        window.location.href = 'index.html';
    } else {
        showError('register', result.error);
    }
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
        window.location.href = 'index.html';
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

