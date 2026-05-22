/**
 * page-dep-map inspect helper.
 *
 * Loaded into the host React app during dev so the page-dep-map dashboard
 * can ask the page to highlight a specific component on screen.
 *
 * Communication is via BroadcastChannel('pdm-inspect') so dashboard and host
 * app on different ports/origins (same browser) can talk without CORS or
 * postMessage targeting.
 */

interface FocusMessage {
  type: 'focus';
  componentName: string;
  filePath?: string | null;
  line?: number;
}

interface ClearMessage {
  type: 'clear';
}

interface PingMessage {
  type: 'ping';
}

interface AckMessage {
  type: 'ack';
  found: boolean;
  componentName: string;
  matchCount: number;
}

interface PickMessage {
  type: 'pick';
  componentName: string;
  filePath?: string | null;
  line?: number;
  domPath?: string;
}

type InboundMessage = FocusMessage | ClearMessage | PingMessage;
type OutboundMessage = AckMessage | PickMessage;

const CHANNEL_NAME = 'pdm-inspect';
const OVERLAY_ID = '__pdm-inspect-overlay';
const TOOLTIP_ID = '__pdm-inspect-tooltip';
const HOTKEY_BANNER_ID = '__pdm-inspect-banner';
const STORAGE_PICK_MODE = '__pdm_pick_mode';

interface FiberSourceLoc {
  fileName: string;
  lineNumber: number;
  columnNumber?: number;
}

interface FiberLike {
  type?: unknown;
  elementType?: unknown;
  stateNode?: Element | null;
  _debugSource?: FiberSourceLoc;
  _debugOwner?: FiberLike | null;
  child?: FiberLike | null;
  sibling?: FiberLike | null;
  return?: FiberLike | null;
  memoizedProps?: Record<string, unknown>;
}

interface MatchedElement {
  element: Element;
  fiber: FiberLike;
  componentName: string;
  source?: FiberSourceLoc;
}

const FIBER_KEY_PATTERNS = [
  '__reactFiber',
  '__reactInternalInstance',
  '__reactInternalFiber',
];

function findFiberKey(element: Element): string | null {
  for (const prefix of FIBER_KEY_PATTERNS) {
    for (const key of Object.keys(element)) {
      if (key.startsWith(prefix)) return key;
    }
  }
  return null;
}

function getFiber(element: Element): FiberLike | null {
  const key = findFiberKey(element);
  if (!key) return null;
  const raw = (element as unknown as Record<string, unknown>)[key];
  return (raw as FiberLike) ?? null;
}

function readComponentName(fiber: FiberLike | null | undefined): string | null {
  if (!fiber) return null;
  const candidate = (fiber.elementType ?? fiber.type) as unknown;
  if (!candidate) return null;
  if (typeof candidate === 'string') return candidate;
  if (typeof candidate === 'function') {
    const fn = candidate as { displayName?: string; name?: string };
    return fn.displayName ?? fn.name ?? null;
  }
  if (typeof candidate === 'object') {
    const obj = candidate as { displayName?: string; render?: { displayName?: string; name?: string } };
    if (obj.displayName) return obj.displayName;
    if (obj.render?.displayName) return obj.render.displayName;
    if (obj.render?.name) return obj.render.name;
  }
  return null;
}

function fiberOwnerChain(fiber: FiberLike): FiberLike[] {
  const chain: FiberLike[] = [];
  let current: FiberLike | null | undefined = fiber;
  while (current) {
    chain.push(current);
    current = current._debugOwner ?? current.return;
  }
  return chain;
}

function normaliseName(raw: string): string {
  // Handle namespace components like `Toast.Provider` — match base name `Toast`
  return raw.includes('.') ? raw.split('.')[0]! : raw;
}

function findMatchingElements(componentName: string): MatchedElement[] {
  const target = normaliseName(componentName);
  const matches: MatchedElement[] = [];
  // Dedup on the fiber, not the element. A function component (no
  // stateNode) shares one fiber across many descendant elements, so
  // element-based dedup would register one match per descendant — e.g.
  // 24 boxes for a single TransactionTable instance.
  const seenFibers = new Set<FiberLike>();

  const all = document.querySelectorAll('*');
  for (const element of Array.from(all)) {
    const fiber = getFiber(element);
    if (!fiber) continue;

    const chain = fiberOwnerChain(fiber);
    for (const link of chain) {
      const name = readComponentName(link);
      if (!name) continue;
      const linkBase = normaliseName(name);
      if (linkBase !== target && name !== componentName) continue;

      if (seenFibers.has(link)) break;
      seenFibers.add(link);

      // Prefer the fiber's own host element if it has one; otherwise the
      // first DOM element we encountered for this fiber acts as the
      // component's visible root.
      const rootElement = link.stateNode instanceof Element ? link.stateNode : element;
      matches.push({
        element: rootElement,
        fiber: link,
        componentName: name,
        source: link._debugSource,
      });
      break;
    }
  }

  return matches;
}

