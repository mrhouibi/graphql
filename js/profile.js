export function renderProfile(container) {
    
    container.innerHTML = '';

    if (!document.getElementById('logout')) {
        const logoutButton = document.createElement('button');
        logoutButton.id = 'logout';
        logoutButton.className = 'logout-btn';
        logoutButton.textContent = 'Logout';
        document.body.appendChild(logoutButton);
        logoutButton.addEventListener('click', () => {
            localStorage.removeItem('jwt'); 
            window.location.reload(); 
        });
    }

    const profileContent = document.createElement('div');
    profileContent.className = 'profile-container';
    profileContent.innerHTML = `
        <h1>Welcome, <span id="username"></span></h1>
        <h3 id="fullname"></h3>
        <div class="stats-container">
            <div class="stat-box" id="xp-box">
                <h2>XP</h2>
                <p id="xp-count">Loading...</p>
            </div>
            <div class="stat-box" id="box4">
             <h2>Audit Ratio</h2>
         <p id="audit-ratio">Fetching...</p>
            <div id="audit-chart"></div>
                </div>
           
            </div>
            <div class="stat-box" id="box5">
                <h2>Skills</h2>
                <div id="skills-chart"></div>
            </div>
           
        </div>
    `;

    container.appendChild(profileContent);
    fetchUserData();
}

async function fetchUserData() {
    const token = localStorage.getItem('jwt');
    if (!token) {
        window.location.reload();
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
                order_by: [{ type: asc }, { amount: desc }]
                distinct_on: type
            ) {
                type
                amount
            }
            audits_aggregate(where: {closureType: {_eq: succeeded}}) {
                aggregate { count }
            }
            failed_audits: audits_aggregate(where: {closureType: {_eq: failed}}) {
                aggregate { count }
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

        const user = data.data.user[0];
        if (user) {
            document.getElementById('username').textContent = user.firstName;
            document.getElementById('fullname').textContent = `${user.firstName} ${user.lastName}`;
            document.getElementById('audit-ratio').textContent = user.auditRatio ? user.auditRatio.toFixed(2) : "N/A";
        }

        renderXp(data);
        renderSkillsChart(user.transactions);
        renderAuditChart(user);

    } catch (error) {
        console.error(error);
        alert('Error fetching data');
    }
}

function renderXp(data) {
    let xp = data.data.transaction.reduce((acc, t) => acc + t.amount, 0);
    xp = Math.ceil(xp / 1000);
    document.getElementById('xp-count').textContent = `${xp} KB`;
}


function renderSkillsChart(transactions) {
    if (!transactions.length) return;

    const COLORS = ['#534AB7','#1D9E75','#D85A30','#185FA5','#D4537E','#BA7517'];

    // Already distinct from query — just sort and take top 6
    const topSkills = [...transactions]
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 6);

    const labels = topSkills.map(t => t.type.replace('skill_', '').toUpperCase());
    const data   = topSkills.map(t => t.amount); // amount IS already the percentage

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

    const canvasWrap = document.createElement('div');
    canvasWrap.style.cssText = 'position:relative;width:100%;height:260px;';
    const canvas = document.createElement('canvas');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Bar chart of top skills by XP');
    canvasWrap.appendChild(canvas);
    container.appendChild(canvasWrap);

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
                        const idx   = tooltip.dataPoints?.[0]?.dataIndex ?? 0;
                        const skill = topSkills[idx];
                        const name  = skill.type.replace('skill_', '').toUpperCase();
                        tt.innerHTML = `<strong style="display:block;font-size:13px;">${name}</strong>
                                        <span style="opacity:.7;">${skill.amount}%</span>`;
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
                    max: 100,
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
function renderAuditChart(user) {
    const succeeded = user.audits_aggregate.aggregate.count;
    const failed    = user.failed_audits.aggregate.count;
    const total     = succeeded + failed;

    const succeededPct = Math.round((succeeded / total) * 100);
    const failedPct    = 100 - succeededPct;

    const container = document.getElementById('audit-chart');
    container.innerHTML = '';

    const tt = document.createElement('div');
    tt.style.cssText = 'position:fixed;pointer-events:none;background:#1a1a1a;color:#fff;' +
        'padding:6px 10px;border-radius:6px;font-size:12px;opacity:0;z-index:999;transition:opacity .1s;';
    document.body.appendChild(tt);

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'max-width:200px;max-height:200px;margin:0 auto;display:block;';
    container.appendChild(canvas);

    const legendEl = document.createElement('div');
    legendEl.style.cssText = 'display:flex;justify-content:center;gap:16px;margin-top:10px;font-size:12px;';
    legendEl.innerHTML = `
        <span style="display:flex;align-items:center;gap:5px;">
            <span style="width:10px;height:10px;border-radius:2px;background:#1D9E75;display:inline-block;"></span>
            Passed (${succeeded})
        </span>
        <span style="display:flex;align-items:center;gap:5px;">
            <span style="width:10px;height:10px;border-radius:2px;background:#D85A30;display:inline-block;"></span>
            Failed (${failed})
        </span>
    `;
    container.appendChild(legendEl);

    new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: ['Passed', 'Failed'],
            datasets: [{
                data: [succeededPct, failedPct],
                backgroundColor: ['#1D9E75', '#D85A30'],
                borderWidth: 0,
                hoverBackgroundColor: ['#1D9E75CC', '#D85A30CC']
            }]
        },
        options: {
            responsive: true,
            cutout: '70%',
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: false,
                    external({ chart, tooltip }) {
                        if (tooltip.opacity === 0) { tt.style.opacity = 0; return; }
                        const idx  = tooltip.dataPoints?.[0]?.dataIndex ?? 0;
                        const label = idx === 0 ? `Passed: ${succeeded}` : `Failed: ${failed}`;
                        tt.innerHTML = `<strong>${label}</strong><br><span style="opacity:.7;">${idx === 0 ? succeededPct : failedPct}%</span>`;
                        const pos = chart.canvas.getBoundingClientRect();
                        tt.style.opacity = '1';
                        tt.style.left = (pos.left + tooltip.caretX + 12) + 'px';
                        tt.style.top  = (pos.top  + tooltip.caretY - 10) + 'px';
                    }
                }
            }
        }
    });
}