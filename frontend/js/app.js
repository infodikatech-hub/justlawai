/**
 * JustLaw - Main Application JavaScript
 * Türk Hukuku AI Asistanı
 */

// Configuration
// Configuration
const API_BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:')
    ? 'http://localhost:8000'
    : (window.CONFIG ? window.CONFIG.API_BASE_URL : 'https://justlaw-api.onrender.com');
let conversationId = null;
let isLoading = false;
let messages = [];

// PWA Install Prompt
let deferredPrompt = null;

// Auth State
let authModule = null;
let subscriptionModule = null;
let currentUser = null;
let userData = null;

// DOM Elements
let chatMessages, messageInput, sendBtn, welcomeScreen;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    chatMessages = document.getElementById('chat-messages');
    messageInput = document.getElementById('message-input');
    sendBtn = document.getElementById('send-btn');
    welcomeScreen = document.getElementById('welcome-screen');

    loadChatHistory();
    setupDragAndDrop();
    initAppTheme();
    registerServiceWorker();
    setupInstallPrompt();
    setupOfflineDetection();
    initDashboard();

    // Load Firebase auth
    await initAuth();

    console.log('JustLaw initialized successfully');
});

// ============== DASHBOARD FUNCTIONS ==============

function initDashboard() {
    // Set Date
    const dateElement = document.getElementById('current-date');
    if (dateElement) {
        const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
        dateElement.textContent = new Date().toLocaleDateString('tr-TR', options);
    }
}

// ============== PWA FUNCTIONS ==============

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then((registration) => {
                    console.log('[PWA] Service Worker registered:', registration.scope);

                    // Check for updates
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                // New update available
                                showUpdateNotification();
                            }
                        });
                    });
                })
                .catch((error) => {
                    console.error('[PWA] Service Worker registration failed:', error);
                });
        });
    }
}

function setupInstallPrompt() {
    // Capture the install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        showInstallButton();
        console.log('[PWA] Install prompt captured');
    });

    // Detect when app is installed
    window.addEventListener('appinstalled', () => {
        console.log('[PWA] App installed successfully');
        hideInstallButton();
        deferredPrompt = null;
    });
}

function showInstallButton() {
    // Create install button if it doesn't exist
    let installBtn = document.getElementById('pwa-install-btn');
    if (!installBtn) {
        installBtn = document.createElement('button');
        installBtn.id = 'pwa-install-btn';
        installBtn.className = 'pwa-install-btn';
        installBtn.innerHTML = '📲 Uygulamayı Yükle';
        installBtn.onclick = installPWA;

        // Add to sidebar footer
        const sidebarFooter = document.querySelector('.sidebar-footer');
        if (sidebarFooter) {
            sidebarFooter.insertBefore(installBtn, sidebarFooter.firstChild);
        }
    }
    installBtn.style.display = 'flex';
}

function hideInstallButton() {
    const installBtn = document.getElementById('pwa-install-btn');
    if (installBtn) {
        installBtn.style.display = 'none';
    }
}

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

async function installPWA() {
    if (isIOS) {
        // Show iOS Guide Modal
        const modal = document.getElementById('install-modal');
        if (modal) modal.classList.add('active');
        return;
    }

    if (!deferredPrompt) {
        alert('Uygulama zaten yüklü veya tarayıcınız desteklemiyor. Menüden "Ana Ekrana Ekle"yi deneyin.');
        return;
    }

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for user choice
    const { outcome } = await deferredPrompt.userChoice;
    console.log('[PWA] Install prompt outcome:', outcome);

    deferredPrompt = null;
    hideInstallButton();
}

function closeInstallModal() {
    const modal = document.getElementById('install-modal');
    if (modal) modal.classList.remove('active');
}
window.closeInstallModal = closeInstallModal;

function setupOfflineDetection() {
    // Initial check
    updateOnlineStatus();

    // Listen for online/offline events
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
}

function updateOnlineStatus() {
    const isOnline = navigator.onLine;
    const offlineBanner = document.getElementById('offline-banner');

    if (!isOnline) {
        // Show offline banner
        if (!offlineBanner) {
            const banner = document.createElement('div');
            banner.id = 'offline-banner';
            banner.className = 'offline-banner';
            banner.innerHTML = '📡 Çevrimdışısınız. Bazı özellikler kısıtlı olabilir.';
            document.body.prepend(banner);
        }
    } else {
        // Remove offline banner
        if (offlineBanner) {
            offlineBanner.remove();
        }
    }
}

function showUpdateNotification() {
    const updateBanner = document.createElement('div');
    updateBanner.className = 'update-banner';
    updateBanner.innerHTML = `
        <span>🔄 Yeni güncelleme mevcut!</span>
        <button onclick="window.location.reload()">Güncelle</button>
        <button onclick="this.parentElement.remove()">×</button>
    `;
    document.body.prepend(updateBanner);
}

// ============== AUTH FUNCTIONS ==============

async function initAuth() {
    try {
        authModule = await import('./auth.js');
        subscriptionModule = await import('./subscription.js');
        console.log('[App] Auth modules loaded');

        // Listen for auth state changes
        authModule.onAuthChange(async (user) => {
            if (user) {
                // E-posta doğrulama kontrolü (ZORUNLU)
                if (!user.emailVerified) {
                    console.warn('[App] Email not verified. Logging out...');
                    await authModule.logoutUser();
                    alert('Lütfen e-posta adresinize gelen doğrulama bağlantısına tıklayın ve tekrar giriş yapın.');
                    window.location.href = 'index.html';
                    return;
                }

                currentUser = user;
                userData = await authModule.getUserData(user.uid);
                console.log('[App] User logged in:', user.email);
                updateUserUI(true);

                // Trial kontrolü
                if (typeof window.checkTrialStatus === 'function') {
                    window.checkTrialStatus(user);
                }
            } else {
                currentUser = null;
                userData = null;
                console.log('[App] User logged out');
                updateUserUI(false);
                // Optionally redirect to landing page
                // window.location.href = 'landing.html';
            }
        });
    } catch (error) {
        console.error('[App] Failed to load auth modules:', error);
    }
}

function updateUserUI(isLoggedIn) {
    const sidebarFooter = document.querySelector('.sidebar-footer');
    if (!sidebarFooter) return;

    // Remove existing user info if any
    const existingUserInfo = document.getElementById('user-info-section');
    if (existingUserInfo) {
        existingUserInfo.remove();
    }

    if (isLoggedIn && currentUser) {
        // Get user initials
        const name = userData?.name || currentUser.displayName || currentUser.email || 'Kullanıcı';
        const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

        // Get plan info
        let planBadge = '';
        if (userData) {
            const now = new Date();
            if (userData.plan === 'trial') {
                const trialEnd = userData.trialEndDate?.toDate();
                if (trialEnd && trialEnd > now) {
                    const daysLeft = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));
                    planBadge = `<span class="plan-badge trial">🎁 Deneme (${daysLeft} gün)</span>`;
                } else {
                    planBadge = `<span class="plan-badge expired">⚠️ Süresi Doldu</span>`;
                }
            } else if (userData.plan === 'professional') {
                planBadge = `<span class="plan-badge premium">💎 Premium</span>`;
            } else if (userData.plan === 'enterprise') {
                planBadge = `<span class="plan-badge enterprise">🏢 Kurumsal</span>`;
            }
        }

        // Create user info section
        const userSection = document.createElement('div');
        userSection.id = 'user-info-section';
        userSection.className = 'user-info-section';
        userSection.innerHTML = `
            <div class="user-profile-card">
                <div class="user-avatar">${initials}</div>
                <div class="user-details">
                    <span class="user-name">${name}</span>
                    ${planBadge}
                </div>
            </div>
            <button class="nav-item logout-btn" onclick="handleLogout()">
                🚪 Çıkış Yap
            </button>
        `;

        // Insert before other footer items
        sidebarFooter.insertBefore(userSection, sidebarFooter.firstChild);

        // Update Dashboard Username
        const dashboardUsername = document.getElementById('dashboard-username');
        if (dashboardUsername) {
            dashboardUsername.textContent = name.split(' ')[0]; // First name only
        }
    }
}

async function handleLogout() {
    if (!authModule) return;

    if (confirm('Çıkış yapmak istediğinize emin misiniz?')) {
        const result = await authModule.logoutUser();
        if (result.success) {
            window.location.href = 'index.html';
        }
    }
}

// ============== THEME FUNCTIONS ==============

function initAppTheme() {
    const savedTheme = localStorage.getItem('justlaw-theme');
    if (savedTheme === 'light') {
        document.documentElement.classList.add('light');
        updateAppThemeIcon(true);
    }
}

function toggleAppTheme() {
    const isLight = document.documentElement.classList.toggle('light');
    localStorage.setItem('justlaw-theme', isLight ? 'light' : 'dark');
    updateAppThemeIcon(isLight);
}

