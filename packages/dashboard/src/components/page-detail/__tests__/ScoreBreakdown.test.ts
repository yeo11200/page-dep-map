import { describe, expect, it } from 'vitest';
import type { PageMetrics } from '@page-dep-map/shared';
import { handleGetScoreContributions } from '../ScoreBreakdown';

const baseMetrics: PageMetrics = {
  complexityScore: 0,
  riskLevel: 'critical',
  propsCount: 0,
  requiredPropsCount: 0,
  optionalPropsCount: 0,
  queryCount: 0,
  storeUsageCount: 0,
  contextUsageCount: 0,
  hookCount: 0,
  effectCount: 0,
  conditionalBranchCount: 0,
  childComponentCount: 0,
  componentTreeDepth: 0,
  maxDrillingDepth: 0,
  passThroughPropsCount: 0,
  derivedDataPropCount: 0,
  sharedDependencyCount: 0,
};

describe('handleGetScoreContributions', () => {
  it('returns the top five metric contributions in descending point order', () => {
    const rows = handleGetScoreContributions({
      ...baseMetrics,
      effectCount: 5,
      maxDrillingDepth: 4,
      passThroughPropsCount: 3,
      queryCount: 3,
      derivedDataPropCount: 2,
      storeUsageCount: 4,
      contextUsageCount: 1,
      propsCount: 7,
    });

    expect(rows.map((row) => row.key)).toEqual([
      'effectCount',
      'maxDrillingDepth',
      'passThroughPropsCount',
      'storeUsageCount',
      'propsCount',
    ]);
    expect(rows.map((row) => row.contribution)).toEqual([15, 12, 9, 8, 7]);
    expect(rows[3]).toMatchObject({
      label: 'stores',
      value: 4,
      weight: 2,
      contribution: 8,
    });
  });
});
