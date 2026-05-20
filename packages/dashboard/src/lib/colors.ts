import type { RiskLevel, RuleSeverity } from '@page-dep-map/shared';

export const RISK_COLORS: Record<RiskLevel, { bg: string; text: string; border: string; fill: string }> = {
  healthy:  { bg: 'bg-green-100',  text: 'text-green-800',  border: 'border-green-200',  fill: '#22c55e' },
  moderate: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200', fill: '#eab308' },
  warning:  { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200', fill: '#f97316' },
  critical: { bg: 'bg-red-100',    text: 'text-red-800',    border: 'border-red-200',    fill: '#ef4444' },
};

export const RISK_DARK_COLORS: Record<RiskLevel, { bg: string; text: string; border: string }> = {
  healthy:  { bg: 'dark:bg-green-950',  text: 'dark:text-green-300',  border: 'dark:border-green-800' },
  moderate: { bg: 'dark:bg-yellow-950', text: 'dark:text-yellow-300', border: 'dark:border-yellow-800' },
  warning:  { bg: 'dark:bg-orange-950', text: 'dark:text-orange-300', border: 'dark:border-orange-800' },
  critical: { bg: 'dark:bg-red-950',    text: 'dark:text-red-300',    border: 'dark:border-red-800' },
};

export const SEVERITY_COLORS: Record<RuleSeverity, { bg: string; text: string; border: string }> = {
  critical: { bg: 'bg-red-100',  text: 'text-red-800',  border: 'border-red-200' },
  warning:  { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' },
  info:     { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
};
