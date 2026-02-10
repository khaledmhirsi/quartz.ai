'use client';

import * as React from 'react';

import {
  AlertCircle,
  CheckCircle2,
  Clock,
  GripVertical,
  MoreHorizontal,
  Plus,
} from 'lucide-react';

import { Task, TaskColumn, TaskStatus } from '@/lib/types/task';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { TaskCard } from './task-card';

interface TaskBoardProps {
  columns: TaskColumn[];
  onTaskMove: (taskId: string, sourceColumnId: string, targetColumnId: string, newPosition: number) => void;
  onTaskClick?: (task: Task) => void;
  onTaskStatusChange?: (taskId: string, status: TaskStatus) => void;
  onTaskEdit?: (task: Task) => void;
  onTaskDelete?: (taskId: string) => void;
  onAddTask?: (columnId: string) => void;
  onStartTask?: (task: Task) => void;
  onAgentChat?: (task: Task) => void;
}

interface DragState {
  isDragging: boolean;
  taskId: string | null;
  sourceColumnId: string | null;
  dragOverColumnId: string | null;
  dragOverPosition: number | null;
}

const columnColors: Record<string, string> = {
  todo: 'border-t-slate-400',
  'in-progress': 'border-t-amber-500',
  blocked: 'border-t-red-500',
  done: 'border-t-green-500',
};

const columnIcons: Record<string, React.ElementType> = {
  todo: Clock,
  'in-progress': Clock,
  blocked: AlertCircle,
  done: CheckCircle2,
};

export function TaskBoard({
  columns,
  onTaskMove,
  onTaskClick,
  onTaskStatusChange,
  onTaskEdit,
  onTaskDelete,
  onAddTask,
  onStartTask,
  onAgentChat,
}: TaskBoardProps) {
  const [dragState, setDragState] = React.useState<DragState>({
    isDragging: false,
    taskId: null,
    sourceColumnId: null,
    dragOverColumnId: null,
    dragOverPosition: null,
  });

  const handleDragStart = (e: React.DragEvent, task: Task, columnId: string) => {
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.effectAllowed = 'move';
    
    setDragState({
      isDragging: true,
      taskId: task.id,
      sourceColumnId: columnId,
      dragOverColumnId: null,
      dragOverPosition: null,
    });
  };

  const handleDragEnd = () => {
    setDragState({
      isDragging: false,
      taskId: null,
      sourceColumnId: null,
      dragOverColumnId: null,
      dragOverPosition: null,
    });
  };

  const handleDragOver = (e: React.DragEvent, columnId: string, position: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    if (dragState.dragOverColumnId !== columnId || dragState.dragOverPosition !== position) {
      setDragState((prev) => ({
        ...prev,
        dragOverColumnId: columnId,
        dragOverPosition: position,
      }));
    }
  };

  const handleDrop = (e: React.DragEvent, columnId: string, position: number) => {
    e.preventDefault();
    
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId && dragState.sourceColumnId) {
      onTaskMove(taskId, dragState.sourceColumnId, columnId, position);
    }
    
    handleDragEnd();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only reset if we're actually leaving the column
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!relatedTarget?.closest('[data-column]')) {
      setDragState((prev) => ({
        ...prev,
        dragOverColumnId: null,
        dragOverPosition: null,
      }));
    }
  };

  return (
    <div className="flex h-full gap-4 overflow-x-auto p-4 pb-6">
      {columns.map((column) => {
        const ColumnIcon = columnIcons[column.id] || Clock;
        const isDropTarget = dragState.dragOverColumnId === column.id;
        
        return (
          <div
            key={column.id}
            data-column={column.id}
            className={cn(
              'flex h-full w-80 flex-shrink-0 flex-col rounded-xl border-t-4 bg-muted/30 transition-all',
              columnColors[column.id] || 'border-t-slate-400',
              isDropTarget && 'ring-2 ring-primary/50'
            )}
            onDragOver={(e) => handleDragOver(e, column.id, column.tasks.length)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, column.id, column.tasks.length)}
          >
            {/* Column Header */}
            <div className="flex items-center justify-between p-4 pb-2">
              <div className="flex items-center gap-2">
                <ColumnIcon className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold">{column.title}</h3>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {column.tasks.length}
                </span>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onAddTask?.(column.id)}>
                    Add task
                  </DropdownMenuItem>
                  <DropdownMenuItem>Sort by priority</DropdownMenuItem>
                  <DropdownMenuItem>Sort by due date</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Tasks List */}
            <div className="flex-1 space-y-3 overflow-y-auto p-4 pt-2">
              {column.tasks.map((task, index) => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task, column.id)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDragOver(e, column.id, index);
                  }}
                  onDrop={(e) => {
                    e.stopPropagation();
                    handleDrop(e, column.id, index);
                  }}
                  className={cn(
                    'cursor-grab transition-all active:cursor-grabbing',
                    dragState.taskId === task.id && 'opacity-50'
                  )}
                >
                  {/* Drop indicator */}
                  {isDropTarget &&
                    dragState.dragOverPosition === index &&
                    dragState.taskId !== task.id && (
                      <div className="mb-3 h-1 rounded-full bg-primary" />
                    )}
                  
                  <TaskCard
                    task={task}
                    isDragging={dragState.taskId === task.id}
                    onStatusChange={onTaskStatusChange}
                    onEdit={onTaskEdit}
                    onDelete={onTaskDelete}
                    onStartTask={onStartTask}
                    onAgentChat={onAgentChat}
                    variant="default"
                  />
                </div>
              ))}

              {/* Drop indicator at end of list */}
              {isDropTarget &&
                dragState.dragOverPosition === column.tasks.length &&
                column.tasks.length > 0 && (
                  <div className="h-1 rounded-full bg-primary" />
                )}

              {/* Empty state */}
              {column.tasks.length === 0 && (
                <div
                  className={cn(
                    'flex h-32 flex-col items-center justify-center rounded-xl border-2 border-dashed text-center',
                    isDropTarget ? 'border-primary bg-primary/5' : 'border-border'
                  )}
                >
                  <p className="text-sm text-muted-foreground">
                    {isDropTarget ? 'Drop here' : 'No tasks'}
                  </p>
                </div>
              )}
            </div>

            {/* Add Task Button */}
            <div className="p-4 pt-2">
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
                onClick={() => onAddTask?.(column.id)}
              >
                <Plus className="h-4 w-4" />
                Add task
              </Button>
            </div>
          </div>
        );
      })}

      {/* Add Column Button */}
      <div className="flex h-full w-80 flex-shrink-0 items-start">
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 rounded-xl border-2 border-dashed border-border p-4 text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground"
        >
          <Plus className="h-4 w-4" />
          Add column
        </Button>
      </div>
    </div>
  );
}
