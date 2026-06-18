// ═══════════════════════════════════════════
// DOM & Constants
// ═══════════════════════════════════════════

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const highscoreEl = document.getElementById('highscore');
const settingsBtn = document.getElementById('settingsBtn');
const settingsOverlay = document.getElementById('settingsOverlay');
const speedRange = document.getElementById('speedRange');
const speedVal = document.getElementById('speedVal');
const speedUpCheck = document.getElementById('speedUpCheck');
const winCheck = document.getElementById('winCheck');
const winLength = document.getElementById('winLength');
const teleportCheck = document.getElementById('teleportCheck');
const gridSizeRange = document.getElementById('gridSize');
const gridSizeVal = document.getElementById('gridSizeVal');
const saveBtn = document.getElementById('saveBtn');
const cancelBtn = document.getElementById('cancelBtn');
const reviewsBtn = document.getElementById('reviewsBtn');
const reviewsOverlay = document.getElementById('reviewsOverlay');
const reviewsList = document.getElementById('reviewsList');
const closeReviewsBtn = document.getElementById('closeReviewsBtn');
const helpBtn = document.getElementById('helpBtn');
const helpOverlay = document.getElementById('helpOverlay');
const closeHelpBtn = document.getElementById('closeHelpBtn');

let GRID = 12;
let TILE = canvas.width / GRID;

// ═══════════════════════════════════════════
// State
// ═══════════════════════════════════════════

let settings = {
    startSpeed: 150,
    speedUp: true,
    winEnabled: false,
    winLength: 20,
    teleportersEnabled: true,
    gridSize: 12
};

let beaver, direction, nextDirection, food, score, highScore;
let gameOver, gameWon, gameRunning, currentSpeed;
let fireworks = [];
let fireworksLoop = null;
let beaverAnim = null;
let beaverFrame = 0;
let consecutiveLosses = 0;
let autoPlay = false;
let prevBeaver = [];
let tickProgress = 0;
let lastTickTime = 0;
let renderLoop = null;
let paused = false;
let pauseAngle = 0;
let teleporters = [];
let teleporterAnim = 0;
let teleporterEntryAnim = 0;
let lastTeleportSpawn = 0;
let powerups = [];
let bonuses = new Set();
let sparks = [];
let aiTeleporterUsed = 0;
let mouseX = -1;
let mouseY = -1;
let mouseClientX = -1;
let mouseClientY = -1;
let lasers = [];
let lastLaserSpawn = 0;
let magnetBorn = 0;
let magnetPull = null;

// ═══════════════════════════════════════════
// Init & localStorage
// ═══════════════════════════════════════════

highScore = parseInt(safeGetItem('beaverHighScore')) || 0;
highscoreEl.textContent = highScore;

const saved = safeGetItem('beaverSettings');
if (saved) {
    try {
        const parsed = JSON.parse(saved);
        Object.assign(settings, parsed);
        settings.startSpeed = Math.max(50, Math.min(300, Number(settings.startSpeed) || 150));
        settings.speedUp = !!settings.speedUp;
        settings.winEnabled = !!settings.winEnabled;
        settings.winLength = Math.max(5, Math.min(400, Number(settings.winLength) || 20));
        settings.teleportersEnabled = !!settings.teleportersEnabled;
        settings.gridSize = Math.max(10, Math.min(16, Number(settings.gridSize) || 12));
    } catch(e) {}
}
applyGridSize();

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function safeGetItem(key) {
    try { return localStorage.getItem(key); } catch(e) { return null; }
}
function safeSetItem(key, value) {
    try { localStorage.setItem(key, value); } catch(e) {}
}

// ═══════════════════════════════════════════
// Reviews
// ═══════════════════════════════════════════

let reviewPage = 1;
const REVIEWS_PER_PAGE = 10;

function getVersionFilter() {
    const sel = document.getElementById('reviewVersion');
    return sel ? sel.value : 'all';
}

function getFilteredReviews() {
    const v = getVersionFilter();
    return v === 'all' ? reviews : reviews.filter(r => r.version === v);
}