let overlayElements: HTMLDivElement[] = [];

function clearOverlays(): void {
  for (const el of overlayElements) el.remove();
  overlayElements = [];
  document.getElementById(TOOLTIP_ID)?.remove();
}

function ensureContainer(): HTMLDivElement {
  let container = document.getElementById(OVERLAY_ID) as HTMLDivElement | null;
  if (!container) {
    container = document.createElement('div');
    container.id = OVERLAY_ID;
    Object.assign(container.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '0',
      height: '0',
      pointerEvents: 'none',
      zIndex: '2147483647',
    });
    document.body.appendChild(container);
  }
  return container;
}

function drawOverlayFor(match: MatchedElement, indexLabel: string): void {
  const rect = match.element.getBoundingClientRect();
  const container = ensureContainer();
  const box = document.createElement('div');
  Object.assign(box.style, {
    position: 'fixed',
    top: `${rect.top}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    border: '2px solid rgba(239, 68, 68, 0.9)',
    background: 'rgba(239, 68, 68, 0.12)',
    boxSizing: 'border-box',
    borderRadius: '2px',
    pointerEvents: 'none',
    transition: 'all 80ms ease-out',
  });

  const label = document.createElement('div');
  Object.assign(label.style, {
    position: 'absolute',
    top: '-20px',
    left: '0',
    background: 'rgba(239, 68, 68, 0.95)',
    color: 'white',
    fontSize: '11px',
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, monospace',
    padding: '1px 6px',
    borderRadius: '3px',
    whiteSpace: 'nowrap',
  });
  label.textContent = `${indexLabel}${match.componentName}`;
  box.appendChild(label);

  container.appendChild(box);
  overlayElements.push(box);
}

function showTooltip(match: MatchedElement, totalMatches: number): void {
  document.getElementById(TOOLTIP_ID)?.remove();
  if (!match) return;
  const tooltip = document.createElement('div');
  tooltip.id = TOOLTIP_ID;
  Object.assign(tooltip.style, {
    position: 'fixed',
    bottom: '16px',
    right: '16px',
    zIndex: '2147483647',
    background: 'rgba(15, 23, 42, 0.95)',
    color: 'white',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: '12px',
    padding: '10px 14px',
    borderRadius: '8px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
    pointerEvents: 'none',
    maxWidth: '420px',
  });
  const src = match.source ? `${match.source.fileName}:${match.source.lineNumber}` : '(no source info)';
  tooltip.innerHTML = `
    <div style="font-weight:600;margin-bottom:4px">${escapeHtml(match.componentName)}</div>
    <div style="opacity:0.8">${escapeHtml(src)}</div>
    <div style="opacity:0.6;margin-top:4px">${totalMatches} match${totalMatches === 1 ? '' : 'es'} highlighted</div>
  `;
  document.body.appendChild(tooltip);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function highlight(componentName: string, _filePath?: string | null, line?: number): MatchedElement[] {
  clearOverlays();
  let matches = findMatchingElements(componentName);
  if (line && matches.length > 1) {
    const lineMatches = matches.filter((m) => m.source?.lineNumber === line);
    if (lineMatches.length > 0) matches = lineMatches;
  }
  matches.forEach((m, idx) => {
    const label = matches.length > 1 ? `[${idx + 1}/${matches.length}] ` : '';
    drawOverlayFor(m, label);
  });
  if (matches[0]) showTooltip(matches[0], matches.length);
  return matches;
}

interface Transport {
  send(message: OutboundMessage): void;
  onMessage(handler: (message: InboundMessage) => void): void;
}

function send(transport: Transport, message: OutboundMessage): void {
  transport.send(message);
}

function deriveBrokerBase(): string | null {
  // The helper script is loaded as `${baseUrl}/pdm-inject.js` by the
  // vite plugin. We can recover baseUrl from the script's own URL.
  const current = document.currentScript as HTMLScriptElement | null;
  if (current?.src) {
    try {
      return new URL(current.src).origin;
    } catch {
      /* fall through */
    }
  }
  const tag = document.querySelector('script[data-pdm="inspect-helper"]') as HTMLScriptElement | null;
  if (tag?.src) {
    try {
      return new URL(tag.src).origin;
    } catch {
      /* fall through */
    }
  }
  return null;
}

function createBrokerTransport(base: string): Transport {
  const handlers = new Set<(m: InboundMessage) => void>();
  const source = new EventSource(`${base}/api/inspect/stream`);
  source.onmessage = (event: MessageEvent<string>) => {
    if (!event.data) return;
    try {
      const parsed = JSON.parse(event.data) as InboundMessage;
      handlers.forEach((h) => h(parsed));
    } catch {
      /* ignore malformed */
    }
  };
  source.onerror = () => {
    // EventSource auto-reconnects. Nothing to do.
  };
  return {
    send(message) {
      void fetch(`${base}/api/inspect/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
        keepalive: true,
      }).catch(() => {
        /* ignore network errors */
      });
    },
    onMessage(handler) {
      handlers.add(handler);
    },
  };
}

