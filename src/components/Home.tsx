import { Link } from '@tanstack/react-router'
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Layers3,
  MoveHorizontal,
  ShieldCheck,
} from 'lucide-react'
import { useApp } from './App'
import { PRESETS, REGIONS } from '../lib/taxonomy'
import { DEFAULTS } from '../lib/state'
import s from '../styles/App.module.css'
export function Home() {
  const { catalog, manifest } = useApp()
  return (
    <main id="main">
      {catalog.events.length === 0 && (
        <div className={s.status}>
          This published-only build has no independently approved historical records yet.
        </div>
      )}
      <section className={s.hero}>
        <div className={s.heroCopy}>
          <p className={s.eyebrow}>
            <span className={s.smallLine} /> THE PAST, IN PARALLEL
          </p>
          <h1>
            History didn’t happen
            <br />
            <em>one place at a time.</em>
          </h1>
          <p className={s.heroIntro}>
            See what was unfolding across the world.
            <br />
            Follow a thread. Find a connection. Look beyond a single story.
          </p>
          <div className={s.heroActions}>
            <Link to="/timeline" search={DEFAULTS} className={s.primary}>
              Explore the atlas <ArrowRight size={18} />
            </Link>
            <a href="#journeys" className={s.textLink}>
              Or take a guided journey <ArrowUpRight size={16} />
            </a>
          </div>
          <div className={s.heroMeta}>
            <span>
              <strong>{manifest.recordCounts.events}</strong> events & processes
            </span>
            <span>
              <strong>10</strong> regional perspectives
            </span>
            <span>
              <strong>{manifest.recordCounts.journeys}</strong> reading journeys
            </span>
          </div>
        </div>
        <div
          className={s.heroGraphic}
          aria-label="Illustration of regional histories sharing one timeline"
        >
          <div className={s.graphicTop}>
            <span>A WORLD IN MOTION</span>
            <MoveHorizontal size={18} />
          </div>
          <div className={s.graphicTicks}>
            <span>1000 CE</span>
            <span>1200 CE</span>
            <span>1400 CE</span>
          </div>
          <div className={s.graphicGrid} />
          {[
            { label: 'AFRICA', name: 'Great Zimbabwe', x: 23, w: 66, color: '#b78462' },
            { label: 'EAST ASIA', name: 'Texts at Haeinsa', x: 55, w: 25, color: '#8494a8' },
            { label: 'SOUTHEAST ASIA', name: 'Angkor', x: 5, w: 89, color: '#729588' },
            { label: 'THE AMERICAS', name: 'Cahokia', x: 14, w: 30, color: '#a493af' },
            { label: 'OCEANIA', name: 'Nan Madol', x: 52, w: 43, color: '#6c9ba5' },
          ].map((r, i) => (
            <div className={s.graphicLane} key={r.label}>
              <span>{r.label}</span>
              <div className={s.graphicTrack}>
                <div style={{ marginLeft: r.x + '%', width: r.w + '%', background: r.color }}>
                  <i />
                  {r.name}
                </div>
              </div>
            </div>
          ))}
          <div className={s.graphicCursor} />
          <div className={s.graphicNote}>
            Different places. A shared horizon.<span>ILLUSTRATIVE OVERVIEW ↗</span>
          </div>
        </div>
      </section>
      <section className={s.entrySection}>
        <div className={s.sectionHeading}>
          <div>
            <p className={s.eyebrow}>CHOOSE A MOMENT</p>
            <h2>Where will you begin?</h2>
          </div>
          <Link to="/timeline" search={{ ...DEFAULTS, ...PRESETS[0] }} className={s.textLink}>
            All of human history <ArrowRight size={17} />
          </Link>
        </div>
        <div className={s.eraGrid}>
          {[PRESETS[1], PRESETS[2], PRESETS[4], PRESETS[5]].map((p, i) => (
            <Link
              key={p.id}
              to="/timeline"
              search={{ ...DEFAULTS, from: p.from, to: p.to }}
              className={`${s.eraCard} ${i === 0 ? s.featuredEra : ''}`}
            >
              <span className={s.cardNumber}>
                0{i + 1} <ArrowUpRight size={18} />
              </span>
              <h3>{p.title}</h3>
              <p>{p.caption}</p>
              <span className={s.cardBottom}>
                {i === 0 ? 'A good place to start' : 'Open this time window'}{' '}
                <ArrowRight size={16} />
              </span>
            </Link>
          ))}
        </div>
      </section>
      <section className={s.journeySection} id="journeys">
        <div className={s.sectionHeading}>
          <div>
            <p className={s.eyebrow}>FOLLOW A THREAD</p>
            <h2>Small journeys. Wider perspectives.</h2>
          </div>
          <p>
            Curated reading paths through
            <br />
            the atlas. Go at your own pace.
          </p>
        </div>
        <div className={s.journeyGrid}>
          {catalog.journeys.map((j, i) => (
            <Link
              to="/journeys/$journeyId"
              params={{ journeyId: j.id }}
              key={j.id}
              className={s.journeyCard}
            >
              <div className={s.journeyArt} data-art={i}>
                <span>
                  {
                    [
                      '01 / SETTLEMENT',
                      '02 / URBAN WORLDS',
                      '03 / IN PARALLEL',
                      '04 / IDEAS IN PRINT',
                      '05 / RIGHTS & RESISTANCE',
                      '06 / SHARED HEALTH',
                    ][i]
                  }
                </span>
                <div className={s.artLines}>
                  {[0, 1, 2, 3, 4].map((n) => (
                    <i key={n} />
                  ))}
                </div>
                <BookOpen size={24} strokeWidth={1.3} />
              </div>
              <div className={s.journeyBody}>
                <h3>{j.title}</h3>
                <p>{j.summary}</p>
                <span className={s.textLink}>
                  Start reading <ArrowRight size={16} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
      <section className={s.principles}>
        <div>
          <Layers3 size={25} />
          <h3>Look across, not just along</h3>
          <p>
            Ten regional lanes share one scale. Compare events without flattening their differences.
          </p>
        </div>
        <div>
          <ShieldCheck size={25} />
          <h3>Follow the evidence</h3>
          <p>
            Open a record to inspect its sources, date precision and editorial status. Review
            remains ongoing.
          </p>
        </div>
        <div>
          <BookOpen size={25} />
          <h3>Make room for uncertainty</h3>
          <p>
            Approximate dates stay approximate. Empty space reflects the limits of this collection.
          </p>
        </div>
      </section>
      <div className={s.researchNote}>
        <span className={s.preview}>
          <i /> RESEARCH PREVIEW
        </span>
        <p>
          This is a beginning, not a complete history. All {catalog.events.length} records have
          source passages checked; independent historical review is pending.
        </p>
        <Link to="/about">
          Read our coverage notes <ArrowRight size={16} />
        </Link>
      </div>
    </main>
  )
}
