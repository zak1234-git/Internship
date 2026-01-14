/**
 * 背景粒子动画模块
 * 负责 Canvas 粒子效果的绘制与交互
 */

class Particle {
    constructor(bgSystem, x, y, directionX, directionY, size, color, type) {
        this.bgSystem = bgSystem;
        this.x = x;
        this.y = y;
        this.directionX = directionX;
        this.directionY = directionY;
        this.size = size;
        this.color = color;
        this.type = type; // 'dot', 'router-hub', 'router-leaf'
        this.parentHub = null; // 仅 leaf 有效
    }

    draw() {
        const ctx = this.bgSystem.ctx;
        
        if (this.type.startsWith('router')) {
            // 绘制图片节点（Hub/Leaf 共用路由器 SVG）
            const img = this.bgSystem.routerImage;
            // 确保图片已加载且尺寸有效
            if (img.complete && img.naturalWidth !== 0) {
                // 保持宽高比，居中绘制
                const w = this.size;
                const h = this.size; 
                ctx.drawImage(img, this.x - w/2, this.y - h/2, w, h);
            }
        } else {
            // 绘制圆点
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.fill();
        }
    }

    update() {
        // 路由器节点：添加微弱的上下浮动效果 
        if (this.type.startsWith('router')) {
            // 使用时间戳生成平滑的正弦波
            const time = Date.now() * 0.001; // 转换为秒
            const floatSpeed = 1.5; // 浮动速度
            const floatAmp = 5;     // 浮动幅度 (像素)
            
            // 计算新的 Y 坐标：基准位置 + 正弦偏移
            this.y = this.baseY + Math.sin(time * floatSpeed + this.floatPhase) * floatAmp;
            
            this.draw();
            return;
        }

        const canvas = this.bgSystem.canvas;
        const mouse = this.bgSystem.mouse;

        // 边界反弹
        if (this.x + this.size > canvas.width || this.x - this.size < 0) {
            this.directionX = -this.directionX;
        }
        if (this.y + this.size > canvas.height || this.y - this.size < 0) {
            this.directionY = -this.directionY;
        }

        // 鼠标排斥 (所有粒子都受影响)
        if (mouse.x !== undefined && mouse.y !== undefined) {
            const dx = mouse.x - this.x;
            const dy = mouse.y - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const forceRadius = this.type.startsWith('router') ? mouse.radius * 1.5 : mouse.radius;

            if (distance < forceRadius + this.size) {
                const push = this.type.startsWith('router') ? 2 : 8; // 路由器比较重，推得慢
                if (mouse.x < this.x && this.x < canvas.width - this.size * 10) this.x += push;
                if (mouse.x > this.x && this.x > this.size * 10) this.x -= push;
                if (mouse.y < this.y && this.y < canvas.height - this.size * 10) this.y += push;
                if (mouse.y > this.y && this.y > this.size * 10) this.y -= push;
            }
        }

        this.x += this.directionX;
        this.y += this.directionY;

        this.draw();
    }
}

class ParticleBackground {
    constructor(canvasId, containerSelector) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;

        this.ctx = this.canvas.getContext('2d');
        this.container = document.querySelector(containerSelector);
        
        // 两个独立的粒子系统：背景圆点 + 路由器网络
        this.bgParticles = []; // 背景圆点
        this.routerNodes = []; // 路由器节点
        
        // 加载路由器图标（使用 PNG 适配低版本浏览器，避免 SVG 兼容性问题）
        this.routerImage = new Image();
        // 路径相对于 index.html，HTML 在根目录，所以即 assets/router.png
        this.routerImage.src = 'assets/router.png';
        
        // 鼠标交互配置
        this.mouse = {
            x: undefined,
            y: undefined,
            radius: 150
        };

