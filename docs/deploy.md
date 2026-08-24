<!-- KIND: recipe — load when deploying, or when something about the deployment is wrong. Nothing in the lessons needs it. -->

# Deploying to Vercel

The lessons are static and would publish anywhere. The tutor is why this is not
GitHub Pages: `api/ask.js` is a serverless function, and Pages serves files.

**Deploy from the Git integration, not the CLI.** A CLI deploy uploads the
working tree and consults `.vercelignore` alone - a gitignored file is not
excluded by being gitignored, and `.env.local` is a gitignored file. The Git
integration only ever builds what is committed, which is the same guarantee
Pages gives today. `.vercelignore` carries the CLI exclusions anyway, as the
seatbelt for the day somebody deploys from a laptop.

## What deploys

`vercel.json` sets `outputDirectory: "."`, so the repo root is the site, exactly
as Pages publishes it. The local URL is the URL that ships, which is the whole
reason `dev-server.js` serves the root rather than `demos/`.

Local tools are withheld by `.vercelignore`: the log viewer
(`demos/ask/log.html` + `api/log.js`), the question-bank editor, and the
`viewer-compare/` bench. See that file for why each one.

**The deposited structures do not deploy either.** Every `.pdb` in the repo is a
baker input: the bakers under `*/tools/` read one and write the `.bin`/`.json`
a page actually fetches. They are committed because they are not reproducible on
demand - an entry gets superseded, a download URL moves - so git is the pin on
the exact structure a lesson was checked against. That is 13 MB the site never
serves.

Four pages fetch one at runtime and so are broken on the deployment, on purpose:
`attic/folding-lab.html` and `attic/folding-lab-ribbon.html` (1VII),
`folding/ribbon-test.html` (villin), `hemoglobin/hemoglobin-inhouse.html`
(2HHB). All four are prototypes or benches, used on the dev server. **Promoting
one to a featured lesson means baking what it fetches, not un-ignoring the
`.pdb`.**

`.vercelignore` is a CLI-deploy mechanism, and the Git integration is what
deploys here - so anything that must be unreachable on the public site needs a
route as well, not just the ignore. `vercel.json` redirects `/viewer-compare`
and everything under it, and anything ending `.pdb`, to `/` - and a redirect is
matched before the filesystem, which is what makes it hold whichever way
`.vercelignore` is treated. The two `api/` tools do not need the
same treatment: an undeployed function is not a route at all, and the smoke
test below checks that.

## The five featured lessons have short URLs

`vercel.json` rewrites `/water`, `/builder`, `/hemoglobin`, `/glycolysis` and
`/membrane` onto the `demos/*.html` files, and 301s the old `/demos/….html`
paths onto them. `index.html` links the short form.

A rewrite does not move the file, so every relative `src`, `href` and `fetch()`
in those five pages would resolve against `/` instead of `/demos/`. Each of the
five carries `<base href="/demos/">` for that reason, which is also correct at
its own path and on the local dev server. **Adding a page to this list means
adding the `<base>` tag too** - without it the short URL serves the HTML and
then 404s every script in it.

The short URLs are a Vercel routing feature; `dev-server.js` knows nothing about
them, so locally a lesson is still `/demos/water-lab.html`.

**Only `api/ask.js` becomes a public endpoint.** Vercel does not route files
whose names begin with an underscore, so `_tutor.js`, `_keys.js`, `_limit.js`,
`_log.js`, `_catalog.js`, `_targets.js`, `_local.js` and `_providers/` are
imported by it and are not reachable. The smoke test below checks that rather
than trusting it.

**`api/` publishes as readable source.** The system prompt is public. No key is
in it. This was already true on Pages.

## Environment variables

Set in the Vercel project, Production scope. Same names as `.env.local`.

| | |
| --- | --- |
| `GEMINI_API_KEY` | required, or the tutor answers "not set on the server" |
| `AI_PROVIDER` | `gemini` unless you mean otherwise |
| `DATABASE_URL` | the Neon pooled string. **Unset means no log AND no rate limit** |
| `TUTOR_KEYS` | `cohort:secret` pairs. **Unset means the tutor is public and unmetered** |

The last two are the ones that fail quietly. Unset `TUTOR_KEYS` does not error:
it makes the tutor open to anyone who finds it. Unset `DATABASE_URL` does not
error either: `_limit.js` has nothing to count and fails open, so the caps stop
existing. Neither shows up on the page.

## The domain

`kodolab.org` is a GitHub Pages CNAME today. Moving it to Vercel is a DNS
change, and `CNAME` stays in the repo so Pages remains a working fallback: point
the records back and it serves again, without the tutor.

Do the DNS change LAST, after the `*.vercel.app` URL has answered the smoke test
below. The domain must never be the thing that first points at an ungated
endpoint.

## Smoke test

Against the deployment, before the domain moves and again after. `$K` is a real
secret from `TUTOR_KEYS`.

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://<deployment>/            # 200, the lesson index
curl -s -o /dev/null -w '%{http_code}\n' https://<deployment>/water            # 200, the lesson
curl -s -o /dev/null -w '%{http_code}\n' https://<deployment>/demos/scene.js   # 200, what <base> resolves to
curl -s -o /dev/null -w '%{http_code}\n' https://<deployment>/demos/water-lab.html   # 301 to /water
curl -s -w ' %{http_code}\n' https://<deployment>/api/ask                 # 401 gated, 200 if not
curl -s -w ' %{http_code}\n' -H "X-Tutor-Key: $K" https://<deployment>/api/ask       # 200 + config
curl -s -o /dev/null -w '%{http_code}\n' https://<deployment>/api/_tutor  # 404: not a route
curl -s -o /dev/null -w '%{http_code}\n' https://<deployment>/api/log     # 404: not deployed
curl -s -o /dev/null -w '%{http_code}\n' https://<deployment>/viewer-compare/  # 307 to /, never the bench
curl -s -o /dev/null -w '%{http_code}\n' https://<deployment>/demos/hemoglobin/data/2HHB.pdb        # 307 to /, not 200
curl -s -o /dev/null -w '%{http_code}\n' https://<deployment>/demos/hemoglobin/data/2HHB-B.fold.bin # 200: the baked file IS served
curl -s -o /dev/null -w '%{http_code}\n' https://<deployment>/.env.local  # 404: never uploaded
```

Then in a browser, which is the half curl cannot check:

* `/water` with no `?k=` - **no Ask button**, and the console says why
* `/water?k=<secret>` - the button appears, `k` is gone from the
  address bar, and a question comes back with a Show me pill
* reload with no `?k=` - the button is still there, from `localStorage`

A 401 on the first of those is the gate working, not a broken deploy.

## After it is live

`node demos/tools/db.js cost` and the log viewer read the same Neon database
production writes to, from a laptop, with nothing public in the path. Watch the
per-class counts: a cohort at its hourly cap is what a leaked link looks like.
Rotate by editing `TUTOR_KEYS` and redeploying; the other cohorts are unaffected.
