// The learnings view.
//
// The organising idea: "proven" and "we think so" must not look the same. Every item carries a
// state badge, and claims that turned out to be WRONG stay on the page as CORRECTED rather than
// being deleted — a quietly removed claim gets re-asserted by the next person.
import { ATELIER, LEARNING_GROUPS, STATE_LABEL, type LearningState } from '../data/learnings';

function Badge({ state }: { state: LearningState }) {
  return <span className={`learn-badge learn-badge--${state}`}>{STATE_LABEL[state]}</span>;
}

export default function Learnings() {
  const counts = LEARNING_GROUPS.flatMap((g) => g.items).reduce<Record<string, number>>(
    (acc, i) => ({ ...acc, [i.state]: (acc[i.state] ?? 0) + 1 }),
    {},
  );

  return (
    <>
      <section className="learn-hero">
        <label>THE UTOPIA STUDIO · WHAT WE LEARNED</label>
        <h1>{'THE ENVIRONMENT WAS\nTHE EASY PART.'}</h1>
        <p>
          41 hours unattended, two agents, three sleep/wake boundaries — one with the laptop shut in
          a bag and no network. Everything survived. The thing that broke was the one nothing was
          watching.
        </p>
        <div className="learn-legend">
          <span>
            <i className="learn-badge learn-badge--proven">PROVEN</i> we ran it · {counts.proven ?? 0}
          </span>
          <span>
            <i className="learn-badge learn-badge--design">DESIGN</i> reasoned, not run ·{' '}
            {counts.design ?? 0}
          </span>
          <span>
            <i className="learn-badge learn-badge--open">OPEN</i> nobody has done it ·{' '}
            {counts.open ?? 0}
          </span>
          <span>
            <i className="learn-badge learn-badge--false">CORRECTED</i> we had it wrong ·{' '}
            {counts.false ?? 0}
          </span>
        </div>
      </section>

      {LEARNING_GROUPS.map((g) => (
        <section className="learn-group" key={g.id} id={g.id}>
          <div className="learn-group-head">
            <label>
              {g.num} · {g.title}
            </label>
            <p>{g.lede}</p>
          </div>
          <div className="learn-items">
            {g.items.map((i) => (
              <article key={i.claim} className={`learn-item learn-item--${i.state}`}>
                <div className="learn-item-head">
                  <h3>{i.claim}</h3>
                  <Badge state={i.state} />
                </div>
                <p>{i.detail}</p>
              </article>
            ))}
          </div>
        </section>
      ))}

      <section className="learn-group" id="atelier">
        <div className="learn-group-head">
          <label>06 · ATELIER LEARNINGS</label>
          <p>{ATELIER.lede}</p>
        </div>
        <div className="learn-items">
          <div className="atelier-grid">
            {ATELIER.families.map((f) => (
              <article key={f.id} className="atelier-cell">
                <b>{f.id}</b>
                <strong>{f.label}</strong>
                <span>{f.note}</span>
              </article>
            ))}
          </div>
          <article className="learn-item learn-item--proven">
            <p>{ATELIER.punchline}</p>
          </article>
        </div>
      </section>
    </>
  );
}
