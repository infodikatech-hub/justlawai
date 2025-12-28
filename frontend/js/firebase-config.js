/**
 * Firebase Configuration for JustLaw
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDWQpuRGsR2OXAGxC20hgwCAiueijXTPr0",
    authDomain: "justlaw.com.tr",
    projectId: "justlawai",
    storageBucket: "justlawai.firebasestorage.app",
    messagingSenderId: "792593302800",
    appId: "1:792593302800:web:874fc7e8b2c433453b5195"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
