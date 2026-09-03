# Icarus pack licence — investigation note

**Status:** unresolved for legal sign-off. Do **not** treat the repository root `LICENSE`
(Apache-2.0) as silently covering the three bundled Icarus skill directories.

Bundled directories: `agent-design/`, `workflow-design/`, `eval-first-spec/`.

## What was searched (2026-09-04)

| Source | Finding |
|---|---|
| Repo credits (`README.md`) | Attributes the three skills to **Ollie's Icarus pack (modules 09 + 07)**, bundled unchanged. |
| Root `LICENSE` NOTE | Already flags that Icarus redistribution under Apache-2.0 must be confirmed. |
| [`The-Utopia-Studio/skills`](https://github.com/The-Utopia-Studio/skills) | SPDX **Apache-2.0**. Same three skills live at [`skills/product/agent-design`](https://github.com/The-Utopia-Studio/skills/tree/main/skills/product/agent-design), [`workflow-design`](https://github.com/The-Utopia-Studio/skills/tree/main/skills/product/workflow-design), [`eval-first-spec`](https://github.com/The-Utopia-Studio/skills/tree/main/skills/product/eval-first-spec). Pack map: [`skills/product/ICARUS.md`](https://github.com/The-Utopia-Studio/skills/blob/main/skills/product/ICARUS.md) (stage 07 / 09). |
| Same `ICARUS.md` prose | Opens with *"Utopia Studio's **proprietary**, eval-gated product method"*. That language conflicts with a casual reading of the repo SPDX as a full clearance. |
| Marketplace / site copy | Utopia Skills pages describe packs under Apache 2.0 *and* market Icarus as a proprietary method — branding vs licence is not separated in public copy. |
| [`The-Utopia-Studio/Icarus`](https://github.com/The-Utopia-Studio/Icarus) playbook | No `LICENSE` file / GitHub licence API returns none. |
| Public web search for "Ollie Icarus pack" licence terms | No independent MIT/Apache grant found outside Utopia-owned repos; unrelated "Icarus"/"Ollie" projects dominate search results. |
| Local skill files | No per-directory `LICENSE` inside the three bundled folders. |

## What is known vs unknown

**Known**

- Utopia publishes the skill *files* in an Apache-2.0 marketplace repo.
- This framework's root licence intentionally withholds a claim that Apache covers the bundle.

**Unknown (needs a human legal / rights decision)**

- Whether Ollie (or Utopia as rights holder) intended the three skills to be redistributable under Apache-2.0 when copied into *this* repository, or only when consumed via the marketplace install path.
- Whether "proprietary" in `ICARUS.md` / marketing is brand language for the *method*, or a restriction on the *skill text*.
- Whether any private agreement, course pack, or zip distribution carries different terms than the public `skills` LICENSE.

## Options (do not pick one in code without a decision)

1. **Confirm** — Obtain written confirmation that the three directories may ship under this repo's Apache-2.0, citing [`The-Utopia-Studio/skills/LICENSE`](https://github.com/The-Utopia-Studio/skills/blob/main/LICENSE). Then update the root `LICENSE` NOTE with that URL and drop the caveat.
2. **Relicense** — Match whatever grant actually applies (or dual-license) so the root file and the bundled directories agree.
3. **Unbundle** — Remove the three directories from this repo and reference them by URL / marketplace pack install instead.

Until one of those lands, keep the root `LICENSE` NOTE as written and treat redistribution questions as open.
