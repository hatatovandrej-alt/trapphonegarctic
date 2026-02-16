// ========== ИНИЦИАЛИЗАЦИЯ ==========
const socket = io();
const sounds = new SoundManager();
let drawingCanvas = null;
let currentRoomId = null;
let isHost = false;
let currentChainIndex = 0;
let gameChains = [];

// ========== УТИЛИТЫ ==========
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(`screen-${id}`).classList.add('active');
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function showConfetti() {
    const colors = ['#ff6b6b', '#4ecdc4', '#ffe66d', '#9775fa', '#ff69b4', '#51cf66'];
    for (let i = 0; i < 50; i++) {
        const piece = document.createElement('div');
        piece.className = 'confetti-piece';
        piece.style.left = Math.random() * 100 + 'vw';
        piece.style.background = colors[Math.floor(Math.random() * colors.length)];
        piece.style.animationDelay = Math.random() * 2 + 's';
        piece.style.animationDuration = (2 + Math.random() * 2) + 's';
        piece.style.width = (5 + Math.random() * 10) + 'px';
        piece.style.height = piece.style.width;
        piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
        document.body.appendChild(piece);
        setTimeout(() => piece.remove(), 5000);
    }
}

// ========== ГЛАВНЫЙ ЭКРАН ==========
document.getElementById('btn-create').addEventListener('click', () => {
    const name = document.getElementById('player-name').value.trim();
    if (!name) {
        showToast('Введи имя!', 'error');
        return;
    }
    sounds.init();
    socket.emit('create-room', { playerName: name, settings: {} });
});

document.getElementById('btn-join').addEventListener('click', () => {
    const name = document.getElementById('player-name').value.trim();
    const code = document.getElementById('room-code-input').value.trim().toUpperCase();
    if (!name) { showToast('Введи имя!', 'error'); return; }
    if (!code) { showToast('Введи код комнаты!', 'error'); return; }
    sounds.init();
    socket.emit('join-room', { roomId: code, playerName: name });
});

// Enter для быстрого входа
document.getElementById('room-code-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('btn-join').click();
});

document.getElementById('player-name').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('btn-create').click();
});

// ========== ЛОББИ ==========
socket.on('room-created', (room) => {
    currentRoomId = room.id;
    isHost = true;
    showLobby(room);
    sounds.play('join');
});

socket.on('room-joined', (room) => {
    currentRoomId = room.id;
    isHost = room.hostId === socket.id;
    showLobby(room);
    sounds.play('join');
});

socket.on('player-joined', ({ players, newPlayer }) => {
    updatePlayersList(players);
    showToast(`${newPlayer} присоединился! 🎉`, 'success');
    sounds.play('join');
});

socket.on('player-left', ({ players }) => {
    updatePlayersList(players);
});

function showLobby(room) {
    showScreen('lobby');
    document.getElementById('room-code-display').textContent = room.id;
    updatePlayersList(room.players);

    // Настройки видны только хосту
    const settingsPanel = document.getElementById('settings-panel');
    const startBtn = document.getElementById('btn-start-game');
    settingsPanel.style.display = isHost ? 'block' : 'none';
    startBtn.style.display = isHost ? 'block' : 'none';

    if (!isHost) {
        document.getElementById('lobby-status').textContent = 'Ждём, пока хост начнёт игру...';
    }
}

function updatePlayersList(players) {
    const list = document.getElementById('players-list');
    list.innerHTML = players.map(p => `
        <div class="player-card ${p.id === socket.id ? 'host' : ''}">
            <div class="avatar">${p.avatar}</div>
            <div class="name">${p.name}</div>
            ${p.id === players[0]?.id ?
                '<div class="host-badge">👑 Хост</div>' : ''}
        </div>
    `).join('');
}

// Копировать код
document.getElementById('btn-copy-code').addEventListener('click', () => {
    navigator.clipboard.writeText(currentRoomId).then(() => {
        showToast('Код скопирован! 📋', 'success');
    });
});

// Настройки
document.getElementById('setting-draw-time').addEventListener('input', (e) => {
    document.getElementById('draw-time-value').textContent = e.target.value + 'с';
});

document.getElementById('setting-guess-time').addEventListener('input', (e) => {
    document.getElementById('guess-time-value').textContent = e.target.value + 'с';
});

// Старт игры
document.getElementById('btn-start-game').addEventListener('click', () => {
    socket.emit('start-game', { roomId: currentRoomId });
});

// ========== ИГРОВОЙ ПРОЦЕСС ==========
socket.on('game-started', ({ totalSteps, mode }) => {
    showToast('Игра началась! 🎮', 'success');
    sounds.play('complete');
});

