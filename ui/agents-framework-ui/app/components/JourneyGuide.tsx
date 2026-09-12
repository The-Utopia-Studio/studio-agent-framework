'use client';

export type JourneyKind = 'agent' | 'domain' | null;

type JourneyGuideProps = {
  selected: JourneyKind;
  onSelect: (kind: JourneyKind) => void;
};

export default function JourneyGuide({ selected, onSelect }: JourneyGuideProps) {
  return (
    <section className="journey" aria-label="Choose a path">
      <div className="journey-hero">
        <h1>
          Studio Agent
          <i aria-hidden="true">.</i>
        </h1>
        <p>Build an agent, or a domain harness.</p>
      </div>

      <div className="journey-cards" role="group" aria-label="Paths">
        <button
          type="button"
          className={selected === 'agent' ? 'journey-card is-selected' : 'journey-card'}
          aria-pressed={selected === 'agent'}
          onClick={() => onSelect('agent')}
        >
          <b>01</b>
          <strong>Agent</strong>
          <span>One job → brief → build</span>
        </button>
        <button
          type="button"
          className={selected === 'domain' ? 'journey-card is-selected' : 'journey-card'}
          aria-pressed={selected === 'domain'}
          onClick={() => onSelect('domain')}
        >
          <b>02</b>
          <strong>Domain harness</strong>
          <span>Niche loop → tools → prove it</span>
        </button>
      </div>

      <div className="journey-rail" aria-hidden="true">
        {['Job', 'Path', 'Eval', 'Build', 'Prove'].map((stage, i) => (
          <span key={stage}>
            <em>{String(i + 1).padStart(2, '0')}</em>
            {stage}
          </span>
        ))}
      </div>
    </section>
  );
}
