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

Two files are withheld by `.vercelignore` and both are local tools: the log
viewer (`demos/ask/log.html` + `api/log.js`) and the question-bank editor. See
that file for why each one.

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
curl -s -o /dev/null -w '%{http_code}\n' https://<deployment>/demos/water-lab.html   # 200
curl -s -w ' %{http_code}\n' https://<deployment>/api/ask                 # 401 gated, 200 if not
curl -s -w ' %{http_code}\n' -H "X-Tutor-Key: $K" https://<deployment>/api/ask       # 200 + config
curl -s -o /dev/null -w '%{http_code}\n' https://<deployment>/api/_tutor  # 404: not a route
curl -s -o /dev/null -w '%{http_code}\n' https://<deployment>/api/log     # 404: not deployed
curl -s -o /dev/null -w '%{http_code}\n' https://<deployment>/.env.local  # 404: never uploaded
```

Then in a browser, which is the half curl cannot check:

* `/demos/water-lab.html` with no `?k=` - **no Ask button**, and the console says why
* `/demos/water-lab.html?k=<secret>` - the button appears, `k` is gone from the
  address bar, and a question comes back with a Show me pill
* reload with no `?k=` - the button is still there, from `localStorage`

A 401 on the first of those is the gate working, not a broken deploy.

## After it is live

`node demos/tools/db.js cost` and the log viewer read the same Neon database
production writes to, from a laptop, with nothing public in the path. Watch the
per-class counts: a cohort at its hourly cap is what a leaked link looks like.
Rotate by editing `TUTOR_KEYS` and redeploying; the other cohorts are unaffected.
