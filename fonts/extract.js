const { readdir, readFile, writeFile } = require('fs/promises');
const { basename, extname, join } = require('path');
const cheerio = require('cheerio');

const ext = '.svg';
const single = 'single';

const at = {
    startat: [single],
    endat: [single],
    keys: [0]
};

const unknown = {
    isolate: {
        advance: 0,
        strokes: [],
        starts: [single],
        ends: [single],
        attachments: [at]
    }
};

function getMeta ($) {
    const meta = {
        keywords: {
            single
        },
        metrics: {},
        subtables: {},
        substitution: {},
        requiredLigatures: [],
        pairwiseKerning: [],
        pairwiseAttachment: []
    };

    $('lookup\\:metrics *').each((i, el) => {
        const prop = el.name.split(':')[1];
        const value = $(el).text();

        meta.metrics[prop] = parseFloat(value);
    })

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
        case 'pairwise-attachment':
            meta.pairwiseAttachment = $('lookup\\:entry', table).map((i, entry) => {
                return { ...entry.attribs }
            }).get();
        break;
        }
    });

    return meta;
}

function splitForAttachments(strokes, starts, ends) {
    const attachments = [];
    
    if (starts.size > 1) starts.delete(single);
    if (ends.size > 1) ends.delete(single);

    for (const startat of starts.values()) {
        const k1 = [...strokes.keys()].filter(i => [single, startat].includes(strokes[i].startat));

        for (const endat of ends.values()) {
            const k2 = k1.filter(i => [single, endat].includes(strokes[i].endat));

            attachments.push({
                startat,
                endat,
                keys: k2
            })
        }
    }

    return attachments;
}

function getStrokes($, symbol) {
    const strokes = [];
    const starts = new Set();
    const ends = new Set();
    
    $('path', symbol).each((i, path) => {
        const p = $(path);
        const {
            startat = single, 
            endat = single,
            pause,
            late = false
        } = p.data();

        starts.add(startat);
        ends.add(endat);

        strokes.push({ 
            d: p.attr('d'),
            startat,
            endat,
            pause,
            late
        });
    });

    const attachments = splitForAttachments(strokes, starts, ends);

    for(const s of strokes) {
        delete s.startat;
        delete s.endat;
    }

    if (ends.has(single)) {
        for (const filtered of attachments.map(at => at.keys.map(i => strokes[i]))) {
            const lastRegular = filtered.filter(stroke => !stroke.late).pop();
            lastRegular.pause = 'move';
        }
    }

    return { strokes, attachments };
}

function getGlyphs($) {
    const glyphs = {
        unknown
    };

    $('symbol')
    .filter((i, symbol) => symbol.attribs.id.startsWith('glyph'))
    .each((i, symbol) => {
        const [, name, position] = symbol.attribs.id.split('_');
        const advance = parseFloat(symbol.attribs.viewBox.split(' ')[2]);
        const desc = $('title', symbol);

        const variant = { advance };
        if (desc.length) variant.desc = desc.text();

        if (name === ' ' ) {
            variant.strokes = [{
                pause: 'space'
            }];
            variant.attachments= [at];
        } else {
            Object.assign(variant, getStrokes($, symbol));
        }

        if (!glyphs[name]) glyphs[name] = {};

        glyphs[name][position] = variant;
    });

    return glyphs;
}

async function extract(name, path) {
    const svg = join(path, name + '.svg');
    const json = join(path, name + '.json');

    const source = await readFile(svg);

    const $ = cheerio.load(source, { xmlMode: true });

    const title=$('svg>title').text();
    const desc=$('svg>desc').text();

    const meta = getMeta($);
    const glyphs = getGlyphs($);

    const data = JSON.stringify({ id: name, title, desc, meta, glyphs });

    await writeFile(json, data);

    console.log(`extract ${svg} to ${json}`);
}

(async function() {
    try {
        for(const fn of await readdir(__dirname)) {
            if (extname(fn) === ext) {
                const name = basename(fn, ext);
                await extract(name, __dirname);
            }
        }
    } catch (error) {
        console.error(error);
    }
})();