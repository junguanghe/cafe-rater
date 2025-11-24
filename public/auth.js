import { auth } from './firebase-config.js';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Current logged in user
let currentUser = null;

// Listen for auth state changes
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    updateUI();
});

// Update UI display
function updateUI() {
    const authSection = document.getElementById('authSection');
    const appContent = document.getElementById('appContent');

    if (currentUser) {
        // Logged in
        authSection.style.display = 'none';
        appContent.style.display = 'block';
        document.getElementById('userEmail').textContent = currentUser.email;
    } else {
        // Not logged in
        authSection.style.display = 'block';
        appContent.style.display = 'none';
    }
}

// Sign up
window.signup = async function () {
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;

    try {
        await createUserWithEmailAndPassword(auth, email, password);
        alert('Sign up successful!');
        document.getElementById('signupEmail').value = '';
        document.getElementById('signupPassword').value = '';
    } catch (error) {
        alert('Sign up failed: ' + error.message);
    }
};

// Login
window.login = async function () {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        await signInWithEmailAndPassword(auth, email, password);
        document.getElementById('loginEmail').value = '';
        document.getElementById('loginPassword').value = '';
    } catch (error) {
        alert('Login failed: ' + error.message);
    }
};

// Logout
window.logout = async function () {
    try {
        await signOut(auth);
        alert('Logged out successfully');
    } catch (error) {
        alert('Logout failed: ' + error.message);
    }
};

// Get current user's ID Token (for backend verification)
export async function getUserToken() {
    if (currentUser) {
        return await currentUser.getIdToken();
    }
    return null;
}

export { currentUser };
