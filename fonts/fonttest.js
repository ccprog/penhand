(function () {
    'use strict';

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
        #offset;

        constructor(config) {
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
            this.#style.lineWidth = Math.max(this.#config.height, 1.4);
            this.#style.strokeStyle = this.#style.fillStyle = this.#config.fill;

            const cost = Math.cos(this.#config.tilt * Math.PI / 180);
            const sint = Math.sin(this.#config.tilt * Math.PI / 180);
            const w = (this.#config.width - this.#config.height) / 2;
            this.#offset = {
                x: w * cost,
                y: w * sint,
                mx: this.#config.height * 0.6 * sint,
                my: this.#config.height * 0.6 * -cost
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

            this.#style.lineWidth = this.#config.size;
            this.#style.strokeStyle = this.#config.fill;
        }

        make(p1, p2=p1) {
            return new Path2D(`M ${p1.x},${p1.y} ${p2.x},${p2.y}`);
        }
    }

    var pens = { Ballpen, Broadpen };

    class Writer {
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
                console.log(strokes.map(s=>s.perf));

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
                    f++;
                } else {
                    // this includes the case goesTo == lastLine.d
                    const to = this.#divide(lastLine, line, goesTo);
                    this.drawAt(lastLine.to, to);
                    p++;
                    break;
                }
            }
            this.#buffer.perf.push([goesTo - isAt, f, p]);

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

    function parse(d) {
        const ast = new pathParser().parse(d);
        const sequence = ast.reduce(astCommand, []);

        return sequence.filter(segment => segment.from !== undefined);
    }

    function avg(p1, p2) {
        return {
            x: (p1.x + p2.x) / 2,
            y: (p1.y + p2.y) / 2
        };
    }

    function distance(p1, p2) {
        return Math.hypot(p2.y - p1.y, p2.x - p1.x);
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

        lines.push({
            to: point,
            d: lastLine.d + distance(lastLine.to, point)
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

    function pathToPoints(d, tolerance) {
        const sequence = parse(d);
        const start = { to: sequence[0].from, d: 0 };

        return sequence.reduce(flattenCurve.bind(null, tolerance), [start]);
    }

    function computeFont(glyphs, tolerance) {
        const uniqueStrokes = new Map();

        for (let glyph of Object.values(glyphs)) {
            for (let variant of Object.values(glyph)) {
                for (let stroke of variant.strokes) {
                    if (!stroke.d) {
                        stroke.steps = [];
                        continue;
                    }

                    let lines = uniqueStrokes.get(stroke.d);
                    if (!lines) {
                        lines = pathToPoints(stroke.d, tolerance);
                        uniqueStrokes.set(stroke.d, lines);
                    }

                    stroke.lines = lines;
                }
            }
        }

        return Promise.resolve();
    }

    const config = {
      wait: {
          turn: 200,
          move: 500,
          space: 500
      },
      speed: 120
    };

    const pen = {
      type: 'Ballpen',
      config: {
          fill: '#391b0c'
      }
    };

    const tolerance = 0.1;

    const userInput = (resolve) => {
      button.addEventListener('click', () => {
        button.disabled = true;
        resolve();
      }, { once: true });
    };

    const canvas = document.querySelector('canvas.signature');
    const button = document.querySelector('button.start');

    const writer = new Writer(canvas, config, pen);
    writer.ctx.font = '18px sans-serif';

    (async function () {
      const res = await fetch('kurrent.json');
      const data = await res.json();
      console.log(data.id, data.desc);

      await computeFont(data.glyphs, tolerance);

      for (const [name, variants] of Object.entries(data.glyphs)) {
        button.disabled = false;

        await new Promise(userInput);

        writer.clear();
        let x = 50, line = 200;

        for (const [position, { strokes, advance, desc }] of Object.entries(variants)) {
          const pauses = [];

          for(const {late, pause} of strokes) {
            let directive = late ? 'l/' : '';

            if (pause) {
              directive += pause.slice(0, 1);
             } else {
              directive += 'c';
            }
            pauses.push(directive);
          }

          writer.ctx.setTransform(1, 0, 0, 1, 0, 0);
          const details = (desc || name) + ` | ${position} | ${strokes.length}: ${pauses.join(' ')}`;
          writer.ctx.fillText(details, 30, line);

          await writer.write(strokes, {x, y: 30});

          await new Promise(resolve => setTimeout(resolve, 500));

          line += 22;
          x += 150;
        }  
      }
    })();

})();
