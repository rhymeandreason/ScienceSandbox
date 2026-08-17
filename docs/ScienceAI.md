Let's say I want to build an AI app for answering science questions like: How do coastal redwoods "drink" fog straight from the air?

How could I do that with low latency?

Good example question to design around — it's factual, has a stable answer, and gets asked in many phrasings. That shapes the architecture a lot.

## The latency budget

Think in terms of where milliseconds actually go:

| Stage | Typical cost | Notes |
| --- | --- | --- |
| Network round trip | 20–80ms | Edge/CDN helps |
| Retrieval | 10–100ms | Vector search is fast; web search is not |
| Prefill (context processing) | 50–300ms | Scales with context length |
| Time to first token | 100–500ms | What users actually perceive |
| Decoding | \~10–30ms/token | Scales with output length |

The perceived number is **time to first token**, not total time. Optimize that first.

## The core moves

**1. Cache semantically, not just exactly.** "How do redwoods drink fog?" and "how do coast redwoods absorb water from fog" should hit the same cache entry. Embed the query, do an approximate-nearest-neighbor lookup against previously answered questions, and if cosine similarity is above \~0.95, serve the stored answer. For a science Q&A app the hit rate is high — the long tail of phrasings collapses onto a short list of actual questions. This turns most requests into a \~50ms lookup with no model call at all.

**2. Pre-build your corpus; don't search the live web.** Web search adds 300–800ms and is unpredictable. Instead, ingest a curated corpus ahead of time — textbook chapters, review papers, encyclopedia content — chunk it, embed it, and store it in a vector DB. Retrieval becomes a single sub-50ms query. For redwood fog drip, your chunks would come from plant physiology sources on foliar water uptake and hydraulic lift.

**3. Use a small model with a big prompt cache.** Haiku-class models are several times faster than frontier models and entirely sufficient for "summarize these three retrieved passages accurately." Keep your system prompt static and put it first so prefix caching kicks in — you then only pay prefill on the retrieved chunks and the question.

**4. Stream, always.** Even a 900ms full response feels fast if the first sentence appears at 200ms.

**5. Cap output length.** Ask for 3–5 sentences. Halving output length roughly halves decode time.

## The request path

Here's how a query flows through it:Cache check first (embed query → ANN lookup → hit means return in \~50ms, done). On a miss, retrieve top-k chunks from the vector DB, assemble a prompt with a cached static prefix, call the small model, stream tokens to the client, and write the finished answer back into the semantic cache asynchronously so the next person asking gets the fast path.

## What you'd hand the model

For the redwood question, retrieval should surface chunks about foliar uptake — that redwood needles absorb condensed fog water directly through the cuticle, that fog drip also wets the soil for root uptake, and that this can supply a meaningful fraction of summer water when there's no rain. The model's only job is to stitch those into a clear paragraph. That's a task a small model does well and fast.

## Two things worth adding

**A verification pass, run asynchronously.** Stream the fast answer immediately, then have a second call check it against the sources in the background. If it disagrees, flag or correct the cached version — so errors get fixed once rather than served repeatedly. The user never waits on it.

**A triggering classifier.** Not every input deserves a full pipeline. A tiny classifier can route greetings, off-topic questions, and out-of-scope requests to canned responses instantly.

## Practical stack

Something like: a vector DB (pgvector if you want one less service, Turbopuppy/Qdrant if you want speed at scale), a fast embedding model, Redis for the semantic cache, Claude Haiku for generation, and server-sent events for streaming. Host inference in the same region as your database.

If you want, tell me your expected query volume and whether the corpus is fixed or growing — those two answers change whether the caching layer or the retrieval layer is where you should spend your effort.

---

I would like the response to include relevant images. I have CC images from a textbook.

Good news for latency: images are the cheap part. You're retrieving, not generating, and if you index them alongside your text chunks the added cost is close to zero — the image lookup rides along with the retrieval you're already doing, and the actual files come from a CDN in parallel with token streaming.

### Index images as first-class chunks

Don't treat images as attachments to text passages. Give each one its own record with its own embedding, built from the caption plus the surrounding paragraph plus any alt text or figure description. That composite text is what you embed. A figure captioned "Foliar uptake of fog water in *Sequoia sempervirens*" plus its paragraph context will match a fog-drinking question strongly, even though the image itself contains no searchable words.

