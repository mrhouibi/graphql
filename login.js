import { createElementWithClass, createInputBox, cleanUp } from './utils/utils.js';
import { renderProfile } from './profile.js';

export function renderLogin(container) {
    container.innerHTML = ''; // Clear the container

    const section = createElementWithClass('section', 'sectionLogin');
    const wrapperDiv = createElementWithClass('div', 'wrapper');
    const formBoxDiv = createElementWithClass('div', 'form-box login');

    const heading = createElementWithClass('h2', '', 'Login');
    formBoxDiv.appendChild(heading);

    const usernameBox = createInputBox('text', 'username', 'Username or Email');
    formBoxDiv.appendChild(usernameBox);

    const passwordBox = createInputBox('password', 'password', 'Password');
    formBoxDiv.appendChild(passwordBox);

    const button = createElementWithClass('button', 'btn', 'Login');
    button.type = 'submit';
    addEventButton(button, section, container);
    formBoxDiv.appendChild(button);

    wrapperDiv.appendChild(formBoxDiv);
    section.appendChild(wrapperDiv);
    container.appendChild(section);
}

function addEventButton(button, section, container) {
    button.addEventListener('click', async () => {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        const response = await fetch('https://learn.zone01oujda.ma/api/auth/signin', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${btoa(`${username}:${password}`)}`,
                'Content-Type': 'application/json',
            },
        });

        if (response.ok) {
            const data = await response.json();
            localStorage.setItem('jwt', data); // Store the JWT
            renderProfile(container); // Render the profile page
            cleanUp(section); // Clean up the login section
        } else {
            const errorData = await response.json();
          const oldError = document.querySelector('.errorMsg');

if (oldError) {
    oldError.remove();
}

const errorMsg = createElementWithClass(
    'div',
    'errorMsg',
    errorData.error || 'Invalid credentials'
);

document.body.appendChild(errorMsg);

setTimeout(() => {
    errorMsg.remove();
}, 3000);
        }
    });
}
