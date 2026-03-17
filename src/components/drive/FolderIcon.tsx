import { Folder as FolderLucide } from 'lucide-react';

interface FolderIconProps {
  className?: string;
}

export const FolderIcon = ({ className = "h-6 w-6" }: FolderIconProps) => (
  <FolderLucide className={`${className} text-muted-foreground fill-muted-foreground/20`} />
);
