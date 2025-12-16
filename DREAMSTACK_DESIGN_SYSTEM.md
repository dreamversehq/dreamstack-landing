# DreamStack Design System & Brand Guidelines

**Version:** 1.0  
**Last Updated:** December 16, 2025  
**Brand Voice:** Professional, Technical, Direct, "Ship Fast"

---

## 1. Core Identity

### Color Palette
The DreamStack brand uses a high-contrast combination of "Safety Orange" and "Technical Blue" against a clean slate background.

| Color Name | Hex Code | Tailwind Class | Usage |
|------------|----------|----------------|-------|
| **Brand Orange** | `#FF7E33` | `bg-brand-orange` | Primary CTAs, Highlights, "Speed/Action" |
| **Brand Blue** | `#0069FF` | `bg-brand-blue` | Secondary Accents, Links, "Tech/Trust" |
| **Brand Blue Light** | `#3498DB` | `bg-brand-blue-light` | Subtle accents, code syntax |
| **Brand Gray** | `#333333` | `bg-brand-gray` | Dark backgrounds, heavy text |
| **Slate 900** | `#0f172a` | `text-slate-900` | Headings, Primary Text |
| **Slate 600** | `#475569` | `text-slate-600` | Body Text |
| **Slate 50** | `#f8fafc` | `bg-slate-50` | Section Backgrounds |

### Typography
**Font Family:** [Plus Jakarta Sans](https://fonts.google.com/specimen/Plus+Jakarta+Sans)  
**Weights:** 400 (Regular), 500 (Medium), 600 (SemiBold), 700 (Bold), 800 (ExtraBold)

```css
font-family: 'Plus Jakarta Sans', sans-serif;
```

**Type Scale (Desktop):**
- **H1 (Hero):** `text-5xl sm:text-6xl lg:text-6xl font-bold tracking-tight leading-[1.1]`
- **H2 (Section):** `text-3xl md:text-4xl font-bold tracking-tight`
- **H3 (Card Title):** `text-xl font-bold`
- **Body:** `text-lg leading-relaxed` (Hero), `text-base` (Standard)

---

## 2. UI Components

### Buttons
**Primary CTA (The "Buy" Button):**
High visibility, slight elevation, tactile feedback on hover.
```html
<button class="bg-brand-orange hover:bg-[#e66a20] text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all shadow-lg shadow-brand-orange/20 hover:shadow-xl hover:-translate-y-0.5">
  Get DreamStack - $197
</button>
```

**Secondary CTA (Documentation/Learn More):**
Clean, bordered, neutral.
```html
<button class="bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 px-8 py-4 rounded-xl font-semibold text-lg transition-all hover:border-slate-300">
  Read the Docs
</button>
```

### Cards & Containers
**Feature Card:**
Clean white card with subtle border and shadow. Lifts up on hover.
```html
<div class="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
  <!-- Icon Container -->
  <div class="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-600 mb-4">
    <!-- Icon -->
  </div>
  <h3 class="font-bold text-lg mb-2 text-slate-900">Title</h3>
  <p class="text-sm text-slate-600 leading-relaxed">Description</p>
</div>
```

**Pricing Card (Highlighted):**
Uses the brand orange border and shadow to pop.
```html
<div class="bg-white rounded-2xl p-8 relative shadow-xl border-2 border-brand-orange transform md:-translate-y-4 z-10">
  <!-- Content -->
</div>
```

### Badges & Tags
**Pill Badge:**
Used for "Early Access" or status indicators.
```html
<div class="inline-flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-full px-3 py-1">
  <span class="relative flex h-2 w-2">
    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-orange opacity-75"></span>
    <span class="relative inline-flex rounded-full h-2 w-2 bg-brand-orange"></span>
  </span>
  <span class="text-xs font-medium text-slate-600 uppercase tracking-wide">Early Access</span>
</div>
```

---

## 3. Layout & Spacing

- **Max Width:** `max-w-7xl mx-auto` (Standard container)
- **Section Padding:** `py-24 px-4 sm:px-6 lg:px-8`
- **Grid Gaps:** `gap-8` (Standard), `gap-16` (Large sections)
- **Border Radius:** `rounded-xl` (Buttons), `rounded-2xl` (Cards), `rounded-3xl` (Large containers)

---

## 4. Copywriting & Tone

**Do:**
- Use specific numbers ("471 tests", "40+ hours").
- Focus on outcome ("Ship faster", "Sleep better").
- Be direct and technical ("Production-Ready", "Clean Architecture").
- Use "You" and "Your".

**Don't:**
- Use vague buzzwords ("Enterprise-grade", "Synergy", "Next-gen").
- Over-promise ("Instant success").
- Use generic names ("John Doe" - unless placeholder).

**Key Phrases:**
- "Build Production-Ready Node.js APIs in Hours"
- "Stop rebuilding auth"
- "Battle-tested architecture"
- "Zero vendor lock-in"

---

## 5. Assets & Icons

- **Icons:** [Heroicons](https://heroicons.com/) (Outline style, 2px stroke).
- **Tech Logos:** [Devicon](https://devicon.dev/).
- **Logo:** `assets/logo-svg.svg` (Primary), `assets/logo.png` (Favicon).

---

## 6. Tailwind Configuration
Add this to `tailwind.config.js` or script tag:

```javascript
tailwind.config = {
    theme: {
        extend: {
            fontFamily: {
                sans: ['"Plus Jakarta Sans"', 'sans-serif'],
            },
            colors: {
                'brand-orange': '#FF7E33',
                'brand-blue': '#0069FF',
                'brand-blue-light': '#3498DB',
                'brand-gray': '#333333',
                'brand-gray-light': '#F5F5F5',
            },
            animation: {
                'infinite-scroll': 'infinite-scroll 25s linear infinite',
            },
            keyframes: {
                'infinite-scroll': {
                    from: { transform: 'translateX(0)' },
                    to: { transform: 'translateX(-100%)' },
                }
            }
        }
    }
}
```