function updateAppThemeIcon(isLight) {
    const icon = document.querySelector('.theme-icon-app');
    if (icon) {
        icon.textContent = isLight ? '☀️' : '🌙';
    }
}

// ============== CHAT FUNCTIONS ==============

async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message || isLoading) return;

    // Hide welcome screen
    if (welcomeScreen) {
        welcomeScreen.style.display = 'none';
    }

    // Add user message
    addMessage(message, 'user');
    messageInput.value = '';
    autoResize(messageInput);

    // Show loading
    isLoading = true;
    sendBtn.disabled = true;
    const loadingDiv = addLoadingMessage();

    try {
        const userId = currentUser ? currentUser.uid : 'anonymous';

        const response = await fetch(`${API_BASE_URL}/api/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: message,
                conversation_id: conversationId,
                user_id: userId
            })
        });

        const data = await response.json();

        // Remove loading
        loadingDiv.remove();

        if (!response.ok) {
            // Show API error message
            addMessage(`Hata: ${data.detail || 'Bilinmeyen bir hata oluştu.'}`, 'assistant');
            return;
        }

        // Add assistant message
        addMessage(data.response, 'assistant');
        conversationId = data.conversation_id;

        // Save to history
        saveChatHistory();

    } catch (error) {
        console.error('Error:', error);
        loadingDiv.remove();
        addMessage('⚠️ Sunucuya bağlanılamadı. (Sunucu uyku modunda olabilir, lütfen 30 saniye bekleyip tekrar deneyin)', 'assistant');
    } finally {
        isLoading = false;
        sendBtn.disabled = false;
    }
}

function addMessage(text, sender, isTyping = false) {
    const chatMessages = document.getElementById('chat-messages');

    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', sender);
    if (isTyping) messageDiv.classList.add('typing');

    const avatarDiv = document.createElement('div');
    avatarDiv.classList.add('message-avatar');

    // SVG Avatars
    if (sender === 'ai') {
        avatarDiv.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7H11V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"></path><path d="M9 13v2"></path><path d="M15 13v2"></path></svg>'; // Robot Icon
    } else {
        avatarDiv.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>'; // User Icon
    }

    const contentDiv = document.createElement('div');
    contentDiv.classList.add('message-content');

    if (isTyping) {
        contentDiv.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
    } else {
        // Parse basic markdown
        contentDiv.innerHTML = marked.parse(text);
    }

    messageDiv.appendChild(avatarDiv);
    messageDiv.appendChild(contentDiv);

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    return messageDiv;
}

function showWelcomeMessage() {
    const welcomeHTML = `
        <div class="welcome-message">
            <h2>Merhaba, ben JustLaw 👋</h2>
            <p>Size nasıl yardımcı olabilirim? Aşağıdaki konularda soru sorabilirsiniz:</p>
            <div class="suggestion-chips">
                <button onclick="usePrompt('Kıdem tazminatı nasıl hesaplanır?')">Kıdem Tazminatı</button>
                <button onclick="usePrompt('Kiracı tahliye süreci nasıldır?')">Kira Hukuku</button>
                <button onclick="usePrompt('Boşanma davası ne kadar sürer?')">Aile Hukuku</button>
                <button onclick="usePrompt('Tüketici hakem heyeti başvurusu nasıl yapılır?')">Tüketici Hakları</button>
            </div>
        </div>
    `;
    addMessage(welcomeHTML, 'ai');
}
function addLoadingMessage() {
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message assistant';
    loadingDiv.id = 'loading-message';
    loadingDiv.innerHTML = `
        <div class="message-avatar">⚖️</div>
        <div class="message-content">
            <div class="loading-dots">
                <span></span>
                <span></span>
                <span></span>
            </div>
        </div>
    `;
    chatMessages.appendChild(loadingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return loadingDiv;
}

function formatMessage(text) {
    // Basic markdown-like formatting
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>');
}

function formatAnalysisResult(text) {
    // Enhanced markdown parser for analysis results
    let formatted = text
        // Headers
        .replace(/^## (.*$)/gm, '<h3 style="color: var(--primary); margin: 24px 0 12px 0; padding-bottom: 8px; border-bottom: 1px solid var(--border);">$1</h3>')
        .replace(/^### (.*$)/gm, '<h4 style="color: var(--text-primary); margin: 16px 0 8px 0;">$1</h4>')
        // Bold and italic
        .replace(/\*\*(.*?)\*\*/g, '<strong style="color: var(--text-primary);">$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        // Numbered lists
        .replace(/^(\d+)\. (.*)$/gm, '<div style="margin: 8px 0; padding-left: 20px;"><span style="color: var(--primary); font-weight: 600;">$1.</span> $2</div>')
        // Bullet lists
        .replace(/^- (.*)$/gm, '<div style="margin: 8px 0 8px 16px; padding-left: 12px; border-left: 2px solid var(--primary);">$1</div>')
        // Code blocks (for any remaining JSON)
        .replace(/```json([\s\S]*?)```/g, '<pre style="background: var(--surface-hover); padding: 16px; border-radius: 8px; overflow-x: auto; font-size: 13px; margin: 16px 0;">$1</pre>')
        .replace(/```([\s\S]*?)```/g, '<pre style="background: var(--surface-hover); padding: 16px; border-radius: 8px; overflow-x: auto; font-size: 13px; margin: 16px 0;">$1</pre>')
        // Inline code
        .replace(/`([^`]+)`/g, '<code style="background: var(--surface-hover); padding: 2px 6px; border-radius: 4px;">$1</code>')
        // Line breaks
        .replace(/\n\n/g, '</p><p style="margin: 12px 0;">')
        .replace(/\n/g, '<br>');

    return '<div style="color: var(--text-secondary);">' + formatted + '</div>';
}

function sendSuggestion(text) {
    messageInput.value = text;
    sendMessage();
}

function startNewChat() {
    console.log('Starting new chat...');

    // Reset conversation
    conversationId = null;
    messages = [];

    // Clear messages container
    if (chatMessages) {
        chatMessages.innerHTML = '';
    }

    // Recreate welcome screen
    const welcomeHtml = `
        <div class="welcome-screen" id="welcome-screen">
            <div class="welcome-icon">⚖️</div>
            <h1>JustLaw'a Hoş Geldiniz</h1>
            <p>Türk Hukuku hakkında sorularınızı sorun. Mevzuat ve Yargıtay kararlarına dayalı yanıtlar alın.</p>
            
            <div class="suggestion-chips">
                <button class="chip" onclick="sendSuggestion('İhbar tazminatı nasıl hesaplanır?')">
                    İhbar tazminatı nasıl hesaplanır?
                </button>
                <button class="chip" onclick="sendSuggestion('Kira sözleşmesi feshi prosedürü nedir?')">
                    Kira sözleşmesi feshi prosedürü
                </button>
                <button class="chip" onclick="sendSuggestion('İş kazasında işverenin sorumlulukları nelerdir?')">
                    İş kazasında işveren sorumluluğu
                </button>
                <button class="chip" onclick="sendSuggestion('Boşanma davası süreci nasıl işler?')">
                    Boşanma davası süreci
                </button>
            </div>
        </div>
    `;

    chatMessages.innerHTML = welcomeHtml;
    welcomeScreen = document.getElementById('welcome-screen');

    // Switch to chat section
    showSection('chat');

    console.log('New chat started');
}

// ============== NAVIGATION ==============

function showSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));

    // Show target section
    const section = document.getElementById(`${sectionName}-section`);
    if (section) {
        section.classList.add('active');
    }

    // Update nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });

    // Try to find and activate the clicked nav item
    if (event && event.target) {
        const navItem = event.target.closest('.nav-item');
        if (navItem) {
            navItem.classList.add('active');
        }
    }
}

// ============== SETTINGS FUNCTIONS ==============

function saveProfile() {
    const name = document.getElementById('user-name')?.value;
    if (name) {
        localStorage.setItem('justlaw_user_name', name);
        alert('Profil kaydedildi!');
    }
}

function confirmLogout() {
    if (confirm('Çıkış yapmak istediğinize emin misiniz?')) {
        // TODO: Firebase logout
        alert('Çıkış yapıldı');
        window.location.reload();
    }
}

function confirmDeleteAccount() {
    if (confirm('Hesabınızı silmek istediğinize emin misiniz? Bu işlem geri alınamaz!')) {
        if (confirm('Tüm verileriniz silinecek. Son kez onaylıyor musunuz?')) {
            // TODO: Delete account
            alert('Hesap silme işlemi başlatıldı');
        }
    }
}

// ============== SEARCH FILTER ==============

