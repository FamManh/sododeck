/**
 * Canvas performance benchmark: 500 nodes / 1,000 edges (spec §12: 60 fps pan/zoom), plus a
 * drag scenario (003), since dragging writes to the document every frame.
 *
 *   pnpm bench                          # from repo root (builds first)
 *   BENCH_CPU_THROTTLE=4 pnpm bench     # simulate a slower machine
 *   BENCH_FLOWS=1 pnpm bench            # the deck also has 21 flows (006); flow scenarios always do
 *
 * Writes bench/results/report-<timestamp>.{json,md}. Headless numbers are
 * indicative only; compare runs on the same machine.
 */
import { mkdir, writeFile } from 'node:fs/promises';

import { expect, test, type Page } from '@playwright/test';

const NODES = Number(process.env.BENCH_NODES ?? 500);
const EDGES = Number(process.env.BENCH_EDGES ?? 1000);
const CPU_THROTTLE = Number(process.env.BENCH_CPU_THROTTLE ?? 1);
const TARGET_FPS = 60;
const GROUPS = process.env.BENCH_GROUPS === '1';
const STICKIES = Math.max(0, Number(process.env.BENCH_STICKIES ?? 0) || 0);
/** Adds 5 features × 4 flows × 10 steps and a fork to the deck of every scenario (006). */
const FLOWS = process.env.BENCH_FLOWS === '1' ? '&flows=1' : '';
const GROUPS_QUERY = GROUPS ? '&groups=1' : '';
const STICKIES_QUERY = STICKIES > 0 ? `&stickies=${String(STICKIES)}` : '';
/** 006 SC-002: a step or a flow's marks are painted within this. */
const FLOW_TARGET_MS = 100;
/** 009 SC-008: command palette search should paint results within this. */
const PALETTE_TARGET_MS = 50;

interface ActionResult {
  scenario: string;
  nodes: number;
  edges: number;
  ms: number;
  targetMs: number;
  meetsTarget: boolean;
}

const actionResults: ActionResult[] = [];

interface ScenarioResult {
  scenario: string;
  nodes: number;
  edges: number;
  renderedNodes: number;
  renderedNodesZoomedIn: number;
  maxZoom: number;
  renderMs: number;
  inPageReadyMs: number;
  avgFps: number;
  p95FrameMs: number;
  maxFrameMs: number;
  longFramesPct: number;
  meetsTarget: boolean;
}

const results: ScenarioResult[] = [];

const viewportZoom = (page: Page) =>
  page.evaluate(() => {
    const transform =
      document.querySelector<HTMLElement>('.react-flow__viewport')?.style.transform ?? '';
    return Number(/scale\(([\d.]+)\)/.exec(transform)?.[1] ?? NaN);
  });

/** A point near the canvas centre where a drag pans (the pane, not a node, edge or panel). */
async function emptyCanvasPoint(
  page: Page,
  box: { x: number; y: number; width: number; height: number },
) {
  const point = await page.evaluate(({ x, y, width, height }) => {
    const okAt = (px: number, py: number) => {
      const stack = document.elementsFromPoint(px, py);
      if (!stack.some((el) => el.classList.contains('react-flow__pane'))) return false;
      return !stack.some(
        (el) =>
          el.matches('[data-testid="deck-node"], [data-testid="sticky-node"]') ||
          el.closest('[data-testid="deck-node"], [data-testid="sticky-node"]') !== null ||
          el.matches('[data-testid="edge-label"], [aria-label^="Go to "]') ||
          el.closest('[data-testid="edge-label"], [aria-label^="Go to "]') !== null,
      );
    };

    const cx = x + width / 2;
    const cy = y + height / 2;
    for (let r = 0; r < Math.min(width, height) / 2; r += 8) {
      for (let a = 0; a < 16; a++) {
        const px = cx + r * Math.cos((a * Math.PI) / 8);
        const py = cy + r * Math.sin((a * Math.PI) / 8);
        if (okAt(px, py)) {
          return { x: px, y: py };
        }
      }
    }

    const left = x + 16;
    const right = x + width - 16;
    const top = y + 16;
    const bottom = y + height - 16;
    for (let py = top; py <= bottom; py += 24) {
      for (let px = left; px <= right; px += 24) {
        if (okAt(px, py)) return { x: px, y: py };
      }
    }

    return null;
  }, box);
  await page.evaluate(() => {
    (window as unknown as { __paused?: boolean }).__paused = false;
  });
  if (!point) throw new Error('no empty canvas point to pan from');
  return point;
}

