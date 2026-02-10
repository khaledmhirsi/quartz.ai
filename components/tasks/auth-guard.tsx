'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Loader2, Lock } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

// Mock auth context - in production, use your actual auth provider
interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
}

const AuthContext = React.createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const router = useRouter();

  // Check for existing session on mount
  React.useEffect(() => {
    const checkAuth = async () => {
      try {
        // Check localStorage for demo purposes
        // In production, this would verify with your auth provider (Supabase)
        const storedUser = localStorage.getItem('quartz_user');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
      } catch (error) {
        console.error('Auth check failed:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = React.useCallback(() => {
    // Redirect to login page
    router.push('/auth/login?redirect=/tasks');
  }, [router]);

  const logout = React.useCallback(() => {
    localStorage.removeItem('quartz_user');
    setUser(null);
    router.push('/');
  }, [router]);

  const value = React.useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      login,
      logout,
    }),
    [user, isLoading, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function AuthGuard({ children, fallback }: AuthGuardProps) {
  const { isAuthenticated, isLoading, login } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-background to-muted/30">
        <div className="mx-4 w-full max-w-md rounded-2xl border bg-card p-8 shadow-lg">
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Lock className="h-8 w-8 text-primary" />
            </div>
            <h1 className="mb-2 text-2xl font-bold">Sign in to access Tasks</h1>
            <p className="mb-6 text-muted-foreground">
              Your tasks are private and secure. Please sign in to view and
              manage your tasks.
            </p>
            <Button onClick={login} size="lg" className="w-full">
              Sign In
            </Button>
            <p className="mt-4 text-xs text-muted-foreground">
              Don&apos;t have an account?{' '}
              <a href="/auth/signup" className="text-primary hover:underline">
                Sign up
              </a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

// Demo login component for testing
export function DemoLogin() {
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(false);

  const handleDemoLogin = async () => {
    setIsLoading(true);
    
    // Create a demo user
    const demoUser: User = {
      id: 'demo-user-' + Date.now(),
      email: 'demo@quartz.ai',
      name: 'Demo User',
      avatar: undefined,
    };

    // Store in localStorage
    localStorage.setItem('quartz_user', JSON.stringify(demoUser));
    
    // Small delay to show loading
    await new Promise((resolve) => setTimeout(resolve, 500));
    
    // Redirect to tasks
    router.push('/tasks');
    router.refresh();
  };

  return (
    <div className="flex h-screen items-center justify-center bg-gradient-to-br from-background to-muted/30">
      <div className="mx-4 w-full max-w-md rounded-2xl border bg-card p-8 shadow-lg">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/10">
            <span className="text-3xl">✨</span>
          </div>
          <h1 className="mb-2 text-2xl font-bold">Welcome to Quartz Tasks</h1>
          <p className="mb-6 text-muted-foreground">
            Smart task management with AI-powered assistance
          </p>
          
          <Button
            onClick={handleDemoLogin}
            size="lg"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              'Try Demo (No Sign Up Required)'
            )}
          </Button>
          
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            <span>or</span>
            <span className="h-px flex-1 bg-border" />
          </div>
          
          <div className="mt-4 flex w-full flex-col gap-2">
            <Button variant="outline" className="w-full" asChild>
              <a href="/auth/login">Sign In with Email</a>
            </Button>
            <Button variant="ghost" className="w-full" asChild>
              <a href="/auth/signup">Create Account</a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
