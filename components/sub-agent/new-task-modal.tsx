'use client';

import * as React from 'react';

import {
  Calendar,
  ChevronRight,
  Clock,
  Sparkles,
  Zap,
} from 'lucide-react';

import {
  AGENT_ROLE_CONFIGS,
  AgentRole,
  detectAgentRole,
  generateSubAgentName,
} from '@/lib/types/sub-agent';
import { cn } from '@/lib/utils';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface NewTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateTask: (taskData: {
    title: string;
    description?: string;
    deadlineType: 'urgent' | 'flexible' | 'none';
    priority: 'critical' | 'high' | 'medium' | 'low';
    energyRequired: 'high' | 'medium' | 'low';
    dueDate?: Date;
  }) => void;
}

type Step = 'title' | 'details' | 'preview';

export function NewTaskModal({ open, onOpenChange, onCreateTask }: NewTaskModalProps) {
  const [step, setStep] = React.useState<Step>('title');
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [deadlineType, setDeadlineType] = React.useState<'urgent' | 'flexible' | 'none'>('flexible');
  const [priority, setPriority] = React.useState<'critical' | 'high' | 'medium' | 'low'>('medium');
  const [energyRequired, setEnergyRequired] = React.useState<'high' | 'medium' | 'low'>('medium');
  const [dueDate, setDueDate] = React.useState('');

  // Detect agent role based on title
  const detectedRole = React.useMemo(() => detectAgentRole(title, description), [title, description]);
  const roleConfig = AGENT_ROLE_CONFIGS[detectedRole];
  const agentName = React.useMemo(() => 
    title ? generateSubAgentName(detectedRole, title) : roleConfig.name,
    [detectedRole, title, roleConfig.name]
  );

  // Reset on close
  React.useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setStep('title');
        setTitle('');
        setDescription('');
        setDeadlineType('flexible');
        setPriority('medium');
        setEnergyRequired('medium');
        setDueDate('');
      }, 200);
    }
  }, [open]);

  const handleCreate = () => {
    onCreateTask({
      title,
      description: description || undefined,
      deadlineType,
      priority,
      energyRequired,
      dueDate: dueDate ? new Date(dueDate) : undefined,
    });
    onOpenChange(false);
  };

  const canProceed = step === 'title' ? title.trim().length > 0 : true;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {step === 'title' && 'Create New Task'}
            {step === 'details' && 'Task Details'}
            {step === 'preview' && 'Meet Your Agent'}
          </DialogTitle>
          <DialogDescription>
            {step === 'title' && "What do you need to accomplish? I'll assign the perfect agent."}
            {step === 'details' && 'A few quick questions to help prioritize'}
            {step === 'preview' && "Here's who will help you"}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {/* Step: Title */}
          {step === 'title' && (
            <div className="space-y-4">
              <div>
                <Input
                  placeholder="e.g., Research competitors for Q2 strategy"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="text-lg"
                  autoFocus
                />
              </div>
              
              <div>
                <Textarea
                  placeholder="Add more details (optional)..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Agent Preview */}
              {title && (
                <div className="rounded-xl border bg-muted/50 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-2xl">
                      {roleConfig.icon}
                    </div>
                    <div>
                      <p className="font-medium">{agentName}</p>
                      <p className="text-sm text-muted-foreground">
                        {roleConfig.personalityTraits.join(', ')}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {roleConfig.defaultCapabilities.slice(0, 3).map((cap) => (
                      <Badge key={cap} variant="secondary" className="text-xs">
                        {cap.replace(/_/g, ' ')}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step: Details */}
          {step === 'details' && (
            <div className="space-y-6">
              {/* Deadline Type */}
              <div>
                <p className="mb-3 text-sm font-medium">How urgent is this?</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'urgent', label: 'Urgent', icon: '🔥', desc: 'ASAP' },
                    { value: 'flexible', label: 'Flexible', icon: '📅', desc: 'Some time' },
                    { value: 'none', label: 'No Rush', icon: '🌊', desc: 'Whenever' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setDeadlineType(opt.value as typeof deadlineType)}
                      className={cn(
                        'flex flex-col items-center gap-1 rounded-xl border-2 p-3 transition-all',
                        deadlineType === opt.value
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-muted-foreground/30'
                      )}
                    >
                      <span className="text-xl">{opt.icon}</span>
                      <span className="text-sm font-medium">{opt.label}</span>
                      <span className="text-xs text-muted-foreground">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Priority */}
              <div>
                <p className="mb-3 text-sm font-medium">How important?</p>
                <div className="flex gap-2">
                  {[
                    { value: 'critical', label: 'Critical', color: 'bg-red-500' },
                    { value: 'high', label: 'High', color: 'bg-orange-500' },
                    { value: 'medium', label: 'Medium', color: 'bg-blue-500' },
                    { value: 'low', label: 'Low', color: 'bg-gray-400' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setPriority(opt.value as typeof priority)}
                      className={cn(
                        'flex items-center gap-2 rounded-full border-2 px-4 py-2 transition-all',
                        priority === opt.value
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-muted-foreground/30'
                      )}
                    >
                      <div className={cn('h-2 w-2 rounded-full', opt.color)} />
                      <span className="text-sm">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Energy */}
              <div>
                <p className="mb-3 text-sm font-medium">Energy required?</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'high', label: 'Deep Focus', icon: '⚡' },
                    { value: 'medium', label: 'Moderate', icon: '🔋' },
                    { value: 'low', label: 'Light', icon: '😌' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setEnergyRequired(opt.value as typeof energyRequired)}
                      className={cn(
                        'flex items-center justify-center gap-2 rounded-xl border-2 p-3 transition-all',
                        energyRequired === opt.value
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-muted-foreground/30'
                      )}
                    >
                      <span>{opt.icon}</span>
                      <span className="text-sm font-medium">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Due Date (optional) */}
              <div>
                <p className="mb-3 text-sm font-medium">Due date (optional)</p>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>
          )}

          {/* Step: Preview */}
          {step === 'preview' && (
            <div className="space-y-6">
              <div className="flex flex-col items-center text-center">
                <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-4xl">
                  {roleConfig.icon}
                </div>
                <h3 className="text-xl font-semibold">{agentName}</h3>
                <p className="text-muted-foreground">{roleConfig.personalityTraits.join(' • ')}</p>
              </div>

              <div className="rounded-xl border bg-muted/50 p-4">
                <p className="mb-3 text-sm font-medium">Ready to help with:</p>
                <p className="mb-4 text-lg font-semibold">{title}</p>
                
                <div className="flex flex-wrap gap-2">
                  {deadlineType === 'urgent' && (
                    <Badge variant="destructive">
                      <Zap className="mr-1 h-3 w-3" />
                      Urgent
                    </Badge>
                  )}
                  <Badge variant="secondary">
                    <Sparkles className="mr-1 h-3 w-3" />
                    {priority} priority
                  </Badge>
                  {dueDate && (
                    <Badge variant="outline">
                      <Calendar className="mr-1 h-3 w-3" />
                      {new Date(dueDate).toLocaleDateString()}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="rounded-xl border p-4">
                <p className="mb-2 text-sm font-medium">Capabilities:</p>
                <div className="flex flex-wrap gap-2">
                  {roleConfig.defaultCapabilities.map((cap) => (
                    <Badge key={cap} variant="outline" className="text-xs">
                      {cap.replace(/_/g, ' ')}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between">
          {step !== 'title' ? (
            <Button
              variant="ghost"
              onClick={() => setStep(step === 'preview' ? 'details' : 'title')}
            >
              Back
            </Button>
          ) : (
            <div />
          )}
          
          {step === 'preview' ? (
            <Button onClick={handleCreate}>
              <Sparkles className="mr-2 h-4 w-4" />
              Start with {agentName}
            </Button>
          ) : (
            <Button
              onClick={() => setStep(step === 'title' ? 'details' : 'preview')}
              disabled={!canProceed}
            >
              Continue
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
