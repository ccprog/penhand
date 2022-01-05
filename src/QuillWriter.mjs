class Broadpen {
    #config = {
        width: 6,
        height: 1,
        tilt: -40
    };
    #style = {
        lineWidth: 1,
        lineJoin: 'round',
        fillStyle: 'black',
        strokeStyle: 'black'
    }
    #point;

    constructor(config) {
        this.config = config;
    }

    set config(config = {}) {
        if (config.height > config.width) {
            throw new Error('pen height must be smaller than width');
        }

        Object.assign(this.#config, config);

        // make sure lines get not too skinny
        this.#style.lineWidth = Math.max(this.#config.height, 1.4);
        this.#style.strokeStyle = this.#style.fillStyle = this.#config.fill;

        const cost = Math.cos(this.#config.tilt * Math.PI / 180);
        const sint = Math.sin(this.#config.tilt * Math.PI / 180);
        const w = (this.#config.width - this.#config.height) / 2;
        this.#point = {
            x: w * cost,
            y: w * sint,
            mx: this.#config.height * 0.6 * sint,
            my: this.#config.height * 0.6 * -cost
        };
    }

    get config() {
        return {...this.#config};
    }

    get style() {
        return {...this.#style};
    }

    make(p1, p2=p1) {
        const o = this.#point;
        let d = [
                'M', p1.x + o.x, p1.y + o.y,
                p1.x - o.x, p1.y - o.y,
                p2.x - o.x, p2.y - o.y,
                p2.x + o.x, p2.y + o.y, 'Z'
            ];
    
        return new Path2D(d.join(' '));
    }
}

class Ballpen {
    #config = {
        size: 2
    };
    #style = {
        lineWidth: 2,
        lineJoin: 'round',
        strokeStyle: 'black'
    }

    constructor(config) {
        this.config = config;
    }

    set config(config = {}) {
        if (config.height > config.width) {
            throw new Error('pen height must be smaller than width');
        }

        Object.assign(this.#config, config);

        this.#style.lineWidth = this.#config.size;
        this.#style.strokeStyle = this.#config.fill;
    }

    get config() {
        return {...this.#config};
    }

    get style() {
        return {...this.#style};
    }

    make(p1, p2=p1) {
        return new Path2D(`M ${p1.x},${p1.y} ${p2.x},${p2.y}`);
    }
}

const pens = { Ballpen, Broadpen };

export const penNames = Object.keys(pens);

export class QuillWriter {
    #config = {
        speed: 100,
        wait: {
            turn: 200,
            move: 500,
            space: 500
        }
    };
    #pen;
    #drawing = false;
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
            this.#pen = new pens[pen.type](pen.config);
        }

        for (const [style, value] of Object.entries(this.#pen.style)) {
            this.ctx[style] = value;
        }
    }

    clear () {
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
    }

    async write(strokes, at={}) {
        if (this.#drawing) {
            throw new Error('already running');
        } else {
            this.#drawing = true;
            this.ctx.setTransform(1, 0, 0, 1, at.x ?? 0, at.y ?? 0);

            this.#restart = performance.now();
            //console.log(`start drawing...`);

            for (let stroke of strokes) {
                this.#buffer = stroke;
                stroke.perf = [];

                await this.#drawStroke();
            }
            console.log(strokes.map(s=>s.perf))

            this.#drawing = false;
        }
    }

    #drawStroke() {
        this.#restart = performance.now();

        return new Promise(resolve => {
            const end = this.#buffer.lines.slice(-1)[0].d;
            requestAnimationFrame(this.#drawFrame.bind(this, 0, end, resolve));
        }).then((result) => {
            //console.log(result);

            const wait = this.#config.wait[this.#buffer.pause] || 0;
            return new Promise(resolve => setTimeout(resolve, wait));
        });
    }

    #divide(line1, line2, pos) {
        const t = (pos - line1.d) / (line2.d - line1.d);
        return {
            x: line1.to.x * (1-t) + line2.to.x * t,
            y: line1.to.y * (1-t) + line2.to.y * t,
        }
    }

    #drawFrame(isAt, end, resolve, t) {
        const dur = Math.max(0, (t - this.#restart) / 1000);
        const goesTo = dur * this.#config.speed;
        let f = 0, p = 0;

        for (const [i, line] of this.#buffer.lines.entries()) {
            if (!i || (line.d < isAt)) continue;

            const lastLine = this.#buffer.lines[i-1];

            if (goesTo > line.d) {
                this.drawAt(lastLine.to, line.to);
                f++
            } else {
                // this includes the case goesTo == lastLine.d
                const to = this.#divide(lastLine, line, goesTo);
                this.drawAt(lastLine.to, to);
                p++
                break;
            }
        }
        this.#buffer.perf.push([goesTo - isAt, f, p])

        isAt = goesTo;

        if (isAt >= end) {
            return resolve(`stroke of length=${end} drawn`);
        }

        requestAnimationFrame(this.#drawFrame.bind(this, isAt, end, resolve));
    }

    drawAt(p1, p2) {
        const dot = this.#pen.make(p1, p2);
        if (this.#pen.style.fillStyle) this.ctx.fill(dot);
        if (this.#pen.style.strokeStyle) this.ctx.stroke(dot);
    }
}