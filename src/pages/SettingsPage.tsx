import { ArrowLeft, LogOut, Trash2, Moon, Sun } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

const SettingsPage = () => {
  const navigate = useNavigate();
  const { profile, user, signOut } = useAuthStore();
  const [darkMode, setDarkMode] = useState(document.documentElement.classList.contains('dark'));
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [totalStorage, setTotalStorage] = useState(0);

  // Calculate actual storage from file sizes
  useEffect(() => {
    const calcStorage = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('files')
        .select('size')
        .eq('user_id', user.id)
        .eq('is_trashed', false);
      if (data) {
        const total = data.reduce((sum, f) => sum + (f.size || 0), 0);
        setTotalStorage(total);
      }
    };
    calcStorage();
  }, [user]);

  const toggleDark = () => {
    document.documentElement.classList.toggle('dark');
    setDarkMode(!darkMode);
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    setDeleting(true);
    try {
      await supabase.from('files').delete().eq('user_id', user.id);
      await supabase.from('folders').delete().eq('user_id', user.id);
      await supabase.from('profiles').delete().eq('user_id', user.id);
      await signOut();
      toast.success('Account data deleted. You have been signed out.');
      navigate('/login');
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete account data');
    } finally {
      setDeleting(false);
      setDeleteDialog(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-3 px-4 py-3 border-b bg-card">
        <button onClick={() => navigate('/')} className="p-2 rounded-full hover:bg-surface-hover transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="font-display font-bold text-lg">Settings</h1>
      </header>

      <div className="max-w-lg mx-auto p-4 space-y-6">
        <div className="flex items-center gap-4 p-4 rounded-xl bg-surface">
          <Avatar className="h-14 w-14">
            <AvatarImage src={profile?.avatar_url || ''} />
            <AvatarFallback className="text-lg bg-primary text-primary-foreground">
              {profile?.display_name?.charAt(0)?.toUpperCase() || '?'}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{profile?.display_name}</p>
            <p className="text-sm text-muted-foreground">{profile?.email}</p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-surface space-y-2">
          <p className="text-sm font-medium">Storage used</p>
          <p className="text-2xl font-bold font-display">{formatBytes(totalStorage)}</p>
          <div className="h-2 bg-surface-hover rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.max(Math.min((totalStorage / (2 * 1024 * 1024 * 1024)) * 100, 100), 0.5)}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">Unlimited storage via Telegram</p>
        </div>

        <div className="p-4 rounded-xl bg-surface">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {darkMode ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
              <span className="text-sm font-medium">Dark mode</span>
            </div>
            <Switch checked={darkMode} onCheckedChange={toggleDark} />
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <Button variant="outline" className="w-full justify-start gap-3" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
          <Button variant="outline" className="w-full justify-start gap-3 text-destructive hover:text-destructive" onClick={() => setDeleteDialog(true)}>
            <Trash2 className="h-4 w-4" />
            Delete account
          </Button>
        </div>
      </div>

      <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete account?</DialogTitle>
            <DialogDescription>
              This will permanently delete all your files, folders, and profile data. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="ghost" onClick={() => setDeleteDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteAccount} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete everything'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SettingsPage;
