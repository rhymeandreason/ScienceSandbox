<!-- KIND: recipe — load when using or moving this bench. Nothing in demos/ needs it. -->

# `viewer-compare` — 3Dmol.js vs Mol\*, same protein, same moment

A style reference, not a lesson. Two third-party renderers draw the same
structure side by side, so "cartoon", "putty", "gaussian surface" and "by
hydrophobicity" can be seen the way the field conventionally draws them before
we build our own version of one. Where a renderer has no equivalent the pane
says so, rather than quietly substituting.

`molstar-evaluation.md` beside it is the long form: Mol\* given a real lesson to
rebuild, stage by stage, with the measurements. It was `demos/molstar/README.md`
and its paths still read that way on purpose. The two files are here together
because they are one question asked twice.

**The library question it was built to answer is closed** and reopening it is
not what the page is for. Neither viewer was adopted: a viewer brings its own
WebGL context and canvas, so it cannot draw into `scene.js`'s scene. That is a
structural argument, and no amount of nicer ribbons touches it.

## It depends on nothing here

`index.html` is the whole thing. Both libraries come from jsDelivr, pinned, and
every structure is fetched from `files.rcsb.org` by its PDB id — there is no
data directory and no import from `demos/`. Open the file, or serve the folder:

```bash
python3 -m http.server 8819
```

Moving it to its own repository is `git mv` and nothing else. Two files in
`demos/` cite the SES timings it measured (`tools/ses.js`,
`hemoglobin/tools/bake-surface.js`); those are prose about a past measurement,
not a dependency, and `tools/check-docs.js` records the filename as absent from
`demos/` on purpose so it cannot drift back.

## It is not deployed

`.vercelignore` withholds the folder and `vercel.json` redirects `/viewer-compare`
away, so the public site never serves it. Both, because `.vercelignore` alone is
a CLI-deploy mechanism and this repo deploys from the Git integration —
`docs/deploy.md`.
