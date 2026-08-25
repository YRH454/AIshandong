---
name: "学境 2.0"
description: "A calm, single-workspace AI learning companion for university students."
colors:
  canvas: "#fbfbfc"
  sidebar: "#f5f6f6"
  surface: "#ffffff"
  text: "#1b2020"
  muted: "#697274"
  faint: "#9aa2a4"
  divider: "#e5e8e7"
  divider-strong: "#d9dfdc"
  sage: "#39745a"
  sage-deep: "#255c44"
  sage-soft: "#eaf3ed"
  danger: "#9c4d42"
typography:
  headline:
    fontFamily: '"MiSans", "HarmonyOS Sans SC", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif'
    fontSize: "clamp(30px, 3vw, 39px)"
    fontWeight: 650
    lineHeight: 1.15
    letterSpacing: "-0.055em"
  body:
    fontFamily: '"MiSans", "HarmonyOS Sans SC", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif'
    fontSize: "14px"
    lineHeight: 1.75
  label:
    fontFamily: '"MiSans", "HarmonyOS Sans SC", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif'
    fontSize: "11px"
    fontWeight: 650
rounded:
  compact: "8px"
  action: "12px"
  card: "14px"
  composer: "16px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  section: "32px"
components:
  action-primary:
    backgroundColor: "{colors.sage}"
    textColor: "{colors.surface}"
    rounded: "{rounded.compact}"
    padding: "8px 10px"
  prompt-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.action}"
    padding: "12px 13px"
  learning-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.card}"
  composer:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.composer}"
    padding: "8px 10px 7px"
---

# Design System: 学境 2.0

## Overview

**Creative North Star: "The Quiet Study Desk"**

学境 is a focused AI learning workspace for university students who want to turn a goal, question, image, or course file into an immediate next step. Its interface keeps the intelligence inside one continuous conversation rather than exposing a complex suite of learning modules.

The visual world is mist white and graphite with one restrained sage-green voice for learning intent, completion, and the composer’s send action. Fine dividers, generous empty space, and small-radius containers make the workspace feel calm and dependable. In-chat plan, explanation, and mastery-check cards carry the learning story without changing the user’s context.

**Key Characteristics:**

- One primary conversation, one primary composer, and no page-hopping mental model.
- Sage signals meaningful learning actions; neutral surfaces carry everything else.
- Cards explain, plan, and check mastery inside the thread rather than becoming a dashboard.
- Motion is brief and functional: soft entry, hover lift, and panel reveal only.

Finish review verdict: **approved for initial UI**. The only mild watchpoint is that the persistent desktop plan rail can read slightly dashboard-like; keep it secondary and dismissible.

## Colors

The palette is deliberately low-contrast in material and high-contrast in hierarchy: paper-like neutrals establish a quiet study field while sage identifies AI-led learning progress.

### Primary

- **Learning Sage:** Used for the brand mark, active learning controls, positive states, and the sole filled action treatment.
- **Deep Learning Sage:** Used for hover states and stronger completed/current emphasis.
- **Soft Sage:** Used for selected navigation, contextual icon tiles, user-message fills, and low-pressure progress panels.

### Neutral

- **Mist Canvas:** The uninterrupted application background.
- **Desk Sidebar:** A subtly cooler left context rail on desktop.
- **Paper Surface:** Cards, composer, and elevated controls.
- **Graphite Text:** Primary reading and heading color.
- **Quiet Text / Faint Text:** Supporting copy, metadata, and secondary controls.
- **Fine Divider / Strong Divider:** Structural boundaries without boxed-in density.

### Tertiary

- **Muted Red:** Reserved for incorrect mastery choices and corrective feedback.

**The One Accent Rule.** Sage is not decoration. Use it to show a learning action, active state, progress, or success; do not introduce competing saturated accents.

## Typography

**Display Font:** MiSans with HarmonyOS Sans SC, PingFang SC, Microsoft YaHei, and system fallbacks.

**Character:** Chinese-first system sans typography is compact, highly legible, and quietly confident. Headings tighten their tracking to create a clear focal point; operational labels stay small but not ornamental.

### Hierarchy

- **Display:** Centered welcome question; large, tight, and visually spare.
- **Headline:** Learning-plan titles and principal thread headings; semibold with compact tracking.
- **Body:** Questions, replies, and explanatory steps; comfortable line-height for sustained reading.
- **Label:** Metadata, tool labels, status, and navigation; concise, medium-weight, and low-contrast unless active.

**The One Question Rule.** The dominant type treatment should always make the current learning question or next learning action unmistakable.

## Layout

Desktop uses a three-part app shell: a left context rail, a flexible centered conversation, and an optional right learning-plan rail. The welcome state places its question and suggested actions at the visual center, while the composer remains anchored at the lower edge as the primary action.

The thread is constrained for readable line lengths. Suggestion cards form a two-column grid on larger screens; in-chat learning cards expand within the conversation width rather than breaking into independent modules. The sidebars use fine dividers and restrained width so the conversation keeps visual priority.

At 920px and below, the left sidebar becomes an overlay and the plan rail becomes a dismissible overlay. At 640px and below, the top bar shortens, suggestions stack into one column, agent avatars disappear from the thread, cards tighten their padding, and the composer nearly spans the screen. Preserve the composer at the bottom of the interaction on every viewport.

