'use client';

import { useEffect, useState } from 'react';

type ScenarioId = 'normal' | 'offline' | 'memory';

const STEPS = [
  ['1', 'CHECK THE WEATHER', 'Before it works, the agent checks that the services it needs are reachable.', 'A bad connection becomes “offline”, not a mysterious failure.'],
  ['2', 'KEEP THE PLAN', 'For work that cannot be safely lost, a workflow holds the known sequence.', 'Only needed when losing work mid-flight would matter.'],
  ['3', 'MAKE ONE JUDGEMENT', 'The AI decides one bounded thing, such as what to do next.', 'The model is not allowed to invent the whole control flow.'],
  ['4', 'WRITE DOWN WHAT HAPPENED', 'Important events go into durable storage, outside the running process.', 'A fresh process can understand what happened before it started.'],
  ['5', 'UPDATE ITS NOTES', 'If the agent needs memory, code saves the useful update after the work.', 'The agent cannot merely say that it remembered something.'],
  ['6', 'CHECK THE NOTES CHANGED', 'The harness checks the timestamp, not the amount of text.', 'A note can look healthy while quietly becoming stale.'],
  ['7', 'REVIEW THE RUN', 'Afterward, a separate check grades what the agent did.', 'The agent does not mark its own homework.'],
] as const;

const SCENARIOS: Record<ScenarioId, { label: string; lead: string; start: number; stopAt?: number; result: string }> = {
  normal: { label: 'Watch a normal run', lead: 'A scheduled agent wakes up, does its job, and leaves evidence behind.', start: 0, result: 'Done — the run is recorded and can be checked later.' },
  offline: { label: 'No internet', lead: 'It wakes up during a laptop sleep, before the network is ready.', start: 0, stopAt: 0, result: 'Stopped safely — recorded as offline. No half-started work and no false alarm.' },
  memory: { label: 'Memory goes stale', lead: 'Everything looks fine, but the agent has quietly stopped updating its notes.', start: 4, stopAt: 5, result: 'Caught — freshness sees an old timestamp, even if the notes still look full.' },
};

const PROVEN = [
  ['12 / 12', 'recovery tests passed', 'A killed process resumed without repeating its action.'],
  ['41 h', 'ran unattended', 'Across three real laptop sleep boundaries.'],
  ['$0.19', 'spent under a $3 cap', 'The guard can stop the agent by itself.'],
];

export default function StandardHarness() {
  const [scenario, setScenario] = useState<ScenarioId>('normal');
  const [activeStep, setActiveStep] = useState(0);
  const [running, setRunning] = useState(false);
  const current = SCENARIOS[scenario];
  const finalStep = current.stopAt ?? STEPS.length - 1;
  const complete = activeStep === finalStep && !running;

  const play = (next: ScenarioId = scenario) => {
    const nextScenario = SCENARIOS[next];
    const nextFinalStep = nextScenario.stopAt ?? STEPS.length - 1;
    setScenario(next);
    setActiveStep(nextScenario.start);
    setRunning(nextScenario.start < nextFinalStep);
  };

  useEffect(() => {
    if (!running || activeStep >= finalStep) return;
    const timer = window.setTimeout(() => {
      const nextStep = activeStep + 1;
      setActiveStep(nextStep);
      if (nextStep >= finalStep) setRunning(false);
    }, 720);
    return () => window.clearTimeout(timer);
  }, [activeStep, finalStep, running]);

  return (
    <section className="standard" id="harness">
      <div className="standard-heading">
        <label>03 · THE STANDARD HARNESS</label>
        <h2>THE SAFETY SYSTEM UNDER AN AGENT.</h2>
        <p className="standard-intro">An agent makes a judgement. A harness is everything around it that makes that judgement safe to run while nobody is watching.</p>
      </div>

      <div className="harness-playground">
        <div className="harness-playground-head">
          <div><span className="harness-kicker">FOLLOW ONE RUN</span><h3>{current.lead}</h3></div>
          <button className="harness-replay" onClick={() => play()} aria-label="Replay this run">↻ Replay</button>
        </div>
        <div className="harness-scenarios" role="group" aria-label="Choose a harness scenario">
          {(Object.keys(SCENARIOS) as ScenarioId[]).map((id) => <button key={id} className={scenario === id ? 'scenario-button is-selected' : 'scenario-button'} onClick={() => play(id)} aria-pressed={scenario === id}>{SCENARIOS[id].label}</button>)}
        </div>
        <ol className="harness-steps" aria-label="Seven harness steps">
          {STEPS.map(([n, name, plainEnglish, why], index) => {
            const state = index < activeStep ? 'is-done' : index === activeStep ? 'is-active' : '';
            const isStopped = complete && scenario !== 'normal' && index === finalStep;
            return <li key={n} className={`${state} ${isStopped ? 'is-caught' : ''}`}>
              <span className="step-dot" aria-hidden="true">{index < activeStep ? '✓' : n}</span>
              <button className="step-copy" onClick={() => setActiveStep(index)} aria-current={index === activeStep ? 'step' : undefined}>
                <strong>{name}</strong><span>{plainEnglish}</span>{index === activeStep && <em>{why}</em>}
              </button>
            </li>;
          })}
        </ol>
        <p className={complete ? `harness-result ${scenario === 'normal' ? 'is-success' : 'is-caught'}` : 'harness-result'} aria-live="polite">
          <b>{running ? 'Running…' : complete ? scenario === 'normal' ? '✓ Safe finish' : '✓ Problem caught' : 'Ready'}</b>
          <span>{running ? `Step ${activeStep + 1} is doing its job.` : complete ? current.result : 'Choose a story above to see what the harness protects.'}</span>
        </p>
      </div>

      <aside className="standard-proof">
        <label>NOT JUST A DIAGRAM</label><p className="proof-intro">This setup has been tested against real failures, not only happy paths.</p>
        {PROVEN.map(([fig, what, how]) => <article key={what} className="proof-row"><b>{fig}</b><strong>{what}</strong><span>{how}</span></article>)}
        <a className="btn-download" href="https://github.com/The-Utopia-Studio/studio-agent-framework/tree/main/long-horizon" target="_blank" rel="noreferrer"><span aria-hidden="true">→</span><span>See the evidence</span></a>
      </aside>
    </section>
  );
}
