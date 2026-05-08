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
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(query)
        });

        const data = await response.json();
        if (!data || !data.data) throw new Error('Failed to fetch user data');

        const user = data.data.user[0];
        if (user) {
            document.getElementById('username').textContent = user.firstName;
            document.getElementById('fullname').textContent = `${user.firstName} ${user.lastName}`;
            document.getElementById('audit-ratio').textContent =
                user.auditRatio ? user.auditRatio.toFixed(2) : 'N/A';
        }

        renderXp(data);
        renderSkillsChart(user.transactions);
        renderAuditChart(user);

    } catch (error) {
        console.error(error);
        alert('Error fetching data');
    }
}

// ─── XP ───────────────────────────────────────────────────────────────────────
function renderXp(data) {
    let xp = data.data.transaction.reduce((acc, t) => acc + t.amount, 0);
    xp = Math.ceil(xp / 1000);
    document.getElementById('xp-count').textContent = `${xp} KB`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Create an SVG element with the given attributes
 */
function svgEl(tag, attrs = {}) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
}

/**
 * Build a floating tooltip div and return show/hide helpers
 */
function makeTooltip() {
    const tt = document.createElement('div');
    tt.style.cssText =
        'position:fixed;pointer-events:none;background:#1a1a1a;color:#fff;' +
        'padding:6px 10px;border-radius:6px;font-size:12px;opacity:0;' +
        'z-index:999;transition:opacity .15s;white-space:nowrap;';
    document.body.appendChild(tt);

    function show(html, x, y) {
        tt.innerHTML = html;
        tt.style.opacity = '1';
        tt.style.left = x + 12 + 'px';
        tt.style.top  = y - 10 + 'px';
    }
    function hide() { tt.style.opacity = '0'; }

    return { tt, show, hide };
}

// ─── Skills Bar Chart (SVG) ───────────────────────────────────────────────────
function renderSkillsChart(transactions) {
    if (!transactions || !transactions.length) return;

    const COLORS = ['#534AB7', '#1D9E75', '#D85A30', '#185FA5', '#D4537E', '#BA7517'];

    const topSkills = [...transactions]
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 6);

    const labels = topSkills.map(t => t.type.replace('skill_', '').toUpperCase());
    const values = topSkills.map(t => t.amount); // already a percentage 0-100

    const container = document.getElementById('skills-chart');
    container.innerHTML = '';

    // ── Legend ──
    const legend = document.createElement('div');
    legend.style.cssText = 'display:flex;flex-wrap:wrap;gap:12px;margin-bottom:12px;font-size:12px;';
    labels.forEach((lbl, i) => {
        legend.innerHTML += `
            <span style="display:flex;align-items:center;gap:5px;">
                <span style="width:10px;height:10px;border-radius:2px;
                             background:${COLORS[i]};display:inline-block;"></span>
                ${lbl}
            </span>`;
    });
    container.appendChild(legend);

    // ── SVG dimensions ──
    const W = 400, H = 240;
    const marginLeft = 36, marginRight = 10, marginTop = 10, marginBottom = 30;
    const chartW = W - marginLeft - marginRight;
    const chartH = H - marginTop - marginBottom;

    const svg = svgEl('svg', {
        viewBox: `0 0 ${W} ${H}`,
        width: '100%',
        height: H,
        role: 'img',
        'aria-label': 'Bar chart of top skills'
    });

    const { show, hide } = makeTooltip();

    // ── Y gridlines & labels (0 20 40 60 80 100) ──
    for (let v = 0; v <= 100; v += 20) {
        const y = marginTop + chartH - (v / 100) * chartH;

        const line = svgEl('line', {
            x1: marginLeft, y1: y,
            x2: marginLeft + chartW, y2: y,
            stroke: 'rgba(0,0,0,0.08)', 'stroke-width': 1
        });
        svg.appendChild(line);

        const txt = svgEl('text', {
            x: marginLeft - 6, y: y + 4,
            'text-anchor': 'end',
            fill: '#666', 'font-size': '10'
        });
        txt.textContent = v + '%';
        svg.appendChild(txt);
    }

    // ── Bars ──
    const barGroupW = chartW / topSkills.length;
    const barW      = barGroupW * 0.55;

    topSkills.forEach((skill, i) => {
        const barH  = (skill.amount / 100) * chartH;
        const x     = marginLeft + i * barGroupW + (barGroupW - barW) / 2;
        const y     = marginTop + chartH - barH;

        // bar rect
        const rect = svgEl('rect', {
            x, y, width: barW, height: barH,
            fill: COLORS[i], rx: 4, ry: 4,
            style: 'cursor:pointer;transition:opacity .15s;'
        });

        rect.addEventListener('mouseenter', e => {
            rect.setAttribute('opacity', '0.8');
            show(
                `<strong style="display:block;font-size:13px;">${labels[i]}</strong>
                 <span style="opacity:.7;">${skill.amount}%</span>`,
                e.clientX, e.clientY
            );
        });
        rect.addEventListener('mousemove', e => show(
            `<strong style="display:block;font-size:13px;">${labels[i]}</strong>
             <span style="opacity:.7;">${skill.amount}%</span>`,
            e.clientX, e.clientY
        ));
        rect.addEventListener('mouseleave', () => {
            rect.setAttribute('opacity', '1');
            hide();
        });

        svg.appendChild(rect);

        // X-axis label
        const lbl = svgEl('text', {
            x: x + barW / 2,
            y: marginTop + chartH + 18,
            'text-anchor': 'middle',
            fill: '#444', 'font-size': '10'
        });
        lbl.textContent = labels[i];
        svg.appendChild(lbl);
    });

    container.appendChild(svg);
}

