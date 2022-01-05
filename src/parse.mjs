import pathParser from 'pathfit/src/pathParser.js';

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
    }

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
    const transform = getTransform(angle, center.x,center.y)

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
            segment.to = { x: args.coordinate, y: segment.from.y }
            segment.command = 'L'
            break;
        case 'V':
            segment.to = { x: segment.from.x, y: args.coordinate }
            segment.command = 'L'
            break;
        case 'M':
            segment.command = 'L'
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
            segment.command = command
    }

    return segment;
}

export default function parse(d) {
    const ast = new pathParser().parse(d);
    const sequence = ast.reduce(astCommand, [])

    return sequence.filter(segment => segment.from !== undefined);
}