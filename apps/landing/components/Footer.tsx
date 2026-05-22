export function Footer() {
  return (
    <footer className="border-t border-white/5 bg-black">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-6 py-12 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="font-mono text-sm font-semibold text-white">
            page-dep-map
          </div>
          <p className="mt-1 text-xs text-white/40">
            MIT License · Built by{' '}
            <a
              href="https://github.com/yeo11200"
              target="_blank"
              rel="noreferrer"
              className="text-white/60 underline-offset-4 hover:underline"
            >
              @yeo11200
            </a>
          </p>
        </div>
        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-white/60">
          <a
            href="https://www.npmjs.com/package/@shinjinseop/page-dep-map"
            target="_blank"
            rel="noreferrer"
            className="hover:text-white"
          >
            CLI on npm
          </a>
          <a
            href="https://www.npmjs.com/package/@shinjinseop/page-dep-map-vite-plugin"
            target="_blank"
            rel="noreferrer"
            className="hover:text-white"
          >
            Vite plugin on npm
          </a>
          <a
            href="https://github.com/yeo11200/page-dep-map"
            target="_blank"
            rel="noreferrer"
            className="hover:text-white"
          >
            GitHub
          </a>
          <a
            href="https://github.com/yeo11200/page-dep-map/issues"
            target="_blank"
            rel="noreferrer"
            className="hover:text-white"
          >
            Issues
          </a>
        </nav>
      </div>
    </footer>
  );
}