/** Returns the zoom reached and how many nodes were in the DOM while zoomed in. */
async function panAndZoom(page: Page) {
  const box = await page.getByLabel('Diagram canvas').boundingBox();
  if (!box) throw new Error('canvas not found');
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);

  // Zoom in towards ~100%.
  for (let i = 0; i < 25; i++) {
    await page.mouse.wheel(0, -120);
    await page.waitForTimeout(16);
  }
  const maxZoom = await viewportZoom(page);
  const renderedNodesZoomedIn = await page.getByTestId('deck-node').count();
  // Pan across the graph.
  for (const [dx, dy] of [
    [-500, 0],
    [0, -300],
    [500, 0],
    [0, 300],
  ] as const) {
    // Start on empty canvas: a drag that starts on a component moves the component (003).
    const start = await emptyCanvasPoint(page, box);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + dx, start.y + dy, { steps: 40 });
    await page.mouse.up();
    await page.mouse.move(cx, cy);
  }
  // Zoom back out to the whole graph.
  for (let i = 0; i < 25; i++) {
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(16);
  }
  return { maxZoom, renderedNodesZoomedIn };
}

/** Frame stats; a NaN in `frames` marks a paused stretch, whose gap is not counted. */
function summarize(frames: number[]) {
  const deltas = frames.slice(1).flatMap((t, i) => {
    const prev = frames[i] ?? NaN;
    return Number.isNaN(t) || Number.isNaN(prev) ? [] : [t - prev];
  });
  const sorted = [...deltas].sort((a, b) => a - b);
  const total = deltas.reduce((sum, d) => sum + d, 0);
  const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
  return {
    avgFps: total > 0 ? (deltas.length / total) * 1000 : 0,
    p95FrameMs: p95,
    maxFrameMs: sorted.at(-1) ?? 0,
    longFramesPct: deltas.length
      ? (deltas.filter((d) => d > 33.4).length / deltas.length) * 100
      : 0,
  };
}

async function startRecording(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as {
      __frames: number[];
      __recording: boolean;
      __paused?: boolean;
    };
    w.__frames = [];
    w.__recording = true;
    const tick = (t: number) => {
      if (!w.__paused) w.__frames.push(t);
      if (w.__recording) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

function stopRecording(page: Page) {
  return page.evaluate(() => {
    const w = window as unknown as { __frames: number[]; __recording: boolean };
    w.__recording = false;
    return w.__frames;
  });
}

async function openBench(
  page: Page,
  query: string,
  counts: { nodes: number; edges: number } = { nodes: NODES, edges: EDGES },
) {
  if (CPU_THROTTLE > 1) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE });
  }
  const start = Date.now();
  await page.goto(
    `/bench?nodes=${counts.nodes}&edges=${counts.edges}${query}${FLOWS}${GROUPS_QUERY}${STICKIES_QUERY}`,
  );
  await page.waitForFunction(() => window.__sododeckBench !== undefined, null, {
    timeout: 60_000,
  });
  const renderMs = Date.now() - start;
  // The JSON panel loads Monaco lazily; measure once it shows the deck, not while it loads.
  if (query.includes('json=')) {
    await expect(page.getByRole('region', { name: 'JSON' }).locator('.monaco-editor')).toBeVisible({
      timeout: 60_000,
    });
  }
  const inPageReadyMs = await page.evaluate(() => window.__sododeckBench?.readyAt ?? 0);
  const renderedNodes = await page.getByTestId('deck-node').count();
  expect(renderedNodes).toBeGreaterThan(0);
  return { renderMs, inPageReadyMs: Math.round(inPageReadyMs), renderedNodes };
}