// ─── Audit Doughnut Chart (SVG) ───────────────────────────────────────────────
function renderAuditChart(user) {
    const succeeded = user.audits_aggregate.aggregate.count;
    const failed    = user.failed_audits.aggregate.count;
    const total     = succeeded + failed || 1; // avoid /0

    const succeededPct = Math.round((succeeded / total) * 100);
    const failedPct    = 100 - succeededPct;

    const container = document.getElementById('audit-chart');
    container.innerHTML = '';

    // ── SVG setup ──
    const SIZE   = 200;
    const cx     = SIZE / 2;
    const cy     = SIZE / 2;
    const R      = 80;   // outer radius
    const r      = 54;   // inner radius (cutout)

    const svg = svgEl('svg', {
        viewBox: `0 0 ${SIZE} ${SIZE}`,
        width: SIZE, height: SIZE,
        style: 'display:block;margin:0 auto;',
        role: 'img',
        'aria-label': 'Audit pass/fail doughnut chart'
    });

    const { show, hide } = makeTooltip();

    // Helper: polar → cartesian
    function polar(angle, radius) {
        return {
            x: cx + radius * Math.cos(angle),
            y: cy + radius * Math.sin(angle)
        };
    }

    // Helper: build a doughnut slice path
    function slicePath(startAngle, endAngle) {
        const large = endAngle - startAngle > Math.PI ? 1 : 0;
        const o1 = polar(startAngle, R);
        const o2 = polar(endAngle,   R);
        const i1 = polar(endAngle,   r);
        const i2 = polar(startAngle, r);
        return [
            `M ${o1.x} ${o1.y}`,
            `A ${R} ${R} 0 ${large} 1 ${o2.x} ${o2.y}`,
            `L ${i1.x} ${i1.y}`,
            `A ${r} ${r} 0 ${large} 0 ${i2.x} ${i2.y}`,
            'Z'
        ].join(' ');
    }

    const segments = [
        { pct: succeededPct, count: succeeded, label: 'Passed', color: '#1D9E75' },
        { pct: failedPct,    count: failed,    label: 'Failed',  color: '#D85A30' }
    ];

    const startOffset = -Math.PI / 2; // start from 12 o'clock
    let currentAngle  = startOffset;

    segments.forEach(seg => {
        if (seg.pct === 0) return;

        const sweep    = (seg.pct / 100) * 2 * Math.PI;
        const endAngle = currentAngle + sweep;

        const path = svgEl('path', {
            d: slicePath(currentAngle, endAngle),
            fill: seg.color,
            style: 'cursor:pointer;transition:opacity .15s;'
        });

        path.addEventListener('mouseenter', e => {
            path.setAttribute('opacity', '0.8');
            show(
                `<strong>${seg.label}: ${seg.count}</strong><br>
                 <span style="opacity:.7;">${seg.pct}%</span>`,
                e.clientX, e.clientY
            );
        });
        path.addEventListener('mousemove', e => show(
            `<strong>${seg.label}: ${seg.count}</strong><br>
             <span style="opacity:.7;">${seg.pct}%</span>`,
            e.clientX, e.clientY
        ));
        path.addEventListener('mouseleave', () => {
            path.setAttribute('opacity', '1');
            hide();
        });

        svg.appendChild(path);
        currentAngle = endAngle;
    });

    // Centre label
    const centerTxt = svgEl('text', {
        x: cx, y: cy + 5,
        'text-anchor': 'middle',
        fill: '#333', 'font-size': '14', 'font-weight': 'bold'
    });
    centerTxt.textContent = `${succeededPct}%`;
    svg.appendChild(centerTxt);

    const centerSub = svgEl('text', {
        x: cx, y: cy + 20,
        'text-anchor': 'middle',
        fill: '#888', 'font-size': '10'
    });
    centerSub.textContent = 'passed';
    svg.appendChild(centerSub);

    container.appendChild(svg);

    // ── Legend ──
    const legend = document.createElement('div');
    legend.style.cssText =
        'display:flex;justify-content:center;gap:16px;margin-top:10px;font-size:12px;';
    legend.innerHTML = `
        <span style="display:flex;align-items:center;gap:5px;">
            <span style="width:10px;height:10px;border-radius:2px;
                         background:#1D9E75;display:inline-block;"></span>
            Passed (${succeeded})
        </span>
        <span style="display:flex;align-items:center;gap:5px;">
            <span style="width:10px;height:10px;border-radius:2px;
                         background:#D85A30;display:inline-block;"></span>
            Failed (${failed})
        </span>`;
    container.appendChild(legend);
}