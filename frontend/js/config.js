/**
 * JustLaw Application Configuration
 * Backend URL Management
 */

const CONFIG = {
    // API Base URL (Automatically points to Cloud Functions via Firebase Hosting Rewrites)
    API_BASE_URL: window.location.origin,

    // Frontend URL
    FRONTEND_URL: window.location.origin
};

// Expose API_BASE_URL globally for legacy scripts
window.API_BASE_URL = CONFIG.API_BASE_URL;
window.CONFIG = CONFIG;