function filterDilekce() {
    const searchInput = document.getElementById('dilekce-search');
    const filter = searchInput.value.toLowerCase();
    const categories = document.querySelectorAll('.dilekce-category');
    let hasVisibleItems = false;

    categories.forEach(category => {
        const items = category.querySelectorAll('.type-card');
        let hasVisibleItemInCategory = false;

        items.forEach(item => {
            const title = item.querySelector('h3').textContent.toLowerCase();
            const desc = item.querySelector('p').textContent.toLowerCase();

            // Broad search: match title or description
            if (title.includes(filter) || desc.includes(filter)) {
                item.style.display = ''; // Revert to CSS default (block/flex/grid)
                hasVisibleItemInCategory = true;
                hasVisibleItems = true;
            } else {
                item.style.display = 'none';
            }
        });

        // Hide category if no items match
        if (hasVisibleItemInCategory) {
            category.style.display = 'block';
        } else {
            category.style.display = 'none';
        }
    });

    // Optional: Show "No results" message if needed
    // const noResultsMsg = document.getElementById('search-no-results');
    // if (!hasVisibleItems && filter !== '') {
    //     noResultsMsg.style.display = 'block';
    // }
}

// ============== DILEKCE ==============

let selectedDilekceType = null;

const dilekceTypeNames = {
    // Aile Hukuku
    'bosanma': 'Çekişmeli Boşanma Davası',
    'anlasmali-bosanma': 'Anlaşmalı Boşanma Davası',
    'zina-bosanma': 'Zina Nedeniyle Boşanma',
    'terk-bosanma': 'Terk Nedeniyle Boşanma',
    'velayet': 'Velayet Davası Dilekçesi',
    'velayet-degistirme': 'Velayetin Değiştirilmesi Talebi',
    'kisisel-iliski': 'Çocukla Kişisel İlişki Kurulması',
    'nafaka': 'Nafaka Davası Dilekçesi',
    'nafaka-artirim': 'Nafaka Artırım Davası',
    'nafaka-azaltim': 'Nafaka Azaltım Davası',
    'babalik': 'Babalık Davası Dilekçesi',
    'soybaginin-reddi': 'Soybağının Reddi Dilekçesi',
    'iddet-muddeti': 'İddet Müddetinin Kaldırılması',
    'evlat-edinme': 'Evlat Edinme Başvurusu',
    'aile-konutu': 'Aile Konutu Şerhi Konulması',
    'soyadi-degisikligi': 'Soyadı Değişikliği Davası',
    'yurtdisi-cikis': 'Çocuğun Yurtdışına Çıkış İzni',
    'mal-rejimi': 'Mal Rejimi Tasfiye Dilekçesi',
    'ziynet': 'Ziynet Eşyası İadesi Davası',

    // İş Hukuku
    'kidem-tazminati': 'Kıdem Tazminatı Dilekçesi',
    'ihbar-tazminati': 'İhbar Tazminatı Dilekçesi',
    'ise-iade': 'İşe İade Davası Dilekçesi',
    'fazla-mesai': 'Fazla Mesai Alacağı Dilekçesi',
    'ucret-alacagi': 'Ödenmeyen Ücret Alacağı',
    'yillik-izin': 'Yıllık İzin Ücreti Alacağı',
    'is-kazasi': 'İş Kazası Maddi/Manevi Tazminat',
    'mobbing': 'Mobbing Nedeniyle Haklı Fesih',
    'sigorta-tespit': 'Hizmet Tespit Davası',
    'kotu-niyet': 'Kötü Niyet Tazminatı Davası',

    // Kira ve Gayrimenkul
    'tahliye': 'Tahliye Davası (Temerrüt)',
    'ihtiyac-tahliye': 'İhtiyaç Nedeniyle Tahliye',
    'tahliye-taahhut': 'Tahliye Taahhüdüne Dayalı Tahliye',
    'kira-tespit': 'Kira Tespit Davası',
    'kira-alacagi': 'Kira Alacağı İcra Takibi/Dava',
    'kira-uyarlama': 'Kira Uyarlama Davası',
    'elatmanin-onlenmesi': 'Müdahalenin Men\'i (El Atmanın Önlenmesi)',
    'ecrimisil': 'Ecrimisil (Haksız İşgal) Tazminatı',
    'izale-i-suyu': 'İzale-i Şuyu (Ortaklığın Giderilmesi)',
    'tapu-iptal': 'Tapu İptal ve Tescil Davası',
    'sufa': 'Önalım (Şufa) Hakkı Davası',
    'gecit-hakki': 'Geçit Hakkı Kurulması Talebi',
    'kat-karsiligi': 'Kat Karşılığı İnşaat Sözl. Feshi',
    'yonetim-plani': 'Yönetim Planı İptali',
    'komsuluk-hukuku': 'Komşuluk Hukukuna Aykırılık',

    // Ceza Hukuku
    'suc-duyurusu': 'Suç Duyurusu (Genel)',
    'dolandiricilik': 'Dolandırıcılık Suç Duyurusu',
    'hakaret-tehdit': 'Hakaret ve Tehdit Suç Duyurusu',
    'savunma': 'Savunma Dilekçesi (Mahkeme)',
    'ifade-verme': 'Yazılı İfade Sunma',
    'tutukluluk-itiraz': 'Tutukluluğa İtiraz Dilekçesi',
    'adli-kontrol-itiraz': 'Adli Kontrole İtiraz',
    'hagb-itiraz': 'HAGB Kararına İtiraz',
    'kyok-itiraz': 'Kovuşturmaya Yer Olmadığına İtiraz',
    'istinaf-ceza': 'Ceza İstinaf Başvuru Dilekçesi',
    'koruma-karari': '6284 Sayılı Kanun Koruma Talebi',
    'uzlasma': 'Uzlaşma Talep/Kabul Beyanı',
    'adli-sicil': 'Adli Sicil Kaydı Silme (Memnu Hak)',
    'infaz-erteleme': 'Cezanın İnfazının Ertelenmesi',

    // İcra ve İflas
    'icra-takibi': 'İlamsız İcra Takibi Talebi',
    'icra-itiraz': 'Ödeme Emrine İtiraz',
    'imza-itiraz': 'İmzaya İtiraz Dilekçesi',
    'itirazin-iptali': 'İtirazın İptali Davası',
    'itirazin-kaldirilmasi': 'İtirazın Kaldırılması Talebi',
    'menfi-tespit': 'Menfi Tespit (Borçsuzluk) Davası',
    'istirdat': 'İstirdat (Geri Alım) Davası',
    'ihalenin-feshi': 'İhalenin Feshi Davası',
    'kiymet-takdiri': 'Kıymet Takdirine İtiraz',
    'istihkak': 'İstihkak Davası Dilekçesi',
    'ihtiyati-haciz': 'İhtiyati Haciz Talebi',
    'maas-haczi-itiraz': 'Maaş Haczine Müzekkere İtirazı',
    'haczedilmezlik': 'Meskeniyet (Haczedilmezlik) Şikayeti',
    'cek-iptali': 'Çek İptali Davası',

    // Tüketici Hukuku
    'tuketici-hakem': 'Tüketici Hakem Heyeti Başvurusu',
    'tuketici-dava': 'Tüketici Mahkemesi Dava Dilekçesi',
    'ayipli-mal': 'Ayıplı Mal Bedel İadesi',
    'ayipli-hizmet': 'Ayıplı Hizmet Tazminatı',
    'ayipli-arac': 'Ayıplı Araç (Sıfır/İkinci El) İadesi',
    'devre-mulk': 'Devre Mülk İptali ve Bedel İadesi',
    'banka-ucret': 'Banka Dosya Masrafı İadesi',
    'kredi-karti': 'Kredi Kartı Aidatı İadesi',
    'abonelik-iptal': 'Abonelik İptal Başvurusu',

    // Bilişim ve İnternet
    'erisim-engelleme': 'Erişim Engelleme (Sulh Ceza)',
    'icerik-kaldirma': 'İçerik Kaldırma İhtarnamesi',
    'unutulma-hakki': 'Unutulma Hakkı Başvurusu',
    'kvkk-sikayet': 'KVKK Kuruluna Şikayet',
    'sosyal-medya': 'Sosyal Medya Hesabı Çalınması',

    // Şirketler ve Ticaret (New)
    'sirket-kurulus': 'Şirket Kuruluş Sözleşmesi',
    'genel-kurul-iptal': 'Genel Kurul Kararının İptali',
    'sirket-fesih': 'Şirketin Haklı Nedenle Feshi',
    'yonetici-sorumluluk': 'Yöneticilerin Sorumluluğu Davası',
    'haksiz-rekabet': 'Haksız Rekabetin Önlenmesi',
    'konkordato': 'Konkordato Talep Dilekçesi',
    'iflas': 'İflas Yoluyla Takip/Dava',
    'ticari-alacak': 'Ticari Alacak Davası',
    'fatura-itiraz': 'Faturaya İtiraz İhtarnamesi',

    // Sigorta Hukuku
    'arac-deger-kaybi': 'Araç Değer Kaybı Başvurusu',
    'hasar-tazminati': 'Trafik Hasar Tazminatı',
    'bedeni-hasar': 'Bedeni Hasar (Yaralanma) Tazminatı',
    'destekten-yoksun': 'Destekten Yoksun Kalma Tazminatı',
    'imm-basvuru': 'İMM (İhtiyari Mali Mesuliyet) Başvurusu',
    'sigorta-tahkim': 'Sigorta Tahkim Komisyonu Başvurusu',

    // İdare Hukuku
    'iptal-davasi': 'İdari İşlemin İptali Davası',
    'tam-yargi': 'Tam Yargı (Tazminat) Davası',
    'yurutme-durdurma': 'Yürütmenin Durdurulması Talebi',
    'imar-iptal': 'İmar Planı İptali Davası',
    'yikim-itiraz': 'Yıkım Kararına İtiraz',
    'memur-disiplin': 'Memur Disiplin Cezası İptali',
    'guvenlik-sorusturmasi': 'Güvenlik Soruşturması İptali',
    'goreve-iade': 'Göreve İade Talebi',
    'vergi-itiraz': 'Vergi/Ceza İhbarnamesine İtiraz',

    // Yabancılar Hukuku
    'deport-itiraz': 'Deport (Sınırdışı) Kararı İptali',
    'ikamet-red': 'İkamet İzni Reddine İtiraz',
    'calisma-izni': 'Çalışma İzni Reddine İtiraz',
    'idari-gozetim': 'İdari Gözetim Kararına İtiraz',
    'vatandaslik': 'Vatandaşlık Başvurusu Reddine İtiraz',

    // Fikri Mülkiyet (New)
    'marka-tecavuz': 'Marka Hakkına Tecavüz Davası',
    'telif-ihlali': 'Fikir ve Sanat Eseri Telif İhlali',
    'patent-hukumsuzluk': 'Patent Hükümsüzlüğü Davası',
    'tecavuz-ref': 'Tecavüzün Ref\'i (Giderilmesi) Davası',
    'marka-itiraz': 'TPE Marka Yayınına İtiraz',

    // Sağlık Hukuku (New)
    'malpraktis': 'Hekim Hatası (Malpraktis) Tazminatı',
    'hasta-haklari': 'Hasta Hakları Başvurusu',
    'ozel-hastane': 'Özel Hastane Fatura İtirazı'
};

