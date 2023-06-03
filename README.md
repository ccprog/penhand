## Penhand

A project aiming to visualize the process of hand-writing. – Still work in progress.

Most digital fonts are seen as a collection of grafical elements, filling an outline
on paper or screen with a color. But that is not how we learn to write in school: We
take a pen and move it around on paper (or maybe a tablet as input to a digital
device).

In Penhand, this process is reconstructed. The font consists of movement instructions,
and pens are seperate entities to choose and to configure. The third part is the
writer, Its configuration describes different ways to bring the writing instructions
to display.

As display medium, a HTML `<canvas>` element is used. If the display size of the canvas
is not the same as its pixel size, a parameter `basescale` can be used to convey this
information to the `Pen` and `Writer` initializers.

### Pens

Each class is initialized with the constructor `new <Pen> (penConfig, basescale)`. For
configurable values and their default values, see the individual pens.

- `pen.config` configuration object
- `pen.style` readonly object of canvas2D context styles to use
- `pen.make(p1, p2)` takes two point objects and returns a Path2D object to draw, connecting
    the two points in the form of a quadrangle with two parallel sides.

#### `Ballpen`

A simple, round point is moved along the movement paths.

```js
const penConfig = {
    size: 2,
    fill: black // ink color
}
```

#### `Broadpen`

A pen that leaves a trace depending on the direction of movement, like a goose quill.
Its nib is a ridge of variable width and height, with a constant tilt from the horizontal.

```js
const penConfig = {
    width: 6,
    height: 1,
    tilt: -40,
    fill: black
}
```

#### `PointedNib`

A pen that leaves a trace depending on the direction of movement. The characteristic
tries to emulate the practice of "shading", in which a split nib point is put
to the paper with varying pressure. The nib separates, and leaves a broader or narrower
trace, filling the space between the halves of the point. Pressure can only be applied
when dragging the pen, as the nib would otherwise pierce the paper when pushing.

Widening and narrowing the trace follows the direction of movement, but is not
instantaneous. Besides the size and tilt of the nib, the maximum width of the spread and
the dampening of the width change, separately during widening and narrowing, can be
configured.

Dampening describes a quotient by which a width change can follow a direction change
per movement distance.

```js
const penConfig = {
    maxwidth: 8,
    damp1: 0.8, // widening
    damp2: 0.3, // narrowing
    tilt: 0,
    fill: black
}
```

## Fonts

Fonts are developed from instructional material for human writers.

In their stored form they are not cursive, but perfectly upright. The slant has to be
configured as an attribute of the `FontLoader`. Nonetheless, each font has a **preferred
slant** that has been the precondition for designing the movements. _A divergence of more
than 15 degrees from the preferred slant might result in a noticable distortion of forms,
especially loops._

Fonts have been designed such that at a size of **120px** the standard pen configurations
will write a legible, well-proportioned text.

Fonts have a design format that is derived from the Scalable Vector Grafics
(`image/xml+svg`) file format. Compile to the `.json` format used by the `FontLoader`
by running

    node fonts/extract.js

### Kurrent

Deutsche Kurrentschrift, a handwriting script commonly used in German speaking
countries in the 19th century.

The movement forms have been developed following the instructions in

> Schreiblehrgang Kurrentschrift von Margarete Mücke,  
> zweite Überarbeitung Mai 2016

available from the [website](https://www.kurrent-lernen-muecke.de) of her estate.
Additional inspiration has been drawn from the font
[Deutsche Kurrent](https://www.zinken.net/Fonts/Kurrent.html) by Hans J. Zinken.

**Preferred Slant:** 25 degrees

### Spencerian

Spencerian Medium Hand, a handwriting script as taught by Platt R. Spencer (1800–1864) to
students of writing schools in Ohio and New York and in contributions to journals.

A comprehensive textbook has been compiled by his sons:

> New Spencerian Compendium of Penmanship. By P. R. Spencer's sons.  
> Ivison, Blakeman & Co. New York, 1887

A scan of the book has been made available by [archive.org](https://archive.org/details/NewSpencerianCompendium).

**Preferred Slant:** 38 degrees

## `FontLoader`

The `FontLoader` class acts as an interpreter for fonts. It converts a sequence of
characters into a sequence of strokes to be then brought to render by the `Writer`.
This process can be configured with a `transformation` object to set size and slant
of the strokes. The class is initialized asynchronuously with the constructor
`await new FontLoader(fontUrl, transformation)`.

```js
const transformation = {
    size,        // obligatory, no default set, in canvas px
    slant,       // obligatory, no default set, in degrees from vertical
    baseScale
}
```

- `async glyphChooser.compute(transformation)` prepares the font to be used with a certain
    transformation
- `glyphChooser.substitute(txt)` takes a string and returns a sequence of glyph descriptions
- `glyphChooser.connect(seq)` takes a glyph sequence and returns a sequence of stroke
    instructions. Each stroke instruction contains one uninterupted stroke, independent of
    which glyph (parts) are written, and its horizontal distance from the start of the sequence.

## `Writer`

The `Writer` class converts the movement instructions of the stroke sequence and the painting
algorithm of the pen to an animation drawn to the `<canvas>`. The writer is initialized as
`new Writer(canvas, writerConfig, pem)`. `canvas` is the reference to the DOM element. `pen`
can be an initialized `Pen` object, or an object `{ type, penConfig }`, with `pen.type`
being the name of the class to use. The writer configuration includes the pace of the animation
and pausing between strokes.

```js
const writerConfig = {
    wait: {
        turn: 200,  // timings are in milliseconds
        move: 500,
        space: 500
    },
    speed: 120,
    baseScale
}
```

- `writer.config` configuration object
- `writer.pen` writeonly, set the pen as described
- `writer.clear()` clear the canvas
- `async writer.write(instruction, at)` write the instruction sequence at a certain position

## Example usage

```js
const canvas = document.querySelector('canvas.output');
const text = document.querySelector('input.text');

const pen = {
    type: penName,
    config: penConfig
};

const writer = new Writer(canvas, writerConfig, pen);

const loader = new FontLoader(`fonts/${fontName}.json`, transformation);

const seq = loader.substitute(text.value);
const instruction = loader.connect(seq);

await writer.write(instruction, { x, y });
```