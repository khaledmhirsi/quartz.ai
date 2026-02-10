'use client';

import * as React from 'react';

import {
  ArrowUp,
  CheckCircle2,
  FileText,
  Loader2,
  Menu,
  Paperclip,
  Plus,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';

import {
  AGENT_ROLE_CONFIGS,
  AgentInteraction,
  SubAgentDocument,
  SubAgentTask,
} from '@/lib/types/sub-agent';
import { cn } from '@/lib/utils';
import {
  CommandType,
  findTaskByQuery,
  generateTaskListText,
  getHelpText,
  parseCommand,
} from '@/lib/utils/command-parser';
import {
  addAgentResponse,
  addDocumentToAgent,
  addUserMessage,
  createSubAgentTask,
  getConversationForAPI,
} from '@/lib/utils/sub-agent-utils';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';

// Storage key
const STORAGE_KEY = 'quartz-unified-tasks';

interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  suggestions?: string[];
  agentName?: string;
  agentAvatar?: string;
  isSystemMessage?: boolean;
  attachments?: string[];
}

export function UnifiedChatInterface() {
  // Tasks state
  const [tasks, setTasks] = React.useState<SubAgentTask[]>([]);
  const [activeTaskId, setActiveTaskId] = React.useState<string | null>(null);
  
  // Chat state
  const [conversationHistory, setConversationHistory] = React.useState<ConversationMessage[]>([]);
  const [input, setInput] = React.useState('');
  const [isTyping, setIsTyping] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  
  // UI state
  const [showSidebar, setShowSidebar] = React.useState(false);
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [pendingTaskCreation, setPendingTaskCreation] = React.useState<{
    title: string;
    awaitingConfirmation: boolean;
    data?: Partial<SubAgentTask>;
  } | null>(null);
  
  // Refs
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const activeTask = tasks.find(t => t.id === activeTaskId);

  // Load from localStorage
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored, (key, value) => {
          if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
            return new Date(value);
          }
          return value;
        });
        setTasks(parsed.tasks || []);
        setConversationHistory(parsed.conversationHistory || []);
        if (parsed.activeTaskId) {
          setActiveTaskId(parsed.activeTaskId);
        }
      } else {
        // Add welcome message for new users
        setConversationHistory([{
          id: 'welcome',
          role: 'assistant',
          content: `👋 **Welcome to Quartz!** I'm your AI assistant, here to help you get things done.

You can control everything just by chatting with me:

• **"Create a task to [description]"** - I'll set up a new task
• **"Show my tasks"** - See what you're working on
• **"Work on [task name]"** - Switch to any task
• **"Help"** - See all commands

What would you like to work on today?`,
          timestamp: new Date(),
          suggestions: ['Create a new task', 'Help', 'Show my tasks'],
        }]);
      }
    } catch (error) {
      console.error('Error loading state:', error);
    }
    setIsLoaded(true);
  }, []);

  // Save to localStorage
  React.useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          tasks,
          conversationHistory: conversationHistory.slice(-100), // Keep last 100 messages
          activeTaskId,
        }));
      } catch (error) {
        console.error('Error saving state:', error);
      }
    }
  }, [tasks, conversationHistory, activeTaskId, isLoaded]);

  // Auto-scroll
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationHistory, isTyping]);

  // Auto-resize textarea
  React.useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [input]);

  // Get conversation history for API
  const getAPIConversationHistory = () => {
    return conversationHistory
      .filter(m => m.role !== 'system')
      .slice(-20)
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));
  };

  // Build current context for API
  const buildCurrentContext = () => {
    const allTasksContext = tasks
      .filter(t => t.status !== 'archived')
      .map((task, idx) => ({
        id: task.id,
        number: idx + 1,
        title: task.title,
        status: task.status,
        priority: task.priority,
        agentName: task.agent.name,
      }));

    const activeTaskContext = activeTask ? {
      id: activeTask.id,
      title: activeTask.title,
      description: activeTask.description,
      priority: activeTask.priority,
      deadlineType: activeTask.deadlineType,
      energyRequired: activeTask.energyRequired,
      dueDate: activeTask.dueDate?.toISOString(),
      agentName: activeTask.agent.name,
      agentRole: activeTask.agent.role,
      documents: activeTask.agent.documents.map(d => ({
        name: d.name,
        summary: d.summary,
        keyInsights: d.keyInsights,
      })),
      subtasks: activeTask.agent.state.subtasks.map(s => ({
        title: s.title,
        status: s.status,
      })),
      phase: activeTask.agent.state.currentPhase,
    } : undefined;

    return {
      activeTask: activeTaskContext,
      allTasks: allTasksContext,
      recentTasks: tasks.slice(0, 5).map(t => ({
        id: t.id,
        title: t.title,
        agentName: t.agent.name,
      })),
    };
  };

  // Add user message to history
  const addUserMessageToHistory = (content: string) => {
    const message: ConversationMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date(),
    };
    setConversationHistory(prev => [...prev, message]);
    return message;
  };

  // Add assistant message to history
  const addAssistantMessage = (
    content: string,
    options?: {
      suggestions?: string[];
      agentName?: string;
      agentAvatar?: string;
      isSystemMessage?: boolean;
    }
  ) => {
    const message: ConversationMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content,
      timestamp: new Date(),
      ...options,
    };
    setConversationHistory(prev => [...prev, message]);
    return message;
  };

  // Handle sending a message
  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userInput = input.trim();
    setInput('');
    addUserMessageToHistory(userInput);
    setIsTyping(true);

    try {
      // Parse the command
      const parsed = parseCommand(userInput);
      
      // Handle commands that can be resolved locally
      const localResult = await handleLocalCommand(parsed, userInput);
      if (localResult) {
        setIsTyping(false);
        return;
      }

      // For chat and complex commands, call the API
      const response = await fetch('/api/unified-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userInput,
          conversationHistory: getAPIConversationHistory(),
          currentContext: buildCurrentContext(),
          parsedCommand: parsed.type !== 'chat' ? parsed : undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Add response to conversation
        addAssistantMessage(data.response.content, {
          suggestions: data.response.suggestions,
          agentName: activeTask?.agent.name || 'Quartz',
          agentAvatar: activeTask?.agent.avatar || '✨',
        });

        // Also add to active task's agent if there is one
        if (activeTask) {
          addUserMessage(activeTask.agent, userInput);
          addAgentResponse(activeTask.agent, data.response.content, {
            suggestions: data.response.suggestions,
          });
          setTasks(prev => prev.map(t => 
            t.id === activeTask.id ? { ...t, agent: { ...activeTask.agent } } : t
          ));
        }

        // Handle any action results
        if (data.response.actionResult) {
          handleActionResult(data.response.actionResult, userInput);
        }
      } else {
        throw new Error('API error');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      addAssistantMessage(
        "I'm having trouble connecting. Could you try again?",
        { suggestions: ['Try again'] }
      );
    }

    setIsTyping(false);
  };

  // Handle commands that can be resolved locally
  const handleLocalCommand = async (
    parsed: ReturnType<typeof parseCommand>,
    originalMessage: string
  ): Promise<boolean> => {
    switch (parsed.type) {
      case 'help': {
        addAssistantMessage(getHelpText(), {
          suggestions: ['Create a new task', 'Show my tasks'],
          agentName: 'Quartz',
          agentAvatar: '✨',
        });
        return true;
      }

      case 'list_tasks': {
        const taskList = generateTaskListText(
          tasks.map((t, idx) => ({
            id: t.id,
            title: t.title,
            status: t.status,
            priority: t.priority,
            agent: { name: t.agent.name },
          })),
          activeTaskId
        );
        addAssistantMessage(taskList, {
          suggestions: tasks.length > 0 
            ? ['Work on task 1', 'Create new task']
            : ['Create a new task'],
          agentName: 'Quartz',
          agentAvatar: '✨',
        });
        return true;
      }

      case 'switch_task': {
        const { taskNumber, searchQuery } = parsed.parameters;
        let targetTask: SubAgentTask | undefined;

        if (taskNumber) {
          const activeTasks = tasks.filter(t => t.status !== 'archived' && t.status !== 'completed');
          targetTask = activeTasks[taskNumber - 1];
        } else if (searchQuery) {
          const found = findTaskByQuery(tasks, searchQuery);
          targetTask = found ? tasks.find(t => t.id === found.id) : undefined;
        }

        if (targetTask) {
          // Switch to the task's Sub-Agent
          setActiveTaskId(targetTask.id);
          
          // Build comprehensive context summary for seamless handoff
          const agent = targetTask.agent;
          const roleConfig = AGENT_ROLE_CONFIGS[agent.role];
          
          // Calculate context details
          const docCount = agent.documents.length;
          const docNames = agent.documents.map(d => d.name).slice(0, 3);
          const subtaskCount = agent.state.subtasks.length;
          const completedSubtasks = agent.state.subtasks.filter(s => s.status === 'completed').length;
          const pendingSubtasks = agent.state.subtasks.filter(s => s.status === 'pending');
          const messageCount = agent.interactionHistory.filter(m => m.role === 'user').length;
          
          // Build the handoff message
          let handoffMessage = `Alright — I'll direct you to the agent created for your task: **${targetTask.title}**.\n\n`;
          handoffMessage += `${agent.avatar} **${agent.name}** here! `;
          
          // Add personality
          handoffMessage += `${roleConfig.personalityTraits[0].charAt(0).toUpperCase() + roleConfig.personalityTraits[0].slice(1)} and ready to continue where we left off.\n\n`;
          
          // Context summary
          if (targetTask.description) {
            handoffMessage += `**Task:** ${targetTask.description}\n\n`;
          }
          
          // Memory summary - show what the agent remembers
          const memorySections: string[] = [];
          
          if (docCount > 0) {
            const docText = docCount === 1 
              ? `📄 I have **${docNames[0]}** loaded` 
              : `📄 I have **${docCount} documents** loaded (${docNames.join(', ')}${docCount > 3 ? '...' : ''})`;
            memorySections.push(docText);
          }
          
          if (subtaskCount > 0) {
            const subtaskText = `✅ Progress: **${completedSubtasks}/${subtaskCount}** subtasks completed`;
            memorySections.push(subtaskText);
            if (pendingSubtasks.length > 0) {
              memorySections.push(`📋 Next up: "${pendingSubtasks[0].title}"`);
            }
          }
          
          if (messageCount > 0) {
            memorySections.push(`💬 I remember our ${messageCount} previous exchange${messageCount > 1 ? 's' : ''}`);
          }
          
          if (memorySections.length > 0) {
            handoffMessage += `**What I remember:**\n${memorySections.join('\n')}\n\n`;
          }
          
          // Priority and deadline context
          const contextInfo: string[] = [];
          if (targetTask.priority === 'critical' || targetTask.priority === 'high') {
            contextInfo.push(`🔴 ${targetTask.priority.toUpperCase()} priority`);
          }
          if (targetTask.deadlineType === 'urgent') {
            contextInfo.push(`⏰ Urgent deadline`);
          }
          if (targetTask.dueDate) {
            contextInfo.push(`📅 Due: ${targetTask.dueDate.toLocaleDateString()}`);
          }
          if (contextInfo.length > 0) {
            handoffMessage += contextInfo.join(' • ') + '\n\n';
          }
          
          handoffMessage += `Let's get started! What would you like to work on?`;
          
          // Generate smart suggestions based on task state
          const suggestions: string[] = [];
          if (pendingSubtasks.length > 0) {
            suggestions.push(`Continue with "${pendingSubtasks[0].title}"`);
          }
          if (docCount > 0) {
            suggestions.push('Summarize my documents');
          }
          if (subtaskCount === 0) {
            suggestions.push('Break this into steps');
          }
          suggestions.push('What should I do next?');
          
          addAssistantMessage(handoffMessage, {
            suggestions: suggestions.slice(0, 3),
            agentName: agent.name,
            agentAvatar: agent.avatar,
          });
          
          // Update last active timestamp
          agent.state.lastActiveAt = new Date();
          setTasks(prev => prev.map(t => 
            t.id === targetTask!.id ? { ...t, agent: { ...agent }, unreadCount: 0 } : t
          ));
          
          return true;
        } else {
          // Couldn't find the task - be helpful
          let notFoundMessage = `I couldn't find that task. `;
          
          if (tasks.length > 0) {
            const activeTasks = tasks.filter(t => t.status === 'active');
            notFoundMessage += `Here's what you have:\n\n`;
            activeTasks.slice(0, 5).forEach((t, idx) => {
              notFoundMessage += `${idx + 1}. ${t.agent.avatar} **${t.title}** (${t.agent.name})\n`;
            });
            notFoundMessage += `\nJust say "task 1" or the task name to switch.`;
          } else {
            notFoundMessage += `You don't have any tasks yet. Want to create one?`;
          }
          
          addAssistantMessage(notFoundMessage, {
            suggestions: tasks.length > 0 
              ? ['Work on task 1', 'Show all tasks', 'Create new task'] 
              : ['Create a new task'],
            agentName: 'Quartz',
            agentAvatar: '✨',
          });
          return true;
        }
      }

      case 'create_task': {
        const { taskTitle, priority, deadlineType } = parsed.parameters;
        if (taskTitle) {
          // Create the task with a dedicated Sub-Agent
          const newTask = createSubAgentTask(taskTitle, {
            priority: priority || 'medium',
            deadlineType: deadlineType || 'flexible',
            energyRequired: 'medium',
          });
          setTasks(prev => [newTask, ...prev]);
          setActiveTaskId(newTask.id);
          
          const roleConfig = AGENT_ROLE_CONFIGS[newTask.agent.role];
          const taskNumber = tasks.length + 1;
          
          // Build a warm introduction from the new Sub-Agent
          let introMessage = `✅ **Task Created: ${newTask.title}**\n\n`;
          introMessage += `I've created a dedicated Sub-Agent for this task.\n\n`;
          introMessage += `---\n\n`;
          introMessage += `${newTask.agent.avatar} **${newTask.agent.name}** at your service!\n\n`;
          introMessage += `I'm your specialized ${roleConfig.name.toLowerCase()} for "${newTask.title}". `;
          introMessage += `${roleConfig.personalityTraits.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(', ')} — that's how I work.\n\n`;
          introMessage += `**My capabilities:**\n`;
          roleConfig.defaultCapabilities.slice(0, 4).forEach(cap => {
            const capName = cap.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            introMessage += `• ${capName}\n`;
          });
          introMessage += `\n**To get started, tell me:**\n`;
          introMessage += `• What's the end goal?\n`;
          introMessage += `• Any deadline I should know about?\n`;
          introMessage += `• Do you have documents to share?\n\n`;
          introMessage += `You can always come back to me by saying "work on task ${taskNumber}" or "${newTask.title}". I'll remember everything!`;
          
          addAssistantMessage(introMessage, {
            suggestions: ['It\'s urgent', 'Let\'s break it into steps', 'I have a document to upload'],
            agentName: newTask.agent.name,
            agentAvatar: newTask.agent.avatar,
          });
          return true;
        }
        return false; // Let API handle if no clear title
      }

      case 'complete_task': {
        const { taskNumber } = parsed.parameters;
        let targetTask: SubAgentTask | undefined;

        if (taskNumber) {
          const activeTasks = tasks.filter(t => t.status !== 'archived' && t.status !== 'completed');
          targetTask = activeTasks[taskNumber - 1];
        } else if (activeTask) {
          targetTask = activeTask;
        }

        if (targetTask) {
          setTasks(prev => prev.map(t => 
            t.id === targetTask!.id 
              ? { ...t, status: 'completed' as const, completedAt: new Date() }
              : t
          ));
          
          const remainingTasks = tasks.filter(t => 
            t.id !== targetTask!.id && t.status === 'active'
          );

          addAssistantMessage(
            `🎉 **Task Completed: ${targetTask.title}**\n\nGreat work! That's one more thing off your plate.\n\n${remainingTasks.length > 0 ? `You have ${remainingTasks.length} more task${remainingTasks.length > 1 ? 's' : ''} to work on.` : "You're all caught up! 🌟"}`,
            {
              suggestions: remainingTasks.length > 0 
                ? ['Show my tasks', 'Work on next task', 'Create new task']
                : ['Create a new task', 'Show completed tasks'],
              agentName: 'Quartz',
              agentAvatar: '✨',
            }
          );

          if (activeTaskId === targetTask.id) {
            setActiveTaskId(remainingTasks[0]?.id || null);
          }
          return true;
        }
        return false;
      }

      case 'delete_task': {
        const { taskNumber, searchQuery } = parsed.parameters;
        let targetTask: SubAgentTask | undefined;

        if (taskNumber) {
          const activeTasks = tasks.filter(t => t.status !== 'archived');
          targetTask = activeTasks[taskNumber - 1];
        } else if (searchQuery) {
          const found = findTaskByQuery(tasks, searchQuery);
          targetTask = found ? tasks.find(t => t.id === found.id) : undefined;
        }

        if (targetTask) {
          // Ask for confirmation
          addAssistantMessage(
            `⚠️ **Delete Task: ${targetTask.title}?**\n\nThis will permanently remove the task and all its history.\n\nSay "yes, delete it" to confirm or "no" to cancel.`,
            {
              suggestions: ['Yes, delete it', 'No, keep it'],
              agentName: 'Quartz',
              agentAvatar: '✨',
            }
          );
          
          // Set pending deletion (would need more state management in production)
          return true;
        }
        return false;
      }

      default:
        return false;
    }
  };

  // Handle action results from API
  const handleActionResult = (
    result: { type: string; data?: Record<string, unknown> },
    originalMessage: string
  ) => {
    // Handle based on action type
    switch (result.type) {
      case 'task_created':
        // Task creation should be handled locally, but if API created one...
        break;
      case 'task_switched':
        // Already handled locally
        break;
      case 'task_completed':
        // Already handled locally
        break;
    }
  };

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !activeTask) {
      if (!activeTask) {
        addAssistantMessage(
          "To upload a document, please select or create a task first. The document will be associated with that task.",
          { suggestions: ['Create a new task', 'Show my tasks'] }
        );
      }
      return;
    }

    setIsUploading(true);

    for (const file of Array.from(files)) {
      // Add user message about upload
      addUserMessageToHistory(`[Uploaded: ${file.name}]`);

      const doc: SubAgentDocument = {
        id: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: file.name,
        type: file.name.split('.').pop() || 'unknown',
        size: file.size,
        uploadedAt: new Date(),
        isProcessed: false,
      };

      addDocumentToAgent(activeTask.agent, doc);
      
      addAssistantMessage(
        `📄 Got it! I've received **${file.name}**. Let me analyze it for you...`,
        {
          agentName: activeTask.agent.name,
          agentAvatar: activeTask.agent.avatar,
        }
      );

      // Update task state
      setTasks(prev => prev.map(t => 
        t.id === activeTask.id ? { ...t, agent: { ...activeTask.agent } } : t
      ));

      // Analyze document
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('taskContext', activeTask.title);

        const response = await fetch('/api/tasks/analyze-document', {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          doc.summary = data.analysis.summary;
          doc.keyInsights = data.analysis.extractedInsights;
          doc.isProcessed = true;

          const insightsText = doc.keyInsights?.length 
            ? `\n\n**Key Insights:**\n${doc.keyInsights.map(i => `• ${i}`).join('\n')}`
            : '';
          
          addAssistantMessage(
            `✅ **Analysis Complete: ${file.name}**\n\n${doc.summary}${insightsText}\n\nWhat would you like me to do with this?`,
            {
              suggestions: ['Summarize the key points', 'Extract questions', 'Quiz me on this'],
              agentName: activeTask.agent.name,
              agentAvatar: activeTask.agent.avatar,
            }
          );
        } else {
          doc.isProcessed = true;
          doc.summary = 'Document uploaded successfully';
          addAssistantMessage(
            `I've saved **${file.name}**. How would you like me to help you with it?`,
            {
              suggestions: ['Summarize this document', 'What are the key points?'],
              agentName: activeTask.agent.name,
              agentAvatar: activeTask.agent.avatar,
            }
          );
        }
      } catch {
        doc.isProcessed = true;
        addAssistantMessage(
          `I've saved **${file.name}**. I couldn't analyze it automatically, but I'm ready to help!`,
          { agentName: activeTask.agent.name, agentAvatar: activeTask.agent.avatar }
        );
      }

      // Update task state again with analysis results
      setTasks(prev => prev.map(t => 
        t.id === activeTask.id ? { ...t, agent: { ...activeTask.agent } } : t
      ));
    }

    setIsUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    textareaRef.current?.focus();
  };

  // Handle key down
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Sparkles className="h-8 w-8 animate-pulse text-primary" />
          <p className="text-muted-foreground">Loading Quartz...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Mobile Sidebar Toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed left-4 top-4 z-50 md:hidden"
        onClick={() => setShowSidebar(!showSidebar)}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Task Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-40 w-72 border-r bg-background/95 backdrop-blur transition-transform md:relative md:translate-x-0",
        showSidebar ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex h-full flex-col">
          {/* Sidebar Header */}
          <div className="flex items-center justify-between border-b p-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <span className="font-semibold">Quartz</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setShowSidebar(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Task List */}
          <ScrollArea className="flex-1 p-2">
            {tasks.filter(t => t.status !== 'archived').length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No tasks yet. Start chatting to create one!
              </div>
            ) : (
              <div className="space-y-1">
                {tasks
                  .filter(t => t.status !== 'archived')
                  .map((task, idx) => (
                    <button
                      key={task.id}
                      onClick={() => {
                        setActiveTaskId(task.id);
                        setShowSidebar(false);
                        
                        // Build comprehensive handoff message
                        const agent = task.agent;
                        const docCount = agent.documents.length;
                        const subtaskCount = agent.state.subtasks.length;
                        const completedSubtasks = agent.state.subtasks.filter(s => s.status === 'completed').length;
                        const pendingSubtasks = agent.state.subtasks.filter(s => s.status === 'pending');
                        
                        let handoffMsg = `Alright — switching to your task: **${task.title}**.\n\n`;
                        handoffMsg += `${agent.avatar} **${agent.name}** here, ready to continue!\n\n`;
                        
                        const context: string[] = [];
                        if (docCount > 0) context.push(`📄 ${docCount} document${docCount > 1 ? 's' : ''} loaded`);
                        if (subtaskCount > 0) context.push(`✅ ${completedSubtasks}/${subtaskCount} steps done`);
                        if (context.length > 0) {
                          handoffMsg += context.join(' • ') + '\n\n';
                        }
                        
                        handoffMsg += `What would you like to work on?`;
                        
                        const suggestions: string[] = [];
                        if (pendingSubtasks.length > 0) suggestions.push(`Continue: ${pendingSubtasks[0].title.substring(0, 25)}`);
                        suggestions.push('What should I do next?');
                        if (docCount > 0) suggestions.push('Review documents');
                        
                        addAssistantMessage(handoffMsg, {
                          suggestions: suggestions.slice(0, 3),
                          agentName: agent.name,
                          agentAvatar: agent.avatar,
                        });
                        
                        // Update last active
                        agent.state.lastActiveAt = new Date();
                        setTasks(prev => prev.map(t => 
                          t.id === task.id ? { ...t, agent: { ...agent }, unreadCount: 0 } : t
                        ));
                      }}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors hover:bg-muted",
                        task.id === activeTaskId && "bg-muted"
                      )}
                    >
                      <span className="text-xl">{task.agent.avatar}</span>
                      <div className="flex-1 overflow-hidden">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">
                            {task.title}
                          </span>
                          {task.status === 'completed' && (
                            <CheckCircle2 className="h-3 w-3 text-green-500" />
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {task.agent.name}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {idx + 1}
                      </Badge>
                    </button>
                  ))}
              </div>
            )}
          </ScrollArea>

          {/* Quick Actions */}
          <div className="border-t p-4">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => {
                setInput('Create a new task to ');
                textareaRef.current?.focus();
                setShowSidebar(false);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              New Task
            </Button>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3 md:px-6">
          <div className="flex items-center gap-3 pl-10 md:pl-0">
            {activeTask ? (
              <>
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="text-lg">
                    {activeTask.agent.avatar}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{activeTask.agent.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {AGENT_ROLE_CONFIGS[activeTask.agent.role].name}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Working on: {activeTask.title}
                  </span>
                </div>
              </>
            ) : (
              <>
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="text-lg">✨</AvatarFallback>
                </Avatar>
                <div>
                  <span className="font-medium">Quartz</span>
                  <p className="text-xs text-muted-foreground">
                    Your AI assistant
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Progress indicator for active task */}
          {activeTask && activeTask.agent.state.subtasks.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {activeTask.agent.state.subtasks.filter(s => s.status === 'completed').length}/
                {activeTask.agent.state.subtasks.length}
              </span>
              <Progress value={activeTask.agent.state.progress} className="h-2 w-20" />
            </div>
          )}
        </div>

        {/* Documents Bar */}
        {activeTask && activeTask.agent.documents.length > 0 && (
          <div className="flex gap-2 overflow-x-auto border-b px-4 py-2">
            {activeTask.agent.documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-1.5 text-xs"
              >
                <FileText className="h-3 w-3" />
                <span className="max-w-[100px] truncate">{doc.name}</span>
                {doc.isProcessed && (
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                )}
              </div>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={() => fileInputRef.current?.click()}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4 pb-4">
            {conversationHistory.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                onSuggestionClick={handleSuggestionClick}
              />
            ))}

            {isTyping && (
              <div className="flex gap-3">
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarFallback>
                    {activeTask?.agent.avatar || '✨'}
                  </AvatarFallback>
                </Avatar>
                <div className="rounded-2xl bg-muted px-4 py-3">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="border-t p-4">
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.txt,.md"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex-shrink-0"
            >
              {isUploading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Paperclip className="h-5 w-5" />
              )}
            </Button>
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message or command..."
              disabled={isTyping}
              className="min-h-[44px] max-h-[150px] resize-none"
              rows={1}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              size="icon"
              className="flex-shrink-0"
            >
              <ArrowUp className="h-5 w-5" />
            </Button>
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Type naturally • create task, show tasks, help for commands
          </p>
        </div>
      </div>
    </div>
  );
}

// Message Bubble Component
function MessageBubble({
  message,
  onSuggestionClick,
}: {
  message: ConversationMessage;
  onSuggestionClick: (suggestion: string) => void;
}) {
  const isAssistant = message.role === 'assistant';

  return (
    <div className={cn('flex gap-3', !isAssistant && 'flex-row-reverse')}>
      {isAssistant && (
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarFallback>{message.agentAvatar || '✨'}</AvatarFallback>
        </Avatar>
      )}
      <div className={cn('max-w-[85%] space-y-2', !isAssistant && 'items-end')}>
        <div
          className={cn(
            'rounded-2xl px-4 py-2.5',
            isAssistant ? 'bg-muted' : 'bg-primary text-primary-foreground'
          )}
        >
          <div className="text-sm whitespace-pre-wrap">
            {formatMessage(message.content)}
          </div>
        </div>

        {/* Suggestions */}
        {isAssistant && message.suggestions && message.suggestions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {message.suggestions.map((suggestion, idx) => (
              <Button
                key={idx}
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => onSuggestionClick(suggestion)}
              >
                {suggestion}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Simple markdown-like formatting
function formatMessage(content: string): React.ReactNode {
  const parts = content.split(/(```[\s\S]*?```)/g);
  
  return parts.map((part, idx) => {
    if (part.startsWith('```')) {
      const code = part.replace(/```\w*\n?/g, '').replace(/```$/g, '');
      return (
        <pre key={idx} className="my-2 rounded-lg bg-black/10 dark:bg-white/10 p-3 overflow-x-auto">
          <code className="text-xs font-mono">{code}</code>
        </pre>
      );
    }
    
    // Process inline formatting
    return (
      <span key={idx}>
        {part.split(/(\*\*[^*]+\*\*)/g).map((segment, i) => {
          if (segment.startsWith('**') && segment.endsWith('**')) {
            return <strong key={i}>{segment.slice(2, -2)}</strong>;
          }
          return segment;
        })}
      </span>
    );
  });
}
