# Just Word Design System

Status: Canonical  
Version: 2.0.0  
Last reviewed: 2026-07-14  
Foundation: Notion light design language supplied by the product owner  

This document is the permanent design contract for Just Word. It adapts the supplied Notion tokens to a focused vocabulary application. Marketing-only Notion patterns such as character illustrations, logo walls, hero sections, and decorative feature blocks are not product UI requirements. The runtime source of truth is the `--color-*` primitive layer and `--jw-*` semantic layer in `scss/style.scss`.

## 1. Design Philosophy

Just Word should feel like a well-kept paper notebook with the clarity of a modern productivity tool. Warm paper forms the canvas. White cards hold work. Black and warm gray establish hierarchy. Notion Blue is the only filled action color. Accent colors behave like sticky notes and are reserved for learning states.

| Rule | Why | Use | Do not use |
|---|---|---|---|
| Warm canvas, white work surfaces | Creates the Notion paper hierarchy | Every page and content card | White page with warm cards |
| One blue commitment | Keeps action hierarchy obvious | One primary action per screen | Multiple filled action colors |
| Borders before shadows | Preserves flat notebook character | Cards, controls, lists | Shadow on ordinary content cards |
| Editorial serif is an accent | Gives vocabulary a literary voice without weakening UI clarity | Learned words, flashcard word, preview word | Navigation, forms, page titles |
| Accent color carries state | Makes status memorable | New, Learning, Mastered | Random decoration in operational views |

## 2. Core Principles

| Principle | Why | Use | Do not use |
|---|---|---|---|
| Content first | The word and meaning are the task | Review, lists, preview | Decorative art competing with content |
| One dominant action | Reduces hesitation | Every page and dialog | Two blue filled buttons |
| Progressive disclosure | Keeps screens calm | Filters, dictionary details, advanced setup | Hiding required information |
| Mobile first | The app is used as a compact personal tool | Base layout and touch targets | Desktop scaled down mechanically |
| Tokens only | Prevents visual drift | Every design value | Literal component colors or shadows |
| Accessible state | Color alone is insufficient | Selection, status, validation | Color-only communication |

## 3. Visual Language

| Element | Canonical rule | Why | Use | Avoid |
|---|---|---|---|---|
| Canvas | `paper-warmth` | Tactile, low-glare base | Body and fixed app chrome | Pure white body |
| Card | `pure-white`, 1px `ink-08`, 12px radius | Clear surface without elevation | Dashboard cards, forms, lists | Warm card on white canvas |
| Primary action | `notion-blue`, white text, 8px radius | Single chromatic commitment | Save, Start, Import, Reveal | Status and decorative fills |
| Ghost action | `sky-tint`, Notion Blue text | Lower commitment | Secondary controls | Destructive action |
| Text | Inter with black alpha hierarchy | Stable interface voice | UI, labels, headings | Serif UI labels |
| Editorial text | Source Serif 4 | Notion Lyon substitute | Vocabulary objects only | Page hierarchy |

## 4. Design Tokens

### Colors

| Primitive | Value | Role | Use | Avoid |
|---|---:|---|---|---|
| `color-notion-blue` | `#0075DE` | Primary action | CTA, active nav, focus | Multiple filled accents |
| `color-paper-warmth` | `#F6F5F4` | Page canvas | App background and chrome | Card surface |
| `color-pure-white` | `#FFFFFF` | Raised surface | Cards and controls | Body canvas |
| `color-ink-black` | `#000000` | Primary text | Heading and word | All secondary text |
| `color-graphite` | `#615D59` | Body text | Meanings and descriptions | Disabled text |
| `color-stone` | `#757575` | Muted text | Labels and helper copy | Required instructions below AA contrast |
| `color-sky-tint` | `#E6F3FE` | Ghost surface | Learning state and secondary action | Page canvas |
| `color-marigold` | `#FFB110` | Warm accent | New state card and badge | Button hierarchy |
| `color-coral` | `#F64932` | Hot accent | Error support and rare callout | Primary CTA |
| `color-signal-blue` | `#097FE8` | Decorative blue | Future accent card | Primary action replacement |
| `color-sky-wash` | `#62AEF0` | Light accent | Future informational panel | Body canvas |
| `color-midnight-ink` | `#02093A` | Dark island | Mastered state and selected mode | Full dark theme |
| `color-ink-08` | `rgb(0 0 0 / 8%)` | Hairline | Cards and controls | Focus ring |

Semantic application mapping:

| State | Background | Foreground | Why |
|---|---|---|---|
| New | Marigold | Ink Black | Warm first-contact signal |
| Learning | Sky Tint | Notion Blue | Active but calm progress |
| Mastered | Midnight Ink | Pure White | Strong completed state |
| Error | Coral tint | Vermillion | Clear destructive meaning |
| Warning | Marigold | Ink Black | Attention without error semantics |

