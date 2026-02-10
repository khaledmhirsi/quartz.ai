'use client';

import * as React from 'react';

import {
  ArrowUp,
  FileText,
  Loader2,
  Paperclip,
  Plus,
  Send,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';

import {
  AGENT_ROLE_CONFIG,
  createSubAgent,
  DocumentContext,
  SubAgent,
  SubAgentMessage,
} from '@/lib/types/sub-agent';
import { cn } from '@/lib/utils';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface SubAgentChatProps {
  taskId: string;
  taskTitle: string;
  taskDescription?: string;
  initialMessages?: SubAgentMessage[];
  documents?: DocumentContext[];
  options?: {
    deadline?: Date;
    deadlineType?: 'urgent' | 'flexible' | 'none';
    priority?: 'critical' | 'high' | 'medium' | 'low';
    energyRequired?: 'high' | 'medium' | 'low';
  };
  onMessagesUpdate?: (messages: SubAgentMessage[]) => void;
  onDocumentUpload?: (doc: DocumentContext) => void;
}

export function SubAgentChat({
  taskId,
  taskTitle,
  taskDescription,
  initialMessages = [],
  documents = [],
  options = {},
  onMessagesUpdate,
  onDocumentUpload,
}: SubAgentChatProps) {
  const [messages, setMessages] = React.useState<SubAgentMessage[]>(initialMessages);
  const [input, setInput] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [isInitializing, setIsInitializing] = React.useState(true);
  const [agent, setAgent] = React.useState<SubAgent | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Initialize agent on mount or when taskId changes
  React.useEffect(() => {
    const init = async () => {
      setIsInitializing(true);
      
      try {
        const response = await fetch('/api/tasks/sub-agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create',
            taskId,
            taskTitle,
            taskDescription,
            documents,
            options
          }),
        });

        if (response.ok) {
          const data = await response.json();
          
          // Create local agent instance
          const localAgent = createSubAgent(taskId, taskTitle, taskDescription, {
            ...options,
            documents
          });
          localAgent.name = data.agent.name;
          localAgent.role = data.agent.role;
          localAgent.avatar = data.agent.avatar;
          localAgent.capabilities = data.agent.capabilities;
          
          setAgent(localAgent);

          // Add greeting message if no initial messages
          if (initialMessages.length === 0) {
            setMessages([{
              id: data.greeting.id,
              role: 'assistant',
              content: data.greeting.content,
              timestamp: new Date(data.greeting.timestamp),
              suggestions: data.greeting.suggestions
            }]);
          }
        } else {
          // Fallback to local agent creation
          const localAgent = createSubAgent(taskId, taskTitle, taskDescription, {
            ...options,
            documents
          });
          setAgent(localAgent);
          
          const config = AGENT_ROLE_CONFIG[localAgent.role];
          if (initialMessages.length === 0) {
            setMessages([{
              id: `msg-${Date.now()}`,
              role: 'assistant',
              content: `Hi! I'm ${localAgent.name} ${config.avatar}, your dedicated assistant for "${taskTitle}". I'm here to help you succeed! What would you like to work on first?`,
              timestamp: new Date(),
              suggestions: ['Break this into steps', 'What should I do first?', 'Help me understand']
            }]);
          }
        }
      } catch (error) {
        console.error('Failed to initialize agent:', error);
        // Fallback
        const localAgent = createSubAgent(taskId, taskTitle, taskDescription, {
          ...options,
          documents
        });
        setAgent(localAgent);
      }
      
      setIsInitializing(false);
    };

    init();
  }, [taskId, taskTitle, taskDescription, documents, options, initialMessages.length]);

  // Scroll to bottom when messages change
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Notify parent of message updates
  React.useEffect(() => {
    if (onMessagesUpdate && messages.length > 0) {
      onMessagesUpdate(messages);
    }
  }, [messages, onMessagesUpdate]);

  const handleSend = async () => {
    if (!input.trim() || isLoading || !agent) return;

    const userMessage: SubAgentMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Add thinking indicator
    const thinkingId = `thinking-${Date.now()}`;
    setMessages(prev => [...prev, {
      id: thinkingId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isThinking: true
    }]);

    try {
      const response = await fetch('/api/tasks/sub-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'chat',
          taskId,
          taskTitle,
          taskDescription,
          message: userMessage.content,
          conversationHistory: messages.filter(m => !m.isThinking),
          documents,
          options
        }),
      });

      // Remove thinking indicator
      setMessages(prev => prev.filter(m => m.id !== thinkingId));

      if (response.ok) {
        const data = await response.json();
        setMessages(prev => [...prev, {
          id: data.response.id,
          role: 'assistant',
          content: data.response.content,
          timestamp: new Date(data.response.timestamp),
          suggestions: data.response.suggestions,
          toolUsed: data.response.toolUsed
        }]);
      } else {
        throw new Error('API error');
      }
    } catch (error) {
      console.error('Chat error:', error);
      // Remove thinking indicator and add error message
      setMessages(prev => prev.filter(m => m.id !== thinkingId));
      setMessages(prev => [...prev, {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: "I'm having trouble connecting right now. Could you try again?",
        timestamp: new Date(),
        suggestions: ['Try again', 'Rephrase my question']
      }]);
    }

    setIsLoading(false);
    textareaRef.current?.focus();
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    textareaRef.current?.focus();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);

    for (const file of Array.from(files)) {
      try {
        // Create document context
        const doc: DocumentContext = {
          id: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: file.name,
          type: file.name.split('.').pop() || 'unknown',
          uploadedAt: new Date(),
        };

        // Analyze document
        const formData = new FormData();
        formData.append('file', file);
        formData.append('taskContext', taskTitle);

        const response = await fetch('/api/tasks/analyze-document', {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          doc.summary = data.analysis.summary;
          doc.keyInsights = data.analysis.extractedInsights;
        }

        // Notify parent
        if (onDocumentUpload) {
          onDocumentUpload(doc);
        }

        // Add message about uploaded document
        setMessages(prev => [...prev, {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: `📄 I've received and analyzed **${file.name}**!\n\n${doc.summary || 'Document uploaded successfully.'}\n\nWhat would you like me to do with this document?`,
          timestamp: new Date(),
          suggestions: ['Summarize the key points', 'Extract questions from it', 'What should I know from this?']
        }]);

      } catch (error) {
        console.error('Upload error:', error);
        setMessages(prev => [...prev, {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: `I had trouble processing that file. Could you try uploading it again?`,
          timestamp: new Date(),
        }]);
      }
    }

    setIsUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (isInitializing) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-2 text-sm text-muted-foreground">
            Initializing your assistant...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Agent Header */}
      {agent && (
        <div className="flex items-center gap-3 border-b p-4">
          <Avatar className="h-12 w-12 bg-primary/10">
            <AvatarFallback className="text-2xl">{agent.avatar}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold">{agent.name}</h2>
              <Badge variant="secondary" className="text-xs">
                {AGENT_ROLE_CONFIG[agent.role].name}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-1">
              {agent.personality}
            </p>
          </div>
          {/* Document count */}
          {documents.length > 0 && (
            <Badge variant="outline" className="gap-1">
              <FileText className="h-3 w-3" />
              {documents.length} doc{documents.length > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              'flex gap-3',
              msg.role === 'user' && 'flex-row-reverse'
            )}
          >
            {msg.role === 'assistant' && agent && (
              <Avatar className="h-8 w-8 flex-shrink-0 bg-primary/10">
                <AvatarFallback className="text-sm">{agent.avatar}</AvatarFallback>
              </Avatar>
            )}
            
            <div className={cn(
              'max-w-[85%] space-y-2',
              msg.role === 'user' && 'items-end'
            )}>
              {/* Message bubble */}
              <div
                className={cn(
                  'rounded-2xl px-4 py-3',
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted',
                  msg.isThinking && 'bg-muted/50'
                )}
              >
                {msg.isThinking ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">Thinking...</span>
                  </div>
                ) : (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <p className="whitespace-pre-wrap text-sm m-0">{msg.content}</p>
                  </div>
                )}
              </div>

              {/* Tool indicator */}
              {msg.toolUsed && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Sparkles className="h-3 w-3" />
                  <span>Used: {msg.toolUsed.replace(/_/g, ' ')}</span>
                </div>
              )}

              {/* Suggestions */}
              {msg.role === 'assistant' && msg.suggestions && msg.suggestions.length > 0 && !msg.isThinking && (
                <div className="flex flex-wrap gap-2">
                  {msg.suggestions.map((suggestion, idx) => (
                    <Button
                      key={idx}
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => handleSuggestionClick(suggestion)}
                    >
                      {suggestion}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t p-4">
        <div className="flex gap-2">
          {/* File upload button */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.txt,.md"
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || isLoading}
            className="flex-shrink-0"
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Paperclip className="h-4 w-4" />
            )}
          </Button>

          {/* Text input */}
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${agent?.name || 'your assistant'}...`}
            className="min-h-[44px] max-h-[120px] resize-none"
            rows={1}
            disabled={isLoading}
          />

          {/* Send button */}
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            size="icon"
            className="flex-shrink-0"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUp className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Quick actions */}
        {agent && documents.length === 0 && messages.length <= 2 && (
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <span>Quick start:</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mr-1 h-3 w-3" />
              Upload a document
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