let resizeRaf: number | null = null;
function scheduleRedraw(currentName: string | null): void {
  if (!currentName) return;
  if (resizeRaf !== null) cancelAnimationFrame(resizeRaf);
  resizeRaf = requestAnimationFrame(() => {
    resizeRaf = null;
    highlight(currentName);
  });
}

function showBanner(text: string): void {
  let banner = document.getElementById(HOTKEY_BANNER_ID) as HTMLDivElement | null;
  if (!banner) {
    banner = document.createElement('div');
    banner.id = HOTKEY_BANNER_ID;
    Object.assign(banner.style, {
      position: 'fixed',
      top: '16px',
      right: '16px',
      zIndex: '2147483647',
      background: 'rgba(15, 23, 42, 0.92)',
      color: 'white',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: '12px',
      padding: '8px 12px',
      borderRadius: '6px',
      boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
      pointerEvents: 'none',
    });
    document.body.appendChild(banner);
  }
  banner.textContent = text;
}

function hideBanner(): void {
  document.getElementById(HOTKEY_BANNER_ID)?.remove();
}

function buildDomPath(element: Element): string {
  const parts: string[] = [];
  let current: Element | null = element;
  while (current && parts.length < 6) {
    const id = current.id ? `#${current.id}` : '';
    const cls = current.classList.length ? `.${Array.from(current.classList).slice(0, 2).join('.')}` : '';
    parts.unshift(`${current.tagName.toLowerCase()}${id}${cls}`);
    current = current.parentElement;
  }
  return parts.join(' > ');
}

function pickComponentFrom(target: Element, transport: Transport): void {
  const fiber = getFiber(target);
  if (!fiber) return;
  const chain = fiberOwnerChain(fiber);
  for (const link of chain) {
    const name = readComponentName(link);
    if (!name) continue;
    if (/^[a-z]/.test(name)) continue; // skip host components like 'div'
    send(transport, {
      type: 'pick',
      componentName: name,
      filePath: link._debugSource?.fileName,
      line: link._debugSource?.lineNumber,
      domPath: buildDomPath(target),
    });
    highlight(name);
    return;
  }
}

function attachPickMode(transport: Transport): void {
  let pickMode = false;

  const enable = () => {
    pickMode = true;
    sessionStorage.setItem(STORAGE_PICK_MODE, '1');
    showBanner('Pick mode: click any element');
    document.body.style.cursor = 'crosshair';
  };
  const disable = () => {
    pickMode = false;
    sessionStorage.removeItem(STORAGE_PICK_MODE);
    hideBanner();
    document.body.style.cursor = '';
  };

  if (sessionStorage.getItem(STORAGE_PICK_MODE) === '1') enable();

  window.addEventListener('keydown', (e) => {
    // Alt+Shift+I toggles pick mode
    if (e.altKey && e.shiftKey && (e.key === 'I' || e.key === 'i')) {
      e.preventDefault();
      pickMode ? disable() : enable();
    }
    if (e.key === 'Escape' && pickMode) {
      disable();
    }
  });

  document.addEventListener(
    'click',
    (e) => {
      if (!pickMode) return;
      const target = e.target as Element | null;
      if (!target) return;
      e.preventDefault();
      e.stopPropagation();
      pickComponentFrom(target, transport);
      disable();
    },
    true,
  );
}

function init(): void {
  if ((window as unknown as { __pdmInspectInitialised?: boolean }).__pdmInspectInitialised) {
    return;
  }
  (window as unknown as { __pdmInspectInitialised?: boolean }).__pdmInspectInitialised = true;

  const base = deriveBrokerBase();
  if (!base) {
    // eslint-disable-next-line no-console
    console.warn('[pdm-helper] could not derive dashboard origin from script tag; inspect disabled.');
    return;
  }

  const transport = createBrokerTransport(base);
  let currentName: string | null = null;

  transport.onMessage((data) => {
    if (data.type === 'focus') {
      currentName = data.componentName;
      const matches = highlight(data.componentName, data.filePath, data.line);
      send(transport, {
        type: 'ack',
        found: matches.length > 0,
        componentName: data.componentName,
        matchCount: matches.length,
      });
    } else if (data.type === 'clear') {
      currentName = null;
      clearOverlays();
    } else if (data.type === 'ping') {
      send(transport, {
        type: 'ack',
        found: false,
        componentName: '__ready__',
        matchCount: 0,
      });
    }
  });

  window.addEventListener('resize', () => scheduleRedraw(currentName));
  window.addEventListener('scroll', () => scheduleRedraw(currentName), true);

  attachPickMode(transport);

  // Announce ready state — covers the case where the dashboard is already
  // subscribed when the helper finishes loading.
  send(transport, {
    type: 'ack',
    found: false,
    componentName: '__ready__',
    matchCount: 0,
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