const meetsTarget = (stats: ReturnType<typeof summarize>) =>
  stats.avgFps >= TARGET_FPS * 0.95 && stats.p95FrameMs <= 20;

for (const scenario of [
  { name: 'default', query: '' },
  { name: 'onlyRenderVisibleElements', query: '&visibleOnly=1' },
  // 004 SC-003: the JSON panel's Deck tab open under the canvas (within 10% of default).
  { name: 'jsonDeckOpen', query: '&json=deck' },
]) {
  test(`${scenario.name}: ${NODES} nodes / ${EDGES} edges`, async ({ page }) => {
    const opened = await openBench(page, scenario.query);
    await startRecording(page);
    const startZoom = await viewportZoom(page);
    const { maxZoom, renderedNodesZoomedIn } = await panAndZoom(page);
    // Guard against a silent no-op benchmark: the interactions must actually move the viewport.
    expect(maxZoom).toBeGreaterThan(startZoom * 2);
    const stats = summarize(await stopRecording(page));
    results.push({
      scenario: scenario.name,
      nodes: NODES,
      edges: EDGES,
      ...opened,
      renderedNodesZoomedIn,
      maxZoom,
      ...stats,
      meetsTarget: meetsTarget(stats),
    });
  });
}

test(`groups-collapsed: ${NODES} nodes / ${EDGES} edges`, async ({ page }) => {
  if (!GROUPS) return;
  const opened = await openBench(page, '');
  await page.waitForFunction(() => window.__sododeckBench?.collapseAll !== undefined);
  await page.evaluate(() => window.__sododeckBench?.collapseAll?.() ?? Promise.resolve());
  await page.waitForTimeout(100);
  const renderedNodes = await page.getByTestId('collapsed-group-node').count();
  expect(renderedNodes).toBeGreaterThan(0);
  await startRecording(page);
  const { maxZoom, renderedNodesZoomedIn } = await (async () => {
    const box = await page.getByLabel('Diagram canvas').boundingBox();
    if (!box) throw new Error('canvas not found');
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    for (let i = 0; i < 25; i++) {
      await page.mouse.wheel(0, -120);
      await page.waitForTimeout(16);
    }
    const zoom = await viewportZoom(page);
    const zoomed = await page.getByTestId('collapsed-group-node').count();
    for (const [dx, dy] of [
      [-500, 0],
      [0, -300],
      [500, 0],
      [0, 300],
    ] as const) {
      const start = await emptyCanvasPoint(page, box);
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      await page.mouse.move(start.x + dx, start.y + dy, { steps: 40 });
      await page.mouse.up();
      await page.mouse.move(cx, cy);
    }
    for (let i = 0; i < 25; i++) {
      await page.mouse.wheel(0, 120);
      await page.waitForTimeout(16);
    }
    return { maxZoom: zoom, renderedNodesZoomedIn: zoomed };
  })();
  const stats = summarize(await stopRecording(page));
  results.push({
    scenario: 'groups-collapsed',
    nodes: NODES,
    edges: EDGES,
    ...opened,
    renderedNodes,
    renderedNodesZoomedIn,
    maxZoom,
    ...stats,
    meetsTarget: meetsTarget(stats),
  });
});

/**
 * 003 research R13: dragging writes the node position to the document every frame (through the
 * editor and the incremental snapshot), so it is measured like pan/zoom. 004 SC-003: the same
 * drag with the JSON panel's Deck tab open must stay within 10% of it.
 */