const dilekceKonular = {
    // Aile
    'bosanma': 'Çekişmeli boşanma, maddi/manevi tazminat ve velayet talebi',
    'anlasmali-bosanma': 'Protokol hükümleri çerçevesinde anlaşmalı boşanma talebi',
    'zina-bosanma': 'Zina (aldatma) nedeniyle boşanma ve tazminat',
    'terk-bosanma': 'Terk (eve dönmeme) nedeniyle boşanma',
    'velayet': 'Velayetin anneye/babaya verilmesi talebi',
    'velayet-degistirme': 'Değişen şartlar nedeniyle velayetin değiştirilmesi (nez\'i)',
    'kisisel-iliski': 'Çocuk ile şahsi ilişki kurulması veya süresinin artırılması',
    'nafaka': 'İştirak/Yoksulluk nafakasının bağlanması',
    'nafaka-artirim': 'Ekonomik koşullar nedeniyle nafaka artırımı',
    'nafaka-azaltim': 'Ödeme güçlüğü nedeniyle nafaka indirimi/kaldırılması',
    'babalik': 'DNA testi ile babalığın tespiti ve tescili',
    'soybaginin-reddi': 'Nesebin (soybağının) reddi talebi',
    'iddet-muddeti': 'Kadının 300 günlük bekleme süresinin kaldırılması',
    'evlat-edinme': 'Küçüğün evlat edinilmesi için izin talebi',
    'aile-konutu': 'Tapuya aile konutu şerhi işlenmesi',
    'soyadi-degisikligi': 'Haklı nedenlerle isim/soyisim değişikliği',
    'yurtdisi-cikis': 'Velayeti kendisinde olan tarafın çocuğu yurtdışına çıkarma izni',
    'mal-rejimi': 'Edinilmiş mallara katılma ve katkı payı alacağı',
    'ziynet': 'Düğün takılarının (ziynet eşyası) iadesi veya bedeli',

    // İş
    'kidem-tazminati': 'Ödenmeyen kıdem tazminatı alacağı',
    'ihbar-tazminati': 'İhbar süresine uyulmadığından tazminat talebi',
    'ise-iade': 'Feshin geçersizliği, işe iade ve boşta geçen süre ücreti',
    'fazla-mesai': 'Ödenmeyen fazla mesai ücretlerinin tahsili',
    'ucret-alacagi': 'Ödenmeyen maaş/ücret alacaklarının tahsili',
    'yillik-izin': 'Kullandırılmayan yıllık izin ücretlerinin tahsili',
    'is-kazasi': 'İş kazası sonucu maluliyet/ölüm nedeniyle tazminat',
    'mobbing': 'Sistematik psikolojik taciz nedeniyle haklı fesih',
    'sigorta-tespit': 'Kuruma bildirilmeyen hizmet günlerinin tespiti',
    'kotu-niyet': 'İşverenin kötü niyetli feshi nedeniyle tazminat',

    // Gayrimenkul & Kira
    'tahliye': 'Kira borcunun ödenmemesi nedeniyle tahliye',
    'ihtiyac-tahliye': 'Konut/İşyeri gereksinimi nedeniyle tahliye',
    'tahliye-taahhut': 'Yazılı tahliye taahhüdüne dayalı tahliye',
    'kira-tespit': '5 yılı dolduran kiracının kira bedelinin piyasaya göre tespiti',
    'kira-alacagi': 'Ödenmeyen kira bedellerinin tahsili',
    'kira-uyarlama': 'Olağanüstü hallerde kira bedelinin uyarlanması',
    'elatmanin-onlenmesi': 'Haksız işgalin (müdahalenin) önlenmesi',
    'ecrimisil': 'Haksız kullanım nedeniyle işgal tazminatı',
    'izale-i-suyu': 'Fiziksel taksim veya satış suretiyle ortaklığın giderilmesi',
    'tapu-iptal': 'Yolsuz tescil nedeniyle tapu kaydının iptali ve tescili',
    'sufa': 'Paylı mülkiyette önalım hakkının kullanılması',
    'gecit-hakki': 'Zorunlu geçit hakkı kurulması',
    'kat-karsiligi': 'İnşaatın tamamlanmaması nedeniyle sözleşme feshi',
    'yonetim-plani': 'Kanuna aykırı yönetim planı maddesinin iptali',
    'komsuluk-hukuku': 'Gürültü, koku vb. nedenlerle komşuluk hakkı ihlali',

    // Ceza
    'suc-duyurusu': 'Cumhuriyet Başsavcılığına şikayet dilekçesi',
    'dolandiricilik': 'TCK 157/158 Dolandırıcılık suçu şikayeti',
    'hakaret-tehdit': 'Hakaret, tehdit ve şantaj suçlaması',
    'savunma': 'İddianameye veya esas hakkındaki mütalaaya karşı savunma',
    'ifade-verme': 'Soruşturma aşamasında yazılı ifade',
    'tutukluluk-itiraz': 'Tutuklama kararının kaldırılarak tahliye talebi',
    'adli-kontrol-itiraz': 'İmza vb. adli kontrol tedbirinin kaldırılması',
    'hagb-itiraz': 'Hükmün açıklanmasının geri bırakılması kararına itiraz',
    'kyok-itiraz': 'Kovuşturmaya Yer Olmadığı (Takipsizlik) kararına itiraz',
    'istinaf-ceza': 'Yerel mahkeme kararına karşı İstinaf başvurusu',
    'koruma-karari': 'Şiddet tehdidi nedeniyle 6284 s. K. uyarınca önleyici tedbir',
    'uzlasma': 'Uzlaşma teklifine beyan',
    'adli-sicil': 'Yasal şartlar oluştuğundan adli sicil kaydının silinmesi',
    'infaz-erteleme': 'Hastalık/Gebelik vb. nedenlerle infazın ertelenmesi',

    // İcra
    'icra-takibi': 'Fatura/Belgeye dayalı ilamsız takip talebi',
    'icra-itiraz': 'Borca, faize ve yetkiye itiraz',
    'imza-itiraz': 'Senetteki imzanın sahteliği iddiasıyla itiraz',
    'itirazin-iptali': 'Borçlunun haksız itirazının iptali ve inkar tazminatı',
    'itirazin-kaldirilmasi': 'İcra Hukuk Mahkemesinde itirazın kaldırılması',
    'menfi-tespit': 'İcra tehdidi altındaki borcun olmadığının tespiti',
    'istirdat': 'Cebri icra tehdidiyle ödenen paranın geri alınması',
    'ihalenin-feshi': 'Usulsüzlük nedeniyle icra ihalesinin feshi',
    'kiymet-takdiri': 'Hacizli malın değer tespitine itiraz',
    'istihkak': 'Haczedilen malın 3. kişiye ait olduğu iddiası',
    'ihtiyati-haciz': 'Alacağın güvence altına alınması için ihtiyati haciz',
    'maas-haczi-itiraz': 'Haczedilmezlik veya oran hatası nedeniyle maaş haczine itiraz',
    'haczedilmezlik': 'Tek konutun (meskenin) haczine itiraz',
    'cek-iptali': 'Rızası dışında elden çıkan çekin iptali',

    // Tüketici
    'tuketici-hakem': 'Tüketici Hakem Heyetine ayıplı mal başvurusu',
    'tuketici-dava': 'Tüketici Mahkemesinde dava açılması',
    'ayipli-mal': 'Ayıplı ürünün değişimi veya iadesi',
    'ayipli-hizmet': 'Hatalı hizmet nedeniyle bedel iadesi/tazminat',
    'ayipli-arac': 'Gizli ayıplı aracın iadesi veya değer kaybı',
    'devre-mulk': 'Cayma hakkı veya ifa imkansızlığı nedeniyle iptal',
    'banka-ucret': 'Haksız alınan dosya masrafının iadesi',
    'kredi-karti': 'Yıllık kart aidatının iadesi',
    'abonelik-iptal': 'İnternet/GSM aboneliğinin iptali',

    // Bilişim
    'erisim-engelleme': '5651 s. K. uyarınca kişilik hakları ihlali',
    'icerik-kaldirma': 'İnternet sitesi/yer sağlayıcıya ihtar',
    'unutulma-hakki': 'Eski tarihli haberlerin arama motorundan silinmesi',
    'kvkk-sikayet': 'Kişisel verilerin hukuka aykırı işlenmesi şikayeti',
    'sosyal-medya': 'Hesap hırsızlığı nedeniyle şikayet ve erişim engeli',

    // Şirketler
    'sirket-kurulus': 'Anonim/Limited şirket ana sözleşmesi',
    'genel-kurul-iptal': 'Kanuna/Sözleşmeye aykırı genel kurul karar iptali',
    'sirket-fesih': 'Haklı nedenlerle şirketin feshi ve tasfiyesi',
    'yonetici-sorumluluk': 'Yönetim kurulu üyelerinin hukuki sorumluluğu',
    'haksiz-rekabet': 'TTK uyarınca haksız rekabetin tespiti ve önlenmesi',
    'konkordato': 'Borçların yapılandırılması için konkordato mühleti talebi',
    'iflas': 'Doğrudan veya takipli iflas talebi',
    'ticari-alacak': 'Ticari satımdan kaynaklanan alacak davası',
    'fatura-itiraz': '8 gün içinde faturaya itiraz',

    // Sigorta
    'arac-deger-kaybi': 'Eksper raporuna dayalı değer kaybı talebi',
    'hasar-tazminati': 'Kasko/Trafik sigortasından hasar tahsili',
    'bedeni-hasar': 'Sürekli/Geçici iş göremezlik tazminatı',
    'destekten-yoksun': 'Vefat halinde yakınların tazminat talebi',
    'imm-basvuru': 'Zorunlu sigorta limitini aşan hasarlar',
    'sigorta-tahkim': 'Sigorta Tahkim Komisyonuna başvuru',

    // İdare
    'iptal-davasi': 'Menfaati ihlal eden idari işlemin iptali',
    'tam-yargi': 'İdari eylem/işlemden doğan zararın tazmini',
    'yurutme-durdurma': 'Telafisi güç zararlar nedeniyle YD talebi',
    'imar-iptal': 'Nazım/Uygulama imar planının iptali',
    'yikim-itiraz': 'Belediye yıkım kararına ve cezasına itiraz',
    'memur-disiplin': 'Uyarma/Kınama/İhraç cezalarının iptali',
    'guvenlik-sorusturmasi': 'Olumsuz güvenlik soruşturması kararının iptali',
    'goreve-iade': 'Kamu görevine iade talebi',
    'vergi-itiraz': 'Vergi ziyaı cezası ve usulsüzlük cezasına itiraz',

    // Yabancılar
    'deport-itiraz': 'Sınırdışı kararına karşı İdare Mahkemesinde dava',
    'ikamet-red': 'İkamet izni başvurusunun reddine itiraz',
    'calisma-izni': 'Çalışma izni başvurusunun reddine itiraz',
    'idari-gozetim': 'Sulh Ceza Hakimliğine idari gözetim itirazı',
    'vatandaslik': 'Vatandaşlık başvurusunun reddine itiraz',

    // Fikri Mülkiyet
    'marka-tecavuz': 'Marka hakkına tecavüzün durdurulması',
    'telif-ihlali': 'İzinsiz eser kullanımı nedeniyle tazminat',
    'patent-hukumsuzluk': 'Yenilik/tekniğin bilinen durumu nedeniyle hükümsüzlük',
    'tecavuz-ref': 'Tecavüzün ref\'i (giderilmesi) ve men\'i (önlenmesi)',
    'marka-itiraz': 'Türk Patent Kurumu nezdinde marka yayınına itiraz',

    // Sağlık
    'malpraktis': 'Hekim hatası nedeniyle maddi/manevi tazminat',
    'hasta-haklari': 'Hasta hakları birimine/Bakanlığa şikayet',
    'ozel-hastane': 'Fahiş veya haksız hastane faturasına itiraz'
};

