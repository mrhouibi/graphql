import { renderLogin } from '../login.js';
import { renderProfile } from '../profile.js';

function main() {
    const appContainer = document.getElementById('app');
    const token = localStorage.getItem('jwt'); 

    if (!token) {
        renderLogin(appContainer);
    } else {
        renderProfile(appContainer);
    }
}

main();