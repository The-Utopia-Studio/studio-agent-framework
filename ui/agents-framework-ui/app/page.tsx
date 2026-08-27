'use client';

import { useMemo, useState } from 'react';
import BuildFlow from './components/BuildFlow';
import ToolsFooter from './components/ToolsFooter';
import { PATH_EXAMPLES } from './data/tools';

type A = 'person' | 'scheduled' | 'read' | 'write' | 'review' | 'system';

const steps = [
  ['01', 'INTAKE', 'A short interview routes the request.'],
  ['02', 'DESIGN', 'Role, tools, memory, and boundaries.'],
  ['03', 'PROVE FIRST', 'Golden cases before anything is built.'],
  ['04', 'PRD & WORK ORDERS', 'A gated plan with named checks.'],
  ['05', 'BUILD & REGISTER', 'Live only when evidence is green.'],
];

const agents = [
  ['Website agent', 'Haniyah', 'PILOT'],
  ['Weekly research brief', 'Studio', 'READY'],
  ['Founder follow-up', 'Growth', 'DRAFT'],
];

export default function Home() {
  const [a, setA] = useState<A[]>([]);
  const [registry, setRegistry] = useState(false);
  const [started, setStarted] = useState(false);

  const has = (x: A) => a.includes(x);

  const rec = useMemo(
    () =>
      has('scheduled') && has('write') && has('system')
        ? ['04', 'CODED AGENT', 'Mastra runs the loop. Convex holds durable state and the event log.']
        : has('scheduled') || has('write')
          ? ['03', 'MANAGED SURFACE', 'A connected workflow with a named owner and review point.']
          : has('person') && has('read')
            ? ['01', 'SKILL', 'A repeatable procedure people can run on demand.']
            : ['—', 'ANSWER THE INTAKE', 'Three decisions find the smallest thing that works.'],
    [a],
  );

  const choose = (x: A) => setA((v) => (v.includes(x) ? v.filter((y) => y !== x) : [...v, x]));
  const c = (x: A) => (has(x) ? 'choice chosen' : 'choice');
  const ready =
    (has('person') || has('scheduled')) &&
    (has('read') || has('write')) &&
    (has('review') || has('system'));

  if (started) {
    return (
      <main>
        <header className="compact">
          <button className="brand" onClick={() => setStarted(false)}>
            <i>///</i> UTOPIA STUDIO
          </button>
          <nav>
            <button className="on">Framework</button>
          </nav>
        </header>
        <BuildFlow rec={rec} answers={a} />
      </main>
    );
  }

  return (
    <main>
      <header>
        <button className="brand" onClick={() => setRegistry(false)}>
          <i>///</i> UTOPIA STUDIO
        </button>
        <nav>
          <button className={!registry ? 'on' : ''} onClick={() => setRegistry(false)}>
            Framework
          </button>
          <button className={registry ? 'on' : ''} onClick={() => setRegistry(true)}>
            Agents registry
          </button>
          <button>Learnings</button>
        </nav>
        <div className="header-actions">
          <a
            className="link"
            href="/api/skills-zip"
            title="Downloads a zip pinned to the current commit on main — a fixed snapshot, not a moving branch"
          >
            ↓ Download the skills
          </a>
          <button className="link" onClick={() => setRegistry(false)}>
            I want an agent →
          </button>
        </div>
      </header>

      <section className="hero">
        <label>THE UTOPIA STUDIO · AGENTS</label>
        <div>
          <article>
            <h1>
              {registry
                ? 'THE AGENTS ALREADY\nIN THE STUDIO.'
                : 'YOU WANT AN AGENT.\nSTART WITH THE JOB.'}
            </h1>
            <p>
              {registry
                ? 'Every live agent has an owner, a purpose, an evaluation plan, and a visible record.'
                : 'You do not need to choose a stack first. Tell us what needs to happen; the framework finds the smallest reliable path.'}
            </p>
          </article>
          <aside className="hero-aside">
            <span className="hero-aside-num">01</span>
            <p className="hero-aside-title">{registry ? 'OPERATE WITH EVIDENCE' : 'ROUTE BEFORE YOU BUILD'}</p>
            <p className="hero-aside-sub">{registry ? 'owned · evaluated · observable' : 'autonomy is earned, not assumed'}</p>
          </aside>
        </div>
      </section>

      {registry ? (
        <Registry />
      ) : (
        <Intake a={a} c={c} choose={choose} rec={rec} start={() => setStarted(true)} ready={ready} has={has} />
      )}

      {!registry && (
        <>
          <section className="path">
            <label>THE BUILD PATH</label>
            <div className="path-grid">
              {steps.map((x) => (
                <article key={x[0]}>
                  <b>{x[0]}</b>
                  <h3>{x[1]}</h3>
                  <p>{x[2]}</p>
                </article>
              ))}
            </div>
          </section>

          <ToolsFooter />
        </>
      )}
    </main>
  );
}

