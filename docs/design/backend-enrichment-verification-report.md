# Backend Enrichment Verification Report (Subphase 2.5)

Purpose: verify that subphases 2.1 (intent/significance/algorithmPhase tagging), 2.2
(comparison-link and partition-boundary/sorted-region relationship instructions), 2.3
(narrative text generation), and 2.4 (pacing multipliers) work correctly **together**
across full, realistic runs of all 5 sorting algorithms — not just in each subphase's
own isolated unit tests — and to give an honest verdict on whether the
algorithm-distinguishability goal (`array-animation-excellence-spec.md` §2) is
achievable with the data the backend emits today.

Test file: `tests/integration/array-enriched-pipeline.test.ts` (42 tests, all passing).
Full repo suite: 765 tests passing (723 prior + 42 new), 0 regressions. `packages/runtime`
type-checks clean.

Test arrays: a 10-element "realistic" array (`[55,12,89,34,3,76,45,8,100,23]`, no
duplicates, no partial ordering) for the per-algorithm checks, and a 12-element array
(`[42,7,19,88,3,56,71,24,9,63,31,15]`) specifically to force multi-level recursion in
quick sort and merge sort.

---

## 1. Per-algorithm verification results

Real numbers from the 10-element run (captured via a throwaway instrumented test,
discarded after use — not part of the committed suite):

| Algorithm | Compares | Swaps/Overwrites | Pivots | Finalizes | Boundaries (SET) | Regions | Significance (routine/notable/pivotal) | Adjacency fraction |
|---|---|---|---|---|---|---|---|---|
| Bubble | 42 | 23 swaps | 0 | 7 | 0 | 7 | 42 / 23 / 7 | 1.00 |
| Selection | 45 | 9 swaps | 0 | 9 | 0 | 9 | 45 / 9 / 9 | 0.36 |
| Insertion | 30 | 23 swaps | 0 | 9 | 0 | 9 | 46 / 7 / 9 | 1.00 |
| Merge | 23 | 34 overwrites | 0 | 0 | 9 | 0 | 57 / 0 / 0 | 0.22 |
| Quick | 23 | 11 swaps | 6 | 6 | 6 | 0 | 28 / 6 / 12 | 0.26 |

All 6 requested checks passed for every algorithm:

1. **Intent + significance tags, whole run**: confirmed every `COMPARE`/`SWAP` carries
   the correct algorithm-specific intent (`adjacent-check`/`adjacent-swap` for bubble,
   `candidate-check`/`selection-swap` for selection, `shift-check`/`shift` for
   insertion, `merge-comparison` for merge, `partition-boundary`/`partition-swap` for
   quick) and the correct `algorithmName`, for every single instance across the run —
   not just a hand-picked sample.
2. **Comparison-link pairing, entire run**: every `SHOW_COMPARISON_LINK` is followed by
   its matching `HIDE_COMPARISON_LINK` (same `i`/`j`) before another link opens, for
   the full run, for all 5 algorithms (verified via a stack-based well-formedness
   check, not spot checks). `SHOW` count exactly equals `COMPARE` count in every case.
3. **Sorted-region monotonic growth, entire run**: bubble's regions always end at
   `n-1` and strictly shrink their `startIndex` each pass; selection's and insertion's
   regions always start at `0` and strictly grow their `endIndex` each iteration.
   Confirmed monotonic (no shrink-back) across the whole run for both directions.
