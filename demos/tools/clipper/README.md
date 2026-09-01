<!-- KIND: recipe — how to install the clipper and what a clip does. Load it
     when curating images for the node graph, not when reading the map. -->

# The image clipper

A Chrome extension that files a still image into `nodegraph/images.js`, the way
`clip-shelf.html` files an animation into `nodegraph/clips.js`. Right-click any
image on any page, confirm the words, and the dev server downloads it,
downscales it into `nodegraph/images/`, and writes the row.

## Install

Chrome only, loaded unpacked — it is not on the Web Store and does not need to
be.

1. `chrome://extensions`, turn on **Developer mode**.
2. **Load unpacked**, choose `demos/tools/clipper/`.

It talks to `http://localhost:8817/api/images`, so the dev server has to be
running for a clip to land:

```bash
node tools/dev-server.js
```

With the server down, a clip is kept in the extension's own storage and
replayed the next time the panel opens.

## Clipping

**Do not clip from the Google Images results grid.** Those tiles are ~200px
copies re-hosted on `gstatic.com`, and their page URL is the search, not the
source: you would file a thumbnail with no provenance. Use Google Images to
*find*, click through to the source, and clip there. The licence and the credit
only exist on that page anyway.

Good sources, in rough order of how much the adapters can fill in for you:
Wikimedia Commons file pages, PMC article figures, RCSB PDB, NIGMS's image
gallery.

The panel asks for a title first because the title is the filename. Five
cristae images clipped in a row become `-2` and `-3`, and the moment to notice
that is while typing, not the day one has to be found again — so the filename
is shown live under the field.

`fit` is what the map's 4:3 thumb will do with a picture that is not 4:3.
A micrograph crops happily (`cover`); a labelled diagram loses its labels, so
that one is `contain`. The small preview beside the image is that crop, at card
size, because `fit` is otherwise a field nothing can judge.

**Licence is typed, not detected.** The adapters guess where the markup is
structured, and a guess is all it is. No image header states its licence, and
one committed as fact is worse than a blank field.

## What a clip writes

- `nodegraph/images/<slug>.jpg` or `.png` — PNG stays PNG so a diagram keeps
  its transparency. Max 1024px wide. **These deploy.**
- a row in `nodegraph/images.js` — a registry, saying what the image IS and
  where its file is.

**Placement is a separate step.** A row here does not put anything on the map;
`graphcontent.js` does that, by `i:` id, the same split `clips.js` and
`proteins.js` already use. An unplaced image simply does not appear.

## The pieces

| File | Does |
| --- | --- |
| `manifest.json` | MV3. `activeTab` only — a page never right-clicked is never readable |
| `background.js` | the context menu, and the injected scrape |
| `panel.html` / `panel.js` | the one window: preview, confirm, save, queue |
| `../images-io.js` | fetch, downscale, validate, splice the registry |
| `/api/images` | in `../dev-server.js`, local-only, and nowhere else |