socket.on('new-task', (task) => {
    if (task.type === 'write-first') {
        showWriteScreen('Придумай смешную фразу!', null, task);
    } else if (task.type === 'guess') {
        showWriteScreen('Что нарисовано?', task.imageData, task);
    } else if (task.type === 'draw') {
        showDrawScreen(task.phrase, task);
    }
});

function showWriteScreen(prompt, imageData, task) {
    showScreen('write');
    document.getElementById('write-prompt').textContent = prompt;
    document.getElementById('step-number').textContent =
        `Шаг ${task.step + 1}`;

    const refContainer = document.getElementById('reference-image-container');
    if (imageData) {
        refContainer.style.display = 'block';
        document.getElementById('reference-image').src = imageData;
    } else {
        refContainer.style.display = 'none';
    }

    document.getElementById('phrase-input').value = '';
    document.getElementById('phrase-input').focus();
}

function showDrawScreen(phrase, task) {
    showScreen('draw');
    document.getElementById('phrase-to-draw').textContent = phrase;
    document.getElementById('step-number-draw').textContent =
        `Шаг ${task.step + 1}`;

    // Инициализируем холст
    drawingCanvas = new DrawingCanvas('drawing-canvas');

    // Модификатор
    if (task.modifier && task.modifier.id !== 'none') {
        const banner = document.getElementById('modifier-banner');
        banner.style.display = 'block';
        document.getElementById('modifier-icon').textContent = task.modifier.icon;
        document.getElementById('modifier-text').textContent =
            `${task.modifier.name}: ${task.modifier.description}`;
        drawingCanvas.applyModifier(task.modifier);

        // Speed modifier — уменьшаем таймер
        if (task.modifier.id === 'speed') {
            task.timeLimit = 15;
        }
    } else {
        document.getElementById('modifier-banner').style.display = 'none';
    }

    setupToolbar();
}

function setupToolbar() {
    // Цвета
    document.querySelectorAll('.color-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            drawingCanvas.setColor(btn.dataset.color);
        });
    });

    // Размеры
    document.querySelectorAll('.size-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            drawingCanvas.setSize(parseInt(btn.dataset.size));
        });
    });

    // Инструменты
    document.getElementById('btn-eraser').addEventListener('click', function () {
        const active = drawingCanvas.toggleEraser();
        this.classList.toggle('active', active);
        document.getElementById('btn-fill').classList.remove('active');
    });

    document.getElementById('btn-fill').addEventListener('click', function () {
        const active = drawingCanvas.toggleFill();
        this.classList.toggle('active', active);
        document.getElementById('btn-eraser').classList.remove('active');
    });

    document.getElementById('btn-undo').addEventListener('click', () => {
        drawingCanvas.undo();
    });

    document.getElementById('btn-clear').addEventListener('click', () => {
        if (confirm('Очистить холст?')) {
            drawingCanvas.clear();
            drawingCanvas.saveState();
        }
    });
}

// Отправка фразы
document.getElementById('btn-submit-phrase').addEventListener('click', () => {
    const phrase = document.getElementById('phrase-input').value.trim();
    if (!phrase) { showToast('Напиши что-нибудь!', 'error'); return; }

    socket.emit('submit-phrase', { roomId: currentRoomId, phrase });
    sounds.play('submit');
    showScreen('waiting');
});

// Enter для отправки фразы
document.getElementById('phrase-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('btn-submit-phrase').click();
});

// Отправка рисунка
document.getElementById('btn-submit-drawing').addEventListener('click', () => {
    if (!drawingCanvas) return;
    const imageData = drawingCanvas.getImageData();
    socket.emit('submit-drawing', { roomId: currentRoomId, imageData });
    sounds.play('submit');
    drawingCanvas.resetModifier();
    showScreen('waiting');
});

// ========== ТАЙМЕР ==========
socket.on('timer-tick', ({ remaining }) => {
    const writeTimer = document.getElementById('timer-write-value');
    const drawTimer = document.getElementById('timer-draw-value');
    const activeTimer = document.querySelector('.screen.active .timer-circle');

    if (writeTimer) writeTimer.textContent = remaining;
    if (drawTimer) drawTimer.textContent = remaining;

    if (activeTimer) {
        activeTimer.classList.remove('warning', 'danger');
        if (remaining <= 5) {
            activeTimer.classList.add('danger');
            sounds.play('tick-danger');
        } else if (remaining <= 15) {
            activeTimer.classList.add('warning');
            sounds.play('tick-warning');
        }
    }
});