Each record wants: the embedding, a CDN URL, the caption, the license string, the attribution line, and a link back to the source. The license fields matter more than they look — see below.

### Retrieve them, don't let the model invent them

The failure mode here is the model hallucinating a figure reference or picking an image that doesn't exist. Two approaches, and I'd pick the first:

**Deterministic placement.** Your retrieval returns the top text chunks and the top 1–3 image chunks independently. You render the images in the response yourself, positioned near the text they came from. The model never sees or chooses images at all. Fastest, zero hallucination risk, slightly less contextually smart.

**Model-selected from a menu.** Pass the retrieved images to the model as a numbered list of IDs with captions, and instruct it to emit a marker like `[FIG:redwood_foliar_uptake]` at the point where a figure helps. You post-process markers into real image tags, dropping any ID that isn't in the list you supplied. Slightly better placement, minimal added tokens, but you need the validation step.

Either way the model should never emit a URL. It emits an ID you resolve, or nothing.

### Streaming with images

The sequencing matters for perceived speed. Send the image metadata down the stream **before** the text tokens — as a first SSE event carrying URLs, dimensions, and captions. The browser starts fetching from the CDN while the text is still generating, so the image is decoded and ready by the time the surrounding prose arrives. Include intrinsic width and height so the layout reserves space and nothing jumps.

Serve pre-resized variants (a \~400px inline version, full resolution behind a click) in WebP or AVIF, and preprocess these at ingest rather than on request.

### Caching

Store resolved image IDs in the semantic cache entry alongside the answer text. A cache hit then returns the complete response — prose and figures — in one shot with no retrieval at all.

Store the license type as a filterable field, so you can exclude NC images by query context or by deployment if that ever becomes relevant.

---

# Revised recommendation based on prototype in worktree textbook-image-index

## Keep

Pre-built corpus over live web search; semantic cache for repeated phrasings; small model with a static cached prefix; streaming; capped output; image metadata sent as the **first** SSE event so the CDN fetch overlaps generation; intrinsic dimensions to reserve layout. Indexing figures as first-class records embedded from caption + alt + surrounding paragraph is the doc's best call — our corpus confirms the premise: alt text carries more descriptive weight than captions (416k chars vs 296k) and almost never duplicates them.

## Change

**1. No vector DB at this scale.** Measured on the real corpus: 1148 figures, text payload 0.86 MB parsing in 2.3 ms; brute-force cosine over all of them 6.2 ms in plain JS. Embeddings as binary are 6.7 MB float32, 1.7 MB int8, 0.56 MB at int8/512-dim. A pgvector round trip can't beat a memory scan of 1148 items, and it adds a service and connection setup to every cold start. **Store vectors as binary, never JSON** — the same data as JSON is 32 MB and re-parsed on every cold boot.

On Vercel: bundle size is a non-issue for Node functions (250 MB limit); if you want Edge for its fast boot, quantize to int8/512-dim and it fits the 1 MB Hobby limit. At class-sized traffic, **cold starts dominate everything** — which argues for Edge and against a database, not for one.

**2. Take the model-picks-from-a-menu option, not deterministic placement.** The doc prefers deterministic; I'd invert that. The valuable output in our testing wasn't *which* figures came back, it was the one-line reason per figure — "fat enters downstream of glycolysis, so it feeds the marathoner and is useless to the sprinter." Nothing in a retrieval score produces that. The hallucination risk is fully handled by ID validation: the model emits ids only, the server resolves URL/caption/credit from the corpus, unknown ids fail loudly. Five agent-written decks, zero invented figures.

**3. Licence is per-image, not per-corpus.** 613 of 1148 figures carry their own credit line (NASA, USDA, Flickr and others), and the credit is embedded *inside the caption text* — extract it at ingest into its own field. OpenStax additionally carves its name and logo out of the CC grant. A single `license` column on the source is not a safe claim about every image under it.

**4. Filter at ingest, and keep checking links.** 81 figures have under 60 characters of alt text — icons and equation images that embed as noise. Two figures are broken *in the source book*. URLs need periodic HEAD checks, not just ingest validation.

