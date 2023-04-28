import parse from './parse.mjs';

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

export function pathToPoints(d, trans, tol=tolerance) {

    const sequence = parse(d, trans);
    const start = { to: sequence[0].from, d: 0 };

    return sequence.reduce(flattenCurve.bind(null, tol), [start]);
}

export function computeFont(glyphs, trans, baseScale=1) {
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