4. **Partition boundary nesting, multi-level recursion (12-element array)**: quick
   sort produced 9 `SET_PARTITION_BOUNDARY` calls (matching its 9 `PIVOT` steps
   exactly) with a **max nesting depth of 6** — genuinely deep, multi-level recursion,
   correctly bracket-matched (every `CLEAR` closes the innermost open `SET`, nothing
   left open at the end). Merge sort produced 11 `SET` calls with **max depth 1** —
   confirmed sequential (never overlapping), which is the mathematically correct shape
   for `merge()` (each nested call fully completes, including its own `CLEAR`, before
   its parent's single `merge()` call begins) — see the caveat in §3 below about what
   this means for the "simultaneous regions" narrative claim.
5. **Narrative text, real run**: every narrated step (`COMPARE`/`SWAP`/`PIVOT`/
   `FINALIZE`/`OVERWRITE`) produced a non-empty string with no `"undefined"`, `NaN`, or
   `[object Object]` leakage, replayed against a live value simulation (mirroring how
   `SortAlgorithms.ts` actually resolves values during real playback, not the
   post-sort final array). Sample lines pulled from real runs:
   - Bubble: `"55 > 12 — arr[0] and arr[1] will be swapped"`, `"arr[3] has reached its final sorted position"`
   - Selection: `"New minimum found: arr[1]=12 is now the candidate"`
   - Insertion: `"89 ≤ 100 — already in order, no swap needed"`
   - Merge: `"Merging sorted runs [0-4] and [5-9]"`
   - Quick: `"Selecting arr[9]=23 as the pivot for this partition"`, `"Pivot 89 locked into its final position at arr[8] — partition splits into [8-7] and [9-9]"` (see the bug flagged in §4)
6. **Pacing multiplier distribution**: every narrated step carries a real significance
   tag (0 untagged), multiplier ordering holds (`routine`(1) < `notable`(1.5) <
   `pivotal`(2.5)), and `pivotal` events are a minority of the tagged stream for every
   algorithm — except merge sort, which has **zero** `notable`/`pivotal` events at all
   (flagged as a gap in §4, not silently treated as passing).

---

## 2. Cross-algorithm distinguishability check

Same 10-element array run through all 5 algorithms, comparing the structural signals
`array-animation-excellence-spec.md` §2 says should differ between algorithm families.

| Signal | Bubble | Selection | Insertion | Merge | Quick |
|---|---|---|---|---|---|
| Comparisons always adjacent (`\|i-j\|=1`)? | Yes (1.00) | No (0.36) | Yes (1.00) | No (0.22) | No (0.26) |
| Has `PIVOT` steps? | No | No | No | No | **Yes** |
| Has `OVERWRITE` steps? | No | No | No | **Yes** | No |
| Has `SET_PARTITION_BOUNDARY`? | No | No | No | Yes | Yes |
| Max boundary nesting depth (12-el array) | n/a | n/a | n/a | 1 | 6 |
| `MARK_SORTED_REGION` anchor | end (`endIndex=n-1`) | start (`startIndex=0`) | start (`startIndex=0`) | none emitted | none emitted |
| % of tagged steps that are `pivotal` | 10% (7/72) | 14% (9/63) | 15% (9/62) | **0% (0/57)** | 26% (12/46) |

**Verdict: category-level distinguishability is achievable with today's data — with one clear gap.**

- **Sweep family (bubble, insertion) vs. everything else**: cleanly separated by
  adjacency fraction (`1.00` vs. `<0.4` for all three others). This one number alone
  puts bubble and insertion in their own bucket.
- **Bubble vs. insertion, within that bucket**: distinguishable by `MARK_SORTED_REGION`
  anchor direction alone (`end` vs. `start`) — a hard, binary, already-tested signal.
  Beyond that, we additionally checked the *shape* of each algorithm's per-iteration
  swap "bursts" (swaps between consecutive `FINALIZE` events), since this is the
  excellence spec's named distinguishing rhythm for these two: bubble's burst lengths
  for this run were `[7,5,4,3,2,2,0]` — a smooth, strictly monotonic decay — while
  insertion's were `[1,0,2,4,1,3,6,0,6]` — non-monotonic, erratic, exactly the
  "sometimes barely moves, sometimes walks far back" pattern the spec describes. Both
  are **derivable today** by segmenting the existing step stream on `FINALIZE`
  boundaries and counting `SWAP` steps per segment — but this is a **consumer-side
  aggregation**, not a pre-computed field the backend hands over directly. Flagged in
  §4 as worth a small follow-up (a `burstLength` field would be a two-line addition),
  not a blocker.
- **Divide-and-conquer family (merge, quick) vs. everything else**: cleanly separated
  by `SET_PARTITION_BOUNDARY` presence (only these two ever emit it).
- **Merge vs. quick, within that bucket**: cleanly and *exclusively* separated by two
  independent, mutually-exclusive signals — `PIVOT` steps exist only for quick sort,
  `OVERWRITE` steps exist only for merge sort. Either signal alone is sufficient; having
  both is a nice redundancy check. Nesting depth (6 vs. 1 on the 12-element array) is a
  further, though softer, distinguishing signal.
- **Selection sort**: distinguished from the sweep family by adjacency fraction, and
  from the divide-and-conquer family by the absence of `PIVOT`/`OVERWRITE`/boundaries —
  falls cleanly into its own bucket by elimination, consistent with the spec's
  "search, search, search... one decisive move" description (its own significance
  histogram — a large `routine` majority with `notable` reserved for a single swap per
  outer iteration — reflects exactly that rhythm).

**Answer to the posed question**: yes, achievable — the five category-level buckets the
excellence spec asks for (comparison-sweep, selection-scan, insertion-walk, and the two
divide-and-conquer algorithms distinguished from each other) are all separable using
data the backend emits *today*, with no new instruction types needed. The one caveat is
the merge-sort significance gap below, which would visually flatten merge sort's pacing
into a monotone rhythm relative to the other four if Phase 3-6 build pacing-driven
visuals directly off `significance` without addressing it.

---

## 3. A caveat on "simultaneous regions"

The excellence spec's divide-and-conquer signature (§2) describes merge sort as
showing "two adjacent sorted sub-regions being interleaved... simultaneously." The
boundary-nesting check found merge sort's `SET_PARTITION_BOUNDARY`/`CLEAR_PARTITION_BOUNDARY`
pairs are **never nested** (max depth 1, strictly sequential) — because `mergeSortRecurse`
fully completes each half's recursive sort (including that half's own bounded `merge()`
call) *before* starting its parent's `merge()` call. This is algorithmically correct
(nothing is actually running in parallel in a synchronous, single-threaded trace), but
it means the boundary-instruction stream by itself does not carry a "these two regions
are active at the same time" signal the way a true parallel/interleaved animation might
want to imply. A renderer that wants to visually show "two regions lighting up together"
for merge sort will need to synthesize that from the two half-ranges implied by a given
`merge()` call's `left`/`mid`/`right`, not from instruction-stream concurrency — this is
a rendering-layer interpretation question, not a backend data gap, but worth flagging
so Phase 3 doesn't assume the boundary events themselves imply temporal overlap.

