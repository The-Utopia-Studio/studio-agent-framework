'use client';

import { useEffect, useState } from 'react';

type ScenarioId = 'normal' | 'offline' | 'crash' | 'memory';
type Tone = 'safe' | 'caught';

const STEPS = [
  { n: '1', kind: 'GATE', name: 'Can it start?', plain: 'Check every service before work begins.', detail: 'No internet becomes a clean offline result. The agent never half-starts.' },
  { n: '2', kind: 'PLAN', name: 'Can work resume?', plain: 'Save the known sequence when losing progress matters.', detail: 'After a crash, a fresh process reloads the workflow instead of guessing where it was.' },
  { n: '3', kind: 'AI', name: 'Make one decision', plain: 'Give the model one bounded judgement.', detail: 'Code owns the predictable control flow. The model decides only the part that needs judgement.' },
  { n: '4', kind: 'STORE', name: 'Record what happened', plain: 'Write events outside the running process.', detail: 'A fresh process and an independent reviewer can inspect the same durable record.' },
  { n: '5', kind: 'MEMORY', name: 'Save useful memory', plain: 'Code writes the approved update after the work.', detail: 'The agent cannot claim it remembered something without actually storing it.' },
  { n: '6', kind: 'CHECK', name: 'Verify the memory', plain: 'Read it back and check freshness.', detail: 'A full-looking note still fails if the expected content or timestamp did not change.' },
  { n: '7', kind: 'REVIEW', name: 'Judge the run', plain: 'A separate check decides whether it passed.', detail: 'The generator never marks its own work. Failed evidence blocks release.' },
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
    label: 'Normal run', eyebrow: 'EVERY GUARD PASSES',
    lead: 'Watch one complete run from wake-up to independent review.',
    path: [0, 1, 2, 3, 4, 5, 6], tone: 'safe',
    result: 'Safe finish — the output, state, memory, and review evidence agree.',
  },
  offline: {
    label: 'No internet', eyebrow: 'STOP BEFORE WORK',
    lead: 'The agent wakes while its required services are unreachable.',
    path: [0], tone: 'caught',
    result: 'Stopped safely — recorded as offline, with no half-finished work.',
  },
  crash: {
    label: 'Process crashes', eyebrow: 'RESUME FROM DURABLE STATE',
    lead: 'The process dies after recording progress, then starts again fresh.',
    path: [0, 1, 2, 3, 1, 3, 4, 5, 6], tone: 'safe',
    result: 'Recovered — the workflow resumed from its saved position without repeating the action.',
  },
  memory: {
    label: 'Memory goes stale', eyebrow: 'CATCH A QUIET FAILURE',
    lead: 'The run looks healthy, but the expected memory update never landed.',
    path: [0, 1, 2, 3, 4, 5], tone: 'caught',
    result: 'Caught — read-back and freshness checks block the stale result.',
  },
};

const PROVEN = [
  ['12 / 12', 'recovery checks passed', 'Crash, resume, and duplicate-action cases.'],
  ['41 h', 'ran unattended', 'Across three laptop sleep boundaries.'],
  ['$0.19', 'spent under a $3 cap', 'The budget guard stopped further work.'],
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
          <label>03 · THE STANDARD HARNESS</label>
          <h2>SEE WHAT KEEPS AN AGENT SAFE.</h2>
        </div>
        <p className="standard-intro">
          The model makes one bounded decision. The harness checks before it, records after it,
          and stops or recovers the run when something goes wrong.
        </p>
        <div className="harness-legend" aria-label="Diagram legend">
          <span><i className="legend-dot legend-dot--guard" /> guard</span>
          <span><i className="legend-dot legend-dot--ai" /> AI decision</span>
          <span><i className="legend-dot legend-dot--proof" /> evidence</span>
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
        <div className="proof-strip-intro">
          <label>TESTED AGAINST REAL FAILURES</label>
          <p>The diagram reflects observed recovery, unattended operation, and budget evidence.</p>
        </div>
        {PROVEN.map(([figure, what, how]) => (
          <article key={what}><b>{figure}</b><div><strong>{what}</strong><span>{how}</span></div></article>
        ))}
        <a className="btn-download" href="https://github.com/The-Utopia-Studio/studio-agent-framework/tree/main/long-horizon" target="_blank" rel="noreferrer"><span aria-hidden="true">→</span><span>See evidence</span></a>
      </div>
    </section>
  );
}
