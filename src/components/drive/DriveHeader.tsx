import { Cloud, Menu, Settings, LogOut, Star, Trash2, Clock } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useNavigate } from 'react-router-dom';

interface DriveHeaderProps {
  activeView: string;
  onViewChange: (view: string) => void;
}

export const DriveHeader = ({ activeView, onViewChange }: DriveHeaderProps) => {
  const { profile, signOut } = useAuthStore();
  const navigate = useNavigate();

  const navItems = [
    { id: 'drive', label: 'My Drive', icon: Cloud },
    { id: 'recent', label: 'Recent', icon: Clock },
    { id: 'starred', label: 'Starred', icon: Star },
    { id: 'trash', label: 'Trash', icon: Trash2 },
  ];

  return (
    <header className="flex items-center justify-between px-4 py-3 border-b bg-card">
      <div className="flex items-center gap-3">
        <Sheet>
          <SheetTrigger asChild>
            <button className="p-2 rounded-full hover:bg-surface-hover transition-colors sm:hidden">
              <Menu className="h-5 w-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <div className="p-4 border-b">
              <div className="flex items-center gap-2">
                <Cloud className="h-6 w-6 text-primary" />
                <span className="font-display font-bold text-lg">TeleVault</span>
              </div>
            </div>
            <nav className="p-2">
              {navItems.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => onViewChange(id)}
                  className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    activeView === id ? 'bg-accent text-accent-foreground font-medium' : 'hover:bg-surface-hover text-muted-foreground'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {label}
                </button>
              ))}
            </nav>
          </SheetContent>
        </Sheet>

        <div className="flex items-center gap-2">
          <Cloud className="h-6 w-6 text-primary" />
          <h1 className="font-display font-bold text-lg">TeleVault</h1>
        </div>
      </div>

      {/* Desktop nav */}
      <nav className="hidden sm:flex items-center gap-1">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onViewChange(id)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors ${
              activeView === id ? 'bg-accent text-accent-foreground font-medium' : 'hover:bg-surface-hover text-muted-foreground'
            }`}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden md:inline">{label}</span>
          </button>
        ))}
      </nav>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="rounded-full">
            <Avatar className="h-8 w-8">
              <AvatarImage src={profile?.avatar_url || ''} />
              <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                {profile?.display_name?.charAt(0)?.toUpperCase() || '?'}
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <div className="px-2 py-1.5">
            <p className="text-sm font-medium">{profile?.display_name}</p>
            <p className="text-xs text-muted-foreground">{profile?.email}</p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate('/settings')}>
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuItem onClick={signOut} className="text-destructive">
            <LogOut className="h-4 w-4 mr-2" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
};