## Elevation & Depth

The system is flat by default. Depth comes first from tonal separation and hairline dividers; shadows are reserved for the new-chat control, prompt hover, in-chat learning cards, the composer, temporary overlays, and mobile drawers. These are soft, diffuse, and low-opacity rather than dramatic.

**The Composer Anchor Rule.** The composer may carry the most visible shadow because it is the universal point of action. Other containers should remain visually quieter.

## Shapes

Forms are gently squared rather than pill-like. Small controls use compact corners, prompt cards use a medium curve, in-chat cards use a slightly larger curve, and the composer receives the largest radius. Borders remain thin and pale; the user message may use one asymmetric corner to distinguish its conversational origin without adding a heavy bubble system.

## Components

### App Shell

- **Context rail:** Desktop-only persistent learning context with brand, recent conversations, and profile; overlay navigation on narrow screens.
- **Top bar:** Centers the current conversation title and keeps secondary actions quiet.
- **Plan rail:** Optional, secondary learning-path context; it must stay dismissible and never compete with the conversation.

### Prompt Cards

- **Style:** White cards with fine borders, a soft-sage icon tile, concise label/detail hierarchy, and a trailing chevron.
- **State:** Hover gently strengthens the border, adds a soft shadow, and lifts by one pixel.

### Learning Cards

- **Plan card:** A thread-native plan with status, compact metadata, staged day preview, and one sage next-step action.
- **Explanation card:** A quiet tonal container for sequenced explanations; numbered circles provide the only local emphasis.
- **Mastery check:** Neutral outlined answer rows; correct selection turns sage, incorrect selection turns muted red.

### Knowledge Map — Timeline Chronicle

- **Purpose:** Use the timeline chronicle for historical development, conceptual evolution, or staged formation. It must not reuse the ordinary process-route composition.
- **Hierarchy:** One active chapter dominates the reading field. The previous and next stages remain visible as quiet spatial context on desktop; mobile keeps the active chapter first and places compact playback controls immediately after it.
- **Stage grammar:** Seven roles organize the story: origin, early formation, turning point, evolution, milestone, current state, and retrospect. When explicit years, decades, or centuries exist, markers show them; otherwise the interface clearly labels the sequence as conceptual.
- **Visual world:** Mist-white and graphite remain the base. Mineral blue identifies chronology, progress, and controls; muted ochre is reserved for a single annotation or example. Archival hairlines and one oversized translucent stage numeral provide depth without neon, glass, or decorative dashboards.
- **Interaction:** Previous/next, direct marker selection, autoplay/restart, left/right keyboard navigation, evidence opening, and reduced-motion behavior are required states. Controls use a visible mineral-blue focus ring.
- **Motion:** The active chapter enters once with a short vertical and clipped reveal. Autoplay advances at a readable pace and stops at the final retrospective stage.

### Knowledge Map — Resumable Package

- **Package model:** A saved knowledge map includes the overview graph, generated deep maps, manual edits, node mastery, explored atoms, and the learner's last open deep map. Reopening from the library restores the same learning position.
- **Progress strip:** The studio header shows compact explored and cached counts plus one restrained linear indicator. It remains secondary to the map title and collapses to the explored count on narrow screens.
- **Optimistic behavior:** Opening or leaving a deep map updates the visible exploration count immediately. Failed synchronization rolls back only the navigation record; generated map content remains available and the recovery message names the required action.
- **Cache language:** “Explored” means the learner opened the atom; “cached” means its deep map exists and can reopen without generation wait. Never merge the two numbers into a misleading completion score.

### Buttons

- **Primary:** A compact filled sage action for starting or advancing learning.
- **Secondary / utility:** Text-and-icon controls remain borderless and neutral, gaining a pale neutral background on hover.
- **Focus:** Visible focus uses a sage outline with separation from the control edge.

### Composer

- **Style:** White, low-radius, lightly bordered input surface with the application’s defining soft shadow.
- **Tools:** Image, material upload, voice, and plan-generation actions sit above the textarea as quiet text-and-icon buttons.
- **State:** Focus strengthens the sage border and slightly deepens the shadow. Disabled send stays neutral and visibly inactive.

### Navigation

- **Default:** Transparent rows with muted iconography.
- **Active:** Soft-sage background, deeper green text/icon, and a compact count badge where relevant.
- **Mobile:** The rail slides over content instead of permanently consuming screen width.

## Do's and Don'ts

### Do:

- **Do** keep every capability discoverable from the conversation and composer before adding any new navigation destination.
- **Do** use sage for the next meaningful learning action, active learning state, or confirmed mastery.
- **Do** keep cards thread-native, lightly bordered, and information-dense enough to advance the learner without leaving the conversation.
- **Do** preserve generous whitespace around the welcome question and the composer.
- **Do** retain visible keyboard focus, readable muted text, and clear correct/incorrect states.

### Don't:

- **Don't** turn the workspace into a dashboard of competing widgets, charts, or persistent panels.
- **Don't** use gradients, glossy surfaces, high-radius pills, or decorative animation.
- **Don't** add a second saturated accent or use sage merely as ornament.
- **Don't** hide essential learning actions behind hover-only affordances or icon-only labels without accessible names.
