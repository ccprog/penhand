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
                'M', p1.x + o.x, p1.y + o.y,
                p1.x - o.x, p1.y - o.y,
                p2.x - o.x, p2.y - o.y,
                p2.x + o.x, p2.y + o.y, 'Z'
            ];
    
        return new Path2D(d.join(' '));
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
        return new Path2D(`M ${p1.x},${p1.y} ${p2.x},${p2.y}`);
    }
}

export default { Ballpen, Broadpen };