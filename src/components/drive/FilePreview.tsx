import { useState, useEffect } from 'react';
import { X, Download, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { decryptData } from '@/lib/encryption';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type { FileItem } from '@/stores/driveStore';

interface FilePreviewProps {
  file: FileItem | null;
  onClose: () => void;
}

export const FilePreview = ({ file, onClose }: FilePreviewProps) => {
  const [loading, setLoading] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const { user, profile } = useAuthStore();

  // Auto-load when file changes
  useEffect(() => {
    if (file && !blobUrl && !loading) {
      loadFile();
    }
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        setBlobUrl(null);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file?.id]);

  const canPreview = (mimeType: string | null) => {
    if (!mimeType) return false;
    return (
      mimeType.startsWith('image/') ||
      mimeType === 'application/pdf' ||
      mimeType.startsWith('text/') ||
      mimeType.startsWith('video/') ||
      mimeType.startsWith('audio/')
    );
  };

  const loadFile = async (): Promise<string | null> => {
    if (!file || !user || !profile?.encryption_salt || !file.telegram_file_id) return null;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('telegram-download', {
        body: { fileId: file.telegram_file_id },
      });

      if (error || !data?.fileData) throw error || new Error('No data returned');

      const binaryString = atob(data.fileData);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const decrypted = await decryptData(
        bytes.buffer,
        file.encryption_iv!,
        user.id,
        profile.encryption_salt
      );

      const blob = new Blob([decrypted], { type: file.mime_type || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      setBlobUrl(url);
      return url;
    } catch (err) {
      console.error('Preview error:', err);
      toast.error('Failed to load file');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    const url = blobUrl || await loadFile();
    if (!url || !file) return;

    const a = document.createElement('a');
    a.href = url;
    a.download = file.original_name || file.name;
    a.click();
  };

  const handleClose = () => {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    setBlobUrl(null);
    onClose();
  };

  if (!file) return null;

  const previewable = canPreview(file.mime_type);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex flex-col"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b bg-card">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{file.original_name || file.name}</p>
            <p className="text-xs text-muted-foreground">{file.mime_type}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={handleDownload} disabled={loading}>
              <Download className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
          {loading ? (
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">Decrypting file...</p>
            </div>
          ) : blobUrl && previewable ? (
            <PreviewContent mimeType={file.mime_type} url={blobUrl} />
          ) : blobUrl && !previewable ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <p className="text-muted-foreground text-sm">This file type cannot be previewed</p>
              <Button variant="outline" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
          ) : null}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

function PreviewContent({ mimeType, url }: { mimeType: string | null; url: string }) {
  if (!mimeType) return null;

  if (mimeType.startsWith('image/')) {
    return <img src={url} alt="Preview" className="max-w-full max-h-full object-contain rounded-lg" />;
  }

  if (mimeType === 'application/pdf') {
    return <iframe src={url} className="w-full h-full rounded-lg border" title="PDF Preview" />;
  }

  if (mimeType.startsWith('video/')) {
    return <video src={url} controls className="max-w-full max-h-full rounded-lg" />;
  }

  if (mimeType.startsWith('audio/')) {
    return <audio src={url} controls className="w-full max-w-md" />;
  }

  if (mimeType.startsWith('text/')) {
    return <TextPreview url={url} />;
  }

  return <p className="text-muted-foreground">Cannot preview this file type</p>;
}

function TextPreview({ url }: { url: string }) {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    fetch(url).then(r => r.text()).then(setText);
  }, [url]);

  if (text === null) {
    return <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />;
  }

  return (
    <pre className="w-full max-h-full overflow-auto p-4 rounded-lg bg-muted text-sm font-mono whitespace-pre-wrap">
      {text}
    </pre>
  );
}
