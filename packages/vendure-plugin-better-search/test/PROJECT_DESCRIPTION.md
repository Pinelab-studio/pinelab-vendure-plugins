# Project Description

This plugin offers more intuitive search than Vendure's `DefaultSearchPlugin` before the need of an external platform like TypeSense or ElasticSearch.

This plug is meant for small to medium sized shops with up to ~10000 variants.

# Analysis & Proof of Concept Phase

### Goals

1. Performant in-memory search, without affecting customer-facing API calls.
2. Provide relevant, type-tolerant (fuzzy matching) search results, while still meeting goal 1

## Requirements

- [ ] Provide relevant, type-tolerant (fuzzy matching) search results
- [ ] Performant in-memory search, without affecting customer-facing API calls (without blocking the node event loop) **without sacrificing relevance**
- [ ] Allow indexing custom fields, and return them in the search results.
- Allow boosting specific fields and specific documents in the result set.
- [ ] Must be configurable: After researching relevance, it became clear relevance is not only technical but also domain-specific. Consumers of the plugin should be able to **boost specific fields**, as well as **boosting or deboosting specific documents** in the result set.
- [ ] Include search analytics so that relevance can be tuned based on live customer data. This is crucial for relevance tuning.

## Approach and Phases

### Synthetic relevance testing

First we implement MiniSearch, Orama and FlexSearch to see if they can pass the basic synthetic relevance tests defined in the e2e test. All engines passed the synthetic relevance tests.

**Findings:**

Currently both Minisearch and Orama pass the basic relevance test, but Orama needs less customization because its built-in BM25 algorithm already handles relevance well. MiniSearch is missing features like stemming and length normalization, so the code works around them manually and still has some inconsistent fuzzy settings left in.

Current favorite is Orama.

Update april 14:
Implemented FlexSearch. FlexSearch is supposed to be faster for simple full-text lookup, but it doesn't natively support weighted multi-field scoring or BM25-style relevance ranking. We had to build a mini ranking engine around it. Upcoming performance tests will show us the results.

Next steps: Performance testing, pick one, implement it in a running shop, and test relevance there.

### Synthetic performance testing

We will test performance of each of the engines in a local resource restricted environment to see which performs best.

### Prepare for live project

1. Run the best performing engine locally against a live dataset and evaluate the relevance manually.
2. Fully implement engine so the algorithm can be used as Vendure search plugin:
   1. Implement search in worker thread to not block the main thread.
   2. Filtering by facets and collections. If this is not possible, move to the next candidate.
   3. Implement search-as-you-type endpoint to save compute power.
3. Run load test against deployed search and see if the non-search actions in Vendure are unaffected by heavy search.

### Live project relevance+performance testing

We deploy the implemented engine of the previous phase in a live shop and have customers actually use it.

1. Monitor CPU and memory usage compared to current search solution when deployed.
2. Implement analytics to review usage (empty results, most searched keywords, duration of searches etc) and improve relevance and perhaps improve performance.
