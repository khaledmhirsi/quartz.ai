'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';

import {
  Filter,
  LayoutGrid,
  List,
  Moon,
  Plus,
  Search,
  Settings,
  Sparkles,
  Sun,
  Zap,
} from 'lucide-react';

import { cn } from '@/lib/utils';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';

interface TaskHeaderProps {
  title?: string;
  taskCount?: number;
  view: 'board' | 'list';
  onViewChange: (view: 'board' | 'list') => void;
  onAddTask: () => void;
  onGoldenTime: () => void;
  onSearch?: (query: string) => void;
}

export function TaskHeader({
  title = 'My Tasks',
  taskCount = 0,
  view,
  onViewChange,
  onAddTask,
  onGoldenTime,
  onSearch,
}: TaskHeaderProps) {
  const { theme, setTheme } = useTheme();
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch?.(searchQuery);
  };

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6">
        {/* Left: Title & Count */}
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-xl font-semibold">{title}</h1>
            <p className="text-sm text-muted-foreground">
              {taskCount} active task{taskCount !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Center: Search (Desktop) */}
        <div className="hidden flex-1 justify-center px-8 md:flex">
          <form onSubmit={handleSearch} className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 bg-muted/50"
            />
          </form>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Mobile Search Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setSearchOpen(!searchOpen)}
          >
            <Search className="h-5 w-5" />
          </Button>

          {/* Golden Time Button */}
          <Button
            onClick={onGoldenTime}
            variant="outline"
            className="hidden gap-2 sm:flex bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200 text-amber-700 hover:from-amber-100 hover:to-orange-100 dark:from-amber-950/30 dark:to-orange-950/30 dark:border-amber-800 dark:text-amber-400"
          >
            <Zap className="h-4 w-4" />
            <span className="hidden lg:inline">Golden Time</span>
          </Button>

          {/* View Toggle */}
          <div className="flex items-center rounded-lg border bg-muted/50 p-1">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'h-7 px-2',
                view === 'board' && 'bg-background shadow-sm'
              )}
              onClick={() => onViewChange('board')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'h-7 px-2',
                view === 'list' && 'bg-background shadow-sm'
              )}
              onClick={() => onViewChange('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>

          {/* Add Task Button */}
          <Button onClick={onAddTask} className="gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Task</span>
          </Button>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src="/avatars/user.png" />
                  <AvatarFallback className="bg-primary/10 text-xs">
                    SN
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span>Savannah Nguyen</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    savannah@example.com
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Sparkles className="mr-2 h-4 w-4" />
                AI Preferences
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Mobile Search Bar */}
      {searchOpen && (
        <div className="border-t p-4 md:hidden">
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9"
              autoFocus
            />
          </form>
        </div>
      )}
    </header>
  );
}
