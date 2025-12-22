/**
 * JustLaw - Main Application JavaScript
 * Türk Hukuku AI Asistanı
 */

// Configuration
const API_BASE_URL = 'http://localhost:8000';
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

    // Load Firebase auth
    await initAuth();

    console.log('JustLaw initialized successfully');
});

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

async function installPWA() {
    if (!deferredPrompt) {
        // If no prompt, show manual install guide
        window.location.href = 'install-guide.html';
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
                currentUser = user;
                userData = await authModule.getUserData(user.uid);
                console.log('[App] User logged in:', user.email);
                updateUserUI(true);
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
    }
}

async function handleLogout() {
    if (!authModule) return;

    if (confirm('Çıkış yapmak istediğinize emin misiniz?')) {
        const result = await authModule.logoutUser();
        if (result.success) {
            window.location.href = 'landing.html';
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
        const response = await fetch(`${API_BASE_URL}/api/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: message,
                conversation_id: conversationId,
                user_id: 'anonymous' // TODO: Firebase Auth
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
        addMessage(data.response, 'assistant', data.sources || []);
        conversationId = data.conversation_id;

        // Save to history
        saveChatHistory();

    } catch (error) {
        console.error('Error:', error);
        loadingDiv.remove();
        addMessage('Backend sunucusuna bağlanılamadı. Lütfen backend sunucusunun çalıştığından emin olun (port 8000).', 'assistant');
    } finally {
        isLoading = false;
        sendBtn.disabled = false;
    }
}

function addMessage(content, role, sources = []) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;

    const avatar = role === 'user' ? '👤' : '⚖️';

    let sourcesHtml = '';
    if (sources && sources.length > 0) {
        sourcesHtml = `
            <div class="message-sources">
                <strong>Kaynaklar:</strong><br>
                ${sources.map(s => `• ${s.metadata?.baslik || s.metadata?.source || 'Kaynak'}`).join('<br>')}
            </div>
        `;
    }

    messageDiv.innerHTML = `
        <div class="message-avatar">${avatar}</div>
        <div class="message-content">
            ${formatMessage(content)}
            ${sourcesHtml}
        </div>
    `;

    // Store message
    messages.push({ content, role, sources });

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
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

// ============== DILEKCE ==============

let selectedDilekceType = null;

const dilekceTypeNames = {
    // Hukuk Davaları
    'alacak-davasi': 'Alacak Davası Dilekçesi',
    'bosanma': 'Boşanma Davası Dilekçesi',
    'velayet': 'Velayet Davası Dilekçesi',
    'nafaka': 'Nafaka Davası Dilekçesi',
    'miras': 'Miras Davası Dilekçesi',
    // İş Hukuku
    'kidem-tazminati': 'Kıdem Tazminatı Dilekçesi',
    'ise-iade': 'İşe İade Davası Dilekçesi',
    'fazla-mesai': 'Fazla Mesai Alacağı Dilekçesi',
    'is-kazasi': 'İş Kazası Tazminat Dilekçesi',
    // İcra ve İflas
    'icra-itiraz': 'İcra İtiraz Dilekçesi',
    'itirazin-iptali': 'İtirazın İptali Dilekçesi',
    'menfi-tespit': 'Menfi Tespit Dilekçesi',
    'istirdat': 'İstirdat Davası Dilekçesi',
    // Kira ve Gayrimenkul
    'tahliye': 'Tahliye Davası Dilekçesi',
    'kira-tespit': 'Kira Tespit Dilekçesi',
    'kira-alacagi': 'Kira Alacağı Dilekçesi',
    'elatmanin-onlenmesi': 'El Atmanın Önlenmesi Dilekçesi',
    // Tüketici ve Ticaret
    'tuketici': 'Tüketici Davası Dilekçesi',
    'fatura-itiraz': 'Fatura İtiraz Dilekçesi',
    'ticari-alacak': 'Ticari Alacak Dilekçesi',
    // İdari Davalar
    'iptal-davasi': 'İptal Davası Dilekçesi',
    'tam-yargi': 'Tam Yargı Davası Dilekçesi',
    'vergi-itiraz': 'Vergi İtiraz Dilekçesi'
};

const dilekceKonular = {
    // Hukuk Davaları
    'alacak-davasi': 'Alacak ve tazminat talebi',
    'bosanma': 'Evlilik birliğinin sona erdirilmesi',
    'velayet': 'Çocuk velayetinin belirlenmesi',
    'nafaka': 'Nafaka artırım/azaltım talebi',
    'miras': 'Miras taksimi ve tenkis davası',
    // İş Hukuku
    'kidem-tazminati': 'Kıdem ve ihbar tazminatı alacağı',
    'ise-iade': 'Haksız feshin iptali ve işe iade',
    'fazla-mesai': 'Fazla mesai ücreti alacağı',
    'is-kazasi': 'İş kazası nedeniyle maddi ve manevi tazminat',
    // İcra ve İflas
    'icra-itiraz': 'Ödeme emrine itiraz',
    'itirazin-iptali': 'Borçlu itirazının iptali ve takibin devamı',
    'menfi-tespit': 'Borçlu olmadığının tespiti',
    'istirdat': 'Fazla ödenen paranın iadesi',
    // Kira ve Gayrimenkul
    'tahliye': 'Kiralananın tahliyesi',
    'kira-tespit': 'Kira bedelinin tespiti',
    'kira-alacagi': 'Ödenmeyen kira bedelinin tahsili',
    'elatmanin-onlenmesi': 'Müdahalenin men\'i ve eski hale iade',
    // Tüketici ve Ticaret
    'tuketici': 'Ayıplı mal/hizmet nedeniyle tazminat',
    'fatura-itiraz': 'Haksız faturaya itiraz',
    'ticari-alacak': 'Ticari alacağın tahsili',
    // İdari Davalar
    'iptal-davasi': 'İdari işlemin iptali',
    'tam-yargi': 'İdarenin verdiği zararın tazmini',
    'vergi-itiraz': 'Vergi cezasının iptali'
};

function selectDilekce(type) {
    selectedDilekceType = type;

    // Hide type selection, show form
    document.getElementById('dilekce-types').style.display = 'none';
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
    document.getElementById('dilekce-form').style.display = 'none';
    selectedDilekceType = null;
}

async function generateDilekcePDF() {
    const btn = document.getElementById('generate-pdf-btn');
    const originalText = btn.innerHTML;

    // Validate form
    const mahkeme = document.getElementById('dilekce-mahkeme').value.trim();
    const davaciAdi = document.getElementById('dilekce-davaci-adi').value.trim();
    const davaciTc = document.getElementById('dilekce-davaci-tc').value.trim();
    const davaciAdres = document.getElementById('dilekce-davaci-adres').value.trim();
    const davaliAdi = document.getElementById('dilekce-davali-adi').value.trim();
    const davaliAdres = document.getElementById('dilekce-davali-adres').value.trim();
    const konu = document.getElementById('dilekce-konu').value.trim();
    const aciklamalar = document.getElementById('dilekce-aciklamalar').value.trim();
    const talepler = document.getElementById('dilekce-talepler').value.trim();

    if (!davaciAdi || !aciklamalar) {
        alert('Lütfen en az davacı adı ve açıklamaları doldurun.');
        return;
    }

    // TC Kimlik No validation
    if (davaciTc && (davaciTc.length !== 11 || !/^\d{11}$/.test(davaciTc))) {
        alert('TC Kimlik Numarası tam olarak 11 haneli rakam olmalıdır.');
        return;
    }

    btn.innerHTML = 'PDF Oluşturuluyor...';
    btn.disabled = true;

    try {
        const response = await fetch(`${API_BASE_URL}/api/dilekce/pdf`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                mahkeme: mahkeme || 'ASLİYE HUKUK MAHKEMESİ HAKİMLİĞİNE',
                davaci_adi: davaciAdi,
                davaci_tc: davaciTc || '...',
                davaci_adres: davaciAdres || '...',
                davali_adi: davaliAdi || '...',
                davali_adres: davaliAdres || '...',
                konu: konu || dilekceKonular[selectedDilekceType] || 'Dava',
                aciklamalar: aciklamalar,
                talepler: talepler || 'Yukarıda açıklanan nedenlerle davanın kabulünü talep ederim.',
                dilekce_turu: selectedDilekceType || 'genel'
            })
        });

        if (!response.ok) {
            throw new Error('PDF oluşturulamadı');
        }

        // Download PDF
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;

        // Create meaningful filename from type name
        const typeName = dilekceTypeNames[selectedDilekceType] || 'Dilekce';
        const cleanFileName = typeName
            .replace(/\s+/g, '_')
            .replace(/[ğ]/g, 'g').replace(/[Ğ]/g, 'G')
            .replace(/[ü]/g, 'u').replace(/[Ü]/g, 'U')
            .replace(/[ş]/g, 's').replace(/[Ş]/g, 'S')
            .replace(/[ı]/g, 'i').replace(/[İ]/g, 'I')
            .replace(/[ö]/g, 'o').replace(/[Ö]/g, 'O')
            .replace(/[ç]/g, 'c').replace(/[Ç]/g, 'C')
            .replace(/[^a-zA-Z0-9_]/g, '');

        a.download = `${cleanFileName}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        alert('✅ Dilekçe PDF olarak indirildi!');

    } catch (error) {
        console.error('Error:', error);
        alert('PDF oluşturulurken hata oluştu. Lütfen tekrar deneyin.');
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

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (file) {
        handleFile(file);
    }
}

async function handleFile(file) {
    const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];

    if (!validTypes.includes(file.type) && !file.name.endsWith('.txt')) {
        alert('Lütfen PDF, DOCX veya TXT dosyası yükleyin.');
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
            `${API_BASE_URL}/api/legal/search?query=${encodeURIComponent(query)}&sources=${sources.join(',')}&limit=10`
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
        const response = await fetch(`${API_BASE_URL}/api/yargitay/search?query=${encodeURIComponent(query)}&limit=10`);
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
