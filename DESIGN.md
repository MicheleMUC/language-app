# L'Italiano — Design System

App classifier: **APP UI** — workspace-driven, conversational, task-focused. Not a marketing/landing page.

## Color Tokens

### Backgrounds
| Token | Hex | Usage |
|-------|-----|-------|
| `bg` | `#131313` | Root screen background |
| `card` | `#201f1f` | Cards, panels, control bars |
| `elevated` | `#2a2a2a` | Slightly lighter surface (disabled states) |

### Borders
| Token | Hex | Usage |
|-------|-----|-------|
| `border-neutral` | `#353534` | Default card borders, dividers |
| `border-warm` | `#594139` | Warm-tinted borders (conversation, avatars) |

### Accent — Orange (primary)
| Token | Hex | Usage |
|-------|-----|-------|
| `orange` | `#ff6d33` | Primary CTA, mic button, user speech color, active states |
| `orange-light` | `#ffb59b` | Logo text, softer orange text on dark |
| `orange-muted` | `#ff9966` | Strikethrough original text in correction cards |
| `orange-dark` | `#5f1b00` | Text on orange backgrounds |
| `orange-deep` | `#c44a1a` | Active/pressed mic button |
| `orange-contrast` | `#380d00` | Text on orange stat cards |

### Accent — Purple
| Token | Hex | Usage |
|-------|-----|-------|
| `purple` | `#53397c` | Avatar circle bg, "thinking" AI state, session review hero |
| `purple-mid` | `#7b5ea7` | AI thinking status dot |
| `purple-light` | `#d6baff` | Feedback section labels, vocab icons |
| `purple-pale` | `#c5a8f3` | Session review hero title text |

### Accent — Yellow
| Token | Hex | Usage |
|-------|-----|-------|
| `yellow` | `#dcc841` | AI speaking state, A1/A2 level chip |
| `yellow-dark` | `#373100` | Text on yellow stat card |

### Accent — Teal
| Token | Hex | Usage |
|-------|-----|-------|
| `teal` | `#a8e4d4` | Corrected text, praise text in feedback cards |

### Text
| Token | Hex | Usage |
|-------|-----|-------|
| `text-primary` | `#e5e2e1` | Headings, strong labels, primary content |
| `text-muted` | `#e1bfb4` | Secondary labels, section headers, subtitles |
| `text-dim` | `#a88a80` | Explanations, helper text, timestamps |

### Status
| Token | Hex | Usage |
|-------|-----|-------|
| `status-green` | `#4caf50` | Connected/active dot |
| `status-error` | `#ff6b6b` | Grammar error text (✗ indicator) |
| `status-correct` | `#66d17a` | Grammar correct text (✓ indicator) |

## Typography

No custom font loaded — system font stack. All weights use native bold.

| Role | Size | Weight | Letter-spacing | Case |
|------|------|--------|---------------|------|
| Section label | 11px | 700 | 3 | UPPERCASE |
| Status pill text | 11–12px | 700 | 2–3 | UPPERCASE |
| Card label | 11px | 700 | 3 | UPPERCASE |
| Body / description | 12–14px | 400–600 | — | — |
| Card title / CTA | 14–16px | 600–700 | — | — |
| Screen heading / logo | 18–20px | 800 | — | — |
| Speech transcript | 28px | 600 | — | italic |
| Stat number | 32–36px | 800 | — | — |

## Spacing Scale

Base rhythm: `8px`. Common values: `4, 6, 8, 10, 12, 14, 16, 20, 24, 32, 40`.

- Horizontal screen padding: `24px`
- Card internal padding: `14–20px`
- Gap between card rows: `8–12px`
- Section bottom margin: `32px`

**Rule:** `paddingHorizontal` on screen-level containers is always `24px`. Do not use `4px` for screen-level horizontal padding.

## Border Radius

| Pattern | Radius | Usage |
|---------|--------|-------|
| Pill / chip | `50` | Buttons, level chips, status pills, CTA buttons |
| Card | `12–20` | Content cards, stat cards, control bars |
| Avatar | `48–86` | Circular profile images |
| Message bubble | `4–18` | Chat bubbles (4px on the "tail" corner) |
| Small tag | `8–12` | Small inline chips |

## Component Patterns

### Section label
`11px / 700 / letterSpacing 3 / UPPERCASE / color: text-muted`  
Used before every content group. No decorative elements.

### Card
Background `card (#201f1f)`, border `border-neutral (#353534)`, border-radius `16–20`.  
Internal padding `16–20px`. Use `overflow: hidden` when border-radius clips children.

### Pill / status indicator
Background `rgba(accent, 0.1)`, border `rgba(accent, 0.2)`, border-radius `50`.  
Contains a colored dot + uppercase label. Color shifts by state (orange/purple/yellow).

### Switch toggle
`trackColor={{ false: "#353534", true: "#ff6d33" }}`, `thumbColor="#e5e2e1"`.  
Always in a row with `flex: 1` text left + switch right.

### CTA button (primary)
Background `orange (#ff6d33)`, border-radius `50`, `paddingVertical 18–20`, `alignItems center`.  
Text: `16px / 700 / orange-dark (#5f1b00)`.

### CTA button (secondary)
Background `card (#201f1f)`, border `border-warm (#594139)`, border-radius `50`.  
Text: `16px / 700 / text-muted (#e1bfb4)`.

### Feedback / correction card (TurnFeedbackCard)
Background `card (#201f1f)`, border `border-neutral (#353534)`, border-radius `12`.  
Original text: `orange-muted (#ff9966)` with `textDecorationLine: line-through`.  
Corrected text: `teal (#a8e4d4)`, weight `700`.  
Explanation: `text-dim (#a88a80)`, `12px`.  
Arrow: `border-warm (#594139)`.

### Transcript bubble (AI)
Background `card (#201f1f)`, border `border-neutral (#353534)`.  
`borderBottomLeftRadius: 4` — the "tail" corner.

### Transcript bubble (user)
Background `orange (#ff6d33)`.  
Text: `orange-dark (#5f1b00)`.  
`borderBottomRightRadius: 4`.

## Interaction States

### Conversation states (color coding)
| State | Dot color | Pill bg | Label color |
|-------|-----------|---------|-------------|
| User talking | orange `#ff6d33` | `rgba(255,109,51,0.1)` | orange |
| AI thinking | purple `#7b5ea7` | `rgba(123,94,167,0.1)` | purple |
| AI speaking | yellow `#dcc841` | `rgba(220,200,65,0.1)` | yellow |
| Connected / idle | green `#4caf50` | `rgba(255,109,51,0.1)` | `#ffb59b` |
| Disconnected | `border-warm #594139` | — | — |

## AI Slop Checklist

Patterns explicitly avoided in this app:
- No 3-column feature grids
- No icons in colored circles as section decoration
- No centered-everything layouts
- No decorative blobs/wavy dividers (session review blobs are structural, not decorative)
- No emoji as primary bullet/icon replacement
- No generic hero copy
