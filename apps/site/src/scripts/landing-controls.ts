/**
 * The landing page's other controls: the code panel tabs (WAI-ARIA tabs, manual activation) and
 * picking a card in the Code section, which lights its JSON lines.
 */

function activate(tabs: readonly HTMLElement[], tab: HTMLElement, focus: boolean) {
  for (const other of tabs) {
    const on = other === tab;
    other.setAttribute('aria-selected', String(on));
    other.tabIndex = on ? 0 : -1;
    const panelId = other.getAttribute('aria-controls');
    const panel = panelId === null ? null : document.getElementById(panelId);
    if (panel !== null) panel.hidden = !on;
  }
  if (focus) tab.focus();
}

function wireTabs(list: HTMLElement) {
  const tabs = [...list.querySelectorAll<HTMLElement>('[role="tab"]')];
  list.addEventListener('click', (event) => {
    const tab =
      event.target instanceof Element ? event.target.closest<HTMLElement>('[role="tab"]') : null;
    if (tab !== null) activate(tabs, tab, false);
  });
  list.addEventListener('keydown', (event) => {
    const i = tabs.findIndex((tab) => tab === document.activeElement);
    if (i < 0) return;
    const to =
      event.key === 'ArrowRight'
        ? (i + 1) % tabs.length
        : event.key === 'ArrowLeft'
          ? (i - 1 + tabs.length) % tabs.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? tabs.length - 1
              : -1;
    const tab = tabs[to];
    if (tab === undefined) return;
    event.preventDefault();
    activate(tabs, tab, true);
  });
}

/** Picks `key` in a pick root: its toggle pressed, its code lines lit, the others not. */
export function pick(root: HTMLElement, key: string): void {
  for (const button of root.querySelectorAll<HTMLElement>('[data-pick]')) {
    button.setAttribute('aria-pressed', String(button.dataset.pick === key));
  }
  for (const line of root.querySelectorAll<HTMLElement>('[data-ref]')) {
    line.toggleAttribute('data-on', line.dataset.ref === key);
  }
}

export function startLandingControls(root: ParentNode = document): void {
  for (const list of root.querySelectorAll<HTMLElement>('[role="tablist"]')) wireTabs(list);
  for (const pickRoot of root.querySelectorAll<HTMLElement>('[data-pick-root]')) {
    pickRoot.addEventListener('click', (event) => {
      const button =
        event.target instanceof Element ? event.target.closest<HTMLElement>('[data-pick]') : null;
      const key = button?.dataset.pick;
      if (key !== undefined) pick(pickRoot, key);
    });
  }
}
