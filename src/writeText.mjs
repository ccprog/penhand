import { Writer } from './Writer.mjs';
import FontLoader from './FontLoader.mjs';

const canvas = document.querySelector('canvas.output');
const text = document.querySelector('input.text');
const button = document.querySelector('button.start');
const font = document.querySelector('select#font');
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

const preferredSlant = {
    kurrent: 25,
    spencerian: 38
}

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

async function getFontProperties() {
    button.disabled = true;
    transformation.size = parseInt(size.value, 10);
    transformation.slant = parseInt(slant.value, 10);

    await fontLoader.compute(transformation)
    
    button.disabled = false;
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

    const seq = fontLoader.substitute(txt);
    const instruction = fontLoader.connect(seq);

    await writer.write(instruction, { x: 50, y: 30 });
}

let fontLoader;

function onClick() {
    button.disabled = true;

    write(text.value).then(() => button.disabled = false);
}

async function getFont() {
    button.disabled = true;

    const name = font.value;

    fontLoader = await new FontLoader(`fonts/${name}.json`, transformation);

    button.addEventListener('click', onClick);

    slant.value = preferredSlant[name];

    await getFontProperties();
}

font.addEventListener('change', getFont);

getFont();