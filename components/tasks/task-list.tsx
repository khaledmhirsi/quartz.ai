'use client';

import * as React from 'react';

import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Plus,
} from 'lucide-react';

import { Task, TaskStatus } from '@/lib/types/task';
import { cn } from '@/lib/utils';
import { getRelativeTimeString } from '@/lib/utils/task-utils';

import { Button } from '@/components/ui/button';

import { TaskCard } from './task-card';

interface TaskGroup {
  id: string;
  title: string;
  tasks: Task[];
  isExpanded?: boolean;
}

interface TaskListProps {
  tasks: Task[];
  groupBy?: 'status' | 'date' | 'priority' | 'none';
  onTaskStatusChange?: (taskId: string, status: TaskStatus) => void;
  onTaskEdit?: (task: Task) => void;
  onTaskDelete?: (taskId: string) => void;
  onAddTask?: () => void;
  onStartTask?: (task: Task) => void;
  onAgentChat?: (task: Task) => void;
}

function groupTasksByDate(tasks: Task[]): TaskGroup[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

  const groups: Record<string, Task[]> = {
    today: [],
    upcoming: [],
    completed: [],
  };

  tasks.forEach((task) => {
    if (task.status === 'done') {
      groups.completed.push(task);
    } else if (task.dueDate) {
      const dueDate = new Date(task.dueDate);
      if (dueDate < tomorrow) {
        groups.today.push(task);
      } else {
        groups.upcoming.push(task);
      }
    } else {
      groups.upcoming.push(task);
    }
  });

  return [
    { id: 'today', title: 'Today', tasks: groups.today, isExpanded: true },
    { id: 'upcoming', title: 'Upcoming', tasks: groups.upcoming, isExpanded: true },
    { id: 'completed', title: 'Completed', tasks: groups.completed, isExpanded: false },
  ].filter((g) => g.tasks.length > 0);
}

function groupTasksByPriority(tasks: Task[]): TaskGroup[] {
  const groups: Record<string, Task[]> = {
    critical: [],
    high: [],
    medium: [],
    low: [],
  };

  tasks.forEach((task) => {
    groups[task.importanceLevel].push(task);
  });

  return [
    { id: 'critical', title: 'Critical', tasks: groups.critical, isExpanded: true },
    { id: 'high', title: 'High Priority', tasks: groups.high, isExpanded: true },
    { id: 'medium', title: 'Medium Priority', tasks: groups.medium, isExpanded: true },
    { id: 'low', title: 'Low Priority', tasks: groups.low, isExpanded: false },
  ].filter((g) => g.tasks.length > 0);
}

export function TaskList({
  tasks,
  groupBy = 'date',
  onTaskStatusChange,
  onTaskEdit,
  onTaskDelete,
  onAddTask,
  onStartTask,
  onAgentChat,
}: TaskListProps) {
  const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(
    new Set(['today', 'upcoming', 'critical', 'high', 'medium'])
  );

  const groups = React.useMemo(() => {
    if (groupBy === 'none') {
      return [{ id: 'all', title: 'All Tasks', tasks, isExpanded: true }];
    }
    if (groupBy === 'priority') {
      return groupTasksByPriority(tasks);
    }
    return groupTasksByDate(tasks);
  }, [tasks, groupBy]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  // Calculate summary stats
  const todayCount = tasks.filter((t) => {
    if (t.status === 'done') return false;
    if (!t.dueDate) return false;
    const today = new Date();
    const dueDate = new Date(t.dueDate);
    return (
      dueDate.getFullYear() === today.getFullYear() &&
      dueDate.getMonth() === today.getMonth() &&
      dueDate.getDate() === today.getDate()
    );
  }).length;

  const upcomingCount = tasks.filter(
    (t) => t.status !== 'done' && t.dueDate && new Date(t.dueDate) > new Date()
  ).length;

  const doneCount = tasks.filter((t) => t.status === 'done').length;

  return (
    <div className="flex flex-col h-full">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3 p-4">
        <SummaryCard
          icon={Clock}
          label="Today"
          count={todayCount}
          color="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
        />
        <SummaryCard
          icon={Calendar}
          label="Upcoming"
          count={upcomingCount}
          color="bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
        />
        <SummaryCard
          icon={CheckCircle2}
          label="Done"
          count={doneCount}
          color="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
        />
      </div>

      {/* Task Groups */}
      <div className="flex-1 overflow-y-auto px-4 pb-20">
        {groups.map((group) => {
          const isExpanded = expandedGroups.has(group.id);

          return (
            <div key={group.id} className="mb-4">
              {/* Group Header */}
              <button
                onClick={() => toggleGroup(group.id)}
                className="flex w-full items-center gap-2 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <span>{group.title}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                  {group.tasks.length}
                </span>
              </button>

              {/* Task Items */}
              {isExpanded && (
                <div className="space-y-2 pl-2">
                  {group.tasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      variant="compact"
                      onStatusChange={onTaskStatusChange}
                      onEdit={onTaskEdit}
                      onDelete={onTaskDelete}
                      onStartTask={onStartTask}
                      onAgentChat={onAgentChat}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Floating Add Button */}
      <div className="absolute bottom-6 right-6">
        <Button
          onClick={onAddTask}
          size="lg"
          className="h-14 w-14 rounded-full shadow-lg"
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  count,
  color,
}: {
  icon: React.ElementType;
  label: string;
  count: number;
  color: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border bg-card p-4">
      <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', color)}>
        <Icon className="h-5 w-5" />
      </div>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-2xl font-bold">{count}</span>
    </div>
  );
}
