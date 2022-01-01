import pathParser from 'pathfit/src/pathParser.js';
import { Bezier } from "bezier-js";

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
        }

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
}

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
        segment.to= { x: args.coordinate, y: segment.from.y }
        segment.command = 'L'
        break;
    case 'V':
        segment.to= { x: segment.from.x, y: args.coordinate }
        segment.command = 'L'
        break;
    case 'M':
        segment.command = 'L'
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
        segment.command = command
    }

    return segment;
}

function pathToPoints(d, step) {
    const ast = new pathParser().parse(d);
    const sequence_ = ast.reduce(astCommand, [])
    const sequence = sequence_.filter(segment => segment.from !== undefined);

    const parts = sequence.map(segment => divide[segment.command](segment, step));
    const last = parts.splice(-1)[0];

    return parts.reduce((list, part) => list.concat(part.slice(0, -1)), []).concat(last);
}

function computeFont(glyphs, step) {
    const uniqueStrokes = new Map();

    for (let glyph of Object.values(glyphs)) {
        for (let variant of Object.values(glyph)) {
            for (let stroke of variant.strokes) {
                if (!stroke.d) {
                    stroke.points = [];
                    continue;
                }

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

export { pathToPoints, computeFont };