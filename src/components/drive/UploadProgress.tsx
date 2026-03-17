import { motion, AnimatePresence } from 'framer-motion';
import { useDriveStore } from '@/stores/driveStore';
import { Progress } from '@/components/ui/progress';

export const UploadProgress = () => {
  const { uploadProgress } = useDriveStore();

  if (uploadProgress.size === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="fixed bottom-20 left-4 right-20 z-40 bg-card rounded-xl border drive-shadow-lg p-4 space-y-2 max-w-sm"
      >
        <p className="text-sm font-medium">Uploading {uploadProgress.size} file{uploadProgress.size > 1 ? 's' : ''}</p>
        {Array.from(uploadProgress.entries()).map(([id, progress]) => (
          <Progress key={id} value={progress} className="h-1.5" />
        ))}
      </motion.div>
    </AnimatePresence>
  );
};
