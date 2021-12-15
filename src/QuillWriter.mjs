export default class QuillWriter {
    #config = {
        delta: 1,
        width: 6,
        height: 1,
        speed: 100,
        wait: {
            turn: 200,
            move: 500
        },
        tilt: -40,
        fill: 'black'
    };
    #cost;
    #sint;
    #drawing = false;
    #at;
    #restart;
    strokes;
    #buffer;

    constructor(canvas, strokes=[], config) {
        this.ctx = canvas.getContext('2d');
        this.strokes = strokes;
        this.config = config;
    }

    set config(config = {}) {
        Object.assign(this.#config, config);

        this.#cost = Math.cos(this.#config.tilt * Math.PI / 180);
        this.#sint = Math.sin(this.#config.tilt * Math.PI / 180);

        this.ctx.fillStyle = this.#config.fill;
    }

    get config() {
        return Object.assign({}, this.#config);
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
            //console.log(`start drawing...`);

            for (let stroke of this.strokes) {
                this.#buffer = stroke;
                stroke.perf = [];

                await this.#drawStroke();
            }

            this.#drawing = false;
        }
    }

    #drawStroke() {
        this.#restart = performance.now();

        return new Promise((resolve, reject) => {
            requestAnimationFrame(this.#drawStep.bind(this, 0, resolve));
        }).then((result) => {
            //console.log(result);

            const wait = this.#config.wait[this.#buffer.pause] || 0;
            return new Promise(resolve => setTimeout(resolve, wait));
        });
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