function Intake({
  a,
  c,
  choose,
  rec,
  start,
  ready,
  has,
}: {
  a: A[];
  c: (x: A) => string;
  choose: (x: A) => void;
  rec: string[];
  start: () => void;
  ready: boolean;
  has: (x: A) => boolean;
}) {
  return (
    <section className="section">
      <label>START HERE</label>
      <h2>WHAT DO YOU ACTUALLY NEED?</h2>
      <div className="intake">
        <div className="qs">
          <Q n="01" t="Who starts it?">
            <button className={c('person')} onClick={() => choose('person')}>
              A person kicks it off
            </button>
            <button className={c('scheduled')} onClick={() => choose('scheduled')}>
              It runs on its own
              <br />
              schedule or event
            </button>
          </Q>
          <Q n="02" t="What does it touch?">
            <button className={c('read')} onClick={() => choose('read')}>
              Reads and drafts
            </button>
            <button className={c('write')} onClick={() => choose('write')}>
              Writes to live systems
            </button>
          </Q>
          <Q n="03" t="Who checks the output?">
            <button className={c('review')} onClick={() => choose('review')}>
              A human reads it first
            </button>
            <button className={c('system')} onClick={() => choose('system')}>
              It feeds another system
            </button>
          </Q>
        </div>
        <aside className="rec">
          <label>YOUR PATH</label>
          <b>{rec[0]}</b>
          <h3>{rec[1]}</h3>
          <p>{rec[2]}</p>
          {PATH_EXAMPLES[rec[1] as keyof typeof PATH_EXAMPLES] && (
            <div className="rec-example">
              <span className="rec-example-label">Example agent</span>
              <strong>{PATH_EXAMPLES[rec[1] as keyof typeof PATH_EXAMPLES].name}</strong>
              <em>{PATH_EXAMPLES[rec[1] as keyof typeof PATH_EXAMPLES].owner} · {PATH_EXAMPLES[rec[1] as keyof typeof PATH_EXAMPLES].status}</em>
              <p>{PATH_EXAMPLES[rec[1] as keyof typeof PATH_EXAMPLES].summary}</p>
            </div>
          )}
          <button className="solid" onClick={start} disabled={!ready}>
            Start the build path →
          </button>
          <small>
            {[
              (has('person') || has('scheduled')) && 'trigger',
              (has('read') || has('write')) && 'surface',
              (has('review') || has('system')) && 'output',
            ].filter(Boolean).length}{' '}
            of 3 decisions recorded
          </small>
        </aside>
      </div>
    </section>
  );
}

function Registry() {
  return (
    <section className="section">
      <label>REGISTRY</label>
      <h2>BUILT TO BE SEEN.</h2>
      <div className="list">
        {agents.map((x) => (
          <article key={x[0]}>
            <h3>{x[0]}</h3>
            <p>{x[1]}</p>
            <span>{x[2]}</span>
            <button>→</button>
          </article>
        ))}
      </div>
    </section>
  );
}

function Q(p: { n: string; t: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend>
        <b>{p.n}</b>
        {p.t}
      </legend>
      <div>{p.children}</div>
    </fieldset>
  );
}
