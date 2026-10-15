# jet29.github.io

Small procedural things, one page each, with three.js from a CDN and no build step:

- `galton/` — a Galton board; the slider biases the coin
- `walk/` — a 3D random walk; the wire sphere is the predicted rms distance
- `dla/` — diffusion-limited aggregation on a lattice; the slider is the sticking probability
- `planet/` — a sphere displaced and coloured by simplex noise; sea level slider, reseed button
- `attractors/` — Lorenz, Aizawa, Thomas and Halvorsen, 30 000 particles

`index.html` lists them; `shared.css` is the one stylesheet. To look at it locally, serve the
folder (`py -3 -m http.server`) and open it: the pages are ES modules, so `file://` will not do.
