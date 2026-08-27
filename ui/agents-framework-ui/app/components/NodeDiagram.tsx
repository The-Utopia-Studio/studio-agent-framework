'use client';

import { useEffect, useMemo, useState } from 'react';
import { AgentBlueprint, getAgentBlueprint } from '../data/agents';
import { getLogoForId } from '../data/logos';
import { BUILD_TOOLS } from '../data/tools';
import ToolLogo from './ToolLogo';

type NodeDiagramProps = {
  pathType: string;
};

type FlowStep = { from: string; to: string };
type Point = { x: number; y: number };

function buildFlowSteps(blueprint: AgentBlueprint): FlowStep[] {
  const steps: FlowStep[] = [{ from: 'trigger', to: 'agent' }];
  const files = blueprint.nodes.filter((n) => n.kind === 'file');

  for (const file of files) {
    steps.push({ from: 'agent', to: file.id });
    const toolEdge = blueprint.edges.find(([from]) => from === file.id);
    if (toolEdge) steps.push({ from: file.id, to: toolEdge[1] });
  }

  steps.push({ from: 'agent', to: 'output' });
  return steps;
}

function getNodePosition(id: string, blueprint: AgentBlueprint): Point {
  const col = (i: number, total: number) => {
    if (total <= 1) return 300;
    const span = 400;
    const start = 100;
    return start + (span / (total - 1)) * i;
  };

  if (id === 'trigger') return { x: 100, y: 52 };
  if (id === 'agent') return { x: 300, y: 52 };
  if (id === 'output') return { x: 500, y: 52 };

  const files = blueprint.nodes.filter((n) => n.kind === 'file');
  const fileIndex = files.findIndex((f) => f.id === id);
  if (fileIndex >= 0) return { x: col(fileIndex, files.length), y: 148 };

  const tools = blueprint.nodes.filter((n) => n.kind === 'tool');
  const toolIndex = tools.findIndex((t) => t.id === id);
  if (toolIndex >= 0) return { x: col(toolIndex, tools.length), y: 244 };

  return { x: 300, y: 148 };
}

function NodeToolIcon({ toolId }: { toolId: string }) {
  const logo = getLogoForId(toolId);
  if (!logo) return null;

  return (
    <div className="agent-node-logo">
      <img src={logo} alt={`${toolId} logo`} width={20} height={20} className="agent-node-logo-img" />
    </div>
  );
}

function AgentNode({
  id,
  label,
  kind,
  toolId,
  delay,
  active,
  visited,
  harness,
}: {
  id: string;
  label: string;
  kind: string;
  toolId?: string;
  delay: string;
  active: boolean;
  visited: boolean;
  harness?: AgentBlueprint['harness'];
}) {
  const showLogo = toolId && getLogoForId(toolId);

  return (
    <div
      id={`node-${id}`}
      className={[
        'agent-node',
        `agent-node--${kind}`,
        active ? 'agent-node--active' : '',
        visited ? 'agent-node--visited' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ animationDelay: delay }}
    >
      {kind === 'agent' && harness && (
        <div className="agent-harness" aria-label={`${harness.label}: ${harness.detail}`}>
          <span className="agent-harness-badge">
            <img src={getLogoForId(harness.id)} alt="" width={16} height={16} />
            <span>{harness.label}</span>
          </span>
          <span className="agent-harness-detail">{harness.detail}</span>
        </div>
      )}
      {kind === 'file' && <span className="agent-node-tag">.md</span>}
      {showLogo && toolId && <NodeToolIcon toolId={toolId} />}
      <span>{label}</span>
    </div>
  );
}

