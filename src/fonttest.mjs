import { Writer } from './Writer.mjs';
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

const font = 'kurrent.json';

const userInput = (resolve) => {
  button.addEventListener('click', () => {
    button.disabled = true;
    resolve();
  }, { once: true });
};

const canvas = document.querySelector('canvas.signature');
const button = document.querySelector('button.start');

const writer = new Writer(canvas, config, pen);
writer.ctx.font = '18px sans-serif';

(async function () {
  const res = await fetch(font);
  const data = await res.json();
  console.log(data.id, data.desc);

  const flatFont = await computeFont(data.glyphs, []);

  for (const [name, variants] of Object.entries(flatFont)) {
    button.disabled = false;

    await new Promise(userInput);

    writer.clear();
    let x = 50, line;

    for (const [position, { strokes, attachments, desc }] of Object.entries(variants)) {
      line = 200;
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

      writer.ctx.setTransform(1, 0, 0, 1, 0, 0);
      const details = (desc || name) + ` | ${position} | ${strokes.length}`;
      writer.ctx.fillText(details, x - 20, line);

      for (const {startat, endat, keys} of attachments) {
        const p = keys.map(i => pauses[i]);
        const sequence = `${startat} | ${endat}: ${p.join(' ')}`;
        writer.ctx.fillText(sequence, x - 20, line += 22);
      }

      await writer.write(attachments[0].keys.map(i => strokes[i]), {x, y: 30});

      await new Promise(resolve => setTimeout(resolve, 500));

      line += 22;
      x += 250;
    }  
  }
})();

