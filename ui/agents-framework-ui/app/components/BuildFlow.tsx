'use client';

import { useEffect, useState } from 'react';
import HandoffDispatch from './HandoffDispatch';
import NodeDiagram from './NodeDiagram';

type Answer =
  | 'person'
  | 'scheduled'
  | 'read'
  | 'write'
  | 'review'
  | 'system'
  | 'memory'
  | 'no-memory';
type Phase = 'brief' | 'preparing' | 'diagram';
type Audience = 'internal-team' | 'fellow-scoped' | 'public' | 'privileged-admin';
type RuntimeHome = 'utopia-os' | 'standalone' | 'local';

type BuildFlowProps = {
  rec: string[];
  answers: Answer[];
  audience: Audience;
  runtimeHome: RuntimeHome;
  job: string;
  owner: string;
};

const audienceLabels: Record<Audience, string> = {
  'internal-team': 'Internal team access',
  'fellow-scoped': 'Each fellow sees only their own information',
  public: 'Public information only',
  'privileged-admin': 'Restricted administrator access',
};
const homeLabels: Record<RuntimeHome, string> = {
  'utopia-os': 'Inside Utopia OS',
  standalone: 'Its own app',
  local: 'Your current computer or tool',
};

export default function BuildFlow({ rec, answers, audience, runtimeHome, job, owner }: BuildFlowProps) {
  const [phase, setPhase] = useState<Phase>('brief');
  const [runStep, setRunStep] = useState(0);
  const has = (answer: Answer) => answers.includes(answer);
  const runSteps = [
    'Checking that the job and owner are clear…',
    `Preparing the ${rec[1].toLowerCase()} structure…`,
    'Adding examples and pass/fail checks…',
    'Applying access and review boundaries…',
    'Build sequence ready.',
  ];

  useEffect(() => {
    if (phase !== 'preparing') return;
    if (runStep >= runSteps.length - 1) {
      const timer = setTimeout(() => setPhase('diagram'), 700);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => setRunStep((step) => step + 1), 520);
    return () => clearTimeout(timer);
  }, [phase, runStep, runSteps.length]);

  if (phase === 'diagram') {
    return (
      <section className="brief brief--full">
        <NodeDiagram
          pathType={rec[1]}
          job={job}
          owner={owner}
          scheduled={has('scheduled')}
          writes={has('write')}
          reviewed={has('review')}
        />
        <button className="nav-tab flow-reset" onClick={() => setPhase('brief')}>← Back to brief</button>
      </section>
    );
  }

  if (phase === 'preparing') {
    return (
      <section className="brief brief--full">
        <div className="flow-view">
          <label>BUILD PATH</label>
          <h2 className="flow-view-title">Preparing the steps for your agent.</h2>
          <div className="running-stage">
            <div className="running-bar" role="progressbar" aria-valuenow={runStep + 1} aria-valuemin={1} aria-valuemax={runSteps.length}>
              <div className="running-fill" style={{ width: `${((runStep + 1) / runSteps.length) * 100}%` }} />
            </div>
            <ul className="running-log">
              {runSteps.map((step, index) => <li key={step} className={index <= runStep ? 'done' : ''}>{index <= runStep ? '✓' : '·'} {step}</li>)}
            </ul>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="brief">
      <div className="brief-header">
        <div>
          <label>YOUR BUILD BRIEF · PATH {rec[0]}</label>
          <h1>{rec[1]}</h1>
          <p>{rec[2]}</p>
        </div>
        <span className="brief-ready">READY TO HAND OFF</span>
      </div>

      <div className="brief-summary">
        <article className="brief-summary-wide">
          <b>THE JOB</b>
          <h3>{job}</h3>
          <p>Responsible owner: {owner}</p>
        </article>
        <article>
          <b>HOW IT RUNS</b>
          <h3>{has('scheduled') ? 'Schedule or event' : 'A person starts it'}</h3>
          <p>{homeLabels[runtimeHome]}</p>
        </article>
        <article>
          <b>WHAT IT CAN DO</b>
          <h3>{has('write') ? 'Can change connected systems' : 'Reads and drafts only'}</h3>
          <p>{has('review') ? 'A person reviews every result.' : 'Another system receives the result.'}</p>
        </article>
        <article>
          <b>MEMORY</b>
          <h3>{has('memory') ? 'Approved history is retained' : 'Every run starts fresh'}</h3>
          <p>{has('memory') ? 'Memory will be scoped and tested.' : 'No memory layer will be added.'}</p>
        </article>
        <article>
          <b>ACCESS</b>
          <h3>{audienceLabels[audience]}</h3>
          <p>The build must prove this boundary before release.</p>
        </article>
      </div>

      <div className="handoff-documents">
        <div className="handoff-documents-head">
          <div>
            <label>HANDOFF OUTPUTS</label>
            <h2>The framework produces two build documents.</h2>
          </div>
          <p>
            The PRD defines what <strong>{job}</strong> must do. Work orders turn that approved
            definition into buildable tasks for <strong>{owner}</strong> and the selected tool.
          </p>
        </div>
        <HandoffDispatch />
      </div>

      <div className="handoff">
        <div className="handoff-intro">
          <div>
            <label>NEXT STEP</label>
            <p className="handoff-title">Use this brief with the framework to create the agent and its checks.</p>
          </div>
          <div className="handoff-actions">
            <a className="btn-download" href="/api/skills-zip?bundle=claude-single-skill-v3" aria-label="Download the agent-building framework">
              <span className="btn-download-arrow" aria-hidden="true">↓</span>
              <span>Download framework</span>
            </a>
            <button className="solid compact" onClick={() => { setRunStep(0); setPhase('preparing'); }}>Show the build sequence →</button>
          </div>
        </div>
      </div>
    </section>
  );
}
