import { describe, expect, it } from 'vitest';
import type { PageMetrics } from '@page-dep-map/shared';
import { handleGetIssueMetricChips } from '../LikelyIssuesSection';

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

describe('handleGetIssueMetricChips', () => {
  it('maps issue ids to metric chip labels and anchors', () => {
    expect(handleGetIssueMetricChips('DATA_ORCHESTRATOR', metrics)).toEqual([
      { key: 'queryCount', label: 'queries: 3' },
      { key: 'childComponentCount', label: 'children: 7' },
    ]);
    expect(handleGetIssueMetricChips('EFFECT_NO_QUERY', { ...metrics, queryCount: 0 })).toEqual([
      { key: 'effectCount', label: 'effects: 5' },
      { key: 'queryCount', label: 'queries: 0' },
    ]);
  });

  it('does not render metric chips for spread or unknown issues', () => {
    expect(handleGetIssueMetricChips('SPREAD_DETECTED', metrics)).toEqual([]);
    expect(handleGetIssueMetricChips('CUSTOM_RULE', metrics)).toEqual([]);
  });
});
