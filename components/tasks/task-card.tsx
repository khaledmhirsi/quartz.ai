'use client';

import * as React from 'react';

import { format } from 'date-fns';
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  Clock,
  GripVertical,
  MessageSquare,
  MoreHorizontal,
  Sparkles,
  User,
} from 'lucide-react';

import {
  CATEGORY_CONFIG,
  PRIORITY_CONFIG,
  STATUS_CONFIG,
  Task,
  TaskStatus,
} from '@/lib/types/task';
import { cn } from '@/lib/utils';
import { formatDuration, getRelativeTimeString } from '@/lib/utils/task-utils';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface TaskCardProps {
  task: Task;
  isDragging?: boolean;
  onStatusChange?: (taskId: string, status: TaskStatus) => void;
  onEdit?: (task: Task) => void;
  onDelete?: (taskId: string) => void;
  onStartTask?: (task: Task) => void;
  onAgentChat?: (task: Task) => void;
  variant?: 'default' | 'compact' | 'detailed';
}

const StatusIcon: React.FC<{ status: TaskStatus; className?: string }> = ({
  status,
  className,
}) => {
  const icons = {
    planned: Circle,
    in_progress: Clock,
    blocked: AlertCircle,
    waiting_customer: User,
    done: CheckCircle2,
  };
  const Icon = icons[status];
  return <Icon className={cn('h-4 w-4', className)} />;
};

export function TaskCard({
  task,
  isDragging = false,
  onStatusChange,
  onEdit,
  onDelete,
  onStartTask,
  onAgentChat,
  variant = 'default',
}: TaskCardProps) {
  const statusConfig = STATUS_CONFIG[task.status];
  const categoryConfig = CATEGORY_CONFIG[task.category];
  const priorityConfig = PRIORITY_CONFIG[task.importanceLevel];

  const completedSubSteps = task.subSteps.filter((s) => s.completed).length;
  const totalSubSteps = task.subSteps.length;

  const dueDateString = task.dueDate
    ? getRelativeTimeString(new Date(task.dueDate))
    : null;

  const isOverdue =
    task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'done';

  if (variant === 'compact') {
    return (
      <div
        className={cn(
          'group flex items-center gap-3 rounded-lg border border-border/50 bg-card p-3 transition-all hover:border-border hover:shadow-sm',
          isDragging && 'rotate-2 shadow-lg',
          task.status === 'done' && 'opacity-60'
        )}
      >
        <button
          onClick={() =>
            onStatusChange?.(
              task.id,
              task.status === 'done' ? 'planned' : 'done'
            )
          }
          className={cn(
            'flex-shrink-0 rounded-full p-0.5 transition-colors',
            statusConfig.color
          )}
        >
          <StatusIcon status={task.status} />
        </button>

        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'truncate text-sm font-medium',
              task.status === 'done' && 'line-through'
            )}
          >
            {task.title}
          </p>
          {dueDateString && (
            <p
              className={cn(
                'text-xs',
                isOverdue ? 'text-red-500' : 'text-muted-foreground'
              )}
            >
              {dueDateString}
            </p>
          )}
        </div>

        <div
          className={cn(
            'h-2 w-2 flex-shrink-0 rounded-full',
            priorityConfig.dotColor
          )}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'group relative rounded-xl border border-border/50 bg-card p-4 transition-all hover:border-border hover:shadow-md',
        isDragging && 'rotate-1 shadow-xl ring-2 ring-primary/20',
        task.status === 'done' && 'opacity-70'
      )}
    >
      {/* Drag Handle */}
      <div className="absolute left-1 top-1/2 -translate-y-1/2 cursor-grab opacity-0 transition-opacity group-hover:opacity-100">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>

      {/* Header Row */}
      <div className="mb-3 flex items-start justify-between gap-2 pl-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              onStatusChange?.(
                task.id,
                task.status === 'done' ? 'planned' : 'done'
              )
            }
            className={cn(
              'flex-shrink-0 rounded-full p-0.5 transition-all hover:scale-110',
              statusConfig.color
            )}
          >
            <StatusIcon status={task.status} className="h-5 w-5" />
          </button>
          <h3
            className={cn(
              'text-sm font-semibold leading-tight',
              task.status === 'done' && 'line-through text-muted-foreground'
            )}
          >
            {task.title}
          </h3>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 opacity-0 transition-opacity group-hover:opacity-100"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => onEdit?.(task)}>
              Edit task
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onStartTask?.(task)}>
              <Sparkles className="mr-2 h-4 w-4" />
              Start with AI
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAgentChat?.(task)}>
              <MessageSquare className="mr-2 h-4 w-4" />
              Chat with agent
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete?.(task.id)}
              className="text-destructive"
            >
              Delete task
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Description */}
      {task.description && variant === 'detailed' && (
        <p className="mb-3 pl-4 text-xs text-muted-foreground line-clamp-2">
          {task.description}
        </p>
      )}

      {/* Tags Row */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5 pl-4">
        <Badge
          variant="secondary"
          className={cn(
            'text-[10px] font-medium',
            categoryConfig.bgColor,
            categoryConfig.color
          )}
        >
          {categoryConfig.label}
        </Badge>

        {task.commentsCount > 0 && (
          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
            <MessageSquare className="h-3 w-3" />
            {task.commentsCount}
          </span>
        )}

        {/* Priority Indicator */}
        {task.importanceLevel !== 'medium' && (
          <div
            className={cn(
              'h-2 w-2 rounded-full',
              priorityConfig.dotColor
            )}
            title={`${priorityConfig.label} priority`}
          />
        )}
      </div>

      {/* Progress Bar (if has substeps) */}
      {totalSubSteps > 0 && (
        <div className="mb-3 pl-4">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
            <span>Progress</span>
            <span>
              {completedSubSteps}/{totalSubSteps}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-green-500 transition-all"
              style={{
                width: `${(completedSubSteps / totalSubSteps) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Footer Row */}
      <div className="flex items-center justify-between pl-4">
        <div className="flex items-center gap-2">
          {/* Due Date */}
          {dueDateString && (
            <span
              className={cn(
                'text-xs font-medium',
                isOverdue
                  ? 'text-red-500'
                  : task.status === 'done'
                    ? 'text-green-500'
                    : 'text-muted-foreground'
              )}
            >
              {isOverdue ? 'Overdue' : dueDateString}
            </span>
          )}

          {/* Estimated Time */}
          {task.estimatedMinutes && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {formatDuration(task.estimatedMinutes)}
            </span>
          )}
        </div>

        {/* Assignee & Agent */}
        <div className="flex items-center -space-x-1">
          {task.assignedAgent && (
            <Avatar className="h-6 w-6 border-2 border-card">
              <AvatarImage src={task.assignedAgent.avatar} />
              <AvatarFallback className="bg-primary/10 text-[10px]">
                <Sparkles className="h-3 w-3" />
              </AvatarFallback>
            </Avatar>
          )}
          {task.assignee && (
            <Avatar className="h-6 w-6 border-2 border-card">
              <AvatarImage src={task.assignee.avatar} />
              <AvatarFallback className="bg-secondary text-[10px]">
                {task.assignee.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      </div>
    </div>
  );
}
