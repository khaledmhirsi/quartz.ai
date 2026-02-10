'use client';

import * as React from 'react';

import {
  Clock,
  MoreHorizontal,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';

import {
  AGENT_ROLE_CONFIGS,
  SubAgentTask,
} from '@/lib/types/sub-agent';
import { cn } from '@/lib/utils';
import { getRecentTasks, searchTasks } from '@/lib/utils/sub-agent-utils';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';

interface TaskSidebarProps {
  tasks: SubAgentTask[];
  activeTaskId: string | null;
  onTaskSelect: (taskId: string) => void;
  onNewTask: () => void;
  onDeleteTask: (taskId: string) => void;
}

export function TaskSidebar({
  tasks,
  activeTaskId,
  onTaskSelect,
  onNewTask,
  onDeleteTask,
}: TaskSidebarProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [showCompleted, setShowCompleted] = React.useState(false);

  const activeTasks = tasks.filter(t => t.status === 'active');
  const completedTasks = tasks.filter(t => t.status === 'completed');
  
  const displayedTasks = searchQuery
    ? searchTasks(tasks, searchQuery)
    : showCompleted
    ? completedTasks
    : activeTasks;

  const recentTasks = getRecentTasks(tasks, 3);

  return (
    <div className="flex h-full w-80 flex-col border-r bg-muted/30">
      {/* Header */}
      <div className="flex items-center justify-between border-b p-4">
        <h1 className="text-lg font-semibold">Tasks</h1>
        <Button onClick={onNewTask} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          New Task
        </Button>
      </div>

      {/* Search */}
      <div className="p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Quick Switch */}
      {!searchQuery && recentTasks.length > 0 && (
        <div className="px-3 pb-2">
          <p className="mb-2 px-2 text-xs font-medium text-muted-foreground">
            Recent
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {recentTasks.map((task) => {
              const config = AGENT_ROLE_CONFIGS[task.agent.role];
              return (
                <button
                  key={task.id}
                  onClick={() => onTaskSelect(task.id)}
                  className={cn(
                    'flex flex-shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors',
                    activeTaskId === task.id
                      ? 'border-primary bg-primary/10'
                      : 'hover:bg-muted'
                  )}
                >
                  <span>{config.icon}</span>
                  <span className="max-w-[80px] truncate">{task.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Toggle Completed */}
      {!searchQuery && (
        <div className="flex gap-2 px-3 pb-2">
          <Button
            variant={!showCompleted ? 'secondary' : 'ghost'}
            size="sm"
            className="flex-1 text-xs"
            onClick={() => setShowCompleted(false)}
          >
            Active ({activeTasks.length})
          </Button>
          <Button
            variant={showCompleted ? 'secondary' : 'ghost'}
            size="sm"
            className="flex-1 text-xs"
            onClick={() => setShowCompleted(true)}
          >
            Completed ({completedTasks.length})
          </Button>
        </div>
      )}

      {/* Task List */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {displayedTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Sparkles className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm font-medium">
              {searchQuery ? 'No tasks found' : 'No tasks yet'}
            </p>
            <p className="text-xs text-muted-foreground">
              {searchQuery ? 'Try a different search' : 'Create your first task to get started'}
            </p>
            {!searchQuery && (
              <Button onClick={onNewTask} variant="outline" size="sm" className="mt-4">
                <Plus className="mr-2 h-4 w-4" />
                Create Task
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {displayedTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                isActive={activeTaskId === task.id}
                onSelect={() => onTaskSelect(task.id)}
                onDelete={() => onDeleteTask(task.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Task Card Component
function TaskCard({
  task,
  isActive,
  onSelect,
  onDelete,
}: {
  task: SubAgentTask;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const config = AGENT_ROLE_CONFIGS[task.agent.role];
  const lastActivity = task.agent.state.lastActiveAt;
  const timeAgo = getTimeAgo(lastActivity);

  return (
    <div
      onClick={onSelect}
      className={cn(
        'group relative cursor-pointer rounded-xl border p-3 transition-all',
        isActive
          ? 'border-primary bg-primary/5 shadow-sm'
          : 'hover:border-muted-foreground/30 hover:bg-muted/50'
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <Avatar className="h-9 w-9 flex-shrink-0">
          <AvatarFallback className="text-lg">{config.icon}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm truncate">{task.title}</p>
            {task.unreadCount > 0 && (
              <Badge className="h-5 min-w-[20px] px-1.5 text-xs">
                {task.unreadCount}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {task.agent.name}
          </p>
        </div>
        
        {/* Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-0 group-hover:opacity-100"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Task
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Last message preview */}
      {task.lastMessage && (
        <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
          {task.lastMessage}
        </p>
      )}

      {/* Footer */}
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {timeAgo}
        </div>
        {task.agent.state.subtasks.length > 0 && (
          <span>
            {task.agent.state.subtasks.filter(s => s.status === 'completed').length}/
            {task.agent.state.subtasks.length} done
          </span>
        )}
      </div>

      {/* Priority indicator */}
      {task.priority === 'critical' || task.priority === 'high' ? (
        <div className={cn(
          'absolute left-0 top-3 h-8 w-1 rounded-r-full',
          task.priority === 'critical' ? 'bg-red-500' : 'bg-orange-500'
        )} />
      ) : null}
    </div>
  );
}

// Helper to format time ago
function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(date).toLocaleDateString();
}
