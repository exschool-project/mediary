import {
  Archive, FileText, Image as ImageIcon, Video, Music, Code2, File, Folder,
} from 'lucide-react';
import { fileKindFromExtension, type FileKind } from '@/lib/utils';

const KIND_ICON: Record<FileKind, typeof File> = {
  archive: Archive,
  pdf: FileText,
  image: ImageIcon,
  video: Video,
  audio: Music,
  code: Code2,
  text: FileText,
  folder: Folder,
  unknown: File,
};

const KIND_COLOR: Record<FileKind, string> = {
  archive: 'text-amber-400',
  pdf: 'text-rose-400',
  image: 'text-sky-400',
  video: 'text-violet-400',
  audio: 'text-fuchsia-400',
  code: 'text-emerald-400',
  text: 'text-muted',
  folder: 'text-accent',
  unknown: 'text-muted',
};

export function FileIcon({
  extension,
  isFolder,
  size = 20,
  className = '',
}: {
  extension: string;
  isFolder?: boolean;
  size?: number;
  className?: string;
}) {
  const kind: FileKind = isFolder ? 'folder' : fileKindFromExtension(extension);
  const Icon = KIND_ICON[kind];
  return <Icon size={size} className={`${KIND_COLOR[kind]} ${className}`} strokeWidth={1.75} />;
}
