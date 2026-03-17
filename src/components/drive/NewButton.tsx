import { Plus, FolderPlus, Upload } from 'lucide-react';
import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useDriveStore } from '@/stores/driveStore';
import { useAuthStore } from '@/stores/authStore';
import { encryptData, encryptString } from '@/lib/encryption';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export const NewButton = () => {
  const [open, setOpen] = useState(false);
  const [folderDialog, setFolderDialog] = useState(false);
  const [folderName, setFolderName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { currentFolderId, fetchContents, setUploadProgress, removeUploadProgress } = useDriveStore();
  const { user, profile } = useAuthStore();

  const createFolder = async () => {
    if (!folderName.trim() || !user) return;

    const { error } = await supabase.from('folders').insert({
      user_id: user.id,
      name: folderName.trim(),
      parent_folder_id: currentFolderId,
    });

    if (error) {
      toast.error('Failed to create folder');
    } else {
      toast.success('Folder created');
      fetchContents(currentFolderId);
    }
    setFolderName('');
    setFolderDialog(false);
    setOpen(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !user || !profile?.encryption_salt) {
      if (!profile?.encryption_salt) toast.error('Encryption not initialized. Please refresh.');
      return;
    }

    setOpen(false);

    for (const file of Array.from(files)) {
      const tempId = crypto.randomUUID();
      setUploadProgress(tempId, 0);

      try {
        // Read file
        const buffer = await file.arrayBuffer();
        setUploadProgress(tempId, 20);

        // Encrypt file data
        const { encrypted, iv } = await encryptData(buffer, user.id, profile.encryption_salt);
        setUploadProgress(tempId, 50);

        // Encrypt filename
        const encryptedName = await encryptString(file.name, user.id, profile.encryption_salt);
        setUploadProgress(tempId, 60);

        // Upload via edge function
        const base64Data = btoa(String.fromCharCode(...new Uint8Array(encrypted)));
        
        const { data: uploadData, error: uploadError } = await supabase.functions.invoke('telegram-upload', {
          body: {
            fileData: base64Data,
            fileName: `${tempId}.enc`,
            mimeType: 'application/octet-stream',
          },
        });

        if (uploadError) throw uploadError;
        setUploadProgress(tempId, 80);

        // Store metadata
        const { error: dbError } = await supabase.from('files').insert({
          user_id: user.id,
          name: encryptedName.encrypted,
          original_name: file.name,
          mime_type: file.type,
          size: file.size,
          telegram_file_id: uploadData?.fileId || null,
          telegram_message_ids: uploadData?.messageIds || [],
          parent_folder_id: currentFolderId,
          encryption_iv: iv,
          upload_status: 'complete',
        });

        if (dbError) throw dbError;
        setUploadProgress(tempId, 100);
        toast.success(`Uploaded ${file.name}`);
      } catch (err) {
        console.error('Upload failed:', err);
        toast.error(`Failed to upload ${file.name}`);
      } finally {
        setTimeout(() => removeUploadProgress(tempId), 1000);
      }
    }

    fetchContents(currentFolderId);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <>
      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileUpload} />

      {/* FAB */}
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-2xl bg-primary px-5 py-3.5 text-primary-foreground drive-shadow-lg hover:drive-shadow-hover transition-shadow"
      >
        <Plus className={`h-5 w-5 transition-transform ${open ? 'rotate-45' : ''}`} />
        <span className="font-medium text-sm">New</span>
      </motion.button>

      {/* Menu */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="fixed bottom-20 right-6 z-50 bg-card rounded-xl drive-shadow-lg border p-2 min-w-[180px]"
            >
              <button
                onClick={() => { setFolderDialog(true); setOpen(false); }}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg hover:bg-surface-hover transition-colors text-sm"
              >
                <FolderPlus className="h-5 w-5 text-muted-foreground" />
                New folder
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg hover:bg-surface-hover transition-colors text-sm"
              >
                <Upload className="h-5 w-5 text-muted-foreground" />
                Upload files
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* New Folder Dialog */}
      <Dialog open={folderDialog} onOpenChange={setFolderDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Folder name"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createFolder()}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setFolderDialog(false)}>Cancel</Button>
              <Button onClick={createFolder} disabled={!folderName.trim()}>Create</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
