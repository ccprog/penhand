class QuillWriter {
    #config = {
        width: 10,
        height: 1,
        speed: 200,
        pause: 500,
        tilt: -40,
        fill: 'black'
    };
    #svg;
    #points;
    #drawing = false;
    #startTime;

    constructor(canvas, svg, config) {
        this.ctx = canvas.getContext('2d');
        this.#svg = svg;
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

        if (newDelta !== this.#config.delta || !this.#points) {
            this.#config.delta = newDelta;
            this.ctx.filter = `blur(${newDelta}px)`;
            this.registerPoints(this.#svg);
        }
    }

    registerPoints(svg) {
        const paths = svg.querySelectorAll('path');

        this.#points = [...paths].map(el => {
            const length = el.getTotalLength();

            const stroke = {
                pause: parseInt(el.getAttribute('data-pause'), 10),
                points: []
            };
            let distance = 0;
            while (distance < length) {
                stroke.points.push(el.getPointAtLength(distance));
                distance += this.#config.delta;
            }
            stroke.points.push(el.getPointAtLength(length));

            return stroke;
        });

        const total = this.#points.reduce((sum, stroke) => sum + stroke.points.length, 0);
        console.log(`ready with ${total} points`);
    }

    start() {
        return new Promise((resolve, reject) => {
            if (this.#drawing) {
                reject(new Error('already running'));
            } else {
                this.#drawing = true;

                this.ctx.setTransform(1, 0, 0, 1, 0, 0);
                this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);

                this.#startTime = performance.now();
                console.log(`start drawing...`);

                requestAnimationFrame(this.#drawProgress.bind(this, 0, 0, 0, resolve));
            }
        });
    }

    drawAtPoint(point) {
        this.ctx.setTransform(1, 0, 0, 1, point.x, point.y);
        this.ctx.rotate(this.#config.tilt * Math.PI / 180);

        this.ctx.fill(this.quill);
    }

    #drawProgress(strokeIndex, startsAt, isAt, resolve, t) {
        const endTime = (t - this.#startTime) / 1000;
        const end = Math.ceil(endTime * this.#config.speed / this.#config.delta);

        const stroke = this.#points[strokeIndex].points.slice(isAt, end - startsAt);
        stroke.forEach(this.drawAtPoint.bind(this));

        isAt += stroke.length;

        if (isAt >= this.#points[strokeIndex].points.length) {
            if (this.#points[strokeIndex + 1]) {
                const pause = this.#points[strokeIndex].pause || this.#config.pause;
                this.#startTime += pause;

                startsAt += this.#points[strokeIndex].points.length;
                strokeIndex++;

                return setTimeout(() => {
                    requestAnimationFrame(this.#drawProgress.bind(this, strokeIndex, startsAt, 0, resolve));
                }, pause);
            } else {
                this.#drawing = false;
                return resolve('done');
            }
        }

        requestAnimationFrame(this.#drawProgress.bind(this, strokeIndex, startsAt, isAt, resolve));
    }
}
