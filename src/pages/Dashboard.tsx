import { useEffect, useCallback } from 'react';
import { useDriveStore } from '@/stores/driveStore';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/integrations/supabase/client';
import { DriveHeader } from '@/components/drive/DriveHeader';
import { Breadcrumbs } from '@/components/drive/Breadcrumbs';
import { DriveToolbar } from '@/components/drive/DriveToolbar';
import { FileGrid } from '@/components/drive/FileGrid';
import { NewButton } from '@/components/drive/NewButton';
import { UploadProgress } from '@/components/drive/UploadProgress';
import { generateSalt } from '@/lib/encryption';
import { motion } from 'framer-motion';

const Dashboard = () => {
  const { fetchContents, currentFolderId, setActiveView, activeView } = useDriveStore();
  const { user, profile, fetchProfile } = useAuthStore();

  useEffect(() => {
    const initSalt = async () => {
      if (user && profile && !profile.encryption_salt) {
        const salt = generateSalt();
        await supabase
          .from('profiles')
          .update({ encryption_salt: salt })
          .eq('user_id', user.id);
        await fetchProfile();
      }
    };
    initSalt();
  }, [user, profile, fetchProfile]);

  useEffect(() => {
    fetchContents(currentFolderId);
  }, [currentFolderId, fetchContents]);

  const handleViewChange = useCallback((view: string) => {
    setActiveView(view as 'drive' | 'starred' | 'recent' | 'trash');
  }, [setActiveView]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen flex flex-col bg-background"
    >
      <DriveHeader activeView={activeView} onViewChange={handleViewChange} />
      <div className="px-4 pt-2">
        <Breadcrumbs />
      </div>
      <DriveToolbar />
      <div className="flex-1 overflow-y-auto py-4">
        <FileGrid />
      </div>
      {activeView === 'drive' && <NewButton />}
      <UploadProgress />
    </motion.div>
  );
};

export default Dashboard;
