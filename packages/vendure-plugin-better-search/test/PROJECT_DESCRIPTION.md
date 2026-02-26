# Project Description

This plugin offers more intuitive search than Vendure's `DefaultSearchPlugin` before the need of an external platform like TypeSense or ElasticSearch.

This plug is meant for small to medium sized shops with up to ~10000 variants.

## Analysis & Proof of Concept Phase

### Goals

1. Performant in-memory search, without affecting customer-facing API calls.
2. Provide relevant, type-tolerant (fuzzy matching) search results, while still meeting goal 1

### Requirements

- [ ] Provide relevant, type-tolerant (fuzzy matching) search results
- [ ] Performant in-memory search, without affecting customer-facing API calls (without blocking the node event loop) **without sacrificing relevance**
- [ ] Allow indexing custom fields, and return them in the search results.
- Allow boosting specific fields and specific documents in the result set.
- [ ] Must be configurable: After researching relevance, it became clear relevance is not only technical but also domain-specific. Consumers of the plugin should be able to **boost specific fields**, as well as **boosting or deboosting specific documents** in the result set.
- [ ] Include search analytics so that relevance can be tuned based on live customer data. This is crucial for relevance tuning.

### Approach

1. Find the search algorithm that gives us the best relevance. See `search.e2e.spec.ts` to see how relevance is tested.
2. Run relevance tests for each candidate to see if we can achieve the desired relevance. Any candidate that does not achieve the desired relevance should be discarded.
   - MiniSearch, because it uses BM25 algorithm, but is not as performant as Flexsearch
   - Orama, similar to MiniSearch, but allows custom algorithm settings
   - Flexsearch, because it is the most performant, but needs custom algorithms for better relevance
3. Take the best-performing solution, and test for performance in sandboxed environment. (See below for more details.)
4. Implement filtering by facets and collections, so the algorithm can be used as Vendure search plugin. If that is not possible, move the the next candidate to the next phase.

## Performance Benchmarks

The performance we need:

// TODO: Investigate what a sensible number for search queries is for our target audience store. Then run benchmarks in sandboxed env to simulate on a deployed server with limited resources. We manually check if the shop API is still performant when simultaneously running search queries.

// TODO: Find real life search queries from existing clients.
