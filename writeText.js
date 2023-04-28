(function () {
    'use strict';

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
            const damp = this.#config[dif > 0 ? 'damp1' : 'damp2'];
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

    var pens = { Ballpen, Broadpen, PointedNib };

    class Writer {
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
                    stroke.perf = [stroke.pause, this.#reset, stroke.d];

                    await this.#drawStroke();

                    this.#reset = (!!stroke.pause && stroke.pause != 'turn');
                }

                this.#drawing = false;
            }
        }

        #drawStroke() {
            this.#restart = performance.now();

            return new Promise(resolve => {
                const end = this.#buffer.lines.slice(-1)?.[0]?.d ?? 0;
                requestAnimationFrame(this.#drawFrame.bind(this, 0, end, resolve));
            }).then((result) => {
                //console.log(this.#buffer.perf);

                const wait = this.#config.wait[this.#buffer.pause] || 0;
                return new Promise(resolve => setTimeout(resolve, wait));
            });
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
            //let f = 0, p = 0, w1, w2;

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

            this.#buffer.perf.push(perfd);

            if (isAt >= end) {
                return resolve(`stroke of length=${end} drawn`);
            }

            requestAnimationFrame(this.#drawFrame.bind(this, isAt, end, resolve));
        }
    }

    class RawCommand$1 {
        constructor(command, str) {
            this._str = str;
            this._pos = 0;

            this.string = command + str;
            this.offset = command.length;
        }

        get more() {
            return this._pos < this._str.length;
        }

        get position() {
            return this._pos;
        }

        get_token(token, assert) {
            const result = this._str.substr(this._pos).match(RawCommand$1.regex[token]);
            const sequence = (result || [''])[0];

            this._pos += sequence.length;

            return assert ? result !== null : sequence;
        }
    }
    RawCommand$1.regex = {
        wsp: /^[\x09\x20\x0D\x0A]*/,
        comma: /^,/,
        brace_open: /^\(/,
        brace_close: /^\)/,
        flag: /^[01]/,
        number: /^[+-]?(\d*\.\d+|\d+\.?)([eE][+-]?\d+)*/,
        nonnegative: /^(\d*\.\d+|\d+\.?)([eE][+-]?\d+)*/
    };

    var rawCommand = RawCommand$1;

    class ParseError$1 extends Error {
        constructor(desc, string, position) {
            super();

            this.name = 'ParseError';
            this.message = desc + '\n';
            this.message += (string.string || string);
            if (position) {
                this.message += '\n' + Array(position).fill('_').join('') + '^';
            }
        }
    }

    var parseError = ParseError$1;

    const RawCommand = rawCommand;
    const ParseError = parseError;

    class Parser$1 {
        constructor() {
            this.current = [];
            this.source = '';
        }

        get_raw(command, str) {
            return new RawCommand(command, str);
        }

        throw_parse_error(desc, string, position) {
            throw new ParseError(desc, string, position);
        }

        commands(str) {
            const splited = str.split(this.command_names);
            const start = splited.shift();

            if (/[^\x09\x20\x0D\x0A]+/.test(start)) {
                this.throw_parse_error('expected nothing before command', start + splited[0], 0);
            }

            return splited;
        }

        coordinate(raw) {
            return {
                coordinate: this.number(raw)
            };
        }

        coordinate_pair_sequence(raw, len) {
            const argument = {};
            let idx = 1;

            while (idx < len) {
                argument['control_' + idx] = this.coordinate_pair(raw);
                this.comma_wsp(raw);
                idx++;
            }

            argument.coordinate_pair = this.coordinate_pair(raw);
        
            return argument;
        }

        elliptical_arc(raw) {
            const argument = {
                rx: this.number(raw, true)
            };
            this.comma_wsp(raw);

            argument.ry = this.number(raw, true);
            this.comma_wsp(raw);

            argument.rotation = this.number(raw);
            this.comma_wsp(raw);

            argument.large_arc = this.flag(raw);
            this.comma_wsp(raw);

            argument.sweep = this.flag(raw);
            this.comma_wsp(raw);

            argument.coordinate_pair = this.coordinate_pair(raw);

            return argument;
        }

        coordinate_pair(raw) {
            const argument = {
                x: this.number(raw)
            };
            this.comma_wsp(raw);

            argument.y = this.number(raw);

            return argument;
        }

        coordinate_triple(raw) {
            const argument = {
                x: this.number(raw)
            };
            this.comma_wsp(raw);

            argument.y = this.number(raw);
            this.comma_wsp(raw);

            argument.z = this.number(raw);

            return argument;
        }

        flag(raw) {
            const flag = raw.get_token('flag');
            if (!flag) {
                this.throw_parse_error('expected flag', raw);
            }

            return flag === '1';
        }

        number(raw, nonnegative) {
            const token = raw.get_token(nonnegative ? 'nonnegative' : 'number');
            const number = parseFloat(token);

            if (isNaN(number)) {
                this.throw_parse_error('expected number', raw);
            }

            return number;
        }

        comma_wsp(raw) {
            raw.get_token('wsp');
            const has_comma = raw.get_token('comma', true);
            raw.get_token('wsp');

            return has_comma;
        }

        test_end(raw) {
            raw.get_token('wsp');
            if (raw.more) {
                this.throw_parse_error('expected nothing after close', raw);
            }
        }

        parse(str) {
            this.current = [];
            this.source = str;

            return this.group(str);
        }
    }

    var parser = Parser$1;

    const Parser = parser;

    const path_commands = /([mzlhvcsqta])/i;
    const movoto_command = /m/i;

    class PathParser extends Parser {
        get command_names() {
            return path_commands;
        }

        collect_arguments(get, raw, len) {
            const array = [];
            let must_follow = true;

            while (must_follow || raw.more) {
                if (array.length) {
                    must_follow = this.comma_wsp(raw);
                }

                if (must_follow || raw.more) {
                    array.push(this[get](raw, len));
                }
            }

            return array;
        }

        group (str) {
            const splited = this.commands(str);

            if (splited.length && !splited[0].match(movoto_command)) {
                this.throw_parse_error('expected moveto at start', splited.slice(0, 2).join(''), 0);
            }

            while (splited.length > 1) {
                const letter = splited.shift();
                const command = {
                    command: letter.toUpperCase()
                };

                if (command.command !== 'Z') {
                    command.relative = letter !== letter.toUpperCase();
                }

                const raw = this.get_raw(letter, splited.shift());
                raw.get_token('wsp');

                switch (command.command) {
                case 'M':
                case 'L':
                case 'T':
                    command.sequence = this.collect_arguments('coordinate_pair_sequence', raw, 1);
                    break;

                case 'S':
                case 'Q':
                    command.sequence = this.collect_arguments('coordinate_pair_sequence', raw, 2);
                    break;

                case 'C':
                    command.sequence = this.collect_arguments('coordinate_pair_sequence', raw, 3);
                    break;

                case 'H':
                case 'V':
                    command.sequence = this.collect_arguments('coordinate', raw);
                    break;

                case 'A':
                    command.sequence = this.collect_arguments('elliptical_arc', raw);
                    break;

                case 'Z':
                    this.test_end(raw);
                    break;
                }
                this.current.push(command);
            }

            return this.current;
        }
    }

    var pathParser = PathParser;

    class Transformer {
        constructor(trans) {
            this.normal_abs = [];
            this.normal_rel = [];

            this.transformation = [{
                command: 'scale',
                sx: 1
            }];

            if (Array.isArray(trans) && trans.length > 0) {
                this.transformation = trans;
            }

            this.preprocess();
        }

        preprocess () {
            this.transformation.forEach(function (t) {
                const trans_abs = {...t};
                const trans_rel = {...t};

                switch (t.command) {
                case 'matrix':
                    trans_rel.e = trans_rel.f = 0;
                    break;

                case 'translate':
                    trans_rel.tx = trans_rel.ty = 0;
                    trans_abs.ty = t.ty || 0;
                    break;

                case 'scale':
                    trans_abs.sy = trans_rel.sy = t.sy != null ? t.sy : t.sx;
                    break;

                case 'rotate':
                    trans_rel.cx = trans_rel.cy = 0;
                    trans_abs.cx = t.cx || 0;
                    trans_abs.cy = t.cy || 0;
                    break;
                }

                this.normal_abs.push(trans_abs);
                this.normal_rel.push(trans_rel);
            }, this);
        }

        static round(n) {
            return Math.abs(Math.round(n) - n) < 1e-10 ? Math.round(n) + 0 : n;
        }

        static coordinate_pair(group, pair) {
            const c = {x: 0, y: 0, ...pair};

            group.concat([]).reverse().forEach(trans => {
                switch (trans.command) {
                case 'matrix':
                    var cx = c.x, cy = c.y;
                    c.x = trans.a * cx + trans.c * cy + trans.e;
                    c.y = trans.b * cx + trans.d * cy + trans.f;
                    break;

                case 'translate':
                    c.x += trans.tx;
                    c.y += trans.ty;
                    break;

                case 'scale':
                    c.x *= trans.sx;
                    c.y *= trans.sy;
                    break;

                case 'rotate':
                    c.x -= trans.cx;
                    c.y -= trans.cy;

                    var d = Math.sqrt(c.x*c.x + c.y*c.y);
                    var a = Math.atan2(c.y, c.x) * 180 / Math.PI + trans.angle;

                    c.x = d * Math.cos(a * Math.PI/180);
                    c.y = d * Math.sin(a * Math.PI/180);

                    c.x += trans.cx;
                    c.y += trans.cy;
                    break;

                case 'skewX':
                    c.x += Math.tan(trans.angle/180*Math.PI) * c.y;
                    break;

                case 'skewY':
                    c.y += Math.tan(trans.angle/180*Math.PI) * c.x;
                    break;
                }
            });

            c.x = Transformer.round(c.x);
            c.y = Transformer.round(c.y);
            return c;
        }

        static arc_matrix(transform, args) {
            const co = Math.cos(args.rotation/180*Math.PI);
            const si = Math.sin(args.rotation/180*Math.PI);

            const m = [
                args.rx * (transform.a * co + transform.c * si),
                args.rx * (transform.b * co + transform.d * si),
                args.ry * (transform.c * co - transform.a * si),
                args.ry * (transform.d * co - transform.b * si),
            ];

            const A = (m[0] * m[0]) + (m[2] * m[2]);
            const B = 2 * (m[0] * m[1] + m[2] * m[3]);
            const C = (m[1] * m[1]) + (m[3] * m[3]);
            const K = Math.sqrt((A - C) * (A - C) + B * B);

            return {
                rx:  Transformer.round(Math.sqrt(0.5 * (A + C + K))),
                ry:  Transformer.round(Math.sqrt(0.5 * Math.max(0, A + C - K))),
                rotation: Transformer.round(Math.atan2(B, A - C) * 90 / Math.PI)
            };
        }

        static elliptical_arc(group, args) {
            group.concat([]).reverse().forEach(transform => {
                let arc_trans;

                switch (transform.command) {
                case 'translate':
                    arc_trans = [
                        {command: 'rotate', angle: args.rotation, cx: 0, cy: 0}
                    ];
                    break;

                case 'rotate':
                    arc_trans = [
                        {command: 'rotate', angle: transform.angle + args.rotation, cx: 0, cy: 0}
                    ];
                    break;

                case 'matrix':
                    arc_trans = [
                        {...transform, e: 0, f: 0},
                        {command: 'rotate', angle: args.rotation, cx: 0, cy: 0}
                    ];
                    break;

                default:
                    arc_trans = [
                        transform,
                        {command: 'rotate', angle: args.rotation, cx: 0, cy: 0}
                    ];
                    break;
                }

                const t1 = Transformer.coordinate_pair(arc_trans, {x: args.rx, y: 0});
                const t2 = Transformer.coordinate_pair(arc_trans, {x: 0, y: args.ry});
        
                const matrix = {
                    command: 'matrix',
                    a: t1.x / args.rx,
                    b: t1.y / args.rx,
                    c: t2.x / args.ry,
                    d: t2.y / args.ry,
                    e: 0,
                    f: 0
                };
        
                args.rotation = 0;
                ({
                    rx: args.rx, 
                    ry: args.ry, 
                    rotation: args.rotation
                } = Transformer.arc_matrix(matrix, {...args}));
        
                if ((matrix.a * matrix.d) - (matrix.b * matrix.c) < 0) {
                    args.sweep = !args.sweep;
                }
            });

            args.coordinate_pair = Transformer.coordinate_pair(group, args.coordinate_pair);

            return args;
        }

        nest_transforms(struct, a, relative) {
            const args = {...a};

            const func = struct === 'arc' ? Transformer.elliptical_arc : Transformer.coordinate_pair;
            const transformation = relative ? this.normal_rel : this.normal_abs;

            return func(transformation, args);
        }

        argument_obj(command, relative, args) {
            let trans_args = {};

            switch (command) {
            case 'A':
                trans_args = this.nest_transforms('arc', args, relative);
                break;

            case 'C':
                trans_args.control_2 = this.nest_transforms('pair', args.control_2, relative);
                /* falls through */
            case 'S':
            case 'Q':
                trans_args.control_1 = this.nest_transforms('pair', args.control_1, relative);
                /* falls through */
            default:
                trans_args.coordinate_pair = this.nest_transforms('pair', args.coordinate_pair, relative);
                break;
            }

            return trans_args;
        }

        transform(path) {
            let last_x, last_y;

            return path.map((command, idx_c) => {
                let trans_command = command.command;

                if (trans_command === 'Z') {
                    return { command: trans_command };
                }

                let trans_sequence = command.sequence.map((args, idx_s) => {
                    let args_command = trans_command, relative = command.relative;

                    switch (trans_command) {
                    case 'H':
                        args = {
                            coordinate_pair: { x: args.coordinate, y: relative ? 0 : last_y }
                        };
                        args_command = 'L';
                        break;

                    case 'V':
                        args = {
                            coordinate_pair: { x: relative ? 0 : last_x, y: args.coordinate }
                        };
                        args_command = 'L';
                        break;

                    case 'M':
                        if (idx_c === 0 && idx_s === 0) {
                            relative = false;
                        }
                        break;
                    }

                    const trans_args = this.argument_obj(args_command, relative, args);

                    if (relative) {
                        last_x += args.coordinate_pair.x;
                        last_y += args.coordinate_pair.y;
                    } else {
                        last_x = args.coordinate_pair.x;
                        last_y = args.coordinate_pair.y;
                    }

                    return trans_args;
                }, this);

                if (trans_command === 'H' || trans_command === 'V') {
                    trans_command = 'L';
                }

                return {
                    command: trans_command,
                    relative: command.relative,
                    sequence: trans_sequence
                };
            }, this);
        }
    }

    var transformer = Transformer;

    function getTransform(angle, dx = 0, dy = 0) {
        const cosa = Math.cos(angle);
        const sina = Math.sin(angle);
        return (x, y) => {
            return {
                x: x * cosa + y * sina + dx,
                y: -x * sina + y * cosa + dy
            };
        };
    }

    function convertArc(segment) {
        const { from, to, rotation, large_arc, sweep } = segment;
        let { rx, ry } = segment;
        const angle = rotation / 180 * Math.PI;

        const h = getTransform(angle)(
            (from.x - to.x) / 2,
            (from.y - to.y) / 2
        );

        const lambda = h.x*h.x/rx/rx + h.y*h.y/ry/ry;
        if (lambda > 1) {
            rx *= Math.sqrt(lambda);
            ry *= Math.sqrt(lambda);
        }

        const sign = large_arc === sweep ? -1 : 1;
        const f = sign * Math.sqrt((rx*rx*ry*ry - rx*rx*h.y*h.y - ry*ry*h.x*h.x) / (rx*rx* h.y*h.y + ry*ry*h.x*h.x));

        const centerH = {
            x: f * rx / ry * h.y,
            y: -f * ry / rx * h.x
        };

        let angleFrom = Math.atan2(
            (h.y - centerH.y) / ry,
            (h.x - centerH.x) / rx
        );
        let angleTo = Math.atan2(
            (-h.y - centerH.y) / ry,
            (-h.x - centerH.x) / rx
        );
        if (angleTo > angleFrom && !sweep) angleTo -= 2 * Math.PI;
        if (angleTo < angleFrom && sweep) angleTo += 2 * Math.PI;

        const center = getTransform(
            -angle,
            (from.x + to.x) / 2, 
            (from.y + to.y) / 2
        )(
            centerH.x, 
            centerH.y
        );
        const transform = getTransform(angle, center.x,center.y);

        Object.assign(segment, { transform, angleFrom, angleTo });
    }

    function addTo(p1, p2) {
        p1.x += p2.x;
        p1.y += p2.y;
    }

    function astCommand(result, current) {
        if (current.command === 'Z') {
            const from = result.slice(-1)[0].to;
            const to = result.slice(0, 1)[0].from;
            result.push(astArgument({ command: 'L', from, to }));
        } else if (current.command === 'M') {
            const first = {
                command: 'M',
                to: current.sequence.shift().coordinate_pair
            };
            if (current.relative) {
                addTo(first.to, result.slice(-1)[0].to);
            }
            result.push(first);
        }
        current.sequence.forEach(args => {
            const previous = result.slice(-1)[0];
            result.push(astArgument(current.command, current.relative, args, previous));
        });

        return result;
    }

    function astArgument(command, relative, args, previous) {
        const segment = { ...args };
        delete segment.coordinate_pair;
        delete segment.coordinate;

        segment.from = previous.to;
        segment.to = args.coordinate_pair;

        if (relative) {
            addTo(segment.to, previous.to);
            if (segment.control_1) {
                addTo(segment.control_1, segment.from);
            }
            if (segment.control_2) {
                addTo(segment.control_2, segment.from);
            }
        }

        switch (command) {
            case 'H':
                segment.to = { x: args.coordinate, y: segment.from.y };
                segment.command = 'L';
                break;
            case 'V':
                segment.to = { x: segment.from.x, y: args.coordinate };
                segment.command = 'L';
                break;
            case 'M':
                segment.command = 'L';
                break;
            case 'S':
                segment.control_2 = segment.control_1;
                segment.control_1.x = 2 * from.x - (previous.control_2 ? previous.control_2.x : previous.control_1.x);
                segment.control_1.y = 2 * from.y - (previous.control_2 ? previous.control_2.y : previous.control_1.y);
                segment.command = 'C';
                break;
            case 'T':
                segment.control_1.x = 2 * from.x - (previous.control_2 ? previous.control_2.x : previous.control_1.x);
                segment.control_1.y = 2 * from.y - (previous.control_2 ? previous.control_2.y : previous.control_1.y);
                segment.command = 'Q';
                break;
            case 'A':
                convertArc(segment);
            default:
                segment.command = command;
        }

        return segment;
    }

    function parse(d, trans) {
        let ast = new pathParser().parse(d);

        if (trans.length) {
            const transformer$1 = new transformer(trans);
            ast = transformer$1.transform(ast);
        }
        
        const sequence = ast.reduce(astCommand, []);

        return sequence.filter(segment => segment.from !== undefined);
    }

    const tolerance = 0.1;

    function avg(p1, p2) {
        return {
            x: (p1.x + p2.x) / 2,
            y: (p1.y + p2.y) / 2
        };
    }

    function distance(p1, p2) {
        return Math.hypot(p2.y - p1.y, p2.x - p1.x);
    }

    function direction(p1, p2) {
        // 0...4 for full circle
        return Math.atan2(p2.y - p1.y, p2.x - p1.x) / Math.PI * 2;
    }

    function isFlatEnough(segment, tol) {
        const { from, to, control_1, control_2 } = segment;

        if (segment.command == 'C') {
            const ux = 3 * control_1.x - 2 * from.x - to.x;
            const uy = 3 * control_1.y - 2 * from.y - to.y;
            const vx = 3 * control_2.x - 2 * to.x - from.x;
            const vy = 3 * control_2.y - 2 * to.y - from.y;

            return Math.max(ux*ux, vx*vx) + Math.max(uy*uy, vy*vy) <= 16 * tol*tol;
        } else {
            const ux = 2 * control_1.x - from.x - to.x;
            const uy = 2 * control_1.y - from.y - to.y;

            return ux*ux + uy*uy <= 16 * tol*tol;
        }
    }

    function subdivide(segment) {
        if (segment.command == 'C') {
            const m = avg(segment.control_1, segment.control_2);
            const l1 = avg(segment.from, segment.control_1);
            const r2 = avg(segment.to, segment.control_2);
            const l2 = avg(l1, m);
            const r1 = avg(r2, m);
            const l3 = avg(l2, r1);

            return [
                { ...segment, to: l3, control_1: l1, control_2: l2 },
                { ...segment, from: l3, control_1: r1, control_2: r2 },
            ];
        } else {
            const l = avg(segment.from, segment.control_1);
            const r = avg(segment.to, segment.control_1);
            const m = avg(l, r);

            return [
                { ...segment, to: m, control_1: l },
                { ...segment, from: m, control_1: r },
            ];
        }
    }

    function push(lines, point) {
        const lastLine = lines[lines.length - 1];
        const dd = distance(lastLine.to, point);
        const f = direction(lastLine.to, point);

        if (lastLine.f) {
            const df = (f + 4) % 4 - (lastLine.f + 4) % 4;
            lastLine.r = dd / Math.cos(Math.PI/4 * (2 - df));
        }

        lines.push({
            to: point,
            d: lastLine.d + dd,
            f
        });
    }

    function flattenBezier(tol, lines, segment) {
        if (isFlatEnough(segment, tol)) {
            push(lines, segment.to);
        } else {
            const [left, right] = subdivide(segment);
            flattenBezier(tol, lines, left);
            flattenBezier(tol, lines, right);
        }
    }

    function getCount(r, sweep, tol) {
        let k = 0, d = r*.134;
        while (d > tol && k < 6) {
            d = r * (1 - Math.sqrt(1 - 1 / (1 << (2 * k + 2))));
            k++;
        }

        return Math.ceil(sweep * (1<<k));
    }

    function flattenArc(tol, lines, segment) {
        const { angleFrom, angleTo, rx, ry, transform } = segment;

        const sweep = Math.abs(angleTo - angleFrom);
        const count = getCount(rx, sweep, tol);

        for (let i = 1; i <= count; i++) {
            const f = angleFrom * (count - i)/count + angleTo * (i) / count;
            const m = transform(
                Math.cos(f) * rx,
                Math.sin(f) * ry
            );

            push(lines, m);
        }
    }

    function flattenCurve(tol, lines, segment) {
        switch (segment.command) {
        case 'L':
            push(lines, segment.to);
            break;
        case 'C':
        case 'Q':
            flattenBezier(tol, lines, segment);
            break;
        case 'A':
            flattenArc(tol, lines, segment);
            break;
        }

        return lines;
    }

    function pathToPoints(d, trans, tol=tolerance) {

        const sequence = parse(d, trans);
        const start = { to: sequence[0].from, d: 0 };

        return sequence.reduce(flattenCurve.bind(null, tol), [start]);
    }

    function computeFont(glyphs, trans, baseScale=1) {
        const uniqueStrokes = new Map();
        const totalScale = trans?.[0]?.sx ?? 1;
        const usedTol = tolerance * baseScale;

        const flatFont = {};

        for (let [key, glyph] of Object.entries(glyphs)) {
            const flatGlyph = {};
            flatFont[key] = flatGlyph;

            for (let [key, variant] of Object.entries(glyph)) {
                const flatVariant = {
                    strokes: [],
                    advance: variant.advance * totalScale
                };
                flatGlyph[key] = flatVariant;

                for (let stroke of variant.strokes) {
                    const flatStroke = {...stroke};
                    flatVariant.strokes.push(flatStroke);

                    if (!stroke.d) {
                        flatStroke.lines = [];
                        continue;
                    }

                    let lines = uniqueStrokes.get(stroke.d);
                    if (!lines) {
                        lines = pathToPoints(stroke.d, trans, usedTol);
                        uniqueStrokes.set(stroke.d, lines);
                    }

                    flatStroke.lines = lines;
                }
            }
        }

        return Promise.resolve(flatFont);
    }

    class GlyphChooser {
        #size;
        #slant;
        #flatFont

        constructor (url, transformation) {
            return (async () => {
                const res = await fetch(url);
                const font = await res.json();

                this.metrics = font.meta.metrics;
                this.glyphs = font.glyphs;
                this.ligatures = font.meta.requiredLigatures;
                this.subtables = Object.entries(font.meta.subtables);
                this.kerning = font.meta.pairwiseKerning;
                this.substitution = Object.entries(font.meta.substitution).map(([test, subst]) => {
                    return [new RegExp(test, 'g'), subst];
                });

                await this.compute(transformation);

                return this;
            })();
        }

        async compute(transformation) {
            const trans = [];

            if (transformation.size) {
                const sx = transformation.size / this.metrics.unitsPerEm * transformation.baseScale;
                if (sx !== 1) trans.push({ command: 'scale', sx });
            }

            if (transformation.slant) {
                const tan = Math.tan(-transformation.slant * Math.PI / 180);
                const y = this.metrics.skewHeight;
                if (tan !== 0) trans.push({ command: 'matrix', a: 1, b: 0, c: tan, d: 1, e: -tan * y, f: 0 });
            }

            if (this.#size === transformation.size && this.#slant === transformation.slant) return;
            this.#size = transformation.size;
            this.#slant = transformation.slant;

            this.#flatFont = await computeFont(this.glyphs, trans, transformation.baseScale);
        }

        substitute(txt) {
            for (let [rx, subst] of this.substitution) {
                txt = txt.replace(rx, subst);
            }

            const seq = [];
            for (let i = 0; i < txt.length; i++) {
                const part = txt.slice(i);
                const lig = this.ligatures.find(l => part.startsWith(l));
                if (lig) {
                    seq.push(lig);
                    i += lig.length - 1;
                } else {
                    seq.push(part.slice(0, 1));
                }
            }

            return seq;
        }

        #findKerning(first, second) {
            const firstsub = this.subtables
                .filter(([, st]) => st.includes(first))
                .map(([id])=>id);
            const secondsub = this.subtables
                .filter(([, st]) => st.includes(second))
                .map(([id])=>id);

            const pair = this.kerning.find(e => {
                return firstsub.includes(e.first) && secondsub.includes(e.second);
            });

            return pair?.use ?? 0;
        }

        #order(selection) {
            const instruction = [];
            const late = [];
            let position = 0;

            for (const {glyph, variant, kerning} of selection) {
                const { strokes, advance } = this.#flatFont[glyph][variant];

                position += kerning;

                const wait = strokes.filter(s => s.late);
                if (wait.length) {
                    late.push({
                        strokes: wait,
                        position
                    });
                }

                const regular = {
                    strokes: strokes.filter(s => !s.late),
                    position
                };
                instruction.push(regular);

                if(regular.strokes.slice(-1)[0].pause === 'move' && late.length) {
                    instruction.push(...late.splice(0));
                }

                position += advance;
            }

            return instruction;
        }

        connect(seq) {
            const selection = [];

            seq.forEach((glyph, i) => {
                const select = { glyph, variant: 'isolate', kerning: 0 };

                const last = selection[i - 1];
                const next = seq[i + 1] && this.#flatFont[seq[i + 1]];

                const canBackward = ['initial', 'medial'].includes(last?.variant);
                const canForward = next?.final || next?.medial;

                if (this.glyphs[glyph]) {
                    if (canBackward) {
                        if (canForward && this.#flatFont[glyph].medial) {
                            select.variant = 'medial';
                        } else {
                            select.variant = 'final';
                        }
                    } else {
                        if (canForward && this.#flatFont[glyph].initial) {
                            select.variant = 'initial';
                        }

                        if (i > 0) {
                            select.kerning = this.#findKerning(last.glyph, glyph);
                        }
                    }
                } else {
                    select.glyph = ' ';
                }
                selection.push(select);
            });

            return this.#order(selection);
        }
    }

    const canvas = document.querySelector('canvas.output');
    const text = document.querySelector('input.text');
    const button = document.querySelector('button.start');
    const pentype = document.querySelector('select#pen');
    const size = document.querySelector('input#size');
    const slant = document.querySelector('input#slant');
    const tilt = document.querySelector('input#tilt');

    const baseScale = canvas.width / parseFloat(getComputedStyle(canvas).width);

    const config = {
        wait: {
            turn: 200,
            move: 500,
            space: 500
        },
        speed: 120,
        baseScale
    };

    const pen = {
        type: 'Ballpen',
        config: {
            fill: '#391b0c'
        }
    };

    const transformation = {
        size: parseInt(size.value, 10),
        slant: parseInt(slant.value, 10),
        baseScale
    };

    function getFontProperties() {
        button.disabled = true;
        transformation.size = parseInt(size.value, 10);
        transformation.slant = parseInt(slant.value, 10);

        glyphChooser.compute(transformation).then(() => button.disabled = false);
    }

    size.addEventListener('change', getFontProperties);
    slant.addEventListener('change', getFontProperties);
    tilt.addEventListener('change', getFontProperties);

    const writer = new Writer(canvas, config, pen);
    function getPenProperties() {
        pen.type = pentype.value;
        pen.config.tilt = parseInt(tilt.value, 10);
        pen.config.slant = parseInt(slant.value, 10);
        writer.pen = pen;
    }
    getPenProperties();

    pentype.addEventListener('change', getPenProperties);
    tilt.addEventListener('change', getPenProperties);
    slant.addEventListener('change', getPenProperties);

    async function write(txt) {
        writer.clear();

        const seq = glyphChooser.substitute(txt);
        const instruction = glyphChooser.connect(seq);

        for (const { position, strokes } of instruction) {
            await writer.write(strokes, { x: position + 50, y: 30 });
        }
    }

    let glyphChooser;

    function onClick() {
        button.disabled = true;

        write(text.value).then(() => button.disabled = false);
    }

    new GlyphChooser('fonts/kurrent.json', transformation)
    .then((gc) => {
        glyphChooser = gc;

        button.addEventListener('click', onClick);
        button.disabled = false;
    });

})();
