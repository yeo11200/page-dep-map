import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export interface NavItem {
  id: string;
  label: string;
}

interface PageDetailNavProps {
  items: NavItem[];
  /** Optional scroll container; defaults to window. */
  scrollRoot?: HTMLElement | null;
}

/**
 * Left-rail sticky section nav (lg+). Tracks the active section via
 * IntersectionObserver and lets users jump between sections.
 * Hidden on small screens to avoid eating horizontal space.
 */
export function PageDetailNav({ items, scrollRoot }: PageDetailNavProps) {
  const [activeId, setActiveId] = useState<string>(items[0]?.id ?? '');
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (items.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) {
          setActiveId(visible[0].target.id);
        }
      },
      {
        root: scrollRoot ?? null,
        rootMargin: '-20% 0px -70% 0px',
        threshold: [0, 0.1, 0.5],
      },
    );

    const elements: Element[] = [];
    for (const item of items) {
      const el = document.getElementById(item.id);
      if (el) {
        observer.observe(el);
        elements.push(el);
      }
    }

    return () => {
      for (const el of elements) observer.unobserve(el);
      observer.disconnect();
    };
  }, [items, scrollRoot]);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    el.style.scrollMarginTop = '16px';
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveId(id);
    history.replaceState(null, '', `#${id}`);
  };

  return (
    <nav
      aria-label="Section navigation"
      className="hidden lg:sticky lg:top-6 lg:block lg:self-start"
    >
      <p className="px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        On this page
      </p>
      <ul ref={listRef} className="space-y-0.5">
        {items.map((item) => {
          const isActive = activeId === item.id;
          return (
            <li key={item.id}>
              <a
                data-nav-id={item.id}
                href={`#${item.id}`}
                onClick={(e) => handleClick(e, item.id)}
                className={cn(
                  'block border-l-2 py-1.5 pr-3 text-sm transition-colors',
                  isActive
                    ? 'border-primary bg-accent pl-2.5 font-medium text-foreground'
                    : 'border-transparent pl-3 text-muted-foreground hover:text-foreground',
                )}
              >
                {item.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
