class DrawingCanvas {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.isDrawing = false;
        this.color = '#000000';
        this.lineWidth = 3;
        this.isEraser = false;
        this.isFillMode = false;
        this.history = [];
        this.modifier = null;

        // Настраиваем контекст
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.strokeStyle = this.color;
        this.ctx.lineWidth = this.lineWidth;

        // Для режима "без отрыва"
        this.hasStarted = false;
        this.lastX = 0;
        this.lastY = 0;

        this.setupEvents();
        this.clear();
        this.saveState();
    }

    setupEvents() {
        // Мышь
        this.canvas.addEventListener('mousedown', (e) => this.startDraw(e));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e));
        this.canvas.addEventListener('mouseup', () => this.endDraw());
        this.canvas.addEventListener('mouseleave', () => this.endDraw());

        // Тач
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.startDraw(e.touches[0]);
        });
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this.draw(e.touches[0]);
        });
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.endDraw();
        });
    }

    getPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    }

    startDraw(e) {
        if (this.isFillMode) {
            const pos = this.getPos(e);
            this.floodFill(Math.round(pos.x), Math.round(pos.y), this.color);
            this.saveState();
            return;
        }

        this.isDrawing = true;
        const pos = this.getPos(e);

        // Модификатор "без отрыва" — продолжаем линию
        if (this.modifier?.id === 'no-lift' && this.hasStarted) {
            this.ctx.beginPath();
            this.ctx.moveTo(this.lastX, this.lastY);
            this.ctx.lineTo(pos.x, pos.y);
            this.ctx.stroke();
        }

        this.ctx.beginPath();
        this.ctx.moveTo(pos.x, pos.y);
        this.lastX = pos.x;
        this.lastY = pos.y;
        this.hasStarted = true;
    }

    draw(e) {
        if (!this.isDrawing) return;
        const pos = this.getPos(e);

        this.ctx.strokeStyle = this.isEraser ? '#FFFFFF' : this.color;
        this.ctx.lineWidth = this.isEraser ? this.lineWidth * 3 : this.lineWidth;

        this.ctx.lineTo(pos.x, pos.y);
        this.ctx.stroke();

        this.lastX = pos.x;
        this.lastY = pos.y;
    }

    endDraw() {
        if (this.isDrawing) {
            this.isDrawing = false;
            this.saveState();
        }
    }

    setColor(color) {
        this.color = color;
        this.isEraser = false;
    }

    setSize(size) {
        this.lineWidth = size;
    }

    toggleEraser() {
        this.isEraser = !this.isEraser;
        this.isFillMode = false;
        return this.isEraser;
    }

    toggleFill() {
        this.isFillMode = !this.isFillMode;
        this.isEraser = false;
        this.canvas.style.cursor = this.isFillMode ? 'cell' : 'crosshair';
        return this.isFillMode;
    }

    clear() {
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.hasStarted = false;
    }

    saveState() {
        if (this.history.length > 30) this.history.shift();
        this.history.push(this.canvas.toDataURL());
    }

    undo() {
        if (this.history.length <= 1) return;
        this.history.pop();
        const img = new Image();
        img.onload = () => {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.drawImage(img, 0, 0);
        };
        img.src = this.history[this.history.length - 1];
    }

    getImageData() {
        return this.canvas.toDataURL('image/png', 0.8);
    }

    applyModifier(modifier) {
        this.modifier = modifier;
        if (!modifier) return;

        switch (modifier.id) {
            case 'mirror':
                this.canvas.style.transform = 'scaleX(-1)';
                break;
            case 'upside-down':
                this.canvas.style.transform = 'rotate(180deg)';
                break;
            case 'one-color':
                this.color = modifier.color;
                // Блокируем смену цвета
                document.querySelectorAll('.color-btn').forEach(btn => {
                    btn.style.pointerEvents = 'none';
                    btn.style.opacity = '0.3';
                });
                break;
            case 'thick':
                this.lineWidth = 20;
                document.querySelectorAll('.size-btn').forEach(btn => {
                    btn.style.pointerEvents = 'none';
                    btn.style.opacity = '0.3';
                });
                break;
            case 'pixel':
                this.enablePixelMode();
                break;
        }
    }

    enablePixelMode() {
        const gridSize = 16;
        const cellW = this.canvas.width / gridSize;
        const cellH = this.canvas.height / gridSize;

        // Переопределяем рисование
        this.canvas.removeEventListener('mousedown', this.startDraw);
        this.canvas.addEventListener('mousedown', (e) => {
            const pos = this.getPos(e);
            const gx = Math.floor(pos.x / cellW);
            const gy = Math.floor(pos.y / cellH);
            this.ctx.fillStyle = this.isEraser ? '#FFFFFF' : this.color;
            this.ctx.fillRect(gx * cellW, gy * cellH, cellW, cellH);
        });

        this.canvas.addEventListener('mousemove', (e) => {
            if (!this.isDrawing) return;
            const pos = this.getPos(e);
            const gx = Math.floor(pos.x / cellW);
            const gy = Math.floor(pos.y / cellH);
            this.ctx.fillStyle = this.isEraser ? '#FFFFFF' : this.color;
            this.ctx.fillRect(gx * cellW, gy * cellH, cellW, cellH);
        });

        // Рисуем сетку
        this.ctx.strokeStyle = '#ddd';
        this.ctx.lineWidth = 0.5;
        for (let x = 0; x <= gridSize; x++) {
            this.ctx.beginPath();
            this.ctx.moveTo(x * cellW, 0);
            this.ctx.lineTo(x * cellW, this.canvas.height);
            this.ctx.stroke();
        }
        for (let y = 0; y <= gridSize; y++) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y * cellH);
            this.ctx.lineTo(this.canvas.width, y * cellH);
            this.ctx.stroke();
        }
    }

    resetModifier() {
        this.modifier = null;
        this.canvas.style.transform = 'none';
        document.querySelectorAll('.color-btn, .size-btn').forEach(btn => {
            btn.style.pointerEvents = 'auto';
            btn.style.opacity = '1';
        });
    }

    // Простая заливка (flood fill)
    floodFill(startX, startY, fillColor) {
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const data = imageData.data;
        const w = this.canvas.width;
        const h = this.canvas.height;

        const getPixel = (x, y) => {
            const i = (y * w + x) * 4;
            return [data[i], data[i + 1], data[i + 2], data[i + 3]];
        };

        const setPixel = (x, y, color) => {
            const i = (y * w + x) * 4;
            data[i] = color[0];
            data[i + 1] = color[1];
            data[i + 2] = color[2];
            data[i + 3] = 255;
        };

        const hexToRgb = (hex) => {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return [r, g, b];
        };

        const colorsMatch = (a, b, tolerance = 30) => {
            return Math.abs(a[0] - b[0]) < tolerance &&
                Math.abs(a[1] - b[1]) < tolerance &&
                Math.abs(a[2] - b[2]) < tolerance;
        };

        const targetColor = getPixel(startX, startY);
        const fillRgb = hexToRgb(fillColor);

        if (colorsMatch(targetColor, fillRgb, 5)) return;

        const stack = [[startX, startY]];
        const visited = new Set();

        while (stack.length > 0) {
            const [x, y] = stack.pop();
            if (x < 0 || x >= w || y < 0 || y >= h) continue;

            const key = `${x},${y}`;
            if (visited.has(key)) continue;
            visited.add(key);

            const current = getPixel(x, y);
            if (!colorsMatch(current, targetColor)) continue;

            setPixel(x, y, fillRgb);

            stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);

            if (visited.size > 500000) break; // Безопасность
        }

        this.ctx.putImageData(imageData, 0, 0);
    }
}