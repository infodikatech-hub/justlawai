/**
 * JustLaw Application Configuration
 * Backend URL Management
 */

const CONFIG = {
    // Development URL (Localhost)
    API_BASE_URL: 'http://127.0.0.1:8000',

    // Production URL (Render Backend)
    API_BASE_URL: 'https://justlaw-api.onrender.com', // Active for production

    // Firebase Hosting URL (Frontend)
    FRONTEND_URL: 'http://localhost:8000' // For local dev
};

// Expose API_BASE_URL globally for legacy scripts
window.API_BASE_URL = CONFIG.API_BASE_URL;
window.CONFIG = CONFIG;

window.CONFIG = CONFIG;