### Typography

| Role | Family | Size | Weight | Why | Use | Avoid |
|---|---|---:|---:|---|---|---|
| Page heading | Inter | 40px compact, 54px expanded | 600 | Confident Notion hierarchy | App bars | Serif headings |
| Word preview | Source Serif 4 | 54px to 72px | 400 | Editorial vocabulary focus | Preview and flashcard | Buttons |
| Word row | Source Serif 4 | 22px | 400 | Scannable literary accent | Vocabulary list | Metadata |
| Body | Inter | 16px | 400 | General readability | Meanings and forms | Page display |
| Label | Inter | 14px | 500 | Interface clarity | Buttons and fields | Paragraphs |
| Caption | Inter | 12px | 500 | Dense metadata | Badges and progress | Long copy |
| Code | JetBrains Mono | 12px | 400 | Stable numeric rhythm | Progress count | Prose |

Large Inter text uses negative tracking. Body text uses normal tracking. Source Serif is limited to vocabulary content.

### Spacing

Use the supplied 4px scale: `4, 8, 12, 16, 20, 24, 28, 32, 36, 64, 80`. Component gaps default to 8px. Card padding defaults to 24px and reduces to 16px on compact three-card dashboard rows.

### Radius

| Token | Value | Use | Do not use |
|---|---:|---|---|
| Small | 4px | Compact inline control | Cards |
| Button | 8px | Buttons, fields, icon buttons | Pills |
| Card | 12px | Cards, panels, dialogs | Navigation items requiring compact shape |
| Full | 9999px | Badges and progress pills | Rectangular buttons |

### Shadows

Content cards use no shadow. Bottom navigation may use the supplied Notion sticky navigation shadow. Modal and product mockup layers may use `0 4px 12px rgb(0 0 0 / 10%)`.

### Opacity

Black alpha levels are 95, 90, 60, 40, 20, 14, and 8 percent. Disabled opacity is 55 percent only when a semantic disabled color cannot represent the state.

### Motion

All standard transitions use 200ms ease. Error shake may use 500ms once. Reduced motion removes nonessential animation.

### Breakpoints

| Name | Width | Use |
|---|---:|---|
| Compact | below 768px | Card list, stacked controls |
| Medium | 768px to 1023px | 860px content frame |
| Expanded | 1024px to 1439px | Table view, 1440px maximum frame |
| Wide | 1440px and above | Preserve 1440px cap |

## 5. Grid System

Use a 12-column grid. Dashboard due content spans 12 columns. New, Learning, and Mastered each span 4 columns. Compact gap is 10px. General grid gap is 16px. Page gutters are 14px compact, 22px medium, and 24px expanded.

## 6. Layout Rules

| Rule | Why | Use | Avoid |
|---|---|---|---|
| App shell owns `100dvh` | Stabilizes fixed navigation | All views | Body scrolling |
| One inner scroll owner | Prevents nested scroll traps | Lists and long forms | Card and page scrolling together |
| App bar is 96px | Stable landmark | Authenticated views | Per-page header heights |
| Bottom nav is 90px | Touch comfort and safe area | Top-level views | Review session detail |
| Fixed action is 92px | Keeps primary action reachable | Forms and review | Pages without a terminal action |

## 7. Component Library

Canonical components are AppShell, AppBar, BottomNavigation, BentoCard, VocabularyList, VocabularyTable, Flashcard, PreviewPanel, Button, IconButton, Field, SegmentedOption, StatusBadge, CategoryPill, FilterSheet, Dialog, LoadingOverlay, and EmptyState.

Every component must use semantic `--jw-*` tokens. Material Web variables must alias the same semantic tokens.

## 8. Component Variants

| Component | Variants | Rule |
|---|---|---|
| Button | Primary, Ghost, Text, Danger | Only Primary uses filled blue |
| Card | White, New, Learning, Mastered, Interactive | Accent cards represent learning state |
| Field | Text, Textarea, Search, Select, Checkbox | Same 8px radius and focus model |
| Badge | New, Learning, Mastered, Category, Progress | Category never reuses learning state meaning |
| IconButton | Neutral, Primary, Danger, Selected | The native button, visible container, hover layer, focus ring, and hit target must share the same 48px square with an 8px radius. Do not place a smaller interactive control inside a decorative 48px wrapper. |

## 9. Interaction States

| State | Treatment | Why |
|---|---|---|
| Hover | Sky Tint or black 4 percent surface | Pointer feedback without shadow |
| Focus visible | 2px Notion Blue outline, 2px offset | Keyboard location |
| Pressed | Darkened Notion Blue or stronger neutral | Activation feedback |
| Selected | Blue foreground or Midnight surface plus explicit state | Persistent meaning |
| Disabled | Native disabled attribute plus semantic color | Accessibility and consistency |
| Loading | Preserve dimensions and set busy state | Avoid layout shift |
| Error | Vermillion text or border plus message | Local recovery |

