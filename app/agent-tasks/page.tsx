'use client';

import * as React from 'react';

import { MessageSquare, Plus, Sparkles } from 'lucide-react';

import { SubAgentTask } from '@/lib/types/sub-agent';
import { createSubAgentTask } from '@/lib/utils/sub-agent-utils';

import { Button } from '@/components/ui/button';

import { AgentChat, NewTaskModal, TaskSidebar } from '@/components/sub-agent';

// Storage key for persistence
const STORAGE_KEY = 'quartz-agent-tasks';

export default function AgentTasksPage() {
  const [tasks, setTasks] = React.useState<SubAgentTask[]>([]);
  const [activeTaskId, setActiveTaskId] = React.useState<string | null>(null);
  const [showNewTask, setShowNewTask] = React.useState(false);
  const [isLoaded, setIsLoaded] = React.useState(false);

  // Load tasks from localStorage on mount
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored, (key, value) => {
          // Revive Date objects
          if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
            return new Date(value);
          }
          return value;
        });
        setTasks(parsed);
        // Set active task to the most recent one
        if (parsed.length > 0) {
          const activeTasks = parsed.filter((t: SubAgentTask) => t.status === 'active');
          if (activeTasks.length > 0) {
            const sorted = activeTasks.sort((a: SubAgentTask, b: SubAgentTask) => 
              new Date(b.agent.state.lastActiveAt).getTime() - new Date(a.agent.state.lastActiveAt).getTime()
            );
            setActiveTaskId(sorted[0].id);
          }
        }
      }
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
    setIsLoaded(true);
  }, []);

  // Save tasks to localStorage whenever they change
  React.useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
      } catch (error) {
        console.error('Error saving tasks:', error);
      }
    }
  }, [tasks, isLoaded]);

  const activeTask = tasks.find(t => t.id === activeTaskId);

  const handleCreateTask = (taskData: {
    title: string;
    description?: string;
    deadlineType: 'urgent' | 'flexible' | 'none';
    priority: 'critical' | 'high' | 'medium' | 'low';
    energyRequired: 'high' | 'medium' | 'low';
    dueDate?: Date;
  }) => {
    const newTask = createSubAgentTask(taskData.title, {
      description: taskData.description,
      deadlineType: taskData.deadlineType,
      priority: taskData.priority,
      energyRequired: taskData.energyRequired,
      dueDate: taskData.dueDate,
    });

    setTasks(prev => [newTask, ...prev]);
    setActiveTaskId(newTask.id);
  };

  const handleTaskUpdate = (updatedTask: SubAgentTask) => {
    setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
    if (activeTaskId === taskId) {
      const remaining = tasks.filter(t => t.id !== taskId && t.status === 'active');
      setActiveTaskId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  const handleTaskSelect = (taskId: string) => {
    setActiveTaskId(taskId);
    // Mark as read
    setTasks(prev => prev.map(t => 
      t.id === taskId ? { ...t, unreadCount: 0 } : t
    ));
  };

  if (!isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Sparkles className="h-8 w-8 animate-pulse text-primary" />
          <p className="text-muted-foreground">Loading your agents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Task Sidebar */}
      <TaskSidebar
        tasks={tasks}
        activeTaskId={activeTaskId}
        onTaskSelect={handleTaskSelect}
        onNewTask={() => setShowNewTask(true)}
        onDeleteTask={handleDeleteTask}
      />

      {/* Main Chat Area */}
      <div className="flex-1">
        {activeTask ? (
          <AgentChat
            task={activeTask}
            onTaskUpdate={handleTaskUpdate}
          />
        ) : (
          <EmptyState onNewTask={() => setShowNewTask(true)} />
        )}
      </div>

      {/* New Task Modal */}
      <NewTaskModal
        open={showNewTask}
        onOpenChange={setShowNewTask}
        onCreateTask={handleCreateTask}
      />
    </div>
  );
}

// Empty State Component
function EmptyState({ onNewTask }: { onNewTask: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
        <MessageSquare className="h-10 w-10 text-primary" />
      </div>
      <h2 className="mb-2 text-2xl font-semibold">Welcome to Quartz Agents</h2>
      <p className="mb-6 max-w-md text-muted-foreground">
        Each task gets its own AI agent specialized for the job. 
        Create a task and start chatting with your personal assistant.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button onClick={onNewTask} size="lg">
          <Plus className="mr-2 h-5 w-5" />
          Create Your First Task
        </Button>
      </div>

      {/* Feature highlights */}
      <div className="mt-12 grid max-w-2xl gap-6 text-left sm:grid-cols-3">
        <div className="rounded-xl border p-4">
          <div className="mb-2 text-2xl">🔍</div>
          <h3 className="mb-1 font-medium">Smart Agents</h3>
          <p className="text-sm text-muted-foreground">
            Agents are automatically assigned based on your task type
          </p>
        </div>
        <div className="rounded-xl border p-4">
          <div className="mb-2 text-2xl">📄</div>
          <h3 className="mb-1 font-medium">Document Analysis</h3>
          <p className="text-sm text-muted-foreground">
            Upload files and let agents analyze, summarize, and quiz you
          </p>
        </div>
        <div className="rounded-xl border p-4">
          <div className="mb-2 text-2xl">💬</div>
          <h3 className="mb-1 font-medium">Chat-First</h3>
          <p className="text-sm text-muted-foreground">
            Everything happens through conversation - no complex UI
          </p>
        </div>
      </div>
    </div>
  );
}
