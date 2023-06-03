import pens from './pens.mjs';

export const penNames = Object.keys(pens);

export class Writer {
    #config = {
        speed: 100,
        wait: {
            turn: 200,
            move: 500,
            space: 500
        },
        baseScale: 1
    };
    #pen;
    #penState = null;
    #drawing = false;
    #reset = false;
    #restart;
    strokes;
    #buffer;

    constructor(canvas, config, pen) {
        this.ctx = canvas.getContext('2d');
        this.config = config;
        this.pen = pen;
    }

    set config(config = {}) {
        Object.assign(this.#config, config);
    }

    get config() {
        return Object.assign({}, this.#config);
    }

    set pen(pen) {
        if (pen.type && !(this.#pen instanceof pens[pen.type])) {
            this.#pen = new pens[pen.type](pen.config, this.#config.baseScale);
        } else {
            this.#pen.config = pen.config;
        }

        for (const [style, value] of Object.entries(this.#pen.style)) {
            this.ctx[style] = value;
        }
    }

    clear () {
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);

        this.#reset = true;
        this.#penState = null;
    }

    async write(instruction, offset={}) {
        for (const { position, strokes } of instruction) {
            const at = {
                x: position + (offset.x ?? 0),
                y: (offset.y ?? 0)
            }

            await this.#drawMove(strokes, at);
        }
    }

    async #drawMove(strokes, at) {
        if (this.#drawing) {
            throw new Error('already running');
        } else {
            this.#drawing = true;
            this.ctx.setTransform(1, 0, 0, 1, at.x ?? 0, at.y ?? 0);

            this.#restart = performance.now();
            //console.log(`start drawing...`);

            for (let stroke of strokes) {
                this.#buffer = stroke;
                stroke.perf = [stroke.pause, this.#reset, stroke.d];

                await this.#drawStroke();

                this.#reset = (!!stroke.pause && stroke.pause != 'turn');
            }

            this.#drawing = false;
        }
    }

    async #drawStroke() {
        this.#restart = performance.now();

        await new Promise(resolve => {
            const end = this.#buffer.lines.slice(-1)?.[0]?.d ?? 0;
            requestAnimationFrame(this.#drawFrame.bind(this, 0, end, resolve));
        });

        //console.log(this.#buffer.perf);

        const wait = this.#config.wait[this.#buffer.pause] || 0;
        return await new Promise(resolve => setTimeout(resolve, wait));
    }

    #divide(line1, line2, pos) {
        const t = (pos - line1.d) / (line2.d - line1.d);
        return {
            to: {
                x: line1.to.x * (1-t) + line2.to.x * t,
                y: line1.to.y * (1-t) + line2.to.y * t
            },
            r: line2.r,
            d: pos,
            f: line2.f
        };
    }

    #drawFrame(isAt, end, resolve, t) {
        const dur = Math.max(0, (t - this.#restart) / 1000);
        const goesTo = dur * this.#config.speed * this.#config.baseScale;

        const perfd = [];

        for (const [i, line] of this.#buffer.lines.entries()) {
            if (!i || (line.d < isAt)) continue;

            const lastLine = this.#buffer.lines[i-1];

            let from = lastLine,
                to = line;

            if (isAt > lastLine.d) {
                from = this.#divide(lastLine, line, isAt);
            }

            if (goesTo < line.d) {
                to = this.#divide(lastLine, line, goesTo);
            } else if (this.#penState) {
                this.#penState.next = true;
            }

            if (this.#reset && !isAt) this.#penState = null;

            const [dot, state, perf] = this.#pen.make(from, to, this.#penState);
            if (this.#pen.style.fillStyle) this.ctx.fill(dot);
            if (this.#pen.style.strokeStyle) this.ctx.stroke(dot);

            perfd.push(this.#penState, perf);

            this.#penState = state;
            isAt = to.d;

            if (goesTo <= line.d) break;
        }

        this.#buffer.perf.push(perfd)

        if (isAt >= end) {
            return resolve(`stroke of length=${end} drawn`);
        }

        requestAnimationFrame(this.#drawFrame.bind(this, isAt, end, resolve));
    }
}