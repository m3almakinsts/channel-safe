import { X, Star, Trash2, Download, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDriveStore } from '@/stores/driveStore';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { decryptData } from '@/lib/encryption';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

export const SelectionBar = () => {
  const { selectedFileIds, selectedFolderIds, clearSelection, files, folders, fetchContents, currentFolderId, activeView } = useDriveStore();
  const { user, profile } = useAuthStore();

  const totalSelected = selectedFileIds.size + selectedFolderIds.size;
  if (totalSelected === 0) return null;

  const isTrashView = activeView === 'trash';

  const batchStar = async (star: boolean) => {
    const promises: Promise<any>[] = [];
    selectedFileIds.forEach(id => promises.push(supabase.from('files').update({ is_starred: star }).eq('id', id).then()));
    selectedFolderIds.forEach(id => promises.push(supabase.from('folders').update({ is_starred: star }).eq('id', id).then()));
    await Promise.all(promises);
    toast.success(star ? 'Starred' : 'Unstarred');
    clearSelection();
    fetchContents(currentFolderId);
  };

  const batchTrash = async () => {
    const now = new Date().toISOString();
    const promises: Promise<any>[] = [];
    selectedFileIds.forEach(id => promises.push(supabase.from('files').update({ is_trashed: true, trashed_at: now }).eq('id', id).then()));
    selectedFolderIds.forEach(id => promises.push(supabase.from('folders').update({ is_trashed: true, trashed_at: now }).eq('id', id).then()));
    await Promise.all(promises);
    toast.success(`Moved ${totalSelected} item${totalSelected > 1 ? 's' : ''} to trash`);
    clearSelection();
    fetchContents(currentFolderId);
  };

  const batchRestore = async () => {
    const promises: Promise<any>[] = [];
    selectedFileIds.forEach(id => promises.push(supabase.from('files').update({ is_trashed: false, trashed_at: null }).eq('id', id)));
    selectedFolderIds.forEach(id => promises.push(supabase.from('folders').update({ is_trashed: false, trashed_at: null }).eq('id', id)));
    await Promise.all(promises);
    toast.success('Restored');
    clearSelection();
    fetchContents(currentFolderId);
  };

  const batchDelete = async () => {
    // Delete from Telegram first for files
    const selectedFiles = files.filter(f => selectedFileIds.has(f.id));
    for (const file of selectedFiles) {
      if (file.telegram_message_ids && Array.isArray(file.telegram_message_ids) && file.telegram_message_ids.length > 0) {
        try {
          await supabase.functions.invoke('telegram-delete', {
            body: { messageIds: file.telegram_message_ids },
          });
        } catch (e) {
          console.error('Telegram delete failed for', file.id, e);
        }
      }
    }

    const promises: Promise<any>[] = [];
    selectedFileIds.forEach(id => promises.push(supabase.from('files').delete().eq('id', id)));
    selectedFolderIds.forEach(id => promises.push(supabase.from('folders').delete().eq('id', id)));
    await Promise.all(promises);
    toast.success('Permanently deleted');
    clearSelection();
    fetchContents(currentFolderId);
  };

  const batchDownload = async () => {
    if (!user || !profile?.encryption_salt) return;
    const selectedFiles = files.filter(f => selectedFileIds.has(f.id));
    const toastId = toast.loading(`Downloading ${selectedFiles.length} files...`);

    let downloaded = 0;
    for (const file of selectedFiles) {
      if (!file.telegram_file_id) continue;
      try {
        const { data, error } = await supabase.functions.invoke('telegram-download', {
          body: { fileId: file.telegram_file_id },
        });
        if (error || !data?.fileData) continue;

        const binaryString = atob(data.fileData);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const decrypted = await decryptData(bytes.buffer, file.encryption_iv!, user.id, profile.encryption_salt);
        const blob = new Blob([decrypted], { type: file.mime_type || 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.original_name || file.name;
        a.click();
        URL.revokeObjectURL(url);
        downloaded++;
      } catch (err) {
        console.error('Download error:', err);
      }
    }

    toast.success(`Downloaded ${downloaded} file${downloaded !== 1 ? 's' : ''}`, { id: toastId });
    clearSelection();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-0 left-0 right-0 z-50 safe-area-bottom"
      >
        <div className="mx-2 mb-2 sm:mx-4 sm:mb-4 flex items-center justify-between gap-2 rounded-2xl bg-primary px-4 py-3 text-primary-foreground drive-shadow-lg">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={clearSelection} className="text-primary-foreground hover:bg-primary-foreground/20 h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium">{totalSelected} selected</span>
          </div>
          <div className="flex items-center gap-1">
            {isTrashView ? (
              <>
                <Button variant="ghost" size="icon" onClick={batchRestore} className="text-primary-foreground hover:bg-primary-foreground/20 h-9 w-9">
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={batchDelete} className="text-primary-foreground hover:bg-primary-foreground/20 h-9 w-9">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                {selectedFileIds.size > 0 && (
                  <Button variant="ghost" size="icon" onClick={batchDownload} className="text-primary-foreground hover:bg-primary-foreground/20 h-9 w-9">
                    <Download className="h-4 w-4" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={() => batchStar(true)} className="text-primary-foreground hover:bg-primary-foreground/20 h-9 w-9">
                  <Star className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={batchTrash} className="text-primary-foreground hover:bg-primary-foreground/20 h-9 w-9">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
