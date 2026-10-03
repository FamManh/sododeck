/**
 * Landing page copy, from the design board (`sododeck-landing.js`, headline A chosen). English
 * only; never names other diagram or database tools.
 */
export const COPY = {
  hero: {
    title: 'Describe your system. Get a living map.',
    lead: 'Your agent writes the architecture as one open file. Sododeck opens it as a living map: services, flows, rules and the tables behind them, on one canvas.',
    small: 'Runs with your own AI. Nothing leaves your browser.',
    generate: [
      'From a description, a codebase or Mermaid text',
      'Validated before it opens',
      'Laid out automatically',
    ],
  },
  cta: { start: 'Start drawing — no sign-up', skill: 'Get the AI skill', open: 'Open app' },
  proof: ['No account', 'Works offline', 'Open JSON format', 'Nothing sent anywhere'],
  explore: {
    eyebrow: 'Step 2 · Explore',
    title: 'See the whole system, then just the part you need',
    body: 'Zoom out and cards become icons; zoom in and they show fields and tags. Focus a card to see only what it talks to, or open a group to work inside it.',
    captions: [
      ['Saved views', 'Keep a named camera and filter for each audience.'],
      ['Auto-layout', 'Arrange the deck in one step. Pinned cards stay where you put them.'],
      ['Search', 'Jump to any card, table or step by name or id.'],
    ],
  },
  flows: {
    eyebrow: 'Step 3 · Flows',
    title: 'Watch a flow run end to end',
    body: 'Flows are objects with steps, conditions and rules, not coloured lines. Play one and the deck deals each step in order; a branch shows where the path splits.',
  },
  knowledge: {
    eyebrow: 'Step 4 · Knowledge',
    title: 'Rules live where they apply',
    body: 'Attach a decision table to the step it governs. The inspector shows the step, its condition and its rule. Stickies and notes hold what is still open.',
  },
  database: {
    eyebrow: 'Step 5 · Database',
    title: 'The tables behind the map, on the same canvas',
    body: 'Open a database card and its tables are there: columns, keys, enums and indexes, with relationships attached to the columns they join. One SQL dialect per deck: Postgres, MySQL or SQLite.',
    points: [
      'Draw tables, or import SQL and DBML.',
      'Flows show which tables each step touches.',
      'Export runnable SQL for your dialect.',
    ],
  },
  code: {
    eyebrow: 'Step 6 · Code',
    title: 'One document, two views',
    body: 'The canvas and the code panel edit the same file. Select a card and its JSON is highlighted; change the JSON or the DBML and the canvas follows.',
  },
  edit: {
    eyebrow: 'Step 7 · Edit',
    title: 'AI drafts it. You own it.',
    body: 'Change anything by hand: rename a card in place, pick colours for cards and tags, align with guides, snap and resize, and re-route a connector by dragging its bends.',
  },
  local: {
    eyebrow: 'Step 8 · Own your file',
    title: 'Your decks stay on your machine',
    body: 'No account. Decks live in your browser and keep working offline, and nothing is sent anywhere. The format is open JSON, so your work is never locked in.',
  },
  final: {
    title: 'Start with a prompt, or with a blank canvas.',
    body: 'Sododeck runs in your browser. Bring your own AI, or draw it by hand.',
  },
} as const;