export default function NodeDiagram({ pathType }: NodeDiagramProps) {
  const blueprint = getAgentBlueprint(pathType);
  const trigger = blueprint.nodes.find((n) => n.kind === 'trigger')!;
  const agent = blueprint.nodes.find((n) => n.kind === 'agent')!;
  const output = blueprint.nodes.find((n) => n.kind === 'output')!;
  const files = blueprint.nodes.filter((n) => n.kind === 'file');
  const tools = blueprint.nodes.filter((n) => n.kind === 'tool');
  const buildToolItems = BUILD_TOOLS.filter((t) => blueprint.buildTools.includes(t.id));

  const flowSteps = useMemo(() => buildFlowSteps(blueprint), [blueprint]);
  const [stepIndex, setStepIndex] = useState(0);
  const [dot, setDot] = useState<Point>({ x: 100, y: 52 });
  const [visited, setVisited] = useState<Set<string>>(() => new Set(['trigger']));

  const currentStep = flowSteps[stepIndex % flowSteps.length];
  const activeNode = currentStep?.to ?? 'trigger';

  useEffect(() => {
    const step = flowSteps[stepIndex % flowSteps.length];
    if (!step) return;

    const from = getNodePosition(step.from, blueprint);
    const to = getNodePosition(step.to, blueprint);

    setDot(from);
    const move = requestAnimationFrame(() => setDot(to));

    const advance = setTimeout(() => {
      setVisited((prev) => new Set([...prev, step.from, step.to]));
      setStepIndex((i) => i + 1);
    }, 2400);

    return () => {
      cancelAnimationFrame(move);
      clearTimeout(advance);
    };
  }, [stepIndex, flowSteps, blueprint]);

  useEffect(() => {
    if (stepIndex > 0 && stepIndex % flowSteps.length === 0) {
      setVisited(new Set(['trigger']));
    }
  }, [stepIndex, flowSteps.length]);

  const flowPaths = useMemo(() => {
    const seen = new Set<string>();
    return flowSteps.filter((s) => {
      const key = `${s.from}-${s.to}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [flowSteps]);

  return (
    <div className="diagram-wrap">
      <div className="diagram-head">
        <label>06 · AGENT BUILT</label>
        <h3>{blueprint.name} is live.</h3>
        <p className="diagram-meta">
          <strong>{blueprint.pathType} AGENT</strong> · {blueprint.owner} · {blueprint.status}
        </p>
        <p className="diagram-desc">{blueprint.summary}</p>
      </div>

      <div className="agent-graph agent-graph--live">
        <svg className="agent-flow-svg" viewBox="0 0 600 300" preserveAspectRatio="xMidYMid meet" aria-hidden>
          {flowPaths.map((s) => {
            const from = getNodePosition(s.from, blueprint);
            const to = getNodePosition(s.to, blueprint);
            const isActive = currentStep?.from === s.from && currentStep?.to === s.to;
            const midY = (from.y + to.y) / 2;
            const d =
              from.y === to.y
                ? `M ${from.x} ${from.y} L ${to.x} ${to.y}`
                : `M ${from.x} ${from.y} C ${from.x} ${midY}, ${to.x} ${midY}, ${to.x} ${to.y}`;

            return (
              <path
                key={`${s.from}-${s.to}`}
                d={d}
                className={`agent-flow-path${isActive ? ' agent-flow-path--active' : ''}${visited.has(s.to) ? ' agent-flow-path--done' : ''}`}
              />
            );
          })}
          <g className="agent-flow-dot" transform={`translate(${dot.x}, ${dot.y})`}>
            <circle r="6" />
            <circle r="12" className="agent-flow-dot-ring" />
          </g>
        </svg>

        <div className="agent-graph-body">
          <div className="agent-row agent-row-flow">
            <AgentNode
              id={trigger.id}
              label={trigger.label}
              kind="trigger"
              delay="0s"
              active={activeNode === trigger.id}
              visited={visited.has(trigger.id)}
            />
            <div className={`agent-connector-v${activeNode === agent.id || visited.has(agent.id) ? ' agent-connector-v--on' : ''}`} aria-hidden />
            <AgentNode
              id={agent.id}
              label={agent.label}
              kind="agent"
              delay="0.1s"
              active={activeNode === agent.id}
              visited={visited.has(agent.id)}
              harness={blueprint.harness}
            />
            <div className={`agent-connector-v${activeNode === output.id || visited.has(output.id) ? ' agent-connector-v--on' : ''}`} aria-hidden />
            <AgentNode
              id={output.id}
              label={output.label}
              kind="output"
              delay="0.15s"
              active={activeNode === output.id}
              visited={visited.has(output.id)}
            />
          </div>

          <div className={`agent-connector-down${files.some((f) => activeNode === f.id || visited.has(f.id)) ? ' agent-connector-down--on' : ''}`} aria-hidden />

          <div className="agent-row agent-row-files">
            {files.map((f, i) => (
              <AgentNode
                key={f.id}
                id={f.id}
                label={f.label}
                kind="file"
                delay={`${0.22 + i * 0.06}s`}
                active={activeNode === f.id}
                visited={visited.has(f.id)}
              />
            ))}
          </div>

          <div className={`agent-connector-down${tools.some((t) => activeNode === t.id || visited.has(t.id)) ? ' agent-connector-down--on' : ''}`} aria-hidden />

          <div className="agent-row agent-row-tools">
            {tools.map((t, i) => (
              <AgentNode
                key={t.id}
                id={t.id}
                label={t.label}
                kind="tool"
                toolId={t.id}
                delay={`${0.38 + i * 0.06}s`}
                active={activeNode === t.id}
                visited={visited.has(t.id)}
              />
            ))}
          </div>

          <div className="agent-graph-legend">
            <span>Trigger</span>
            <span>Agent core</span>
            <span>Markdown files</span>
            <span>Connected tools</span>
          </div>
        </div>
      </div>

      <div className="diagram-tools">
        <span className="diagram-tools-label">Built with</span>
        <div className="diagram-tool-row">
          {buildToolItems.map((tool, i) => (
            <div key={tool.id} className="diagram-tool-chip" style={{ animationDelay: `${0.55 + i * 0.08}s` }}>
              <div className="diagram-tool-chip-logo">
                <ToolLogo id={tool.id} size={22} />
              </div>
              <span>{tool.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
