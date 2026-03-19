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
  telegram_message_ids: any;
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
type ActiveView = 'drive' | 'starred' | 'recent' | 'trash';

export interface UploadItem {
  id: string;
  name: string;
  progress: number;
  status: 'encrypting' | 'uploading' | 'saving' | 'done' | 'error';
}

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
  activeView: ActiveView;

  // Upload tracking
  uploads: Map<string, UploadItem>;

  // Selection
  selectedFileIds: Set<string>;
  selectedFolderIds: Set<string>;

  setCurrentFolder: (folderId: string | null) => void;
  setViewMode: (mode: ViewMode) => void;
  setSortBy: (sort: SortBy) => void;
  setSortOrder: (order: SortOrder) => void;
  setSearchQuery: (query: string) => void;
  setActiveView: (view: ActiveView) => void;
  fetchContents: (folderId?: string | null) => Promise<void>;
  fetchBreadcrumbs: (folderId: string | null) => Promise<void>;

  // Upload
  addUpload: (item: UploadItem) => void;
  updateUpload: (id: string, update: Partial<UploadItem>) => void;
  removeUpload: (id: string) => void;

  // Legacy compat
  uploadProgress: Map<string, number>;
  setUploadProgress: (fileId: string, progress: number) => void;
  removeUploadProgress: (fileId: string) => void;

  // Selection
  toggleSelectFile: (id: string) => void;
  toggleSelectFolder: (id: string) => void;
  clearSelection: () => void;
  selectAllFiles: () => void;
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
  activeView: 'drive',
  uploads: new Map(),
  uploadProgress: new Map(),
  selectedFileIds: new Set(),
  selectedFolderIds: new Set(),

  setCurrentFolder: (folderId) => {
    set({ currentFolderId: folderId, activeView: 'drive', selectedFileIds: new Set(), selectedFolderIds: new Set() });
    get().fetchContents(folderId);
    get().fetchBreadcrumbs(folderId);
  },

  setViewMode: (mode) => set({ viewMode: mode }),
  setSortBy: (sort) => set({ sortBy: sort }),
  setSortOrder: (order) => set({ sortOrder: order }),
  setSearchQuery: (query) => set({ searchQuery: query }),

  setActiveView: (view) => {
    set({ activeView: view, currentFolderId: null, selectedFileIds: new Set(), selectedFolderIds: new Set() });
    get().fetchContents(null);
    set({ breadcrumbs: [{ id: null, name: view === 'trash' ? 'Trash' : view === 'starred' ? 'Starred' : view === 'recent' ? 'Recent' : 'My Drive' }] });
  },

  fetchContents: async (folderId) => {
    set({ loading: true });
    const targetFolder = folderId !== undefined ? folderId : get().currentFolderId;
    const view = get().activeView;
    const isTrashed = view === 'trash';
    const isRecent = view === 'recent';

    const filesQuery = supabase.from('files').select('*').eq('is_trashed', isTrashed).order('created_at', { ascending: false });
    const foldersQuery = supabase.from('folders').select('*').eq('is_trashed', isTrashed).order('name', { ascending: true });

    if (isRecent) {
      filesQuery.gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
    } else if (!isTrashed) {
      if (targetFolder) {
        filesQuery.eq('parent_folder_id', targetFolder);
        foldersQuery.eq('parent_folder_id', targetFolder);
      } else {
        filesQuery.is('parent_folder_id', null);
        foldersQuery.is('parent_folder_id', null);
      }
    }

    const [filesRes, foldersRes] = await Promise.all([filesQuery, foldersQuery]);

    set({
      files: (filesRes.data ?? []) as FileItem[],
      folders: isRecent ? [] : (foldersRes.data ?? []) as FolderItem[],
      loading: false,
    });
  },

  fetchBreadcrumbs: async (folderId) => {
    const crumbs: { id: string | null; name: string }[] = [{ id: null, name: 'My Drive' }];
    let currentId = folderId;
    while (currentId) {
      const { data } = await supabase.from('folders').select('id, name, parent_folder_id').eq('id', currentId).single();
      if (data) {
        crumbs.splice(1, 0, { id: data.id, name: data.name });
        currentId = data.parent_folder_id;
      } else break;
    }
    set({ breadcrumbs: crumbs });
  },

  addUpload: (item) => {
    set((state) => {
      const newMap = new Map(state.uploads);
      newMap.set(item.id, item);
      return { uploads: newMap };
    });
  },

  updateUpload: (id, update) => {
    set((state) => {
      const newMap = new Map(state.uploads);
      const existing = newMap.get(id);
      if (existing) newMap.set(id, { ...existing, ...update });
      return { uploads: newMap };
    });
  },

  removeUpload: (id) => {
    set((state) => {
      const newMap = new Map(state.uploads);
      newMap.delete(id);
      return { uploads: newMap };
    });
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

  toggleSelectFile: (id) => {
    set((state) => {
      const newSet = new Set(state.selectedFileIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return { selectedFileIds: newSet };
    });
  },

  toggleSelectFolder: (id) => {
    set((state) => {
      const newSet = new Set(state.selectedFolderIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return { selectedFolderIds: newSet };
    });
  },

  clearSelection: () => set({ selectedFileIds: new Set(), selectedFolderIds: new Set() }),

  selectAllFiles: () => {
    const { files, folders } = get();
    set({
      selectedFileIds: new Set(files.map(f => f.id)),
      selectedFolderIds: new Set(folders.map(f => f.id)),
    });
  },
}));
