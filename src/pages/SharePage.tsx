import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { decryptData } from '@/lib/encryption';
import { Cloud, Download, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

const SharePage = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [mimeType, setMimeType] = useState('');
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('Loading...');

  useEffect(() => {
    loadSharedFile();
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const loadSharedFile = async () => {
    if (!token) { setError('Invalid share link'); setLoading(false); return; }

    // Get key material from URL hash
    const hash = window.location.hash.slice(1);
    if (!hash) { setError('Invalid share link - missing key'); setLoading(false); return; }

    let userId: string, salt: string;
    try {
      const decoded = atob(hash);
      [userId, salt] = decoded.split(':');
      if (!userId || !salt) throw new Error();
    } catch {
      setError('Invalid share link'); setLoading(false); return;
    }

    try {
      setProgress(10);
      setStatusText('Looking up file...');

      // Look up the shared link
      const { data: shareData, error: shareErr } = await supabase
        .from('shared_links')
        .select('*, files(*)')
        .eq('token', token)
        .single();

      if (shareErr || !shareData) { setError('Share link not found or expired'); setLoading(false); return; }
      if (shareData.expires_at && new Date(shareData.expires_at) < new Date()) { setError('Share link has expired'); setLoading(false); return; }

      const file = (shareData as any).files;
      if (!file) { setError('File not found'); setLoading(false); return; }

      setFileName(file.original_name || file.name);
      setMimeType(file.mime_type || '');
      setProgress(20);
      setStatusText('Downloading...');

      // Download from Telegram
      const { data, error: dlErr } = await supabase.functions.invoke('telegram-download', {
        body: { fileId: file.telegram_file_id },
      });
      if (dlErr || !data?.fileData) throw new Error('Download failed');

      setProgress(60);
      setStatusText('Decrypting...');

      const binaryString = atob(data.fileData);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);

      const decrypted = await decryptData(bytes.buffer, file.encryption_iv, userId, salt);

      setProgress(90);
      setStatusText('Preparing...');

      const blob = new Blob([decrypted], { type: file.mime_type || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      setBlobUrl(url);
      setProgress(100);
    } catch (err) {
      console.error('Share load error:', err);
      setError('Failed to load shared file');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!blobUrl) return;
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const isImage = mimeType.startsWith('image/');
  const isVideo = mimeType.startsWith('video/');
  const isAudio = mimeType.startsWith('audio/');

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center gap-2 px-4 py-3 border-b bg-card">
        <Cloud className="h-5 w-5 text-primary" />
        <span className="font-display font-bold text-sm">TeleVault</span>
        <span className="text-xs text-muted-foreground ml-1">Shared file</span>
      </header>

      <div className="flex-1 flex items-center justify-center p-4">
        {loading && (
          <div className="bg-card rounded-2xl p-6 drive-shadow-lg border w-full max-w-sm text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            <p className="text-sm font-medium">{statusText}</p>
            <Progress value={progress} className="h-1.5" />
            <p className="text-xs text-muted-foreground">{Math.round(progress)}%</p>
          </div>
        )}

        {error && (
          <div className="bg-card rounded-2xl p-6 drive-shadow-lg border w-full max-w-sm text-center space-y-4">
            <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {!loading && !error && blobUrl && (
          <div className="w-full max-w-2xl space-y-4">
            <div className="bg-card rounded-2xl p-4 drive-shadow-lg border">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="min-w-0">
                  <p className="font-medium truncate">{fileName}</p>
                  <p className="text-xs text-muted-foreground">{mimeType}</p>
                </div>
                <Button onClick={handleDownload} size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>

              {isImage && <img src={blobUrl} alt={fileName} className="w-full rounded-lg" />}
              {isVideo && <video src={blobUrl} controls className="w-full rounded-lg" />}
              {isAudio && <audio src={blobUrl} controls className="w-full" />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SharePage;
