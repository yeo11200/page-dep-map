import ora, { type Ora } from 'ora';

export interface Spinner {
  start: () => void;
  succeed: (text: string) => void;
  fail: (text: string) => void;
  text: (text: string) => void;
}

/**
 * Create a spinner wrapper around ora.
 */
export function createSpinner(initialText: string): Spinner {
  const spinner: Ora = ora(initialText);

  return {
    start() {
      spinner.start();
    },
    succeed(text: string) {
      spinner.succeed(text);
    },
    fail(text: string) {
      spinner.fail(text);
    },
    text(text: string) {
      spinner.text = text;
    },
  };
}
