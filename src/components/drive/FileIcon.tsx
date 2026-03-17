import { File, FileText, FileImage, FileVideo, FileAudio, FileArchive, FileCode, Presentation } from 'lucide-react';

interface FileIconProps {
  mimeType: string | null;
  className?: string;
}

export const FileIcon = ({ mimeType, className = "h-6 w-6" }: FileIconProps) => {
  if (!mimeType) return <File className={className} />;

  if (mimeType.startsWith('image/')) return <FileImage className={`${className} text-destructive`} />;
  if (mimeType.startsWith('video/')) return <FileVideo className={`${className} text-destructive`} />;
  if (mimeType.startsWith('audio/')) return <FileAudio className={`${className} text-warning`} />;
  if (mimeType.includes('pdf')) return <FileText className={`${className} text-destructive`} />;
  if (mimeType.includes('zip') || mimeType.includes('archive') || mimeType.includes('compressed'))
    return <FileArchive className={`${className} text-muted-foreground`} />;
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint'))
    return <Presentation className={`${className} text-warning`} />;
  if (mimeType.includes('text') || mimeType.includes('document') || mimeType.includes('word'))
    return <FileText className={`${className} text-primary`} />;
  if (mimeType.includes('javascript') || mimeType.includes('json') || mimeType.includes('html') || mimeType.includes('css'))
    return <FileCode className={`${className} text-success`} />;

  return <File className={`${className} text-muted-foreground`} />;
};
