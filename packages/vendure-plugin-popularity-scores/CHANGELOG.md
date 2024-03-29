# 1.6.1 (2024-03-29)

- Fix error when calculating popularity scores for colletions (#386)

# 1.6.0 (2024-01-21)

- Aggregate the child `Product`s of a `Collection` in chunks when calcuating it's `popularityScore`. This adjustment aims to address [this reported issue](https://github.com/Pinelab-studio/pinelab-vendure-plugins/issues/303)

# 1.5.0 (2023-12-15)

- Allow manual setting of populairty scores on Products and Collections

# 1.4.0 (2023-11-02)

- Updated vendure to 2.1.1

# 1.3.0(2023-10-30)

- Add condition to check if a collection is empty as specified in (here)[https://github.com/Pinelab-studio/pinelab-vendure-plugins/issues/279]

# 1.1.0

- Remove unused select statement's while calculating product popularity scores to support Postgres
