const canvas = document.getElementById('curtain-canvas');
const ctx = canvas.getContext('2d');

let width, height;
const curtains = [];

// Configuration
const config = {
    gravity: 0.15,
    friction: 0.98,
    spacing: 15,
    stiffness: 0.8,
    openingSpeed: 0.05,
    folds: 8,
    mouseRadius: 50,
    mouseStrength: 0.5
};

const mouse = { x: 0, y: 0, active: false };
window.addEventListener('mousemove', e => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.active = true;
});
window.addEventListener('mousedown', () => mouse.active = true);
window.addEventListener('mouseup', () => mouse.active = false);

class Point {
    constructor(x, y, pinned = false) {
        this.x = x;
        this.y = y;
        this.oldX = x;
        this.oldY = y;
        this.pinned = pinned;
        this.targetX = x;
        this.targetY = y;
    }

    update() {
        if (this.pinned) {
            this.x += (this.targetX - this.x) * config.openingSpeed;
            this.y += (this.targetY - this.y) * config.openingSpeed;
            return;
        }

        if (mouse.active) {
            const dx = this.x - mouse.x;
            const dy = this.y - mouse.y;
            const dist = Math.hypot(dx, dy);
            if (dist < config.mouseRadius) {
                this.x += dx * config.mouseStrength * (1 - dist / config.mouseRadius);
                this.y += dy * config.mouseStrength * (1 - dist / config.mouseRadius);
            }
        }

        const vx = (this.x - this.oldX) * config.friction;
        const vy = (this.y - this.oldY) * config.friction;

        this.oldX = this.x;
        this.oldY = this.y;

        this.x += vx;
        this.y += vy + config.gravity;
    }
}

class Constraint {
    constructor(p1, p2) {
        this.p1 = p1;
        this.p2 = p2;
        this.length = Math.hypot(p1.x - p2.x, p1.y - p2.y);
    }

    resolve() {
        const dx = this.p2.x - this.p1.x;
        const dy = this.p2.y - this.p1.y;
        const dist = Math.hypot(dx, dy);
        const diff = (this.length - dist) / dist * config.stiffness;

        const offsetX = dx * diff * 0.5;
        const offsetY = dy * diff * 0.5;

        if (!this.p1.pinned) {
            this.p1.x -= offsetX;
            this.p1.y -= offsetY;
        }
        if (!this.p2.pinned) {
            this.p2.x += offsetX;
            this.p2.y += offsetY;
        }
    }
}

class CurtainPiece {
    constructor(side) {
        this.side = side; // 'left' or 'right'
        this.points = [];
        this.constraints = [];
        this.init();
    }

    init() {
        const rows = Math.ceil(height / config.spacing) + 2;
        const cols = Math.ceil((width / 2) / config.spacing) + 1;

        const startX = this.side === 'left' ? 0 : width / 2;

        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                const px = startX + x * config.spacing;
                const py = y * config.spacing - 20;
                const pinned = y === 0;
                const p = new Point(px, py, pinned);
                this.points.push(p);

                if (x > 0) {
                    this.constraints.push(new Constraint(this.points[this.points.length - 2], p));
                }
                if (y > 0) {
                    this.constraints.push(new Constraint(this.points[this.points.length - cols - 1], p));
                }
            }
        }
    }

    update() {
        for (let i = 0; i < 5; i++) { // Solver iterations
            this.constraints.forEach(c => c.resolve());
        }
        this.points.forEach(p => p.update());
    }

    draw() {
        const cols = Math.ceil((width / 2) / config.spacing) + 1;
        const rows = Math.ceil(height / config.spacing) + 2;

        for (let x = 0; x < cols - 1; x++) {
            ctx.beginPath();
            ctx.fillStyle = this.getFoldGradient(x, cols);

            for (let y = 0; y < rows - 1; y++) {
                const idx = y * cols + x;
                const p1 = this.points[idx];
                const p2 = this.points[idx + 1];
                const p3 = this.points[idx + cols + 1];
                const p4 = this.points[idx + cols];

                if (y === 0) ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.lineTo(p3.x, p3.y);
                ctx.lineTo(p4.x, p4.y);
            }
            ctx.fill();
        }

        this.drawTassels(cols, rows);
    }

    getFoldGradient(x, totalCols) {
        const startX = this.side === 'left' ? 0 : width / 2;
        const xPos = startX + x * config.spacing;
        const grd = ctx.createLinearGradient(xPos, 0, xPos + config.spacing, 0);

        // Complex velvet gradient for each vertical fold
        const color1 = (x % 2 === 0) ? '#6a040f' : '#9d0208';
        const color2 = (x % 2 === 0) ? '#370617' : '#6a040f';

        grd.addColorStop(0, color1);
        grd.addColorStop(0.5, color2);
        grd.addColorStop(1, color1);
        return grd;
    }

    drawTassels(cols, rows) {
        // Draw gold trim at the bottom
        ctx.strokeStyle = '#ffb703';
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let x = 0; x < cols; x++) {
            const p = this.points[(rows - 2) * cols + x];
            if (x === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
    }

    open() {
        const cols = Math.ceil((width / 2) / config.spacing) + 1;
        const moveDistance = width / 2;

        for (let x = 0; x < cols; x++) {
            const p = this.points[x];
            if (this.side === 'left') {
                // Move towards left, and bunch up
                const ratio = x / cols;
                p.targetX = -100 + (ratio * 50);
                p.targetY = -50 - (ratio * 20);
            } else {
                // Move towards right
                const ratio = 1 - (x / cols);
                p.targetX = width + 100 - (ratio * 50);
                p.targetY = -50 - (ratio * 20);
            }
        }
    }

    close() {
        const cols = Math.ceil((width / 2) / config.spacing) + 1;
        const startX = this.side === 'left' ? 0 : width / 2;

        for (let x = 0; x < cols; x++) {
            const p = this.points[x];
            p.targetX = startX + x * config.spacing;
            p.targetY = -20;
        }
    }
}

function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    curtains.length = 0;
    curtains.push(new CurtainPiece('left'));
    curtains.push(new CurtainPiece('right'));
}

window.addEventListener('resize', resize);
resize();

function animate() {
    ctx.clearRect(0, 0, width, height);

    curtains.forEach(c => {
        c.update();
        c.draw();
    });

    requestAnimationFrame(animate);
}

animate();

const openBtn = document.getElementById('open-curtains');
const closeBtn = document.getElementById('close-curtains');
const content = document.querySelector('.content');

openBtn.addEventListener('click', () => {
    curtains.forEach(c => c.open());
    openBtn.style.display = 'none';
    setTimeout(() => {
        content.classList.add('active');
    }, 1000);
});

closeBtn.addEventListener('click', () => {
    curtains.forEach(c => c.close());
    content.classList.remove('active');
    setTimeout(() => {
        openBtn.style.display = 'block';
    }, 2000);
});
