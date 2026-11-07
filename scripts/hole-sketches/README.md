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
