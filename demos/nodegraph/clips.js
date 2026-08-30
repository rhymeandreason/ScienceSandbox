/* =====================================================================
 *  clips.js — the short animation clips this repo holds. GENERATED:
 *  clip-shelf.html writes the array below through tools/clips-io.js.
 *  Edit it there, not here. The header is spliced around and survives.
 *
 *  A REGISTRY, not curriculum: a row says what a clip IS and where its
 *  files are, never which concept shows it. Placement is graphcontent.js's
 *  job, by `v:` id, exactly the split proteins.js and the `p:` placements
 *  already use. An unplaced clip simply does not appear on the map.
 *
 *  Every clip is self-hosted mp4 + poster under nodegraph/clips/. Nothing
 *  loads from giphy.com at runtime: an iframe would be third-party JS on a
 *  dependency-free page, would not survive the dev server offline, and
 *  cannot hand a card the still frame its unmounted thumb needs. `page` is
 *  the link back, shown as the credit.
 *
 *  A clip costs no WebGL context, so it is exempt from card-stage's pool of
 *  four — see nodegraph.html's goLive().
 * ===================================================================== */
(function (global) {
  'use strict';

  const CLIPS = [
    /* the rotor, the stalk, and the head that makes ATP */
    {
      id: 'v:atp-synthase', slug: 'atp-synthase',
      page: 'https://giphy.com/gifs/Nd90koHgNZjudNo59l',
      giphyId: 'Nd90koHgNZjudNo59l', title: 'ATP synthase turning',
      caption: 'the rotor, the stalk, and the head that makes ATP',
      fit: 'cover', w: 480, h: 640, seconds: 8.35, bytes: 500886,
      fetched: '2026-08-30',
    },
  ];

  global.Clips = { CLIPS };
})(this);
