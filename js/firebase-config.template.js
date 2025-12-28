// Firebase Modular SDK Configuration (TEMPLATE)
// 1. Copy this file to 'firebase-config.js'
// 2. Fill in your Firebase project details below
// 3. Ensure 'firebase-config.js' is in your .gitignore

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'YOUR_API_KEY_HERE',
  authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT_ID.firebasestorage.app',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID',
  measurementId: 'G-MEASUREMENT_ID',
};

let app;
let db;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  console.log('Firebase (Modular) initialized successfully');
} catch (error) {
  console.error('Firebase init failed:', error);
}

export { app, db };
