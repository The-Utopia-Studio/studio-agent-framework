import { STACK_FEATURED, STACK_GRID } from '../data/stack';
import { StackLogos } from './StackLogo';

function StatusBadge({ status, label }: { status: string; label: string }) {
  return <span className={`stack-badge stack-badge--${status}`}>{label}</span>;
}

function StackCell({
  item,
  wide,
}: {
  item: (typeof STACK_GRID)[number];
  wide?: boolean;
}) {
  return (
    <article className={`stack-cell${wide ? ' stack-cell--wide' : ''}`}>
      <StackLogos logos={item.logos} alt={item.name} />
      <div>
        <h3>{item.name}</h3>
        <p>{item.subtitle}</p>
      </div>
      <StatusBadge status={item.status} label={item.statusLabel} />
    </article>
  );
}

export default function ToolsFooter() {
  const [convex, inngest, aisdk, langfuse, composio, activeloop, supermemory] = STACK_GRID;

  return (
    <section className="stack-footer">
      <label>04 · WHAT YOU BUILD ON</label>
      <p className="stack-intro">
        Decided per layer, on evidence. The harness is now a standard; the rest is a mix of settled
        decisions and named pilots. Nothing here is vibes.
      </p>

      <div className="stack-grid">
        <StackCell item={convex} />
        <StackCell item={inngest} />
        <StackCell item={aisdk} />
        <StackCell item={langfuse} />

        <article className="stack-cell stack-cell--featured">
          <StackLogos logos={STACK_FEATURED.logos} alt={STACK_FEATURED.name} />
          <div className="stack-featured-copy">
            <div className="stack-featured-head">
              <h3>{STACK_FEATURED.name}</h3>
              <span className="stack-featured-sub">{STACK_FEATURED.subtitle}</span>
              <StatusBadge status={STACK_FEATURED.status} label={STACK_FEATURED.statusLabel} />
            </div>
            <p>{STACK_FEATURED.description}</p>
            <div className="stack-featured-meta">
              <strong>{STACK_FEATURED.verified}</strong>
              <span>{STACK_FEATURED.specs}</span>
            </div>
          </div>
        </article>

        <StackCell item={composio} wide />
        <StackCell item={activeloop} />
        <StackCell item={supermemory} />
      </div>

      <footer className="stack-footnote">
        <strong>{STACK_FEATURED.footnote}</strong>
        <p>{STACK_FEATURED.footnoteBody}</p>
      </footer>
    </section>
  );
}
