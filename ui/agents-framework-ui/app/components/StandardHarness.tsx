'use client';

import { useEffect, useState } from 'react';

type ScenarioId = 'normal' | 'offline' | 'crash' | 'memory';
type Tone = 'safe' | 'caught';

const STEPS = [
  { n: '1', kind: 'GATE', name: 'Can it start?', plain: 'Preflight services.', detail: 'Fail closed if offline.' },
  { n: '2', kind: 'PLAN', name: 'Can it resume?', plain: 'Save the sequence.', detail: 'Fresh process reloads state.' },
  { n: '3', kind: 'AI', name: 'One decision', plain: 'Bounded model call.', detail: 'Code owns the loop.' },
  { n: '4', kind: 'STORE', name: 'Record it', plain: 'Append events.', detail: 'Audit outside the process.' },
  { n: '5', kind: 'MEMORY', name: 'Save memory', plain: 'Code writes updates.', detail: 'No silent memory claims.' },
  { n: '6', kind: 'CHECK', name: 'Read it back', plain: 'Freshness check.', detail: 'Stale notes fail.' },
  { n: '7', kind: 'REVIEW', name: 'Judge the run', plain: 'Separate checker.', detail: 'Generator never self-passes.' },
] as const;

const SCENARIOS: Record<ScenarioId, {
  label: string;
  eyebrow: string;
  lead: string;
  path: number[];
  tone: Tone;
  result: string;
}> = {
  normal: {
    label: 'Normal', eyebrow: 'PASS',
    lead: 'Full run.',
    path: [0, 1, 2, 3, 4, 5, 6], tone: 'safe',
    result: 'Safe finish.',
  },
  offline: {
    label: 'Offline', eyebrow: 'STOP',
    lead: 'Services unreachable.',
    path: [0], tone: 'caught',
    result: 'Stopped cleanly.',
  },
  crash: {
    label: 'Crash', eyebrow: 'RESUME',
    lead: 'Process dies mid-run.',
    path: [0, 1, 2, 3, 1, 3, 4, 5, 6], tone: 'safe',
    result: 'Resumed from saved state.',
  },
  memory: {
    label: 'Stale memory', eyebrow: 'CATCH',
    lead: 'Memory write never landed.',
    path: [0, 1, 2, 3, 4, 5], tone: 'caught',
    result: 'Blocked on read-back.',
  },
};

const PROVEN = [
  ['12/12', 'recovery'],
  ['41h', 'unattended'],
  ['$0.19', 'under $3 cap'],
];

export default function StandardHarness() {
  const [scenario, setScenario] = useState<ScenarioId>('normal');
  const [position, setPosition] = useState(0);
  const [running, setRunning] = useState(false);
  const [inspectedStep, setInspectedStep] = useState<number | null>(null);
  const current = SCENARIOS[scenario];
  const activeStep = inspectedStep ?? current.path[position];
  const complete = position === current.path.length - 1 && !running && inspectedStep === null;
  const completedSteps = new Set(current.path.slice(0, position));

  const play = (next: ScenarioId = scenario) => {
    setScenario(next);
    setPosition(0);
    setInspectedStep(null);
    setRunning(SCENARIOS[next].path.length > 1);
  };

  useEffect(() => {
    if (!running || position >= current.path.length - 1) return;
    const timer = window.setTimeout(() => {
      setPosition((value) => {
        const next = value + 1;
        if (next >= current.path.length - 1) setRunning(false);
        return next;
      });
    }, 760);
    return () => window.clearTimeout(timer);
  }, [current.path.length, position, running]);

  return (
    <section className="standard standard--visual" id="harness">
      <div className="harness-title-row">
        <div className="standard-heading">
          <label>HARNESS</label>
          <h2>What keeps a run safe.</h2>
        </div>
        <div className="harness-legend" aria-label="Legend">
          <span><i className="legend-dot legend-dot--guard" /> guard</span>
          <span><i className="legend-dot legend-dot--ai" /> model</span>
          <span><i className="legend-dot legend-dot--proof" /> proof</span>
        </div>
      </div>

      <div className="harness-story">
        <div className="harness-story-head">
          <div>
            <span className="harness-kicker">{current.eyebrow}</span>
            <h3>{current.lead}</h3>
          </div>
          <button className="harness-replay" onClick={() => play()} aria-label="Replay this scenario">↻ Replay</button>
        </div>

        <div className="harness-scenarios" role="group" aria-label="Choose a failure scenario">
          {(Object.keys(SCENARIOS) as ScenarioId[]).map((id) => (
            <button key={id} className={scenario === id ? 'scenario-button is-selected' : 'scenario-button'}
              onClick={() => play(id)} aria-pressed={scenario === id}>{SCENARIOS[id].label}</button>
          ))}
        </div>

        <div className="harness-circuit" aria-label="Seven parts of the agent harness">
          <span className="circuit-input">WAKE-UP / REQUEST</span>
          {STEPS.map((step, index) => {
            const active = index === activeStep;
            const done = completedSteps.has(index) || (complete && current.path.includes(index) && !active);
            const caught = complete && current.tone === 'caught' && index === activeStep;
            return (
              <button key={step.n} className={['harness-node', `harness-node--${index + 1}`, active ? 'is-active' : '', done ? 'is-done' : '', caught ? 'is-caught' : ''].filter(Boolean).join(' ')}
                onClick={() => { setRunning(false); setInspectedStep(index); }} aria-current={active ? 'step' : undefined}>
                <span className="node-top"><b>{step.n}</b><em>{step.kind}</em></span>
                <strong>{step.name}</strong>
                <span>{step.plain}</span>
              </button>
            );
          })}
          <span className="circuit-output">RELEASE / BLOCK</span>
        </div>

        <div className={complete ? `harness-inspector is-${current.tone}` : 'harness-inspector'} aria-live="polite">
          <div className="inspector-status">
            <span>{complete ? current.tone === 'caught' ? 'PROBLEM CAUGHT' : 'SAFE FINISH' : running ? `STEP ${position + 1} OF ${current.path.length}` : 'SELECTED GUARD'}</span>
            <b>{complete ? current.result : STEPS[activeStep].name}</b>
          </div>
          <p>{complete ? 'The run leaves a result that another process and reviewer can verify.' : STEPS[activeStep].detail}</p>
          {!running && !complete && <button onClick={() => play()}>Play this scenario →</button>}
        </div>
      </div>

      <div className="harness-proof-strip">
        {PROVEN.map(([figure, what]) => (
          <article key={what}><b>{figure}</b><strong>{what}</strong></article>
        ))}
        <a className="btn-download" href="https://github.com/The-Utopia-Studio/studio-agent-framework/tree/main/long-horizon" target="_blank" rel="noreferrer"><span aria-hidden="true">→</span><span>Evidence</span></a>
      </div>
    </section>
  );
}
