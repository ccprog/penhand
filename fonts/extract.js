const { readFile, writeFile } = require('fs/promises');
const { basename } = require('path');
const cheerio = require('cheerio');

(async function(path) {
    try {
        const source = await readFile(path);

        const fontName = basename(path, '.svg');
        const $ = cheerio.load(source, { xmlMode: true });

        const title=$('title').text();
        const desc=$('desc').text();

        const meta = {
            subtables: {},
            substitution: {},
            requiredLigatures: [],
            pairwiseKerning: []
        };

        $('lookup\\:subtable').each((i, table) => {
            const subtable = $('lookup\\:entry', table).map((i, entry) => entry.attribs.use).get();
            meta.subtables[table.attribs.id] = subtable;
        });

        $('lookup\\:table').each((i, table) => {
            switch (table.attribs.id) {
            case 'substitution':
                $('lookup\\:entry', table).each((i, entry)=> {
                    meta.substitution[entry.attribs.seq] = entry.attribs.use;
                });
                break;
            case 'required-ligatures':
                meta.requiredLigatures = $('lookup\\:entry', table).map((i, entry) => entry.attribs.use).get();
                break;
            case 'pairwise-kerning':
                meta.pairwiseKerning = $('lookup\\:entry', table).map((i, entry) => {
                    return { ...entry.attribs, use: parseFloat(entry.attribs.use) }
                }).get();
                break;
            }
        });

        const glyphs = {
            unknown: {
                isolate: {
                    advance: 0,
                    strokes: []
                }
            }
        };

        $('symbol')
        .filter((i, symbol) => symbol.attribs.id.startsWith('glyph'))
        .each((i, symbol) => {
            const [, name, position] = symbol.attribs.id.split('_');
            const advance = parseFloat(symbol.attribs.viewBox.split(' ')[2]);
            const desc = $('title', symbol);

            let strokes = [];

            if (name !== ' ' ) {
                strokes = $('path', symbol).map((i, path) => {
                    const p = $(path);
                    return { 
                        d: p.attr('d'), 
                        pause: p.data('pause'),
                        late: !!p.data('late')
                    };
                }).get();

                if (['final', 'isolate'].indexOf(position) >= 0) {
                    const lastRegular = strokes.filter(stroke => !stroke.late).pop();
                    lastRegular.pause = 'move';
                }
            } else {
                strokes.push({
                    pause: 'space'
                });
            }

            if (!glyphs[name]) glyphs[name] = {};

            glyphs[name][position] = { advance, strokes };

            if (desc.length) glyphs[name][position].desc = desc.text();
        });

        const data = JSON.stringify({ id: fontName, title, desc, meta, glyphs });

        await writeFile(`fonts/${fontName}.json`, data);
    } catch (error) {
        console.error(error);
    }
})(process.argv[2]);