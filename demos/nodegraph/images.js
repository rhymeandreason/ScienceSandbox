/* =====================================================================
 *  images.js — the still images this repo holds. GENERATED: the clipper
 *  extension writes the array below through tools/images-io.js. Edit it
 *  there, not here. The header is spliced around and survives.
 *
 *  A REGISTRY, not curriculum: a row says what an image IS and where its
 *  file is, never which concept shows it. Placement is graphcontent.js's
 *  job, by `i:` id, exactly the split clips.js and proteins.js already
 *  use. An unplaced image simply does not appear on the map.
 *
 *  Every image is self-hosted under nodegraph/images/. Nothing hotlinks:
 *  a third-party URL rots on someone else's schedule, and the one thing
 *  worse than no micrograph is a broken one on a card that claims it.
 *  `page` is the link back and `credit` is what gets shown beside it.
 *
 *  `license` is typed by a human, because no header carries it reliably.
 *  It is prose, not an enum — "CC BY-SA 4.0", "public domain", "CC0".
 * ===================================================================== */
(function (global) {
  'use strict';

  const IMAGES = [
    /* the folded inner membrane, in section */
    {
      id: 'i:mitochondrion-tem-cristae', slug: 'mitochondrion-tem-cristae',
      ext: 'jpg',
      src: 'https://upload.wikimedia.org/wikipedia/commons/6/68/Mitochondrion_186.jpg',
      page: 'https://commons.wikimedia.org/wiki/File:Mitochondrion_186.jpg',
      title: 'Mitochondrion TEM cristae',
      caption: 'the folded inner membrane, in section',
      credit: 'Louisa Howard', license: 'public domain', fit: 'cover', w: 186,
      h: 190, bytes: 19091, fetched: '2026-09-01',
    },
    /* thylakoid stacks inside the double membrane */
    {
      id: 'i:chloroplast-diagram', slug: 'chloroplast-diagram', ext: 'png',
      src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Chloroplast_II.svg/960px-Chloroplast_II.svg.png',
      page: 'https://commons.wikimedia.org/wiki/File:Chloroplast_II.svg',
      title: 'Chloroplast diagram',
      caption: 'thylakoid stacks inside the double membrane',
      credit: 'Kelvinsong', license: 'CC BY-SA 3.0', fit: 'contain', w: 960,
      h: 912, bytes: 189597, fetched: '2026-09-01',
    },
  ];

  global.Images = { IMAGES };
})(this);