**5. Mirror the images.** You're hot-linking the publisher's server. CC BY permits copying: pull all 1148 to Blob/CDN at ingest with pre-resized WebP variants, as the doc recommends for sizing anyway.

## Add — the layer the document is missing

**A curation table between retrieval and generation.** Relevance is not fitness to teach. Two things no embedding gives you:

* **Pedagogical adjacency.** "How do salmon go from saltwater to freshwater?" needs the osmosis-across-a-membrane diagram, which shares only the word "water" with the question. It surfaced because a human recorded that both figures belong to the same lesson. The same link now carries a sickle-cell question back to the protein-structure figures — which is where the student actually needs to go next.

* **Foils.** Several of the best picks *contradict* the simulation beside them and are valuable for exactly that reason. Similarity search cannot distinguish a good figure from a misleading one, and shipping a foil as neutral support undercuts the lesson.

Ours is 48 figures in 15 groups, \~10 k tokens, with a written reason each and an `extends` field linking outward-reaching topics back to their lesson. It overrides retrieval; retrieval provides recall behind it.

**An eval fixture set.** We found four real ranking defects — a coincidental rare word placing a figure, question filler scoring as content, companions drifting to the wrong chapter, compound words matching nothing — and every one surfaced only from running real student questions and reading the output. In production: fixed questions → expected figure ids, run on every index rebuild, or a re-embedding will silently degrade retrieval.

**Lesson context as a retrieval signal.** These figures support simulations, and the questions extend outward from a lesson. Carry the current lesson into the query as a bias rather than embedding the bare question.

## Sequence

1. Bake embeddings to a binary file at build time; keep the corpus and picks in the repo. No services.

2. Model selects by validated id; server resolves and renders; per-image credit shipped with every image.

3. Fixture evals on rebuild.

4. Measure. **Then** add Vercel KV for the semantic cache if the hit rate justifies it, and move the picks table to a store only when someone non-technical needs to edit it without a deploy.

Everything before step 4 is a static deployment with no database — which at 1148 figures is both faster and less to run.

---

At what scale of images do we need to reconsider?

**Thresholds:**

**Under \~5k figures — static, no argument.** You're at 1148, so \~3.5 ms. Even 4 more textbooks wouldn't move this.

**5k–25k — still static, but tune.** Scan runs 15–75 ms, comparable to a DB round trip but without the connection. Quantize to int8 for memory and truncate dimensions for speed. Note the counterintuitive result above: **int8 is not faster in JS** (no SIMD, and the loads widen) — it buys memory only. Halving dimensions is what buys speed.

**25k–100k — the real gray zone.** Scan hits 75–300 ms, which starts to eat the latency budget you're protecting. Two ways out, and I'd try the first: **partition before you scan.** You already have 13 concept buckets and lesson groups — searching one bucket instead of the whole book cuts N by roughly 10×, which pushes the static approach up an order of magnitude. That's an IVF index in spirit, built from structure you already curate. If partitioning doesn't fit the query pattern, this is where a service earns its place.

**Over \~100k — use a vector DB.** Brute force is 300 ms+, the index no longer sits comfortably in a function's memory, and you want a real ANN index.

**Vercel-specific ceilings that bite before the CPU does:**

* **Edge runtime is tight**: at 512-d int8 a vector is 512 bytes, so 1 MB ≈ 2k vectors, 2 MB (Pro) ≈ 4k. Edge is only viable for a small curated index — which, notably, your 48 picks *are*.

* **Node functions**: the 250 MB bundle caps you around 40k vectors at float32, \~170k at int8. Cold-start file reads grow with size too, and cold starts are already your dominant cost.

**And the triggers that have nothing to do with count** — any one of these flips the decision regardless of scale: content edited without a deploy, per-user data or feedback, or hybrid filtering (licence, source, grade level) combined with vector search.

For your trajectory — one textbook, maybe a few more later — you'd need roughly a **20× corpus increase** before this is worth revisiting. Worth re-measuring, not re-architecting, at around 10k figures.

---

Notes for Image sources:

https://bioart.niaid.nih.gov \~2,000 assets, professional medical illustrators

https://www.cellimagelibrary.org/ must hand pick

---
