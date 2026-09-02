// The home-page section for the standard harness.
//
// Uses the .standard grid that already existed in globals.css but had no consumer — three
// columns: what it is, what is proven, and the way in.
const STEPS = [
  ['1', 'PREFLIGHT', 'Reachable? No → clean offline, exit 0.'],
  ['2', 'WORKFLOW', 'Deterministic. Sub-modules are nested workflows.'],
  ['3', 'AGENT', 'One owned decision. Skills are its tools.'],
  ['4', 'DURABLE STATE', 'ConvexStore. Convex is the system of record.'],
  ['5', 'MEMORY WRITE', 'Deterministic. Not the model’s choice.'],
  ['6', 'FRESHNESS', 'Did the write land? Timestamp, never size.'],
  ['7', 'GRADE', 'BEHAVIOR.md, out of band, after the fact.'],
];

// Numbers, not adjectives. Every one of these is in long-horizon/ with the run behind it.
const PROVEN = [
  ['12 / 12', 'STATE-1 kill-test on 1.63.2', 'live model · real Convex · fresh-process resume'],
  ['41 h', 'unattended, three sleep boundaries', 'one shut in a bag with no network'],
  ['117', 'runs and cycles, 2 non-ok', 'both explained · work deferred, never dropped'],
  ['$0.19', 'against a $3 cap', '240,602 tokens · the guard stops itself'],
];

export default function StandardHarness() {
  return (
    <section className="standard" id="harness">
      <div className="standard-lead">
        <label>03 · THE STANDARD HARNESS</label>
        <h2>WHAT A CODED AGENT RUNS ON.</h2>
        <p className="standard-intro">
          Mastra runs the loop, Convex holds the truth. Seven steps, in this order — and steps 1, 5
          and 6 exist only because they broke in production. None of the three are obvious and none
          are documented upstream.
        </p>

        <ol className="harness-steps">
          {STEPS.map(([n, name, note]) => (
            <li key={n} className={n === '1' || n === '5' || n === '6' ? 'hard-won' : undefined}>
              <b>{n}</b>
              <div>
                <strong>{name}</strong>
                <span>{note}</span>
              </div>
            </li>
          ))}
        </ol>
        <p className="harness-note">
          <em>Marked steps broke first.</em> The trigger is whatever the OS dispatches — a fellow
          request, a signal, a schedule. Only what calls step 1 changes.
        </p>
      </div>

      <div className="standard-proof">
        <label>WHAT IS ACTUALLY PROVEN</label>
        {PROVEN.map(([fig, what, how]) => (
          <article key={what} className="proof-row">
            <b>{fig}</b>
            <strong>{what}</strong>
            <span>{how}</span>
          </article>
        ))}
        <p className="harness-caveat">
          The environment turned out to be the easy part. What is hard is noticing an agent that
          looks perfect from the outside has quietly stopped doing part of its job — which is what
          happened, for nine hours, with every signal green.
        </p>
      </div>

      <aside className="standard-cta">
        <span className="hero-aside-num">07</span>
        <p className="hero-aside-title">SEVEN STEPS, TWO DECISIONS</p>
        <p className="hero-aside-sub">a workflow only if losing work costs something</p>
        <a
          className="btn-download"
          href="https://github.com/The-Utopia-Studio/studio-agent-framework/tree/main/long-horizon"
          target="_blank"
          rel="noreferrer"
          title="long-horizon/ — the harness, memory, the Inngest result, and conduct grading, each separating proven from unproven"
        >
          <span className="btn-download-arrow" aria-hidden="true">
            →
          </span>
          <span>Read the standard</span>
        </a>
      </aside>
    </section>
  );
}
