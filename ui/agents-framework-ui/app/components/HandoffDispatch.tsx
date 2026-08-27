'use client';

import { BUILD_TOOLS } from '../data/tools';
import ToolLogo from './ToolLogo';

const HANDOFF_TOOLS = BUILD_TOOLS.filter((t) =>
  ['claude', 'codex', 'cursor', 'manus', 'codewords'].includes(t.id),
);

export default function HandoffDispatch() {
  const toolXs = [70, 205, 350, 495, 630];

  return (
    <div className="handoff-dispatch">
      <div className="dispatch-docs">
        <div className="dispatch-doc dispatch-doc-prd">
          <span className="dispatch-doc-label">PRD</span>
          <span className="dispatch-doc-sub">Agent spec</span>
        </div>
        <div className="dispatch-doc dispatch-doc-wo">
          <span className="dispatch-doc-label">WO</span>
          <span className="dispatch-doc-sub">Build tasks</span>
        </div>
      </div>

      <svg className="dispatch-svg" viewBox="0 0 700 280" preserveAspectRatio="xMidYMid meet" aria-hidden>
        <path
          d="M 175 88 C 250 130, 300 155, 350 168"
          className="dispatch-line dispatch-line-in dispatch-line-prd"
        />
        <path
          d="M 525 88 C 450 130, 400 155, 350 168"
          className="dispatch-line dispatch-line-in dispatch-line-wo"
        />

        {toolXs.map((x, i) => (
          <path
            key={x}
            d={`M 350 195 L ${x} 248`}
            className="dispatch-line dispatch-line-out"
            style={{ animationDelay: `${1.35 + i * 0.12}s` }}
          />
        ))}

        <circle cx="350" cy="180" r="7" className="dispatch-line-dot" />
      </svg>

      <div className="dispatch-node">
        <span>Build</span>
      </div>

      <div className="dispatch-tools">
        {HANDOFF_TOOLS.map((tool, i) => (
          <div
            key={tool.id}
            className="dispatch-tool"
            style={{ animationDelay: `${1.9 + i * 0.1}s` }}
          >
            <div className="dispatch-tool-logo">
              <ToolLogo id={tool.id} size={40} />
            </div>
            <span>{tool.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
