import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/', label: 'Overview' },
  { to: '/pages', label: 'Pages' },
];

export function Sidebar() {
  return (
    <aside className="flex w-56 flex-col border-r bg-card">
      <div className="flex h-14 items-center border-b px-4">
        <span className="text-sm font-semibold tracking-tight">Page Dep Map</span>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                'block rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground',
              )
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
