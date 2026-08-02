# ChemDoodle Web Components 11.0.0 — vendored

Third-party code. **Do not edit these files**; replace them wholesale on upgrade.

| File | What |
|---|---|
| `ChemDoodleWeb.js` | the library (430 340 bytes, md5 `19bd3efd94569afe15efde5c7ce58786`) |
| `ChemDoodleWeb.css` | its stylesheet |
| `COPYING.txt` | GNU GPL v3, as shipped |

## Where it came from

`https://web.chemdoodle.com/downloads/ChemDoodleWeb-11.0.0.zip` (4.6 MB), the
GPL download linked from web.chemdoodle.com/installation/download, unpacked, and
these three files copied out of it. Everything else in that zip — the test
suite, the demo data, the sketcher's `ChemDoodleWeb-uis.js` — is deliberately
**not** here: we render molecules, we don't offer structure drawing, and the uis
bundle is another 515 KB nobody would load.

There is no npm package and no CDN, so this directory is the distribution
mechanism. Re-derive it by repeating the steps above.

## Licence — this reaches the rest of the repo

GPLv3. Serving JavaScript to a browser is distribution, so **any page that loads
this file is itself GPLv3**, and its source has to stay available. That is a
deliberate, accepted choice — see `RenderingLibraries.md` — and it is a one-way
door: GPL'd pages cannot be relicensed permissively later without every
contributor agreeing.

Pages that do *not* load it (every Three.js lesson in this repo) are unaffected.

iChemLabs sells proprietary licences for projects that can't take the GPL:
https://web.chemdoodle.com/store/proprietary-licensing

## Attribution

Their README requests a visible link to web.ChemDoodle.com from any site using
the library. Pages loading it carry that credit — it is a request rather than a
licence term, and it costs one line.
