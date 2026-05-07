export function renderProfile(container) {
    // Clear the container
    container.innerHTML = '';

    // Create logout button outside the profile container
    if (!document.getElementById('logout')) {
        const logoutButton = document.createElement('button');
        logoutButton.id = 'logout';
        logoutButton.className = 'logout-btn';
        logoutButton.textContent = 'Logout';
        document.body.appendChild(logoutButton);

        logoutButton.addEventListener('click', () => {
            localStorage.removeItem('jwt'); // Remove JWT
            window.location.reload(); // Reload page to show login
        });
    }

    // Create profile content
    const profileContent = document.createElement('div');
    profileContent.className = 'profile-container';
    profileContent.innerHTML = `
        <h1>Welcome, <span id="username"></span></h1>
        <h3 id="fullname"></h3>

        <!-- XP and Additional Boxes -->
        <div class="stats-container">
            <div class="stat-box" id="xp-box">
                <h2>XP</h2>
                <p id="xp-count">Loading...</p>
            </div>
            <div class="stat-box" id="box2">
                <h2>Graph</h2>
                <div id="xp-graph"></div> <!-- Graph container -->
            </div>
             <div class="stat-box" id="box5">
                <h2>Skills</h2>
                <div id="skills-chart"></div> <!-- Bar chart container -->
            </div>
            <div class="stat-box" id="box4">
                <h2>Audit Ratio</h2>
                <p id="audit-ratio">Fetching...</p>
            </div>
        </div>
    `;

    // Append profile content to the container
    container.appendChild(profileContent);

    // Fetch and display user data
    fetchUserData();
}

async function fetchUserData() {
    const token = localStorage.getItem('jwt');
    if (!token) {
        window.location.reload(); // Redirect to login if no token is found
        return;
    }

    const query = {
        query: `{
            user {
                firstName
                lastName
                auditRatio
                transactions(
                    where: { type: { _like: "skill_%" } }
                    order_by: { amount: desc }
                ) {
                    type
                    amount
                }
            }
            transaction(
                where: { _and: [{ type: { _eq: "xp" } }, { eventId: { _eq: 41 } }] }
            ) {
                amount
                createdAt
                object { name }
            }
        }`
    };

    try {
        const response = await fetch('https://learn.zone01oujda.ma/api/graphql-engine/v1/graphql', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(query)
        });

        const data = await response.json();
        if (!data || !data.data) throw new Error('Failed to fetch user data');

        // Display user details
        const user = data.data.user[0]; // Assuming there's only one user
        if (user) {
            document.getElementById('username').textContent = user.firstName;
            document.getElementById('fullname').textContent = `${user.firstName} ${user.lastName}`;
            document.getElementById('audit-ratio').textContent = user.auditRatio ? user.auditRatio.toFixed(2) : "N/A";
        }

        // Render XP and Level
        renderXp(data);
        renderXPGraph(data.data.transaction); // Pass XP transactions to graph
        renderSkillsChart(user.transactions); // Pass skill transactions to bar chart

    } catch (error) {
        console.error(error);
        alert('Error fetching data');
    }
}

function renderXp(data) {
    let xp = data.data.transaction.reduce((acc, transaction) => acc + transaction.amount, 0);
    xp = Math.ceil(xp / 1000); // Convert XP to KB
    document.getElementById('xp-count').textContent = `${xp} KB`;
}

function renderXPGraph(transactions) {
    if (!transactions.length) return;

    let cumulativeXP = 0;
    const sortedData = transactions.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const dataPoints = sortedData.map(transaction => {
        cumulativeXP += transaction.amount;
        return { date: new Date(transaction.createdAt), xp: cumulativeXP };
    });

    const width = 400, height = 200;
    const startDate = dataPoints[0].date, endDate = dataPoints[dataPoints.length - 1].date;
    const maxXP = dataPoints[dataPoints.length - 1].xp;

    const scaleX = date => ((date - startDate) / (endDate - startDate)) * width;
    const scaleY = xp => height - (xp / maxXP) * height;

    const pathData = dataPoints.map((point, index) => 
        `${index === 0 ? 'M' : 'L'} ${scaleX(point.date)} ${scaleY(point.xp)}`
    ).join(' ');

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathData);
    path.setAttribute('stroke', 'black');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke-width', '2');
    svg.appendChild(path);

    document.getElementById('xp-graph').innerHTML = '';
    document.getElementById('xp-graph').appendChild(svg);
}
function renderSkillsChart(transactions) {
    if (!transactions.length) return;

    const COLORS = ['#534AB7','#1D9E75','#D85A30','#185FA5','#D4537E','#BA7517'];

    // Fix: slice(0, 6) — don't skip the top skill
    const topSkills = [...transactions]
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 6);

    const labels = topSkills.map(t => t.type.replace('skill_', '').toUpperCase());
    const data   = topSkills.map(t => t.amount);

    // Legend
    const container = document.getElementById('skills-chart');
    container.innerHTML = '';

    const legendEl = document.createElement('div');
    legendEl.style.cssText = 'display:flex;flex-wrap:wrap;gap:12px;margin-bottom:12px;font-size:12px;';
    labels.forEach((lbl, i) => {
        legendEl.innerHTML += `
            <span style="display:flex;align-items:center;gap:5px;">
                <span style="width:10px;height:10px;border-radius:2px;background:${COLORS[i]};display:inline-block;"></span>
                ${lbl}
            </span>`;
    });
    container.appendChild(legendEl);

    // Canvas
    const canvasWrap = document.createElement('div');
    canvasWrap.style.cssText = 'position:relative;width:100%;height:260px;';
    const canvas = document.createElement('canvas');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Bar chart of top skills by XP');
    canvasWrap.appendChild(canvas);
    container.appendChild(canvasWrap);

    // Tooltip element
    const tt = document.createElement('div');
    tt.style.cssText = 'position:fixed;pointer-events:none;background:#1a1a1a;color:#fff;' +
        'padding:6px 10px;border-radius:6px;font-size:12px;opacity:0;z-index:999;transition:opacity .1s;';
    document.body.appendChild(tt);

    new Chart(canvas, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: COLORS,
                borderRadius: 4,
                borderSkipped: false,
                hoverBackgroundColor: COLORS.map(c => c + 'CC')
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: false,
                    external({ chart, tooltip }) {
                        if (tooltip.opacity === 0) { tt.style.opacity = 0; return; }
                        const idx = tooltip.dataPoints?.[0]?.dataIndex ?? 0;
                        const skill = topSkills[idx];
                        const name  = skill.type.replace('skill_', '').toUpperCase();
                        tt.innerHTML = `<strong style="display:block;font-size:13px;">${name}</strong>
                                        <span style="opacity:.7;">${skill.amount}% XP</span>`;
                        const pos = chart.canvas.getBoundingClientRect();
                        tt.style.opacity = '1';
                        tt.style.left = (pos.left + tooltip.caretX + 12) + 'px';
                        tt.style.top  = (pos.top  + tooltip.caretY - 10) + 'px';
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { font: { size: 12 } }
                },
                y: {
                    min: 0,
                    grid: { color: 'rgba(0,0,0,0.07)' },
                    ticks: {
                        callback: v => v + '%',
                        stepSize: 20
                    },
                    border: { display: false }
                }
            }
        }
    });
}


