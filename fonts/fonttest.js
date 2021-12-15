(function () {
    'use strict';

    class QuillWriter {
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
            this.#buffer.perf.push({ dur, isAt, len });

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
            const ty = dx * -this.#sint + dy * this.#cost;
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
                 Q 0 -${h * 1.6} -${w - h / 2},-${h * .8} Z`;
            }
        
            return new Path2D(d);
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

    // math-inlining.
    const { abs: abs$1, cos: cos$1, sin: sin$1, acos: acos$1, atan2, sqrt: sqrt$1, pow } = Math;

    // cube root function yielding real roots
    function crt(v) {
      return v < 0 ? -pow(-v, 1 / 3) : pow(v, 1 / 3);
    }

    // trig constants
    const pi$1 = Math.PI,
      tau = 2 * pi$1,
      quart = pi$1 / 2,
      // float precision significant decimal
      epsilon = 0.000001,
      // extremas used in bbox calculation and similar algorithms
      nMax = Number.MAX_SAFE_INTEGER || 9007199254740991,
      nMin = Number.MIN_SAFE_INTEGER || -9007199254740991,
      // a zero coordinate, which is surprisingly useful
      ZERO = { x: 0, y: 0, z: 0 };

    // Bezier utility functions
    const utils = {
      // Legendre-Gauss abscissae with n=24 (x_i values, defined at i=n as the roots of the nth order Legendre polynomial Pn(x))
      Tvalues: [
        -0.0640568928626056260850430826247450385909,
        0.0640568928626056260850430826247450385909,
        -0.1911188674736163091586398207570696318404,
        0.1911188674736163091586398207570696318404,
        -0.3150426796961633743867932913198102407864,
        0.3150426796961633743867932913198102407864,
        -0.4337935076260451384870842319133497124524,
        0.4337935076260451384870842319133497124524,
        -0.5454214713888395356583756172183723700107,
        0.5454214713888395356583756172183723700107,
        -0.6480936519369755692524957869107476266696,
        0.6480936519369755692524957869107476266696,
        -0.7401241915785543642438281030999784255232,
        0.7401241915785543642438281030999784255232,
        -0.8200019859739029219539498726697452080761,
        0.8200019859739029219539498726697452080761,
        -0.8864155270044010342131543419821967550873,
        0.8864155270044010342131543419821967550873,
        -0.9382745520027327585236490017087214496548,
        0.9382745520027327585236490017087214496548,
        -0.9747285559713094981983919930081690617411,
        0.9747285559713094981983919930081690617411,
        -0.9951872199970213601799974097007368118745,
        0.9951872199970213601799974097007368118745,
      ],

      // Legendre-Gauss weights with n=24 (w_i values, defined by a function linked to in the Bezier primer article)
      Cvalues: [
        0.1279381953467521569740561652246953718517,
        0.1279381953467521569740561652246953718517,
        0.1258374563468282961213753825111836887264,
        0.1258374563468282961213753825111836887264,
        0.121670472927803391204463153476262425607,
        0.121670472927803391204463153476262425607,
        0.1155056680537256013533444839067835598622,
        0.1155056680537256013533444839067835598622,
        0.1074442701159656347825773424466062227946,
        0.1074442701159656347825773424466062227946,
        0.0976186521041138882698806644642471544279,
        0.0976186521041138882698806644642471544279,
        0.086190161531953275917185202983742667185,
        0.086190161531953275917185202983742667185,
        0.0733464814110803057340336152531165181193,
        0.0733464814110803057340336152531165181193,
        0.0592985849154367807463677585001085845412,
        0.0592985849154367807463677585001085845412,
        0.0442774388174198061686027482113382288593,
        0.0442774388174198061686027482113382288593,
        0.0285313886289336631813078159518782864491,
        0.0285313886289336631813078159518782864491,
        0.0123412297999871995468056670700372915759,
        0.0123412297999871995468056670700372915759,
      ],

      arcfn: function (t, derivativeFn) {
        const d = derivativeFn(t);
        let l = d.x * d.x + d.y * d.y;
        if (typeof d.z !== "undefined") {
          l += d.z * d.z;
        }
        return sqrt$1(l);
      },

      compute: function (t, points, _3d) {
        // shortcuts
        if (t === 0) {
          points[0].t = 0;
          return points[0];
        }

        const order = points.length - 1;

        if (t === 1) {
          points[order].t = 1;
          return points[order];
        }

        const mt = 1 - t;
        let p = points;

        // constant?
        if (order === 0) {
          points[0].t = t;
          return points[0];
        }

        // linear?
        if (order === 1) {
          const ret = {
            x: mt * p[0].x + t * p[1].x,
            y: mt * p[0].y + t * p[1].y,
            t: t,
          };
          if (_3d) {
            ret.z = mt * p[0].z + t * p[1].z;
          }
          return ret;
        }

        // quadratic/cubic curve?
        if (order < 4) {
          let mt2 = mt * mt,
            t2 = t * t,
            a,
            b,
            c,
            d = 0;
          if (order === 2) {
            p = [p[0], p[1], p[2], ZERO];
            a = mt2;
            b = mt * t * 2;
            c = t2;
          } else if (order === 3) {
            a = mt2 * mt;
            b = mt2 * t * 3;
            c = mt * t2 * 3;
            d = t * t2;
          }
          const ret = {
            x: a * p[0].x + b * p[1].x + c * p[2].x + d * p[3].x,
            y: a * p[0].y + b * p[1].y + c * p[2].y + d * p[3].y,
            t: t,
          };
          if (_3d) {
            ret.z = a * p[0].z + b * p[1].z + c * p[2].z + d * p[3].z;
          }
          return ret;
        }

        // higher order curves: use de Casteljau's computation
        const dCpts = JSON.parse(JSON.stringify(points));
        while (dCpts.length > 1) {
          for (let i = 0; i < dCpts.length - 1; i++) {
            dCpts[i] = {
              x: dCpts[i].x + (dCpts[i + 1].x - dCpts[i].x) * t,
              y: dCpts[i].y + (dCpts[i + 1].y - dCpts[i].y) * t,
            };
            if (typeof dCpts[i].z !== "undefined") {
              dCpts[i] = dCpts[i].z + (dCpts[i + 1].z - dCpts[i].z) * t;
            }
          }
          dCpts.splice(dCpts.length - 1, 1);
        }
        dCpts[0].t = t;
        return dCpts[0];
      },

      computeWithRatios: function (t, points, ratios, _3d) {
        const mt = 1 - t,
          r = ratios,
          p = points;

        let f1 = r[0],
          f2 = r[1],
          f3 = r[2],
          f4 = r[3],
          d;

        // spec for linear
        f1 *= mt;
        f2 *= t;

        if (p.length === 2) {
          d = f1 + f2;
          return {
            x: (f1 * p[0].x + f2 * p[1].x) / d,
            y: (f1 * p[0].y + f2 * p[1].y) / d,
            z: !_3d ? false : (f1 * p[0].z + f2 * p[1].z) / d,
            t: t,
          };
        }

        // upgrade to quadratic
        f1 *= mt;
        f2 *= 2 * mt;
        f3 *= t * t;

        if (p.length === 3) {
          d = f1 + f2 + f3;
          return {
            x: (f1 * p[0].x + f2 * p[1].x + f3 * p[2].x) / d,
            y: (f1 * p[0].y + f2 * p[1].y + f3 * p[2].y) / d,
            z: !_3d ? false : (f1 * p[0].z + f2 * p[1].z + f3 * p[2].z) / d,
            t: t,
          };
        }

        // upgrade to cubic
        f1 *= mt;
        f2 *= 1.5 * mt;
        f3 *= 3 * mt;
        f4 *= t * t * t;

        if (p.length === 4) {
          d = f1 + f2 + f3 + f4;
          return {
            x: (f1 * p[0].x + f2 * p[1].x + f3 * p[2].x + f4 * p[3].x) / d,
            y: (f1 * p[0].y + f2 * p[1].y + f3 * p[2].y + f4 * p[3].y) / d,
            z: !_3d
              ? false
              : (f1 * p[0].z + f2 * p[1].z + f3 * p[2].z + f4 * p[3].z) / d,
            t: t,
          };
        }
      },

      derive: function (points, _3d) {
        const dpoints = [];
        for (let p = points, d = p.length, c = d - 1; d > 1; d--, c--) {
          const list = [];
          for (let j = 0, dpt; j < c; j++) {
            dpt = {
              x: c * (p[j + 1].x - p[j].x),
              y: c * (p[j + 1].y - p[j].y),
            };
            if (_3d) {
              dpt.z = c * (p[j + 1].z - p[j].z);
            }
            list.push(dpt);
          }
          dpoints.push(list);
          p = list;
        }
        return dpoints;
      },

      between: function (v, m, M) {
        return (
          (m <= v && v <= M) ||
          utils.approximately(v, m) ||
          utils.approximately(v, M)
        );
      },

      approximately: function (a, b, precision) {
        return abs$1(a - b) <= (precision || epsilon);
      },

      length: function (derivativeFn) {
        const z = 0.5,
          len = utils.Tvalues.length;

        let sum = 0;

        for (let i = 0, t; i < len; i++) {
          t = z * utils.Tvalues[i] + z;
          sum += utils.Cvalues[i] * utils.arcfn(t, derivativeFn);
        }
        return z * sum;
      },

      map: function (v, ds, de, ts, te) {
        const d1 = de - ds,
          d2 = te - ts,
          v2 = v - ds,
          r = v2 / d1;
        return ts + d2 * r;
      },

      lerp: function (r, v1, v2) {
        const ret = {
          x: v1.x + r * (v2.x - v1.x),
          y: v1.y + r * (v2.y - v1.y),
        };
        if (v1.z !== undefined && v2.z !== undefined) {
          ret.z = v1.z + r * (v2.z - v1.z);
        }
        return ret;
      },

      pointToString: function (p) {
        let s = p.x + "/" + p.y;
        if (typeof p.z !== "undefined") {
          s += "/" + p.z;
        }
        return s;
      },

      pointsToString: function (points) {
        return "[" + points.map(utils.pointToString).join(", ") + "]";
      },

      copy: function (obj) {
        return JSON.parse(JSON.stringify(obj));
      },

      angle: function (o, v1, v2) {
        const dx1 = v1.x - o.x,
          dy1 = v1.y - o.y,
          dx2 = v2.x - o.x,
          dy2 = v2.y - o.y,
          cross = dx1 * dy2 - dy1 * dx2,
          dot = dx1 * dx2 + dy1 * dy2;
        return atan2(cross, dot);
      },

      // round as string, to avoid rounding errors
      round: function (v, d) {
        const s = "" + v;
        const pos = s.indexOf(".");
        return parseFloat(s.substring(0, pos + 1 + d));
      },

      dist: function (p1, p2) {
        const dx = p1.x - p2.x,
          dy = p1.y - p2.y;
        return sqrt$1(dx * dx + dy * dy);
      },

      closest: function (LUT, point) {
        let mdist = pow(2, 63),
          mpos,
          d;
        LUT.forEach(function (p, idx) {
          d = utils.dist(point, p);
          if (d < mdist) {
            mdist = d;
            mpos = idx;
          }
        });
        return { mdist: mdist, mpos: mpos };
      },

      abcratio: function (t, n) {
        // see ratio(t) note on http://pomax.github.io/bezierinfo/#abc
        if (n !== 2 && n !== 3) {
          return false;
        }
        if (typeof t === "undefined") {
          t = 0.5;
        } else if (t === 0 || t === 1) {
          return t;
        }
        const bottom = pow(t, n) + pow(1 - t, n),
          top = bottom - 1;
        return abs$1(top / bottom);
      },

      projectionratio: function (t, n) {
        // see u(t) note on http://pomax.github.io/bezierinfo/#abc
        if (n !== 2 && n !== 3) {
          return false;
        }
        if (typeof t === "undefined") {
          t = 0.5;
        } else if (t === 0 || t === 1) {
          return t;
        }
        const top = pow(1 - t, n),
          bottom = pow(t, n) + top;
        return top / bottom;
      },

      lli8: function (x1, y1, x2, y2, x3, y3, x4, y4) {
        const nx =
            (x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4),
          ny = (x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4),
          d = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
        if (d == 0) {
          return false;
        }
        return { x: nx / d, y: ny / d };
      },

      lli4: function (p1, p2, p3, p4) {
        const x1 = p1.x,
          y1 = p1.y,
          x2 = p2.x,
          y2 = p2.y,
          x3 = p3.x,
          y3 = p3.y,
          x4 = p4.x,
          y4 = p4.y;
        return utils.lli8(x1, y1, x2, y2, x3, y3, x4, y4);
      },

      lli: function (v1, v2) {
        return utils.lli4(v1, v1.c, v2, v2.c);
      },

      makeline: function (p1, p2) {
        const x1 = p1.x,
          y1 = p1.y,
          x2 = p2.x,
          y2 = p2.y,
          dx = (x2 - x1) / 3,
          dy = (y2 - y1) / 3;
        return new Bezier(
          x1,
          y1,
          x1 + dx,
          y1 + dy,
          x1 + 2 * dx,
          y1 + 2 * dy,
          x2,
          y2
        );
      },

      findbbox: function (sections) {
        let mx = nMax,
          my = nMax,
          MX = nMin,
          MY = nMin;
        sections.forEach(function (s) {
          const bbox = s.bbox();
          if (mx > bbox.x.min) mx = bbox.x.min;
          if (my > bbox.y.min) my = bbox.y.min;
          if (MX < bbox.x.max) MX = bbox.x.max;
          if (MY < bbox.y.max) MY = bbox.y.max;
        });
        return {
          x: { min: mx, mid: (mx + MX) / 2, max: MX, size: MX - mx },
          y: { min: my, mid: (my + MY) / 2, max: MY, size: MY - my },
        };
      },

      shapeintersections: function (
        s1,
        bbox1,
        s2,
        bbox2,
        curveIntersectionThreshold
      ) {
        if (!utils.bboxoverlap(bbox1, bbox2)) return [];
        const intersections = [];
        const a1 = [s1.startcap, s1.forward, s1.back, s1.endcap];
        const a2 = [s2.startcap, s2.forward, s2.back, s2.endcap];
        a1.forEach(function (l1) {
          if (l1.virtual) return;
          a2.forEach(function (l2) {
            if (l2.virtual) return;
            const iss = l1.intersects(l2, curveIntersectionThreshold);
            if (iss.length > 0) {
              iss.c1 = l1;
              iss.c2 = l2;
              iss.s1 = s1;
              iss.s2 = s2;
              intersections.push(iss);
            }
          });
        });
        return intersections;
      },

      makeshape: function (forward, back, curveIntersectionThreshold) {
        const bpl = back.points.length;
        const fpl = forward.points.length;
        const start = utils.makeline(back.points[bpl - 1], forward.points[0]);
        const end = utils.makeline(forward.points[fpl - 1], back.points[0]);
        const shape = {
          startcap: start,
          forward: forward,
          back: back,
          endcap: end,
          bbox: utils.findbbox([start, forward, back, end]),
        };
        shape.intersections = function (s2) {
          return utils.shapeintersections(
            shape,
            shape.bbox,
            s2,
            s2.bbox,
            curveIntersectionThreshold
          );
        };
        return shape;
      },

      getminmax: function (curve, d, list) {
        if (!list) return { min: 0, max: 0 };
        let min = nMax,
          max = nMin,
          t,
          c;
        if (list.indexOf(0) === -1) {
          list = [0].concat(list);
        }
        if (list.indexOf(1) === -1) {
          list.push(1);
        }
        for (let i = 0, len = list.length; i < len; i++) {
          t = list[i];
          c = curve.get(t);
          if (c[d] < min) {
            min = c[d];
          }
          if (c[d] > max) {
            max = c[d];
          }
        }
        return { min: min, mid: (min + max) / 2, max: max, size: max - min };
      },

      align: function (points, line) {
        const tx = line.p1.x,
          ty = line.p1.y,
          a = -atan2(line.p2.y - ty, line.p2.x - tx),
          d = function (v) {
            return {
              x: (v.x - tx) * cos$1(a) - (v.y - ty) * sin$1(a),
              y: (v.x - tx) * sin$1(a) + (v.y - ty) * cos$1(a),
            };
          };
        return points.map(d);
      },

      roots: function (points, line) {
        line = line || { p1: { x: 0, y: 0 }, p2: { x: 1, y: 0 } };

        const order = points.length - 1;
        const aligned = utils.align(points, line);
        const reduce = function (t) {
          return 0 <= t && t <= 1;
        };

        if (order === 2) {
          const a = aligned[0].y,
            b = aligned[1].y,
            c = aligned[2].y,
            d = a - 2 * b + c;
          if (d !== 0) {
            const m1 = -sqrt$1(b * b - a * c),
              m2 = -a + b,
              v1 = -(m1 + m2) / d,
              v2 = -(-m1 + m2) / d;
            return [v1, v2].filter(reduce);
          } else if (b !== c && d === 0) {
            return [(2 * b - c) / (2 * b - 2 * c)].filter(reduce);
          }
          return [];
        }

        // see http://www.trans4mind.com/personal_development/mathematics/polynomials/cubicAlgebra.htm
        const pa = aligned[0].y,
          pb = aligned[1].y,
          pc = aligned[2].y,
          pd = aligned[3].y;

        let d = -pa + 3 * pb - 3 * pc + pd,
          a = 3 * pa - 6 * pb + 3 * pc,
          b = -3 * pa + 3 * pb,
          c = pa;

        if (utils.approximately(d, 0)) {
          // this is not a cubic curve.
          if (utils.approximately(a, 0)) {
            // in fact, this is not a quadratic curve either.
            if (utils.approximately(b, 0)) {
              // in fact in fact, there are no solutions.
              return [];
            }
            // linear solution:
            return [-c / b].filter(reduce);
          }
          // quadratic solution:
          const q = sqrt$1(b * b - 4 * a * c),
            a2 = 2 * a;
          return [(q - b) / a2, (-b - q) / a2].filter(reduce);
        }

        // at this point, we know we need a cubic solution:

        a /= d;
        b /= d;
        c /= d;

        const p = (3 * b - a * a) / 3,
          p3 = p / 3,
          q = (2 * a * a * a - 9 * a * b + 27 * c) / 27,
          q2 = q / 2,
          discriminant = q2 * q2 + p3 * p3 * p3;

        let u1, v1, x1, x2, x3;
        if (discriminant < 0) {
          const mp3 = -p / 3,
            mp33 = mp3 * mp3 * mp3,
            r = sqrt$1(mp33),
            t = -q / (2 * r),
            cosphi = t < -1 ? -1 : t > 1 ? 1 : t,
            phi = acos$1(cosphi),
            crtr = crt(r),
            t1 = 2 * crtr;
          x1 = t1 * cos$1(phi / 3) - a / 3;
          x2 = t1 * cos$1((phi + tau) / 3) - a / 3;
          x3 = t1 * cos$1((phi + 2 * tau) / 3) - a / 3;
          return [x1, x2, x3].filter(reduce);
        } else if (discriminant === 0) {
          u1 = q2 < 0 ? crt(-q2) : -crt(q2);
          x1 = 2 * u1 - a / 3;
          x2 = -u1 - a / 3;
          return [x1, x2].filter(reduce);
        } else {
          const sd = sqrt$1(discriminant);
          u1 = crt(-q2 + sd);
          v1 = crt(q2 + sd);
          return [u1 - v1 - a / 3].filter(reduce);
        }
      },

      droots: function (p) {
        // quadratic roots are easy
        if (p.length === 3) {
          const a = p[0],
            b = p[1],
            c = p[2],
            d = a - 2 * b + c;
          if (d !== 0) {
            const m1 = -sqrt$1(b * b - a * c),
              m2 = -a + b,
              v1 = -(m1 + m2) / d,
              v2 = -(-m1 + m2) / d;
            return [v1, v2];
          } else if (b !== c && d === 0) {
            return [(2 * b - c) / (2 * (b - c))];
          }
          return [];
        }

        // linear roots are even easier
        if (p.length === 2) {
          const a = p[0],
            b = p[1];
          if (a !== b) {
            return [a / (a - b)];
          }
          return [];
        }

        return [];
      },

      curvature: function (t, d1, d2, _3d, kOnly) {
        let num,
          dnm,
          adk,
          dk,
          k = 0,
          r = 0;

        //
        // We're using the following formula for curvature:
        //
        //              x'y" - y'x"
        //   k(t) = ------------------
        //           (x'² + y'²)^(3/2)
        //
        // from https://en.wikipedia.org/wiki/Radius_of_curvature#Definition
        //
        // With it corresponding 3D counterpart:
        //
        //          sqrt( (y'z" - y"z')² + (z'x" - z"x')² + (x'y" - x"y')²)
        //   k(t) = -------------------------------------------------------
        //                     (x'² + y'² + z'²)^(3/2)
        //

        const d = utils.compute(t, d1);
        const dd = utils.compute(t, d2);
        const qdsum = d.x * d.x + d.y * d.y;

        if (_3d) {
          num = sqrt$1(
            pow(d.y * dd.z - dd.y * d.z, 2) +
              pow(d.z * dd.x - dd.z * d.x, 2) +
              pow(d.x * dd.y - dd.x * d.y, 2)
          );
          dnm = pow(qdsum + d.z * d.z, 3 / 2);
        } else {
          num = d.x * dd.y - d.y * dd.x;
          dnm = pow(qdsum, 3 / 2);
        }

        if (num === 0 || dnm === 0) {
          return { k: 0, r: 0 };
        }

        k = num / dnm;
        r = dnm / num;

        // We're also computing the derivative of kappa, because
        // there is value in knowing the rate of change for the
        // curvature along the curve. And we're just going to
        // ballpark it based on an epsilon.
        if (!kOnly) {
          // compute k'(t) based on the interval before, and after it,
          // to at least try to not introduce forward/backward pass bias.
          const pk = utils.curvature(t - 0.001, d1, d2, _3d, true).k;
          const nk = utils.curvature(t + 0.001, d1, d2, _3d, true).k;
          dk = (nk - k + (k - pk)) / 2;
          adk = (abs$1(nk - k) + abs$1(k - pk)) / 2;
        }

        return { k: k, r: r, dk: dk, adk: adk };
      },

      inflections: function (points) {
        if (points.length < 4) return [];

        // FIXME: TODO: add in inflection abstraction for quartic+ curves?

        const p = utils.align(points, { p1: points[0], p2: points.slice(-1)[0] }),
          a = p[2].x * p[1].y,
          b = p[3].x * p[1].y,
          c = p[1].x * p[2].y,
          d = p[3].x * p[2].y,
          v1 = 18 * (-3 * a + 2 * b + 3 * c - d),
          v2 = 18 * (3 * a - b - 3 * c),
          v3 = 18 * (c - a);

        if (utils.approximately(v1, 0)) {
          if (!utils.approximately(v2, 0)) {
            let t = -v3 / v2;
            if (0 <= t && t <= 1) return [t];
          }
          return [];
        }

        const trm = v2 * v2 - 4 * v1 * v3,
          sq = Math.sqrt(trm),
          d2 = 2 * v1;

        if (utils.approximately(d2, 0)) return [];

        return [(sq - v2) / d2, -(v2 + sq) / d2].filter(function (r) {
          return 0 <= r && r <= 1;
        });
      },

      bboxoverlap: function (b1, b2) {
        const dims = ["x", "y"],
          len = dims.length;

        for (let i = 0, dim, l, t, d; i < len; i++) {
          dim = dims[i];
          l = b1[dim].mid;
          t = b2[dim].mid;
          d = (b1[dim].size + b2[dim].size) / 2;
          if (abs$1(l - t) >= d) return false;
        }
        return true;
      },

      expandbox: function (bbox, _bbox) {
        if (_bbox.x.min < bbox.x.min) {
          bbox.x.min = _bbox.x.min;
        }
        if (_bbox.y.min < bbox.y.min) {
          bbox.y.min = _bbox.y.min;
        }
        if (_bbox.z && _bbox.z.min < bbox.z.min) {
          bbox.z.min = _bbox.z.min;
        }
        if (_bbox.x.max > bbox.x.max) {
          bbox.x.max = _bbox.x.max;
        }
        if (_bbox.y.max > bbox.y.max) {
          bbox.y.max = _bbox.y.max;
        }
        if (_bbox.z && _bbox.z.max > bbox.z.max) {
          bbox.z.max = _bbox.z.max;
        }
        bbox.x.mid = (bbox.x.min + bbox.x.max) / 2;
        bbox.y.mid = (bbox.y.min + bbox.y.max) / 2;
        if (bbox.z) {
          bbox.z.mid = (bbox.z.min + bbox.z.max) / 2;
        }
        bbox.x.size = bbox.x.max - bbox.x.min;
        bbox.y.size = bbox.y.max - bbox.y.min;
        if (bbox.z) {
          bbox.z.size = bbox.z.max - bbox.z.min;
        }
      },

      pairiteration: function (c1, c2, curveIntersectionThreshold) {
        const c1b = c1.bbox(),
          c2b = c2.bbox(),
          r = 100000,
          threshold = curveIntersectionThreshold || 0.5;

        if (
          c1b.x.size + c1b.y.size < threshold &&
          c2b.x.size + c2b.y.size < threshold
        ) {
          return [
            (((r * (c1._t1 + c1._t2)) / 2) | 0) / r +
              "/" +
              (((r * (c2._t1 + c2._t2)) / 2) | 0) / r,
          ];
        }

        let cc1 = c1.split(0.5),
          cc2 = c2.split(0.5),
          pairs = [
            { left: cc1.left, right: cc2.left },
            { left: cc1.left, right: cc2.right },
            { left: cc1.right, right: cc2.right },
            { left: cc1.right, right: cc2.left },
          ];

        pairs = pairs.filter(function (pair) {
          return utils.bboxoverlap(pair.left.bbox(), pair.right.bbox());
        });

        let results = [];

        if (pairs.length === 0) return results;

        pairs.forEach(function (pair) {
          results = results.concat(
            utils.pairiteration(pair.left, pair.right, threshold)
          );
        });

        results = results.filter(function (v, i) {
          return results.indexOf(v) === i;
        });

        return results;
      },

      getccenter: function (p1, p2, p3) {
        const dx1 = p2.x - p1.x,
          dy1 = p2.y - p1.y,
          dx2 = p3.x - p2.x,
          dy2 = p3.y - p2.y,
          dx1p = dx1 * cos$1(quart) - dy1 * sin$1(quart),
          dy1p = dx1 * sin$1(quart) + dy1 * cos$1(quart),
          dx2p = dx2 * cos$1(quart) - dy2 * sin$1(quart),
          dy2p = dx2 * sin$1(quart) + dy2 * cos$1(quart),
          // chord midpoints
          mx1 = (p1.x + p2.x) / 2,
          my1 = (p1.y + p2.y) / 2,
          mx2 = (p2.x + p3.x) / 2,
          my2 = (p2.y + p3.y) / 2,
          // midpoint offsets
          mx1n = mx1 + dx1p,
          my1n = my1 + dy1p,
          mx2n = mx2 + dx2p,
          my2n = my2 + dy2p,
          // intersection of these lines:
          arc = utils.lli8(mx1, my1, mx1n, my1n, mx2, my2, mx2n, my2n),
          r = utils.dist(arc, p1);

        // arc start/end values, over mid point:
        let s = atan2(p1.y - arc.y, p1.x - arc.x),
          m = atan2(p2.y - arc.y, p2.x - arc.x),
          e = atan2(p3.y - arc.y, p3.x - arc.x),
          _;

        // determine arc direction (cw/ccw correction)
        if (s < e) {
          // if s<m<e, arc(s, e)
          // if m<s<e, arc(e, s + tau)
          // if s<e<m, arc(e, s + tau)
          if (s > m || m > e) {
            s += tau;
          }
          if (s > e) {
            _ = e;
            e = s;
            s = _;
          }
        } else {
          // if e<m<s, arc(e, s)
          // if m<e<s, arc(s, e + tau)
          // if e<s<m, arc(s, e + tau)
          if (e < m && m < s) {
            _ = e;
            e = s;
            s = _;
          } else {
            e += tau;
          }
        }
        // assign and done.
        arc.s = s;
        arc.e = e;
        arc.r = r;
        return arc;
      },

      numberSort: function (a, b) {
        return a - b;
      },
    };

    /**
     * Poly Bezier
     * @param {[type]} curves [description]
     */
    class PolyBezier {
      constructor(curves) {
        this.curves = [];
        this._3d = false;
        if (!!curves) {
          this.curves = curves;
          this._3d = this.curves[0]._3d;
        }
      }

      valueOf() {
        return this.toString();
      }

      toString() {
        return (
          "[" +
          this.curves
            .map(function (curve) {
              return utils.pointsToString(curve.points);
            })
            .join(", ") +
          "]"
        );
      }

      addCurve(curve) {
        this.curves.push(curve);
        this._3d = this._3d || curve._3d;
      }

      length() {
        return this.curves
          .map(function (v) {
            return v.length();
          })
          .reduce(function (a, b) {
            return a + b;
          });
      }

      curve(idx) {
        return this.curves[idx];
      }

      bbox() {
        const c = this.curves;
        var bbox = c[0].bbox();
        for (var i = 1; i < c.length; i++) {
          utils.expandbox(bbox, c[i].bbox());
        }
        return bbox;
      }

      offset(d) {
        const offset = [];
        this.curves.forEach(function (v) {
          offset.push(...v.offset(d));
        });
        return new PolyBezier(offset);
      }
    }

    /**
      A javascript Bezier curve library by Pomax.

      Based on http://pomax.github.io/bezierinfo

      This code is MIT licensed.
    **/

    // math-inlining.
    const { abs, min, max, cos, sin, acos, sqrt } = Math;
    const pi = Math.PI;

    /**
     * Bezier curve constructor.
     *
     * ...docs pending...
     */
    class Bezier {
      constructor(coords) {
        let args =
          coords && coords.forEach ? coords : Array.from(arguments).slice();
        let coordlen = false;

        if (typeof args[0] === "object") {
          coordlen = args.length;
          const newargs = [];
          args.forEach(function (point) {
            ["x", "y", "z"].forEach(function (d) {
              if (typeof point[d] !== "undefined") {
                newargs.push(point[d]);
              }
            });
          });
          args = newargs;
        }

        let higher = false;
        const len = args.length;

        if (coordlen) {
          if (coordlen > 4) {
            if (arguments.length !== 1) {
              throw new Error(
                "Only new Bezier(point[]) is accepted for 4th and higher order curves"
              );
            }
            higher = true;
          }
        } else {
          if (len !== 6 && len !== 8 && len !== 9 && len !== 12) {
            if (arguments.length !== 1) {
              throw new Error(
                "Only new Bezier(point[]) is accepted for 4th and higher order curves"
              );
            }
          }
        }

        const _3d = (this._3d =
          (!higher && (len === 9 || len === 12)) ||
          (coords && coords[0] && typeof coords[0].z !== "undefined"));

        const points = (this.points = []);
        for (let idx = 0, step = _3d ? 3 : 2; idx < len; idx += step) {
          var point = {
            x: args[idx],
            y: args[idx + 1],
          };
          if (_3d) {
            point.z = args[idx + 2];
          }
          points.push(point);
        }
        const order = (this.order = points.length - 1);

        const dims = (this.dims = ["x", "y"]);
        if (_3d) dims.push("z");
        this.dimlen = dims.length;

        const aligned = utils.align(points, { p1: points[0], p2: points[order] });
        this._linear = !aligned.some((p) => abs(p.y) > 0.0001);

        this._lut = [];

        this._t1 = 0;
        this._t2 = 1;
        this.update();
      }

      static quadraticFromPoints(p1, p2, p3, t) {
        if (typeof t === "undefined") {
          t = 0.5;
        }
        // shortcuts, although they're really dumb
        if (t === 0) {
          return new Bezier(p2, p2, p3);
        }
        if (t === 1) {
          return new Bezier(p1, p2, p2);
        }
        // real fitting.
        const abc = Bezier.getABC(2, p1, p2, p3, t);
        return new Bezier(p1, abc.A, p3);
      }

      static cubicFromPoints(S, B, E, t, d1) {
        if (typeof t === "undefined") {
          t = 0.5;
        }
        const abc = Bezier.getABC(3, S, B, E, t);
        if (typeof d1 === "undefined") {
          d1 = utils.dist(B, abc.C);
        }
        const d2 = (d1 * (1 - t)) / t;

        const selen = utils.dist(S, E),
          lx = (E.x - S.x) / selen,
          ly = (E.y - S.y) / selen,
          bx1 = d1 * lx,
          by1 = d1 * ly,
          bx2 = d2 * lx,
          by2 = d2 * ly;
        // derivation of new hull coordinates
        const e1 = { x: B.x - bx1, y: B.y - by1 },
          e2 = { x: B.x + bx2, y: B.y + by2 },
          A = abc.A,
          v1 = { x: A.x + (e1.x - A.x) / (1 - t), y: A.y + (e1.y - A.y) / (1 - t) },
          v2 = { x: A.x + (e2.x - A.x) / t, y: A.y + (e2.y - A.y) / t },
          nc1 = { x: S.x + (v1.x - S.x) / t, y: S.y + (v1.y - S.y) / t },
          nc2 = {
            x: E.x + (v2.x - E.x) / (1 - t),
            y: E.y + (v2.y - E.y) / (1 - t),
          };
        // ...done
        return new Bezier(S, nc1, nc2, E);
      }

      static getUtils() {
        return utils;
      }

      getUtils() {
        return Bezier.getUtils();
      }

      static get PolyBezier() {
        return PolyBezier;
      }

      valueOf() {
        return this.toString();
      }

      toString() {
        return utils.pointsToString(this.points);
      }

      toSVG() {
        if (this._3d) return false;
        const p = this.points,
          x = p[0].x,
          y = p[0].y,
          s = ["M", x, y, this.order === 2 ? "Q" : "C"];
        for (let i = 1, last = p.length; i < last; i++) {
          s.push(p[i].x);
          s.push(p[i].y);
        }
        return s.join(" ");
      }

      setRatios(ratios) {
        if (ratios.length !== this.points.length) {
          throw new Error("incorrect number of ratio values");
        }
        this.ratios = ratios;
        this._lut = []; //  invalidate any precomputed LUT
      }

      verify() {
        const print = this.coordDigest();
        if (print !== this._print) {
          this._print = print;
          this.update();
        }
      }

      coordDigest() {
        return this.points
          .map(function (c, pos) {
            return "" + pos + c.x + c.y + (c.z ? c.z : 0);
          })
          .join("");
      }

      update() {
        // invalidate any precomputed LUT
        this._lut = [];
        this.dpoints = utils.derive(this.points, this._3d);
        this.computedirection();
      }

      computedirection() {
        const points = this.points;
        const angle = utils.angle(points[0], points[this.order], points[1]);
        this.clockwise = angle > 0;
      }

      length() {
        return utils.length(this.derivative.bind(this));
      }

      static getABC(order = 2, S, B, E, t = 0.5) {
        const u = utils.projectionratio(t, order),
          um = 1 - u,
          C = {
            x: u * S.x + um * E.x,
            y: u * S.y + um * E.y,
          },
          s = utils.abcratio(t, order),
          A = {
            x: B.x + (B.x - C.x) / s,
            y: B.y + (B.y - C.y) / s,
          };
        return { A, B, C, S, E };
      }

      getABC(t, B) {
        B = B || this.get(t);
        let S = this.points[0];
        let E = this.points[this.order];
        return Bezier.getABC(this.order, S, B, E, t);
      }

      getLUT(steps) {
        this.verify();
        steps = steps || 100;
        if (this._lut.length === steps) {
          return this._lut;
        }
        this._lut = [];
        // We want a range from 0 to 1 inclusive, so
        // we decrement and then use <= rather than <:
        steps--;
        for (let i = 0, p, t; i < steps; i++) {
          t = i / (steps - 1);
          p = this.compute(t);
          p.t = t;
          this._lut.push(p);
        }
        return this._lut;
      }

      on(point, error) {
        error = error || 5;
        const lut = this.getLUT(),
          hits = [];
        for (let i = 0, c, t = 0; i < lut.length; i++) {
          c = lut[i];
          if (utils.dist(c, point) < error) {
            hits.push(c);
            t += i / lut.length;
          }
        }
        if (!hits.length) return false;
        return (t /= hits.length);
      }

      project(point) {
        // step 1: coarse check
        const LUT = this.getLUT(),
          l = LUT.length - 1,
          closest = utils.closest(LUT, point),
          mpos = closest.mpos,
          t1 = (mpos - 1) / l,
          t2 = (mpos + 1) / l,
          step = 0.1 / l;

        // step 2: fine check
        let mdist = closest.mdist,
          t = t1,
          ft = t,
          p;
        mdist += 1;
        for (let d; t < t2 + step; t += step) {
          p = this.compute(t);
          d = utils.dist(point, p);
          if (d < mdist) {
            mdist = d;
            ft = t;
          }
        }
        ft = ft < 0 ? 0 : ft > 1 ? 1 : ft;
        p = this.compute(ft);
        p.t = ft;
        p.d = mdist;
        return p;
      }

      get(t) {
        return this.compute(t);
      }

      point(idx) {
        return this.points[idx];
      }

      compute(t) {
        if (this.ratios) {
          return utils.computeWithRatios(t, this.points, this.ratios, this._3d);
        }
        return utils.compute(t, this.points, this._3d, this.ratios);
      }

      raise() {
        const p = this.points,
          np = [p[0]],
          k = p.length;
        for (let i = 1, pi, pim; i < k; i++) {
          pi = p[i];
          pim = p[i - 1];
          np[i] = {
            x: ((k - i) / k) * pi.x + (i / k) * pim.x,
            y: ((k - i) / k) * pi.y + (i / k) * pim.y,
          };
        }
        np[k] = p[k - 1];
        return new Bezier(np);
      }

      derivative(t) {
        return utils.compute(t, this.dpoints[0], this._3d);
      }

      dderivative(t) {
        return utils.compute(t, this.dpoints[1], this._3d);
      }

      align() {
        let p = this.points;
        return new Bezier(utils.align(p, { p1: p[0], p2: p[p.length - 1] }));
      }

      curvature(t) {
        return utils.curvature(t, this.dpoints[0], this.dpoints[1], this._3d);
      }

      inflections() {
        return utils.inflections(this.points);
      }

      normal(t) {
        return this._3d ? this.__normal3(t) : this.__normal2(t);
      }

      __normal2(t) {
        const d = this.derivative(t);
        const q = sqrt(d.x * d.x + d.y * d.y);
        return { x: -d.y / q, y: d.x / q };
      }

      __normal3(t) {
        // see http://stackoverflow.com/questions/25453159
        const r1 = this.derivative(t),
          r2 = this.derivative(t + 0.01),
          q1 = sqrt(r1.x * r1.x + r1.y * r1.y + r1.z * r1.z),
          q2 = sqrt(r2.x * r2.x + r2.y * r2.y + r2.z * r2.z);
        r1.x /= q1;
        r1.y /= q1;
        r1.z /= q1;
        r2.x /= q2;
        r2.y /= q2;
        r2.z /= q2;
        // cross product
        const c = {
          x: r2.y * r1.z - r2.z * r1.y,
          y: r2.z * r1.x - r2.x * r1.z,
          z: r2.x * r1.y - r2.y * r1.x,
        };
        const m = sqrt(c.x * c.x + c.y * c.y + c.z * c.z);
        c.x /= m;
        c.y /= m;
        c.z /= m;
        // rotation matrix
        const R = [
          c.x * c.x,
          c.x * c.y - c.z,
          c.x * c.z + c.y,
          c.x * c.y + c.z,
          c.y * c.y,
          c.y * c.z - c.x,
          c.x * c.z - c.y,
          c.y * c.z + c.x,
          c.z * c.z,
        ];
        // normal vector:
        const n = {
          x: R[0] * r1.x + R[1] * r1.y + R[2] * r1.z,
          y: R[3] * r1.x + R[4] * r1.y + R[5] * r1.z,
          z: R[6] * r1.x + R[7] * r1.y + R[8] * r1.z,
        };
        return n;
      }

      hull(t) {
        let p = this.points,
          _p = [],
          q = [],
          idx = 0;
        q[idx++] = p[0];
        q[idx++] = p[1];
        q[idx++] = p[2];
        if (this.order === 3) {
          q[idx++] = p[3];
        }
        // we lerp between all points at each iteration, until we have 1 point left.
        while (p.length > 1) {
          _p = [];
          for (let i = 0, pt, l = p.length - 1; i < l; i++) {
            pt = utils.lerp(t, p[i], p[i + 1]);
            q[idx++] = pt;
            _p.push(pt);
          }
          p = _p;
        }
        return q;
      }

      split(t1, t2) {
        // shortcuts
        if (t1 === 0 && !!t2) {
          return this.split(t2).left;
        }
        if (t2 === 1) {
          return this.split(t1).right;
        }

        // no shortcut: use "de Casteljau" iteration.
        const q = this.hull(t1);
        const result = {
          left:
            this.order === 2
              ? new Bezier([q[0], q[3], q[5]])
              : new Bezier([q[0], q[4], q[7], q[9]]),
          right:
            this.order === 2
              ? new Bezier([q[5], q[4], q[2]])
              : new Bezier([q[9], q[8], q[6], q[3]]),
          span: q,
        };

        // make sure we bind _t1/_t2 information!
        result.left._t1 = utils.map(0, 0, 1, this._t1, this._t2);
        result.left._t2 = utils.map(t1, 0, 1, this._t1, this._t2);
        result.right._t1 = utils.map(t1, 0, 1, this._t1, this._t2);
        result.right._t2 = utils.map(1, 0, 1, this._t1, this._t2);

        // if we have no t2, we're done
        if (!t2) {
          return result;
        }

        // if we have a t2, split again:
        t2 = utils.map(t2, t1, 1, 0, 1);
        return result.right.split(t2).left;
      }

      extrema() {
        const result = {};
        let roots = [];

        this.dims.forEach(
          function (dim) {
            let mfn = function (v) {
              return v[dim];
            };
            let p = this.dpoints[0].map(mfn);
            result[dim] = utils.droots(p);
            if (this.order === 3) {
              p = this.dpoints[1].map(mfn);
              result[dim] = result[dim].concat(utils.droots(p));
            }
            result[dim] = result[dim].filter(function (t) {
              return t >= 0 && t <= 1;
            });
            roots = roots.concat(result[dim].sort(utils.numberSort));
          }.bind(this)
        );

        result.values = roots.sort(utils.numberSort).filter(function (v, idx) {
          return roots.indexOf(v) === idx;
        });

        return result;
      }

      bbox() {
        const extrema = this.extrema(),
          result = {};
        this.dims.forEach(
          function (d) {
            result[d] = utils.getminmax(this, d, extrema[d]);
          }.bind(this)
        );
        return result;
      }

      overlaps(curve) {
        const lbbox = this.bbox(),
          tbbox = curve.bbox();
        return utils.bboxoverlap(lbbox, tbbox);
      }

      offset(t, d) {
        if (typeof d !== "undefined") {
          const c = this.get(t),
            n = this.normal(t);
          const ret = {
            c: c,
            n: n,
            x: c.x + n.x * d,
            y: c.y + n.y * d,
          };
          if (this._3d) {
            ret.z = c.z + n.z * d;
          }
          return ret;
        }
        if (this._linear) {
          const nv = this.normal(0),
            coords = this.points.map(function (p) {
              const ret = {
                x: p.x + t * nv.x,
                y: p.y + t * nv.y,
              };
              if (p.z && nv.z) {
                ret.z = p.z + t * nv.z;
              }
              return ret;
            });
          return [new Bezier(coords)];
        }
        return this.reduce().map(function (s) {
          if (s._linear) {
            return s.offset(t)[0];
          }
          return s.scale(t);
        });
      }

      simple() {
        if (this.order === 3) {
          const a1 = utils.angle(this.points[0], this.points[3], this.points[1]);
          const a2 = utils.angle(this.points[0], this.points[3], this.points[2]);
          if ((a1 > 0 && a2 < 0) || (a1 < 0 && a2 > 0)) return false;
        }
        const n1 = this.normal(0);
        const n2 = this.normal(1);
        let s = n1.x * n2.x + n1.y * n2.y;
        if (this._3d) {
          s += n1.z * n2.z;
        }
        return abs(acos(s)) < pi / 3;
      }

      reduce() {
        // TODO: examine these var types in more detail...
        let i,
          t1 = 0,
          t2 = 0,
          step = 0.01,
          segment,
          pass1 = [],
          pass2 = [];
        // first pass: split on extrema
        let extrema = this.extrema().values;
        if (extrema.indexOf(0) === -1) {
          extrema = [0].concat(extrema);
        }
        if (extrema.indexOf(1) === -1) {
          extrema.push(1);
        }

        for (t1 = extrema[0], i = 1; i < extrema.length; i++) {
          t2 = extrema[i];
          segment = this.split(t1, t2);
          segment._t1 = t1;
          segment._t2 = t2;
          pass1.push(segment);
          t1 = t2;
        }

        // second pass: further reduce these segments to simple segments
        pass1.forEach(function (p1) {
          t1 = 0;
          t2 = 0;
          while (t2 <= 1) {
            for (t2 = t1 + step; t2 <= 1 + step; t2 += step) {
              segment = p1.split(t1, t2);
              if (!segment.simple()) {
                t2 -= step;
                if (abs(t1 - t2) < step) {
                  // we can never form a reduction
                  return [];
                }
                segment = p1.split(t1, t2);
                segment._t1 = utils.map(t1, 0, 1, p1._t1, p1._t2);
                segment._t2 = utils.map(t2, 0, 1, p1._t1, p1._t2);
                pass2.push(segment);
                t1 = t2;
                break;
              }
            }
          }
          if (t1 < 1) {
            segment = p1.split(t1, 1);
            segment._t1 = utils.map(t1, 0, 1, p1._t1, p1._t2);
            segment._t2 = p1._t2;
            pass2.push(segment);
          }
        });
        return pass2;
      }

      scale(d) {
        const order = this.order;
        let distanceFn = false;
        if (typeof d === "function") {
          distanceFn = d;
        }
        if (distanceFn && order === 2) {
          return this.raise().scale(distanceFn);
        }

        // TODO: add special handling for degenerate (=linear) curves.
        const clockwise = this.clockwise;
        const r1 = distanceFn ? distanceFn(0) : d;
        const r2 = distanceFn ? distanceFn(1) : d;
        const v = [this.offset(0, 10), this.offset(1, 10)];
        const points = this.points;
        const np = [];
        const o = utils.lli4(v[0], v[0].c, v[1], v[1].c);

        if (!o) {
          throw new Error("cannot scale this curve. Try reducing it first.");
        }
        // move all points by distance 'd' wrt the origin 'o'

        // move end points by fixed distance along normal.
        [0, 1].forEach(function (t) {
          const p = (np[t * order] = utils.copy(points[t * order]));
          p.x += (t ? r2 : r1) * v[t].n.x;
          p.y += (t ? r2 : r1) * v[t].n.y;
        });

        if (!distanceFn) {
          // move control points to lie on the intersection of the offset
          // derivative vector, and the origin-through-control vector
          [0, 1].forEach((t) => {
            if (order === 2 && !!t) return;
            const p = np[t * order];
            const d = this.derivative(t);
            const p2 = { x: p.x + d.x, y: p.y + d.y };
            np[t + 1] = utils.lli4(p, p2, o, points[t + 1]);
          });
          return new Bezier(np);
        }

        // move control points by "however much necessary to
        // ensure the correct tangent to endpoint".
        [0, 1].forEach(function (t) {
          if (order === 2 && !!t) return;
          var p = points[t + 1];
          var ov = {
            x: p.x - o.x,
            y: p.y - o.y,
          };
          var rc = distanceFn ? distanceFn((t + 1) / order) : d;
          if (distanceFn && !clockwise) rc = -rc;
          var m = sqrt(ov.x * ov.x + ov.y * ov.y);
          ov.x /= m;
          ov.y /= m;
          np[t + 1] = {
            x: p.x + rc * ov.x,
            y: p.y + rc * ov.y,
          };
        });
        return new Bezier(np);
      }

      outline(d1, d2, d3, d4) {
        d2 = typeof d2 === "undefined" ? d1 : d2;
        const reduced = this.reduce(),
          len = reduced.length,
          fcurves = [];

        let bcurves = [],
          p,
          alen = 0,
          tlen = this.length();

        const graduated = typeof d3 !== "undefined" && typeof d4 !== "undefined";

        function linearDistanceFunction(s, e, tlen, alen, slen) {
          return function (v) {
            const f1 = alen / tlen,
              f2 = (alen + slen) / tlen,
              d = e - s;
            return utils.map(v, 0, 1, s + f1 * d, s + f2 * d);
          };
        }

        // form curve oulines
        reduced.forEach(function (segment) {
          const slen = segment.length();
          if (graduated) {
            fcurves.push(
              segment.scale(linearDistanceFunction(d1, d3, tlen, alen, slen))
            );
            bcurves.push(
              segment.scale(linearDistanceFunction(-d2, -d4, tlen, alen, slen))
            );
          } else {
            fcurves.push(segment.scale(d1));
            bcurves.push(segment.scale(-d2));
          }
          alen += slen;
        });

        // reverse the "return" outline
        bcurves = bcurves
          .map(function (s) {
            p = s.points;
            if (p[3]) {
              s.points = [p[3], p[2], p[1], p[0]];
            } else {
              s.points = [p[2], p[1], p[0]];
            }
            return s;
          })
          .reverse();

        // form the endcaps as lines
        const fs = fcurves[0].points[0],
          fe = fcurves[len - 1].points[fcurves[len - 1].points.length - 1],
          bs = bcurves[len - 1].points[bcurves[len - 1].points.length - 1],
          be = bcurves[0].points[0],
          ls = utils.makeline(bs, fs),
          le = utils.makeline(fe, be),
          segments = [ls].concat(fcurves).concat([le]).concat(bcurves);
          segments.length;

        return new PolyBezier(segments);
      }

      outlineshapes(d1, d2, curveIntersectionThreshold) {
        d2 = d2 || d1;
        const outline = this.outline(d1, d2).curves;
        const shapes = [];
        for (let i = 1, len = outline.length; i < len / 2; i++) {
          const shape = utils.makeshape(
            outline[i],
            outline[len - i],
            curveIntersectionThreshold
          );
          shape.startcap.virtual = i > 1;
          shape.endcap.virtual = i < len / 2 - 1;
          shapes.push(shape);
        }
        return shapes;
      }

      intersects(curve, curveIntersectionThreshold) {
        if (!curve) return this.selfintersects(curveIntersectionThreshold);
        if (curve.p1 && curve.p2) {
          return this.lineIntersects(curve);
        }
        if (curve instanceof Bezier) {
          curve = curve.reduce();
        }
        return this.curveintersects(
          this.reduce(),
          curve,
          curveIntersectionThreshold
        );
      }

      lineIntersects(line) {
        const mx = min(line.p1.x, line.p2.x),
          my = min(line.p1.y, line.p2.y),
          MX = max(line.p1.x, line.p2.x),
          MY = max(line.p1.y, line.p2.y);
        return utils.roots(this.points, line).filter((t) => {
          var p = this.get(t);
          return utils.between(p.x, mx, MX) && utils.between(p.y, my, MY);
        });
      }

      selfintersects(curveIntersectionThreshold) {
        // "simple" curves cannot intersect with their direct
        // neighbour, so for each segment X we check whether
        // it intersects [0:x-2][x+2:last].

        const reduced = this.reduce(),
          len = reduced.length - 2,
          results = [];

        for (let i = 0, result, left, right; i < len; i++) {
          left = reduced.slice(i, i + 1);
          right = reduced.slice(i + 2);
          result = this.curveintersects(left, right, curveIntersectionThreshold);
          results.push(...result);
        }
        return results;
      }

      curveintersects(c1, c2, curveIntersectionThreshold) {
        const pairs = [];
        // step 1: pair off any overlapping segments
        c1.forEach(function (l) {
          c2.forEach(function (r) {
            if (l.overlaps(r)) {
              pairs.push({ left: l, right: r });
            }
          });
        });
        // step 2: for each pairing, run through the convergence algorithm.
        let intersections = [];
        pairs.forEach(function (pair) {
          const result = utils.pairiteration(
            pair.left,
            pair.right,
            curveIntersectionThreshold
          );
          if (result.length > 0) {
            intersections = intersections.concat(result);
          }
        });
        return intersections;
      }

      arcs(errorThreshold) {
        errorThreshold = errorThreshold || 0.5;
        return this._iterate(errorThreshold, []);
      }

      _error(pc, np1, s, e) {
        const q = (e - s) / 4,
          c1 = this.get(s + q),
          c2 = this.get(e - q),
          ref = utils.dist(pc, np1),
          d1 = utils.dist(pc, c1),
          d2 = utils.dist(pc, c2);
        return abs(d1 - ref) + abs(d2 - ref);
      }

      _iterate(errorThreshold, circles) {
        let t_s = 0,
          t_e = 1,
          safety;
        // we do a binary search to find the "good `t` closest to no-longer-good"
        do {
          safety = 0;

          // step 1: start with the maximum possible arc
          t_e = 1;

          // points:
          let np1 = this.get(t_s),
            np2,
            np3,
            arc,
            prev_arc;

          // booleans:
          let curr_good = false,
            prev_good = false,
            done;

          // numbers:
          let t_m = t_e,
            prev_e = 1;

          // step 2: find the best possible arc
          do {
            prev_good = curr_good;
            prev_arc = arc;
            t_m = (t_s + t_e) / 2;

            np2 = this.get(t_m);
            np3 = this.get(t_e);

            arc = utils.getccenter(np1, np2, np3);

            //also save the t values
            arc.interval = {
              start: t_s,
              end: t_e,
            };

            let error = this._error(arc, np1, t_s, t_e);
            curr_good = error <= errorThreshold;

            done = prev_good && !curr_good;
            if (!done) prev_e = t_e;

            // this arc is fine: we can move 'e' up to see if we can find a wider arc
            if (curr_good) {
              // if e is already at max, then we're done for this arc.
              if (t_e >= 1) {
                // make sure we cap at t=1
                arc.interval.end = prev_e = 1;
                prev_arc = arc;
                // if we capped the arc segment to t=1 we also need to make sure that
                // the arc's end angle is correct with respect to the bezier end point.
                if (t_e > 1) {
                  let d = {
                    x: arc.x + arc.r * cos(arc.e),
                    y: arc.y + arc.r * sin(arc.e),
                  };
                  arc.e += utils.angle({ x: arc.x, y: arc.y }, d, this.get(1));
                }
                break;
              }
              // if not, move it up by half the iteration distance
              t_e = t_e + (t_e - t_s) / 2;
            } else {
              // this is a bad arc: we need to move 'e' down to find a good arc
              t_e = t_m;
            }
          } while (!done && safety++ < 100);

          if (safety >= 100) {
            break;
          }

          // console.log("L835: [F] arc found", t_s, prev_e, prev_arc.x, prev_arc.y, prev_arc.s, prev_arc.e);

          prev_arc = prev_arc ? prev_arc : arc;
          circles.push(prev_arc);
          t_s = prev_e;
        } while (t_e < 1);
        return circles;
      }
    }

    function addTo(p1, p2) {
        p1.x += p2.x;
        p1.y += p2.y;
    }

    function transform(x, y, angle, dx=0, dy=0) {
        return {
            x: (x * Math.cos(angle) + y * Math.sin(angle)) + dx,
            y: -x * Math.sin(angle) + y * Math.cos(angle) + dy
        };
    }

    function meridianLength(angle, a, b) {
        const n = (a - b) / (a + b);

        let series =    (1 + Math.pow(n, 2) / 4 + Math.pow(n, 4) / 64) * angle;
        series -=   3 * (n / 2                  - Math.pow(n, 3) / 16) * Math.sin(2 * angle);
        series +=  15 * (Math.pow(n, 2) / 16    - Math.pow(n, 4) / 64) * Math.sin(4 * angle);
        series -=  35 * (Math.pow(n, 3) / 48                         ) * Math.sin(6 * angle);
        series += 315 * (Math.pow(n, 4) / 512                        ) * Math.sin(8 * angle);

        return (a + b) / 2 * series;
    }

    const divide = {
        L: function (segment, step) {
            const {from, to} = segment;

            const length = Math.hypot(to.x - from.x, to.y - from.y);
            const number = Math.round(length / step);

            const points = [];
            for (let dist = 0; dist <= number; dist++) {
                points.push({
                    x: from.x + dist * (to.x - from.x) / number,
                    y: from.y + dist * (to.y - from.y) / number
                });
            }

            return points;
        },
        
        A: function (segment, step) {
            const {from, to, rotation, large_arc, sweep} = segment;
            let {rx, ry} = segment;
            const angle = rotation/180*Math.PI;

            const h = transform(
                (from.x - to.x) / 2, 
                (from.y - to.y) / 2, 
                angle
            );

            const lambda = h.x*h.x/rx/rx + h.y*h.y/ry/ry;
            if (lambda > 1) {
                rx *= Math.sqrt(lambda);
                ry *= Math.sqrt(lambda);
            }

            const sign = large_arc === sweep ? -1 : 1;
            const f = sign * Math.sqrt((rx*rx*ry*ry - rx*rx*h.y*h.y - ry*ry*h.x*h.x)/(rx*rx*h.y*h.y + ry*ry*h.x*h.x));

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
            if (angleTo > angleFrom && !sweep) angleTo -=  2*Math.PI;
            if (angleTo < angleFrom && sweep) angleTo +=  2*Math.PI;

            const lengthFrom = meridianLength(angleFrom, rx, ry);
            const lengthTo = meridianLength(angleTo, rx, ry);
            const number = Math.abs(Math.round((lengthTo - lengthFrom) / step));

            const points = [];
            for (let dist = 0; dist <= number; dist++) {
                points.push({
                    x: Math.cos(angleFrom + dist * (angleTo - angleFrom) / number) * rx + centerH.x,
                    y: Math.sin(angleFrom + dist * (angleTo - angleFrom) / number) * ry + centerH.y
                });
            }

            return points.map(p => transform(
                p.x, 
                p.y, 
                -angle,
                (from.x + to.x) / 2, 
                (from.y + to.y) / 2
            ));
        },

        Q: function (segment, step) {
            const bez = new Bezier(
                segment.from.x,
                segment.from.y,
                segment.control_1.x,
                segment.control_1.y,
                segment.to.x,
                segment.to.y,
            );

            const length = bez.length();
            const number = Math.round(length / step);

            //see https://github.com/Pomax/bezierjs/issues/165
            return bez.getLUT(number + 2);
        },

        C: function (segment, step) {
            const bez = new Bezier(
                segment.from.x,
                segment.from.y,
                segment.control_1.x,
                segment.control_1.y,
                segment.control_2.x,
                segment.control_2.y,
                segment.to.x,
                segment.to.y,
            );

            const length = bez.length();
            const number = Math.round(length / step);

            //see https://github.com/Pomax/bezierjs/issues/165
            return bez.getLUT(number + 2);
        }
    };

    function astCommand(result, current) {
        if (current.command === 'Z') {
            const from = result.slice(-1)[0].to;
            const to = result.slice(0, 1)[0].from;
            result.push(astArgument({ command: 'L', from, to }));
        } else  if (current.command === 'M') {
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
        const segment = {...args};
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
            segment.to= { x: args.coordinate, y: segment.from.y };
            segment.command = 'L';
            break;
        case 'V':
            segment.to= { x: segment.from.x, y: args.coordinate };
            segment.command = 'L';
            break;
        case 'M':
            segment.command = 'L';
            break;
        case 'S':
            segment.control_2 = segment.control_1;
            segment.control_1.x = 2*from.x - (previous.control_2 ? previous.control_2.x : previous.control_1.x);
            segment.control_1.y = 2*from.y - (previous.control_2 ? previous.control_2.y : previous.control_1.y);
            segment.command = 'C';
            break;
        case 'T':
            segment.control_1.x = 2*from.x - (previous.control_2 ? previous.control_2.x :previous.control_1.x);
            segment.control_1.y = 2*from.y - (previous.control_2 ? previous.control_2.y :previous.control_1.y);
            segment.command = 'Q';
            break;
        default:
            segment.command = command;
        }

        return segment;
    }

    function pathToPoints(d, step) {
        const ast = new pathParser().parse(d);
        const sequence_ = ast.reduce(astCommand, []);
        const sequence = sequence_.filter(segment => segment.from !== undefined);

        const parts = sequence.map(segment => divide[segment.command](segment, step));
        const last = parts.splice(-1)[0];

        return parts.reduce((list, part) => list.concat(part.slice(0, -1)), []).concat(last);
    }

    function computeFont(glyphs, step) {
        const uniqueStrokes = new Map();

        for (let glyph of Object.values(glyphs)) {
            for (let variant of Object.values(glyph)) {
                if (!variant.strokes) continue;

                for (let stroke of variant.strokes) {
                    let points = uniqueStrokes.get(stroke.d);
                    if (!points) {
                        points = pathToPoints(stroke.d, step);
                        uniqueStrokes.set(stroke.d, points);
                    }

                    stroke.points = points;
                }
            }
        }

        return Promise.resolve();
    }

    const config = {
      wait: {
        turn: 200,
        move: 500
      },
      fill: '#391b0c',
      speed: 80,
      delta: 0.5
    };

    const userInput = (resolve) => {
      button.addEventListener('click', () => {
        button.disabled = true;
        resolve();
      }, { once: true });
    };

    const canvas = document.querySelector('canvas.signature');
    const button = document.querySelector('button.start');

    const board = new QuillWriter(canvas, undefined, config);
    board.ctx.font = '18px sans-serif';

    (async function () {
      const res = await fetch('kurrent.json');
      const data = await res.json();
      console.log(data.id, data.desc);

      await computeFont(data.glyphs, board.config.delta);

      for (const [name, variants] of Object.entries(data.glyphs)) {
        button.disabled = false;

        await new Promise(userInput);

        board.clear();
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

          board.ctx.setTransform(1, 0, 0, 1, 0, 0);
          const details = (desc || name) + ` | ${position} | ${strokes.length}: ${pauses.join(' ')}`;
          board.ctx.fillText(details, 30, line);

          board.strokes = strokes;
          await board.start({x, y: 30});

          await new Promise(resolve => setTimeout(resolve, 500));

          line += 22;
          x += 150;
        }  
      }
    })();

})();
