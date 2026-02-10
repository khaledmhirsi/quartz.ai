'use client';

import * as React from 'react';

import {
  BookOpen,
  Bot,
  Check,
  ChevronDown,
  Code,
  Layout,
  MessageSquare,
  PenTool,
  Sparkles,
} from 'lucide-react';

import { DEFAULT_AGENTS, TaskAgent } from '@/lib/types/task';
import { cn } from '@/lib/utils';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface AgentSelectorProps {
  selectedAgent?: TaskAgent;
  onAgentSelect: (agent: TaskAgent | undefined) => void;
  onChatWithAgent?: (agent: TaskAgent) => void;
  showChatButton?: boolean;
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

export function AgentSelector({
  selectedAgent,
  onAgentSelect,
  onChatWithAgent,
  showChatButton = true,
}: AgentSelectorProps) {
  const [open, setOpen] = React.useState(false);

  const mainAgent = DEFAULT_AGENTS.find((a) => a.type === 'general');
  const subAgents = DEFAULT_AGENTS.filter((a) => a.type !== 'general');

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'h-9 gap-2',
              selectedAgent && agentColors[selectedAgent.type]
            )}
          >
            {selectedAgent ? (
              <>
                <Avatar className="h-5 w-5">
                  <AvatarImage src={selectedAgent.avatar} />
                  <AvatarFallback className="text-[10px]">
                    <AgentIcon type={selectedAgent.type} className="h-3 w-3" />
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm">{selectedAgent.name}</span>
              </>
            ) : (
              <>
                <Bot className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Assign Agent</span>
              </>
            )}
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            Main Agent
          </DropdownMenuLabel>
          {mainAgent && (
            <DropdownMenuItem
              onClick={() => {
                onAgentSelect(mainAgent);
                setOpen(false);
              }}
              className="flex items-start gap-3 p-3"
            >
              <Avatar className={cn('h-8 w-8 flex-shrink-0', agentColors[mainAgent.type])}>
                <AvatarImage src={mainAgent.avatar} />
                <AvatarFallback>
                  <AgentIcon type={mainAgent.type} className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{mainAgent.name}</span>
                  {selectedAgent?.id === mainAgent.id && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-1">
                  {mainAgent.description}
                </p>
              </div>
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            Specialist Agents
          </DropdownMenuLabel>

          {subAgents.map((agent) => (
            <DropdownMenuItem
              key={agent.id}
              onClick={() => {
                onAgentSelect(agent);
                setOpen(false);
              }}
              className="flex items-start gap-3 p-3"
            >
              <Avatar className={cn('h-8 w-8 flex-shrink-0', agentColors[agent.type])}>
                <AvatarImage src={agent.avatar} />
                <AvatarFallback>
                  <AgentIcon type={agent.type} className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{agent.name}</span>
                  {selectedAgent?.id === agent.id && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-1">
                  {agent.description}
                </p>
              </div>
            </DropdownMenuItem>
          ))}

          {selectedAgent && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  onAgentSelect(undefined);
                  setOpen(false);
                }}
                className="text-muted-foreground"
              >
                Remove agent assignment
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {showChatButton && selectedAgent && onChatWithAgent && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChatWithAgent(selectedAgent)}
          className="h-9 gap-2"
        >
          <MessageSquare className="h-4 w-4" />
          <span className="hidden sm:inline">Chat</span>
        </Button>
      )}
    </div>
  );
}

// Compact agent avatar for task cards
export function AgentAvatar({
  agent,
  size = 'default',
  onClick,
}: {
  agent: TaskAgent;
  size?: 'sm' | 'default';
  onClick?: () => void;
}) {
  return (
    <Avatar
      className={cn(
        'cursor-pointer transition-transform hover:scale-110',
        agentColors[agent.type],
        size === 'sm' ? 'h-6 w-6' : 'h-8 w-8'
      )}
      onClick={onClick}
    >
      <AvatarImage src={agent.avatar} />
      <AvatarFallback>
        <AgentIcon
          type={agent.type}
          className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'}
        />
      </AvatarFallback>
    </Avatar>
  );
}
