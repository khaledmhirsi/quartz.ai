'use client';

import * as React from 'react';

import {
  ArrowUp,
  BookOpen,
  Bot,
  Code,
  Layout,
  Loader2,
  PenTool,
  Send,
  Sparkles,
  X,
} from 'lucide-react';

import { DEFAULT_AGENTS,Task, TaskAgent } from '@/lib/types/task';
import { cn } from '@/lib/utils';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AgentChatPanelProps {
  open: boolean;
  onClose: () => void;
  task?: Task;
  agent?: TaskAgent;
}

const AgentIcon: React.FC<{ type: TaskAgent['type']; className?: string }> = ({
  type,
  className,
}) => {
  const icons: Record<TaskAgent['type'], React.ElementType> = {
    research: BookOpen,
    design: Layout,
    writing: PenTool,
    coding: Code,
    planning: Bot,
    general: Sparkles,
  };
  const Icon = icons[type];
  return <Icon className={cn('h-4 w-4', className)} />;
};

const agentColors: Record<TaskAgent['type'], string> = {
  research: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  design: 'bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400',
  writing: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
  coding: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
  planning: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
  general: 'bg-gradient-to-br from-primary/10 to-primary/20 text-primary',
};

const suggestionPrompts = [
  "Help me get started with this task",
  "Break this down into smaller steps",
  "What should I focus on first?",
  "Give me some tips to complete this faster",
];

export function AgentChatPanel({
  open,
  onClose,
  task,
  agent: initialAgent,
}: AgentChatPanelProps) {
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [selectedAgent, setSelectedAgent] = React.useState<TaskAgent>(
    initialAgent || DEFAULT_AGENTS.find((a) => a.type === 'general')!
  );
  
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (initialAgent) {
      setSelectedAgent(initialAgent);
    }
  }, [initialAgent]);

  React.useEffect(() => {
    if (open && task && messages.length === 0) {
      // Add initial context message
      setMessages([
        {
          id: '1',
          role: 'assistant',
          content: `I'm ready to help you with "${task.title}". ${task.description ? `I see this is about: ${task.description}` : ''} What would you like assistance with?`,
          timestamp: new Date(),
        },
      ]);
    }
  }, [open, task, messages.length]);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Simulate AI response
    setTimeout(() => {
      const responses = [
        `Based on your request about "${task?.title || 'this task'}", here's what I suggest:\n\n1. Start by reviewing the current state\n2. Identify the key blockers\n3. Break it down into 15-minute chunks\n\nWould you like me to elaborate on any of these steps?`,
        `Great question! For this task, I recommend:\n\n• Focus on the most critical item first\n• Set a timer for focused work sessions\n• Document your progress as you go\n\nShall I help you create a detailed action plan?`,
        `I've analyzed your task and here's my recommendation:\n\nThe first step should be to ${task?.nextStep || 'gather all the necessary information'}. This will set you up for success with the remaining steps.\n\nWant me to help draft an outline?`,
      ];

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: responses[Math.floor(Math.random() * responses.length)],
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setIsLoading(false);
    }, 1500);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md border-l bg-background shadow-2xl animate-slide-in-right">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar className={cn('h-10 w-10', agentColors[selectedAgent.type])}>
            <AvatarImage src={selectedAgent.avatar} />
            <AvatarFallback>
              <AgentIcon type={selectedAgent.type} />
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold">{selectedAgent.name}</h3>
            <p className="text-xs text-muted-foreground">
              {selectedAgent.description}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Task Context */}
      {task && (
        <div className="border-b bg-muted/30 px-4 py-3">
          <p className="text-xs text-muted-foreground mb-1">Working on:</p>
          <p className="font-medium text-sm">{task.title}</p>
        </div>
      )}

      {/* Agent Selector */}
      <div className="flex gap-2 overflow-x-auto border-b p-3">
        {DEFAULT_AGENTS.map((agent) => (
          <button
            key={agent.id}
            onClick={() => setSelectedAgent(agent)}
            className={cn(
              'flex flex-shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-all',
              selectedAgent.id === agent.id
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-muted-foreground/50'
            )}
          >
            <Avatar className={cn('h-5 w-5', agentColors[agent.type])}>
              <AvatarFallback className="text-[10px]">
                <AgentIcon type={agent.type} className="h-3 w-3" />
              </AvatarFallback>
            </Avatar>
            <span className="whitespace-nowrap">{agent.name.split(' ')[0]}</span>
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4" style={{ height: 'calc(100vh - 280px)' }}>
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className={cn('mb-4 h-16 w-16 rounded-full flex items-center justify-center', agentColors[selectedAgent.type])}>
              <AgentIcon type={selectedAgent.type} className="h-8 w-8" />
            </div>
            <h3 className="font-semibold mb-2">Chat with {selectedAgent.name}</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Ask questions, get suggestions, or request help with your tasks.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'flex gap-3',
                  message.role === 'user' && 'flex-row-reverse'
                )}
              >
                {message.role === 'assistant' && (
                  <Avatar className={cn('h-8 w-8 flex-shrink-0', agentColors[selectedAgent.type])}>
                    <AvatarFallback>
                      <AgentIcon type={selectedAgent.type} className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                )}
                <div
                  className={cn(
                    'rounded-2xl px-4 py-2 max-w-[80%]',
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3">
                <Avatar className={cn('h-8 w-8 flex-shrink-0', agentColors[selectedAgent.type])}>
                  <AvatarFallback>
                    <AgentIcon type={selectedAgent.type} className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="rounded-2xl bg-muted px-4 py-3">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Suggestions */}
      {messages.length <= 1 && (
        <div className="border-t p-3">
          <p className="text-xs text-muted-foreground mb-2">Suggestions:</p>
          <div className="flex flex-wrap gap-2">
            {suggestionPrompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => handleSuggestionClick(prompt)}
                className="rounded-full border border-border bg-background px-3 py-1 text-xs hover:bg-muted transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Ask ${selectedAgent.name.split(' ')[0]}...`}
            className="flex-1"
            disabled={isLoading}
          />
          <Button type="submit" size="icon" disabled={!input.trim() || isLoading}>
            <ArrowUp className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