// ========== ПРОГРЕСС САБМИТОВ ==========
socket.on('submission-progress', ({ submitted, total }) => {
    const status = document.getElementById('waiting-progress');
    if (status) status.textContent = `${submitted} / ${total} отправили`;

    const drawStatus = document.getElementById('submission-status-draw');
    if (drawStatus) drawStatus.textContent = `${submitted} / ${total} готовы`;

    const writeStatus = document.getElementById('submission-status');
    if (writeStatus) writeStatus.textContent = `${submitted} / ${total} готовы`;
});

// ========== ПЕРЕХОД МЕЖДУ ШАГАМИ ==========
socket.on('step-transition', ({ nextStep, totalSteps }) => {
    showToast(`Шаг ${nextStep + 1} из ${totalSteps}`, 'info');
});

// ========== РЕЗУЛЬТАТЫ ==========
socket.on('game-ended', ({ chains, results, achievements }) => {
    gameChains = chains;
    currentChainIndex = 0;

    showScreen('results');
    showConfetti();
    sounds.play('complete');

    renderChain(0);
    renderAchievements(achievements);

    document.getElementById('chain-counter').textContent =
        `Цепочка 1 / ${chains.length}`;
});

function renderChain(index) {
    const chain = gameChains[index];
    if (!chain) return;

    const container = document.getElementById('chain-steps');
    container.innerHTML = '';

    // Анимированное раскрытие шагов
    chain.steps.forEach((step, i) => {
        setTimeout(() => {
            const div = document.createElement('div');
            div.className = `chain-step ${step.timeout ? 'timeout' : ''}`;

            let content = '';
            if (step.type === 'phrase') {
                content = `<div class="step-phrase">"${step.content}"</div>`;
            } else if (step.type === 'drawing') {
                content = step.content
                    ? `<div class="step-image"><img src="${step.content}" alt="Рисунок"></div>`
                    : '<div class="step-phrase" style="color:var(--danger)">(пустой рисунок)</div>';
            }

            div.innerHTML = `
                <div class="step-author">${step.authorAvatar} ${step.author}</div>
                ${content}
                ${i < chain.steps.length - 1 ? '<div class="step-arrow">⬇️</div>' : ''}
            `;

            container.appendChild(div);
            sounds.play('reveal');
        }, i * 800); // Раскрываем с задержкой
    });
}

function renderAchievements(achievements) {
    const list = document.getElementById('achievements-list');
    if (!achievements || achievements.length === 0) {
        list.innerHTML = '<p style="color:var(--text-secondary)">Нет наград в этом раунде</p>';
        return;
    }

    list.innerHTML = achievements.map((ach, i) => `
        <div class="achievement-card" style="animation-delay: ${i * 0.2}s">
            <div class="ach-icon">${ach.icon}</div>
            <div class="ach-info">
                <div class="ach-player">${ach.player}</div>
                <div class="ach-text">${ach.text}</div>
            </div>
        </div>
    `).join('');
}

// Навигация по цепочкам
document.getElementById('btn-prev-chain').addEventListener('click', () => {
    if (currentChainIndex > 0) {
        currentChainIndex--;
        renderChain(currentChainIndex);
        document.getElementById('chain-counter').textContent =
            `Цепочка ${currentChainIndex + 1} / ${gameChains.length}`;
    }
});

document.getElementById('btn-next-chain').addEventListener('click', () => {
    if (currentChainIndex < gameChains.length - 1) {
        currentChainIndex++;
        renderChain(currentChainIndex);
        document.getElementById('chain-counter').textContent =
            `Цепочка ${currentChainIndex + 1} / ${gameChains.length}`;
    }
});

// Реакции
document.querySelectorAll('.reaction-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const emoji = btn.dataset.emoji;
        socket.emit('submit-reaction', {
            roomId: currentRoomId,
            chainIndex: currentChainIndex,
            stepIndex: 0,
            emoji
        });

        // Анимация
        btn.style.transform = 'scale(1.5)';
        setTimeout(() => btn.style.transform = '', 200);

        showToast(`${emoji} отправлено!`, 'success');
    });
});

// Играть заново
document.getElementById('btn-play-again').addEventListener('click', () => {
    showScreen('lobby');
});

// Скачать цепочку
document.getElementById('btn-download-chain').addEventListener('click', () => {
    const chain = gameChains[currentChainIndex];
    if (!chain) return;

    // Создаём длинную картинку из цепочки
    const chainContainer = document.getElementById('chain-steps');
    showToast('Скопируй скриншот цепочки! 📸', 'info');
});

// ========== ОШИБКИ ==========
socket.on('error-message', (msg) => {
    showToast(msg, 'error');
    sounds.play('error');
});

socket.on('disconnect', () => {
    showToast('Потеряно соединение с сервером 😕', 'error');
});

socket.on('connect', () => {
    if (currentRoomId) {
        showToast('Переподключение...', 'info');
    }
});