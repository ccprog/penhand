import { QuillWriter } from './QuillWriter.mjs';
import GlyphChooser from './GlyphChooser.mjs';

const config = {
    wait: {
        turn: 200,
        move: 500,
        space: 500
    },
    speed: 120,
    delta: 0.5,
    fill: '#391b0c'
};

const pen = {
    type: 'Broadpen'
}

async function write(txt) {
    board.clear();

    const seq = glyphChooser.substitute(txt);
    const instruction = glyphChooser.connect(seq);

    for (const { position, strokes } of instruction) {
        await board.write(strokes, { x: position + 50, y: 30 });
    }
}

const canvas = document.querySelector('canvas.output');
const text = document.querySelector('input.text');
const button = document.querySelector('button.start');

const board = new QuillWriter(canvas, config, pen);

let glyphChooser;

function onClick() {
    button.disabled = true;

    write(text.value).then(() => button.disabled = false);
}

new GlyphChooser('fonts/kurrent.json', board.config.delta)
.then((gc) => {
    glyphChooser = gc;

    button.addEventListener('click', onClick);
    button.disabled = false;
});