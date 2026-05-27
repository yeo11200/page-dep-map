'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import Image from 'next/image';
import { useRef } from 'react';

const SLIDES = [
  {
    src: '/images/dashboard-page-detail.png',
    alt: 'Dashboard page detail screen',
    title: 'Open a page',
    caption:
      'Dashboard shows every metric for the page — props, hooks, queries, deepest prop drilling, child components.',
  },
  {
    src: '/images/dashboard-inspect-modal.png',
    alt: 'Child subtree modal showing API endpoint chips and the Inspect button',
    title: 'Drill into the subtree',
    caption:
      'Each component shows the exact endpoints it calls as method + path chips — and the Inspect button (parent components only) highlights it live on the page.',
  },
  {
    src: '/images/host-inspect-overlay.png',
    alt: 'Host React app with red overlay on TransactionTable',
    title: 'See it live on the page',
    caption:
      'Helper walks the React fiber tree, finds every instance, and overlays a red box with file + line.',
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
        <div className="absolute -inset-6 rounded-3xl bg-gradient-to-br from-rose-500/20 via-fuchsia-500/10 to-indigo-500/15 blur-2xl" />
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
        <span className="font-mono text-sm uppercase tracking-widest text-rose-300/80">
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

export function InspectDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });
  // Parallax glow that drifts as you scroll through the section.
  const glowY = useTransform(scrollYProgress, [0, 1], ['-10%', '10%']);

  return (
    <section
      ref={ref}
      className="relative isolate overflow-hidden border-y border-white/5 bg-gradient-to-b from-black via-[#0a0612] to-black py-24 sm:py-32"
    >
      <motion.div
        style={{ y: glowY }}
        className="pointer-events-none absolute inset-x-0 top-0 h-[90%] opacity-60"
        aria-hidden
      >
        <div className="mx-auto h-full max-w-5xl bg-gradient-to-b from-rose-500/10 via-fuchsia-500/5 to-transparent blur-3xl" />
      </motion.div>

      <div className="relative mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-3xl text-center"
        >
          <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            From a static graph to a{' '}
            <span className="bg-gradient-to-r from-rose-300 to-fuchsia-300 bg-clip-text text-transparent">
              live red box
            </span>
            , in three clicks.
          </h2>
          <p className="mt-4 text-lg text-white/60">
            Dashboard and your dev app talk through an SSE broker, so they don&apos;t
            even have to live on the same origin.
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
