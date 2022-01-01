import { computeFont } from './pathToPoints.mjs';

export default class GlyphChooser {
    constructor (url, step) {
        return (async () => {
            const res = await fetch(url);
            const font = await res.json();

            this.glyphs = font.glyphs;
            this.ligatures = font.meta.requiredLigatures;
            this.substitution = Object.entries(font.meta.substitution).map(([test, subst]) => {
                return [new RegExp(test, 'g'), subst];
            });

            await this.compute(step);

            return this;
        })();
    }

    async compute(step) {
        await computeFont(this.glyphs, step);
    }

    substitute(txt) {
        for (let [rx, subst] of this.substitution) {
            txt = txt.replace(rx, subst);
        }

        const seq = [];
        for (let i = 0; i < txt.length; i++) {
            const part = txt.slice(i)
            const lig = this.ligatures.find(l => part.startsWith(l))
            if (lig) {
                seq.push(lig);
                i += lig.length - 1;
            } else {
                seq.push(part.slice(0, 1));
            }
        }

        return seq;
    }

    #order(selection) {
        const instruction = [];
        const late = [];
        let position = 0;

        for (const {glyph, variant} of selection) {
            const { strokes, advance } = this.glyphs[glyph][variant];

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
            const select = { glyph, variant: 'isolate' };

            const canBackward = i > 0 && 
                ['initial', 'medial'].includes(selection[i - 1].variant);
            const canForward = seq[i + 1] && this.glyphs[seq[i + 1]] &&
                (this.glyphs[seq[i + 1]].final || this.glyphs[seq[i + 1]].medial);

            if (this.glyphs[glyph]) {
                if (canBackward) {
                    if (canForward && this.glyphs[glyph].medial) {
                        select.variant = 'medial'
                    } else {
                        select.variant = 'final';
                    }
                } else if (canForward && this.glyphs[glyph].initial) {
                    select.variant = 'initial';
                }
            } else {
                select.glyph = ' ';
            }
            selection.push(select);
        });

        return this.#order(selection);
    }
}