import { motion, AnimatePresence } from 'framer-motion';
import { useDriveStore } from '@/stores/driveStore';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Loader2, AlertCircle, Lock, Upload, Save } from 'lucide-react';

const statusLabels = {
  encrypting: { label: 'Encrypting', icon: Lock },
  uploading: { label: 'Uploading', icon: Upload },
  saving: { label: 'Saving', icon: Save },
  done: { label: 'Done', icon: CheckCircle2 },
  error: { label: 'Failed', icon: AlertCircle },
};

export const UploadProgress = () => {
  const { uploads } = useDriveStore();

  if (uploads.size === 0) return null;

  const items = Array.from(uploads.values());
  const activeCount = items.filter(i => i.status !== 'done' && i.status !== 'error').length;
  const doneCount = items.filter(i => i.status === 'done').length;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="fixed bottom-20 left-3 right-16 z-40 bg-card rounded-2xl border drive-shadow-lg overflow-hidden max-w-sm"
      >
        <div className="px-4 py-3 border-b bg-surface/50">
          <p className="text-sm font-medium">
            {activeCount > 0 
              ? `Uploading ${activeCount} file${activeCount > 1 ? 's' : ''}` 
              : `${doneCount} upload${doneCount > 1 ? 's' : ''} complete`}
          </p>
        </div>
        <div className="max-h-48 overflow-y-auto">
          {items.map((item) => {
            const statusInfo = statusLabels[item.status];
            const StatusIcon = statusInfo.icon;
            return (
              <div key={item.id} className="px-4 py-2.5 flex items-center gap-3">
                <div className="shrink-0">
                  {item.status === 'done' ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : item.status === 'error' ? (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  ) : (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{item.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Progress value={item.progress} className="h-1 flex-1" />
                    <span className="text-[10px] text-muted-foreground shrink-0">{Math.round(item.progress)}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