function selectDilekce(type) {
    selectedDilekceType = type;

    // Hide type selection and search, show form
    document.getElementById('dilekce-types').style.display = 'none';
    document.querySelector('.dilekce-search-container').style.display = 'none';
    document.getElementById('dilekce-form').style.display = 'block';

    // Update form title
    document.getElementById('dilekce-form-title').textContent = dilekceTypeNames[type] || 'Dilekçe Bilgileri';

    // Pre-fill konu
    const konuInput = document.getElementById('dilekce-konu');
    if (konuInput && dilekceKonular[type]) {
        konuInput.placeholder = dilekceKonular[type];
    }
}

function showDilekceTypes() {
    document.getElementById('dilekce-types').style.display = 'grid';
    document.querySelector('.dilekce-search-container').style.display = 'block';
    document.getElementById('dilekce-form').style.display = 'none';
    selectedDilekceType = null;
}

async function generateDilekcePDF() {
    const btn = document.getElementById('wizard-submit');
    const originalText = btn.innerHTML;

    // Helper to safely get values
    const getVal = (id) => document.getElementById(id)?.value?.trim() || '';

    const mahkeme = getVal('dilekce-mahkeme') || 'ASLİYE HUKUK MAHKEMESİ HAKİMLİĞİNE';
    const davaciAdi = getVal('dilekce-davaci-adi');
    const davaciTc = getVal('dilekce-davaci-tc');
    const davaciAdres = getVal('dilekce-davaci-adres');
    const davaliAdi = getVal('dilekce-davali-adi');
    const davaliAdres = getVal('dilekce-davali-adres');
    const konu = getVal('dilekce-konu');
    const aciklamalar = getVal('dilekce-aciklamalar');
    const talepler = getVal('dilekce-talepler');

    if (!davaciAdi || !aciklamalar) {
        alert('Lütfen en az "Davacı Adı" ve "Açıklamalar" alanlarını doldurun.');
        return;
    }

    btn.innerHTML = '✨ AI Hazırlıyor...';
    btn.disabled = true;

    try {
        const payload = {
            mahkeme: mahkeme,
            davaci_adi: davaciAdi,
            davaci_tc: davaciTc || '-',
            davaci_adres: davaciAdres || '-',
            davali_adi: davaliAdi || '-',
            davali_adres: davaliAdres || '-',
            konu: konu || (dilekceKonular[selectedDilekceType] || 'Dava Konusu'),
            aciklamalar: aciklamalar,
            talepler: talepler || 'Hukuki haklarımın korunmasını talep ederim.',
            dilekce_turu: dilekceTypeNames[selectedDilekceType] || 'Dilekce'
        };

        const response = await fetch(`${API_BASE_URL}/api/dilekce/pdf`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || 'PDF oluşturulamadı (Sunucu Hatası)');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');

        const typeName = (dilekceTypeNames[selectedDilekceType] || 'Dilekce').substring(0, 30);
        const cleanName = typeName.replace(/[^a-zA-Z0-9]/g, '_');

        a.href = url;
        a.download = `${cleanName}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        alert('✅ Profesyonel Dilekçeniz Hazır! (AI Tarafından Düzenlendi)');

    } catch (error) {
        console.error('PDF Hatası:', error);
        alert('Hata: ' + error.message + '\n\nLütfen backend sunucusunun (localhost:8000) çalıştığından emin olun.');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

async function downloadDilekceUDF() {
    const btn = document.getElementById('udf-submit');
    const originalText = btn.innerHTML;

    // Helper to safely get values
    const getVal = (id) => document.getElementById(id)?.value?.trim() || '';

    const mahkeme = getVal('dilekce-mahkeme') || 'ASLİYE HUKUK MAHKEMESİ HAKİMLİĞİNE';
    const davaciAdi = getVal('dilekce-davaci-adi');
    const davaciTc = getVal('dilekce-davaci-tc');
    const davaciAdres = getVal('dilekce-davaci-adres');
    const davaliAdi = getVal('dilekce-davali-adi');
    const davaliAdres = getVal('dilekce-davali-adres');
    const konu = getVal('dilekce-konu');
    const aciklamalar = getVal('dilekce-aciklamalar');
    const talepler = getVal('dilekce-talepler');

    if (!davaciAdi || !aciklamalar) {
        alert('Lütfen bilgileri doldurun.');
        return;
    }

    btn.innerHTML = '✨ Hazırlanıyor...';
    btn.disabled = true;

    try {
        const formData = new FormData();
        formData.append('mahkeme', mahkeme);
        formData.append('davaci_adi', davaciAdi);
        formData.append('davaci_tc', davaciTc);
        formData.append('davaci_adres', davaciAdres);
        formData.append('davali_adi', davaliAdi);
        formData.append('davali_adres', davaliAdres);
        formData.append('konu', konu || (dilekceKonular[selectedDilekceType] || 'Dava'));
        formData.append('aciklamalar', aciklamalar);
        formData.append('talepler', talepler || 'Gereğinin yapılmasını arz ederim.');
        formData.append('dilekce_turu', dilekceTypeNames[selectedDilekceType] || 'Genel');

        const response = await fetch(`${API_BASE_URL}/api/dilekce/udf`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('UDF sunucudan alınamadı');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');

        const typeName = (dilekceTypeNames[selectedDilekceType] || 'Dilekce').substring(0, 30);
        const cleanName = typeName.replace(/[^a-zA-Z0-9]/g, '_');

        a.href = url;
        a.download = `${cleanName}.udf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        alert('✅ UDF Dosyası Hazır!');

    } catch (error) {
        console.error('UDF Hatası:', error);
        alert('UDF Hatası: Sunucu yanıt vermedi.');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// ============== SÖZLEŞME ANALİZİ ==============

function setupDragAndDrop() {
    const uploadArea = document.getElementById('upload-area');
    if (!uploadArea) return;

    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    });
}

