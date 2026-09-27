# Research expansion — 27 September 2026

This edition adds **30 events and processes**, three in each regional lane, bringing the preview to **150 events, 25 entities, 15 periods, six journeys and 142 source records**. Historical coverage still ends on 31 December 2025. Research access dates may be later.

The additions emphasize material culture, craft knowledge, exchange, Indigenous political expression and collaborative science. All 30 have a primary theme outside politics and warfare; the full corpus is now approximately 83% outside those themes. This intentional emphasis improves variety but does not establish representative coverage.

## Added records

| Region               | Records                                                                                                                    |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Africa               | `evt_000121` Ife terracottas; `evt_000122` Benin palace plaques; `evt_000123` imported silk in Asante kente                |
| West Asia            | `evt_000124` Iraqi luster bowl; `evt_000125` Iznik floral dish; `evt_000126` Ardabil carpet inscriptions                   |
| South Asia           | `evt_000127` Gandharan Buddhist patronage; `evt_000128` Chola Nataraja; `evt_000129` Hamzanama illustration                |
| East Asia            | `evt_000130` Goryeo sanggam; `evt_000131` Guo Xi handscroll; `evt_000132` Hokusai’s Great Wave                             |
| Central & North Asia | `evt_000133` Sogdian letters; `evt_000134` Sogdian silver cup; `evt_000135` Herat Mantiq al-tair manuscript                |
| Southeast Asia       | `evt_000136` Dongson miniature drum; `evt_000137` Ban Chiang painted jar; `evt_000138` batik cap stamps                    |
| Americas             | `evt_000139` Moche portrait vessels; `evt_000140` Maya mythological vessel; `evt_000141` Inka khipu                        |
| Oceania              | `evt_000142` Lapita pottery; `evt_000143` Te Hau-ki-Tūranga construction; `evt_000144` Yirrkala bark petitions             |
| Europe               | `evt_000145` Bayeux embroidery; `evt_000146` lithography development; `evt_000147` first Impressionist exhibition          |
| Across the world     | `evt_000148` Metre Convention; `evt_000149` International Geophysical Year; `evt_000150` Human Genome Project announcement |

## Evidence and editorial limits

Each record contains separate occurrence, date and context claims, linked to specific source passages or catalogue fields. The [source ledger](SOURCE-CHECKS.md#expansion-checked-27-september-2026) lists the 42 added bibliographic records. Sources include the Met, V&A, LACMA, Smithsonian NMAI, Te Papa, Buku-Larrŋgay Mulka Centre, university scholarship, BIPM, NASA, NOAA and NHGRI.

Eight new records use more than one source family: Ardabil, Hokusai, Sogdian letters, khipu, Lapita, Yirrkala, Impressionism and the IGY. This corroboration has limits: Te Papa supports Lapita technique rather than the Met’s broad chronology; the Smithsonian explains khipu use rather than deciphering the Hood object; the Sogdian publications partly rely on overlapping scholarship. Other records rely on one institutional family. Multiple Met pages, or NZHistory and Te Ara pages from Manatū Taonga, are not counted as independent corroboration within these records.

All additions are `evidence-checked` research drafts. No independent reviewer is named, and none is `reviewed` or `published`. Published-only mode continues to exclude them. Source-checking by the authoring assistant is not independent historical review.

Specific decisions:

- Object date ranges, including the Chola bronze, Dongson drum and Ban Chiang jar, describe uncertainty about manufacture. They are point records, not centuries-long durations. “Late” and “early” century phrases retain conservative outer bounds instead of invented exact cutoffs.
- Ardabil retains the inscribed AH 946 and the museums’ 1539–1540 CE conversion. Commission, workshop and Maqsud’s role remain qualified.
- The Herat manuscript’s 1487 text date is separated from later illustrations. An associated caption’s 1486 date is retained as an alternative chronology and a visible unresolved issue.
- The Ban Chiang catalogue’s period label conflicts with its descriptive phase attribution. The record reports the explicit object Date field and flags the disagreement; it does not establish a site-wide chronology.
- Lapita’s broad 1500–500 BCE envelope comes from a 2002 Met overview. No exact island settlement dates, calibrated radiocarbon results or universal ancestry claims are inferred.
- Senefelder’s 1796 experiments and the 1798 chemical-printing discovery are represented as stages, explaining why a shorter overview says “around 1796.”
- The 2003 genome announcement is explicitly distinguished from a gapless sequence. The original release itself describes the remaining gaps.
- The NGA Batik glossary was inspected through its complete indexed passage after direct retrieval returned 403. This access method is recorded in `src_000118`. Failed retrievals of other candidate pages are not presented as inspected corroboration.

The source summaries are original prose. No museum images or full source texts are copied into the application. Private retrieval material remains outside the public content build.

## Integration and verification

The compiler adds the records to search, temporal and regional indexes, detail shards, prerendered pages, and appropriate download packs. Stable IDs of the original corpus are preserved. The About page’s coverage bars now scale to the largest current region instead of a fixed 20-record ceiling.

Release verification covers deterministic content, references, published-only isolation, production builds, hashes, browser interactions, accessibility and offline behavior in Chromium, Firefox and WebKit. A new browser case checks search and source navigation for the Ardabil and Chola records and preserves their uncertainty text. See the current [test report](reports/tests.json), [coverage report](reports/coverage.json), and [release measurements](reports/release.json).

Physical-device and independent editorial checks remain pending as described in [VERIFICATION.md](VERIFICATION.md).
