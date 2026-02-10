'use client';

import * as React from 'react';

import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock,
  User,
} from 'lucide-react';

import { STATUS_CONFIG, TaskStatus } from '@/lib/types/task';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface StatusDropdownProps {
  status: TaskStatus;
  onStatusChange: (status: TaskStatus) => void;
  size?: 'sm' | 'default';
}

const StatusIcon: React.FC<{ status: TaskStatus; className?: string }> = ({
  status,
  className,
}) => {
  const icons: Record<TaskStatus, React.ElementType> = {
    planned: Circle,
    in_progress: Clock,
    blocked: AlertCircle,
    waiting_customer: User,
    done: CheckCircle2,
  };
  const Icon = icons[status];
  return <Icon className={cn('h-4 w-4', className)} />;
};

const statuses: TaskStatus[] = [
  'planned',
  'in_progress',
  'blocked',
  'waiting_customer',
  'done',
];

export function StatusDropdown({
  status,
  onStatusChange,
  size = 'default',
}: StatusDropdownProps) {
  const config = STATUS_CONFIG[status];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size={size}
          className={cn(
            'justify-between gap-2',
            config.bgColor,
            config.color,
            'border-transparent hover:border-border',
            size === 'sm' ? 'h-7 px-2 text-xs' : 'h-9 px-3'
          )}
        >
          <div className="flex items-center gap-2">
            <StatusIcon status={status} className="h-3.5 w-3.5" />
            <span>{config.label}</span>
          </div>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {statuses.map((s) => {
          const sConfig = STATUS_CONFIG[s];
          return (
            <DropdownMenuItem
              key={s}
              onClick={() => onStatusChange(s)}
              className={cn(
                'flex items-center gap-2',
                status === s && 'bg-accent'
              )}
            >
              <StatusIcon status={s} className={cn('h-4 w-4', sConfig.color)} />
              <span className={sConfig.color}>{sConfig.label}</span>
              {status === s && (
                <CheckCircle2 className="ml-auto h-4 w-4 text-primary" />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
