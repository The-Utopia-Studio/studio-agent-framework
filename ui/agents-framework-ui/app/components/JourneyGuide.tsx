'use client';

import { useId } from 'react';

export type JourneyKind = 'agent' | 'domain' | null;

type JourneyGuideProps = {
  selected: JourneyKind;
  onSelect: (kind: JourneyKind) => void;
};

const AGENT_STEPS = [
  { n: '01', title: 'Say the job', body: 'One sentence: what it produces, for whom.' },
  { n: '02', title: 'Answer eight questions', body: 'Start, write access, review, memory, audience, home.' },
  { n: '03', title: 'Take the lowest rung', body: 'Skill → project → managed → coded. Climb only when needed.' },
  { n: '04', title: 'Define good first', body: 'Examples, failures, and cost before implementation.' },
  { n: '05', title: 'Build & verify', body: 'PRD → files → working agent → observed checks.' },
];

const DOMAIN_STEPS = [
  { n: '01', title: 'Name the niche', body: 'The domain job that should become a durable intelligence.' },
  { n: '02', title: 'Run the build pipeline', body: 'Same “build” journey — exit with a manifest and eval contract.' },
  { n: '03', title: 'Copy mastra-harness', body: 'Workflow + suspend gates + Convex when the job must survive kills.' },
  { n: '04', title: 'Add domain judgment', body: 'Tools, fixtures, graders — keep the harness thin.' },
  { n: '05', title: 'Prove recovery', body: 'Your kill-test for this domain — don’t inherit the bake-off.' },
];

const PIPELINE = [
  'Intake',
  'Workflow',
  'Design',
  'Eval',
  'PRD',
  'Structure',
  'Implement',
  'Verify',
];

export default function JourneyGuide({ selected, onSelect }: JourneyGuideProps) {
  const titleId = useId();
  const steps = selected === 'domain' ? DOMAIN_STEPS : AGENT_STEPS;
  const heading =
    selected === 'domain'
      ? 'Domain harness journey'
      : selected === 'agent'
        ? 'Agent build journey'
        : 'Choose how you want to use the framework';

  return (
    <section className="journey" aria-labelledby={titleId}>
      <div className="journey-intro">
        <label>START HERE</label>
        <h2 id={titleId}>Two ways in. Same underlying system.</h2>
        <p>
          Use the guided builder for a single agent, or follow the domain path when you are
          standing up a niche intelligence on top of this framework.
        </p>
      </div>

      <div className="journey-cards" role="group" aria-label="Choose a starting journey">
        <button
          type="button"
          className={selected === 'agent' ? 'journey-card is-selected' : 'journey-card'}
          aria-pressed={selected === 'agent'}
          onClick={() => onSelect(selected === 'agent' ? null : 'agent')}
        >
          <span className="journey-card-kicker">PATH A</span>
          <strong>Build an agent</strong>
          <span>
            One job, smallest safe rung, clear brief. Best when a person or team needs a repeatable
            outcome.
          </span>
        </button>
        <button
          type="button"
          className={selected === 'domain' ? 'journey-card is-selected' : 'journey-card'}
          aria-pressed={selected === 'domain'}
          onClick={() => onSelect(selected === 'domain' ? null : 'domain')}
        >
          <span className="journey-card-kicker">PATH B</span>
          <strong>Build a domain harness</strong>
          <span>
            Niche intelligence: durable loop, domain tools, graders, and recovery proofs for a
            whole space.
          </span>
        </button>
      </div>

      <div className="journey-diagram" aria-hidden={selected === null}>
        <div className="journey-pipeline" aria-label="Eight-stage build pipeline">
          {PIPELINE.map((stage, index) => (
            <div key={stage} className="pipeline-stage">
              <b>{String(index + 1).padStart(2, '0')}</b>
              <span>{stage}</span>
              {index < PIPELINE.length - 1 && <i className="pipeline-arrow" aria-hidden="true" />}
            </div>
          ))}
        </div>
        <p className="journey-pipeline-note">
          Every coded build carries decisions in <code>build-state.json</code> and, for Tier B/C,
          an <code>agent-manifest.json</code>. Missing evidence never becomes a pass.
        </p>
      </div>

      {selected && (
        <div className="journey-detail" aria-live="polite">
          <div className="journey-detail-head">
            <label>{selected === 'domain' ? 'DOMAIN HARNESS' : 'SINGLE AGENT'}</label>
            <h3>{heading}</h3>
          </div>
          <ol className="journey-steps">
            {steps.map((step) => (
              <li key={step.n}>
                <b>{step.n}</b>
                <div>
                  <strong>{step.title}</strong>
                  <p>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="journey-actions">
            {selected === 'agent' ? (
              <a className="solid" href="#intake">
                Open the guided builder →
              </a>
            ) : (
              <>
                <a className="solid" href="#intake">
                  Start with a domain job brief →
                </a>
                <a
                  className="ghost"
                  href="https://github.com/The-Utopia-Studio/studio-agent-framework/tree/main/mastra-harness"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open mastra-harness
                </a>
              </>
            )}
            <a
              className="ghost"
              href="https://github.com/The-Utopia-Studio/studio-agent-framework#two-journeys"
              target="_blank"
              rel="noreferrer"
            >
              Read the full README journey
            </a>
          </div>
        </div>
      )}
    </section>
  );
}
