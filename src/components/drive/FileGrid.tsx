import { useState } from 'react';
import { motion } from 'framer-motion';
import { MoreVertical, Star, Trash2, Pencil, Download, RotateCcw, Check, Link2 } from 'lucide-react';
import { useDriveStore, type FileItem, type FolderItem } from '@/stores/driveStore';
import { FileIcon } from './FileIcon';
import { FolderIcon } from './FolderIcon';
import { RenameDialog } from './RenameDialog';
import { FilePreview } from './FilePreview';
import { SelectionBar } from './SelectionBar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { decryptData } from '@/lib/encryption';
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

const container = { hidden: {}, show: { transition: { staggerChildren: 0.03 } } };
const itemAnim = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } };

// iOS-style shake keyframes via inline style
const shakeAnimation = {
  rotate: [0, -1.5, 1.5, -1, 1, 0],
  transition: { duration: 0.4, repeat: Infinity, repeatDelay: 0.1 },
};

export const FileGrid = () => {
  const { files, folders, viewMode, sortBy, sortOrder, searchQuery, setCurrentFolder, fetchContents, currentFolderId, activeView, selectedFileIds, selectedFolderIds, toggleSelectFile, toggleSelectFolder, clearSelection } = useDriveStore();
  const [renameTarget, setRenameTarget] = useState<{ type: 'files' | 'folders'; id: string; name: string } | null>(null);
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const { user, profile } = useAuthStore();

  const isSelecting = selectionMode || selectedFileIds.size > 0 || selectedFolderIds.size > 0;

  const exitSelectionMode = () => {
    setSelectionMode(false);
    clearSelection();
  };

  let displayFolders = folders;
  let displayFiles = files;

  if (activeView === 'starred') {
    displayFolders = folders.filter(f => f.is_starred);
    displayFiles = files.filter(f => f.is_starred);
  }

  const filteredFolders = displayFolders.filter(f => !searchQuery || f.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredFiles = displayFiles.filter(f => {
    const displayName = f.original_name || f.name;
    return !searchQuery || displayName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const sortedFiles = [...filteredFiles].sort((a, b) => {
    let cmp = 0;
    if (sortBy === 'name') cmp = (a.original_name || a.name).localeCompare(b.original_name || b.name);
    else if (sortBy === 'date') cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    else if (sortBy === 'size') cmp = a.size - b.size;
    return sortOrder === 'asc' ? cmp : -cmp;
  });

  // No decryption needed for starring - just a DB flag toggle
  const toggleStar = async (type: 'files' | 'folders', id: string, current: boolean) => {
    await supabase.from(type).update({ is_starred: !current }).eq('id', id);
    fetchContents(currentFolderId);
  };

  // No decryption needed for trashing - just a DB flag toggle
  const moveToTrash = async (type: 'files' | 'folders', id: string) => {
    await supabase.from(type).update({ is_trashed: true, trashed_at: new Date().toISOString() }).eq('id', id);
    toast.success('Moved to trash');
    fetchContents(currentFolderId);
  };

  const restoreFromTrash = async (type: 'files' | 'folders', id: string) => {
    await supabase.from(type).update({ is_trashed: false, trashed_at: null }).eq('id', id);
    toast.success('Restored');
    fetchContents(currentFolderId);
  };

  const permanentDelete = async (type: 'files' | 'folders', id: string) => {
    if (type === 'files') {
      const file = files.find(f => f.id === id);
      if (file?.telegram_message_ids && Array.isArray(file.telegram_message_ids) && file.telegram_message_ids.length > 0) {
        try {
          await supabase.functions.invoke('telegram-delete', { body: { messageIds: file.telegram_message_ids } });
        } catch (e) { console.error('Telegram delete failed:', e); }
      }
    }
    await supabase.from(type).delete().eq('id', id);
    toast.success('Permanently deleted');
    fetchContents(currentFolderId);
  };

  const downloadFile = async (file: FileItem) => {
    if (!user || !profile?.encryption_salt || !file.telegram_file_id) {
      toast.error('Cannot download this file');
      return;
    }
    const toastId = toast.loading(`Downloading ${file.original_name || file.name}...`);
    try {
      const { data, error } = await supabase.functions.invoke('telegram-download', { body: { fileId: file.telegram_file_id } });
      if (error || !data?.fileData) throw error || new Error('No data');

      const binaryString = atob(data.fileData);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);

      const decrypted = await decryptData(bytes.buffer, file.encryption_iv!, user.id, profile.encryption_salt);
      const blob = new Blob([decrypted], { type: file.mime_type || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.original_name || file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Downloaded', { id: toastId });
    } catch (err) {
      console.error('Download error:', err);
      toast.error('Download failed', { id: toastId });
    }
  };

  const shareFile = async (file: FileItem) => {
    if (!user || !profile?.encryption_salt || !file.telegram_file_id) {
      toast.error('Cannot share this file');
      return;
    }
    const toastId = toast.loading('Creating share link...');
    try {
      // Generate share token and export encryption key for the URL hash
      const token = crypto.randomUUID();
      const { error } = await supabase.from('shared_links').insert({
        file_id: file.id,
        user_id: user.id,
        token,
        encryption_key: `${user.id}:${profile.encryption_salt}`,
        encryption_iv: file.encryption_iv || '',
      });
      if (error) throw error;

      const shareUrl = `${window.location.origin}/share/${token}#${btoa(`${user.id}:${profile.encryption_salt}`)}`;
      
      // Try Web Share API first (works on mobile)
      if (navigator.share) {
        await navigator.share({
          title: file.original_name || file.name,
          text: `Shared file: ${file.original_name || file.name}`,
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
      }
      toast.success('Share link copied!', { id: toastId });
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        toast.dismiss(toastId);
        return;
      }
      console.error('Share error:', err);
      toast.error('Failed to create share link', { id: toastId });
    }
  };

  const isTrashView = activeView === 'trash';

  const handleItemClick = (type: 'file' | 'folder', id: string, defaultAction: () => void) => {
    if (isSelecting) {
      if (type === 'file') toggleSelectFile(id);
      else toggleSelectFolder(id);
    } else {
      defaultAction();
    }
  };

  if (filteredFolders.length === 0 && sortedFiles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <div className="text-6xl mb-4">{isTrashView ? '🗑️' : activeView === 'starred' ? '⭐' : activeView === 'recent' ? '🕐' : '📂'}</div>
        <p className="text-lg font-medium">
          {isTrashView ? 'Trash is empty' : activeView === 'starred' ? 'No starred items' : activeView === 'recent' ? 'No recent files' : 'No files here'}
        </p>
        <p className="text-sm">
          {isTrashView ? 'Items you delete will appear here' : activeView === 'starred' ? 'Star files to find them easily' : 'Upload files or create a folder to get started'}
        </p>
      </div>
    );
  }

  return (
    <>
      {viewMode === 'list' ? (
        <motion.div variants={container} initial="hidden" animate="show" className="px-4">
          {filteredFolders.map(folder => (
            <FolderListItem key={folder.id} folder={folder} selected={selectedFolderIds.has(folder.id)} isSelecting={isSelecting} shake={selectionMode} onOpen={() => handleItemClick('folder', folder.id, () => !isTrashView && setCurrentFolder(folder.id))} onToggleStar={() => toggleStar('folders', folder.id, folder.is_starred)} onTrash={() => moveToTrash('folders', folder.id)} onRestore={() => restoreFromTrash('folders', folder.id)} onDelete={() => permanentDelete('folders', folder.id)} onRename={() => setRenameTarget({ type: 'folders', id: folder.id, name: folder.name })} isTrashView={isTrashView} />
          ))}
          {sortedFiles.map(file => (
            <FileListItem key={file.id} file={file} selected={selectedFileIds.has(file.id)} isSelecting={isSelecting} shake={selectionMode} onToggleStar={() => toggleStar('files', file.id, file.is_starred)} onTrash={() => moveToTrash('files', file.id)} onRestore={() => restoreFromTrash('files', file.id)} onDelete={() => permanentDelete('files', file.id)} onRename={() => setRenameTarget({ type: 'files', id: file.id, name: file.original_name || file.name })} onPreview={() => handleItemClick('file', file.id, () => setPreviewFile(file))} onDownload={() => downloadFile(file)} onShare={() => shareFile(file)} isTrashView={isTrashView} />
          ))}
        </motion.div>
      ) : (
        <div className="px-4 space-y-6">
          {filteredFolders.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">Folders</p>
              <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {filteredFolders.map(folder => (
                  <FolderGridItem key={folder.id} folder={folder} selected={selectedFolderIds.has(folder.id)} isSelecting={isSelecting} shake={selectionMode} onOpen={() => handleItemClick('folder', folder.id, () => !isTrashView && setCurrentFolder(folder.id))} onToggleStar={() => toggleStar('folders', folder.id, folder.is_starred)} onTrash={() => moveToTrash('folders', folder.id)} onRestore={() => restoreFromTrash('folders', folder.id)} onDelete={() => permanentDelete('folders', folder.id)} onRename={() => setRenameTarget({ type: 'folders', id: folder.id, name: folder.name })} isTrashView={isTrashView} />
                ))}
              </motion.div>
            </div>
          )}
          {sortedFiles.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">Files</p>
              <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {sortedFiles.map(file => (
                  <FileGridItem key={file.id} file={file} selected={selectedFileIds.has(file.id)} isSelecting={isSelecting} shake={selectionMode} onToggleStar={() => toggleStar('files', file.id, file.is_starred)} onTrash={() => moveToTrash('files', file.id)} onRestore={() => restoreFromTrash('files', file.id)} onDelete={() => permanentDelete('files', file.id)} onRename={() => setRenameTarget({ type: 'files', id: file.id, name: file.original_name || file.name })} onPreview={() => handleItemClick('file', file.id, () => setPreviewFile(file))} onDownload={() => downloadFile(file)} onShare={() => shareFile(file)} isTrashView={isTrashView} />
                ))}
              </motion.div>
            </div>
          )}
        </div>
      )}

      {renameTarget && (
        <RenameDialog open={!!renameTarget} onOpenChange={(open) => !open && setRenameTarget(null)} type={renameTarget.type} id={renameTarget.id} currentName={renameTarget.name} />
      )}

      <FilePreview file={previewFile} onClose={() => setPreviewFile(null)} />
      <SelectionBar onEnterSelectMode={() => setSelectionMode(true)} onExitSelectMode={exitSelectionMode} selectionMode={selectionMode} />
    </>
  );
};

// --- Shared types ---

interface ItemMenuProps {
  onToggleStar: () => void;
  onTrash: () => void;
  onRename: () => void;
  isStarred: boolean;
  onDownload?: () => void;
  onShare?: () => void;
  onRestore?: () => void;
  onDelete?: () => void;
  isTrashView?: boolean;
}

function ItemMenu({ onToggleStar, onTrash, onRename, isStarred, onDownload, onShare, onRestore, onDelete, isTrashView }: ItemMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="p-1.5 rounded-full hover:bg-surface-hover transition-colors" onClick={e => e.stopPropagation()}>
          <MoreVertical className="h-4 w-4 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {isTrashView ? (
          <>
            {onRestore && <DropdownMenuItem onClick={onRestore}><RotateCcw className="h-4 w-4 mr-2" />Restore</DropdownMenuItem>}
            {onDelete && <DropdownMenuItem onClick={onDelete} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" />Delete forever</DropdownMenuItem>}
          </>
        ) : (
          <>
            {onDownload && <DropdownMenuItem onClick={onDownload}><Download className="h-4 w-4 mr-2" />Download</DropdownMenuItem>}
            {onShare && <DropdownMenuItem onClick={onShare}><Link2 className="h-4 w-4 mr-2" />Share link</DropdownMenuItem>}
            <DropdownMenuItem onClick={onRename}><Pencil className="h-4 w-4 mr-2" />Rename</DropdownMenuItem>
            <DropdownMenuItem onClick={onToggleStar}><Star className={`h-4 w-4 mr-2 ${isStarred ? 'fill-warning text-warning' : ''}`} />{isStarred ? 'Unstar' : 'Star'}</DropdownMenuItem>
            <DropdownMenuItem onClick={onTrash} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" />Move to trash</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// --- Selection checkbox ---

function SelectionCheck({ selected }: { selected: boolean }) {
  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${selected ? 'bg-primary border-primary' : 'border-muted-foreground/40 bg-background/80'}`}
    >
      {selected && <Check className="h-3.5 w-3.5 text-primary-foreground" />}
    </motion.div>
  );
}

// --- Grid/List items ---

interface FolderItemProps { folder: FolderItem; selected: boolean; isSelecting: boolean; shake: boolean; onOpen: () => void; onToggleStar: () => void; onTrash: () => void; onRename: () => void; onRestore: () => void; onDelete: () => void; isTrashView: boolean }

function FolderGridItem({ folder, selected, isSelecting, shake, onOpen, onToggleStar, onTrash, onRename, onRestore, onDelete, isTrashView }: FolderItemProps) {
  return (
    <motion.div
      variants={itemAnim}
      animate={shake && isSelecting ? shakeAnimation : { rotate: 0 }}
      onClick={onOpen}
      className={`group flex items-center gap-3 p-3 rounded-lg bg-surface hover:bg-surface-hover cursor-pointer transition-all drive-shadow hover:drive-shadow-hover no-select ${selected ? 'ring-2 ring-primary bg-accent' : ''}`}
    >
      {isSelecting && <SelectionCheck selected={selected} />}
      <FolderIcon className="h-5 w-5 shrink-0" />
      <span className="text-sm font-medium truncate flex-1">{folder.name}</span>
      {!isSelecting && (
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <ItemMenu onToggleStar={onToggleStar} onTrash={onTrash} onRename={onRename} isStarred={folder.is_starred} onRestore={onRestore} onDelete={onDelete} isTrashView={isTrashView} />
        </div>
      )}
    </motion.div>
  );
}

interface FileItemProps { file: FileItem; selected: boolean; isSelecting: boolean; shake: boolean; onToggleStar: () => void; onTrash: () => void; onRename: () => void; onPreview: () => void; onDownload: () => void; onShare: () => void; onRestore: () => void; onDelete: () => void; isTrashView: boolean }

function FileGridItem({ file, selected, isSelecting, shake, onToggleStar, onTrash, onRename, onPreview, onDownload, onShare, onRestore, onDelete, isTrashView }: FileItemProps) {
  return (
    <motion.div
      variants={itemAnim}
      animate={shake && isSelecting ? shakeAnimation : { rotate: 0 }}
      onClick={isTrashView ? undefined : onPreview}
      className={`group flex flex-col rounded-lg bg-surface hover:bg-surface-hover cursor-pointer transition-all drive-shadow hover:drive-shadow-hover overflow-hidden no-select ${selected ? 'ring-2 ring-primary bg-accent' : ''}`}
    >
      <div className="h-28 flex items-center justify-center bg-surface relative">
        {isSelecting && (
          <div className="absolute top-2 left-2 z-10">
            <SelectionCheck selected={selected} />
          </div>
        )}
        <FileIcon mimeType={file.mime_type} className="h-10 w-10" />
      </div>
      <div className="p-3 flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{file.original_name || file.name}</p>
          <p className="text-xs text-muted-foreground">{formatSize(file.size)}</p>
        </div>
        {!isSelecting && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <ItemMenu onToggleStar={onToggleStar} onTrash={onTrash} onRename={onRename} isStarred={file.is_starred} onDownload={onDownload} onShare={onShare} onRestore={onRestore} onDelete={onDelete} isTrashView={isTrashView} />
          </div>
        )}
      </div>
    </motion.div>
  );
}

function FolderListItem({ folder, selected, isSelecting, shake, onOpen, onToggleStar, onTrash, onRename, onRestore, onDelete, isTrashView }: FolderItemProps) {
  return (
    <motion.div variants={itemAnim} animate={shake && isSelecting ? shakeAnimation : { rotate: 0 }} onClick={onOpen} className={`group flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-surface-hover cursor-pointer transition-colors no-select ${selected ? 'bg-accent' : ''}`}>
      {isSelecting && <SelectionCheck selected={selected} />}
      <FolderIcon className="h-5 w-5 shrink-0" />
      <span className="text-sm font-medium flex-1 truncate">{folder.name}</span>
      <span className="text-xs text-muted-foreground shrink-0">{formatDate(folder.created_at)}</span>
      {!isSelecting && (
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <ItemMenu onToggleStar={onToggleStar} onTrash={onTrash} onRename={onRename} isStarred={folder.is_starred} onRestore={onRestore} onDelete={onDelete} isTrashView={isTrashView} />
        </div>
      )}
    </motion.div>
  );
}

function FileListItem({ file, selected, isSelecting, shake, onToggleStar, onTrash, onRename, onPreview, onDownload, onShare, onRestore, onDelete, isTrashView }: FileItemProps) {
  return (
    <motion.div variants={itemAnim} animate={shake && isSelecting ? shakeAnimation : { rotate: 0 }} onClick={isTrashView ? undefined : onPreview} className={`group flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-surface-hover cursor-pointer transition-colors no-select ${selected ? 'bg-accent' : ''}`}>
      {isSelecting && <SelectionCheck selected={selected} />}
      <FileIcon mimeType={file.mime_type} className="h-5 w-5 shrink-0" />
      <span className="text-sm font-medium flex-1 truncate">{file.original_name || file.name}</span>
      <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">{formatSize(file.size)}</span>
      <span className="text-xs text-muted-foreground shrink-0">{formatDate(file.created_at)}</span>
      {!isSelecting && (
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <ItemMenu onToggleStar={onToggleStar} onTrash={onTrash} onRename={onRename} isStarred={file.is_starred} onDownload={onDownload} onShare={onShare} onRestore={onRestore} onDelete={onDelete} isTrashView={isTrashView} />
        </div>
      )}
    </motion.div>
  );
}
