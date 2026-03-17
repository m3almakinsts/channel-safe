import { ChevronRight } from 'lucide-react';
import { useDriveStore } from '@/stores/driveStore';

export const Breadcrumbs = () => {
  const { breadcrumbs, setCurrentFolder } = useDriveStore();

  return (
    <nav className="flex items-center gap-1 text-sm overflow-x-auto py-2 px-1">
      {breadcrumbs.map((crumb, idx) => (
        <div key={crumb.id ?? 'root'} className="flex items-center gap-1 shrink-0">
          {idx > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
          <button
            onClick={() => setCurrentFolder(crumb.id)}
            className={`px-2 py-1 rounded-md transition-colors font-medium ${
              idx === breadcrumbs.length - 1
                ? 'text-foreground'
                : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground'
            }`}
          >
            {crumb.name}
          </button>
        </div>
      ))}
    </nav>
  );
};