## 10. Accessibility Rules

Meet WCAG 2.2 AA. Text requires 4.5:1 contrast unless large. Touch targets are at least 44px and standard icon buttons are 48px. Every icon button has an action-specific accessible name. Fields retain visible labels. Dialog focus is trapped and returned. DOM order matches visual order. Zoom remains enabled. Reduced motion is honored. Status is never color only.

## 11. Responsive Rules

Compact Vocabulary uses cards. Medium and expanded use tables. Forms stack below 768px. Review modes use two columns compact and four columns medium. Bottom navigation shows icon above label compact and inline medium. Long vocabulary wraps. The learned word is never truncated.

## 12. Content Guidelines

Use sentence case. Buttons use a clear verb and object, such as `Save word`, `Start review`, and `Delete card`. Navigation uses stable nouns. Status labels are exactly `New`, `Learning`, and `Mastered`. Error messages state the problem and next action. Avoid gamified pressure, vague `OK`, excessive exclamation, and mixed interface languages within one view.

## 13. Iconography

Material Symbols Rounded is the canonical action family. Use weight 450, optical size 24, fill 0. Standard glyph size is 22px and compact glyph size is 20px. Selected navigation may use fill 1. Product-owned SVG must use currentColor where possible. Emoji is not an interface icon.

## 14. Naming Convention

Primitive Notion tokens use `--color-*`, `--font-*`, and supplied scale names. App semantic tokens use `--jw-{category}-{role}-{state}`. Components use PascalCase in JavaScript APIs and kebab case in CSS. Variants describe intent, not color. Native attributes represent state before `.is-*` classes.

## 15. Figma Variables Structure

Use collections `Notion Primitives`, `Just Word Semantic`, `Component`, and `Responsive`. Component variables alias semantic variables. Semantic variables alias Notion primitives. Never bind a component directly to a hex value.

## 16. CSS Variables

`scss/style.scss` is authoritative. It exposes supplied Notion primitives and maps them to `--jw-*` semantic roles. Existing `--colors-*` names are temporary compatibility aliases. New CSS must use `--jw-*` directly.

## 17. Tailwind Theme

If Tailwind is introduced, map theme utilities to existing CSS variables. Do not duplicate the palette. Arbitrary color, radius, shadow, spacing, or typography values are prohibited in product components.

## 18. Component API

Public props describe semantics: `variant="primary"`, `status="learning"`, `disabled`, `loading`, `aria-current`, and `aria-pressed`. Do not expose props such as `blue`, `rounded`, or `shadow`. Components emit outcomes and keep data operations outside presentation primitives.

## 19. Design Patterns

Capture flows use app bar, labeled fields, optional detail, and one fixed primary action. Review setup uses scoped filters, segmented modes, due count, and one Start action. Active review removes bottom navigation. Vocabulary browsing uses a deferred filter sheet and responsive list or table. Destruction requires object-specific confirmation and a danger action.

## 20. Anti-patterns

| Anti-pattern | Replacement |
|---|---|
| Purple or lavender legacy palette | Notion primitives and semantic aliases |
| Serif page titles | Inter 600 headings |
| Circular rectangular controls | 8px button radius |
| Warm card on white page | White card on warm canvas |
| Shadow on content card | 1px black 8 percent border |
| Inline visual styles in JavaScript | Native state or `.is-*` class |
| Color-named component variants | Semantic variant names |
| Breakpoint literals in JavaScript | Shared viewport constants |

## 21. Consistency Rules

One component owns each visual pattern. Equivalent controls share height, radius, focus, disabled, and loading behavior. New component styles may not contain literal colors. CSS and JavaScript use the same 768 and 1024 breakpoints. Visual regression coverage must include Dashboard, Vocabulary, Review, Import, Preview, and Dialog at 375px, 768px, and 1280px.

## 22. Future Extension Rules

Extend semantic aliases before adding primitives. Add a token only when an existing role misrepresents meaning. Dark mode requires a complete semantic mapping and contrast audit. New learning states require a label, accessible noncolor cue, foreground, background, filter behavior, and migration plan. Every approved system change updates this document and the runtime token source in the same change.

## AI implementation checklist

1. Identify the nearest existing component and layout pattern.
2. Use Notion primitives only through `--jw-*` semantic tokens.
3. Keep one blue primary action and one scroll owner.
4. Implement compact, medium, and expanded behavior together.
5. Include keyboard, focus, disabled, loading, error, and reduced-motion behavior.
6. Verify touch targets, accessible names, zoom, contrast, and long vocabulary.
7. Update this document before introducing a new token or component contract.
