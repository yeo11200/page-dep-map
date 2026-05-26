// Build-time import — the bundler inlines the resolved string into the
// client bundle, so the marketing page always shows the same version
// that was last published to npm without anyone having to remember to
// edit a hardcoded badge.
//
// Bumping `packages/cli/package.json` and rebuilding the landing site
// is enough; no separate landing version bump required.
import cliPkg from '../../../packages/cli/package.json' assert { type: 'json' };

export const CLI_VERSION: string = cliPkg.version;
