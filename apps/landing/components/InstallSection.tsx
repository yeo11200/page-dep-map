'use client';

import { motion } from 'framer-motion';

const STEPS = [
  {
    label: 'Install',
    code: `npm install -D \\\n  @shinjinseop/page-dep-map \\\n  @shinjinseop/page-dep-map-vite-plugin`,
  },
  {
    label: 'Wire the Vite plugin',
    code: `// vite.config.ts
import pdmInspect from '@shinjinseop/page-dep-map-vite-plugin';

export default defineConfig({
  plugins: [
    react(),
    pdmInspect({ baseUrl: 'http://localhost:3399' }),
  ],
});`,
  },
  {
    label: 'Run dashboard + app',
    code: `# terminal A
npx page-dep-map run .

# terminal B
npm run dev`,
  },
] as const;

export function InstallSection() {
  return (
    <section className="relative mx-auto max-w-6xl px-6 py-24 sm:py-32">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.5 }}
        className="max-w-2xl"
      >
        <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          Three commands to get running.
        </h2>
        <p className="mt-4 text-lg text-white/60">
          Works with Vite React, CRA, Next.js Pages / App Router, and most
          monorepos. TypeScript path aliases supported via{' '}
          <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-sm text-rose-200">
            tsconfig.json
          </code>
          .
        </p>
      </motion.div>

      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {STEPS.map((step, i) => (
          <motion.div
            key={step.label}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.55, delay: i * 0.08 }}
            className="overflow-hidden rounded-2xl border border-white/10 bg-black/40"
          >
            <div className="flex items-center justify-between border-b border-white/5 px-4 py-2 text-xs uppercase tracking-widest text-white/50">
              <span>
                {String(i + 1).padStart(2, '0')} · {step.label}
              </span>
              <span className="font-mono text-rose-300/80">bash</span>
            </div>
            <pre className="overflow-x-auto px-4 py-4 font-mono text-[13px] leading-relaxed text-white/80">
              <code>{step.code}</code>
            </pre>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
