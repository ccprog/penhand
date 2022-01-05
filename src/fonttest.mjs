import { QuillWriter } from './QuillWriter.mjs';
import { computeFont } from './pathToPoints.mjs';

const config = {
  wait: {
      turn: 200,
      move: 500,
      space: 500
  },
  speed: 120
};

const pen = {
  type: 'Ballpen',
  config: {
      fill: '#391b0c'
  }
}

const tolerance = 0.1;

const userInput = (resolve) => {
  button.addEventListener('click', () => {
    button.disabled = true;
    resolve();
  }, { once: true });
};

const canvas = document.querySelector('canvas.signature');
const button = document.querySelector('button.start');

const board = new QuillWriter(canvas, config, pen);
board.ctx.font = '18px sans-serif';

(async function () {
  const res = await fetch('kurrent.json');
  const data = await res.json();
  console.log(data.id, data.desc);

  await computeFont(data.glyphs, tolerance);

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

      await board.write(strokes, {x, y: 30});

      await new Promise(resolve => setTimeout(resolve, 500));

      line += 22;
      x += 150;
    }  
  }
})();

