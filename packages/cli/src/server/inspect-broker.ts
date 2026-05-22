import express, { Router } from 'express';

/**
 * Inspect broker.
 *
 * BroadcastChannel only works within a single origin, but our dev setup has
 * the dashboard on one port and the host app on another. The CLI server
 * sits in the middle and is reachable from both, so we use it as a tiny
 * fan-out broker over SSE.
 *
 * - GET  /api/inspect/stream → SSE feed of messages
 * - POST /api/inspect/send   → fan out the JSON body to all stream subscribers
 *
 * Helper and dashboard each consume types they didn't send themselves
 * (helper sends ack/pick, listens for focus/clear/ping; dashboard the
 * reverse), so the echo-back of one's own message is harmless.
 */
export function createInspectBroker(): Router {
  const router = Router();
  const subscribers = new Set<express.Response>();

  const setCors = (res: express.Response): void => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  };

  router.options('/inspect/send', (_req, res) => {
    setCors(res);
    res.sendStatus(204);
  });

  router.options('/inspect/stream', (_req, res) => {
    setCors(res);
    res.sendStatus(204);
  });

  router.get('/inspect/stream', (req, res) => {
    setCors(res);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    res.write(': connected\n\n');

    subscribers.add(res);

    // Heartbeat every 25s so intermediary proxies don't kill the idle conn.
    const heartbeat = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch {
        clearInterval(heartbeat);
      }
    }, 25_000);

    req.on('close', () => {
      clearInterval(heartbeat);
      subscribers.delete(res);
    });
  });

  router.post('/inspect/send', express.json({ limit: '64kb' }), (req, res) => {
    setCors(res);
    const payload = JSON.stringify(req.body ?? {});
    for (const sub of subscribers) {
      try {
        sub.write(`data: ${payload}\n\n`);
      } catch {
        subscribers.delete(sub);
      }
    }
    res.sendStatus(204);
  });

  return router;
}
