class QuillWriter {
    #config = {
        delta: undefined,
        width: 10,
        height: 1,
        speed: 200,
        pause: 500,
        tilt: -40,
        fill: 'black'
    };
    #drawing = false;
    #restart;
    paths = [];
    #buffer;

    constructor(canvas, svg, config) {
        this.ctx = canvas.getContext('2d');
        this.registerPoints(svg);
        this.config = config;
    }

    set config(config = {}) {
        Object.assign(this.#config, config);

        const w = this.#config.width / 2;
        const h = this.#config.height / 2;
        const newDelta = Math.min(w, h) / 2;

        this.quill = new Path2D(`M -${w - h / 2},-${h * .8}
                                 A ${h} ${h * .8} 0 0 0 -${w - h / 2},${h * .8}
                                 Q 0 ${h * 1.6} ${w},${h * .8}
                                 A ${h} ${h * .8} 0 0 0 ${w - h / 2},-${h * .8}
                                 Q 0 -${h * 1.6} -${w - h / 2},-${h * .8} Z`);
        this.ctx.fillStyle = this.#config.fill;

        if (newDelta !== this.#config.delta) {
            this.#config.delta = newDelta;
            this.ctx.canvas.style.filter = `blur(${newDelta}px)`;

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

    async start() {
        if (this.#drawing) {
            throw new Error('already running');
        } else {
            this.#drawing = true;

            this.ctx.setTransform(1, 0, 0, 1, 0, 0);
            this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);

            this.#restart = performance.now();
            console.log(`start drawing...`);

            await this.#processPaths();

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

        stroke.points.push(stroke.el.getPointAtLength(length));

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

        const slice = this.#buffer.points.slice(isAt, len);
        slice.forEach(this.drawAtPoint.bind(this));
        this.#buffer.perf.push({ dur, isAt, len })

        isAt += slice.length;

        if (isAt >= this.#buffer.points.length) {
            return resolve(`stroke with ${this.#buffer.points.length} points drawn`);
        }

        requestAnimationFrame(this.#drawStep.bind(this, isAt, resolve));
    }

    drawAtPoint(point) {
        this.ctx.setTransform(1, 0, 0, 1, point.x, point.y);
        this.ctx.rotate(this.#config.tilt * Math.PI / 180);

        this.ctx.fill(this.quill);
    }
}