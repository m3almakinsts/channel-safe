import { motion } from 'framer-motion';
import { MoreVertical, Star, Trash2, Download, Pencil } from 'lucide-react';
import { useDriveStore, type FileItem, type FolderItem } from '@/stores/driveStore';
import { FileIcon } from './FileIcon';
import { FolderIcon } from './FolderIcon';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.03 } },
};

const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0 },
};

export const FileGrid = () => {
  const { files, folders, viewMode, sortBy, sortOrder, searchQuery, setCurrentFolder, fetchContents, currentFolderId } = useDriveStore();

  const filteredFolders = folders.filter(f => !searchQuery || f.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredFiles = files.filter(f => !searchQuery || f.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const sortedFiles = [...filteredFiles].sort((a, b) => {
    let cmp = 0;
    if (sortBy === 'name') cmp = a.name.localeCompare(b.name);
    else if (sortBy === 'date') cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    else if (sortBy === 'size') cmp = a.size - b.size;
    return sortOrder === 'asc' ? cmp : -cmp;
  });

  const toggleStar = async (type: 'files' | 'folders', id: string, current: boolean) => {
    await supabase.from(type).update({ is_starred: !current }).eq('id', id);
    fetchContents(currentFolderId);
  };

  const moveToTrash = async (type: 'files' | 'folders', id: string) => {
    await supabase.from(type).update({ is_trashed: true, trashed_at: new Date().toISOString() }).eq('id', id);
    toast.success('Moved to trash');
    fetchContents(currentFolderId);
  };

  if (filteredFolders.length === 0 && sortedFiles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <div className="text-6xl mb-4">📂</div>
        <p className="text-lg font-medium">No files here</p>
        <p className="text-sm">Upload files or create a folder to get started</p>
      </div>
    );
  }

  if (viewMode === 'list') {
    return (
      <motion.div variants={container} initial="hidden" animate="show" className="px-4">
        {filteredFolders.map(folder => (
          <FolderListItem key={folder.id} folder={folder} onOpen={() => setCurrentFolder(folder.id)} onToggleStar={() => toggleStar('folders', folder.id, folder.is_starred)} onTrash={() => moveToTrash('folders', folder.id)} />
        ))}
        {sortedFiles.map(file => (
          <FileListItem key={file.id} file={file} onToggleStar={() => toggleStar('files', file.id, file.is_starred)} onTrash={() => moveToTrash('files', file.id)} />
        ))}
      </motion.div>
    );
  }

  return (
    <div className="px-4 space-y-6">
      {filteredFolders.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">Folders</p>
          <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {filteredFolders.map(folder => (
              <FolderGridItem key={folder.id} folder={folder} onOpen={() => setCurrentFolder(folder.id)} onToggleStar={() => toggleStar('folders', folder.id, folder.is_starred)} onTrash={() => moveToTrash('folders', folder.id)} />
            ))}
          </motion.div>
        </div>
      )}

      {sortedFiles.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">Files</p>
          <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {sortedFiles.map(file => (
              <FileGridItem key={file.id} file={file} onToggleStar={() => toggleStar('files', file.id, file.is_starred)} onTrash={() => moveToTrash('files', file.id)} />
            ))}
          </motion.div>
        </div>
      )}
    </div>
  );
};

function ItemMenu({ onToggleStar, onTrash, isStarred }: { onToggleStar: () => void; onTrash: () => void; isStarred: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="p-1 rounded-full hover:bg-surface-hover transition-colors" onClick={e => e.stopPropagation()}>
          <MoreVertical className="h-4 w-4 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={onToggleStar}>
          <Star className={`h-4 w-4 mr-2 ${isStarred ? 'fill-warning text-warning' : ''}`} />
          {isStarred ? 'Unstar' : 'Star'}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onTrash} className="text-destructive">
          <Trash2 className="h-4 w-4 mr-2" />
          Move to trash
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function FolderGridItem({ folder, onOpen, onToggleStar, onTrash }: { folder: FolderItem; onOpen: () => void; onToggleStar: () => void; onTrash: () => void }) {
  return (
    <motion.div
      variants={item}
      onClick={onOpen}
      className="group flex items-center gap-3 p-3 rounded-lg bg-surface hover:bg-surface-hover cursor-pointer transition-all drive-shadow hover:drive-shadow-hover"
    >
      <FolderIcon className="h-5 w-5 shrink-0" />
      <span className="text-sm font-medium truncate flex-1">{folder.name}</span>
      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
        <ItemMenu onToggleStar={onToggleStar} onTrash={onTrash} isStarred={folder.is_starred} />
      </div>
    </motion.div>
  );
}

function FileGridItem({ file, onToggleStar, onTrash }: { file: FileItem; onToggleStar: () => void; onTrash: () => void }) {
  return (
    <motion.div
      variants={item}
      className="group flex flex-col rounded-lg bg-surface hover:bg-surface-hover cursor-pointer transition-all drive-shadow hover:drive-shadow-hover overflow-hidden"
    >
      <div className="h-28 flex items-center justify-center bg-surface">
        <FileIcon mimeType={file.mime_type} className="h-10 w-10" />
      </div>
      <div className="p-3 flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{file.name}</p>
          <p className="text-xs text-muted-foreground">{formatSize(file.size)}</p>
        </div>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <ItemMenu onToggleStar={onToggleStar} onTrash={onTrash} isStarred={file.is_starred} />
        </div>
      </div>
    </motion.div>
  );
}

function FolderListItem({ folder, onOpen, onToggleStar, onTrash }: { folder: FolderItem; onOpen: () => void; onToggleStar: () => void; onTrash: () => void }) {
  return (
    <motion.div
      variants={item}
      onClick={onOpen}
      className="group flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-surface-hover cursor-pointer transition-colors"
    >
      <FolderIcon className="h-5 w-5 shrink-0" />
      <span className="text-sm font-medium flex-1 truncate">{folder.name}</span>
      <span className="text-xs text-muted-foreground shrink-0">{formatDate(folder.created_at)}</span>
      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
        <ItemMenu onToggleStar={onToggleStar} onTrash={onTrash} isStarred={folder.is_starred} />
      </div>
    </motion.div>
  );
}

function FileListItem({ file, onToggleStar, onTrash }: { file: FileItem; onToggleStar: () => void; onTrash: () => void }) {
  return (
    <motion.div
      variants={item}
      className="group flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-surface-hover cursor-pointer transition-colors"
    >
      <FileIcon mimeType={file.mime_type} className="h-5 w-5 shrink-0" />
      <span className="text-sm font-medium flex-1 truncate">{file.name}</span>
      <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">{formatSize(file.size)}</span>
      <span className="text-xs text-muted-foreground shrink-0">{formatDate(file.created_at)}</span>
      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
        <ItemMenu onToggleStar={onToggleStar} onTrash={onTrash} isStarred={file.is_starred} />
      </div>
    </motion.div>
  );
}
