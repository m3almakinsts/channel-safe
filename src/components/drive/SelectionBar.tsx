import { X, Star, Trash2, Download, RotateCcw, CheckSquare, XSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDriveStore } from '@/stores/driveStore';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/integrations/supabase/client';
import { decryptData } from '@/lib/encryption';
import { downloadEncryptedFromTelegram } from '@/lib/transfer';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

interface SelectionBarProps {
  onEnterSelectMode: () => void;
  onExitSelectMode: () => void;
  selectionMode: boolean;
}

export const SelectionBar = ({ onEnterSelectMode, onExitSelectMode, selectionMode }: SelectionBarProps) => {
  const { selectedFileIds, selectedFolderIds, clearSelection, files, folders, fetchContents, currentFolderId, activeView, selectAllFiles } = useDriveStore();
  const { user, profile } = useAuthStore();

  const totalSelected = selectedFileIds.size + selectedFolderIds.size;
  const hasItems = files.length > 0 || folders.length > 0;
  const isTrashView = activeView === 'trash';

  if (!selectionMode && totalSelected === 0) {
    if (!hasItems) return null;
    return (
      <div className="fixed bottom-20 left-3 z-30">
        <motion.button
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          whileTap={{ scale: 0.95 }}
          onClick={onEnterSelectMode}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-secondary text-secondary-foreground drive-shadow-lg text-sm font-medium hover:bg-secondary/80 transition-colors"
        >
          <CheckSquare className="h-4 w-4" />
          Select
        </motion.button>
      </div>
    );
  }

  const batchStar = async (star: boolean) => {
    const promises: PromiseLike<any>[] = [];
    selectedFileIds.forEach(id => promises.push(supabase.from('files').update({ is_starred: star }).eq('id', id).then()));
    selectedFolderIds.forEach(id => promises.push(supabase.from('folders').update({ is_starred: star }).eq('id', id).then()));
    await Promise.all(promises);
    onExitSelectMode();
    fetchContents(currentFolderId);
  };

  const batchTrash = async () => {
    const now = new Date().toISOString();
    const promises: PromiseLike<any>[] = [];
    selectedFileIds.forEach(id => promises.push(supabase.from('files').update({ is_trashed: true, trashed_at: now }).eq('id', id).then()));
    selectedFolderIds.forEach(id => promises.push(supabase.from('folders').update({ is_trashed: true, trashed_at: now }).eq('id', id).then()));
    await Promise.all(promises);
    onExitSelectMode();
    fetchContents(currentFolderId);
  };

  const batchRestore = async () => {
    const promises: PromiseLike<any>[] = [];
    selectedFileIds.forEach(id => promises.push(supabase.from('files').update({ is_trashed: false, trashed_at: null }).eq('id', id).then()));
    selectedFolderIds.forEach(id => promises.push(supabase.from('folders').update({ is_trashed: false, trashed_at: null }).eq('id', id).then()));
    await Promise.all(promises);
    onExitSelectMode();
    fetchContents(currentFolderId);
  };

  const batchDelete = async () => {
    const selectedFiles = files.filter(f => selectedFileIds.has(f.id));
    for (const file of selectedFiles) {
      if (file.telegram_message_ids && Array.isArray(file.telegram_message_ids) && file.telegram_message_ids.length > 0) {
        try {
          await supabase.functions.invoke('telegram-delete', { body: { messageIds: file.telegram_message_ids } });
        } catch (e) { console.error('Telegram delete failed for', file.id, e); }
      }
    }
    const promises: PromiseLike<any>[] = [];
    selectedFileIds.forEach(id => promises.push(supabase.from('files').delete().eq('id', id).then()));
    selectedFolderIds.forEach(id => promises.push(supabase.from('folders').delete().eq('id', id).then()));
    await Promise.all(promises);
    onExitSelectMode();
    fetchContents(currentFolderId);
  };

  const batchDownload = async () => {
    const selectedFiles = files.filter(f => selectedFileIds.has(f.id));
    if (!user || !profile?.encryption_salt || selectedFiles.length === 0) return;

    const triggerDownload = (blob: Blob, fileName: string) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

    const resolveUniqueName = (baseName: string, usedNames: Set<string>) => {
      if (!usedNames.has(baseName)) {
        usedNames.add(baseName);
        return baseName;
      }

      let index = 2;
      const dotIndex = baseName.lastIndexOf('.');
      const stem = dotIndex > 0 ? baseName.slice(0, dotIndex) : baseName;
      const extension = dotIndex > 0 ? baseName.slice(dotIndex) : '';
      let candidate = `${stem} (${index})${extension}`;

      while (usedNames.has(candidate)) {
        index += 1;
        candidate = `${stem} (${index})${extension}`;
      }

      usedNames.add(candidate);
      return candidate;
    };

    try {
      if (selectedFiles.length === 1) {
        const file = selectedFiles[0];
        if (!file.telegram_file_id || !file.encryption_iv) return;

        const encrypted = await downloadEncryptedFromTelegram({ fileId: file.telegram_file_id });
        const decrypted = await decryptData(encrypted, file.encryption_iv, user.id, profile.encryption_salt);
        const blob = new Blob([decrypted], { type: file.mime_type || 'application/octet-stream' });
        triggerDownload(blob, file.original_name || file.name);
        onExitSelectMode();
        return;
      }

      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();
      const usedNames = new Set<string>();

      for (const file of selectedFiles) {
        if (!file.telegram_file_id || !file.encryption_iv) continue;

        const encrypted = await downloadEncryptedFromTelegram({ fileId: file.telegram_file_id });
        const decrypted = await decryptData(encrypted, file.encryption_iv, user.id, profile.encryption_salt);
        const fileName = resolveUniqueName(file.original_name || file.name, usedNames);
        zip.file(fileName, decrypted);
      }

      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      triggerDownload(zipBlob, `televault-files-${timestamp}.zip`);
      onExitSelectMode();
    } catch (error) {
      console.error('Batch download failed:', error);
      toast.error('Failed to download selected files');
    }
  };

  return (
    <AnimatePresence>
      {(selectionMode || totalSelected > 0) && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-0 left-0 right-0 z-50 safe-area-bottom"
        >
          <div className="mx-2 mb-2 sm:mx-4 sm:mb-4 flex items-center justify-between gap-2 rounded-2xl bg-primary px-4 py-3 text-primary-foreground drive-shadow-lg">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={onExitSelectMode} className="text-primary-foreground hover:bg-primary-foreground/20 h-8 w-8">
                <X className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium">{totalSelected > 0 ? `${totalSelected} selected` : 'Select items'}</span>
            </div>
            <div className="flex items-center gap-1">
              {totalSelected > 0 && (
                <Button variant="ghost" size="icon" onClick={() => clearSelection()} className="text-primary-foreground hover:bg-primary-foreground/20 h-9 w-9" title="Unselect all">
                  <XSquare className="h-4 w-4" />
                </Button>
              )}
              {totalSelected === 0 ? (
                <Button variant="ghost" size="sm" onClick={selectAllFiles} className="text-primary-foreground hover:bg-primary-foreground/20 text-xs">
                  Select all
                </Button>
              ) : isTrashView ? (
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
      )}
    </AnimatePresence>
  );
};
