import { Writer } from './Writer.mjs';
import GlyphChooser from './GlyphChooser.mjs';

const config = {
    wait: {
        turn: 200,
        move: 500,
        space: 500
    },
    speed: 120
};

const pen = {
    type: 'Broadpen',
    config: {
        fill: '#391b0c'
    }
}

const tolerance = 0.1;

async function write(txt) {
    writer.clear();

    const seq = glyphChooser.substitute(txt);
    const instruction = glyphChooser.connect(seq);

    for (const { position, strokes } of instruction) {
        await writer.write(strokes, { x: position + 50, y: 30 });
    }
}

const canvas = document.querySelector('canvas.output');
const text = document.querySelector('input.text');
const button = document.querySelector('button.start');

const writer = new Writer(canvas, config, pen);

let glyphChooser;

function onClick() {
    button.disabled = true;

    write(text.value).then(() => button.disabled = false);
}

new GlyphChooser('fonts/kurrent.json', tolerance)
.then((gc) => {
    glyphChooser = gc;

    button.addEventListener('click', onClick);
    button.disabled = false;
});