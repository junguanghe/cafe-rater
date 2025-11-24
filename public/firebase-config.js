// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyC5vv_8BFj2T7Uk-BITZveiHoGAeDqC_sI",
    authDomain: "ace-botany-478821-h7.firebaseapp.com",
    projectId: "ace-botany-478821-h7",
    storageBucket: "ace-botany-478821-h7.firebasestorage.app",
    messagingSenderId: "220521910668",
    appId: "1:220521910668:web:5459ae617e4b4271a946a9",
    measurementId: "G-Y06LKG6MHP"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
