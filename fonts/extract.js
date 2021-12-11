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

        const glyphs = {};

        $('symbol')
        .filter((i, symbol) => symbol.attribs.id.startsWith('glyph'))
        .each((i, symbol) => {
            const [, name, position] = symbol.attribs.id.split('_');
            const advance = parseFloat(symbol.attribs.viewBox.split(' ')[2]);
            const desc = $('title', symbol);

            let strokes = {};

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
            }

            if (!glyphs[name]) glyphs[name] = {};

            glyphs[name][position] = { advance, strokes };

            if (desc.length) glyphs[name][position].desc = desc.text();
        });

        const data = JSON.stringify({ id: fontName, title, desc, glyphs });

        await writeFile(`fonts/${fontName}.json`, data);
    } catch (error) {
        console.error(error);
    }
})(process.argv[2]);