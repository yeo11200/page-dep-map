'use client';

import { motion } from 'framer-motion';
import { Activity, Gauge, GitBranch, MousePointerClick } from 'lucide-react';

const FEATURES = [
  {
    icon: Gauge,
    title: 'Page-level risk scoring',
    body: 'Score every page on props, hooks, queries, store/context usage, conditional branches, and prop-drilling depth. Surface the pages that need refactoring first.',
  },
  {
    icon: Activity,
    title: 'Component dependency map',
    body: 'See the full subtree under each page in an interactive modal — including external vs internal components, cycles, and reuse hotspots.',
  },
  {
    icon: GitBranch,
    title: 'API change-impact analysis',
    body: 'Reverse call-graph from every endpoint to the hooks, components, and pages that reach it. One colored badge tells you whether a backend rename is safe or needs a coordination thread.',
  },
  {
    icon: MousePointerClick,
    title: 'Live inspect on the running app',
    body: 'Click a component in the dashboard and the running React app instantly draws a red overlay on every instance. Source file & line included.',
  },
] as const;

export function Features() {
  return (
    <section className="relative mx-auto max-w-6xl px-6 py-24 sm:py-32">
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.5 }}
        className="max-w-3xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl"
      >
        Three lenses on the same codebase, one click apart.
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.5, delay: 0.05 }}
        className="mt-4 max-w-2xl text-lg text-white/60"
      >
        Static analysis tells you <em>which</em> page is heavy. The dashboard
        tells you <em>why</em>. Live inspect tells you <em>where on screen</em>.
      </motion.p>

      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        {FEATURES.map((feat, i) => (
          <motion.div
            key={feat.title}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5, delay: i * 0.08 }}
            className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-6 transition hover:border-white/20"
          >
            <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-rose-300/40 to-transparent" />
            <feat.icon className="h-6 w-6 text-rose-300" aria-hidden />
            <h3 className="mt-4 text-lg font-semibold text-white">{feat.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/60">{feat.body}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
