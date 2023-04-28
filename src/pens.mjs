class Broadpen {
    #baseScale;
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
    #offset;

    constructor(config, baseScale) {
        this.#baseScale = baseScale;
        this.config = config;
    }

    get config() {
        return {...this.#config};
    }

    get style() {
        return {...this.#style};
    }

    set config(config = {}) {
        if (config.height > config.width) {
            throw new Error('pen height must be smaller than width');
        }

        Object.assign(this.#config, config);

        // make sure lines get not too skinny
        this.#style.lineWidth = Math.max(this.#config.height * this.#baseScale, 1.4);
        this.#style.strokeStyle = this.#style.fillStyle = this.#config.fill;

        const cost = Math.cos(this.#config.tilt * Math.PI / 180);
        const sint = Math.sin(this.#config.tilt * Math.PI / 180);
        const w = (this.#config.width - this.#config.height) * this.#baseScale / 2;
        const m = this.#config.height * this.#baseScale * 0.6;
        this.#offset = {
            x: w * cost,
            y: w * sint,
            mx: m * sint,
            my: m* -cost
        };
    }

    make(p1, p2=p1) {
        const o = this.#offset;
        let d = [
                'M', p1.to.x + o.x, p1.to.y + o.y,
                p1.to.x - o.x, p1.to.y - o.y,
                p2.to.x - o.x, p2.to.y - o.y,
                p2.to.x + o.x, p2.to.y + o.y, 'Z'
            ];
    
        return [new Path2D(d.join(' '))];
    }
}

class Ballpen {
    #baseScale;
    #config = {
        size: 2
    };
    #style = {
        lineWidth: 2,
        lineJoin: 'round',
        strokeStyle: 'black'
    }

    constructor(config, baseScale) {
        this.#baseScale = baseScale;
        this.config = config;
    }

    get config() {
        return {...this.#config};
    }

    get style() {
        return {...this.#style};
    }

    set config(config = {}) {
        if (config.height > config.width) {
            throw new Error('pen height must be smaller than width');
        }

        Object.assign(this.#config, config);

        this.#style.lineWidth = this.#config.size * this.#baseScale;
        this.#style.strokeStyle = this.#config.fill;
    }

    make(p1, p2=p1) {
        return [new Path2D(`M ${p1.to.x},${p1.to.y} ${p2.to.x},${p2.to.y}`)];
    }
}

class PointedNib {
    #baseScale;
    #config = {
        maxwidth: 8,
        maxgain: 0.1,
        minradius: 6,
        damp1: 0.8,
        damp2: 0.3,
        baseDirection: 0, //=slant, Verbreiterung geht parallel dazu
        tilt: 0
    };
    #style = {
        lineWidth: 2,
        lineJoin: 'round',
        fillStyle: 'black',
        strokeStyle: 'black'
    }
    #offset;

    constructor(config, baseScale) {
        this.#baseScale = baseScale;
        this.config = config;
    }

    get config() {
        return {...this.#config};
    }

    get style() {
        return {...this.#style};
    }

    set config(config = {}) {
        Object.assign(this.#config, config);
        this.#config.baseDirection = (this.#config?.slant ?? 0) / 90;

        // make sure lines get not too skinny
        this.#style.lineWidth = Math.max(this.#baseScale, 1.4);
        this.#style.strokeStyle = this.#style.fillStyle = this.#config.fill;

        const cost = Math.cos(this.#config.tilt * Math.PI / 180) / 2;
        const sint = Math.sin(this.#config.tilt * Math.PI / 180) / 2;
        const h = this.#style.lineWidth;
        this.#offset = { cost, sint, h };
    }

    #directiveWidth (p) {
        // normalize direction to 0...4s
        const dir = (p.f - this.#config.baseDirection + 8) % 4;
        // directive width goes 0...1...0 for 0...1...2...
        return 1 - Math.abs(Math.min(dir - 1, 1));
    }

    #dampenedWidth(pTo, dFrom, wFrom) {
        const wTo = this.#directiveWidth(pTo);

        const dif = wTo - wFrom;
        const damp = this.#config[dif > 0 ? 'damp1' : 'damp2']
        return wFrom + dif * (1 - damp ** (pTo.d - dFrom));
    }

    make(p1, p2, state) {
        let w1 = this.#directiveWidth(p2);
        let w2 = w1;

        if (state) {
            if (!p1.d) {
                state.d = 0;
                w1 = state.w;
            } else {
                w1 = this.#dampenedWidth(p1, state.d, state.w);
            }
            w2 = this.#dampenedWidth(p2, state.d, state.w);
            if (state.next) {
                state.d = p2.d;
                state.w = w2;
            }
        } else {
            state = {
                d: 0,
                w: w2
            };
        }
        state.next = false;

        const wStart = (this.#config.maxwidth - this.#offset.h) * w1;
        const wEnd = (this.#config.maxwidth - this.#offset.h) * w2;

        const w1x = wStart * this.#baseScale * this.#offset.cost;
        const w1y = wStart * this.#baseScale * this.#offset.sint;
        const w2x = wEnd * this.#baseScale * this.#offset.cost;
        const w2y = wEnd * this.#baseScale * this.#offset.sint;

        const path = [
                'M', p1.to.x + w1x, p1.to.y + w1y,
                p1.to.x - w1x, p1.to.y - w1y,
                p2.to.x - w2x, p2.to.y - w2y,
                p2.to.x + w2x, p2.to.y + w2y, 'Z'
            ];

        return [new Path2D(path.join(' ')), state, [w1, w2]];
    }
}

export default { Ballpen, Broadpen, PointedNib };