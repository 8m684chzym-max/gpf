# Hole sketches

Traces the hole screenshots (one per hole, distance arcs visible) into the
GPF sketch data at `public/holes/pinheirinho-sketch.json`.

- `holes_meta.py`: per hole, the screenshot id, tee and green pixel positions and
  two arc labels (radius, x, y) in 920×2000 display pixels. The arcs give the scale.
- `seg.py`: classifies pixels (grass, sand, water, trees, dune scrub), removes the app UI.
- `vec.py`: turns the classes into polygons in metres (tee at 0,0, y up the screen).

    pip install numpy pillow opencv-python-headless
    SHOTS_DIR=/path/to/screenshots python3 vec.py && cp sketch.json ../../public/holes/pinheirinho-sketch.json

The sketch is approximate. GPS distances use the real tee and green placed on the map.
- `engrave.py`: draws the engraved yardage-book image for each hole (public/holes/engraved/), GPF logo watermark.

## Other courses

Set `COURSE` to pick the hole metadata (`holes_meta_<course>.py`). Estoril Blue (9 holes):

    COURSE=estoril-blue SHOTS_DIR=/path/to/shots python3 vec.py 1 2 3 6 7 8 9
    COURSE=estoril-blue SHOTS_DIR=/path/to/shots SKETCH=sketch.json python3 greens_auto.py   # green outlines
    SKETCH=public/holes/estoril-blue-sketch.json python3 scripts/hole-sketches/engrave.py 1 2 3 6 7 8 9

Estoril screenshots are small (281×612), upscaled to 1206 wide before tracing; seg.py
uses a looser tree threshold for them. Holes 4 and 5 still need screenshots.