        this.init();
    }

    init() {
        if (!this.canvas || !this.ctx) return;

        // 绑定事件：窗口缩放重置粒子，鼠标移动用于排斥效果
        window.addEventListener('resize', () => {
            this.resizeCanvas();
            this.initParticles();
        });

        window.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });

        window.addEventListener('mouseout', () => {
            this.mouse.x = undefined;
            this.mouse.y = undefined;
        });

        // 启动
        this.resizeCanvas();
        this.initParticles();
        this.animate();
    }

    resizeCanvas() {
        if (this.container) {
            this.canvas.width = this.container.clientWidth;
            this.canvas.height = this.container.clientHeight;
        } else {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
        }
    }

    initParticles() {
        this.bgParticles = [];
        this.routerNodes = [];

        // 1. 初始化背景圆点 (数量多，尺寸小)
        const density = 9000; 
        const numberOfParticles = Math.floor((this.canvas.width * this.canvas.height) / density);

        for (let i = 0; i < numberOfParticles; i++) {
            const size = Math.random() * 3 + 1;
            const x = Math.random() * (this.canvas.width - size * 2) + size;
            const y = Math.random() * (this.canvas.height - size * 2) + size;
            const directionX = Math.random() * 1 - 0.5;
            const directionY = Math.random() * 1 - 0.5;
            const color = '#bdc3c7';

            this.bgParticles.push(new Particle(this, x, y, directionX, directionY, size, color, 'dot'));
        }

        // 2. 初始化路由器网络：中心 Hub + 多个 Leaf
        const centerX = this.canvas.width * 0.325;
        const centerY = this.canvas.height * 0.5;

        // --- 创建主节点 (Hub) ---
        const hubX = centerX;
        const hubY = centerY - 50;
        const hubSize = 80; 
        
        const hub = new Particle(this, hubX, hubY, 0, 0, hubSize, null, 'router-hub');
        this.routerNodes.push(hub);

        // --- 创建子节点 (Leaf) ---
        const offsets = [
            { x: -220, y: 80 },   // 左下远
            { x: -100, y: 180 },  // 左下近
            { x: 100,  y: 180 },  // 右下近
            { x: 220,  y: 80 },   // 右下远
            { x: -180, y: -120 }, // 左上
            { x: 180,  y: -120 }, // 右上
            { x: 0,    y: -200 }  // 正上
        ];

        offsets.forEach(offset => {
            const leafX = hubX + offset.x;
            const leafY = hubY + offset.y;
            const leafSize = 40; 
            
            const leaf = new Particle(this, leafX, leafY, 0, 0, leafSize, null, 'router-leaf');
            leaf.parentHub = hub;
            // 记录初始位置，用于浮动动画
            leaf.baseX = leafX;
            leaf.baseY = leafY;
            // 随机相位，让浮动不同步
            leaf.floatPhase = Math.random() * Math.PI * 2;
            this.routerNodes.push(leaf);
        });
        
        // Hub 也要记录初始位置
        hub.baseX = hubX;
        hub.baseY = hubY;
        hub.floatPhase = 0;
    }

    // 绘制背景圆点的连线：距离阈值内的点用半透明线连接
    connectBackground() {
        for (let a = 0; a < this.bgParticles.length; a++) {
            for (let b = a + 1; b < this.bgParticles.length; b++) {
                const dx = this.bgParticles[a].x - this.bgParticles[b].x;
                const dy = this.bgParticles[a].y - this.bgParticles[b].y;
                const dist = dx * dx + dy * dy;
                const threshold = (this.canvas.width / 7) * (this.canvas.height / 7);

                if (dist < threshold) {
                    const opacity = 1 - dist / 20000;
                    // 连线颜色为白色
                    this.ctx.strokeStyle = `rgba(189, 195, 199, ${opacity})`;
                    this.ctx.lineWidth = 1;
                    this.ctx.beginPath();
                    this.ctx.moveTo(this.bgParticles[a].x, this.bgParticles[a].y);
                    this.ctx.lineTo(this.bgParticles[b].x, this.bgParticles[b].y);
                    this.ctx.stroke();
                }
            }
        }
    }

    // 绘制路由器网络的连线 (只连 Hub 和 Leaf)
    connectRouters() {
        this.ctx.strokeStyle = 'rgba(52, 152, 219, 0.4)'; // 蓝色连线
        this.ctx.lineWidth = 2;

        for (let i = 0; i < this.routerNodes.length; i++) {
            const node = this.routerNodes[i];
            if (node.type === 'router-leaf' && node.parentHub) {
                this.ctx.beginPath();
                this.ctx.moveTo(node.x, node.y);
                this.ctx.lineTo(node.parentHub.x, node.parentHub.y);
                this.ctx.stroke();
            }
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 1. 更新并绘制背景层
        for (let i = 0; i < this.bgParticles.length; i++) {
            this.bgParticles[i].update();
        }
        this.connectBackground();

        // 2. 更新并绘制路由器层 (在上层)
        this.connectRouters(); // 先画线，线在图标下面
        for (let i = 0; i < this.routerNodes.length; i++) {
            this.routerNodes[i].update();
        }
    }
}

// 挂载到全局对象
window.ParticleBackground = ParticleBackground;
