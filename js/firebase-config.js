// Firebase Modular SDK Configuration

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyAlsmw3Z4dfKwEYddNUZdzvG-kkAUCKKWc',
  authDomain: 'vocabulary-f8603.firebaseapp.com',
  projectId: 'vocabulary-f8603',
  storageBucket: 'vocabulary-f8603.firebasestorage.app',
  messagingSenderId: '231263974978',
  appId: '1:231263974978:web:d42dd8215b041641be1fdb',
  measurementId: 'G-FP2MXWXXS9',
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
