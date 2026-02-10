'use client';

import * as React from 'react';

import {
  Task,
  TaskAgent,
  TaskColumn,
  TaskInterviewData,
  TaskStatus,
} from '@/lib/types/task';
import {
  calculatePriorityScore,
  createTaskFromInterview,
  generateSampleTasks,
  sortTasksByPriority,
} from '@/lib/utils/task-utils';

import { AgentChatPanel } from '@/components/tasks/agent-chat-panel';
import { GoldenTimeModal } from '@/components/tasks/golden-time-modal';
import { TaskBoard } from '@/components/tasks/task-board';
import { TaskHeader } from '@/components/tasks/task-header';
import { TaskInterviewModal } from '@/components/tasks/task-interview-modal';
import { TaskList } from '@/components/tasks/task-list';

export default function TasksPage() {
  const [view, setView] = React.useState<'board' | 'list'>('board');
  const [tasks, setTasks] = React.useState<Task[]>(() => generateSampleTasks());
  const [interviewModalOpen, setInterviewModalOpen] = React.useState(false);
  const [goldenTimeModalOpen, setGoldenTimeModalOpen] = React.useState(false);
  const [chatPanelOpen, setChatPanelOpen] = React.useState(false);
  const [selectedTaskForChat, setSelectedTaskForChat] = React.useState<Task | undefined>();
  const [selectedAgent, setSelectedAgent] = React.useState<TaskAgent | undefined>();
  const [addToColumnId, setAddToColumnId] = React.useState<string>('todo');

  // Organize tasks into columns for board view
  const columns: TaskColumn[] = React.useMemo(() => {
    const columnDefs = [
      { id: 'todo', title: 'To Do', color: 'slate' },
      { id: 'in-progress', title: 'In Progress', color: 'amber' },
      { id: 'blocked', title: 'Blocked', color: 'red' },
      { id: 'done', title: 'Done', color: 'green' },
    ];

    return columnDefs.map((col) => ({
      ...col,
      tasks: sortTasksByPriority(tasks.filter((t) => t.columnId === col.id)),
    }));
  }, [tasks]);

  // Count active tasks
  const activeTaskCount = tasks.filter((t) => t.status !== 'done').length;

  // Handlers
  const handleAddTask = (columnId?: string) => {
    setAddToColumnId(columnId || 'todo');
    setInterviewModalOpen(true);
  };

  const handleCreateTask = (data: TaskInterviewData) => {
    const newTask = createTaskFromInterview(data, addToColumnId);
    const taskWithId: Task = {
      ...newTask,
      id: `task-${Date.now()}`,
    };
    setTasks((prev) => [...prev, taskWithId]);
  };

  const handleTaskStatusChange = (taskId: string, status: TaskStatus) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          // Map status to column
          const columnMap: Record<TaskStatus, string> = {
            planned: 'todo',
            in_progress: 'in-progress',
            blocked: 'blocked',
            waiting_customer: 'in-progress',
            done: 'done',
          };
          return {
            ...t,
            status,
            columnId: columnMap[status],
            completedAt: status === 'done' ? new Date() : undefined,
            updatedAt: new Date(),
          };
        }
        return t;
      })
    );
  };

  const handleTaskMove = (
    taskId: string,
    sourceColumnId: string,
    targetColumnId: string,
    newPosition: number
  ) => {
    setTasks((prev) => {
      const task = prev.find((t) => t.id === taskId);
      if (!task) return prev;

      // Map column to status
      const statusMap: Record<string, TaskStatus> = {
        todo: 'planned',
        'in-progress': 'in_progress',
        blocked: 'blocked',
        done: 'done',
      };

      return prev.map((t) => {
        if (t.id === taskId) {
          return {
            ...t,
            columnId: targetColumnId,
            status: statusMap[targetColumnId] || t.status,
            position: newPosition,
            completedAt: targetColumnId === 'done' ? new Date() : undefined,
            updatedAt: new Date(),
          };
        }
        return t;
      });
    });
  };

  const handleTaskEdit = (task: Task) => {
    // TODO: Implement edit modal
    console.log('Edit task:', task);
  };

  const handleTaskDelete = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  const handleStartTask = (task: Task) => {
    // Update task status to in progress
    handleTaskStatusChange(task.id, 'in_progress');
  };

  const handleAgentChat = (task: Task) => {
    setSelectedTaskForChat(task);
    setSelectedAgent(task.assignedAgent);
    setChatPanelOpen(true);
  };

  const handleCompleteStep = (taskId: string, stepId: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          return {
            ...t,
            subSteps: t.subSteps.map((s) =>
              s.id === stepId ? { ...s, completed: true } : s
            ),
            updatedAt: new Date(),
          };
        }
        return t;
      })
    );
  };

  const handleSearch = (query: string) => {
    // TODO: Implement search filtering
    console.log('Search:', query);
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <TaskHeader
        title="My Tasks"
        taskCount={activeTaskCount}
        view={view}
        onViewChange={setView}
        onAddTask={() => handleAddTask()}
        onGoldenTime={() => setGoldenTimeModalOpen(true)}
        onSearch={handleSearch}
      />

      {/* Main Content */}
      <main className="relative flex-1 overflow-hidden">
        {view === 'board' ? (
          <TaskBoard
            columns={columns}
            onTaskMove={handleTaskMove}
            onTaskStatusChange={handleTaskStatusChange}
            onTaskEdit={handleTaskEdit}
            onTaskDelete={handleTaskDelete}
            onAddTask={handleAddTask}
            onStartTask={handleStartTask}
            onAgentChat={handleAgentChat}
          />
        ) : (
          <TaskList
            tasks={tasks}
            groupBy="date"
            onTaskStatusChange={handleTaskStatusChange}
            onTaskEdit={handleTaskEdit}
            onTaskDelete={handleTaskDelete}
            onAddTask={() => handleAddTask()}
            onStartTask={handleStartTask}
            onAgentChat={handleAgentChat}
          />
        )}
      </main>

      {/* Modals */}
      <TaskInterviewModal
        open={interviewModalOpen}
        onOpenChange={setInterviewModalOpen}
        onSubmit={handleCreateTask}
      />

      <GoldenTimeModal
        open={goldenTimeModalOpen}
        onOpenChange={setGoldenTimeModalOpen}
        tasks={tasks}
        onStartTask={handleStartTask}
        onCompleteStep={handleCompleteStep}
      />

      {/* Agent Chat Panel */}
      <AgentChatPanel
        open={chatPanelOpen}
        onClose={() => setChatPanelOpen(false)}
        task={selectedTaskForChat}
        agent={selectedAgent}
      />
    </div>
  );
}
