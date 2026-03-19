import { Plus, FolderPlus, Upload } from 'lucide-react';
import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useDriveStore } from '@/stores/driveStore';
import { useAuthStore } from '@/stores/authStore';
import { encryptData } from '@/lib/encryption';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    for (let j = 0; j < chunk.length; j++) {
      binary += String.fromCharCode(chunk[j]);
    }
  }
  return btoa(binary);
}

async function hashFileName(name: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(name + Date.now().toString() + Math.random());
  const hash = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(hash);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

const MAX_CONCURRENT = 3;

export const NewButton = () => {
  const [open, setOpen] = useState(false);
  const [folderDialog, setFolderDialog] = useState(false);
  const [folderName, setFolderName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { currentFolderId, fetchContents, addUpload, updateUpload, removeUpload } = useDriveStore();
  const { user, profile } = useAuthStore();

  const createFolder = async () => {
    if (!folderName.trim() || !user) return;
    const { error } = await supabase.from('folders').insert({
      user_id: user.id,
      name: folderName.trim(),
      parent_folder_id: currentFolderId,
    });
    if (error) toast.error('Failed to create folder');
    else { toast.success('Folder created'); fetchContents(currentFolderId); }
    setFolderName('');
    setFolderDialog(false);
    setOpen(false);
  };

  const uploadSingleFile = async (file: File) => {
    const tempId = crypto.randomUUID();
    addUpload({ id: tempId, name: file.name, progress: 0, status: 'encrypting' });

    try {
      const buffer = await file.arrayBuffer();
      updateUpload(tempId, { progress: 15, status: 'encrypting' });

      const { encrypted, iv } = await encryptData(buffer, user!.id, profile!.encryption_salt!);
      updateUpload(tempId, { progress: 40, status: 'uploading' });

      const hashedName = await hashFileName(file.name);
      const base64Data = arrayBufferToBase64(encrypted);

      const { data: uploadData, error: uploadError } = await supabase.functions.invoke('telegram-upload', {
        body: { fileData: base64Data, fileName: `${hashedName}.enc`, mimeType: 'application/octet-stream' },
      });

      if (uploadError) throw uploadError;
      updateUpload(tempId, { progress: 75, status: 'saving' });

      const { error: dbError } = await supabase.from('files').insert({
        user_id: user!.id,
        name: hashedName,
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
      updateUpload(tempId, { progress: 100, status: 'done' });
    } catch (err) {
      console.error('Upload failed:', err);
      updateUpload(tempId, { status: 'error', progress: 0 });
      toast.error(`Failed to upload ${file.name}`);
    } finally {
      setTimeout(() => removeUpload(tempId), 3000);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !user || !profile?.encryption_salt) {
      if (!profile?.encryption_salt) toast.error('Encryption not initialized. Please refresh.');
      return;
    }

    setOpen(false);
    const fileList = Array.from(files);

    // Process in batches of MAX_CONCURRENT
    const queue = [...fileList];
    const active: Promise<void>[] = [];

    const processNext = async () => {
      while (queue.length > 0) {
        if (active.length >= MAX_CONCURRENT) {
          await Promise.race(active);
        }
        const file = queue.shift();
        if (!file) break;
        const p = uploadSingleFile(file).then(() => {
          const idx = active.indexOf(p);
          if (idx > -1) active.splice(idx, 1);
        });
        active.push(p);
      }
      await Promise.all(active);
    };

    await processNext();
    fetchContents(currentFolderId);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <>
      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileUpload} />

      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-2xl bg-primary px-5 py-3.5 text-primary-foreground drive-shadow-lg hover:drive-shadow-hover transition-shadow"
      >
        <Plus className={`h-5 w-5 transition-transform ${open ? 'rotate-45' : ''}`} />
        <span className="font-medium text-sm">New</span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="fixed bottom-20 right-6 z-50 bg-card rounded-xl drive-shadow-lg border p-2 min-w-[180px]"
            >
              <button onClick={() => { setFolderDialog(true); setOpen(false); }} className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg hover:bg-surface-hover transition-colors text-sm">
                <FolderPlus className="h-5 w-5 text-muted-foreground" />
                New folder
              </button>
              <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg hover:bg-surface-hover transition-colors text-sm">
                <Upload className="h-5 w-5 text-muted-foreground" />
                Upload files
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <Dialog open={folderDialog} onOpenChange={setFolderDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Folder name" value={folderName} onChange={(e) => setFolderName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createFolder()} autoFocus />
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
