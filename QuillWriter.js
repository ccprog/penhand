class QuillWriter {
    #config = {
        delta: 1,
        width: 6,
        height: 1,
        speed: 100,
        tilt: -40,
        fill: 'black'
    };
    #cost;
    #sint;
    #drawing = false;
    #at;
    #restart;
    paths = [];
    #buffer;

    constructor(canvas, svg, config) {
        this.ctx = canvas.getContext('2d');
        this.registerPoints(svg);
        this.config = config;
    }

    set config(config = {}) {
        const oldDelta = this.#config.delta;
        
        Object.assign(this.#config, config);

        this.#cost = Math.cos(this.#config.tilt * Math.PI / 180);
        this.#sint = Math.sin(this.#config.tilt * Math.PI / 180);

        this.ctx.fillStyle = this.#config.fill;

        if (oldDelta !== this.#config.delta) {
            this.paths.forEach(path => delete path.points);
        }
    }

    get config() {
        return Object.assign({}, this.#config);
    }

    registerPoints(svg) {
        const paths = svg.querySelectorAll('path');

        this.paths = [...paths].map(el => {
            return {
                el,
                length: el.getTotalLength(),
                pause: parseInt(el.getAttribute('data-pause'), 10)
            }
        });
    }

    clear () {
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
    }

    async start(at={}) {
        if (this.#drawing) {
            throw new Error('already running');
        } else {
            this.#drawing = true;
            this.#at = {x: 0, y: 0, ...at};

            this.#restart = performance.now();
            console.log(`start drawing...`);

            await this.#processPaths(at);

            this.#drawing = false;
        }
    }

    async #processPaths() {
        for (let stroke of this.paths) {
            this.#buffer = stroke;

            if (!stroke.points) {
                const num = this.#getPoints(this.#buffer);

                console.log(`stroke with ${num} points prepared`);
            }

            stroke.delay = (this.#restart || 0) - performance.now();
            stroke.perf = [];
            if (stroke.delay > 0) {
                await new Promise(resolve => setTimeout(resolve, stroke.delay));
            } else {
                this.#restart = performance.now();
            }
            console.log(await this.#drawStroke(true));
        }
        console.log(await this.#drawStroke(false));
    }

    #getPoints(stroke) {
        stroke.points = [];

        let distance = 0;

        while (distance < stroke.length) {
            stroke.points.push(stroke.el.getPointAtLength(distance));
            distance += this.#config.delta;
        }

        stroke.points.push(stroke.el.getPointAtLength(stroke.length));

        return stroke.points.length;
    }

    #drawStroke(more) {
        if (more) {
            return new Promise((resolve, reject) => {
                requestAnimationFrame(this.#drawStep.bind(this, 0, resolve));
            }).then((result) => {
                this.#restart = performance.now() + this.#buffer.pause;
                return Promise.resolve(result);
            });
        } else {
            return Promise.resolve('done');
        }
    }

    #drawStep(isAt, resolve, t) {
        const dur = Math.max(0, (t - this.#restart) / 1000);
        const len = Math.ceil(dur * this.#config.speed / this.#config.delta);

        const slice = this.#buffer.points.slice(isAt, len + 1);
        for (let i = 0; i < slice.length - 1; i++) {
            const dx = slice[i+1].x - slice[i].x;
            const dy = slice[i+1].y - slice[i].y;
            const quill = this.makeQuill(dx, dy);
            this.drawAtPoint(slice[i], quill);
        }
        this.#buffer.perf.push({ dur, isAt, len })

        isAt += slice.length - 1;

        if (isAt >= this.#buffer.points.length - 1) {
            return resolve(`stroke with ${this.#buffer.points.length} points drawn`);
        }

        requestAnimationFrame(this.#drawStep.bind(this, isAt, resolve));
    }

    drawAtPoint({x, y}, quill=this.makeQuill(0, 0)) {
        this.ctx.setTransform(1, 0, 0, 1, x + this.#at.x, y + this.#at.y);
        this.ctx.rotate(this.#config.tilt * Math.PI / 180);

        this.ctx.fill(quill);
    }

    makeQuill (dx, dy) {
        const w = this.#config.width / 2;
        const h = this.#config.height / 2;
        const tx = dx * this.#cost + dy * this.#sint;
        const ty = dx * -this.#sint + dy * this.#cost
        let d;

        if (tx > 0 && ty === 0) {
            d = `M ${-w},${-h * .8} 
                 Q ${tx / 2} ${-h * 1.6} ${tx + w},${-h * .8} 
                 L ${tx + w},${h * .8} 
                 Q ${tx / 2} ${h * 1.6} ${-w},${h * .8} Z`;
        } else if (tx > 0 && ty > 0) {
            d = `M ${-w},${-h * .8} 
                 Q 0 ${-h * 1.6} ${w},${-h * .8} 
                 L ${tx+ w},${ty - h * .8} 
                 L ${tx + w},${ty + h * .8} 
                 Q ${tx} ${ty + h * 1.6} ${tx - w},${ty + h * .8} 
                 L ${-w},${h * .8} Z`;
        } else if (tx === 0 && ty > 0) {
            d = `M ${-w},${-h * .8} 
                 Q 0 ${-h * 1.6} ${w},${-h * .8} 
                 L ${w},${ty + h * .8} 
                 Q 0 ${ty + h * 1.6} ${-w},${ty + h * .8} Z`;
        } else if (tx < 0 && ty > 0) {
            d = `M ${w},${h * .8} L ${tx + w},${ty + h * .8} 
                 Q ${tx} ${ty + h * 1.6} ${tx - w},${ty + h * .8} 
                 L ${tx - w},${ty - h * .8} 
                 L ${-w},${-h * .8} 
                 Q 0 ${-h * 1.6} ${w},${-h * .8} Z`;
        } else if (tx < 0 && ty === 0) {
            d = `M ${w},${h * .8} 
                 Q ${tx / 2} ${h * 1.6} ${tx - w},${h * .8} 
                 L ${tx - w},${-h * .8} 
                 Q ${tx / 2} ${-h * 1.6} ${w},${-h * .8} Z`;
        } else if (tx < 0 && ty < 0) {
            d = `M ${w},${h * .8} 
                 Q 0 ${h * 1.6} ${-w},${h * .8} L ${tx - w},${ty + h * .8} 
                 L ${tx - w},${ty - h * .8} 
                 Q ${tx} ${ty - h * 1.6} ${tx + w},${ty - h * .8} 
                 L ${w},${-h * .8} Z`;
        } else if (tx === 0 && ty < 0) {
            d = `M ${w},${h * .8} 
                 Q 0 ${h * 1.6} ${-w},${h * .8} 
                 L ${-w},${ty - h * .8} 
                 Q 0 ${ty - h * 1.6} ${w},${ty - h * .8} Z`;
        } else if (tx > 0 && ty < 0) {
            d = `M ${-w},${-h * .8} 
                 L ${tx - w},${ty - h * .8} 
                 Q ${tx} ${ty - h * 1.6} ${tx + w},${ty - h * .8} 
                 L ${tx + w},${ty + h * .8} 
                 L ${w},${h * .8} 
                 Q 0 ${h * 1.6} ${-w},${h * .8} Z`;
        } else {
            d = `M -${w - h / 2},-${h * .8}
                 A ${h} ${h * .8} 0 0 0 -${w - h / 2},${h * .8}
                 Q 0 ${h * 1.6} ${w},${h * .8}
                 A ${h} ${h * .8} 0 0 0 ${w - h / 2},-${h * .8}
                 Q 0 -${h * 1.6} -${w - h / 2},-${h * .8} Z`
        }
    
        return new Path2D(d);
    }
}