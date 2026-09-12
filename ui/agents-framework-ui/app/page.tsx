'use client';

import { useState } from 'react';
import BuildFlow from './components/BuildFlow';
import JourneyGuide, { type JourneyKind } from './components/JourneyGuide';
import Learnings from './components/Learnings';
import StandardHarness from './components/StandardHarness';
import ToolsFooter from './components/ToolsFooter';
import { PATH_EXAMPLES } from './data/tools';

type A =
  | 'person'
  | 'scheduled'
  | 'read'
  | 'write'
  | 'review'
  | 'system'
  | 'memory'
  | 'no-memory';
type Audience = 'internal-team' | 'fellow-scoped' | 'public' | 'privileged-admin';
type RuntimeHome = 'utopia-os' | 'standalone' | 'local';
type View = 'home' | 'learnings';
type Preset = {
  name: string;
  job: string;
  owner: string;
  answers: A[];
  audience: Audience;
  runtimeHome: RuntimeHome;
};

const safeDefaults: A[] = ['person', 'read', 'review', 'no-memory'];
const presets: Preset[] = [
  {
    name: 'Research brief',
    job: 'Turn selected research sources into a weekly one-page briefing for the Studio team.',
    owner: 'Studio research lead',
    answers: ['person', 'read', 'review', 'no-memory'],
    audience: 'internal-team',
    runtimeHome: 'local',
  },
  {
    name: 'Founder follow-up',
    job: 'Draft a follow-up and update the CRM after every founder call.',
    owner: 'Growth lead',
    answers: ['scheduled', 'write', 'review', 'memory'],
    audience: 'internal-team',
    runtimeHome: 'utopia-os',
  },
  {
    name: 'Domain operator',
    job: 'Run a durable niche workflow with human approval before irreversible writes.',
    owner: 'Domain lead',
    answers: ['scheduled', 'write', 'system', 'memory'],
    audience: 'internal-team',
    runtimeHome: 'standalone',
  },
];

const steps = [
  ['01', 'UNDERSTAND', 'Capture the job once in plain language.'],
  ['02', 'CHOOSE THE PATH', 'Use the smallest setup that can do it safely.'],
  ['03', 'DEFINE GOOD', 'Agree on examples and failure cases before building.'],
  ['04', 'BUILD', 'Create the instructions, setup, or coded agent.'],
  ['05', 'VERIFY', 'Run its own checks before calling it ready.'],
];

