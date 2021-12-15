import { QuillWriter } from './QuillWriter.mjs';
import { computeFont } from './pathToPoints.mjs';

const config = {
  wait: {
    turn: 200,
    move: 500
  },
  speed: 80,
  delta: 0.5,
  fill: '#391b0c'
};

const pen = {
  type: 'Broadpen'
}

const userInput = (resolve) => {
  button.addEventListener('click', () => {
    button.disabled = true;
    resolve();
  }, { once: true });
};

const canvas = document.querySelector('canvas.signature');
const button = document.querySelector('button.start');

const board = new QuillWriter(canvas, undefined, config, pen);
board.ctx.font = '18px sans-serif';

(async function () {
  const res = await fetch('kurrent.json');
  const data = await res.json();
  console.log(data.id, data.desc);

  await computeFont(data.glyphs, board.config.delta);

  for (const [name, variants] of Object.entries(data.glyphs)) {
    button.disabled = false;

    await new Promise(userInput);

    board.clear();
    let x = 50, line = 200;

    for (const [position, { strokes, advance, desc }] of Object.entries(variants)) {
      const pauses = [];

      for(const {late, pause} of strokes) {
        let directive = late ? 'l/' : '';

        if (pause) {
          directive += pause.slice(0, 1);
         } else {
          directive += 'c';
        }
        pauses.push(directive);
      }

      board.ctx.setTransform(1, 0, 0, 1, 0, 0);
      const details = (desc || name) + ` | ${position} | ${strokes.length}: ${pauses.join(' ')}`;
      board.ctx.fillText(details, 30, line);

      board.strokes = strokes;
      await board.start({x, y: 30});

      await new Promise(resolve => setTimeout(resolve, 500));

      line += 22;
      x += 150;
    }  
  }
})();

