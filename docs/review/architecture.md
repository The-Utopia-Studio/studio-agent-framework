# studio-standard-agent-framework — architecture as it exists today

**Method note.** The prompt asked for the `architecture-map` approach
(https://www.skills.sh/almendili/skills/architecture-map). I fetched it. It is a repo→isometric-city
visualiser whose core rule is *"Prose, groups and flows are authored. Counts, coverage and geometry are
measured"* — buildings sized by **code weight**, lines drawn from **call paths that genuinely exist**.

It is not unavailable; it is **inapplicable**. The target repo contains 48 files, all Markdown/JSON, and
**zero executable code**: no functions, no imports, no call graph, no runtime. There is nothing to measure
and no call paths to trace. Applying it would produce a city of 48 identical document-shaped buildings
connected by lines I invented. Per the "do not invent" rule, I used Mermaid instead, and every edge below
is labelled with how I know it exists.

**Edge provenance key**
- `[read]` — I read the file and the reference is literally in the text.
- `[inferred]` — not stated in the repo; deduced from surrounding text. Marked individually.

---

## Level 1 — System context

```mermaid
flowchart TB
  subgraph humans["People"]
    F["Studio fellow<br/>(often non-technical)"]
    H["Haniyah — sole author,<br/>feedback sink, judge runner"]
    J["Judge — separate Claude<br/>instance or human"]
  end

  subgraph saf["studio-standard-agent-framework (this repo)"]
    SK["6 SKILL.md documents<br/>4,264 lines Markdown<br/>+ 4 rubric.json"]
    TK["Test kits: 26 case files,<br/>4 RESULTS.md logs"]
  end

  subgraph runtime["Execution environment — NOT in this repo"]
    CAI["Claude.ai Skills<br/>(only documented install target)"]
    CC["Claude Code / Codex / Cursor"]
    CW["Cowork"]
  end

  subgraph out["Artefacts produced"]
    DOC["Agent PRD .docx/.pdf<br/>+ WORKORDERS.md<br/>+ checklists"]
  end

  subgraph pf["studio-product-framework (read-only, separate repo)"]
    PFA["agents/ — builder-agent<br/>skills + loops"]
    PFR["packages/ai-runtime<br/>(stub, no loop)"]
    PFC["apps/web/convex<br/>(no agent event log)"]
    PFD["agents/context/discovery/<br/>eval-first-spec.md — FORK"]
  end

  subgraph ext["External, referenced but absent"]
    ICA["Icarus pack<br/>modules 06,07,08,03"]
    PB["'Building Agents That Don't Break'<br/>playbook (Jul 2026)"]
    HAR["Runtime harness —<br/>UNDECIDED, bake-off open"]
  end

  F -->|"types 'build an agent'"| CAI
  CAI -->|"loads"| SK
  H -->|"authors, 2 commits"| SK
  H -->|"runs cases manually,<br/>fresh chat per case"| TK
  J -->|"scores transcript<br/>vs rubric.json"| TK
  SK -->|"produces"| DOC
  SK -.->|"[read] cites but does<br/>not contain"| ICA
  SK -.->|"[read] 'the why lives here'"| PB
  SK -.->|"[read] Appendix C:<br/>'Undecided — bake-off'"| HAR
  SK -.->|"[read] STACK-1: Convex is<br/>source of truth"| PFC
  PFD -.->|"DIVERGENT COPY of<br/>eval-first-spec"| SK
  DOC -.->|"[inferred] no mechanism<br/>in either repo"| PFA

  classDef gap stroke-dasharray: 5 5,stroke:#c0392b,color:#c0392b
  class ICA,PB,HAR,PFD gap
```

**What this level shows.** The framework's only *implemented* consumer surface is Claude.ai Skills
(README: "Claude.ai → Settings → Capabilities → Skills → Add"). Every other relationship on this diagram
is a document reference, not a wire. The three red dashed nodes are load-bearing dependencies that live
outside the repo, and one of them (`eval-first-spec`) has already forked.

---

## Level 2 — Component view: the chain, its state, and its contradictions

```mermaid
flowchart TD
  U(["Fellow's utterance"]) --> R{{"Router<br/>(Claude's skill-description<br/>matching — NOT code)"}}

  R -->|"'build'"| AB
  R -->|"'design an agent'"| S2
  R -->|"'design the fleet'"| S1
  R -->|"'spec the build'"| S3
  R -->|"'write the PRD'"| S4

  AL["<b>atelier-learnings</b><br/>175 lines · 38 rule IDs<br/>CTX/LOOP/MEM/EVAL/TOOL/<br/>STACK/HOME/ID/STATE/REPORT"]
  AB["<b>agent-builder</b> (orchestrator)<br/>262 lines<br/>Step 0 intake ×5<br/>Step 0b use-beat ×4<br/>Step 5 chain check"]

  AL ==>|"'load BEFORE the<br/>first question'"| AB

  subgraph carrier["THE CARRIER — the only state in the system"]
    C["Intake block + use beat<br/><b>held in the chat context window</b><br/>no file, no schema, no store"]
  end

  AB --> C
  C --> S1
  S1["<b>workflow-design</b> · stage 1<br/>186 lines<br/>Step 0 fleet-or-solo gate<br/>Step 4 spawn triggers<br/>Step 5 surfaces"]
  S1 -->|"fleet map"| C
  C --> S2
  S2["<b>agent-design</b> · stage 2<br/>156 lines<br/>role · tools · memory · eval<br/>4 file-stores"]
  S2 -->|"agent spec ×N"| C
  C --> G1{{"Step 2a<br/>surface ladder<br/>rung 1-2-3-4"}}
  G1 -->|"rungs 1-3"| FP["fast-pass<br/>checklist output"]
  G1 -->|"rung 4"| G2{{"Step 2b<br/>wedge gate"}}
  G2 -->|"no wedge"| X1["STOP → wedge-five-questions<br/>(skill NOT in repo)"]
  G2 -->|"validated"| S3
  S3["<b>eval-first-spec</b> · stage 3<br/>144 lines<br/>20 golden cases 6/7/4/3<br/>≥14 [Fact] floor<br/>L0–L4 · cost/outcome"]
  S3 -->|"eval contract"| C
  C --> S4
  FP --> S4
  S4["<b>agent-prd</b> · stage 4<br/><b>1,435 lines — 34% of repo</b><br/>Gates 0–9 · 12-section template<br/>work orders · Appendix A/B/C"]
  S4 --> OUT(["PRD .docx + WORKORDERS.md"])

  subgraph harness["Hermes — eval harness (manual)"]
    HR["rubric.json · 5 dims × 0-5<br/>pass ≥21, no dim &lt;4"]
    HG["9 golden cases<br/>(7 scored, 2 unscored)"]
    HA["5 adversarial cases<br/><b>A3, A4 known-FAILING</b>"]
  end
  AB -.->|"under test"| HR
  HR --- HG
  HR --- HA

  %% contradictions
  S1 -.->|"⚠ surfaces =<br/>Claude.ai/Code/Cowork"| K1{{"CONFLICT<br/>HOME-1 says<br/>OS/Vercel/local"}}
  S2 -.->|"⚠ memory = CLAUDE.md,<br/>skills, lessons.md, traces"| K2{{"CONFLICT<br/>MEM-3/7/8 + STACK-1<br/>say Convex, tenant-keyed,<br/>structured not prose"}}
  S3 -.->|"⚠ kill line: &lt;20 cases<br/>= auto-fail"| K3{{"CONFLICT<br/>agent-prd hard gate<br/>says ≥10<br/>EVAL-4 says 10 day one"}}
  AL -.-> K1
  AL -.-> K2
  S4 -.-> K3

  classDef conflict fill:#fdecea,stroke:#c0392b,color:#c0392b
  classDef missing stroke-dasharray: 5 5,stroke:#c0392b
  class K1,K2,K3 conflict
  class X1,HA missing
```

**What this level shows.**

1. **There is no dependency graph, because there are no dependencies.** Six independent Markdown files.
   "Chaining" is Claude reading one file that tells it to behave as if it had read another. Nothing
   imports, resolves, or version-pins anything. The arrows are *intentions expressed in prose*.

2. **The carrier is the whole state layer, and it is a context window.** `agent-builder` calls it "the
   carrier" and says stages read from it so nothing is re-asked. It has no file, no schema, no
   serialisation, no persistence. A closed tab loses the entire chain — which the framework's own
   `LOOP-2` ("durable, append-only event log outside the process") forbids. `G5` in the Hermes log was
   lost exactly this way: *"chat deleted before the rung ruling."*

3. **`agent-prd` is 34% of the corpus.** 1,435 of 4,264 lines in one file — 5.5× the orchestrator that
   calls it. Any edit to a shared concept (memory tiers, exit conditions, the rung ladder) has to be
   made there *and* in `atelier-learnings` *and* in `agent-builder`'s chain check.

4. **Three unreconciled contradictions**, each between a stage skill and the rules layer that is supposed
   to be law. `agent-builder` Step 5 explicitly reconciles three shared rules (memory vocabulary,
   generator≠evaluator, kill line) — but not these.

---

## Where the diagram is guessing

- The edge `Agent PRD → studio-product-framework` is `[inferred]`. No file in either repo describes how a
  produced PRD becomes a work item, a repo, or a Convex deployment. There is no handoff mechanism.
- The router node is drawn as a component. It is not one. It is Claude's own skill-selection behaviour
  matching against the `description:` frontmatter. The repo has no routing code, and the Hermes cases
  confirm it is non-deterministic (A5: a loaded sibling changes routing).
- `Icarus modules 06/07/08/03` are cited by number in five places; I have not read them and they are not
  in this repo.