function renderReviews() {
    const sel = document.getElementById('reviewVersion');
    if (sel && sel.options.length <= 1) {
        const versions = [...new Set(reviews.map(r => r.version))].sort().reverse();
        versions.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v;
            opt.textContent = 'v' + v;
            sel.appendChild(opt);
        });
    }

    const filtered = getFilteredReviews();
    const totalPages = Math.max(1, Math.ceil(filtered.length / REVIEWS_PER_PAGE));
    if (reviewPage > totalPages) reviewPage = totalPages;

    const start = (reviewPage - 1) * REVIEWS_PER_PAGE;
    const page = filtered.slice(start, start + REVIEWS_PER_PAGE);

    reviewsList.innerHTML = page.map(r => `
        <div class="review">
            <div class="review-header">
                <div class="review-name">${escapeHtml(r.name)}</div>
                <div class="review-meta">${escapeHtml(r.date)} · v${escapeHtml(r.version)}</div>
            </div>
            <div class="review-stars">${'★'.repeat(r.stars)}${'☆'.repeat(5 - r.stars)}</div>
            <div class="review-text">${escapeHtml(r.text)}</div>
        </div>
    `).join('');

    const pager = document.getElementById('reviewsPager');
    if (pager) {
        if (totalPages <= 1) {
            pager.innerHTML = '';
        } else {
            let html = '';
            for (let i = 1; i <= totalPages; i++) {
                html += `<button class="${i === reviewPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
            }
            pager.innerHTML = html;
            pager.querySelectorAll('button').forEach(btn => {
                btn.addEventListener('click', () => {
                    reviewPage = parseInt(btn.dataset.page);
                    renderReviews();
                });
            });
        }
    }
}

reviewsBtn.addEventListener('click', () => {
    reviewPage = 1;
    renderReviews();
    reviewsOverlay.classList.add('active');
});

closeReviewsBtn.addEventListener('click', () => {
    reviewsOverlay.classList.remove('active');
});

reviewsOverlay.addEventListener('click', (e) => {
    if (e.target === reviewsOverlay) reviewsOverlay.classList.remove('active');
});

document.getElementById('reviewVersion').addEventListener('change', () => {
    reviewPage = 1;
    renderReviews();
});

helpBtn.addEventListener('click', () => {
    showHelpSlide(0);
    helpOverlay.classList.add('active');
});

closeHelpBtn.addEventListener('click', () => {
    helpOverlay.classList.remove('active');
});

helpOverlay.addEventListener('click', (e) => {
    if (e.target === helpOverlay) helpOverlay.classList.remove('active');
});

// ═══════════════════════════════════════════
// Help Carousel
// ═══════════════════════════════════════════

let helpSlide = 0;
function showHelpSlide(idx) {
    helpSlide = ((idx % 5) + 5) % 5;
    document.querySelectorAll('.carousel-slide').forEach((s, i) => s.classList.toggle('active', i === helpSlide));
    document.querySelectorAll('.carousel-dot').forEach((d, i) => d.classList.toggle('active', i === helpSlide));
}
document.getElementById('helpPrev').addEventListener('click', () => showHelpSlide(helpSlide - 1));
document.getElementById('helpNext').addEventListener('click', () => showHelpSlide(helpSlide + 1));
document.querySelectorAll('.carousel-dot').forEach(d => {
    d.addEventListener('click', () => showHelpSlide(parseInt(d.dataset.slide)));
});

// ═══════════════════════════════════════════
// Settings UI
// ═══════════════════════════════════════════

function sliderToDelay(val) {
    return Math.max(50, Math.min(300, 350 - val * 30));
}

function delayToSlider(delay) {
    return Math.max(1, Math.min(10, Math.round((350 - delay) / 30)));
}

function speedLabel(delay) {
    const level = delayToSlider(delay);
    if (level <= 2) return 'Тормозной';
    if (level <= 4) return 'Медленный';
    if (level <= 6) return 'Нормальный';
    if (level <= 8) return 'Быстрый';
    return 'Безумный';
}

function applySettingsToUI() {
    speedRange.value = delayToSlider(settings.startSpeed);
    speedVal.textContent = speedLabel(settings.startSpeed);
    speedUpCheck.checked = settings.speedUp;
    winCheck.checked = settings.winEnabled;
    winLength.value = settings.winLength;
    teleportCheck.checked = settings.teleportersEnabled;
    gridSizeRange.value = settings.gridSize;
    gridSizeVal.textContent = settings.gridSize + ' × ' + settings.gridSize;
}

function readSettingsFromUI() {
    settings.startSpeed = sliderToDelay(parseInt(speedRange.value));
    settings.speedUp = speedUpCheck.checked;
    settings.winEnabled = winCheck.checked;
    settings.winLength = parseInt(winLength.value) || 20;
    settings.teleportersEnabled = teleportCheck.checked;
    settings.gridSize = parseInt(gridSizeRange.value) || 12;
}

function applyGridSize() {
    GRID = settings.gridSize;
    TILE = canvas.width / GRID;
    if (beaver) {
        beaver.forEach(s => { s.x = Math.min(s.x, GRID - 1); s.y = Math.min(s.y, GRID - 1); });
        prevBeaver.forEach(s => { s.x = Math.min(s.x, GRID - 1); s.y = Math.min(s.y, GRID - 1); });
        food.x = Math.min(food.x, GRID - 1);
        food.y = Math.min(food.y, GRID - 1);
    }
}

let speedPreviewAnim = null;
let speedPreviewPos = 0;

function drawSpeedPreview() {
    const cvs = document.getElementById('speedPreview');
    if (!cvs || !settingsOverlay.classList.contains('active')) {
        speedPreviewAnim = null;
        return;
    }
    const ctx = cvs.getContext('2d');
    const delay = sliderToDelay(parseInt(speedRange.value));
    const step = Math.max(1, (300 - delay) / 30);

    ctx.clearRect(0, 0, cvs.width, cvs.height);
    ctx.fillStyle = '#0a0e1a';
    ctx.fillRect(0, 0, cvs.width, cvs.height);

    ctx.strokeStyle = 'rgba(58,124,165,0.15)';
    ctx.lineWidth = 1;
    for (let x = 0; x < cvs.width; x += 20) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, cvs.height);
        ctx.stroke();
    }

    speedPreviewPos = (speedPreviewPos + step) % (cvs.width + 20);

    ctx.fillStyle = '#5C3A1E';
    ctx.fillRect(0, 0, 4, cvs.height);
    ctx.fillRect(cvs.width - 4, 0, 4, cvs.height);

    ctx.fillStyle = '#8B5E3C';
    ctx.beginPath();
    ctx.arc(speedPreviewPos, cvs.height / 2, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#A0724A';
    ctx.beginPath();
    ctx.arc(speedPreviewPos, cvs.height / 2 + 2, 4, 0, Math.PI * 2);
    ctx.fill();

    const logX = (speedPreviewPos + 60) % cvs.width;
    ctx.fillStyle = '#6B4F12';
    ctx.beginPath();
    ctx.roundRect(logX - 8, cvs.height / 2 - 5, 16, 10, 3);
    ctx.fill();

    speedPreviewAnim = requestAnimationFrame(drawSpeedPreview);
}

speedRange.addEventListener('input', () => {
    speedVal.textContent = speedLabel(sliderToDelay(parseInt(speedRange.value)));
    if (!speedPreviewAnim) drawSpeedPreview();
});

gridSizeRange.addEventListener('input', () => {
    const v = parseInt(gridSizeRange.value);
    gridSizeVal.textContent = v + ' × ' + v;
});

settingsBtn.addEventListener('click', () => {
    applySettingsToUI();
    settingsOverlay.classList.add('active');
    speedPreviewPos = 0;
    drawSpeedPreview();
});

cancelBtn.addEventListener('click', () => {
    settingsOverlay.classList.remove('active');
    if (speedPreviewAnim) { cancelAnimationFrame(speedPreviewAnim); speedPreviewAnim = null; }
});

saveBtn.addEventListener('click', () => {
    const oldGrid = settings.gridSize;
    readSettingsFromUI();
    applyGridSize();
    safeSetItem('beaverSettings', JSON.stringify(settings));
    settingsOverlay.classList.remove('active');
    if (speedPreviewAnim) { cancelAnimationFrame(speedPreviewAnim); speedPreviewAnim = null; }
    if (settings.gridSize !== oldGrid) init();
});

settingsOverlay.addEventListener('click', (e) => {
    if (e.target === settingsOverlay) {
        settingsOverlay.classList.remove('active');
        if (speedPreviewAnim) { cancelAnimationFrame(speedPreviewAnim); speedPreviewAnim = null; }
    }
});

// ═══════════════════════════════════════════
// Game Init & Spawning
// ═══════════════════════════════════════════

function init() {
    const cx = Math.floor(GRID / 2);
    const cy = Math.floor(GRID / 2);
    beaver = [{ x: cx, y: cy }];
    prevBeaver = [{ x: cx, y: cy }];
    direction = { x: 1, y: 0 };
    nextDirection = { x: 1, y: 0 };
    score = 0;
    currentSpeed = settings.startSpeed;
    scoreEl.textContent = score;
    gameOver = false;
    gameWon = false;
    gameRunning = false;
    tickProgress = 1;
    lastTickTime = 0;
    fireworks = [];
    teleporters = [];
    powerups = [];
    bonuses = new Set();
    sparks = [];
    aiTeleporterUsed = 0;
    lasers = [];
    lastLaserSpawn = 0;
    magnetBorn = 0;
    magnetPull = null;
    lastTeleportSpawn = Date.now();
    spawnTeleporters();
    if (fireworksLoop) { cancelAnimationFrame(fireworksLoop); fireworksLoop = null; }
    if (beaverAnim) { cancelAnimationFrame(beaverAnim); beaverAnim = null; }
    if (renderLoop) cancelAnimationFrame(renderLoop);
    renderLoop = requestAnimationFrame(renderFrame);
    spawnFood();
    draw();
}

function spawnFood() {
    if (beaver.length >= GRID * GRID) return;
    let pos;
    do {
        pos = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
    } while (beaver.some(s => s.x === pos.x && s.y === pos.y));
    food = pos;
}

function spawnPowerup(type) {
    if (powerups.some(p => p.type === type)) return;
    if (type === 'shield' && bonuses.has(type)) return;
    if (Math.random() > 0.15) return;
    const free = GRID * GRID - beaver.length - 1;
    if (free <= 0) return;
    let pos;
    do {
        pos = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
    } while (beaver.some(s => s.x === pos.x && s.y === pos.y) || (food.x === pos.x && food.y === pos.y) || powerups.some(p => p.x === pos.x && p.y === pos.y));
    powerups.push({ type, x: pos.x, y: pos.y, born: Date.now() });
}

function spawnTeleporters() {
    if (!settings.teleportersEnabled) return;
    const isHorizontal = Math.random() < 0.5;
    const pos = Math.floor(Math.random() * GRID);
    const now = Date.now();
    if (isHorizontal) {
        teleporters = [
            { behind: { x: -1, y: pos }, entry: { x: 0, y: pos }, dir: { x: 1, y: 0 }, born: now, color: '#00a2ff' },
            { behind: { x: GRID, y: pos }, entry: { x: GRID - 1, y: pos }, dir: { x: -1, y: 0 }, born: now, color: '#ff6a00' }
        ];
    } else {
        teleporters = [
            { behind: { x: pos, y: -1 }, entry: { x: pos, y: 0 }, dir: { x: 0, y: 1 }, born: now, color: '#00a2ff' },
            { behind: { x: pos, y: GRID }, entry: { x: pos, y: GRID - 1 }, dir: { x: 0, y: -1 }, born: now, color: '#ff6a00' }
        ];
    }
}

// ═══════════════════════════════════════════
// Teleporter Drawing
// ═══════════════════════════════════════════

function drawTeleporter(cx, cy, alpha, remaining, color, edge) {
    color = color || '#00a2ff';
    const t = teleporterAnim;
    const flashSpeed = 0.05 + (1 - remaining) * 0.4;
    const isVert = (edge === 'left' || edge === 'right');
    const rx = isVert ? TILE * 0.22 : TILE * 0.42;
    const ry = isVert ? TILE * 0.42 : TILE * 0.22;

    ctx.globalAlpha = alpha * 0.25;
    const outerGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry) + 10);
    outerGlow.addColorStop(0, color);
    outerGlow.addColorStop(0.4, color + '66');
    outerGlow.addColorStop(1, color + '00');
    ctx.fillStyle = outerGlow;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx + 10, ry + 10, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = alpha * 0.12;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 0.5, ry * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = alpha * 0.85;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3.5;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.globalAlpha = alpha * 0.35;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 0.72, ry * 0.72, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = alpha * 0.7;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    const arcLen = Math.PI * 0.7;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 0.88, ry * 0.88, t * flashSpeed, 0, arcLen);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 0.88, ry * 0.88, -t * flashSpeed + Math.PI, 0, arcLen);
    ctx.stroke();

    for (let i = 0; i < 3; i++) {
        const a = t * flashSpeed + (Math.PI * 2 / 3) * i;
        const sx = cx + Math.cos(a) * rx * 0.5;
        const sy = cy + Math.sin(a) * ry * 0.5;
        const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, 4);
        sg.addColorStop(0, '#fff');
        sg.addColorStop(0.5, color);
        sg.addColorStop(1, color + '00');
        ctx.fillStyle = sg;
        ctx.beginPath();
        ctx.arc(sx, sy, 4, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.globalAlpha = 1;
}

// ═══════════════════════════════════════════
// Game Update
// ═══════════════════════════════════════════

function update() {
    prevBeaver = beaver.map(s => ({ ...s }));
    direction = { ...nextDirection };

    const head = { x: beaver[0].x + direction.x, y: beaver[0].y + direction.y };

    const hitIdx = powerups.findIndex(p => head.x === p.x && head.y === p.y);
    if (hitIdx !== -1) {
        const p = powerups[hitIdx];
        if (p.type === 'shield') bonuses.add('shield');
        if (p.type === 'magnet') { bonuses.add('magnet'); magnetBorn = Date.now(); }
        powerups.splice(hitIdx, 1);
    }

    if (bonuses.has('magnet') && Date.now() - magnetBorn >= 10000) {
        bonuses.delete('magnet');
    }

    if (bonuses.has('magnet') && !magnetPull) {
        const d = Math.abs(head.x - food.x) + Math.abs(head.y - food.y);
        if (d >= 1 && d <= 3) {
            let canPull = true;
            if (settings.teleportersEnabled && teleporters.length === 2) {
                const fd = { x: Math.sign(food.x - head.x), y: Math.sign(food.y - head.y) };
                if (fd.x !== 0 && fd.y !== 0) {
                    const checkX = { x: head.x + fd.x, y: head.y };
                    const checkY = { x: head.x, y: head.y + fd.y };
                    const blockedX = (checkX.x < 0 || checkX.x >= GRID || checkX.y < 0 || checkX.y >= GRID) &&
                        !teleporters.some(t => t.behind.x === checkX.x && t.behind.y === checkX.y);
                    const blockedY = (checkY.x < 0 || checkY.x >= GRID || checkY.y < 0 || checkY.y >= GRID) &&
                        !teleporters.some(t => t.behind.x === checkY.x && t.behind.y === checkY.y);
                    if (blockedX && blockedY) canPull = false;
                }
            }
            if (canPull) {
                magnetPull = { fromX: food.x, fromY: food.y, toX: head.x, toY: head.y, progress: 0 };
                food.x = head.x;
                food.y = head.y;
            }
        }
    }

    if (head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID) {
        const tpIdx = teleporters.findIndex(t => t.behind.x === head.x && t.behind.y === head.y);
        if (tpIdx !== -1) {
            const other = tpIdx === 0 ? teleporters[1] : teleporters[0];
            teleporterEntryAnim = teleporterAnim;
            beaver.unshift({ x: other.entry.x, y: other.entry.y });
            prevBeaver.unshift({ x: other.entry.x, y: other.entry.y });
            direction = { ...other.dir };
            nextDirection = { ...other.dir };
            if (beaver.length > 1) {
                beaver.pop();
                prevBeaver.pop();
            }
            return;
        }
        if (bonuses.has('shield')) {
            const safeDir = findSafeDirection();
            if (safeDir) {
                bonuses.delete('shield');
                nextDirection = safeDir;
                direction = { ...safeDir };
                return update();
            }
        }
        endGame();
        return;
    }

    if (beaver.some(s => s.x === head.x && s.y === head.y)) {
        if (bonuses.has('shield')) {
            const safeDir = findSafeDirection();
            if (safeDir) {
                bonuses.delete('shield');
                nextDirection = safeDir;
                direction = { ...safeDir };
                return update();
            }
        }
        endGame();
        return;
    }

    beaver.unshift(head);

    if (head.x === food.x && head.y === food.y) {
        score++;
        scoreEl.textContent = score;

        if (settings.speedUp && score % 3 === 0 && currentSpeed > 50) {
            currentSpeed -= 10;
        }

        if (settings.winEnabled && beaver.length >= settings.winLength) {
            winGame();
            return;
        }

        spawnFood();
    } else {
        beaver.pop();
    }
}

// ═══════════════════════════════════════════
// Fireworks
// ═══════════════════════════════════════════

function spawnFirework() {
    const colors = ['#e94560', '#53d769', '#f5a623', '#4a90d9', '#bd10e0', '#fff'];
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height * 0.6;
    const color = colors[Math.floor(Math.random() * colors.length)];
    const count = 30 + Math.floor(Math.random() * 20);
    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 / count) * i;
        const speed = 1.5 + Math.random() * 2.5;
        fireworks.push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1,
            decay: 0.012 + Math.random() * 0.015,
            color,
            size: 2 + Math.random() * 2
        });
    }
}

function updateFireworks() {
    for (let i = fireworks.length - 1; i >= 0; i--) {
        const p = fireworks[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.04;
        p.life -= p.decay;
        if (p.life <= 0) fireworks.splice(i, 1);
    }
}

function drawFireworks() {
    fireworks.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;
}

let fireworkTimer = 0;
function fireworksFrame() {
    fireworkTimer++;
    if (fireworkTimer % 40 === 0) spawnFirework();
    updateFireworks();
    draw();
    fireworksLoop = requestAnimationFrame(fireworksFrame);
}

// ═══════════════════════════════════════════
// Beaver Face Drawing
// ═══════════════════════════════════════════

const beaverMessages = [
    'Не грусти!',
    'Ты справишься!',
    'Ещё попытка!',
    'Почти получилось!',
    'Не сдавайся!',
    'Ты молодец!',
    'В следующий раз!',
];

const angryMessages = [
    'Хватит проигрывать!',
    'Сосредоточься!',
    'Бобёр злится!',
    'Покажи на что способен!',
    'Сердишь меня!',
];

function drawHeadband(cx, cy, w, angle) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle || 0);

    const h = w * 0.2;
    const hh = h / 2;

    ctx.fillStyle = '#1a237e';
    ctx.beginPath();
    ctx.roundRect(-w / 2, -hh, w, h, h * 0.3);
    ctx.fill();

    const rw = w * 0.28;
    const ro = h * 0.4;
    ctx.fillStyle = '#1a237e';
    ctx.beginPath();
    ctx.moveTo(w / 2, -ro);
    ctx.lineTo(w / 2 + rw, -h * 0.8);
    ctx.lineTo(w / 2 + rw, h * 0.8);
    ctx.lineTo(w / 2, ro);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-w / 2, -ro);
    ctx.lineTo(-w / 2 - rw, -h * 0.8);
    ctx.lineTo(-w / 2 - rw, h * 0.8);
    ctx.lineTo(-w / 2, ro);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#9e9e9e';
    ctx.beginPath();
    ctx.roundRect(-w / 2 + w * 0.2, -ro, w * 0.6, h * 0.8, h * 0.2);
    ctx.fill();

    ctx.strokeStyle = '#616161';
    ctx.lineWidth = Math.max(0.5, w * 0.016);
    ctx.beginPath();
    ctx.arc(0, 0, w * 0.15, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-w * 0.08, 0);
    ctx.quadraticCurveTo(0, -w * 0.1, w * 0.08, 0);
    ctx.stroke();

    ctx.restore();
}

function drawAnimeEyes(cx, cy, r, mood, lookDir) {
    const eyeSpacing = r * 0.38;
    const eyeY = cy - r * 0.12;
    const eyeW = r * 0.22;
    const eyeH = r * 0.28;
    const maxOff = r * 0.15;
    const ox = lookDir ? Math.max(-maxOff, Math.min(maxOff, lookDir.x * maxOff)) : 0;
    const oy = lookDir ? Math.max(-maxOff, Math.min(maxOff, lookDir.y * maxOff)) : 0;

    for (const side of [-1, 1]) {
        const ex = cx + side * eyeSpacing;

        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.ellipse(ex, eyeY, eyeW, eyeH, 0, 0, Math.PI * 2);
        ctx.fill();

        if (mood === 'angry') {
            ctx.fillStyle = '#8B0000';
        } else {
            ctx.fillStyle = '#1565C0';
        }
        ctx.beginPath();
        ctx.ellipse(ex + ox, eyeY + oy + r * 0.02, eyeW * 0.6, eyeH * 0.65, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.arc(ex + ox + (lookDir ? lookDir.x * maxOff * 0.4 : side * r * 0.02), eyeY + oy + r * 0.03, eyeW * 0.3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(ex + ox + (lookDir ? lookDir.x * maxOff * 0.5 : side * r * 0.08), eyeY + oy - r * 0.06, eyeW * 0.15, 0, Math.PI * 2);
        ctx.fill();
    }

    if (mood === 'sad') {
        ctx.strokeStyle = '#5C3A1E';
        ctx.lineWidth = 2;
        for (const side of [-1, 1]) {
            const bx = cx + side * eyeSpacing;
            ctx.beginPath();
            ctx.moveTo(bx - eyeW * 0.8, eyeY - eyeH - r * 0.02);
            ctx.lineTo(bx + eyeW * 0.3, eyeY - eyeH + r * 0.04);
            ctx.stroke();
        }
    } else if (mood === 'angry') {
        ctx.strokeStyle = '#5C3A1E';
        ctx.lineWidth = 3;
        for (const side of [-1, 1]) {
            const bx = cx + side * eyeSpacing;
            ctx.beginPath();
            ctx.moveTo(bx - eyeW * 0.6 * side, eyeY - eyeH - r * 0.06);
            ctx.lineTo(bx + eyeW * 0.5 * side, eyeY - eyeH + r * 0.01);
            ctx.stroke();
        }
    }
}

function drawBuckTeeth(cx, cy, r) {
    const teethY = cy + r * 0.32;
    const teethW = r * 0.14;
    const teethH = r * 0.2;
    const gap = r * 0.02;

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.roundRect(cx - teethW - gap, teethY, teethW, teethH, 2);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(cx + gap, teethY, teethW, teethH, 2);
    ctx.fill();

    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.roundRect(cx - teethW - gap, teethY, teethW, teethH, 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(cx + gap, teethY, teethW, teethH, 2);
    ctx.stroke();
}

function drawWhiskers(cx, cy, r) {
    ctx.strokeStyle = '#5C3A1E';
    ctx.lineWidth = 1.2;
    for (const side of [-1, 1]) {
        const baseX = cx + side * r * 0.35;
        const baseY = cy + r * 0.15;
        for (let i = -1; i <= 1; i++) {
            ctx.beginPath();
            ctx.moveTo(baseX, baseY + i * r * 0.08);
            ctx.lineTo(baseX + side * r * 0.35, baseY + i * r * 0.08 - r * 0.03);
            ctx.stroke();
        }
    }
}

function drawBeaverFaceHappy(cx, cy) {
    const t = beaverFrame;
    const bounce = Math.sin(t * 0.06) * 5;
    const r = 70;
    const by = cy + bounce;

    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(cx + 4, by + 6, r * 0.95, r * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();

    const headGrad = ctx.createRadialGradient(cx - r * 0.25, by - r * 0.3, r * 0.1, cx, by, r);
    headGrad.addColorStop(0, '#D4A574');
    headGrad.addColorStop(0.3, '#B8834A');
    headGrad.addColorStop(0.7, '#8B5E3C');
    headGrad.addColorStop(1, '#6B4226');
    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.arc(cx, by, r, 0, Math.PI * 2);
    ctx.fill();

    const muzzleGrad = ctx.createRadialGradient(cx - r * 0.1, by + r * 0.25, r * 0.05, cx, by + r * 0.35, r * 0.5);
    muzzleGrad.addColorStop(0, '#D4A574');
    muzzleGrad.addColorStop(0.5, '#B8834A');
    muzzleGrad.addColorStop(1, '#A0724A');
    ctx.fillStyle = muzzleGrad;
    ctx.beginPath();
    ctx.ellipse(cx, by + r * 0.35, r * 0.55, r * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx - r * 0.2, by - r * 0.25, r * 0.5, Math.PI * 1.1, Math.PI * 1.7);
    ctx.stroke();

    drawHeadband(cx, by - r * 0.52, r * 0.9, 0);

    let mouseLook = null;
    const rect = canvas.getBoundingClientRect();
    const mx = (mouseClientX - rect.left) * (canvas.width / rect.width);
    const my = (mouseClientY - rect.top) * (canvas.height / rect.height);
    const dxh = mx - cx;
    const dyh = my - by;
    const lenh = Math.sqrt(dxh * dxh + dyh * dyh);
    if (lenh > 2) mouseLook = { x: dxh / lenh, y: dyh / lenh };
    drawAnimeEyes(cx, by, r, 'happy', mouseLook);

    const noseGrad = ctx.createRadialGradient(cx - 2, by + r * 0.15, 0, cx, by + r * 0.18, r * 0.09);
    noseGrad.addColorStop(0, '#555');
    noseGrad.addColorStop(1, '#222');
    ctx.fillStyle = noseGrad;
    ctx.beginPath();
    ctx.ellipse(cx, by + r * 0.18, r * 0.08, r * 0.05, 0, 0, Math.PI * 2);
    ctx.fill();

    drawBuckTeeth(cx, by, r);
    drawWhiskers(cx, by, r);

    const cheekGrad = ctx.createRadialGradient(cx - r * 0.42, by + r * 0.15, 0, cx - r * 0.42, by + r * 0.15, r * 0.12);
    cheekGrad.addColorStop(0, 'rgba(232,150,122,0.9)');
    cheekGrad.addColorStop(1, 'rgba(232,150,122,0.3)');
    ctx.fillStyle = cheekGrad;
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.42, by + r * 0.15, r * 0.12, r * 0.08, 0.3, 0, Math.PI * 2);
    ctx.fill();
    const cheekGrad2 = ctx.createRadialGradient(cx + r * 0.42, by + r * 0.15, 0, cx + r * 0.42, by + r * 0.15, r * 0.12);
    cheekGrad2.addColorStop(0, 'rgba(232,150,122,0.9)');
    cheekGrad2.addColorStop(1, 'rgba(232,150,122,0.3)');
    ctx.fillStyle = cheekGrad2;
    ctx.beginPath();
    ctx.ellipse(cx + r * 0.42, by + r * 0.15, r * 0.12, r * 0.08, -0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#5C3A1E';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, by + r * 0.35, r * 0.22, 0.15, Math.PI - 0.15);
    ctx.stroke();
}

function drawBeaverFaceSad(cx, cy) {
    const t = beaverFrame;
    const wobble = Math.sin(t * 0.1) * 3;
    const r = 70;
    const by = cy + wobble;

    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(cx + 4, by + 6, r * 0.95, r * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();

    const headGrad = ctx.createRadialGradient(cx - r * 0.25, by - r * 0.3, r * 0.1, cx, by, r);
    headGrad.addColorStop(0, '#D4A574');
    headGrad.addColorStop(0.3, '#B8834A');
    headGrad.addColorStop(0.7, '#8B5E3C');
    headGrad.addColorStop(1, '#6B4226');
    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.arc(cx, by, r, 0, Math.PI * 2);
    ctx.fill();

    const muzzleGrad = ctx.createRadialGradient(cx - r * 0.1, by + r * 0.25, r * 0.05, cx, by + r * 0.35, r * 0.5);
    muzzleGrad.addColorStop(0, '#D4A574');
    muzzleGrad.addColorStop(0.5, '#B8834A');
    muzzleGrad.addColorStop(1, '#A0724A');
    ctx.fillStyle = muzzleGrad;
    ctx.beginPath();
    ctx.ellipse(cx, by + r * 0.35, r * 0.55, r * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx - r * 0.2, by - r * 0.25, r * 0.5, Math.PI * 1.1, Math.PI * 1.7);
    ctx.stroke();

    drawHeadband(cx, by - r * 0.52, r * 0.9, 0);

    let mouseLook = null;
    const rect = canvas.getBoundingClientRect();
    const mx = (mouseClientX - rect.left) * (canvas.width / rect.width);
    const my = (mouseClientY - rect.top) * (canvas.height / rect.height);
    const dxs = mx - cx;
    const dys = my - by;
    const lens = Math.sqrt(dxs * dxs + dys * dys);
    if (lens > 2) mouseLook = { x: dxs / lens, y: dys / lens };
    drawAnimeEyes(cx, by, r, 'sad', mouseLook);

    const noseGrad = ctx.createRadialGradient(cx - 2, by + r * 0.15, 0, cx, by + r * 0.18, r * 0.09);
    noseGrad.addColorStop(0, '#555');
    noseGrad.addColorStop(1, '#222');
    ctx.fillStyle = noseGrad;
    ctx.beginPath();
    ctx.ellipse(cx, by + r * 0.18, r * 0.08, r * 0.05, 0, 0, Math.PI * 2);
    ctx.fill();

    drawBuckTeeth(cx, by, r);
    drawWhiskers(cx, by, r);

    const cheekGrad = ctx.createRadialGradient(cx - r * 0.42, by + r * 0.15, 0, cx - r * 0.42, by + r * 0.15, r * 0.12);
    cheekGrad.addColorStop(0, 'rgba(232,150,122,0.9)');
    cheekGrad.addColorStop(1, 'rgba(232,150,122,0.3)');
    ctx.fillStyle = cheekGrad;
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.42, by + r * 0.15, r * 0.12, r * 0.08, 0.3, 0, Math.PI * 2);
    ctx.fill();
    const cheekGrad2 = ctx.createRadialGradient(cx + r * 0.42, by + r * 0.15, 0, cx + r * 0.42, by + r * 0.15, r * 0.12);
    cheekGrad2.addColorStop(0, 'rgba(232,150,122,0.9)');
    cheekGrad2.addColorStop(1, 'rgba(232,150,122,0.3)');
    ctx.fillStyle = cheekGrad2;
    ctx.beginPath();
    ctx.ellipse(cx + r * 0.42, by + r * 0.15, r * 0.12, r * 0.08, -0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#5C3A1E';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, by + r * 0.48, r * 0.16, Math.PI + 0.3, -0.3);
    ctx.stroke();

    const tearY = (t * 0.5) % (r * 0.4);
    for (const side of [-1, 1]) {
        const tearGrad = ctx.createRadialGradient(cx + side * r * 0.38, by - r * 0.05 + tearY, 0, cx + side * r * 0.38, by - r * 0.05 + tearY, 5);
        tearGrad.addColorStop(0, 'rgba(100,180,255,0.9)');
        tearGrad.addColorStop(1, 'rgba(100,180,255,0.2)');
        ctx.fillStyle = tearGrad;
        ctx.beginPath();
        ctx.ellipse(cx + side * r * 0.38, by - r * 0.05 + tearY, 3, 5, 0, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawBeaverFaceAngry(cx, cy) {
    const t = beaverFrame;
    const shake = Math.sin(t * 0.15) * 3;
    const r = 70;
    const sx = cx + shake;

    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(sx + 4, cy + 6, r * 0.95, r * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();

    const headGrad = ctx.createRadialGradient(sx - r * 0.25, cy - r * 0.3, r * 0.1, sx, cy, r);
    headGrad.addColorStop(0, '#D4A574');
    headGrad.addColorStop(0.3, '#B8834A');
    headGrad.addColorStop(0.7, '#8B5E3C');
    headGrad.addColorStop(1, '#6B4226');
    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.arc(sx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    const muzzleGrad = ctx.createRadialGradient(sx - r * 0.1, cy + r * 0.25, r * 0.05, sx, cy + r * 0.35, r * 0.5);
    muzzleGrad.addColorStop(0, '#D4A574');
    muzzleGrad.addColorStop(0.5, '#B8834A');
    muzzleGrad.addColorStop(1, '#A0724A');
    ctx.fillStyle = muzzleGrad;
    ctx.beginPath();
    ctx.ellipse(sx, cy + r * 0.35, r * 0.55, r * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx - r * 0.2, cy - r * 0.25, r * 0.5, Math.PI * 1.1, Math.PI * 1.7);
    ctx.stroke();

    drawHeadband(sx, cy - r * 0.52, r * 0.9, 0);

    let mouseLook = null;
    const rect = canvas.getBoundingClientRect();
    const mx = (mouseClientX - rect.left) * (canvas.width / rect.width);
    const my = (mouseClientY - rect.top) * (canvas.height / rect.height);
    const dxa = mx - sx;
    const dya = my - cy;
    const lena = Math.sqrt(dxa * dxa + dya * dya);
    if (lena > 2) mouseLook = { x: dxa / lena, y: dya / lena };
    drawAnimeEyes(sx, cy, r, 'angry', mouseLook);

    ctx.strokeStyle = '#5C3A1E';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(sx - r * 0.35, cy - r * 0.38);
    ctx.lineTo(sx - r * 0.1, cy - r * 0.28);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(sx + r * 0.35, cy - r * 0.38);
    ctx.lineTo(sx + r * 0.1, cy - r * 0.28);
    ctx.stroke();

    const noseGrad = ctx.createRadialGradient(sx - 2, cy + r * 0.15, 0, sx, cy + r * 0.18, r * 0.09);
    noseGrad.addColorStop(0, '#555');
    noseGrad.addColorStop(1, '#222');
    ctx.fillStyle = noseGrad;
    ctx.beginPath();
    ctx.ellipse(sx, cy + r * 0.18, r * 0.08, r * 0.05, 0, 0, Math.PI * 2);
    ctx.fill();

    drawWhiskers(sx, cy, r);

    const teethGrad = ctx.createLinearGradient(sx, cy + r * 0.3, sx, cy + r * 0.55);
    teethGrad.addColorStop(0, '#fff');
    teethGrad.addColorStop(0.3, '#f0f0f0');
    teethGrad.addColorStop(1, '#ccc');
    ctx.fillStyle = teethGrad;
    ctx.beginPath();
    ctx.moveTo(sx - r * 0.32, cy + r * 0.3);
    ctx.lineTo(sx + r * 0.32, cy + r * 0.3);
    ctx.lineTo(sx + r * 0.32, cy + r * 0.55);
    ctx.lineTo(sx - r * 0.32, cy + r * 0.55);
    ctx.closePath();
    ctx.fill();

    const teethW = r * 0.1;
    const teethH = r * 0.12;
    const gap = r * 0.02;
    for (let i = -2; i <= 2; i++) {
        const tx = sx + i * (teethW + gap) - teethW / 2;
        const toothGrad = ctx.createLinearGradient(tx, cy + r * 0.3, tx, cy + r * 0.3 + teethH * 2);
        toothGrad.addColorStop(0, '#fff');
        toothGrad.addColorStop(1, '#ddd');
        ctx.fillStyle = toothGrad;
        ctx.fillRect(tx, cy + r * 0.3, teethW, teethH);
        ctx.fillRect(tx, cy + r * 0.3 + teethH, teethW, teethH);
    }
    ctx.strokeStyle = '#bbb';
    ctx.lineWidth = 0.5;
    for (let i = -2; i <= 2; i++) {
        ctx.strokeRect(sx + i * (teethW + gap) - teethW / 2, cy + r * 0.3, teethW, teethH);
        ctx.strokeRect(sx + i * (teethW + gap) - teethW / 2, cy + r * 0.3 + teethH, teethW, teethH);
    }

    const cheekGrad = ctx.createRadialGradient(sx - r * 0.42, cy + r * 0.15, 0, sx - r * 0.42, cy + r * 0.15, r * 0.12);
    cheekGrad.addColorStop(0, 'rgba(232,100,80,0.9)');
    cheekGrad.addColorStop(1, 'rgba(232,100,80,0.3)');
    ctx.fillStyle = cheekGrad;
    ctx.beginPath();
    ctx.ellipse(sx - r * 0.42, cy + r * 0.15, r * 0.12, r * 0.08, 0.3, 0, Math.PI * 2);
    ctx.fill();
    const cheekGrad2 = ctx.createRadialGradient(sx + r * 0.42, cy + r * 0.15, 0, sx + r * 0.42, cy + r * 0.15, r * 0.12);
    cheekGrad2.addColorStop(0, 'rgba(232,100,80,0.9)');
    cheekGrad2.addColorStop(1, 'rgba(232,100,80,0.3)');
    ctx.fillStyle = cheekGrad2;
    ctx.beginPath();
    ctx.ellipse(sx + r * 0.42, cy + r * 0.15, r * 0.12, r * 0.08, -0.3, 0, Math.PI * 2);
    ctx.fill();
}

// ═══════════════════════════════════════════
// Beaver Head Drawing
// ═══════════════════════════════════════════

function beaverFrameLoop() {
    draw();
    beaverAnim = requestAnimationFrame(beaverFrameLoop);
}

function drawBeaverHead(cx, cy, dir) {
    const r = TILE / 2 - 2;

    let eyeDir = dir;
    if (!gameRunning || paused) {
        const rect = canvas.getBoundingClientRect();
        const cx2 = (mouseClientX - rect.left) * (canvas.width / rect.width);
        const cy2 = (mouseClientY - rect.top) * (canvas.height / rect.height);
        const dx = cx2 - cx;
        const dy = cy2 - cy;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 2) {
            eyeDir = { x: dx / len, y: dy / len };
        }
    }

    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(cx + 2, cy + 3, r * 0.9, r * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();

    const headGrad = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.3, r * 0.1, cx, cy, r);
    headGrad.addColorStop(0, '#D4A574');
    headGrad.addColorStop(0.3, '#B8834A');
    headGrad.addColorStop(0.7, '#8B5E3C');
    headGrad.addColorStop(1, '#6B4226');
    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    const muzzleGrad = ctx.createRadialGradient(cx - r * 0.1, cy + r * 0.15, r * 0.05, cx, cy + r * 0.2, r * 0.5);
    muzzleGrad.addColorStop(0, '#D4A574');
    muzzleGrad.addColorStop(0.5, '#B8834A');
    muzzleGrad.addColorStop(1, '#A0724A');
    ctx.fillStyle = muzzleGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy + r * 0.2, r * 0.6, r * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx - r * 0.2, cy - r * 0.25, r * 0.5, Math.PI * 1.1, Math.PI * 1.7);
    ctx.stroke();

    drawHeadband(cx, cy - r * 0.55, r * 0.85, 0);

    const eyeSpacing = r * 0.35;
    const eyeY = cy - r * 0.08;
    const eyeW = r * 0.2;
    const eyeH = r * 0.25;
    const maxOff = r * 0.15;
    const eyeOffX = Math.max(-maxOff, Math.min(maxOff, eyeDir.x * maxOff));
    const eyeOffY = Math.max(-maxOff, Math.min(maxOff, eyeDir.y * maxOff));

    for (const side of [-1, 1]) {
        const ex = cx + side * eyeSpacing;

        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.beginPath();
        ctx.ellipse(ex + 1, eyeY + 2, eyeW + 1, eyeH + 1, 0, 0, Math.PI * 2);
        ctx.fill();

        const eyeGrad = ctx.createRadialGradient(ex - eyeW * 0.2, eyeY - eyeH * 0.2, 0, ex, eyeY, eyeW);
        eyeGrad.addColorStop(0, '#fff');
        eyeGrad.addColorStop(0.7, '#e8e8e8');
        eyeGrad.addColorStop(1, '#d0d0d0');
        ctx.fillStyle = eyeGrad;
        ctx.beginPath();
        ctx.ellipse(ex, eyeY, eyeW, eyeH, 0, 0, Math.PI * 2);
        ctx.fill();

        const irisGrad = ctx.createRadialGradient(ex + eyeOffX - eyeW * 0.1, eyeY + eyeOffY - eyeH * 0.1, 0, ex + eyeOffX, eyeY + eyeOffY, eyeW * 0.55);
        irisGrad.addColorStop(0, '#2196F3');
        irisGrad.addColorStop(0.5, '#1565C0');
        irisGrad.addColorStop(1, '#0D47A1');
        ctx.fillStyle = irisGrad;
        ctx.beginPath();
        ctx.ellipse(ex + eyeOffX, eyeY + eyeOffY + r * 0.02, eyeW * 0.55, eyeH * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.arc(ex + eyeOffX + eyeDir.x * 1.5, eyeY + eyeOffY + r * 0.03, eyeW * 0.28, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(ex + eyeOffX + eyeDir.x * 2 - eyeW * 0.15, eyeY + eyeOffY - r * 0.06, eyeW * 0.18, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(ex + eyeOffX + eyeDir.x * 2 + eyeW * 0.1, eyeY + eyeOffY - r * 0.02, eyeW * 0.08, 0, Math.PI * 2);
        ctx.fill();
    }

    const noseGrad = ctx.createRadialGradient(cx - r * 0.02, cy + r * 0.17, 0, cx, cy + r * 0.2, r * 0.07);
    noseGrad.addColorStop(0, '#555');
    noseGrad.addColorStop(1, '#222');
    ctx.fillStyle = noseGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy + r * 0.2, r * 0.07, r * 0.04, 0, 0, Math.PI * 2);
    ctx.fill();

    const teethGrad = ctx.createLinearGradient(cx, cy + r * 0.32, cx, cy + r * 0.32 + r * 0.18);
    teethGrad.addColorStop(0, '#fff');
    teethGrad.addColorStop(0.3, '#f8f8f8');
    teethGrad.addColorStop(1, '#ddd');
    ctx.fillStyle = teethGrad;
    const teethW = r * 0.12;
    const teethH = r * 0.18;
    const gap = r * 0.015;
    ctx.beginPath();
    ctx.roundRect(cx - teethW - gap, cy + r * 0.32, teethW, teethH, 1);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(cx + gap, cy + r * 0.32, teethW, teethH, 1);
    ctx.fill();

    ctx.strokeStyle = '#5C3A1E';
    ctx.lineWidth = 0.8;
    for (const side of [-1, 1]) {
        const bx = cx + side * r * 0.35;
        const by = cy + r * 0.15;
        for (let i = -1; i <= 1; i++) {
            ctx.beginPath();
            ctx.moveTo(bx, by + i * r * 0.06);
            ctx.lineTo(bx + side * r * 0.25, by + i * r * 0.06 - r * 0.02);
            ctx.stroke();
        }
    }
}

// ═══════════════════════════════════════════
// Item Drawing (Log, Corn, Cherry)
// ═══════════════════════════════════════════

function drawLog(cx, cy) {
    const w = TILE - 6;
    const h = TILE - 10;

    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.roundRect(cx - w / 2 + 2, cy - h / 2 + 3, w, h, 5);
    ctx.fill();

    const logGrad = ctx.createLinearGradient(cx, cy - h / 2, cx, cy + h / 2);
    logGrad.addColorStop(0, '#A07828');
    logGrad.addColorStop(0.15, '#8B6914');
    logGrad.addColorStop(0.5, '#6B4F12');
    logGrad.addColorStop(0.85, '#5A4210');
    logGrad.addColorStop(1, '#4A3508');
    ctx.fillStyle = logGrad;
    ctx.beginPath();
    ctx.roundRect(cx - w / 2, cy - h / 2, w, h, 5);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(cx - w / 2 + 1, cy - h / 2 + 1, w - 2, h * 0.3, 4);
    ctx.stroke();

    const endGrad = ctx.createRadialGradient(cx - w / 2 + 4, cy, 0, cx - w / 2 + 4, cy, h / 2 - 2);
    endGrad.addColorStop(0, '#C49A4A');
    endGrad.addColorStop(0.4, '#A07828');
    endGrad.addColorStop(1, '#6B4F12');
    ctx.fillStyle = endGrad;
    ctx.beginPath();
    ctx.ellipse(cx - w / 2 + 4, cy, 4, h / 2 - 2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#5A4210';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(cx - w / 2 + 8, cy - 2);
    ctx.lineTo(cx + w / 2 - 8, cy - 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - w / 2 + 8, cy + 2);
    ctx.lineTo(cx + w / 2 - 8, cy + 2);
    ctx.stroke();
}

function drawCorn(cx, cy) {
    const t = beaverFrame;
    const pulse = 1 + Math.sin(t * 0.1) * 0.08;
    const w = (TILE - 8) * pulse;
    const h = (TILE - 4) * pulse;

    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(cx + 1, cy + 3, w * 0.35, h * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#2d5a1e';
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.15, cy - h * 0.5);
    ctx.quadraticCurveTo(cx - w * 0.3, cy - h * 0.3, cx - w * 0.25, cy + h * 0.1);
    ctx.quadraticCurveTo(cx - w * 0.15, cy + h * 0.35, cx, cy + h * 0.5);
    ctx.quadraticCurveTo(cx + w * 0.15, cy + h * 0.35, cx + w * 0.25, cy + h * 0.1);
    ctx.quadraticCurveTo(cx + w * 0.3, cy - h * 0.3, cx + w * 0.15, cy - h * 0.5);
    ctx.closePath();
    ctx.fill();

    const cornGrad = ctx.createRadialGradient(cx - w * 0.05, cy - h * 0.1, 0, cx, cy, w * 0.25);
    cornGrad.addColorStop(0, '#FFE082');
    cornGrad.addColorStop(0.4, '#F5D442');
    cornGrad.addColorStop(0.8, '#E8C130');
    cornGrad.addColorStop(1, '#C4A020');
    ctx.fillStyle = cornGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy, w * 0.22, h * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#E8C130';
    for (let row = -2; row <= 2; row++) {
        for (let col = -1; col <= 1; col++) {
            const kx = cx + col * w * 0.12 + (row % 2) * w * 0.06;
            const ky = cy + row * h * 0.12;
            const kernelGrad = ctx.createRadialGradient(kx - 1, ky - 1, 0, kx, ky, w * 0.05);
            kernelGrad.addColorStop(0, '#FFE082');
            kernelGrad.addColorStop(1, '#C4A020');
            ctx.fillStyle = kernelGrad;
            ctx.beginPath();
            ctx.arc(kx, ky, w * 0.05, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    ctx.fillStyle = '#3a7a28';
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.08, cy - h * 0.42);
    ctx.quadraticCurveTo(cx - w * 0.2, cy - h * 0.55, cx - w * 0.15, cy - h * 0.65);
    ctx.quadraticCurveTo(cx - w * 0.05, cy - h * 0.55, cx, cy - h * 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + w * 0.08, cy - h * 0.42);
    ctx.quadraticCurveTo(cx + w * 0.2, cy - h * 0.55, cx + w * 0.15, cy - h * 0.65);
    ctx.quadraticCurveTo(cx + w * 0.05, cy - h * 0.55, cx, cy - h * 0.42);
    ctx.closePath();
    ctx.fill();

    const glow = 0.3 + 0.2 * Math.sin(t * 0.08);
    ctx.globalAlpha = glow;
    const glowGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.5);
    glowGrad.addColorStop(0, '#F5D442');
    glowGrad.addColorStop(1, 'rgba(245,212,66,0)');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, w * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
}

function drawCherry(cx, cy) {
    const t = beaverFrame;
    const pulse = 1 + Math.sin(t * 0.1) * 0.06;
    const s = (TILE - 10) * pulse;

    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(cx + 1, cy + 3, s * 0.45, s * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#2d7a1e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.12, cy - s * 0.15);
    ctx.quadraticCurveTo(cx - s * 0.05, cy - s * 0.5, cx + s * 0.05, cy - s * 0.55);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + s * 0.12, cy - s * 0.15);
    ctx.quadraticCurveTo(cx + s * 0.05, cy - s * 0.5, cx - s * 0.05, cy - s * 0.55);
    ctx.stroke();

    for (const side of [-1, 1]) {
        const bx = cx + side * s * 0.15;
        const by = cy + s * 0.08;
        const crg = ctx.createRadialGradient(bx - 1, by - 1, 0, bx, by, s * 0.18);
        crg.addColorStop(0, '#ff4444');
        crg.addColorStop(0.5, '#cc1111');
        crg.addColorStop(1, '#880000');
        ctx.fillStyle = crg;
        ctx.beginPath();
        ctx.arc(bx, by, s * 0.18, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath();
        ctx.arc(bx - s * 0.04, by - s * 0.05, s * 0.05, 0, Math.PI * 2);
        ctx.fill();
    }

    const glow = 0.25 + 0.15 * Math.sin(t * 0.08);
    ctx.globalAlpha = glow;
    const glowGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, s * 0.45);
    glowGrad.addColorStop(0, '#ff4444');
    glowGrad.addColorStop(1, 'rgba(255,68,68,0)');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
}

// ═══════════════════════════════════════════
// Main Draw
// ═══════════════════════════════════════════

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#0d1b2a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < 5; i++) {
        const wx = ((Date.now() * 0.0003 + i * 200) % (canvas.width + 400)) - 200;
        const wy = canvas.height * 0.6 + Math.sin(Date.now() * 0.001 + i) * 15;
        ctx.strokeStyle = 'rgba(58,124,165,0.15)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(wx - 100, wy);
        ctx.quadraticCurveTo(wx - 50, wy - 10, wx, wy);
        ctx.quadraticCurveTo(wx + 50, wy + 10, wx + 100, wy);
        ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(58,124,165,0.08)';
    ctx.lineWidth = 1;
    for (let y = 0; y < GRID; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * TILE);
        ctx.lineTo(canvas.width, y * TILE);
        ctx.stroke();
    }
    for (let x = 0; x < GRID; x++) {
        ctx.beginPath();
        ctx.moveTo(x * TILE, 0);
        ctx.lineTo(x * TILE, canvas.height);
        ctx.stroke();
    }

    const wallW = 6;
    const plankH = TILE;

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(2, 2, canvas.width, wallW);
    ctx.fillRect(2, 2, wallW, canvas.height);

    const wallGradH = ctx.createLinearGradient(0, 0, 0, wallW);
    wallGradH.addColorStop(0, '#7B5A2E');
    wallGradH.addColorStop(0.3, '#5C3A1E');
    wallGradH.addColorStop(1, '#3D2510');
    ctx.fillStyle = wallGradH;
    ctx.fillRect(0, 0, canvas.width, wallW);
    ctx.fillRect(0, canvas.height - wallW, canvas.width, wallW);

    const wallGradV = ctx.createLinearGradient(0, 0, wallW, 0);
    wallGradV.addColorStop(0, '#7B5A2E');
    wallGradV.addColorStop(0.3, '#5C3A1E');
    wallGradV.addColorStop(1, '#3D2510');
    ctx.fillStyle = wallGradV;
    ctx.fillRect(0, 0, wallW, canvas.height);
    ctx.fillRect(canvas.width - wallW, 0, wallW, canvas.height);

    for (let i = 0; i < GRID; i++) {
        const plankGrad = ctx.createLinearGradient(0, i * plankH + 4, 0, i * plankH + plankH - 4);
        plankGrad.addColorStop(0, '#A07828');
        plankGrad.addColorStop(0.5, '#8B6914');
        plankGrad.addColorStop(1, '#6B4F12');
        ctx.fillStyle = plankGrad;
        ctx.fillRect(0, i * plankH + 4, wallW, plankH - 8);
        ctx.fillRect(canvas.width - wallW, i * plankH + 4, wallW, plankH - 8);
    }
    for (let i = 0; i < GRID; i++) {
        const plankGrad = ctx.createLinearGradient(i * TILE + 4, 0, i * TILE + TILE - 4, 0);
        plankGrad.addColorStop(0, '#A07828');
        plankGrad.addColorStop(0.5, '#8B6914');
        plankGrad.addColorStop(1, '#6B4F12');
        ctx.fillStyle = plankGrad;
        ctx.fillRect(i * TILE + 4, 0, TILE - 8, wallW);
        ctx.fillRect(i * TILE + 4, canvas.height - wallW, TILE - 8, wallW);
    }

    ctx.fillStyle = '#A07828';
    for (let i = 0; i < GRID; i++) {
        ctx.fillRect(1, i * plankH + 6, 3, plankH - 12);
        ctx.fillRect(canvas.width - 4, i * plankH + 6, 3, plankH - 12);
    }
    for (let i = 0; i < GRID; i++) {
        ctx.fillRect(i * TILE + 6, 1, TILE - 12, 3);
        ctx.fillRect(i * TILE + 6, canvas.height - 4, TILE - 12, 3);
    }

    teleporters.forEach((t, ti) => {
        const remaining = 1 - (Date.now() - t.born) / 10000;
        const alpha = remaining < 0.3 ? remaining / 0.3 : 1;
        const pulse = remaining < 0.3 ? 0.5 + 0.5 * Math.sin(teleporterAnim * (0.3 + (1 - remaining) * 1.2)) : 1;
        const a = alpha * pulse;

        let edge;
        if (t.entry.x === 0) edge = 'left';
        else if (t.entry.x === GRID - 1) edge = 'right';
        else if (t.entry.y === 0) edge = 'top';
        else edge = 'bottom';

        let ecx = t.entry.x * TILE + TILE / 2;
        let ecy = t.entry.y * TILE + TILE / 2;
        const wallShift = TILE * 0.35;
        if (edge === 'left') ecx -= wallShift;
        else if (edge === 'right') ecx += wallShift;
        else if (edge === 'top') ecy -= wallShift;
        else ecy += wallShift;

        drawTeleporter(ecx, ecy, a, remaining, t.color || '#00a2ff', edge);

        if (Math.random() < 0.4) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 0.5 + Math.random() * 1.5;
            sparks.push({
                x: ecx, y: ecy,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1,
                decay: 0.03 + Math.random() * 0.04,
                size: 1 + Math.random() * 2,
                color: t.color
            });
        }
    });

    for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx;
        s.y += s.vy;
        s.life -= s.decay;
        if (s.life <= 0) { sparks.splice(i, 1); continue; }
        ctx.globalAlpha = s.life;
        ctx.fillStyle = s.color || '#e040fb';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (magnetPull) {
        const fx = magnetPull.fromX + (magnetPull.toX - magnetPull.fromX) * magnetPull.progress;
        const fy = magnetPull.fromY + (magnetPull.toY - magnetPull.fromY) * magnetPull.progress;
        drawLog(fx * TILE + TILE / 2, fy * TILE + TILE / 2);
    } else {
        drawLog(food.x * TILE + TILE / 2, food.y * TILE + TILE / 2);
    }

    if (powerups.length) {
        powerups.forEach(p => {
            if (p.type === 'shield') drawCorn(p.x * TILE + TILE / 2, p.y * TILE + TILE / 2);
            if (p.type === 'magnet') drawCherry(p.x * TILE + TILE / 2, p.y * TILE + TILE / 2);
        });
    }

    const t = Math.min(tickProgress, 1);
    const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

    beaver.forEach((s, i) => {
        const prev = prevBeaver[i] || s;
        const px = prev.x * TILE + TILE / 2;
        const py = prev.y * TILE + TILE / 2;
        const cx = s.x * TILE + TILE / 2;
        const cy = s.y * TILE + TILE / 2;
        const ix = px + (cx - px) * ease;
        const iy = py + (cy - py) * ease;

        if (i === 0) {
            if (bonuses.has('shield')) {
                const glowAlpha = 0.15 + 0.1 * Math.sin(beaverFrame * 0.08);
                ctx.globalAlpha = glowAlpha;
                ctx.fillStyle = '#f5d442';
                ctx.beginPath();
                ctx.arc(ix, iy, TILE * 0.55, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
            }
            drawBeaverHead(ix, iy, direction);

            if (bonuses.has('magnet')) {
                const mOrbit = beaverFrame * 0.08;
                const mR = TILE * 0.48;
                const mBlue = Math.sin(beaverFrame * 0.2) > 0;
                const mColor = magnetPull ? (mBlue ? '#4488ff' : '#ff4444') : '#ff4444';
                const mx = ix + Math.cos(mOrbit) * mR;
                const my = iy + Math.sin(mOrbit) * mR;
                const mrg = ctx.createRadialGradient(mx, my, 0, mx, my, 7);
                mrg.addColorStop(0, '#fff');
                mrg.addColorStop(0.4, mColor);
                mrg.addColorStop(1, mColor + '00');
                ctx.fillStyle = mrg;
                ctx.beginPath();
                ctx.arc(mx, my, 5, 0, Math.PI * 2);
                ctx.fill();
            }
        } else {
            const r = TILE / 2 - 3;

            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.beginPath();
            ctx.ellipse(ix + 2, iy + 3, r * 0.9, r * 0.7, 0, 0, Math.PI * 2);
            ctx.fill();

            const bodyGrad = ctx.createRadialGradient(ix - r * 0.2, iy - r * 0.3, r * 0.1, ix, iy, r);
            bodyGrad.addColorStop(0, '#C4915A');
            bodyGrad.addColorStop(0.4, '#A0724A');
            bodyGrad.addColorStop(0.8, '#8B5E3C');
            bodyGrad.addColorStop(1, '#6B4226');
            ctx.fillStyle = bodyGrad;
            ctx.beginPath();
            ctx.arc(ix, iy, r, 0, Math.PI * 2);
            ctx.fill();

            const innerGrad = ctx.createRadialGradient(ix - r * 0.15, iy - r * 0.2, r * 0.05, ix, iy, r * 0.7);
            innerGrad.addColorStop(0, '#D4A574');
            innerGrad.addColorStop(0.5, '#A0724A');
            innerGrad.addColorStop(1, '#8B5E3C');
            ctx.fillStyle = innerGrad;
            ctx.beginPath();
            ctx.arc(ix, iy, r * 0.7, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = 'rgba(255,255,255,0.08)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(ix - r * 0.15, iy - r * 0.2, r * 0.5, Math.PI * 1.2, Math.PI * 1.8);
            ctx.stroke();
        }
    });

    if (beaver.length > 1) {
        const tail = beaver[beaver.length - 1];
        const tailPrev = prevBeaver[beaver.length - 1] || tail;
        const tx = (tailPrev.x * TILE + TILE / 2) + ((tail.x * TILE + TILE / 2) - (tailPrev.x * TILE + TILE / 2)) * ease;
        const ty = (tailPrev.y * TILE + TILE / 2) + ((tail.y * TILE + TILE / 2) - (tailPrev.y * TILE + TILE / 2)) * ease;

        if (paused) {
            pauseAngle += 0.15;
            const spinR = TILE * 0.3;
            for (let i = 0; i < 5; i++) {
                const a = pauseAngle + (Math.PI * 2 / 5) * i;
                const sx = tx + Math.cos(a) * spinR;
                const sy = ty + Math.sin(a) * spinR;
                const alpha = 0.3 + 0.7 * ((i + 1) / 5);
                ctx.globalAlpha = alpha;
                ctx.fillStyle = '#5C3A1E';
                ctx.beginPath();
                ctx.ellipse(sx, sy, TILE * 0.12, TILE * 0.08, a, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
        } else {
            ctx.fillStyle = '#5C3A1E';
            ctx.beginPath();
            ctx.ellipse(tx, ty, TILE * 0.2, TILE * 0.12, 0, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    if (paused) {
        ctx.fillStyle = 'rgba(10,14,26,0.6)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#7eb8da';
        ctx.font = 'bold 36px Segoe UI';
        ctx.textAlign = 'center';
        ctx.fillText('ПАУЗА', canvas.width / 2, canvas.height / 2 - 10);
        ctx.fillStyle = '#5a8a9f';
        ctx.font = '16px Segoe UI';
        ctx.fillText('Enter — продолжить', canvas.width / 2, canvas.height / 2 + 25);
    }

    if (gameOver) {
        ctx.fillStyle = 'rgba(10,14,26,0.85)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        if (consecutiveLosses >= 2) {
            drawBeaverFaceAngry(canvas.width / 2, canvas.height / 2 - 40);

            if (mouseX >= 0 && mouseY >= 0 && Date.now() - lastLaserSpawn > 1000 && Math.random() < 0.15) {
                const eyeR = 70 * 0.35;
                for (const side of [-1, 1]) {
                    lasers.push({
                        x: canvas.width / 2 + side * eyeR,
                        y: canvas.height / 2 - 40 - 70 * 0.08,
                        tx: mouseX,
                        ty: mouseY,
                        life: 1,
                        decay: 0.03
                    });
                }
                lastLaserSpawn = Date.now();
            }

            ctx.fillStyle = '#e8967a';
            ctx.font = '20px Segoe UI';
            ctx.textAlign = 'center';
            const msg = angryMessages[Math.floor(beaverFrame / 60) % angryMessages.length];
            ctx.fillText(msg, canvas.width / 2, canvas.height / 2 + 80);
        } else {
            drawBeaverFaceSad(canvas.width / 2, canvas.height / 2 - 40);
            ctx.fillStyle = '#7eb8da';
            ctx.font = '20px Segoe UI';
            ctx.textAlign = 'center';
            const msg = beaverMessages[Math.floor(beaverFrame / 80) % beaverMessages.length];
            ctx.fillText(msg, canvas.width / 2, canvas.height / 2 + 80);
        }
        ctx.fillStyle = '#5a8a9f';
        ctx.font = '16px Segoe UI';
        ctx.fillText('Нажмите любую клавишу', canvas.width / 2, canvas.height / 2 + 110);

        for (let i = lasers.length - 1; i >= 0; i--) {
            const l = lasers[i];
            l.life -= l.decay;
            if (l.life <= 0) { lasers.splice(i, 1); continue; }
            const dx = l.tx - l.x;
            const dy = l.ty - l.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            const nx = dx / len;
            const ny = dy / len;
            const endX = l.x + nx * len * l.life;
            const endY = l.y + ny * len * l.life;
            ctx.globalAlpha = l.life;
            ctx.strokeStyle = '#ff0040';
            ctx.lineWidth = 3;
            ctx.shadowColor = '#ff0040';
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.moveTo(l.x, l.y);
            ctx.lineTo(endX, endY);
            ctx.stroke();
            ctx.strokeStyle = '#ff6090';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(l.x, l.y);
            ctx.lineTo(endX, endY);
            ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;
        }
    }

    if (gameWon) {
        ctx.fillStyle = 'rgba(10,14,26,0.75)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        drawFireworks();
        drawBeaverFaceHappy(canvas.width / 2, canvas.height / 2 - 40);
        ctx.fillStyle = '#7eb8da';
        ctx.font = '32px Segoe UI';
        ctx.textAlign = 'center';
        ctx.fillText('Победа!', canvas.width / 2, canvas.height / 2 - 100);
        ctx.fillStyle = '#aaccee';
        ctx.font = '20px Segoe UI';
        ctx.fillText('Брёвен: ' + beaver.length, canvas.width / 2, canvas.height / 2 + 90);
        ctx.fillText('Нажмите любую клавишу', canvas.width / 2, canvas.height / 2 + 120);
    }
}

// ═══════════════════════════════════════════
// Game Over / Win
// ═══════════════════════════════════════════

function endGame() {
    gameOver = true;
    gameRunning = false;
    consecutiveLosses++;
    if (score > highScore) {
        highScore = score;
        safeSetItem('beaverHighScore', highScore);
        highscoreEl.textContent = highScore;
    }
    beaverFrame = 0;
    beaverAnim = requestAnimationFrame(beaverFrameLoop);
}

function winGame() {
    gameWon = true;
    gameRunning = false;
    consecutiveLosses = 0;
    if (score > highScore) {
        highScore = score;
        safeSetItem('beaverHighScore', highScore);
        highscoreEl.textContent = highScore;
    }
    spawnFirework();
    fireworkTimer = 0;
    fireworksLoop = requestAnimationFrame(fireworksFrame);
}

// ═══════════════════════════════════════════
// AI & Safety
// ═══════════════════════════════════════════

function isSafe(x, y) {
    if (x < 0 || x >= GRID || y < 0 || y >= GRID) {
        return teleporters.some(t => t.behind.x === x && t.behind.y === y);
    }
    return !beaver.some(s => s.x === x && s.y === y);
}

function findSafeDirection() {
    const head = beaver[0];
    const dirs = [
        { x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }
    ];
    for (const d of dirs) {
        if (direction.x === -d.x && direction.y === -d.y && beaver.length > 1) continue;
        const nx = head.x + d.x;
        const ny = head.y + d.y;
        if (isSafe(nx, ny)) return d;
    }
    return null;
}

function dist(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function getTarget() {
    let best = food;
    let bestDist = dist(beaver[0], food);
    for (const p of powerups) {
        if (bonuses.has(p.type)) continue;
        const d = dist(beaver[0], p);
        if (d < bestDist) {
            bestDist = d;
            best = p;
        }
    }
    return best;
}

function teleporterShortcut(from, to) {
    if (!teleporters.length || aiTeleporterUsed >= 1) return null;
    const t0 = teleporters[0];
    const t1 = teleporters[1];
    const direct = dist(from, to);

    const opts = [
        { entry: t0.entry, behind: t1.entry, dir: t1.dir },
        { entry: t1.entry, behind: t0.entry, dir: t0.dir }
    ];

    let best = null;
    let bestDist = direct;
    for (const o of opts) {
        const toEntry = dist(from, o.entry);
        const fromExit = dist(o.behind, to);
        const total = toEntry + fromExit;
        if (total < bestDist) {
            bestDist = total;
            best = { target: o.entry, entryDist: toEntry };
        }
    }
    return best;
}

function aiMove() {
    const head = beaver[0];
    const target = getTarget();

    const shortcut = teleporterShortcut(head, target);
    const goal = shortcut ? shortcut.target : target;

    const dirs = [];
    const dx = goal.x - head.x;
    const dy = goal.y - head.y;

    if (dx > 0) dirs.push({ x: 1, y: 0 });
    else if (dx < 0) dirs.push({ x: -1, y: 0 });
    if (dy > 0) dirs.push({ x: 0, y: 1 });
    else if (dy < 0) dirs.push({ x: 0, y: -1 });

    if (dx !== 0) dirs.push({ x: 0, y: dy > 0 ? 1 : -1 });
    if (dy !== 0) dirs.push({ x: dx > 0 ? 1 : -1, y: 0 });

    dirs.push({ x: 0, y: -1 });
    dirs.push({ x: 0, y: 1 });
    dirs.push({ x: -1, y: 0 });
    dirs.push({ x: 1, y: 0 });

    for (const d of dirs) {
        if (direction.x === -d.x && direction.y === -d.y && beaver.length > 1) continue;
        const nx = head.x + d.x;
        const ny = head.y + d.y;
        if (!isSafe(nx, ny)) continue;

        const isTeleporterEntry = teleporters.some(t => t.behind.x === nx && t.behind.y === ny);
        if (isTeleporterEntry && aiTeleporterUsed >= 1) continue;

        if (isTeleporterEntry) aiTeleporterUsed++;

        nextDirection = d;
        return;
    }
}

// ═══════════════════════════════════════════
// Game Tick
// ═══════════════════════════════════════════

function gameTick() {
    aiTeleporterUsed = 0;
    if (autoPlay && gameRunning) aiMove();
    update();
    teleporterAnim++;
    spawnPowerup('shield');
    spawnPowerup('magnet');
    if (settings.teleportersEnabled && Date.now() - lastTeleportSpawn >= 10000) {
        if (beaver.length > 1) {
            const ticksPassed = teleporterAnim - teleporterEntryAnim;
            if (ticksPassed < beaver.length) {
                beaver.length = ticksPassed + 1;
                prevBeaver.length = ticksPassed + 1;
            }
        }
        spawnTeleporters();
        lastTeleportSpawn = Date.now();
        teleporterEntryAnim = teleporterAnim;
    }
    tickProgress = 0;
    lastTickTime = performance.now();
    if (!gameOver && !gameWon) draw();
}

// ═══════════════════════════════════════════
// Render Loop & Game Loop
// ═══════════════════════════════════════════

let tickAccumulator = 0;
let lastFrameTime = 0;

function drawPopupBeaverHead(c, cx, cy) {
    const r = 23;

    c.fillStyle = 'rgba(0,0,0,0.2)';
    c.beginPath();
    c.ellipse(cx + 2, cy + 3, r * 0.9, r * 0.7, 0, 0, Math.PI * 2);
    c.fill();

    const headGrad = c.createRadialGradient(cx - r * 0.25, cy - r * 0.3, r * 0.1, cx, cy, r);
    headGrad.addColorStop(0, '#D4A574');
    headGrad.addColorStop(0.3, '#B8834A');
    headGrad.addColorStop(0.7, '#8B5E3C');
    headGrad.addColorStop(1, '#6B4226');
    c.fillStyle = headGrad;
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    c.fill();

    const muzzleGrad = c.createRadialGradient(cx - r * 0.1, cy + r * 0.15, r * 0.05, cx, cy + r * 0.2, r * 0.5);
    muzzleGrad.addColorStop(0, '#D4A574');
    muzzleGrad.addColorStop(0.5, '#B8834A');
    muzzleGrad.addColorStop(1, '#A0724A');
    c.fillStyle = muzzleGrad;
    c.beginPath();
    c.ellipse(cx, cy + r * 0.2, r * 0.6, r * 0.45, 0, 0, Math.PI * 2);
    c.fill();

    c.strokeStyle = 'rgba(255,255,255,0.1)';
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(cx - r * 0.2, cy - r * 0.25, r * 0.5, Math.PI * 1.1, Math.PI * 1.7);
    c.stroke();

    c.fillStyle = '#1a237e';
    c.beginPath();
    c.roundRect(cx - r * 0.85 / 2, cy - r * 0.55 - 4, r * 0.85, 8, 2);
    c.fill();
    c.fillStyle = '#9e9e9e';
    c.beginPath();
    c.roundRect(cx - r * 0.85 * 0.3, cy - r * 0.55 - 3, r * 0.85 * 0.6, 6, 1);
    c.fill();

    const eyeSpacing = r * 0.35;
    const eyeY = cy - r * 0.08;
    const eyeW = r * 0.2;
    const eyeH = r * 0.25;
    let eyeOffX = 0, eyeOffY = 0;
    const popup = c.canvas.closest('.popup');
    if (popup) {
        const rect = popup.getBoundingClientRect();
        const localMouseX = (mouseClientX - rect.left) * (c.canvas.width / rect.width);
        const localMouseY = (mouseClientY - rect.top) * (c.canvas.height / rect.height);
        const dx = localMouseX - cx;
        const dy = localMouseY - cy;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 2) {
            const maxOff = r * 0.12;
            eyeOffX = Math.max(-maxOff, Math.min(maxOff, (dx / len) * maxOff));
            eyeOffY = Math.max(-maxOff, Math.min(maxOff, (dy / len) * maxOff));
        }
    }

    for (const side of [-1, 1]) {
        const ex = cx + side * eyeSpacing;
        c.fillStyle = 'rgba(0,0,0,0.15)';
        c.beginPath();
        c.ellipse(ex + 1, eyeY + 2, eyeW + 1, eyeH + 1, 0, 0, Math.PI * 2);
        c.fill();
        const eyeGrad = c.createRadialGradient(ex - eyeW * 0.2, eyeY - eyeH * 0.2, 0, ex, eyeY, eyeW);
        eyeGrad.addColorStop(0, '#fff');
        eyeGrad.addColorStop(1, '#d0d0d0');
        c.fillStyle = eyeGrad;
        c.beginPath();
        c.ellipse(ex, eyeY, eyeW, eyeH, 0, 0, Math.PI * 2);
        c.fill();
        const irisGrad = c.createRadialGradient(ex + eyeOffX, eyeY + eyeOffY, 0, ex + eyeOffX, eyeY + eyeOffY, eyeW * 0.55);
        irisGrad.addColorStop(0, '#2196F3');
        irisGrad.addColorStop(1, '#0D47A1');
        c.fillStyle = irisGrad;
        c.beginPath();
        c.ellipse(ex + eyeOffX, eyeY + eyeOffY + r * 0.02, eyeW * 0.55, eyeH * 0.6, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#111';
        c.beginPath();
        c.arc(ex + eyeOffX, eyeY + eyeOffY + r * 0.03, eyeW * 0.28, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#fff';
        c.beginPath();
        c.arc(ex + eyeOffX - eyeW * 0.15, eyeY + eyeOffY - r * 0.06, eyeW * 0.15, 0, Math.PI * 2);
        c.fill();
    }

    const noseGrad = c.createRadialGradient(cx, cy + r * 0.17, 0, cx, cy + r * 0.2, r * 0.07);
    noseGrad.addColorStop(0, '#555');
    noseGrad.addColorStop(1, '#222');
    c.fillStyle = noseGrad;
    c.beginPath();
    c.ellipse(cx, cy + r * 0.2, r * 0.07, r * 0.04, 0, 0, Math.PI * 2);
    c.fill();

    const teethGrad = c.createLinearGradient(cx, cy + r * 0.32, cx, cy + r * 0.5);
    teethGrad.addColorStop(0, '#fff');
    teethGrad.addColorStop(1, '#ddd');
    c.fillStyle = teethGrad;
    const tw = r * 0.12, th = r * 0.18, g = r * 0.015;
    c.beginPath();
    c.roundRect(cx - tw - g, cy + r * 0.32, tw, th, 1);
    c.fill();
    c.beginPath();
    c.roundRect(cx + g, cy + r * 0.32, tw, th, 1);
    c.fill();

    c.strokeStyle = '#5C3A1E';
    c.lineWidth = 0.8;
    for (const side of [-1, 1]) {
        const bx = cx + side * r * 0.35;
        const by = cy + r * 0.15;
        for (let i = -1; i <= 1; i++) {
            c.beginPath();
            c.moveTo(bx, by + i * r * 0.06);
            c.lineTo(bx + side * r * 0.25, by + i * r * 0.06 - r * 0.02);
            c.stroke();
        }
    }
}

function drawPopupBeaver() {
    const settingsActive = settingsOverlay.classList.contains('active');
    const helpActive = helpOverlay.classList.contains('active');
    if (!settingsActive && !helpActive) return;

    if (settingsActive) {
        const cvs = document.getElementById('settingsBeaver');
        if (cvs) {
            const c = cvs.getContext('2d');
            c.clearRect(0, 0, cvs.width, cvs.height);
            c.fillStyle = '#0a0e1a';
            c.fillRect(0, 0, cvs.width, cvs.height);
            drawPopupBeaverHead(c, cvs.width / 2, cvs.height / 2);
        }
    }

    if (helpActive) {
        const cvs = document.getElementById('helpBeaver');
        if (cvs) {
            const c = cvs.getContext('2d');
            c.clearRect(0, 0, cvs.width, cvs.height);
            c.fillStyle = '#0a0e1a';
            c.fillRect(0, 0, cvs.width, cvs.height);
            drawPopupBeaverHead(c, cvs.width / 2, cvs.height / 2);
        }
    }
}

function renderFrame(now) {
    if (!lastFrameTime) lastFrameTime = now;
    const delta = Math.min(now - lastFrameTime, 500);
    lastFrameTime = now;
    beaverFrame++;

    if (magnetPull) {
        magnetPull.progress = Math.min(1, magnetPull.progress + 0.12);
        if (magnetPull.progress >= 1) magnetPull = null;
    }

    if (paused) {
        draw();
        drawPopupBeaver();
        renderLoop = requestAnimationFrame(renderFrame);
        return;
    }

    if (gameRunning && !gameOver && !gameWon) {
        tickAccumulator += delta;
        while (tickAccumulator >= currentSpeed) {
            tickAccumulator -= currentSpeed;
            gameTick();
            if (gameOver || gameWon || paused) {
                tickAccumulator = 0;
                break;
            }
        }
        tickProgress = Math.min(tickAccumulator / currentSpeed, 1);
        draw();
    } else if (!gameRunning && !gameOver && !gameWon) {
        draw();
    } else {
        tickAccumulator = 0;
    }

    drawPopupBeaver();

    renderLoop = requestAnimationFrame(renderFrame);
}

function startGame(dir, enableAutoPlay) {
    if (enableAutoPlay) {
        autoPlay = true;
        canvas.classList.add('auto');
    } else {
        autoPlay = false;
        canvas.classList.remove('auto');
    }
    direction = { ...dir };
    nextDirection = { ...dir };
    currentSpeed = settings.startSpeed;
    gameRunning = true;
    lastTickTime = performance.now();
    lastFrameTime = 0;
    tickProgress = 1;
    tickAccumulator = 0;
    if (!renderLoop) renderLoop = requestAnimationFrame(renderFrame);
}

function keyToDirection(key) {
    if (key === 'ArrowUp' || key === 'w' || key === 'Shift') return { x: 0, y: -1 };
    if (key === 'ArrowDown' || key === 's') return { x: 0, y: 1 };
    if (key === 'ArrowLeft' || key === 'a') return { x: -1, y: 0 };
    if (key === 'ArrowRight' || key === 'd') return { x: 1, y: 0 };
    return null;
}

init();

// ═══════════════════════════════════════════
// Input Handlers
// ═══════════════════════════════════════════

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (settingsOverlay.classList.contains('active')) {
            settingsOverlay.classList.remove('active');
            if (speedPreviewAnim) { cancelAnimationFrame(speedPreviewAnim); speedPreviewAnim = null; }
            return;
        }
        if (reviewsOverlay.classList.contains('active')) {
            reviewsOverlay.classList.remove('active');
            return;
        }
        if (helpOverlay.classList.contains('active')) {
            helpOverlay.classList.remove('active');
            return;
        }
    }

    if (settingsOverlay.classList.contains('active') || reviewsOverlay.classList.contains('active') || helpOverlay.classList.contains('active')) return;

    const key = e.key;
    const movementKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', 'Shift'];

    if (key === ' ' || e.code === 'Space') {
        e.preventDefault();
        if (gameRunning) {
            autoPlay = !autoPlay;
            canvas.classList.toggle('auto', autoPlay);
        } else if (!gameOver && !gameWon) {
            startGame({ x: 1, y: 0 }, true);
        } else {
            init();
            startGame({ x: 1, y: 0 }, true);
        }
        return;
    }

    if (key === 'Enter' && gameRunning && !gameOver && !gameWon) {
        e.preventDefault();
        paused = !paused;
        if (!paused) {
            lastTickTime = performance.now();
            lastFrameTime = 0;
            tickProgress = 1;
            tickAccumulator = 0;
        }
        return;
    }

    if (!gameRunning && !gameOver && !gameWon && movementKeys.includes(key)) {
        startGame(keyToDirection(key), false);
    }

    if ((gameOver || gameWon) && movementKeys.includes(key)) {
        init();
        startGame(keyToDirection(key), false);
    }

    if (!gameRunning) return;

    const canReverse = beaver.length <= 1;

    if ((key === 'ArrowUp' || key === 'w' || key === 'Shift') && (canReverse || direction.y !== 1)) {
        nextDirection = { x: 0, y: -1 };
    } else if ((key === 'ArrowDown' || key === 's') && (canReverse || direction.y !== -1)) {
        nextDirection = { x: 0, y: 1 };
    } else if ((key === 'ArrowLeft' || key === 'a') && (canReverse || direction.x !== 1)) {
        nextDirection = { x: -1, y: 0 };
    } else if ((key === 'ArrowRight' || key === 'd') && (canReverse || direction.x !== -1)) {
        nextDirection = { x: 1, y: 0 };
    }
});

document.addEventListener('mousemove', (e) => {
    mouseClientX = e.clientX;
    mouseClientY = e.clientY;
    const rect = canvas.getBoundingClientRect();
    mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
    mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
});

canvas.addEventListener('mouseleave', () => {
    mouseX = -1;
    mouseY = -1;
});

// ═══════════════════════════════════════════
// Help Canvas Animations
// ═══════════════════════════════════════════

(function() {
    let helpAnimFrame = null;
    let helpFrame = 0;

    function drawHelpAnimations() {
        helpFrame++;

        const logCanvas = document.getElementById('helpLog');
        if (logCanvas) {
            const ctx = logCanvas.getContext('2d');
            ctx.clearRect(0, 0, 200, 60);
            ctx.fillStyle = '#0a0e1a';
            ctx.fillRect(0, 0, 200, 60);

            ctx.fillStyle = '#0d1b2a';
            ctx.fillRect(0, 0, 200, 60);

            const bx = 30 + Math.sin(helpFrame * 0.04) * 25;
            ctx.fillStyle = '#8B5E3C';
            ctx.beginPath();
            ctx.arc(bx, 30, 10, 0, Math.PI * 2);
            ctx.fill();

            const logX = 140 + Math.sin(helpFrame * 0.02) * 10;
            ctx.fillStyle = '#6B4F12';
            ctx.beginPath();
            ctx.roundRect(logX - 14, 22, 28, 16, 4);
            ctx.fill();
            ctx.fillStyle = '#8B6914';
            ctx.beginPath();
            ctx.roundRect(logX - 12, 24, 24, 12, 3);
            ctx.fill();

            if (Math.abs(bx - logX) < 20) {
                ctx.fillStyle = '#53d769';
                ctx.font = 'bold 14px Segoe UI';
                ctx.textAlign = 'center';
                ctx.fillText('+1', logX, 16);
            }
        }

        const tpCanvas = document.getElementById('helpTeleport');
        if (tpCanvas) {
            const ctx = tpCanvas.getContext('2d');
            ctx.clearRect(0, 0, 200, 80);
            ctx.fillStyle = '#0d1b2a';
            ctx.fillRect(0, 0, 200, 80);

            const flash = 0.5 + 0.5 * Math.sin(helpFrame * 0.1);
            const blue = '#00a2ff';
            const orange = '#ff6a00';

            ctx.globalAlpha = 0.3 + flash * 0.2;
            ctx.fillStyle = blue;
            ctx.beginPath();
            ctx.ellipse(30, 40, 6, 12, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = orange;
            ctx.beginPath();
            ctx.ellipse(170, 40, 6, 12, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;

            ctx.strokeStyle = blue;
            ctx.lineWidth = 2;
            ctx.shadowColor = blue;
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.ellipse(30, 40, 6, 12, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.strokeStyle = orange;
            ctx.shadowColor = orange;
            ctx.beginPath();
            ctx.ellipse(170, 40, 6, 12, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.shadowBlur = 0;

            ctx.strokeStyle = blue;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.ellipse(30, 40, 4.5, 9, helpFrame * 0.06, 0, Math.PI * 0.7);
            ctx.stroke();
            ctx.strokeStyle = orange;
            ctx.beginPath();
            ctx.ellipse(170, 40, 4.5, 9, -helpFrame * 0.06 + Math.PI, 0, Math.PI * 0.7);
            ctx.stroke();

            for (let i = 0; i < 2; i++) {
                const angle = helpFrame * 0.08 + Math.PI * i;
                ctx.fillStyle = blue;
                ctx.beginPath();
                ctx.arc(30 + Math.cos(angle) * 5, 40 + Math.sin(angle) * 10, 1.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = orange;
                ctx.beginPath();
                ctx.arc(170 + Math.cos(-angle) * 5, 40 + Math.sin(-angle) * 10, 1.5, 0, Math.PI * 2);
                ctx.fill();
            }

            const travel = (helpFrame * 0.8) % 200;
            const tpX = travel < 100 ? 30 + travel * 1.4 : 170 - (travel - 100) * 1.4;
            ctx.fillStyle = '#8B5E3C';
            ctx.beginPath();
            ctx.arc(tpX, 40, 6, 0, Math.PI * 2);
            ctx.fill();
        }

        const cornCanvas = document.getElementById('helpCorn');
        if (cornCanvas) {
            const ctx = cornCanvas.getContext('2d');
            ctx.clearRect(0, 0, 200, 60);
            ctx.fillStyle = '#0d1b2a';
            ctx.fillRect(0, 0, 200, 60);

            const bx = 40 + Math.sin(helpFrame * 0.03) * 20;
            ctx.fillStyle = '#8B5E3C';
            ctx.beginPath();
            ctx.arc(bx, 30, 10, 0, Math.PI * 2);
            ctx.fill();

            const cornX = 150;
            const pulse = 1 + Math.sin(helpFrame * 0.1) * 0.1;
            ctx.fillStyle = '#f5d442';
            ctx.beginPath();
            ctx.ellipse(cornX, 30, 6 * pulse, 10 * pulse, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 0.3 + 0.2 * Math.sin(helpFrame * 0.08);
            ctx.fillStyle = '#f5d442';
            ctx.beginPath();
            ctx.arc(cornX, 30, 14 * pulse, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;

            if (Math.abs(bx - cornX) < 18) {
                ctx.globalAlpha = 0.3 + 0.3 * Math.sin(helpFrame * 0.15);
                ctx.fillStyle = '#f5d442';
                ctx.beginPath();
                ctx.arc(bx, 30, 18, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
                ctx.fillStyle = '#f5d442';
                ctx.font = 'bold 11px Segoe UI';
                ctx.textAlign = 'center';
                ctx.fillText('щит!', bx, 14);
            }

            if (Math.abs(bx - 80) < 5 && helpFrame % 200 > 100) {
                ctx.strokeStyle = '#e94560';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(bx + 10, 25);
                ctx.lineTo(bx + 18, 18);
                ctx.stroke();
                ctx.moveTo(bx + 10, 35);
                ctx.lineTo(bx + 18, 42);
                ctx.stroke();
            }
        }

        helpAnimFrame = requestAnimationFrame(drawHelpAnimations);
    }

    helpBtn.addEventListener('click', () => {
        if (!helpAnimFrame) drawHelpAnimations();
    });

    closeHelpBtn.addEventListener('click', () => {
        if (helpAnimFrame) { cancelAnimationFrame(helpAnimFrame); helpAnimFrame = null; }
    });

    helpOverlay.addEventListener('click', (e) => {
        if (e.target === helpOverlay && helpAnimFrame) { cancelAnimationFrame(helpAnimFrame); helpAnimFrame = null; }
    });
})();
