import { useEffect, useRef, useState } from 'react';

interface FocusPayload {
  componentName: string;
  filePath?: string | null;
  line?: number;
}

interface PickEvent {
  componentName: string;
  filePath?: string | null;
  line?: number;
  domPath?: string;
}

interface AckEvent {
  componentName: string;
  found: boolean;
  matchCount: number;
}

interface InboundMessage {
  type: 'ack' | 'pick' | 'focus' | 'clear' | 'ping';
  componentName?: string;
  found?: boolean;
  matchCount?: number;
  filePath?: string | null;
  line?: number;
  domPath?: string;
}

interface OutboundMessage {
  type: 'focus' | 'clear' | 'ping';
  componentName?: string;
  filePath?: string | null;
  line?: number;
}

export interface InspectBridge {
  isHelperAlive: boolean;
  lastAck: AckEvent | null;
  lastPick: PickEvent | null;
  focus: (payload: FocusPayload) => void;
  clear: () => void;
}

/**
 * Bridge between the dashboard UI and the inspect helper running in the
 * host React app.
 *
 * BroadcastChannel only spans a single origin, but in practice the host
 * app and dashboard run on different ports — so we talk through the CLI
 * server's SSE broker (`/api/inspect/stream`, `/api/inspect/send`) which
 * is reachable from both origins.
 */
export function useInspectBridge(): InspectBridge {
  const sendRef = useRef<((m: OutboundMessage) => void) | null>(null);
  const [isHelperAlive, setHelperAlive] = useState(false);
  const [lastAck, setLastAck] = useState<AckEvent | null>(null);
  const [lastPick, setLastPick] = useState<PickEvent | null>(null);

  useEffect(() => {
    if (typeof EventSource === 'undefined') return;

    const source = new EventSource('/api/inspect/stream');

    const send = (message: OutboundMessage): void => {
      void fetch('/api/inspect/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
        keepalive: true,
      }).catch(() => {
        /* ignore */
      });
    };
    sendRef.current = send;

    source.onmessage = (event: MessageEvent<string>) => {
      if (!event.data) return;
      let data: InboundMessage;
      try {
        data = JSON.parse(event.data) as InboundMessage;
      } catch {
        return;
      }
      if (data.type === 'ack') {
        if (data.componentName === '__ready__') {
          setHelperAlive(true);
          return;
        }
        setLastAck({
          componentName: data.componentName ?? '',
          found: data.found ?? false,
          matchCount: data.matchCount ?? 0,
        });
        if (data.found) setHelperAlive(true);
      } else if (data.type === 'pick') {
        setLastPick({
          componentName: data.componentName ?? '',
          filePath: data.filePath ?? null,
          line: data.line,
          domPath: data.domPath,
        });
        setHelperAlive(true);
      }
    };

    // Ping a few times to nudge the helper to ack. The helper announces
    // itself on init too, but the dashboard hook may mount later, so we
    // need our own poke.
    let attempts = 0;
    const ping = () => {
      attempts += 1;
      send({ type: 'ping' });
    };
    ping();
    const intervalId = window.setInterval(() => {
      if (attempts >= 5) {
        window.clearInterval(intervalId);
        return;
      }
      ping();
    }, 500);

    return () => {
      window.clearInterval(intervalId);
      source.close();
      sendRef.current = null;
    };
  }, []);

  const focus = (payload: FocusPayload) => {
    sendRef.current?.({ type: 'focus', ...payload });
  };
  const clear = () => {
    sendRef.current?.({ type: 'clear' });
  };

  return { isHelperAlive, lastAck, lastPick, focus, clear };
}