---

## 4. Gaps found (specific, for Phase 3-6 follow-up)

1. **Merge sort has no `notable`/`pivotal` significance tags at all.** Every `COMPARE`
   and `OVERWRITE` inside `merge()` is tagged `routine` — confirmed by this run's
   histogram (`57/0/0`). Every other algorithm has at least one `pivotal` event
   (`FINALIZE` and/or pivot lock-in). This means merge sort currently has no
   backend-flagged "decisive moment" for pacing/dwell-time purposes, and its
   `suggestedDurationMultiplier` will be `1.0` for its entire run. **Recommendation**:
   before Phase 3-6 build pacing-aware visuals, decide what merge sort's decisive
   moment should be (candidates: the comparison that picks which run "wins" at a given
   step, or completion of each `merge()` call, or the final/outermost merge) and tag it
   `notable` or `pivotal` accordingly — a small, scoped addition to `SortEngine.ts`'s
   `merge()`, following the same pattern already used elsewhere.
2. **Quick sort has no `MARK_SORTED_REGION`.** Only bubble/selection/insertion emit it;
   quick sort's confirmed positions are scattered pivot indices (via `FINALIZE`), not a
   single contiguous, monotonically-growing region, so no marker was implemented for it
   in 2.2. This was a deliberate, algorithm-correct choice (quicksort genuinely doesn't
   have a single confirmed frontier), but it means the narrative spec's "`{k} of {n}
   confirmed`" progress-readout (§3 of the narrative UX spec) has no ready-made data
   source for quick sort today — a consumer would need to count `FINALIZE` events
   itself. Not a defect, but worth flagging as a small future consideration if that
   progress-readout is prioritized in Phase 3-6.
3. **Template 7's pivot-lock-in text produces a nonsensical empty range when the pivot
   locks in at the edge of its partition.** Confirmed in this run: `"Pivot 89 locked
   into its final position at arr[8] — partition splits into [8-7] and [9-9]"` — the
   `[8-7]` segment (start > end) is confusing to a reader and should read something
   like "no left partition" or be omitted. This is a real, user-facing string-quality
   bug in `ArrayNarrativeGenerator.pivotLockInText`, not a hypothetical edge case — it
   will occur on the very common case of a pivot ending up at the boundary of its
   range. **Recommendation**: special-case an empty resulting sub-range in the
   generator before Phase 3 renders this text verbatim in the caption bar.
4. **Selection sort's narrated stream is mostly generic fallback text, by design.**
   Only comparisons that find a new minimum get template 8 ("New minimum found...");
   the other ~80% of its `candidate-check` comparisons (36 of 45 in this run) fall back
   to `"Processing arr[i] and arr[j]"`. This matches 2.3's deliberate scope decision
   (no spec template exists for "routine, not a new candidate"), so it is **not a bug**
   — but it's worth Phase 3 knowing that selection sort's caption line will show
   generic text far more often than the other algorithms' captions do.
5. **No `pass`/progress-count field was added in 2.1-2.4.** The narrative UX spec's §3
   progress readout ("Pass 2 of 7", "{k} of {n} elements confirmed") needs either a
   `pass` field on `SortStep` (flagged as buildable-with-zero-schema-change back in the
   original semantic gap analysis, §1.5) or consumer-side counting of `FINALIZE`
   events — neither was built in this phase since it wasn't required by any of the 7
   narrative templates 2.3 implemented. Confirmed still absent; explicitly re-flagging
   here so it isn't assumed to already exist when Phase 3-6 build the progress bar.
6. **Ordinary (non-final-placement) `SWAP` narration and pending-comparison narration
   are intentionally generic**, confirmed working as designed (2.3 scoped these as
   frontend-only per the narrative spec's backend/frontend table) — restated here only
   so Phase 3 doesn't mistake this for an oversight when it sees generic
   `"Processing arr[i] and arr[j]"` text on most swaps.

None of these six gaps block Phase 3 from starting — the core acceptance criterion
(intent/significance tags, paired relationship instructions, correctly-nested
boundaries, narrative text, and pacing hints all present and composing correctly
end-to-end) is met for all 5 algorithms. Items 1 and 3 are the two worth prioritizing
before pacing/narrative-driven visuals ship, since they'd otherwise surface as visible,
user-facing defects (a flat merge-sort rhythm; a garbled caption string).
