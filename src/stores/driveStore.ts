import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';

export interface FileItem {
  id: string;
  user_id: string;
  name: string;
  original_name: string | null;
  mime_type: string | null;
  size: number;
  telegram_file_id: string | null;
  parent_folder_id: string | null;
  is_trashed: boolean;
  is_starred: boolean;
  encryption_iv: string | null;
  upload_status: string;
  created_at: string;
  updated_at: string;
}

export interface FolderItem {
  id: string;
  user_id: string;
  name: string;
  parent_folder_id: string | null;
  is_trashed: boolean;
  is_starred: boolean;
  created_at: string;
  updated_at: string;
}

type ViewMode = 'grid' | 'list';
type SortBy = 'name' | 'date' | 'size';
type SortOrder = 'asc' | 'desc';

interface DriveState {
  files: FileItem[];
  folders: FolderItem[];
  currentFolderId: string | null;
  breadcrumbs: { id: string | null; name: string }[];
  viewMode: ViewMode;
  sortBy: SortBy;
  sortOrder: SortOrder;
  searchQuery: string;
  loading: boolean;
  uploadProgress: Map<string, number>;

  setCurrentFolder: (folderId: string | null) => void;
  setViewMode: (mode: ViewMode) => void;
  setSortBy: (sort: SortBy) => void;
  setSortOrder: (order: SortOrder) => void;
  setSearchQuery: (query: string) => void;
  fetchContents: (folderId?: string | null) => Promise<void>;
  fetchBreadcrumbs: (folderId: string | null) => Promise<void>;
  setUploadProgress: (fileId: string, progress: number) => void;
  removeUploadProgress: (fileId: string) => void;
}

export const useDriveStore = create<DriveState>((set, get) => ({
  files: [],
  folders: [],
  currentFolderId: null,
  breadcrumbs: [{ id: null, name: 'My Drive' }],
  viewMode: 'grid',
  sortBy: 'name',
  sortOrder: 'asc',
  searchQuery: '',
  loading: false,
  uploadProgress: new Map(),

  setCurrentFolder: (folderId) => {
    set({ currentFolderId: folderId });
    get().fetchContents(folderId);
    get().fetchBreadcrumbs(folderId);
  },

  setViewMode: (mode) => set({ viewMode: mode }),
  setSortBy: (sort) => set({ sortBy: sort }),
  setSortOrder: (order) => set({ sortOrder: order }),
  setSearchQuery: (query) => set({ searchQuery: query }),

  fetchContents: async (folderId) => {
    set({ loading: true });
    const targetFolder = folderId !== undefined ? folderId : get().currentFolderId;

    const [filesRes, foldersRes] = await Promise.all([
      supabase
        .from('files')
        .select('*')
        .eq('is_trashed', false)
        .is('parent_folder_id', targetFolder)
        .order('created_at', { ascending: false }),
      supabase
        .from('folders')
        .select('*')
        .eq('is_trashed', false)
        .is('parent_folder_id', targetFolder)
        .order('name', { ascending: true }),
    ]);

    set({
      files: (filesRes.data ?? []) as FileItem[],
      folders: (foldersRes.data ?? []) as FolderItem[],
      loading: false,
    });
  },

  fetchBreadcrumbs: async (folderId) => {
    const crumbs: { id: string | null; name: string }[] = [{ id: null, name: 'My Drive' }];

    let currentId = folderId;
    while (currentId) {
      const { data } = await supabase
        .from('folders')
        .select('id, name, parent_folder_id')
        .eq('id', currentId)
        .single();

      if (data) {
        crumbs.splice(1, 0, { id: data.id, name: data.name });
        currentId = data.parent_folder_id;
      } else {
        break;
      }
    }

    set({ breadcrumbs: crumbs });
  },

  setUploadProgress: (fileId, progress) => {
    set((state) => {
      const newMap = new Map(state.uploadProgress);
      newMap.set(fileId, progress);
      return { uploadProgress: newMap };
    });
  },

  removeUploadProgress: (fileId) => {
    set((state) => {
      const newMap = new Map(state.uploadProgress);
      newMap.delete(fileId);
      return { uploadProgress: newMap };
    });
  },
}));
