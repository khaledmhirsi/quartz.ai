'use client';

import * as React from 'react';

import {
  ArrowUp,
  CheckCircle2,
  FileText,
  Loader2,
  Paperclip,
  Plus,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';

import {
  AGENT_ROLE_CONFIGS,
  AgentInteraction,
  SubAgent,
  SubAgentDocument,
  SubAgentTask,
} from '@/lib/types/sub-agent';
import { cn } from '@/lib/utils';
import {
  addAgentResponse,
  addDocumentToAgent,
  addUserMessage,
  getConversationForAPI,
} from '@/lib/utils/sub-agent-utils';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';

interface AgentChatProps {
  task: SubAgentTask;
  onTaskUpdate: (task: SubAgentTask) => void;
}

export function AgentChat({ task, onTaskUpdate }: AgentChatProps) {
  const [input, setInput] = React.useState('');
  const [isTyping, setIsTyping] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const { agent } = task;
  const roleConfig = AGENT_ROLE_CONFIGS[agent.role];

  // Auto-scroll to bottom
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [agent.interactionHistory]);

  // Auto-resize textarea
  React.useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [input]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userInput = input.trim();
    setInput('');
    
    // Add user message
    addUserMessage(agent, userInput);
    onTaskUpdate({ ...task, agent: { ...agent } });
    
    setIsTyping(true);

    try {
      const response = await fetch('/api/tasks/sub-agent-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userInput,
          systemPrompt: agent.systemPrompt,
          conversationHistory: getConversationForAPI(agent),
          agentContext: {
            name: agent.name,
            role: agent.role,
            taskTitle: task.title,
            documents: agent.documents.map(d => ({
              name: d.name,
              summary: d.summary,
            })),
            subtasks: agent.state.subtasks.map(s => ({
              title: s.title,
              status: s.status,
            })),
            phase: agent.state.currentPhase,
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        addAgentResponse(agent, data.response.content, {
          suggestions: data.response.suggestions,
          actionType: 'message',
        });
      } else {
        throw new Error('API error');
      }
    } catch {
      addAgentResponse(agent, "I'm having trouble connecting right now. Let me try again - what were you asking about?", {
        suggestions: ['Try again', 'Help me with something else'],
      });
    }

    setIsTyping(false);
    onTaskUpdate({ 
      ...task, 
      agent: { ...agent },
      lastMessage: agent.interactionHistory[agent.interactionHistory.length - 1]?.content.substring(0, 100),
      unreadCount: 0,
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);

    for (const file of Array.from(files)) {
      const doc: SubAgentDocument = {
        id: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: file.name,
        type: file.name.split('.').pop() || 'unknown',
        size: file.size,
        uploadedAt: new Date(),
        isProcessed: false,
      };

      // Add document to agent
      addDocumentToAgent(agent, doc);

      // Add system message about upload
      addAgentResponse(agent, `📄 Got it! I've received **${file.name}**. Let me analyze it for you...`, {
        actionType: 'document_upload',
      });

      onTaskUpdate({ ...task, agent: { ...agent } });

      // Analyze document
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
          doc.keyInsights = data.analysis.extractedInsights;
          doc.isProcessed = true;

          // Add analysis message
          const insightsText = doc.keyInsights?.length 
            ? `\n\n**Key Insights:**\n${doc.keyInsights.map(i => `• ${i}`).join('\n')}`
            : '';
          
          addAgentResponse(agent, `✅ **Analysis Complete for ${file.name}**\n\n${doc.summary}${insightsText}\n\nWhat would you like me to do with this? I can summarize further, extract questions, or help you work through the content.`, {
            actionType: 'document_analysis',
            suggestions: ['Summarize the key points', 'Extract study questions', 'Help me understand this'],
          });
        } else {
          doc.isProcessed = true;
          doc.summary = 'Document uploaded successfully';
          addAgentResponse(agent, `I've saved **${file.name}**. How would you like me to help you with it?`, {
            suggestions: ['Summarize this document', 'What questions does this answer?'],
          });
        }
      } catch {
        doc.isProcessed = true;
        addAgentResponse(agent, `I've saved **${file.name}**. I couldn't analyze it automatically, but I'm ready to help you work through it!`, {});
      }
    }

    setIsUploading(false);
    onTaskUpdate({ ...task, agent: { ...agent } });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Agent Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10" style={{ backgroundColor: `var(--${roleConfig.color}-100)` }}>
            <AvatarFallback className="text-xl">{agent.avatar}</AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold">{agent.name}</h2>
              <Badge variant="secondary" className="text-xs">
                {roleConfig.name}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {agent.personality}
            </p>
          </div>
        </div>
        
        {/* Progress indicator */}
        {agent.state.subtasks.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {agent.state.subtasks.filter(s => s.status === 'completed').length}/{agent.state.subtasks.length}
            </span>
            <Progress value={agent.state.progress} className="h-2 w-20" />
          </div>
        )}
      </div>

      {/* Documents Bar (if any) */}
      {agent.documents.length > 0 && (
        <div className="flex gap-2 overflow-x-auto border-b px-4 py-2">
          {agent.documents.map((doc) => (
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
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {agent.interactionHistory.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            agentAvatar={agent.avatar}
            agentName={agent.name}
            onSuggestionClick={handleSuggestionClick}
          />
        ))}

        {isTyping && (
          <div className="flex gap-3">
            <Avatar className="h-8 w-8 flex-shrink-0">
              <AvatarFallback>{agent.avatar}</AvatarFallback>
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
            placeholder={`Message ${agent.name}...`}
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
      </div>
    </div>
  );
}

// Message Bubble Component
function MessageBubble({
  message,
  agentAvatar,
  agentName,
  onSuggestionClick,
}: {
  message: AgentInteraction;
  agentAvatar: string;
  agentName: string;
  onSuggestionClick: (suggestion: string) => void;
}) {
  const isAgent = message.role === 'agent';

  return (
    <div className={cn('flex gap-3', !isAgent && 'flex-row-reverse')}>
      {isAgent && (
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarFallback>{agentAvatar}</AvatarFallback>
        </Avatar>
      )}
      <div className={cn('max-w-[85%] space-y-2', !isAgent && 'items-end')}>
        <div
          className={cn(
            'rounded-2xl px-4 py-2.5',
            isAgent ? 'bg-muted' : 'bg-primary text-primary-foreground'
          )}
        >
          {/* Action badge */}
          {message.actionType && message.actionType !== 'message' && (
            <div className="mb-2 flex items-center gap-1.5 text-xs opacity-70">
              {message.actionType === 'document_upload' && (
                <>
                  <Upload className="h-3 w-3" />
                  Document Uploaded
                </>
              )}
              {message.actionType === 'document_analysis' && (
                <>
                  <Sparkles className="h-3 w-3" />
                  Analysis Complete
                </>
              )}
              {message.actionType === 'subtask_created' && (
                <>
                  <CheckCircle2 className="h-3 w-3" />
                  Subtasks Created
                </>
              )}
            </div>
          )}
          
          {/* Message content with markdown-like formatting */}
          <div className="text-sm whitespace-pre-wrap">
            {formatMessage(message.content)}
          </div>
        </div>

        {/* Suggestions */}
        {isAgent && message.suggestions && message.suggestions.length > 0 && (
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
  // Split by code blocks first
  const parts = content.split(/(```[\s\S]*?```)/g);
  
  return parts.map((part, idx) => {
    if (part.startsWith('```')) {
      // Code block
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
