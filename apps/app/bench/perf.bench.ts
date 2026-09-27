/**
 * Canvas performance benchmark: 500 nodes / 1,000 edges (spec §12: 60 fps pan/zoom).
 *
 *   pnpm bench                          # from repo root (builds first)
 *   BENCH_CPU_THROTTLE=4 pnpm bench     # simulate a slower machine
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
    await page.mouse.down();
    await page.mouse.move(cx + dx, cy + dy, { steps: 40 });
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

function summarize(frames: number[]) {
  const deltas = frames.slice(1).map((t, i) => t - (frames[i] ?? t));
  const sorted = [...deltas].sort((a, b) => a - b);
  const total = (frames.at(-1) ?? 0) - (frames[0] ?? 0);
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

for (const scenario of [
  { name: 'default', query: '' },
  { name: 'onlyRenderVisibleElements', query: '&visibleOnly=1' },
]) {
  test(`${scenario.name}: ${NODES} nodes / ${EDGES} edges`, async ({ page }) => {
    if (CPU_THROTTLE > 1) {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE });
    }

    const start = Date.now();
    await page.goto(`/bench?nodes=${NODES}&edges=${EDGES}${scenario.query}`);
    await page.waitForFunction(() => window.__sododeckBench !== undefined, null, {
      timeout: 60_000,
    });
    const renderMs = Date.now() - start;
    const inPageReadyMs = await page.evaluate(() => window.__sododeckBench?.readyAt ?? 0);
    const renderedNodes = await page.getByTestId('deck-node').count();
    expect(renderedNodes).toBeGreaterThan(0);

    await page.evaluate(() => {
      const w = window as unknown as { __frames: number[]; __recording: boolean };
      w.__frames = [];
      w.__recording = true;
      const tick = (t: number) => {
        w.__frames.push(t);
        if (w.__recording) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    const startZoom = await viewportZoom(page);
    const { maxZoom, renderedNodesZoomedIn } = await panAndZoom(page);
    // Guard against a silent no-op benchmark: the interactions must actually move the viewport.
    expect(maxZoom).toBeGreaterThan(startZoom * 2);
    const frames = await page.evaluate(() => {
      const w = window as unknown as { __frames: number[]; __recording: boolean };
      w.__recording = false;
      return w.__frames;
    });

    const stats = summarize(frames);
    results.push({
      scenario: scenario.name,
      nodes: NODES,
      edges: EDGES,
      renderedNodes,
      renderedNodesZoomedIn,
      maxZoom,
      renderMs,
      inPageReadyMs: Math.round(inPageReadyMs),
      ...stats,
      meetsTarget: stats.avgFps >= TARGET_FPS * 0.95 && stats.p95FrameMs <= 20,
    });
  });
}

test.afterAll(async () => {
  if (results.length === 0) return;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = new URL('./results/', import.meta.url);
  await mkdir(dir, { recursive: true });

  const fmt = (n: number) => n.toFixed(1);
  const md = [
    `# Canvas benchmark — ${new Date().toISOString()}`,
    '',
    `Target: ${TARGET_FPS} fps pan/zoom at ${NODES} nodes / ${EDGES} edges. CPU throttle: ${CPU_THROTTLE}×. Headless Chromium; indicative only.`,
    '',
    '| Scenario | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...results.map(
      (r) =>
        `| ${r.scenario} | ${r.renderedNodes} / ${r.renderedNodesZoomedIn} of ${r.nodes} | ${r.maxZoom.toFixed(2)} | ${r.renderMs} | ${r.inPageReadyMs} | ${fmt(r.avgFps)} | ${fmt(r.p95FrameMs)} | ${fmt(r.maxFrameMs)} | ${fmt(r.longFramesPct)}% | ${r.meetsTarget ? 'yes' : 'no'} |`,
    ),
    '',
  ].join('\n');

  await writeFile(
    new URL(`report-${stamp}.json`, dir),
    JSON.stringify({ cpuThrottle: CPU_THROTTLE, results }, null, 2),
  );
  await writeFile(new URL(`report-${stamp}.md`, dir), md);
  console.log(`\n${md}\nReport written to bench/results/report-${stamp}.{json,md}`);
});
