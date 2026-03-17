import { ArrowLeft, LogOut, Trash2, Moon, Sun } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { useState } from 'react';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

const SettingsPage = () => {
  const navigate = useNavigate();
  const { profile, signOut } = useAuthStore();
  const [darkMode, setDarkMode] = useState(document.documentElement.classList.contains('dark'));

  const toggleDark = () => {
    document.documentElement.classList.toggle('dark');
    setDarkMode(!darkMode);
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
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
        {/* Profile */}
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

        {/* Storage */}
        <div className="p-4 rounded-xl bg-surface space-y-2">
          <p className="text-sm font-medium">Storage used</p>
          <p className="text-2xl font-bold font-display">{formatBytes(profile?.storage_used || 0)}</p>
          <div className="h-2 bg-surface-hover rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full" style={{ width: '0.1%' }} />
          </div>
          <p className="text-xs text-muted-foreground">Unlimited storage via Telegram</p>
        </div>

        {/* Appearance */}
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

        {/* Actions */}
        <div className="space-y-2">
          <Button variant="outline" className="w-full justify-start gap-3" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start gap-3 text-destructive hover:text-destructive"
            onClick={() => toast.info('Account deletion coming soon')}
          >
            <Trash2 className="h-4 w-4" />
            Delete account
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
