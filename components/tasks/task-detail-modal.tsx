'use client';

import * as React from 'react';

import {
  ArrowUp,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  History,
  Loader2,
  MessageSquare,
  Paperclip,
  Play,
  Plus,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';

import {
  AgentMessage,
  generateAgentName,
  getAgentIcon,
  PRIORITY_CONFIG,
  STATUS_CONFIG,
  Task,
  TaskDocument,
  TaskHistoryEntry,
} from '@/lib/types/task';
import { cn } from '@/lib/utils';
import {
  createHistoryEntry,
  createTaskSpecificAgent,
  formatDuration,
  formatFileSize,
  generateAgentResponse,
  getRelativeTimeString,
  processDocument,
} from '@/lib/utils/task-utils';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';

import { StatusDropdown } from './status-dropdown';

type TabType = 'overview' | 'agent' | 'docs' | 'history';

interface TaskDetailModalProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskUpdate: (task: Task) => void;
  onStartTask?: (task: Task) => void;
}

export function TaskDetailModal({
  task,
  open,
  onOpenChange,
  onTaskUpdate,
  onStartTask,
}: TaskDetailModalProps) {
  const [activeTab, setActiveTab] = React.useState<TabType>('overview');
  const [chatInput, setChatInput] = React.useState('');
  const [isAgentTyping, setIsAgentTyping] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [processingDocId, setProcessingDocId] = React.useState<string | null>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const previousTaskIdRef = React.useRef<string | null>(null);

  // BUG FIX: Only reset tab when a DIFFERENT task is opened (not on task updates)
  // This fixes the issue where Agent Chat redirects to Overview after sending a message
  const taskId = task?.id;
  React.useEffect(() => {
    if (taskId && taskId !== previousTaskIdRef.current) {
      setActiveTab('overview');
      previousTaskIdRef.current = taskId;
    }
  }, [taskId]);

  // Reset previous task id when modal closes
  React.useEffect(() => {
    if (!open) {
      previousTaskIdRef.current = null;
    }
  }, [open]);

  // Scroll to bottom of chat only when on agent tab
  React.useEffect(() => {
    if (activeTab === 'agent') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [task?.agentMessages, activeTab]);

  if (!task) return null;

  const statusConfig = STATUS_CONFIG[task.status];
  const priorityConfig = PRIORITY_CONFIG[task.importanceLevel];
  const agentName = generateAgentName(task.title);
  const agentIcon = getAgentIcon(agentName);

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isAgentTyping) return;

    const userMessage: AgentMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: chatInput,
      timestamp: new Date(),
    };

    const updatedMessages = [...(task.agentMessages || []), userMessage];
    const taskAgent = createTaskSpecificAgent({ ...task, agentMessages: updatedMessages });

    // Update task with user message immediately
    onTaskUpdate({
      ...task,
      agentMessages: updatedMessages,
      taskAgent,
    });

    const userInput = chatInput;
    setChatInput('');
    setIsAgentTyping(true);

    try {
      // Call the AI agent API for better responses
      const response = await fetch('/api/tasks/agent-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userInput,
          taskContext: {
            id: task.id,
            title: task.title,
            description: task.description,
            deadlineType: task.deadlineType,
            importanceLevel: task.importanceLevel,
            energyRequired: task.energyRequired,
            nextStep: task.nextStep,
            status: task.status,
            dueDate: task.dueDate ? new Date(task.dueDate).toISOString() : undefined,
            estimatedMinutes: task.estimatedMinutes,
            subSteps: task.subSteps,
            documents: task.documents?.map(d => ({
              name: d.name,
              summary: d.summary,
              extractedInsights: d.extractedInsights,
            })),
          },
          conversationHistory: updatedMessages.slice(-10).map(m => ({
            role: m.role,
            content: m.content,
          })),
          agentName,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const agentResponse: AgentMessage = {
          id: data.response.id,
          role: 'assistant',
          content: data.response.content,
          timestamp: new Date(data.response.timestamp),
          suggestions: data.response.suggestions,
        };

        onTaskUpdate({
          ...task,
          agentMessages: [...updatedMessages, agentResponse],
          taskAgent,
          history: [
            ...(task.history || []),
            createHistoryEntry('agent_message', `Agent responded to user query`),
          ],
        });
      } else {
        throw new Error('API error');
      }
    } catch {
      // Fallback to local response generation
      const agentResponse = generateAgentResponse(
        { ...task, agentMessages: updatedMessages },
        userInput,
        taskAgent
      );

      onTaskUpdate({
        ...task,
        agentMessages: [...updatedMessages, agentResponse],
        taskAgent,
        history: [
          ...(task.history || []),
          createHistoryEntry('agent_message', `Agent responded to user query`),
        ],
      });
    }

    setIsAgentTyping(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const newDocs: TaskDocument[] = [];

    for (const file of Array.from(files)) {
      const docId = `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const doc: TaskDocument = {
        id: docId,
        name: file.name,
        type: file.name.split('.').pop() || 'unknown',
        size: file.size,
        url: URL.createObjectURL(file),
        uploadedAt: new Date(),
        isProcessed: false,
      };

      newDocs.push(doc);
      setProcessingDocId(docId);

      // Use AI API to analyze document
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('taskContext', task.title);

        const response = await fetch('/api/tasks/analyze-document', {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          doc.summary = data.analysis.summary;
          doc.extractedInsights = data.analysis.extractedInsights;
          doc.isProcessed = true;
        } else {
          // Fallback
          const processedDoc = processDocument(doc);
          doc.summary = processedDoc.summary;
          doc.extractedInsights = processedDoc.extractedInsights;
          doc.isProcessed = true;
        }
      } catch {
        // Fallback to local processing
        const processedDoc = processDocument(doc);
        doc.summary = processedDoc.summary;
        doc.extractedInsights = processedDoc.extractedInsights;
        doc.isProcessed = true;
      }
    }

    // Update task with new documents
    onTaskUpdate({
      ...task,
      documents: [...(task.documents || []), ...newDocs],
      history: [
        ...(task.history || []),
        ...newDocs.map((doc) =>
          createHistoryEntry('document_added', `Added document: ${doc.name}`)
        ),
      ],
    });

    setIsUploading(false);
    setProcessingDocId(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAcceptRename = () => {
    if (task.suggestedTitle) {
      onTaskUpdate({
        ...task,
        title: task.suggestedTitle,
        titleAccepted: true,
        history: [
          ...(task.history || []),
          createHistoryEntry(
            'renamed',
            'Title renamed by AI suggestion',
            task.originalTitle,
            task.suggestedTitle
          ),
        ],
      });
    }
  };

  const handleDismissRename = () => {
    onTaskUpdate({
      ...task,
      suggestedTitle: undefined,
      titleAccepted: true,
    });
  };

  const tabs: { id: TabType; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Overview', icon: FileText },
    { id: 'agent', label: 'Agent Chat', icon: MessageSquare },
    { id: 'docs', label: 'Docs', icon: Paperclip },
    { id: 'history', label: 'History', icon: History },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-hidden p-0">
        {/* Header */}
        <DialogHeader className="border-b p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <DialogTitle className="text-lg font-semibold">
                {task.title}
              </DialogTitle>
              {task.suggestedTitle && !task.titleAccepted && (
                <div className="mt-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3">
                  <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
                    <Sparkles className="h-4 w-4" />
                    <span>Suggested rename:</span>
                    <strong>{task.suggestedTitle}</strong>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" onClick={handleAcceptRename}>
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleDismissRename}
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <StatusDropdown
              status={task.status}
              onStatusChange={(status) =>
                onTaskUpdate({
                  ...task,
                  status,
                  history: [
                    ...(task.history || []),
                    createHistoryEntry(
                      'status_changed',
                      `Status changed to ${status}`,
                      task.status,
                      status
                    ),
                  ],
                })
              }
              size="sm"
            />
          </div>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex border-b px-4">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const count =
              tab.id === 'docs'
                ? task.documents?.length || 0
                : tab.id === 'agent'
                  ? task.agentMessages?.length || 0
                  : undefined;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors',
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
                {count !== undefined && count > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                    {count}
                  </Badge>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="h-[400px] overflow-y-auto p-4">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Priority</p>
                  <div className="mt-1 flex items-center gap-2">
                    <div
                      className={cn(
                        'h-2 w-2 rounded-full',
                        priorityConfig.dotColor
                      )}
                    />
                    <span className="font-medium">{priorityConfig.label}</span>
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Due Date</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      {task.dueDate
                        ? getRelativeTimeString(new Date(task.dueDate))
                        : 'No date'}
                    </span>
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Estimated</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      {task.estimatedMinutes
                        ? formatDuration(task.estimatedMinutes)
                        : 'Not set'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Description */}
              {task.description && (
                <div>
                  <h4 className="mb-2 text-sm font-medium">Description</h4>
                  <p className="text-sm text-muted-foreground">
                    {task.description}
                  </p>
                </div>
              )}

              {/* Next Step */}
              {task.nextStep && (
                <div className="rounded-lg bg-primary/5 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Next Step
                  </div>
                  <p className="mt-1 text-sm">{task.nextStep}</p>
                </div>
              )}

              {/* Subtasks */}
              {task.subSteps && task.subSteps.length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-medium">
                    Subtasks ({task.subSteps.filter((s) => s.completed).length}/
                    {task.subSteps.length})
                  </h4>
                  <div className="space-y-2">
                    {task.subSteps.map((step) => (
                      <div
                        key={step.id}
                        className="flex items-center gap-3 rounded-lg border p-3"
                      >
                        <CheckCircle2
                          className={cn(
                            'h-5 w-5',
                            step.completed
                              ? 'text-green-500'
                              : 'text-muted-foreground/30'
                          )}
                        />
                        <span
                          className={cn(
                            'text-sm',
                            step.completed &&
                              'text-muted-foreground line-through'
                          )}
                        >
                          {step.title}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Start Now Button */}
              {task.status !== 'done' && onStartTask && (
                <Button
                  onClick={() => onStartTask(task)}
                  className="w-full"
                  size="lg"
                >
                  <Play className="mr-2 h-4 w-4" />
                  Start Now
                </Button>
              )}
            </div>
          )}

          {/* Agent Chat Tab */}
          {activeTab === 'agent' && (
            <div className="flex h-full flex-col">
              {/* Agent Header */}
              <div className="mb-4 flex items-center gap-3 rounded-lg bg-muted/50 p-3">
                <Avatar className="h-10 w-10 bg-primary/10">
                  <AvatarFallback className="text-lg">{agentIcon}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{agentName}</p>
                  <p className="text-xs text-muted-foreground">
                    Your AI assistant for this task
                  </p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 space-y-4 overflow-y-auto">
                {(!task.agentMessages || task.agentMessages.length === 0) && (
                  <div className="flex h-full flex-col items-center justify-center text-center">
                    <div className="mb-3 text-4xl">{agentIcon}</div>
                    <p className="font-medium">Chat with {agentName}</p>
                    <p className="text-sm text-muted-foreground">
                      Ask for help with this task
                    </p>
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                      {[
                        'Help me get started',
                        'Break this into subtasks',
                        'Write a draft',
                      ].map((suggestion) => (
                        <Button
                          key={suggestion}
                          variant="outline"
                          size="sm"
                          onClick={() => setChatInput(suggestion)}
                        >
                          {suggestion}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {task.agentMessages?.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      'flex gap-3',
                      msg.role === 'user' && 'flex-row-reverse'
                    )}
                  >
                    {msg.role === 'assistant' && (
                      <Avatar className="h-8 w-8 flex-shrink-0 bg-primary/10">
                        <AvatarFallback className="text-sm">
                          {agentIcon}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div
                      className={cn(
                        'max-w-[80%] rounded-2xl px-4 py-2',
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      )}
                    >
                      <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                    </div>
                  </div>
                ))}

                {isAgentTyping && (
                  <div className="flex gap-3">
                    <Avatar className="h-8 w-8 flex-shrink-0 bg-primary/10">
                      <AvatarFallback className="text-sm">{agentIcon}</AvatarFallback>
                    </Avatar>
                    <div className="rounded-2xl bg-muted px-4 py-3">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="mt-4 flex gap-2">
                <Input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder={`Ask ${agentName}...`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  disabled={isAgentTyping}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!chatInput.trim() || isAgentTyping}
                  size="icon"
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Docs Tab */}
          {activeTab === 'docs' && (
            <div className="space-y-4">
              {/* Upload Button */}
              <div className="rounded-lg border-2 border-dashed p-6 text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.txt,.md"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium">Upload Documents</p>
                <p className="text-xs text-muted-foreground">
                  PDF, DOCX, TXT, MD supported
                </p>
                <Button
                  variant="outline"
                  className="mt-3"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Files
                    </>
                  )}
                </Button>
              </div>

              {/* Documents List */}
              {task.documents && task.documents.length > 0 ? (
                <div className="space-y-3">
                  {task.documents.map((doc) => (
                    <div key={doc.id} className="rounded-lg border p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                            <FileText className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{doc.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(doc.size)} •{' '}
                              {new Date(doc.uploadedAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        {doc.isProcessed && (
                          <Badge
                            variant="secondary"
                            className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          >
                            <Sparkles className="mr-1 h-3 w-3" />
                            Analyzed
                          </Badge>
                        )}
                      </div>

                      {/* AI Summary */}
                      {doc.summary && (
                        <div className="mt-3 rounded-lg bg-muted/50 p-3">
                          <p className="mb-1 text-xs font-medium text-muted-foreground">
                            AI Summary
                          </p>
                          <p className="text-sm">{doc.summary}</p>
                        </div>
                      )}

                      {/* Extracted Insights */}
                      {doc.extractedInsights && doc.extractedInsights.length > 0 && (
                        <div className="mt-3">
                          <p className="mb-2 text-xs font-medium text-muted-foreground">
                            Key Insights
                          </p>
                          <ul className="space-y-1">
                            {doc.extractedInsights.map((insight, i) => (
                              <li
                                key={i}
                                className="flex items-center gap-2 text-sm"
                              >
                                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                                {insight}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-sm text-muted-foreground">
                  No documents attached yet
                </p>
              )}
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              {task.history && task.history.length > 0 ? (
                <div className="relative">
                  <div className="absolute left-4 top-0 h-full w-px bg-border" />
                  <div className="space-y-4">
                    {[...task.history].reverse().map((entry) => (
                      <div key={entry.id} className="relative flex gap-4 pl-10">
                        <div className="absolute left-2.5 top-1 h-3 w-3 rounded-full border-2 border-background bg-border" />
                        <div className="flex-1">
                          <p className="text-sm">{entry.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(entry.timestamp).toLocaleString()}
                          </p>
                          {entry.previousValue && entry.newValue && (
                            <div className="mt-1 text-xs">
                              <span className="text-muted-foreground line-through">
                                {entry.previousValue}
                              </span>
                              <span className="mx-2">→</span>
                              <span className="text-foreground">
                                {entry.newValue}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-center text-sm text-muted-foreground">
                  No history yet
                </p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
