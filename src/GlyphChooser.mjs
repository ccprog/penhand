import { computeFont } from './pathToPoints.mjs';

export default class GlyphChooser {
    #single;
    #size;
    #slant;
    #flatFont;

    constructor (url, transformation) {
        return (async () => {
            const res = await fetch(url);
            const font = await res.json();

            this.#single = font.meta.keywords.single;
            this.metrics = font.meta.metrics;
            this.glyphs = font.glyphs;
            this.ligatures = font.meta.requiredLigatures;
            this.subtables = Object.entries(font.meta.subtables);
            this.kerning = font.meta.pairwiseKerning;
            this.attachment = font.meta.pairwiseAttachment;
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

    #findPairValue(table, first, second, missing) {
        const firstsub = this.subtables
            .filter(([, st]) => st.includes(first))
            .map(([id])=>id);
        const secondsub = this.subtables
            .filter(([, st]) => st.includes(second))
            .map(([id])=>id);

        const pair = this[table].find(e => {
            return firstsub.includes(e.first) && secondsub.includes(e.second);
        });

        return pair?.use ?? missing;
    }

    #order(selection) {
        const instruction = [];
        const late = [];
        let position = 0;

        for (const {glyph, variant, startat, endat, kerning} of selection) {
            const { strokes, advance, attachments } = this.#flatFont[glyph][variant];

            const usedStrokes = attachments
                .find(({startat: s, endat: e}) => s == startat && e == endat)
                .keys.map(i => strokes[i]);

            position += kerning;

            const wait = usedStrokes.filter(s => s.late);
            if (wait.length) {
                late.push({
                    strokes: wait,
                    position
                });
            }

            const regular = {
                strokes: usedStrokes.filter(s => !s.late),
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
            const select = { 
                glyph,
                variant: 'isolate',
                startat: this.#single,
                endat: this.#single,
                kerning: 0
            };

            const last = selection[i - 1];
            const next = seq[i + 1] && this.#flatFont[seq[i + 1]];

            const canBackward = ['initial', 'medial'].includes(last?.variant);
            const canForward = next?.final || next?.medial;

            if (this.glyphs[glyph]) {
                if (canBackward) {
                    select.startat = last?.endat ?? this.#single;

                    if (canForward && this.#flatFont[glyph].medial) {
                        select.variant = 'medial';
                        select.endat = this.#findPairValue('attachment', glyph, seq[i + 1], this.#single);
                    } else {
                        select.variant = 'final';
                    }
                } else {
                    if (canForward && this.#flatFont[glyph].initial) {
                        select.variant = 'initial';
                        select.endat = this.#findPairValue('attachment', glyph, seq[i + 1], this.#single);
                    }

                    if (i > 0) {
                        select.kerning = this.#findPairValue('kerning', last.glyph, glyph, 0);
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