'use client';

import { useMemo, useState } from 'react';
import BuildFlow from './components/BuildFlow';
import Learnings from './components/Learnings';
import StandardHarness from './components/StandardHarness';
import ToolsFooter from './components/ToolsFooter';
import { PATH_EXAMPLES } from './data/tools';

type A = 'person' | 'scheduled' | 'read' | 'write' | 'review' | 'system';
type Audience = 'internal-team' | 'fellow-scoped' | 'public' | 'privileged-admin';
type RuntimeHome = 'utopia-os' | 'standalone' | 'local';
type View = 'home' | 'learnings';

const steps = [
  ['01', 'INTAKE', 'A short interview routes the request.'],
  ['02', 'DESIGN', 'Role, tools, memory, and boundaries.'],
  ['03', 'PROVE FIRST', 'Golden cases before anything is built.'],
  ['04', 'PRD & WORK ORDERS', 'A gated plan with named checks.'],
  ['05', 'BUILD ON THE HARNESS', 'Mastra + Convex. Live only when doctor is green.'],
];

export default function Home() {
  const [a, setA] = useState<A[]>([]);
  const [started, setStarted] = useState(false);
  const [view, setView] = useState<View>('home');
  const [audience, setAudience] = useState<Audience | null>(null);
  const [runtimeHome, setRuntimeHome] = useState<RuntimeHome | null>(null);

  // Offset by the 74px sticky header, which scrollIntoView would otherwise scroll underneath.
  const toIntake = () => {
    const el = document.getElementById('intake');
    if (!el) return;
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 74);
  };

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
        <header>
          <button className="brand" onClick={() => setStarted(false)}>
            <i>///</i> UTOPIA STUDIO
          </button>
        </header>
        <BuildFlow rec={rec} answers={a} audience={audience} runtimeHome={runtimeHome} />
      </main>
    );
  }

  return (
    <main>
      <header>
        <button
          className="brand"
          onClick={() => {
            setView('home');
            window.scrollTo(0, 0);
          }}
        >
          <i>///</i> UTOPIA STUDIO
        </button>
        <div className="header-actions">
          <button
            className="nav-tab"
            aria-current={view === 'home'}
            onClick={() => {
              setView('home');
              window.scrollTo(0, 0);
            }}
          >
            Framework
          </button>
          <button
            className="nav-tab"
            aria-current={view === 'learnings'}
            onClick={() => {
              setView('learnings');
              window.scrollTo(0, 0);
            }}
          >
            Learnings
          </button>
          {view === 'home' && (
            <button className="solid compact" onClick={toIntake}>
              I want an agent →
            </button>
          )}
        </div>
      </header>

      {view === 'learnings' && <Learnings />}

      {view === 'home' && (
        <>
      <section className="hero">
        <label>THE UTOPIA STUDIO · AGENTS</label>
        <div>
          <article>
            <h1>{'YOU WANT AN AGENT.\nSTART WITH THE JOB.'}</h1>
            <p>
              You do not need to choose a stack first. Tell us what needs to happen; the framework
              finds the smallest reliable path.
            </p>
          </article>
          <aside className="hero-aside">
            <span className="hero-aside-num">01</span>
            <p className="hero-aside-title">ROUTE BEFORE YOU BUILD</p>
            <p className="hero-aside-sub">autonomy is earned, not assumed</p>
            <a
              className="btn-download"
              href="/api/skills-zip?bundle=claude-single-skill-v3"
              aria-label="Download the Claude-ready framework skill"
              title="One Claude-uploadable skill ZIP: one top-level folder and one SKILL.md, with the seven stage instructions and linked evidence inside."
            >
              <span className="btn-download-arrow" aria-hidden="true">
                ↓
              </span>
              <span>Download for Claude</span>
            </a>
          </aside>
        </div>
      </section>

      <Intake a={a} c={c} choose={choose} rec={rec} start={() => setStarted(true)} ready={ready && !!audience && !!runtimeHome} has={has} audience={audience} setAudience={setAudience} runtimeHome={runtimeHome} setRuntimeHome={setRuntimeHome} />

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

      <StandardHarness />

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
  audience,
  setAudience,
  runtimeHome,
  setRuntimeHome,
}: {
  a: A[];
  c: (x: A) => string;
  choose: (x: A) => void;
  rec: string[];
  start: () => void;
  ready: boolean;
  has: (x: A) => boolean;
  audience: Audience | null;
  setAudience: (audience: Audience) => void;
  runtimeHome: RuntimeHome | null;
  setRuntimeHome: (home: RuntimeHome) => void;
}) {
  return (
    <section className="section" id="intake">
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
          <Q n="04" t="Who is it for?">
            <button className={audience === 'internal-team' ? 'choice chosen' : 'choice'} onClick={() => setAudience('internal-team')}>
              Internal team
              <br />named team access
            </button>
            <button className={audience === 'fellow-scoped' ? 'choice chosen' : 'choice'} onClick={() => setAudience('fellow-scoped')}>
              Fellow-facing
              <br />strict per-fellow boundary
            </button>
            <button className={audience === 'public' ? 'choice chosen' : 'choice'} onClick={() => setAudience('public')}>
              Public
              <br />public data only
            </button>
          </Q>
          <Q n="05" t="Where will it run?">
            <button className={runtimeHome === 'utopia-os' ? 'choice chosen' : 'choice'} onClick={() => setRuntimeHome('utopia-os')}>
              Utopia OS
            </button>
            <button className={runtimeHome === 'standalone' ? 'choice chosen' : 'choice'} onClick={() => setRuntimeHome('standalone')}>
              Standalone app
            </button>
            <button className={runtimeHome === 'local' ? 'choice chosen' : 'choice'} onClick={() => setRuntimeHome('local')}>
              Local / managed
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
              audience && 'audience',
              runtimeHome && 'runtime',
            ].filter(Boolean).length}{' '}
            of 5 decisions recorded
          </small>
        </aside>
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
