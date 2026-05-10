---
name: L'Italiano Modern Pop
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#393939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#e1bfb4'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#a88a80'
  outline-variant: '#594139'
  surface-tint: '#ffb59b'
  primary: '#ffb59b'
  on-primary: '#5b1a00'
  primary-container: '#ff6d33'
  on-primary-container: '#5f1b00'
  inverse-primary: '#a93700'
  secondary: '#d6baff'
  on-secondary: '#3c2263'
  secondary-container: '#53397c'
  on-secondary-container: '#c5a8f3'
  tertiary: '#dcc841'
  on-tertiary: '#373100'
  tertiary-container: '#bfac26'
  on-tertiary-container: '#484000'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdbcf'
  primary-fixed-dim: '#ffb59b'
  on-primary-fixed: '#380d00'
  on-primary-fixed-variant: '#812800'
  secondary-fixed: '#ecdcff'
  secondary-fixed-dim: '#d6baff'
  on-secondary-fixed: '#26084d'
  on-secondary-fixed-variant: '#53397c'
  tertiary-fixed: '#f9e45b'
  tertiary-fixed-dim: '#dcc841'
  on-tertiary-fixed: '#201c00'
  on-tertiary-fixed-variant: '#504700'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 48px
    fontWeight: '800'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 24px
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  base: 8px
  container-padding: 24px
  gutter: 16px
  card-gap: 20px
---

## Brand & Style

The design system for **L'Italiano** is built on a "Modern-Pop" aesthetic that bridges high-energy digital vibrancy with traditional Mediterranean warmth. It targets curious, motivated learners who seek a learning environment that feels less like a textbook and more like a premium lifestyle experience.

The visual style is characterized by **High-Contrast Boldness**. It utilizes massive, punchy headlines and character-driven illustrations that act as guides through the curriculum. By placing high-saturation "electric" tones against a deep, sophisticated dark mode, the UI creates a sense of depth and focus. The emotional response is one of excitement and approachability, fueled by "squishy" high-roundness surfaces and playful, kinetic energy.

## Colors

The palette is designed for maximum vibration against a near-black background (`#121212`). 

- **Primary (Vivid Orange):** Used for primary actions and "Current Lesson" states.
- **Secondary (Soft Purple):** Used for grammar, vocabulary, and intellectual tasks.
- **Tertiary (Bright Yellow):** Used for achievements, streaks, and "Speak" exercises.
- **Quaternary (Mint Green):** Used for success states, progress bars, and "Review" sections.
- **Terracotta Accent:** A deeper, earthy red used for borders or subtle backgrounds to ground the "pop" colors in Italian heritage.

In dark mode, surfaces should use elevated greys (`#1E1E1E` and `#2C2C2C`) to maintain legibility while preserving the punch of the accent colors.

## Typography

This design system exclusively uses **Plus Jakarta Sans** to maintain a cohesive, friendly, and modern geometric appearance. 

The typographic hierarchy relies on extreme weight variance. Headlines are "Extra Bold" with tight tracking to mimic the impact of movie posters or high-end advertising. Body text remains "Medium" weight to ensure high legibility against dark backgrounds. Labels should be capitalized and bold to function as clear structural anchors within cards.

## Layout & Spacing

The layout follows a **fluid grid** system optimized for mobile-first consumption. 

- **Margins:** A generous 24px side margin ensures content does not feel cramped against the screen edges.
- **Gutter:** 16px between columns.
- **Rhythm:** An 8px base unit governs all vertical spacing. Elements are grouped in 8, 16, 24, and 32px increments.
- **Stacking:** Cards often use "full-width" styling on mobile to maximize the canvas area for the vibrant color fills and character illustrations.

## Elevation & Depth

Hierarchy is established through **Tonal Layers** and color-coding rather than traditional shadows.

1.  **Background:** The deepest layer is the neutral `#121212`.
2.  **Surface-Container:** Intermediate levels use `#1E1E1E` with subtle 1px borders in Terracotta or slightly lighter greys.
3.  **Active Cards:** High-energy colored cards (Orange, Purple, Yellow) sit at the highest perceived elevation. They do not use shadows; instead, they use high-contrast color fills to "pop" forward.
4.  **Floating Elements:** Interactive components like the navigation bar use a backdrop-blur (Glassmorphism) effect to stay visible over dynamic, scrolling content.

## Shapes

The shape language is defined by **extreme roundness** (`rounded-3xl`). This mimics the organic, squishy nature of the brand's characters and creates a soft, friendly interface that balances the "aggressive" high-contrast colors.

- **Primary Cards:** 24px - 32px corner radius.
- **Buttons:** Fully pill-shaped (999px).
- **Progress Bars:** Fully rounded ends.
- **Icons:** Contained within circular or highly rounded super-ellipse containers.

## Components

### Buttons
Primary buttons are pill-shaped, using the deep black background color for text against a high-vibration primary color fill. They should feature a "double-tap" feel with a slight scale-down animation on press.

### Learning Cards
Large-format cards with a solid background fill (Primary, Secondary, or Tertiary). They must include a character illustration and use "Display" typography for the title. The content inside should be minimal to maintain a "Pop-Art" poster feel.

### Navigation Bar
A floating, pill-shaped dock at the bottom of the screen. Icons are simple glyphs; the active state is indicated by a high-contrast circular "blob" of the primary color behind the icon.

### Input Fields
Inputs use a dark grey stroke with high roundness. Upon focus, the border expands to a 2px stroke using the primary orange, and the character illustration changes to a "listening" or "thinking" pose nearby.

### Progress Indicators
Progress bars should be thick (12px+) and use the Quaternary (Mint Green) for completion, set against a dark, low-opacity track.