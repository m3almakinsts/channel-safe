import { useState } from 'react';
import { Cloud, Shield, Lock, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { lovable } from '@/integrations/lovable/index';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

const Login = () => {
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const { error } = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
        extraParams: {
          prompt: "select_account",
        },
      });
      if (error) {
        toast.error(error.message || 'Failed to sign in with Google');
      }
    } catch (err) {
      toast.error('Something went wrong');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-background">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm space-y-10 text-center"
      >
        {/* Logo */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="h-20 w-20 rounded-3xl bg-primary flex items-center justify-center drive-shadow-lg">
            <Cloud className="h-10 w-10 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-4xl font-bold tracking-tight">TeleVault</h1>
            <p className="text-muted-foreground text-sm mt-1">Encrypted cloud storage powered by Telegram</p>
          </div>
        </motion.div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="space-y-3"
        >
          {[
            { icon: Shield, title: 'End-to-end encrypted', desc: 'AES-256 encryption — only you can read your files' },
            { icon: Lock, title: 'Zero-knowledge storage', desc: 'Even server admins can\'t access your data' },
            { icon: Zap, title: 'Unlimited storage', desc: 'No storage limits via Telegram infrastructure' },
          ].map(({ icon: Icon, title, desc }, i) => (
            <div key={i} className="flex items-center gap-3 text-left p-3 rounded-xl bg-surface">
              <div className="h-9 w-9 rounded-lg bg-accent flex items-center justify-center shrink-0">
                <Icon className="h-4.5 w-4.5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">{title}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            </div>
          ))}
        </motion.div>

        {/* Google Sign In */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35 }}
          className="space-y-3"
        >
          <Button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full h-12 gap-3 text-base bg-foreground text-background hover:bg-foreground/90 rounded-xl font-medium"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {loading ? 'Signing in...' : 'Continue with Google'}
          </Button>
          <p className="text-xs text-muted-foreground">
            By continuing, you agree to our terms of service
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Login;