for (const scenario of [
  { name: 'drag', query: '' },
  { name: 'drag+jsonDeck', query: '&json=deck' },
]) {
  test(`${scenario.name}: ${NODES} nodes / ${EDGES} edges`, async ({ page }) => {
    const opened = await openBench(page, scenario.query);
    // The node nearest the middle of the screen (fit view is limited to 30%, so not all are shown).
    const nodeId = await page.evaluate(() => {
      const canvas = document.querySelector<HTMLElement>('[data-canvas]')?.getBoundingClientRect();
      const cx = canvas === undefined ? window.innerWidth / 2 : canvas.left + canvas.width / 2;
      const cy = canvas === undefined ? window.innerHeight / 2 : canvas.top + canvas.height * 0.35;
      let best: { id: string; d: number } | null = null;
      for (const el of document.querySelectorAll<HTMLElement>('[data-testid="deck-node"]')) {
        const r = el.getBoundingClientRect();
        if (
          canvas !== undefined &&
          (r.left < canvas.left + 20 ||
            r.right > canvas.right - 20 ||
            r.top < canvas.top + 20 ||
            r.bottom > canvas.bottom - 20)
        ) {
          continue;
        }
        const atPoint = document.elementsFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        if (!atPoint.includes(el)) continue;
        const d = Math.hypot(r.x + r.width / 2 - cx, r.y + r.height / 2 - cy);
        const id = el.getAttribute('data-node-id');
        if (id !== null && (!best || d < best.d)) best = { id, d };
      }
      if (best) return best.id;
      for (const el of document.querySelectorAll<HTMLElement>('[data-testid="deck-node"]')) {
        const r = el.getBoundingClientRect();
        const d = Math.hypot(r.x + r.width / 2 - cx, r.y + r.height / 2 - cy);
        const id = el.getAttribute('data-node-id');
        if (id !== null && (!best || d < best.d)) best = { id, d };
      }
      return best?.id ?? '';
    });
    const node = page.locator(`[data-testid="deck-node"][data-node-id="${nodeId}"]`);
    const box = await node.boundingBox();
    if (!box) throw new Error('node not found');
    const transform = () =>
      node.evaluate((el) => el.closest<HTMLElement>('.react-flow__node')?.style.transform);
    const before = await transform();

    await startRecording(page);
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    // ~1 s of small pointer moves, like a hand drag.
    for (let i = 1; i <= 60; i++) {
      await page.mouse.move(x + i * 4, y + i * 2);
      await page.waitForTimeout(16);
    }
    await page.mouse.up();
    const stats = summarize(await stopRecording(page));

    const after = await transform();
    // Guard against a silent no-op: the node must have moved (through the document).
    expect(after).not.toBe(before);

    results.push({
      scenario: scenario.name,
      nodes: NODES,
      edges: EDGES,
      ...opened,
      renderedNodesZoomedIn: opened.renderedNodes,
      maxZoom: await viewportZoom(page),
      ...stats,
      meetsTarget: meetsTarget(stats),
    });
  });
}

/**
 * 006 research R15: from the action to the first painted frame with the step badge, on the
 * 500 / 1,000 deck with 21 flows. Median of 5 runs.
 */
for (const scenario of [
  {
    name: 'select flow → marks painted',
    run: (page: Page, i: number) =>
      page.evaluate(
        (id) => window.__sododeckFlowBench?.showFlow(id) ?? Promise.resolve(NaN),
        `flow${String(i % 5)}-0`,
      ),
  },
  // 007 SC-002: flow mode and the next current step are painted within the same target.
  {
    name: 'open flow → flow mode painted',
    run: (page: Page, i: number) =>
      page.evaluate(
        (id) => window.__sododeckFlowBench?.openFlow(id) ?? Promise.resolve(NaN),
        `flow${String(i % 5)}-1`,
      ),
  },
  {
    name: 'next step → current painted',
    run: async (page: Page, i: number) => {
      await page.evaluate(
        (id) => window.__sododeckFlowBench?.openFlow(id) ?? Promise.resolve(NaN),
        `flow${String(i % 5)}-2`,
      );
      // Let the fit-to-flow viewport animation finish, as a user would.
      await page.waitForTimeout(400);
      return page.evaluate(() => window.__sododeckFlowBench?.nextStep() ?? Promise.resolve(NaN));
    },
  },
  {
    name: 'record click → badge',
    run: (page: Page, i: number) =>
      page.evaluate(
        (id) => window.__sododeckFlowBench?.recordClick(id) ?? Promise.resolve(NaN),
        `e${String(i)}`,
      ),
  },
]) {
  test(`${scenario.name}: ${NODES} nodes / ${EDGES} edges`, async ({ page }) => {
    await openBench(page, FLOWS === '' ? '&flows=1' : '');
    await page.waitForFunction(() => window.__sododeckFlowBench !== undefined);
    const runs: number[] = [];
    for (let i = 0; i < 5; i++) {
      // A fresh state each run: nothing shown, no session.
      await page.evaluate(() => {
        window.__sododeckFlowBench?.reset();
      });
      await page.waitForTimeout(100);
      runs.push(await scenario.run(page, i));
    }
    const ms = [...runs].sort((a, b) => a - b)[2] ?? NaN;
    expect(Number.isFinite(ms)).toBe(true);
    actionResults.push({
      scenario: scenario.name,
      nodes: NODES,
      edges: EDGES,
      ms,
      targetMs: FLOW_TARGET_MS,
      meetsTarget: ms < FLOW_TARGET_MS,
    });
  });
}

