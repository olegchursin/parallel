# Editorial status and coverage

This is a **research preview**, not an editorially published history product. Historical coverage ends on **31 December 2025**. The 120 event/process records are marked `evidence-checked`, with `checkedBy` and `reviewedAt` left null. No independent historian has reviewed or approved them. The author field identifies source-assisted development rather than inventing a reviewer.

The build contains 25 entity records, 15 period records, six journeys and 100 bibliographic sources. All ten regions and all twelve temporal allocation windows are represented. Approximately 79% of primary themes are outside politics/warfare. The generated [coverage report](reports/coverage.json) is authoritative for counts and version.

## Selection and known limits

The requested 120-record sample uses the PDF's regions and temporal windows, but not mechanically scaled quotas. Source availability led to more archaeological sites and documented institutional milestones, and fewer accounts of everyday life, labour, gender and local intellectual traditions. Empty lanes are labeled as collection gaps.

UNESCO heritage summaries dominate ancient and medieval coverage. These summaries are useful for identifying dates and material evidence but are not substitutes for regional scholarship, Indigenous perspectives or historiographical debate. Central and North Asia and Southeast Asia have small samples. Recent history is especially selective. The Americas include eight pre-1492 primary start anchors out of sixteen, meeting the PDF's suggested 50% audit target; this numerical check does not establish balanced representation. Oceania includes deep-time Australia, New Guinea and Pacific records, but “before colonization” must be assessed by place rather than by a universal date.

The 40 entity/period records intentionally reuse supported evidence about phases. Their panels say that a phase is not a complete lifespan. Western and Eastern Han phases preserve the intervening gap. Journeys are curatorial comparisons; step order alone never asserts transmission or causation.

## Research and corroboration

Relevant source passages were opened and checked for the factual summaries, date expressions and location context. The [inspection ledger](SOURCE-CHECKS.md) records the source URLs and locators. Citation roles and claim IDs are preserved in public records. Most records have one institutional source family. Discovery and comparison attempts do not amount to independent scholarly corroboration; this remains explicitly unresolved and bars publication.

Examples of issues handled conservatively:

- Pompeii uses the year 79 CE; the disputed eruption day is not asserted.
- Nalanda distinguishes the monastic/scholastic phase from earlier archaeological occupation.
- Taj Mahal dating identifies the mausoleum phase rather than attributing every associated structure to one completion date.
- Early years-ago statements preserve their source-native expressions. Rounded BCE coordinates are layout anchors, not invented calibration results or arrival dates.
- The Diamond Sutra, Jikji and Hunminjeongum retain year precision where a finer calendar conversion was not independently checked.
- Magna Carta is presented at year precision instead of silently treating a medieval Julian date as Gregorian.
- The 1967 Australian referendum is not described as granting citizenship or voting rights.
- The Emancipation Proclamation is distinguished from nationwide constitutional abolition.
- The UN/WHO/Paris Agreement records distinguish signature/adoption from entry into force.
- The Korean armistice is not described as a peace treaty.
- The Kazakhstan source is in Russian; its English paraphrase still needs independent language review.

Search-discovered pages that could not be inspected were not used as supporting sources. Failed IWM/UN landing-page and some national-archive retrievals were replaced by accessible inspected institutional passages, or their candidate events were omitted. Two URLs from the same institution are one source family, not independent corroboration.

## Publication and correction workflow

1. Preserve the stable ID; increment `review.revision` for substantive changes.
2. Add or revise claim-level citations with a specific locator. Record competing evidence and explain uncertainty rather than averaging dates.
3. Obtain independent historical review, record the actual reviewer and review date, and resolve the listed issues. Anchor records need at least two source families for publication.
4. Change status to `published` only after those conditions are satisfied. The compiler rejects incomplete publication provenance.
5. Use `content/corrections.json` for event redirects or withdrawals. Redirect targets must be visible records; a withdrawn event cannot remain eligible or simultaneously redirect. Withdrawals retain a public reason and an informational URL. Update journeys, relationships and entity references if a record is removed.
6. Rebuild, validate and inspect the complete release. Never mutate a versioned artifact in place.

`CONTENT_MODE=production` ships only published records and the sources they actually use. With the current pending-review corpus, that means no historical records. `content/config.json` explicitly selects preview mode for this delivery. Unpublished authoring candidates and private research notes must never be copied into `public/`.
