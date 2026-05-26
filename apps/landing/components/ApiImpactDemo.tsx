'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import Image from 'next/image';
import { useRef } from 'react';

const SLIDES = [
  {
    src: '/images/dashboard-apis-list.png',
    alt: 'API list with Impact column and tier filters',
    title: 'Every endpoint, scored by change risk',
    caption:
      'A reverse index of API call sites — sortable by impact, filterable by tier (reached / orphan) and HTTP method. Critical endpoints with risky-page consumers float to the top.',
  },
  {
    src: '/images/dashboard-apis-list-filtered.png',
    alt: 'API list filtered to critical impact',
    title: 'Focus the danger zone in one click',
    caption:
      'Impact = critical filter narrows 30 endpoints down to the 5 that fan out across every page. Auth, audit-log, server-date — the things a backend rename would set on fire.',
  },
  {
    src: '/images/dashboard-apis-detail-critical.png',
    alt: 'Endpoint detail showing direct callers, used-in components, render path, and pages',
    title: 'See who actually uses it',
    caption:
      'Direct callers (1-hop), intermediate hook wrappers, the first React component that touches the hook, then a collapsible render path up to the page. Backend-impact triage without grep.',
  },
] as const;

function Slide({
  index,
  src,
  alt,
  title,
  caption,
}: {
  index: number;
  src: string;
  alt: string;
  title: string;
  caption: string;
}) {
  const fromLeft = index % 2 === 0;
  return (
    <motion.div
      initial={{ opacity: 0, x: fromLeft ? -80 : 80 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, amount: 0.35 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className={`grid items-center gap-10 lg:grid-cols-2 ${
        fromLeft ? '' : 'lg:[&>*:first-child]:order-2'
      }`}
    >
      <div className="relative">
        <div className="absolute -inset-6 rounded-3xl bg-gradient-to-br from-amber-500/20 via-rose-500/10 to-fuchsia-500/15 blur-2xl" />
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/60 shadow-2xl shadow-black/40">
          <Image
            src={src}
            alt={alt}
            width={2880}
            height={1800}
            className="h-auto w-full"
          />
        </div>
      </div>
      <div>
        <span className="font-mono text-sm uppercase tracking-widest text-amber-300/80">
          Step {index + 1}
        </span>
        <h3 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          {title}
        </h3>
        <p className="mt-3 text-lg leading-relaxed text-white/60">{caption}</p>
      </div>
    </motion.div>
  );
}

export function ApiImpactDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });
  // Warm parallax glow that drifts as you scroll through the section —
  // distinct hue from InspectDemo (rose/fuchsia) so the two demos feel
  // like different rooms rather than the same shot twice.
  const glowY = useTransform(scrollYProgress, [0, 1], ['-10%', '10%']);

  return (
    <section
      ref={ref}
      className="relative isolate overflow-hidden border-y border-white/5 bg-gradient-to-b from-black via-[#100a06] to-black py-24 sm:py-32"
    >
      <motion.div
        style={{ y: glowY }}
        className="pointer-events-none absolute inset-x-0 top-0 h-[90%] opacity-60"
        aria-hidden
      >
        <div className="mx-auto h-full max-w-5xl bg-gradient-to-b from-amber-500/10 via-rose-500/5 to-transparent blur-3xl" />
      </motion.div>

      <div className="relative mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-3xl text-center"
        >
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium uppercase tracking-widest text-amber-300">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            new in 0.2
          </div>
          <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            Trace any endpoint to{' '}
            <span className="bg-gradient-to-r from-amber-300 to-rose-300 bg-clip-text text-transparent">
              the components that break
            </span>
            .
          </h2>
          <p className="mt-4 text-lg text-white/60">
            Reverse call-graph from the API call site walks back through hooks,
            wrappers, and renderers — so a backend contract change has a
            visible blast radius before it lands.
          </p>
        </motion.div>

        <div className="mt-16 space-y-24 sm:mt-24 sm:space-y-32">
          {SLIDES.map((slide, i) => (
            <Slide key={slide.src} index={i} {...slide} />
          ))}
        </div>
      </div>
    </section>
  );
}