// ============== WIZARD FUNCTIONS ==============

let currentStep = 1;
const totalSteps = 4;

// Initialize Wizard (if needed)
function initWizard() {
    updateWizardUI();
}

function updateWizardUI() {
    // Show/Hide Steps
    document.querySelectorAll('.wizard-step').forEach(step => {
        step.classList.remove('active');
        if (step.id === `step-${currentStep}`) {
            step.classList.add('active');
        }
    });

    // Update Progress Bar
    document.querySelectorAll('.progress-step').forEach(step => {
        const stepNum = parseInt(step.dataset.step);
        step.classList.remove('active', 'completed');
        if (stepNum === currentStep) {
            step.classList.add('active');
        } else if (stepNum < currentStep) {
            step.classList.add('completed');
        }
    });

    // Update Buttons
    const prevBtn = document.getElementById('wizard-prev');
    const nextBtn = document.getElementById('wizard-next');
    const submitBtn = document.getElementById('wizard-submit');
    const udfBtn = document.getElementById('udf-submit');

    if (prevBtn) prevBtn.disabled = currentStep === 1;

    if (nextBtn && submitBtn) {
        if (currentStep === totalSteps) {
            nextBtn.style.display = 'none';
            submitBtn.style.display = 'flex';
            if (udfBtn) udfBtn.style.display = 'flex';
        } else {
            nextBtn.style.display = 'flex';
            submitBtn.style.display = 'none';
            if (udfBtn) udfBtn.style.display = 'none';
        }
    }
}

function validateStep(step) {
    if (step === 1) {
        const name = document.getElementById('dilekce-davaci-adi').value.trim();
        const tc = document.getElementById('dilekce-davaci-tc').value.trim();
        if (!name) {
            alert('Lütfen Ad Soyad alanını doldurun.');
            return false;
        }
        if (tc && tc.length !== 11) {
            alert('T.C. Kimlik No 11 haneli olmalıdır.');
            return false;
        }
    }
    if (step === 3) {
        const konu = document.getElementById('dilekce-konu').value.trim();
        const aciklama = document.getElementById('dilekce-aciklamalar').value.trim();
        if (!konu || !aciklama) {
            alert('Lütfen Konu ve Olayın Özeti alanlarını doldurun.');
            return false;
        }
    }
    return true;
}

function nextStep() {
    if (validateStep(currentStep)) {
        if (currentStep < totalSteps) {
            currentStep++;
            updateWizardUI();
        }
    }
}

function prevStep() {
    if (currentStep > 1) {
        currentStep--;
        updateWizardUI();
    }
}

// Call initWizard when showing the dilekce section
// This relies on the updated app.html calling this script
document.addEventListener('DOMContentLoaded', () => {
    initWizard();
});

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (file) {
        handleFile(file);
    }
}

async function handleFile(file) {
    const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'application/xml', 'text/xml'];
    // UDF files are technically XML, but might have empty MIME or binary stream depending on OS
    const isUdf = file.name.toLowerCase().endsWith('.udf');

    if (!validTypes.includes(file.type) && !file.name.endsWith('.txt') && !isUdf) {
        alert('Lütfen PDF, DOCX, TXT veya UDF dosyası yükleyin.');
        return;
    }

    if (file.size > 20 * 1024 * 1024) {
        alert('Dosya boyutu 20MB\'dan büyük olamaz.');
        return;
    }

    const uploadArea = document.getElementById('upload-area');
    const analysisResult = document.getElementById('analysis-result');

    // Reset any previous compact state
    uploadArea.classList.remove('compact');
    uploadArea.style.marginLeft = '';
    uploadArea.style.width = '';

    // Show loading state
    uploadArea.innerHTML = `
        <div class="upload-icon">⏳</div>
        <h3>Analiz Ediliyor...</h3>
        <p>${file.name} dosyası işleniyor</p>
    `;

    try {
        // Send to backend for analysis (using FormData for file upload)
        const formData = new FormData();
        formData.append('file', file);
        formData.append('user_id', 'anonymous');

        const response = await fetch(`${API_BASE_URL}/api/sozlesme-analiz`, {
            method: 'POST',
            body: formData // Content-Type is set automatically
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || 'Analiz başarısız');
        }

        // Show results
        analysisResult.style.display = 'block';
        analysisResult.innerHTML = `
            <div class="analysis-header" style="display: flex; justify-content: space-between; align-items: center;">
                <h3>📋 Analiz Sonuçları: ${file.name}</h3>
            </div>
            <div class="analysis-content" style="background: var(--surface); padding: 24px; border-radius: 12px; margin-top: 16px; max-height: 60vh; overflow-y: auto; line-height: 1.8;">
                ${formatAnalysisResult(data.analiz || 'Analiz tamamlandı.')}
            </div>
        `;

        // Switch to compact upload area
        uploadArea.classList.add('compact');
        uploadArea.style.marginLeft = 'auto';
        uploadArea.style.width = 'fit-content';

        uploadArea.innerHTML = `
            <div>
                <h3>Başka Bir Sözleşme Yükleyin</h3>
                <p>PDF, DOCX veya TXT formatında, maksimum 20MB</p>
            </div>
            <input type="file" id="file-input" accept=".pdf,.docx,.txt" hidden onchange="handleFileUpload(event)">
            <button class="upload-btn" onclick="document.getElementById('file-input').click()">
                Dosya Seç
            </button>
        `;

    } catch (error) {
        console.error('Error:', error);

        // Reset upload area with error (keep large)
        uploadArea.classList.remove('compact');
        uploadArea.style.marginLeft = '';
        uploadArea.style.width = '';

        uploadArea.innerHTML = `
            <div class="upload-icon">❌</div>
            <h3>Analiz Başarısız</h3>
            <p style="color: #ef4444;">${error.message || 'Beklenmeyen bir hata oluştu'}</p>
            <input type="file" id="file-input" accept=".pdf,.docx,.txt" hidden onchange="handleFileUpload(event)">
            <button class="upload-btn" onclick="document.getElementById('file-input').click()">
                Tekrar Dene
            </button>
        `;

        analysisResult.style.display = 'none';
    }
}

// ============== DILEKCE AI YARDIMCISI ==============

