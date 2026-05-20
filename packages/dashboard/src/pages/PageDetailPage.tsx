import { useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDependencyReport, usePageDetail, usePages } from '@/api/queries';
import { fetchPageDetail as fetchDetailApi } from '@/api/client';
import { PageHeroSection } from '@/components/page-detail/PageHeroSection';
import { DirectPropsSection } from '@/components/page-detail/DirectPropsSection';
import { DependenciesSection } from '@/components/page-detail/DependenciesSection';
import { PropFlowSection } from '@/components/page-detail/PropFlowSection';
import { DeepestPropsSection } from '@/components/page-detail/DeepestPropsSection';
import { DerivedDataSection } from '@/components/page-detail/DerivedDataSection';
import { LikelyIssuesSection, type MetricKey } from '@/components/page-detail/LikelyIssuesSection';
import { MetricsSection } from '@/components/page-detail/MetricsSection';
import { ComponentTreeModal } from '@/components/page-detail/ComponentTreeModal';
import { ComponentDependencyModal } from '@/components/page-detail/ComponentDependencyModal';
import { PageDetailNav, type NavItem } from '@/components/page-detail/PageDetailNav';
import { EmptyState } from '@/components/shared/EmptyState';
import type { DependencyTreeNode } from '@/types/dependency-report';

const BASE_NAV_ITEMS: NavItem[] = [
  { id: 'hero', label: 'Overview' },
  { id: 'issues', label: 'Likely Issues' },
  { id: 'props', label: 'Direct Props' },
  { id: 'dependencies', label: 'Dependencies' },
  { id: 'flow', label: 'Prop Flow' },
  { id: 'deepest', label: 'Deepest Props' },
  { id: 'metrics', label: 'Metrics' },
];

const DERIVED_NAV_ITEM: NavItem = { id: 'derived', label: 'Derived Data' };

export function PageDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { data: detail, isLoading, error } = usePageDetail(slug ?? '');
  const { data: allPages } = usePages();
  const { data: dependencyReport } = useDependencyReport();

  const [modalOpen, setModalOpen] = useState(false);
  const [modalComponent, setModalComponent] = useState('');
  const [dependencyModalNode, setDependencyModalNode] = useState<DependencyTreeNode | null>(null);
  const [highlightedMetric, setHighlightedMetric] = useState<MetricKey | null>(null);
  const highlightTimer = useRef<number | null>(null);

  const handleChildClick = useCallback((childName: string) => {
    setModalComponent(childName);
    setModalOpen(true);
  }, []);

  const handleMetricJump = useCallback((key: MetricKey) => {
    const el = document.getElementById(`metric-${key}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setHighlightedMetric(key);
    if (highlightTimer.current) {
      window.clearTimeout(highlightTimer.current);
    }
    highlightTimer.current = window.setTimeout(() => {
      setHighlightedMetric(null);
      highlightTimer.current = null;
    }, 1500);
  }, []);

  if (!slug) {
    return (
      <EmptyState
        title="Page not found"
        description="No page name was provided."
        action={
          <button
            onClick={() => navigate('/pages')}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Back to Pages
          </button>
        }
      />
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-40 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => navigate('/pages')}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; Back to Pages
        </button>
        <EmptyState
          title="Failed to load page"
          description={error.message}
          action={
            <button
              onClick={() => window.location.reload()}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Retry
            </button>
          }
        />
      </div>
    );
  }

  if (!detail) {
    return (
      <EmptyState
        title="Page not found"
        description={`No analysis data found for "${slug}".`}
        action={
          <button
            onClick={() => navigate('/pages')}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Back to Pages
          </button>
        }
      />
    );
  }

  const hasDerived = detail.derivedDataProps.length > 0;
  // Derived nav slot lives between "deepest" and "metrics" so users keep a
  // stable mental map even when the section is conditionally hidden.
  const navItems: NavItem[] = hasDerived
    ? [...BASE_NAV_ITEMS.slice(0, 6), DERIVED_NAV_ITEM, ...BASE_NAV_ITEMS.slice(6)]
    : BASE_NAV_ITEMS;
  const dependencyPage = dependencyReport?.pages.find((page) => page.pageName === detail.pageName);
  const dependencyChildren = dependencyPage?.tree[0]?.children ?? [];

  return (
    <div className="space-y-4">
      <div className="lg:grid lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-8">
        <PageDetailNav items={navItems} />

        <div className="min-w-0 space-y-6">
          <section id="hero" className="scroll-mt-4">
            <PageHeroSection detail={detail} onBackToPages={() => navigate('/pages')} />
          </section>

          <section id="issues" className="scroll-mt-4">
            <LikelyIssuesSection
              issues={detail.likelyIssues}
              metrics={detail.metrics}
              onMetricClick={handleMetricJump}
            />
          </section>

          <section id="props" className="scroll-mt-4">
            <DirectPropsSection props={detail.directProps} />
          </section>
          <section id="dependencies" className="scroll-mt-4">
            <DependenciesSection
              detail={detail}
              allPages={allPages ?? []}
              onChildClick={handleChildClick}
              dependencyChildren={dependencyChildren}
              onComponentClick={setDependencyModalNode}
            />
          </section>
          <section id="flow" className="scroll-mt-4">
            <PropFlowSection flows={detail.propFlows} />
          </section>
          <section id="deepest" className="scroll-mt-4">
            <DeepestPropsSection props={detail.deepestProps} />
          </section>
          {hasDerived && (
            <section id="derived" className="scroll-mt-4">
              <DerivedDataSection derivedProps={detail.derivedDataProps} />
            </section>
          )}
          <section id="metrics" className="scroll-mt-4">
            <MetricsSection metrics={detail.metrics} highlightedMetric={highlightedMetric} />
          </section>

          <ComponentTreeModal
            isOpen={modalOpen}
            onClose={() => setModalOpen(false)}
            componentName={modalComponent}
            parentFilePath={detail.filePath}
            allPages={allPages ?? []}
            fetchDetail={fetchDetailApi}
          />
          <ComponentDependencyModal
            isOpen={!!dependencyModalNode}
            node={dependencyModalNode}
            onClose={() => setDependencyModalNode(null)}
          />
        </div>
      </div>
    </div>
  );
}
