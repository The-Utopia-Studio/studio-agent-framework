# Agent security profiles

Every agent carries the same baseline: a named principal, a strict tool allowlist, bounded data classes, append-only audit evidence, refusal of undeclared tools and out-of-scope data, and a secret-free-output check. The profile selects the additional boundary that actually applies; it does not make every internal agent pretend to be fellow-facing.

| Profile | Principal | Data boundary | Additional required proof |
| --- | --- | --- | --- |
| `internal-team` | Named team service account | Public and/or internal operational data; never fellow-private | Tool allowlist and scope-refusal test |
| `fellow-scoped` | Authenticated fellow context | The authenticated fellow's permitted data only | Cross-fellow denial / tenant-isolation test |
| `public` | Anonymous or authenticated public-user session | Public data only | Scope-refusal test |
| `privileged-admin` | Break-glass admin context | Explicitly declared privileged data | Elevated-access approval and audit test |

`runtime_home` is intentionally separate. Utopia OS, a standalone app, and a local/managed runtime describe where the loop runs; they do not determine who the agent may serve or what data it may access.

## What the harness can prove

The manifest runner proves the contract is complete: every declared tool is allowlisted, every baseline check is named, and fellow-scoped or privileged profiles carry their additional checks. The shared fixture runner can execute the declared golden cases.

The deployed runtime must still enforce the boundary server-side. It derives the principal and tenant from authentication—not model text—applies database/connector authorization, supplies least-privilege credentials, and records the decision. A manifest is not authorization middleware.