/** 007 SC-003: 5 s of autoplay at 2× (dimmed deck, looping token, a step every 850 ms). */
test(`playing at 2×: ${NODES} nodes / ${EDGES} edges`, async ({ page }) => {
  const opened = await openBench(page, FLOWS === '' ? '&flows=1' : '');
  await page.waitForFunction(() => window.__sododeckFlowBench !== undefined);
  await page.evaluate(() => window.__sododeckFlowBench?.openFlow('flow0-0') ?? Promise.resolve(NaN));
  await page.waitForTimeout(400);
  await startRecording(page);
  await page.evaluate(() => {
    window.__sododeckFlowBench?.play(2);
  });
  await page.waitForTimeout(5000);
  const stats = summarize(await stopRecording(page));
  // Guard against a silent no-op: autoplay must have moved past step 1.
  const progress = await page.getByRole('region', { name: 'Step player' }).textContent();
  expect(progress).not.toContain('Step 1 of');
  results.push({
    scenario: 'playing at 2×',
    nodes: NODES,
    edges: EDGES,
    ...opened,
    renderedNodesZoomedIn: opened.renderedNodes,
    maxZoom: await viewportZoom(page),
    ...stats,
    meetsTarget: meetsTarget(stats),
  });
});

/** 008 SC-001: a component field edit in the inspector reaches the canvas in < 100 ms. */
test(`inspector title edit → canvas: ${NODES} nodes / ${EDGES} edges`, async ({ page }) => {
  await openBench(page, '&inspector=1');
  await page.waitForFunction(() => window.__sododeckInspectorBench !== undefined);
  const runs: number[] = [];
  for (let i = 0; i < 5; i++) {
    runs.push(
      await page.evaluate(
        ([id, title]) =>
          window.__sododeckInspectorBench?.editTitle(id, title) ?? Promise.resolve(NaN),
        [`n${String(i)}`, `Renamed ${String(i)}`] as const,
      ),
    );
  }
  const ms = [...runs].sort((a, b) => a - b)[2] ?? NaN;
  expect(Number.isFinite(ms)).toBe(true);
  actionResults.push({
    scenario: 'inspector title edit → canvas',
    nodes: NODES,
    edges: EDGES,
    ms,
    targetMs: FLOW_TARGET_MS,
    meetsTarget: ms < FLOW_TARGET_MS,
  });
});

