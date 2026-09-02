'use client';

import { useEffect, useState } from 'react';
import HandoffDispatch from './HandoffDispatch';
import NodeDiagram from './NodeDiagram';

type Answer = 'person' | 'scheduled' | 'read' | 'write' | 'review' | 'system';
type Phase = 'brief' | 'dispatch' | 'running' | 'diagram';
type Audience = 'internal-team' | 'fellow-scoped' | 'public' | 'privileged-admin';
type RuntimeHome = 'utopia-os' | 'standalone' | 'local';

type BuildFlowProps = {
  rec: string[];
  answers: Answer[];
  audience: Audience | null;
  runtimeHome: RuntimeHome | null;
};

function FlowView({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flow-view">
      <label>{label}</label>
      <h2 className="flow-view-title">{title}</h2>
      {children}
    </div>
  );
}

export default function BuildFlow({ rec, answers, audience, runtimeHome }: BuildFlowProps) {
  const [phase, setPhase] = useState<Phase>('brief');
  const [runStep, setRunStep] = useState(0);

  const runSteps = [
    'Parsing PRD constraints…',
    'Generating scaffold from work orders…',
    'Dispatching to Claude for role design…',
    'Codex writing integration stubs…',
    'Cursor applying patches…',
    'Running golden case…',
    'Agent registered.',
  ];

  useEffect(() => {
    if (phase !== 'dispatch') return;
    const t = setTimeout(() => setPhase('running'), 4200);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'running') return;
    if (runStep >= runSteps.length - 1) {
      const t = setTimeout(() => setPhase('diagram'), 900);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setRunStep((s) => s + 1), 650);
    return () => clearTimeout(t);
  }, [phase, runStep, runSteps.length]);

  const generate = () => {
    setRunStep(0);
    setPhase('dispatch');
  };

  if (phase === 'diagram') {
    return (
      <section className="brief brief--full">
        <NodeDiagram pathType={rec[1]} />
      </section>
    );
  }

  if (phase === 'dispatch') {
    return (
      <section className="brief brief--full">
        <FlowView label="05 · HANDOFF" title="Sending PRD and work orders to build tools.">
          <HandoffDispatch />
        </FlowView>
      </section>
    );
  }

  if (phase === 'running') {
    return (
      <section className="brief brief--full">
        <FlowView label="05 · BUILDING" title="Building your agent.">
          <div className="running-stage">
            <div className="running-bar">
              <div
                className="running-fill"
                style={{ width: `${((runStep + 1) / runSteps.length) * 100}%` }}
              />
            </div>
            <ul className="running-log">
              {runSteps.map((step, i) => (
                <li key={step} className={i <= runStep ? 'done' : ''}>
                  {i <= runStep ? '✓' : '·'} {step}
                </li>
              ))}
            </ul>
          </div>
        </FlowView>
      </section>
    );
  }

  return (
    <section className="brief">
      <div className="brief-header">
        <div>
          <label>BUILD BRIEF · {rec[0]}</label>
          <h1>{rec[1]} PATH STARTED.</h1>
          <p>{rec[2]}</p>
        </div>
      </div>

      <div className="brief-steps">
        <article>
          <b>01</b>
          <h3>Name the job</h3>
          <p>What should happen, for whom, and what should exist at the end?</p>
        </article>
        <article>
          <b>02</b>
          <h3>Set the owner</h3>
          <p>Who is accountable for the output, access, and failure reports?</p>
        </article>
        <article>
          <b>03</b>
          <h3>Prove it first</h3>
          <p>Define good, failed, and hardest-realistic runs before implementation.</p>
        </article>
        <article>
          <b>04</b>
          <h3>Set the safety boundary</h3>
          <p>
            {audience === 'fellow-scoped'
              ? 'Fellow-facing: authenticated identity and cross-fellow denial tests are required.'
              : audience === 'public'
                ? 'Public: the agent may use public data only.'
                : 'Internal team: named team access, tool allowlist, and audit trail are required.'}
          </p>
          <em>{runtimeHome === 'utopia-os' ? 'Runs in Utopia OS.' : runtimeHome === 'standalone' ? 'Runs as a standalone app.' : 'Runs locally or on a managed surface.'}</em>
        </article>
      </div>

      <div className="handoff">
        <div className="handoff-intro">
          <div>
            <label>04 · HANDOFF</label>
            <p className="handoff-title">Two artifacts ready for the builder.</p>
          </div>
          <div className="handoff-actions">
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
            <button className="solid compact" onClick={generate}>
              Generate PRD and work orders →
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