async function generateWithAI(fieldName) {
    // Collect context
    const dilekceTuru = selectedDilekceType || 'genel';
    const davaciAdi = document.getElementById('dilekce-davaci-adi')?.value || '';
    const davaliAdi = document.getElementById('dilekce-davali-adi')?.value || '';
    const konu = document.getElementById('dilekce-konu')?.value || '';
    const aciklamalar = document.getElementById('dilekce-aciklamalar')?.value || '';

    let fieldType = '';
    let targetId = '';
    let btnId = '';

    if (fieldName === 'konu') {
        fieldType = 'konu';
        targetId = 'dilekce-konu';
        btnId = 'ai-btn-konu';
    } else if (fieldName === 'talepler') {
        fieldType = 'talepler';
        targetId = 'dilekce-talepler';
        btnId = 'ai-btn-talepler';
    } else {
        return;
    }

    const btn = document.getElementById(btnId);
    if (btn) {
        btn.innerHTML = '🤖 Düşünüyor...';
        btn.disabled = true;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/dilekce/generate-field`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                field_type: fieldType,
                context: {
                    dilekce_turu: dilekceTypeNames[dilekceTuru] || dilekceTuru,
                    davaci_adi: davaciAdi,
                    davali_adi: davaliAdi,
                    konu: konu,
                    aciklamalar: aciklamalar
                }
            })
        });

        const data = await response.json();

        if (data.text) {
            const input = document.getElementById(targetId);
            if (input) {
                // Determine animation/insertion style
                input.value = data.text;
                // Highlight modification
                input.style.transition = 'background-color 0.5s';
                input.style.backgroundColor = '#e0f7fa';
                setTimeout(() => {
                    input.style.backgroundColor = '';
                }, 1000);
            }
        }
    } catch (error) {
        console.error('AI Gen Error:', error);
        alert('AI önerisi alınırken bir hata oluştu');
    } finally {
        if (btn) {
            btn.innerHTML = '✨ AI ile Öner';
            btn.disabled = false;
        }
    }
}

// ============== DILEKCE EK DOSYALARI ==============

let dilekceAttachments = [];

function handleAttachments(event) {
    const files = event.target.files;
    const listContainer = document.getElementById('attachment-list');

    for (const file of files) {
        // Check if already added
        if (dilekceAttachments.find(f => f.name === file.name)) continue;

        // Add to array
        dilekceAttachments.push(file);

        // Add to UI
        const item = document.createElement('div');
        item.className = 'attachment-item';
        item.innerHTML = `
            <span>📄 ${file.name}</span>
            <button class="remove-btn" onclick="removeAttachment('${file.name}', this)">×</button>
        `;
        listContainer.appendChild(item);
    }

    // Clear input for re-selection
    event.target.value = '';
}

function removeAttachment(fileName, btnElement) {
    dilekceAttachments = dilekceAttachments.filter(f => f.name !== fileName);
    btnElement.parentElement.remove();
}

// ============== EMSAL KARARLAR ==============

// Toast notification system
function showToast(message, type = 'info') {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span>${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
        <span>${message}</span>
    `;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Multi-source search (new)
async function searchEmsalMulti() {
    const query = document.getElementById('emsal-search').value.trim();
    if (!query) {
        showToast('Lütfen bir arama terimi girin', 'error');
        return;
    }

    // Get selected sources
    const sources = [];
    if (document.getElementById('source-yargitay')?.checked) sources.push('yargitay');
    if (document.getElementById('source-danistay')?.checked) sources.push('danistay');
    if (document.getElementById('source-anayasa')?.checked) sources.push('anayasa');
    if (document.getElementById('source-rekabet')?.checked) sources.push('rekabet');

    if (sources.length === 0) {
        showToast('En az bir kaynak seçin', 'error');
        return;
    }

    const resultsDiv = document.getElementById('emsal-results');
    resultsDiv.innerHTML = `
        <div style="text-align: center; padding: 40px;">
            <div class="loading-dots"><span></span><span></span><span></span></div>
            <p style="color: var(--text-secondary); margin-top: 16px;">${sources.length} kaynakta aranıyor...</p>
        </div>
    `;

    try {
        const response = await fetch(
            `${API_BASE_URL}/api/legal/search?query=${encodeURIComponent(query)}&sources=${sources.join(',')}&limit=30`
        );
        const data = await response.json();

        if (data.results && data.results.length > 0) {
            showToast(`${data.results.length} sonuç bulundu`, 'success');
            resultsDiv.innerHTML = data.results.map((r, index) => {
                const fullContent = r.ozet || r.content || 'Karar özeti mevcut değil';
                const isLong = fullContent.length > 400;
                const shortContent = isLong ? fullContent.substring(0, 400) + '...' : fullContent;

                // Source badge color
                const sourceColors = {
                    'yargitay': '#6366f1',
                    'yargıtay': '#6366f1',
                    'danistay': '#22c55e',
                    'danıştay': '#22c55e',
                    'anayasa': '#f59e0b',
                    'aym': '#f59e0b',
                    'rekabet': '#ef4444'
                };
                const sourceColor = sourceColors[r.source?.toLowerCase()] || '#6366f1';
                const sourceName = r.source || r.daire || 'Kaynak';

                return `
                <div class="emsal-card" style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 20px; margin-bottom: 16px;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                        <div>
                            <span style="background: ${sourceColor}; color: white; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; text-transform: uppercase;">${sourceName}</span>
                            <h3 style="color: var(--text-primary); margin: 8px 0 0; font-size: 16px;">
                                ${r.daire || 'Mahkeme Kararı'}
                            </h3>
                        </div>
                        <span style="font-size: 12px; color: var(--text-muted);">${r.tarih || ''}</span>
                    </div>
                    <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px;">
                        ${r.esas_no ? `E. ${r.esas_no}` : ''} ${r.karar_no ? `K. ${r.karar_no}` : ''}
                    </div>
                    <div id="emsal-content-${index}" style="line-height: 1.7; color: var(--text-primary);">
                        <p style="margin: 0;" id="emsal-short-${index}">${shortContent}</p>
                        ${isLong ? `
                            <p style="margin: 0; display: none;" id="emsal-full-${index}">${fullContent}</p>
                            <button onclick="toggleEmsalContent(${index})" id="emsal-toggle-${index}" style="margin-top: 8px; color: var(--primary); background: none; border: none; cursor: pointer; font-size: 13px;">Devamını Göster</button>
                        ` : ''}
                    </div>
                </div>
                `;
            }).join('');
        } else {
            resultsDiv.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
                    <p>Sonuç bulunamadı. Farklı terimler deneyin.</p>
                    ${data.message ? `<p style="font-size: 12px; color: var(--text-muted);">${data.message}</p>` : ''}
                </div>
            `;
        }
    } catch (error) {
        console.error('Search error:', error);
        showToast('Arama sırasında hata oluştu', 'error');
        resultsDiv.innerHTML = '<p style="color: var(--text-muted);">Arama hatası.</p>';
    }
}

// Legacy single-source search (for backward compatibility)
async function searchEmsal() {
    const query = document.getElementById('emsal-search').value.trim();
    if (!query) return;

    const resultsDiv = document.getElementById('emsal-results');
    resultsDiv.innerHTML = '<p style="color: var(--text-secondary);">Aranıyor...</p>';

    try {
        // Use new Yargıtay search endpoint
        const response = await fetch(`${API_BASE_URL}/api/yargitay/search?query=${encodeURIComponent(query)}&limit=30`);
        const data = await response.json();

        if (data.results && data.results.length > 0) {
            resultsDiv.innerHTML = data.results.map((r, index) => {
                const fullContent = r.ozet || r.content || 'Karar özeti mevcut değil';
                const isLong = fullContent.length > 400;
                const shortContent = isLong ? fullContent.substring(0, 400) + '...' : fullContent;

                return `
                <div class="emsal-card" style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 20px; margin-bottom: 16px;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                        <h3 style="color: var(--primary); margin: 0; font-size: 16px;">
                            ${r.daire || 'Yargıtay Kararı'}
                        </h3>
                        <span style="font-size: 12px; color: var(--text-muted);">${r.tarih || ''}</span>
                    </div>
                    <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px;">
                        ${r.esas_no ? `E. ${r.esas_no}` : ''} ${r.karar_no ? `K. ${r.karar_no}` : ''}
                    </div>
                    <div id="emsal-content-${index}" style="line-height: 1.7; color: var(--text-primary);">
                        <p style="margin: 0;" id="emsal-short-${index}">${shortContent}</p>
                        ${isLong ? `
                            <p style="margin: 0; display: none;" id="emsal-full-${index}">${fullContent}</p>
                            <button onclick="toggleEmsalContent(${index})" id="emsal-btn-${index}" 
                                style="background: none; border: none; color: var(--primary); cursor: pointer; padding: 8px 0; font-size: 13px; font-weight: 500;">
                                Devamını Oku
                            </button>
                        ` : ''}
                    </div>
                </div>
            `}).join('');

            if (data.message && data.message !== 'success') {
                resultsDiv.innerHTML += `<p style="color: var(--text-muted); font-size: 12px; margin-top: 16px;">ℹ️ ${data.message}</p>`;
            }
        } else {
            resultsDiv.innerHTML = `<p style="color: var(--text-secondary);">Sonuç bulunamadı. ${data.message || ''}</p>`;
        }
    } catch (error) {
        console.error('Error:', error);
        resultsDiv.innerHTML = '<p style="color: #ef4444;">Arama sırasında hata oluştu. Backend sunucusunun çalıştığından emin olun.</p>';
    }
}

function toggleEmsalContent(index) {
    const shortEl = document.getElementById(`emsal-short-${index}`);
    const fullEl = document.getElementById(`emsal-full-${index}`);
    const btnEl = document.getElementById(`emsal-btn-${index}`);

    if (shortEl.style.display !== 'none') {
        shortEl.style.display = 'none';
        fullEl.style.display = 'block';
        btnEl.textContent = 'Daralt';
    } else {
        shortEl.style.display = 'block';
        fullEl.style.display = 'none';
        btnEl.textContent = 'Devamını Oku';
    }
}

// ============== UTILITIES ==============

function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

function autoResize(textarea) {
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
}

function saveChatHistory() {
    if (conversationId && messages.length > 0) {
        const history = JSON.parse(localStorage.getItem('justlaw_chat_history') || '[]');

        const existing = history.findIndex(h => h.id === conversationId);
        const chatData = {
            id: conversationId,
            title: messages[0]?.content?.substring(0, 30) + '...' || 'Sohbet',
            messages: messages,
            timestamp: Date.now()
        };

        if (existing >= 0) {
            history[existing] = chatData;
        } else {
            history.unshift(chatData);
        }

        // Keep only last 10 chats
        localStorage.setItem('justlaw_chat_history', JSON.stringify(history.slice(0, 10)));

        loadChatHistory();
    }
}

function loadChatHistory() {
    const historyDiv = document.getElementById('chat-history');
    if (!historyDiv) return;

    const history = JSON.parse(localStorage.getItem('justlaw_chat_history') || '[]');

    if (history.length === 0) {
        historyDiv.innerHTML = '<p style="color: var(--text-muted); font-size: 13px; padding: 12px;">Henüz sohbet yok</p>';
        return;
    }

    historyDiv.innerHTML = history.slice(0, 5).map(chat => `
        <a href="#" class="nav-item" onclick="loadConversation('${chat.id}')">
            <span class="nav-icon">💬</span>
            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${chat.title}</span>
        </a>
    `).join('');
}

function loadConversation(id) {
    const history = JSON.parse(localStorage.getItem('justlaw_chat_history') || '[]');
    const chat = history.find(h => h.id === id);

    if (chat) {
        conversationId = chat.id;
        messages = chat.messages || [];

        // Hide welcome screen
        if (welcomeScreen) {
            welcomeScreen.style.display = 'none';
        }

        // Render messages
        chatMessages.innerHTML = '';
        messages.forEach(msg => {
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${msg.role}`;
            const avatar = msg.role === 'user' ? '👤' : '⚖️';

            messageDiv.innerHTML = `
                <div class="message-avatar">${avatar}</div>
                <div class="message-content">${formatMessage(msg.content)}</div>
            `;
            chatMessages.appendChild(messageDiv);
        });

        showSection('chat');
    }
}

// ============== MOBILE SIDEBAR ==============

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    // Create overlay if not exists
    if (!overlay && sidebar) {
        const newOverlay = document.createElement('div');
        newOverlay.id = 'sidebar-overlay';
        newOverlay.className = 'sidebar-overlay';
        newOverlay.onclick = toggleSidebar;
        document.body.appendChild(newOverlay);

        // Small delay to allow transition
        setTimeout(() => newOverlay.classList.add('active'), 10);
        sidebar.classList.add('active');
    } else if (overlay) {
        // Close
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
        setTimeout(() => overlay.remove(), 300);
    } else {
        // Just open sidebar (fallback)
        sidebar.classList.toggle('active');
    }
}

