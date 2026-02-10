'use client';

import * as React from 'react';

import {
  ChevronRight,
  Clock,
  FileText,
  Flag,
  Loader2,
  MessageSquare,
  Plus,
  Search,
  Settings,
  Sparkles,
  Trash2,
  Zap,
} from 'lucide-react';

import { DocumentContext, SubAgentMessage } from '@/lib/types/sub-agent';
import { Task, TaskInterviewData } from '@/lib/types/task';
import { cn } from '@/lib/utils';
import {
  calculatePriorityScore,
  createHistoryEntry,
  formatDuration,
  generateSampleTasks,
} from '@/lib/utils/task-utils';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

import { SubAgentChat } from './sub-agent-chat';
import { TaskInterviewModal } from './task-interview-modal';

interface TaskWorkspaceProps {
  initialTasks?: Task[];
}

// Convert Task to include agent messages
interface TaskWithAgent extends Task {
  agentMessages: SubAgentMessage[];
  agentDocuments: DocumentContext[];
}

export function TaskWorkspace({ initialTasks }: TaskWorkspaceProps) {
  const [tasks, setTasks] = React.useState<TaskWithAgent[]>(() => {
    const sample = initialTasks || generateSampleTasks();
    return sample.map(t => ({
      ...t,
      agentMessages: [],
      agentDocuments: []
    }));
  });
  const [selectedTaskId, setSelectedTaskId] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [showInterviewModal, setShowInterviewModal] = React.useState(false);
  const [filter, setFilter] = React.useState<'all' | 'active' | 'completed'>('active');

  const selectedTask = tasks.find(t => t.id === selectedTaskId);

  // Filter tasks based on search and filter
  const filteredTasks = React.useMemo(() => {
    return tasks.filter(task => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!task.title.toLowerCase().includes(query) &&
            !task.description?.toLowerCase().includes(query)) {
          return false;
        }
      }
      
      // Status filter
      if (filter === 'active' && task.status === 'done') return false;
      if (filter === 'completed' && task.status !== 'done') return false;
      
      return true;
    }).sort((a, b) => b.priorityScore - a.priorityScore);
  }, [tasks, searchQuery, filter]);

  // Group tasks by priority
  const taskGroups = React.useMemo(() => {
    const urgent = filteredTasks.filter(t => t.priorityScore >= 70);
    const normal = filteredTasks.filter(t => t.priorityScore >= 40 && t.priorityScore < 70);
    const low = filteredTasks.filter(t => t.priorityScore < 40);
    return { urgent, normal, low };
  }, [filteredTasks]);

  const handleCreateTask = (data: TaskInterviewData) => {
    const newTask: TaskWithAgent = {
      id: `task-${Date.now()}`,
      title: data.title,
      description: data.description,
      deadlineType: data.deadlineType,
      importanceLevel: data.importanceLevel,
      energyRequired: data.energyRequired,
      nextStep: data.nextStep,
      status: 'planned',
      category: 'internal',
      dueDate: data.dueDate,
      createdAt: new Date(),
      updatedAt: new Date(),
      estimatedMinutes: data.estimatedMinutes,
      priorityScore: calculatePriorityScore({
        deadlineType: data.deadlineType,
        importanceLevel: data.importanceLevel,
        dueDate: data.dueDate,
      }),
      subSteps: [],
      agentMessages: [],
      documents: [],
      history: [createHistoryEntry('created', 'Task created via Smart Interview')],
      commentsCount: 0,
      ownerId: 'user',
      tags: [],
      columnId: 'todo',
      position: 0,
      agentDocuments: []
    };

    setTasks(prev => [newTask, ...prev]);
    setSelectedTaskId(newTask.id);
    setShowInterviewModal(false);
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
    if (selectedTaskId === taskId) {
      setSelectedTaskId(null);
    }
  };

  const handleMessagesUpdate = (taskId: string, messages: SubAgentMessage[]) => {
    setTasks(prev => prev.map(t => 
      t.id === taskId 
        ? { ...t, agentMessages: messages, updatedAt: new Date() }
        : t
    ));
  };

  const handleDocumentUpload = (taskId: string, doc: DocumentContext) => {
    setTasks(prev => prev.map(t =>
      t.id === taskId
        ? { ...t, agentDocuments: [...t.agentDocuments, doc], updatedAt: new Date() }
        : t
    ));
  };

  const handleMarkComplete = (taskId: string) => {
    setTasks(prev => prev.map(t =>
      t.id === taskId
        ? { ...t, status: 'done', completedAt: new Date(), updatedAt: new Date() }
        : t
    ));
  };

  const getPriorityColor = (score: number) => {
    if (score >= 70) return 'text-red-500';
    if (score >= 40) return 'text-amber-500';
    return 'text-slate-400';
  };

  const getPriorityBg = (score: number) => {
    if (score >= 70) return 'bg-red-500/10 border-red-500/20';
    if (score >= 40) return 'bg-amber-500/10 border-amber-500/20';
    return 'bg-slate-500/10 border-slate-500/20';
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar - Task List */}
      <div className="w-80 border-r flex flex-col">
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Quartz
            </h1>
            <Button
              size="sm"
              onClick={() => setShowInterviewModal(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              New Task
            </Button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1 mt-3">
            {(['active', 'all', 'completed'] as const).map((f) => (
              <Button
                key={f}
                variant={filter === f ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setFilter(f)}
                className="flex-1 capitalize text-xs"
              >
                {f}
              </Button>
            ))}
          </div>
        </div>

        {/* Task List */}
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-4">
            {/* Urgent tasks */}
            {taskGroups.urgent.length > 0 && (
              <div>
                <div className="px-2 py-1 text-xs font-medium text-red-500 flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  Urgent ({taskGroups.urgent.length})
                </div>
                <div className="space-y-1">
                  {taskGroups.urgent.map(task => (
                    <TaskListItem
                      key={task.id}
                      task={task}
                      isSelected={selectedTaskId === task.id}
                      onClick={() => setSelectedTaskId(task.id)}
                      onDelete={() => handleDeleteTask(task.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Normal priority tasks */}
            {taskGroups.normal.length > 0 && (
              <div>
                <div className="px-2 py-1 text-xs font-medium text-amber-500 flex items-center gap-1">
                  <Flag className="h-3 w-3" />
                  In Progress ({taskGroups.normal.length})
                </div>
                <div className="space-y-1">
                  {taskGroups.normal.map(task => (
                    <TaskListItem
                      key={task.id}
                      task={task}
                      isSelected={selectedTaskId === task.id}
                      onClick={() => setSelectedTaskId(task.id)}
                      onDelete={() => handleDeleteTask(task.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Low priority tasks */}
            {taskGroups.low.length > 0 && (
              <div>
                <div className="px-2 py-1 text-xs font-medium text-slate-400 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Later ({taskGroups.low.length})
                </div>
                <div className="space-y-1">
                  {taskGroups.low.map(task => (
                    <TaskListItem
                      key={task.id}
                      task={task}
                      isSelected={selectedTaskId === task.id}
                      onClick={() => setSelectedTaskId(task.id)}
                      onDelete={() => handleDeleteTask(task.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {filteredTasks.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No tasks found</p>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => setShowInterviewModal(true)}
                >
                  Create your first task
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Quick Stats */}
        <div className="p-4 border-t bg-muted/30">
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div>
              <p className="font-semibold">{tasks.filter(t => t.status !== 'done').length}</p>
              <p className="text-muted-foreground">Active</p>
            </div>
            <div>
              <p className="font-semibold">{tasks.filter(t => t.status === 'done').length}</p>
              <p className="text-muted-foreground">Done</p>
            </div>
            <div>
              <p className="font-semibold">{taskGroups.urgent.length}</p>
              <p className="text-muted-foreground">Urgent</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedTask ? (
          <>
            {/* Task Header */}
            <div className="p-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'h-3 w-3 rounded-full',
                  selectedTask.priorityScore >= 70 ? 'bg-red-500' :
                  selectedTask.priorityScore >= 40 ? 'bg-amber-500' : 'bg-slate-400'
                )} />
                <div>
                  <h2 className="font-semibold">{selectedTask.title}</h2>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {selectedTask.estimatedMinutes && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDuration(selectedTask.estimatedMinutes)}
                      </span>
                    )}
                    {selectedTask.agentDocuments.length > 0 && (
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {selectedTask.agentDocuments.length} doc{selectedTask.agentDocuments.length > 1 ? 's' : ''}
                      </span>
                    )}
                    <Badge variant="outline" className="text-xs">
                      {selectedTask.status.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selectedTask.status !== 'done' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleMarkComplete(selectedTask.id)}
                  >
                    Mark Complete
                  </Button>
                )}
              </div>
            </div>

            {/* Chat Interface */}
            <div className="flex-1 overflow-hidden">
              <SubAgentChat
                taskId={selectedTask.id}
                taskTitle={selectedTask.title}
                taskDescription={selectedTask.description}
                initialMessages={selectedTask.agentMessages}
                documents={selectedTask.agentDocuments}
                options={{
                  deadline: selectedTask.dueDate,
                  deadlineType: selectedTask.deadlineType,
                  priority: selectedTask.importanceLevel,
                  energyRequired: selectedTask.energyRequired,
                }}
                onMessagesUpdate={(messages) => handleMessagesUpdate(selectedTask.id, messages)}
                onDocumentUpload={(doc) => handleDocumentUpload(selectedTask.id, doc)}
              />
            </div>
          </>
        ) : (
          // Empty state
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md">
              <div className="mb-4 text-6xl">🤖</div>
              <h2 className="text-xl font-semibold mb-2">Select a Task</h2>
              <p className="text-muted-foreground mb-4">
                Choose a task from the sidebar to start chatting with your dedicated AI assistant.
                Each task gets its own specialized helper!
              </p>
              <Button onClick={() => setShowInterviewModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create New Task
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Task Interview Modal */}
      <TaskInterviewModal
        open={showInterviewModal}
        onOpenChange={setShowInterviewModal}
        onSubmit={handleCreateTask}
      />
    </div>
  );
}

// Task list item component
function TaskListItem({
  task,
  isSelected,
  onClick,
  onDelete,
}: {
  task: TaskWithAgent;
  isSelected: boolean;
  onClick: () => void;
  onDelete: () => void;
}) {
  const [showDelete, setShowDelete] = React.useState(false);

  return (
    <div
      className={cn(
        'group relative flex items-center gap-3 rounded-lg p-3 cursor-pointer transition-colors',
        isSelected
          ? 'bg-primary/10 border border-primary/20'
          : 'hover:bg-muted/50'
      )}
      onClick={onClick}
      onMouseEnter={() => setShowDelete(true)}
      onMouseLeave={() => setShowDelete(false)}
    >
      {/* Priority indicator */}
      <div className={cn(
        'h-2 w-2 rounded-full flex-shrink-0',
        task.priorityScore >= 70 ? 'bg-red-500' :
        task.priorityScore >= 40 ? 'bg-amber-500' : 'bg-slate-400',
        task.status === 'done' && 'opacity-50'
      )} />

      {/* Task info */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-sm font-medium truncate',
          task.status === 'done' && 'line-through text-muted-foreground'
        )}>
          {task.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          {task.estimatedMinutes && (
            <span className="text-xs text-muted-foreground">
              {formatDuration(task.estimatedMinutes)}
            </span>
          )}
          {task.agentMessages.length > 0 && (
            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
              <MessageSquare className="h-3 w-3" />
              {task.agentMessages.length}
            </span>
          )}
        </div>
      </div>

      {/* Delete button */}
      {showDelete && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
        </Button>
      )}

      {/* Selected indicator */}
      {isSelected && (
        <ChevronRight className="h-4 w-4 text-primary flex-shrink-0" />
      )}
    </div>
  );
}
