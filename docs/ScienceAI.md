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
