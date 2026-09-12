'use client';

import { useState } from 'react';
import BuildFlow from './components/BuildFlow';
import JourneyGuide, { type JourneyKind } from './components/JourneyGuide';
import Learnings from './components/Learnings';
import StandardHarness from './components/StandardHarness';
import ToolsFooter from './components/ToolsFooter';

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
  journey?: JourneyKind;
};

const safeDefaults: A[] = ['person', 'read', 'review', 'no-memory'];
const presets: Preset[] = [
  {
    name: 'Research brief',
    job: 'Weekly one-page research briefing for the Studio team.',
    owner: 'Research lead',
    answers: ['person', 'read', 'review', 'no-memory'],
    audience: 'internal-team',
    runtimeHome: 'local',
    journey: 'agent',
  },
  {
    name: 'Founder follow-up',
    job: 'Draft follow-up and update CRM after founder calls.',
    owner: 'Growth lead',
    answers: ['scheduled', 'write', 'review', 'memory'],
    audience: 'internal-team',
    runtimeHome: 'utopia-os',
    journey: 'agent',
  },
  {
    name: 'Domain operator',
    job: 'Durable niche workflow with approval before irreversible writes.',
    owner: 'Domain lead',
    answers: ['scheduled', 'write', 'system', 'memory'],
    audience: 'internal-team',
    runtimeHome: 'standalone',
    journey: 'domain',
  },
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
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 74, behavior: 'smooth' });
  };

  const has = (x: A) => a.includes(x);
  const rec: [string, string] = (() => {
    if (journey === 'domain' || audience === 'privileged-admin' || (has('scheduled') && has('write') && has('system')))
      return ['04', 'Coded agent'];
    if (has('scheduled') || has('write')) return ['03', 'Managed surface'];
    if (has('memory')) return ['02', 'Project'];
    return ['01', 'Skill'];
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
  const ready = Boolean(job.trim() && owner.trim());

  const openBuild = () => {
    if (!ready) {
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
    if (preset.journey) setJourney(preset.journey);
  };

  const selectJourney = (kind: JourneyKind) => {
    setJourney(kind);
    if (kind === 'domain') {
      setA(['scheduled', 'write', 'system', 'memory']);
      setRuntimeHome('standalone');
    }
    requestAnimationFrame(() => toIntake());
  };

  if (started) {
    return (
      <main>
        <header>
          <button className="brand" onClick={() => setStarted(false)}><i>{'///'}</i> UTOPIA STUDIO</button>
          <button className="nav-tab" onClick={() => setStarted(false)}>← Edit</button>
        </header>
        <BuildFlow rec={[rec[0], rec[1], '']} answers={a} audience={audience} runtimeHome={runtimeHome} job={job} owner={owner} />
      </main>
    );
  }

  return (
    <main>
      <header>
        <button className="brand" onClick={() => { setView('home'); window.scrollTo(0, 0); }}><i>{'///'}</i> UTOPIA STUDIO</button>
        <div className="header-actions">
          <button className="nav-tab" aria-current={view === 'home'} onClick={() => { setView('home'); window.scrollTo(0, 0); }}>Build</button>
          <button className="nav-tab" aria-current={view === 'learnings'} onClick={() => { setView('learnings'); window.scrollTo(0, 0); }}>Learnings</button>
          <a className="nav-tab" href="/api/skills-zip?bundle=claude-single-skill-v3">Download</a>
          {view === 'home' && (
            <button className="solid compact" onClick={openBuild} disabled={!ready}>
              Review →
            </button>
          )}
        </div>
      </header>

      {view === 'learnings' && <Learnings />}

      {view === 'home' && (
        <>
          <JourneyGuide selected={journey} onSelect={selectJourney} />
          <Intake
            job={job} setJob={setJob} owner={owner} setOwner={setOwner}
            c={c} choose={choose} rec={rec} start={() => setStarted(true)}
            has={has} audience={audience} setAudience={setAudience}
            runtimeHome={runtimeHome} setRuntimeHome={setRuntimeHome}
            completed={completed} ready={ready} applyPreset={applyPreset} journey={journey}
          />
          <StandardHarness />
          <ToolsFooter />
        </>
      )}
    </main>
  );
}

function Intake({
  job, setJob, owner, setOwner, c, choose, rec, start, has, audience, setAudience,
  runtimeHome, setRuntimeHome, completed, ready, applyPreset, journey,
}: {
  job: string; setJob: (value: string) => void; owner: string; setOwner: (value: string) => void;
  c: (x: A) => string; choose: (x: A) => void; rec: string[]; start: () => void;
  has: (x: A) => boolean; audience: Audience; setAudience: (audience: Audience) => void;
  runtimeHome: RuntimeHome; setRuntimeHome: (home: RuntimeHome) => void;
  completed: number; ready: boolean; applyPreset: (preset: Preset) => void;
  journey: JourneyKind;
}) {
  return (
    <section className="section builder" id="intake">
      <div className="builder-intro">
        <div>
          <label>{journey === 'domain' ? 'DOMAIN' : 'BRIEF'}</label>
          <h2>{journey === 'domain' ? 'Describe the niche.' : 'Describe the job.'}</h2>
        </div>
        <div className="builder-progress" aria-label={`${completed} of 8`}>
          <span>{completed}/8</span>
          <div><i style={{ width: `${(completed / 8) * 100}%` }} /></div>
        </div>
      </div>

      <div className="preset-row" aria-label="Examples">
        {presets.map((preset) => (
          <button key={preset.name} type="button" onClick={() => applyPreset(preset)}>{preset.name}</button>
        ))}
      </div>

      <div className="intake">
        <div className="qs">
          <Q n="01" t="Job">
            <input className="guided-input" value={job} onChange={(e) => setJob(e.target.value)} placeholder="What should it produce?" />
          </Q>
          <Q n="02" t="Owner">
            <input className="guided-input" value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Who owns it?" />
          </Q>
          <Q n="03" t="Starts">
            <button type="button" aria-pressed={has('person')} className={c('person')} onClick={() => choose('person')}>Person</button>
            <button type="button" aria-pressed={has('scheduled')} className={c('scheduled')} onClick={() => choose('scheduled')}>Schedule / event</button>
          </Q>
          <Q n="04" t="Writes">
            <button type="button" aria-pressed={has('read')} className={c('read')} onClick={() => choose('read')}>Read only</button>
            <button type="button" aria-pressed={has('write')} className={c('write')} onClick={() => choose('write')}>Can change systems</button>
          </Q>
          <Q n="05" t="Checks">
            <button type="button" aria-pressed={has('review')} className={c('review')} onClick={() => choose('review')}>Human review</button>
            <button type="button" aria-pressed={has('system')} className={c('system')} onClick={() => choose('system')}>System consumes</button>
          </Q>
          <Q n="06" t="Memory">
            <button type="button" aria-pressed={has('no-memory')} className={c('no-memory')} onClick={() => choose('no-memory')}>Fresh each run</button>
            <button type="button" aria-pressed={has('memory')} className={c('memory')} onClick={() => choose('memory')}>Keeps history</button>
          </Q>
          <Q n="07" t="Audience">
            <button type="button" className={audience === 'internal-team' ? 'choice chosen' : 'choice'} onClick={() => setAudience('internal-team')}>Internal</button>
            <button type="button" className={audience === 'fellow-scoped' ? 'choice chosen' : 'choice'} onClick={() => setAudience('fellow-scoped')}>Per fellow</button>
            <button type="button" className={audience === 'public' ? 'choice chosen' : 'choice'} onClick={() => setAudience('public')}>Public</button>
            <button type="button" className={audience === 'privileged-admin' ? 'choice chosen' : 'choice'} onClick={() => setAudience('privileged-admin')}>Admin</button>
          </Q>
          <Q n="08" t="Home">
            <button type="button" className={runtimeHome === 'utopia-os' ? 'choice chosen' : 'choice'} onClick={() => setRuntimeHome('utopia-os')}>Utopia OS</button>
            <button type="button" className={runtimeHome === 'standalone' ? 'choice chosen' : 'choice'} onClick={() => setRuntimeHome('standalone')}>Own app</button>
            <button type="button" className={runtimeHome === 'local' ? 'choice chosen' : 'choice'} onClick={() => setRuntimeHome('local')}>Local</button>
          </Q>
        </div>

        <aside className="rec" aria-live="polite">
          <label>PATH</label>
          <b>{rec[0]}</b>
          <h3>{rec[1]}</h3>
          <button className="solid" onClick={start} disabled={!ready}>
            {ready ? 'Review →' : 'Add job + owner'}
          </button>
        </aside>
      </div>
    </section>
  );
}

function Q(p: { n: string; t: string; children: React.ReactNode }) {
  return <fieldset><legend><b>{p.n}</b>{p.t}</legend><div className="question-options">{p.children}</div></fieldset>;
}
