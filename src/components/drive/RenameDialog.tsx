import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useDriveStore } from '@/stores/driveStore';
import { toast } from 'sonner';

interface RenameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'files' | 'folders';
  id: string;
  currentName: string;
}

export const RenameDialog = ({ open, onOpenChange, type, id, currentName }: RenameDialogProps) => {
  const [name, setName] = useState(currentName);
  const { fetchContents, currentFolderId } = useDriveStore();

  useEffect(() => {
    setName(currentName);
  }, [currentName, open]);

  const handleRename = async () => {
    if (!name.trim()) return;
    const updateData = type === 'files'
      ? { name: name.trim(), original_name: name.trim() }
      : { name: name.trim() };

    const { error } = await supabase.from(type).update(updateData).eq('id', id);
    if (error) {
      toast.error('Failed to rename');
    } else {
      toast.success('Renamed successfully');
      fetchContents(currentFolderId);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rename</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRename()}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleRename} disabled={!name.trim()}>Rename</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
