import { Writer } from './Writer.mjs';
import GlyphChooser from './GlyphChooser.mjs';

const canvas = document.querySelector('canvas.output');
const text = document.querySelector('input.text');
const button = document.querySelector('button.start');
const pentype = document.querySelector('select#pen');
const size = document.querySelector('input#size');
const slant = document.querySelector('input#slant');
const tilt = document.querySelector('input#tilt');

const baseScale = canvas.width / parseFloat(getComputedStyle(canvas).width);

const config = {
    wait: {
        turn: 200,
        move: 500,
        space: 500
    },
    speed: 120,
    baseScale
};

const pen = {
    type: 'Ballpen',
    config: {
        fill: '#391b0c'
    }
}

const transformation = {
    size: parseInt(size.value, 10),
    slant: parseInt(slant.value, 10),
    baseScale
};

function getFontProperties() {
    button.disabled = true;
    transformation.size = parseInt(size.value, 10);
    transformation.slant = parseInt(slant.value, 10);

    glyphChooser.compute(transformation).then(() => button.disabled = false);
}

size.addEventListener('change', getFontProperties);
slant.addEventListener('change', getFontProperties);
tilt.addEventListener('change', getFontProperties);

const writer = new Writer(canvas, config, pen);
function getPenProperties() {
    pen.type = pentype.value;
    pen.config.tilt = parseInt(tilt.value, 10);
    pen.config.slant = parseInt(slant.value, 10);
    if(pen.type == 'PointedNib') pen.config.maxwidth = 4;
    writer.pen = pen;
}
getPenProperties();

pentype.addEventListener('change', getPenProperties);
tilt.addEventListener('change', getPenProperties);
slant.addEventListener('change', getPenProperties);

async function write(txt) {
    writer.clear();

    const seq = glyphChooser.substitute(txt);
    const instruction = glyphChooser.connect(seq);

    for (const { position, strokes } of instruction) {
        await writer.write(strokes, { x: position + 50, y: 30 });
    }
}

let glyphChooser;

function onClick() {
    button.disabled = true;

    write(text.value).then(() => button.disabled = false);
}

new GlyphChooser('fonts/spencerian.json', transformation)
.then((gc) => {
    glyphChooser = gc;

    button.addEventListener('click', onClick);
    button.disabled = false;
});