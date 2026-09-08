# Licensing

Two licences, because this repo holds two kinds of thing.

| | Licence | File |
| --- | --- | --- |
| **Code** — every `.js`, `.css`, `.html`, the tools, the bakers, the API functions | GNU AGPL-3.0 | [`LICENSE`](LICENSE) |
| **Content** — lesson text and copy, images, screenshots, rendered stills, the docs in `docs/` and `demos/docs/` | CC BY-NC 4.0 | [`LICENSE-CONTENT`](LICENSE-CONTENT) |

**Where the line falls inside one file.** A lesson page is both: the markup and
script are code, the prose a student reads is content. If you are reusing the
mechanism, that is AGPL. If you are reusing the words, that is CC BY-NC.

**Why AGPL and not GPL.** Kodolab only ever runs in a browser, so plain GPL
would let someone host a modified copy without ever publishing the changes.
AGPL's section 13 closes that: run a modified version as a service, and the
people using it can get the source.

**What NonCommercial means here.** Teach with it, remix it for your class, put
it on your department's site: yes, with credit. Sell it, or bundle it into a
paid product: ask first.

## Third-party material

* **Three.js** — MIT, loaded from a CDN and never vendored into this tree.
* **SmilesDrawer** — its own licence, also from a CDN.
* **Deposited structures** — coordinates from the [Protein Data Bank](https://www.rcsb.org).
  PDB entries carry no copyright, and they stay credited to the labs that
  deposited them anyway, in each baker's header.
* **Fonts** — loaded from Google Fonts under their own licences.

Neither licence here applies to any of the above.

## Contributing

Opening a pull request means you are licensing your contribution under both:
AGPL-3.0 for the code, CC BY-NC 4.0 for the words and pictures. There is no CLA
and no copyright assignment; you keep your copyright.

How to contribute: [demos/tests/contribute.html](demos/tests/contribute.html).
