# Utopia Default theme

This UI uses **Utopia Default** (`utopia-default`), the locked Ceramic theme for The Utopia Studio.

| File | Role |
|---|---|
| `theme-utopia-default.json` | Theme policy (primitives, visual grammar, AI rules). Same contract as `packages/design-system/src/manifests/theme-utopia-default.json`. |
| `utopia-default.css` | Semantic token map for this product surface (light workspace canvas). |

## Brand primitives

- Special Black `#3C3235`
- Brick Red `#CC5536` (action tone `#B8472C`)
- Light Grey `#EEEEEE`
- White `#FFFFFF`
- Radius `0` · border-led elevation · no brand-surface drop shadows
- Motion: ceremonial (`160ms` press · `420ms` page · `440ms` reveal)

## Product-surface note

Ceramic foundations treat this builder as a **product tool**, not a marketing page: light canvas, Special Black ink, Brick Red as a restrained accent (5–15%). Dark Special Black panels remain available for brand entries when needed.

Inspect live tokens:

```bash
npx -y --package @utopia-studio-design/design-system-cli utopia-ds theme utopia-default
```
