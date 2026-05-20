import { describe, expect, it } from 'vitest';
import type { PageMetrics } from '@page-dep-map/shared';
import { handleGetMetricRows } from '../MetricsSection';

const metrics: PageMetrics = {
  complexityScore: 72,
  riskLevel: 'critical',
  propsCount: 8,
  requiredPropsCount: 6,
  optionalPropsCount: 2,
  queryCount: 3,
  storeUsageCount: 2,
  contextUsageCount: 1,
  hookCount: 6,
  effectCount: 5,
  conditionalBranchCount: 4,
  childComponentCount: 7,
  maxDrillingDepth: 4,
  passThroughPropsCount: 3,
  derivedDataPropCount: 2,
  sharedDependencyCount: 5,
};

describe('handleGetMetricRows', () => {
  it('returns metric rows with explicit scoring weights in display order', () => {
    expect(handleGetMetricRows(metrics)).toEqual([
      { label: 'Total Props', key: 'propsCount', value: 8, weight: 1 },
      { label: 'Required Props', key: 'requiredPropsCount', value: 6, weight: 1 },
      { label: 'Optional Props', key: 'optionalPropsCount', value: 2, weight: 0 },
      { label: 'Query Count', key: 'queryCount', value: 3, weight: 2 },
      { label: 'Store Usages', key: 'storeUsageCount', value: 2, weight: 2 },
      { label: 'Context Usages', key: 'contextUsageCount', value: 1, weight: 2 },
      { label: 'Hook Count', key: 'hookCount', value: 6, weight: 1 },
      { label: 'Effect Count', key: 'effectCount', value: 5, weight: 3 },
      { label: 'Conditional Branches', key: 'conditionalBranchCount', value: 4, weight: 1 },
      { label: 'Child Components', key: 'childComponentCount', value: 7, weight: 1 },
      { label: 'Max Drilling Depth', key: 'maxDrillingDepth', value: 4, weight: 3 },
      { label: 'Pass-Through Props', key: 'passThroughPropsCount', value: 3, weight: 3 },
      { label: 'Derived Data Props', key: 'derivedDataPropCount', value: 2, weight: 2 },
      { label: 'Shared Dependencies', key: 'sharedDependencyCount', value: 5, weight: 1 },
    ]);
  });
});