export default function Home() {
  const [a, setA] = useState<A[]>(safeDefaults);
  const [job, setJob] = useState('');
  const [owner, setOwner] = useState('');
  const [started, setStarted] = useState(false);
  const [view, setView] = useState<View>('home');
  const [audience, setAudience] = useState<Audience>('internal-team');
  const [runtimeHome, setRuntimeHome] = useState<RuntimeHome>('local');
  const [journey, setJourney] = useState<JourneyKind>(null);

  const toIntake = () => {
    const el = document.getElementById('intake');
    if (!el) return;
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 74);
  };

  const has = (x: A) => a.includes(x);
  const rec: [string, string, string] = (() => {
    if (journey === 'domain' || audience === 'privileged-admin' || (has('scheduled') && has('write') && has('system')))
      return ['04', 'CODED AGENT', 'It needs its own controlled loop, durable history, and stronger release checks.'];
    if (has('scheduled') || has('write'))
      return ['03', 'MANAGED SURFACE', 'Use an existing platform for scheduling, approvals, and run visibility.'];
    if (has('memory'))
      return ['02', 'PROJECT', 'Keep standing instructions and reference files together without building a custom runtime.'];
    return ['01', 'SKILL', 'Package the procedure as instructions and examples that a person can run on demand.'];
  })();

  const choiceGroups: Record<A, A[]> = {
    person: ['person', 'scheduled'], scheduled: ['person', 'scheduled'],
    read: ['read', 'write'], write: ['read', 'write'],
    review: ['review', 'system'], system: ['review', 'system'],
    memory: ['memory', 'no-memory'], 'no-memory': ['memory', 'no-memory'],
  };
  const choose = (x: A) => setA((current) => [...current.filter((v) => !choiceGroups[x].includes(v)), x]);
  const c = (x: A) => (has(x) ? 'choice chosen' : 'choice');

  const completed = [
    job.trim(), owner.trim(), has('person') || has('scheduled'), has('read') || has('write'),
    has('review') || has('system'), has('memory') || has('no-memory'), audience, runtimeHome,
  ].filter(Boolean).length;
  const blockers = [
    !job.trim() && 'Describe the result you want the agent to produce.',
    !owner.trim() && 'Name the person responsible for its output and access.',
  ].filter(Boolean) as string[];
  const openBuild = () => {
    if (blockers.length > 0) {
      toIntake();
      return;
    }
    setStarted(true);
    window.scrollTo(0, 0);
  };

  const applyPreset = (preset: Preset) => {
    setJob(preset.job);
    setOwner(preset.owner);
    setA(preset.answers);
    setAudience(preset.audience);
    setRuntimeHome(preset.runtimeHome);
    if (preset.name === 'Domain operator') setJourney('domain');
  };

  const selectJourney = (kind: JourneyKind) => {
    setJourney(kind);
    if (kind === 'domain') {
      setA(['scheduled', 'write', 'system', 'memory']);
      setRuntimeHome('standalone');
    }
  };

  if (started) {
    return (
      <main>
        <header>
          <button className="brand" onClick={() => setStarted(false)}><i>{'///'}</i> UTOPIA STUDIO</button>
          <button className="nav-tab" onClick={() => setStarted(false)}>← Edit answers</button>
        </header>
        <BuildFlow rec={rec} answers={a} audience={audience} runtimeHome={runtimeHome} job={job} owner={owner} />
      </main>
    );
  }

  return (
    <main>
      <header>
        <button className="brand" onClick={() => { setView('home'); window.scrollTo(0, 0); }}><i>{'///'}</i> UTOPIA STUDIO</button>
        <div className="header-actions">
          <button className="nav-tab" aria-current={view === 'home'} onClick={() => { setView('home'); window.scrollTo(0, 0); }}>Builder</button>
          <button className="nav-tab" aria-current={view === 'learnings'} onClick={() => { setView('learnings'); window.scrollTo(0, 0); }}>Learnings</button>
          {view === 'home' && (
            <button className="solid compact" onClick={openBuild}>
              {blockers.length ? 'Build an agent →' : 'Review build brief →'}
            </button>
          )}
        </div>
      </header>

      {view === 'learnings' && <Learnings />}

      {view === 'home' && (
        <>
          <JourneyGuide selected={journey} onSelect={selectJourney} />
          <Intake job={job} setJob={setJob} owner={owner} setOwner={setOwner} c={c} choose={choose} rec={rec}
            start={() => setStarted(true)} has={has} audience={audience} setAudience={setAudience}
            runtimeHome={runtimeHome} setRuntimeHome={setRuntimeHome} completed={completed} blockers={blockers}
            applyPreset={applyPreset} journey={journey} />
          <section className="path">
            <label>WHAT HAPPENS AFTER YOUR BRIEF</label>
            <div className="path-grid">
              {steps.map((x) => <article key={x[0]}><b>{x[0]}</b><h3>{x[1]}</h3><p>{x[2]}</p></article>)}
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
  job, setJob, owner, setOwner, c, choose, rec, start, has, audience, setAudience,
  runtimeHome, setRuntimeHome, completed, blockers, applyPreset, journey,
}: {
  job: string; setJob: (value: string) => void; owner: string; setOwner: (value: string) => void;
  c: (x: A) => string; choose: (x: A) => void; rec: string[]; start: () => void;
  has: (x: A) => boolean; audience: Audience; setAudience: (audience: Audience) => void;
  runtimeHome: RuntimeHome; setRuntimeHome: (home: RuntimeHome) => void;
  completed: number; blockers: string[]; applyPreset: (preset: Preset) => void;
  journey: JourneyKind;
}) {
  const example = PATH_EXAMPLES[rec[1] as keyof typeof PATH_EXAMPLES];
  return (
    <section className="section builder" id="intake">
      <div className="builder-intro">
        <div>
          <label>{journey === 'domain' ? 'DOMAIN HARNESS BUILDER' : 'GUIDED AGENT BUILDER'}</label>
          <h1>
            {journey === 'domain'
              ? 'Describe the niche job. We’ll route you to a durable coded harness.'
              : 'Tell us the job. We’ll choose the right kind of agent.'}
          </h1>
          <p>
            {journey === 'domain'
              ? 'Domain harnesses usually need a controlled loop, human gates, and recovery proofs. Start safe: we will still refuse to overbuild when a simpler rung is enough.'
              : 'No technical setup is needed here. We start with safe defaults: a person starts it, it drafts rather than writes, a human reviews it, and it remembers nothing.'}
          </p>
        </div>
        <div className="builder-progress" aria-label={`${completed} of 8 decisions complete`}>
          <span>{completed} of 8 decisions</span>
          <div><i style={{ width: `${(completed / 8) * 100}%` }} /></div>
        </div>
      </div>

      <div className="preset-row" aria-label="Example agent briefs">
        <span>Try an example</span>
        {presets.map((preset) => <button key={preset.name} type="button" onClick={() => applyPreset(preset)}>{preset.name}</button>)}
      </div>

      <div className="builder-direct-download">
        <div>
          <strong>Want to build directly with the framework?</strong>
          <span>Download the complete skills, templates, schemas, harness, and checks.</span>
        </div>
        <a className="btn-download" href="/api/skills-zip?bundle=claude-single-skill-v3" aria-label="Download the agent-building framework">
          <span className="btn-download-arrow" aria-hidden="true">↓</span>
          <span>Download framework</span>
        </a>
      </div>

      <div className="intake">
        <div className="qs">
          <Q n="01" t="What should it produce?">
            <input className="guided-input" value={job} onChange={(e) => setJob(e.target.value)} placeholder="Example: Turn meeting notes into a follow-up email for founders" />
          </Q>
          <Q n="02" t="Who is responsible for it?">
            <input className="guided-input" value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="A person or team, such as Growth lead" />
          </Q>
          <Q n="03" t="How does it start?">
            <button type="button" aria-pressed={has('person')} className={c('person')} onClick={() => choose('person')}>A person asks it</button>
            <button type="button" aria-pressed={has('scheduled')} className={c('scheduled')} onClick={() => choose('scheduled')}>It starts on a schedule or event</button>
          </Q>
          <Q n="04" t="Can it change another system?">
            <button type="button" aria-pressed={has('read')} className={c('read')} onClick={() => choose('read')}>No, it only reads and drafts</button>
            <button type="button" aria-pressed={has('write')} className={c('write')} onClick={() => choose('write')}>Yes, it can make changes</button>
          </Q>
          <Q n="05" t="Who checks the result?">
            <button type="button" aria-pressed={has('review')} className={c('review')} onClick={() => choose('review')}>A person checks every result</button>
            <button type="button" aria-pressed={has('system')} className={c('system')} onClick={() => choose('system')}>Another system uses it directly</button>
          </Q>
          <Q n="06" t="Should it remember anything next time?">
            <button type="button" aria-pressed={has('no-memory')} className={c('no-memory')} onClick={() => choose('no-memory')}>No, each run starts fresh</button>
            <button type="button" aria-pressed={has('memory')} className={c('memory')} onClick={() => choose('memory')}>Yes, it needs approved history</button>
          </Q>
          <Q n="07" t="Who can use the information?">
            <button type="button" className={audience === 'internal-team' ? 'choice chosen' : 'choice'} onClick={() => setAudience('internal-team')}>Internal team</button>
            <button type="button" className={audience === 'fellow-scoped' ? 'choice chosen' : 'choice'} onClick={() => setAudience('fellow-scoped')}>Each fellow sees only their own</button>
            <button type="button" className={audience === 'public' ? 'choice chosen' : 'choice'} onClick={() => setAudience('public')}>Public information only</button>
            <button type="button" className={audience === 'privileged-admin' ? 'choice chosen' : 'choice'} onClick={() => setAudience('privileged-admin')}>Restricted administrator access</button>
          </Q>
          <Q n="08" t="Where should people use it?">
            <button type="button" className={runtimeHome === 'utopia-os' ? 'choice chosen' : 'choice'} onClick={() => setRuntimeHome('utopia-os')}>Inside Utopia OS</button>
            <button type="button" className={runtimeHome === 'standalone' ? 'choice chosen' : 'choice'} onClick={() => setRuntimeHome('standalone')}>Its own app</button>
            <button type="button" className={runtimeHome === 'local' ? 'choice chosen' : 'choice'} onClick={() => setRuntimeHome('local')}>On my computer or current tool</button>
          </Q>
        </div>

        <aside className="rec" aria-live="polite">
          <label>RECOMMENDED PATH</label>
          <b>{rec[0]}</b>
          <h3>{rec[1]}</h3>
          <p>{rec[2]}</p>
          {example && (
            <div className="rec-example">
              <span className="rec-example-label">What this can look like</span>
              <strong>{example.name}</strong>
              <p>{example.summary}</p>
            </div>
          )}
          <div className={blockers.length ? 'blocker-box' : 'ready-box'}>
            <strong>{blockers.length ? 'Before we can continue' : 'Your brief is ready'}</strong>
            {blockers.length ? <ul>{blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul> : <p>We have enough information to prepare the build path. You can change any answer later.</p>}
          </div>
          <button className="solid" onClick={start} disabled={blockers.length > 0}>Review my build brief →</button>
          <small>{completed} of 8 decisions recorded</small>
        </aside>
      </div>
    </section>
  );
}

function Q(p: { n: string; t: string; children: React.ReactNode }) {
  return <fieldset><legend><b>{p.n}</b>{p.t}</legend><div className="question-options">{p.children}</div></fieldset>;
}
