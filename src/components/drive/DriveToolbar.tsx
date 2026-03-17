import { Grid3X3, List, SortAsc, SortDesc, Search, X } from 'lucide-react';
import { useDriveStore } from '@/stores/driveStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState } from 'react';

export const DriveToolbar = () => {
  const { viewMode, setViewMode, sortBy, setSortBy, sortOrder, setSortOrder, searchQuery, setSearchQuery } = useDriveStore();
  const [showSearch, setShowSearch] = useState(false);

  return (
    <div className="flex items-center justify-between gap-2 px-4 py-2 border-b">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {showSearch ? (
          <div className="flex items-center gap-2 flex-1 animate-fade-in">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 border-0 bg-transparent focus-visible:ring-0 text-sm"
              autoFocus
            />
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => { setShowSearch(false); setSearchQuery(''); }}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowSearch(true)}>
            <Search className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as 'name' | 'date' | 'size')}>
          <SelectTrigger className="h-8 w-24 text-xs border-0 bg-transparent">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="date">Date</SelectItem>
            <SelectItem value="size">Size</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}>
          {sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
        </Button>

        <div className="w-px h-5 bg-border mx-1" />

        <Button variant={viewMode === 'grid' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => setViewMode('grid')}>
          <Grid3X3 className="h-4 w-4" />
        </Button>
        <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => setViewMode('list')}>
          <List className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
