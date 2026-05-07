import { renderLogin } from '../login.js';
import { renderProfile } from '../profile.js';

function main() {
    const appContainer = document.getElementById('app');
    const token = localStorage.getItem('jwt'); // Ensure this matches the key used in login.js

    if (!token) {
        // Render login section if no token is found
        renderLogin(appContainer);
    } else {
        // Render profile section if token exists
        renderProfile(appContainer);
    }
}

main();