// Close sidebar on nav click (mobile)
document.addEventListener('DOMContentLoaded', () => {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                const sidebar = document.getElementById('sidebar');
                const overlay = document.getElementById('sidebar-overlay');
                if (sidebar && sidebar.classList.contains('active')) {
                    sidebar.classList.remove('active');
                    if (overlay) {
                        overlay.classList.remove('active');
                        setTimeout(() => overlay.remove(), 300);
                    }
                }
            }
        });
    });
});

// ============== LEGAL MODALS ==============

const legalTexts = {
    privacy: {
        title: 'Gizlilik Politikası',
        content: `<p><strong>Son Güncelleme: 28.12.2024</strong></p>
        <p>JustLaw olarak gizliliğinize önem veriyoruz. Bu politika, kişisel verilerinizin nasıl toplandığını, kullanıldığını ve korunduğunu açıklar.</p>
        <h3>1. Toplanan Veriler</h3>
        <p>Hizmetimizi kullanırken adınız, e-posta adresiniz ve sisteme yüklediğiniz belgelerin içerikleri işlenmektedir. Bu veriler sadece hizmetin sağlanması amacıyla kullanılır.</p>
        <h3>2. Veri Güvenliği</h3>
        <p>Verileriniz endüstri standardı şifreleme yöntemleri ile korunmaktadır. Yüklediğiniz belgeler analiz edildikten sonra sistemlerimizden otomatik olarak silinir veya sadece sizin erişiminize açık şekilde saklanır.</p>
        <h3>3. Üçüncü Taraflar</h3>
        <p>Yasal zorunluluklar haricinde verileriniz üçüncü taraflarla paylaşılmaz. Ödeme işlemleri Shopier aracılığıyla güvenli bir şekilde gerçekleştirilir.</p>
        <p>Detaylı bilgi için destek@justlaw.com adresinden bize ulaşabilirsiniz.</p>`
    },
    terms: {
        title: 'Kullanım Koşulları',
        content: `<p><strong>Son Güncelleme: 28.12.2024</strong></p>
        <p>JustLaw'ı kullanarak aşağıdaki koşulları kabul etmiş sayılırsınız.</p>
        <h3>1. Hizmetin Niteliği</h3>
        <p>JustLaw, yapay zeka destekli bir hukuki asistan hizmetidir. <strong>Sistem tarafından üretilen içerikler hukuki tavsiye niteliği taşımaz.</strong> Hukuki kararlar almadan önce mutlaka bir avukata danışmanız önerilir.</p>
        <h3>2. Sorumluluk Reddi</h3>
        <p>Oluşturulan dilekçeler, sözleşme analizleri ve emsal karar aramaları bilgilendirme amaçlıdır. JustLaw, bu içeriklerin doğruluğu veya güncelliği konusunda garanti vermez ve kullanımından doğacak zararlardan sorumlu tutulamaz.</p>
        <h3>3. Fikri Mülkiyet</h3>
        <p>Uygulamanın tasarımı, logosu ve yazılımı JustLaw'a aittir. İzinsiz kopyalanması yasaktır.</p>`
    },
    kvkk: {
        title: 'KVKK Aydınlatma Metni',
        content: `<p>6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") uyarınca, JustLaw olarak veri sorumlusu sıfatıyla kişisel verilerinizi işlemekteyiz.</p>
        <h3>1. İşlenen Kişisel Veriler</h3>
        <p>Kimlik bilgileri (Ad, Soyad), İletişim bilgileri (E-posta), İşlem güvenliği bilgileri (Log kayıtları).</p>
        <h3>2. İşleme Amaçları</h3>
        <p>Üyelik işlemlerinin gerçekleştirilmesi, hizmetlerin sunulması, yasal yükümlülüklerin yerine getirilmesi.</p>
        <h3>3. Haklarınız</h3>
        <p>KVKK'nın 11. maddesi uyarınca verilerinizin silinmesini, düzeltilmesini veya bilgi talep etme hakkına sahipsiniz.</p>`
    }
};

window.openLegalModal = function (type) {
    const modal = document.getElementById('legal-modal-backdrop');
    const title = document.getElementById('legal-modal-title');
    const content = document.getElementById('legal-modal-content');

    if (legalTexts[type]) {
        title.textContent = legalTexts[type].title;
        content.innerHTML = legalTexts[type].content;
        modal.style.display = 'flex';
    }
}

window.closeLegalModal = function () {
    document.getElementById('legal-modal-backdrop').style.display = 'none';
}

// Close modal on outside click
document.getElementById('legal-modal-backdrop')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('legal-modal-backdrop')) {
        window.closeLegalModal();
    }
});

// ============== ACCOUNT DELETION ==============

window.handleDeleteAccount = async function () {
    if (confirm('DİKKAT: Hesabınızı silmek istediğinize emin misiniz? Bu işlem geri alınamaz ve tüm verileriniz (dilekçeler, kayıtlar) kalıcı olarak silinir.')) {
        const btn = document.querySelector('.delete-account-btn');
        const originalText = btn.innerHTML;
        btn.innerHTML = 'Siliniyor...';
        btn.disabled = true;

        if (typeof window.deleteAccount !== 'function') {
            alert('Hata: deleteAccount fonksiyonu yüklenemedi. Sayfayı yenileyip tekrar deneyin.');
            btn.innerHTML = originalText;
            btn.disabled = false;
            return;
        }

        const result = await window.deleteAccount();

        if (result.success) {
            alert('Hesabınız başarıyla silindi. Ana sayfaya yönlendiriliyorsunuz.');
            window.location.reload();
        } else {
            alert('Hata: ' + result.error);
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }
}
