/**
 * Open a URL in the default browser.
 * Wraps the `open` package. Silently ignores errors.
 */
export async function openBrowser(url: string): Promise<void> {
  try {
    const open = await import('open');
    await open.default(url);
  } catch {
    // Silently ignore — browser open is best-effort
  }
}
