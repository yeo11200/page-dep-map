'use client';

import { motion } from 'framer-motion';
import { ArrowRight, Github } from 'lucide-react';
import Image from 'next/image';

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden">
      <div className="aurora" aria-hidden />
      <div className="absolute inset-0 dotted-grid mask-fade-b opacity-40" aria-hidden />

      <div className="relative z-10 mx-auto max-w-6xl px-6 pb-20 pt-24 sm:pt-32 lg:pt-40">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="flex flex-col items-start gap-6"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-widest text-white/70 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
            Open source · v0.1.12
          </span>

          <h1 className="max-w-3xl text-balance text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            Map every React page.{' '}
            <span className="bg-gradient-to-r from-rose-300 via-fuchsia-300 to-indigo-300 bg-clip-text text-transparent">
              Highlight every component, live.
            </span>
          </h1>

          <p className="max-w-2xl text-lg leading-relaxed text-white/70 sm:text-xl">
            <span className="font-mono text-rose-200">page-dep-map</span> statically
            analyzes your React / Next.js pages, scores complexity, finds drilled
            props, and lets you click any component in the dashboard to light it
            up on the running app — in real time.
          </p>

          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              href="https://www.npmjs.com/package/@shinjinseop/page-dep-map"
              target="_blank"
              rel="noreferrer"
              className="group inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
            >
              View on npm
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </a>
            <a
              href="https://github.com/yeo11200/page-dep-map"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/10"
            >
              <Github className="h-4 w-4" />
              Star on GitHub
            </a>
          </div>

          <div className="mt-3 rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 font-mono text-sm text-white/80 backdrop-blur">
            <span className="text-white/40">$</span> npm install -D{' '}
            <span className="text-rose-300">@shinjinseop/page-dep-map</span>{' '}
            <span className="text-rose-300">@shinjinseop/page-dep-map-vite-plugin</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.15 }}
          className="relative mt-16 sm:mt-24"
        >
          <div className="absolute -inset-6 rounded-3xl bg-gradient-to-br from-rose-500/20 via-fuchsia-500/10 to-indigo-500/20 blur-2xl" />
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/60 shadow-2xl shadow-black/40">
            <Image
              src="/images/dashboard-overview.png"
              alt="page-dep-map dashboard overview"
              width={2880}
              height={1800}
              className="h-auto w-full"
              priority
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
