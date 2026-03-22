import { motion, AnimatePresence } from 'framer-motion';
import { useDriveStore } from '@/stores/driveStore';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Loader2, AlertCircle, X, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const UploadProgress = () => {
  const { uploads, removeUpload, cancelAllUploads } = useDriveStore();

  if (uploads.size === 0) return null;

  const items = Array.from(uploads.values());
  const activeCount = items.filter(i => i.status === 'encrypting' || i.status === 'uploading' || i.status === 'saving').length;
  const doneCount = items.filter(i => i.status === 'done').length;
  const cancelledCount = items.filter(i => i.status === 'cancelled').length;

  const cancelAll = () => {
    cancelAllUploads();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="fixed bottom-20 left-3 right-20 z-30 bg-card rounded-2xl border drive-shadow-lg overflow-hidden max-w-xs"
      >
        <div className="px-3 py-2 border-b bg-surface/50 flex items-center justify-between">
          <p className="text-xs font-medium">
            {activeCount > 0 
              ? `Uploading ${activeCount} file${activeCount > 1 ? 's' : ''}` 
              : `${doneCount} complete${cancelledCount > 0 ? `, ${cancelledCount} cancelled` : ''}`}
          </p>
          {activeCount > 0 && (
            <Button variant="ghost" size="icon" onClick={cancelAll} className="h-6 w-6">
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        <div className="max-h-36 overflow-y-auto">
          {items.map((item) => (
            <div key={item.id} className="px-3 py-2 flex items-center gap-2">
              <div className="shrink-0">
                {item.status === 'done' ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                ) : item.status === 'cancelled' ? (
                  <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                ) : item.status === 'error' ? (
                  <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                ) : (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium truncate">{item.name}</p>
                <Progress value={item.progress} className="h-1 mt-1" />
              </div>
              <span className="text-[10px] text-muted-foreground shrink-0">{Math.round(item.progress)}%</span>
            </div>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