for (const scenario of ['collapse-toggle', 'focus'] as const) {
  test(`${scenario}: ${NODES} nodes / ${EDGES} edges`, async ({ page }) => {
    if (!GROUPS) return;
    await openBench(page, '');
    await page.waitForFunction(
      () =>
        window.__sododeckBench !== undefined &&
        window.__sododeckBench.prepareFocus !== undefined &&
        window.__sododeckBench.toggleCollapse !== undefined &&
        window.__sododeckBench.focus !== undefined,
    );
    const runs: number[] = [];
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => {
        window.__sododeckBench?.resetViewModes?.();
      });
      await page.waitForTimeout(100);
      if (scenario === 'focus') {
        await page.evaluate(() => {
          const bench = window.__sododeckBench;
          if (bench === undefined || bench.prepareFocus === undefined) return Promise.resolve();
          return bench.prepareFocus('n0');
        });
      }
      runs.push(
        await page.evaluate(
          scenario === 'collapse-toggle'
            ? () => window.__sododeckBench?.toggleCollapse?.('g0') ?? Promise.resolve(NaN)
            : () => window.__sododeckBench?.focus?.('n0') ?? Promise.resolve(NaN),
        ),
      );
    }
    const ms = [...runs].sort((a, b) => a - b)[2] ?? NaN;
    expect(Number.isFinite(ms)).toBe(true);
    actionResults.push({
      scenario,
      nodes: NODES,
      edges: EDGES,
      ms,
      targetMs: FLOW_TARGET_MS,
      meetsTarget: ms < FLOW_TARGET_MS,
    });
  });
}

test(`⌘K type → results: 2000 nodes / 4000 edges`, async ({ page }) => {
  const counts = { nodes: 2000, edges: 4000 };
  await openBench(page, '', counts);
  await page.waitForFunction(() => window.__sododeckPaletteBench !== undefined);
  const runs: number[] = [];
  for (let i = 0; i < 5; i++) {
    runs.push(
      await page.evaluate(
        ([query, matchText]) =>
          window.__sododeckPaletteBench?.search(query, matchText) ?? Promise.resolve(NaN),
        ['Node 1999', 'Node 1999'] as const,
      ),
    );
  }
  const ms = [...runs].sort((a, b) => a - b)[2] ?? NaN;
  expect(Number.isFinite(ms)).toBe(true);
  actionResults.push({
    scenario: '⌘K type → results',
    nodes: counts.nodes,
    edges: counts.edges,
    ms,
    targetMs: PALETTE_TARGET_MS,
    meetsTarget: ms < PALETTE_TARGET_MS,
  });
});

test.afterAll(async () => {
  if (results.length === 0 && actionResults.length === 0) return;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = new URL('./results/', import.meta.url);
  await mkdir(dir, { recursive: true });

  const fmt = (n: number) => n.toFixed(1);
  const md = [
    `# Canvas benchmark — ${new Date().toISOString()}`,
    '',
    `Target: ${TARGET_FPS} fps pan/zoom and drag at ${NODES} nodes / ${EDGES} edges. Groups: ${String(GROUPS)}. Stickies: ${String(STICKIES)}. CPU throttle: ${CPU_THROTTLE}×. Headless Chromium; indicative only.`,
    '',
    '| Scenario | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...results.map(
      (r) =>
        `| ${r.scenario} | ${r.renderedNodes} / ${r.renderedNodesZoomedIn} of ${r.nodes} | ${r.maxZoom.toFixed(2)} | ${r.renderMs} | ${r.inPageReadyMs} | ${fmt(r.avgFps)} | ${fmt(r.p95FrameMs)} | ${fmt(r.maxFrameMs)} | ${fmt(r.longFramesPct)}% | ${r.meetsTarget ? 'yes' : 'no'} |`,
    ),
    '',
    `Action scenarios (006, 007, 008, 009): median of 5. Deck flows: ${FLOWS === '' ? 'flow scenarios only' : 'every scenario'}.`,
    '',
    '| Scenario | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |',
    '| --- | --- | --- | --- | --- |',
    ...actionResults.map(
      (r) =>
        `| ${r.scenario} | ${r.nodes} / ${r.edges} | ${fmt(r.ms)} | ${String(r.targetMs)} | ${r.meetsTarget ? 'yes' : 'no'} |`,
    ),
    '',
  ].join('\n');

  await writeFile(
    new URL(`report-${stamp}.json`, dir),
    JSON.stringify(
      {
        cpuThrottle: CPU_THROTTLE,
        flows: FLOWS !== '',
        groups: GROUPS,
        stickies: STICKIES,
        results,
        actionResults,
      },
      null,
      2,
    ),
  );
  await writeFile(new URL(`report-${stamp}.md`, dir), md);
  console.log(`\n${md}\nReport written to bench/results/report-${stamp}.{json,md}`);
});
