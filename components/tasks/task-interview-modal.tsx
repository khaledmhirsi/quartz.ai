'use client';

import * as React from 'react';

import {
  AlertTriangle,
  ArrowRight,
  Battery,
  BatteryFull,
  BatteryLow,
  BatteryMedium,
  Calendar,
  Clock,
  Flag,
  Sparkles,
  Target,
  X,
  Zap,
} from 'lucide-react';

import {
  DeadlineType,
  EnergyLevel,
  ImportanceLevel,
  TaskInterviewData,
} from '@/lib/types/task';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface TaskInterviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: TaskInterviewData) => void;
}

const STEPS = ['basics', 'deadline', 'importance', 'energy', 'next-step'] as const;
type Step = (typeof STEPS)[number];

const deadlineOptions: {
  value: DeadlineType;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
}[] = [
  {
    value: 'urgent',
    label: 'Urgent',
    description: 'Needs to be done ASAP',
    icon: AlertTriangle,
    color: 'border-red-500 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400',
  },
  {
    value: 'flexible',
    label: 'Flexible',
    description: 'Has a deadline, but some flexibility',
    icon: Calendar,
    color: 'border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400',
  },
  {
    value: 'none',
    label: 'No Deadline',
    description: 'Can be done whenever',
    icon: Clock,
    color: 'border-slate-400 bg-slate-50 dark:bg-slate-900/30 text-slate-600 dark:text-slate-400',
  },
];

const importanceOptions: {
  value: ImportanceLevel;
  label: string;
  description: string;
  color: string;
}[] = [
  {
    value: 'critical',
    label: 'Critical',
    description: 'Mission-critical, must succeed',
    color: 'border-red-500 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400',
  },
  {
    value: 'high',
    label: 'High',
    description: 'Important for key objectives',
    color: 'border-orange-500 bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400',
  },
  {
    value: 'medium',
    label: 'Medium',
    description: 'Standard importance',
    color: 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400',
  },
  {
    value: 'low',
    label: 'Low',
    description: 'Nice to have, not urgent',
    color: 'border-slate-400 bg-slate-50 dark:bg-slate-900/30 text-slate-600 dark:text-slate-400',
  },
];

const energyOptions: {
  value: EnergyLevel;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
}[] = [
  {
    value: 'high',
    label: 'High Energy',
    description: 'Requires deep focus and creativity',
    icon: BatteryFull,
    color: 'border-green-500 bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400',
  },
  {
    value: 'medium',
    label: 'Medium Energy',
    description: 'Moderate focus needed',
    icon: BatteryMedium,
    color: 'border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400',
  },
  {
    value: 'low',
    label: 'Low Energy',
    description: 'Can do when tired',
    icon: BatteryLow,
    color: 'border-slate-400 bg-slate-50 dark:bg-slate-900/30 text-slate-600 dark:text-slate-400',
  },
];

const quickNextSteps = [
  'Research options',
  'Draft initial version',
  'Schedule a meeting',
  'Send an email',
  'Review documents',
  'Make a decision',
  'Get approval',
  'Create outline',
];

export function TaskInterviewModal({
  open,
  onOpenChange,
  onSubmit,
}: TaskInterviewModalProps) {
  const [step, setStep] = React.useState<Step>('basics');
  const [data, setData] = React.useState<Partial<TaskInterviewData>>({});

  const stepIndex = STEPS.indexOf(step);
  const progress = ((stepIndex + 1) / STEPS.length) * 100;

  const handleNext = () => {
    const currentIndex = STEPS.indexOf(step);
    if (currentIndex < STEPS.length - 1) {
      setStep(STEPS[currentIndex + 1]);
    }
  };

  const handleBack = () => {
    const currentIndex = STEPS.indexOf(step);
    if (currentIndex > 0) {
      setStep(STEPS[currentIndex - 1]);
    }
  };

  const handleSubmit = () => {
    if (data.title && data.deadlineType && data.importanceLevel && data.energyRequired) {
      onSubmit({
        title: data.title,
        description: data.description,
        deadlineType: data.deadlineType,
        importanceLevel: data.importanceLevel,
        energyRequired: data.energyRequired,
        nextStep: data.nextStep || '',
        dueDate: data.dueDate,
        estimatedMinutes: data.estimatedMinutes,
      });
      // Reset form
      setData({});
      setStep('basics');
      onOpenChange(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 'basics':
        return !!data.title?.trim();
      case 'deadline':
        return !!data.deadlineType;
      case 'importance':
        return !!data.importanceLevel;
      case 'energy':
        return !!data.energyRequired;
      case 'next-step':
        return true;
      default:
        return false;
    }
  };

  const renderStepContent = () => {
    switch (step) {
      case 'basics':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-sm font-medium">
                What do you need to do?
              </Label>
              <Input
                id="title"
                placeholder="e.g., Review project proposal"
                value={data.title || ''}
                onChange={(e) => setData({ ...data, title: e.target.value })}
                className="text-lg"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-medium">
                Any additional details? (optional)
              </Label>
              <Textarea
                id="description"
                placeholder="Add more context..."
                value={data.description || ''}
                onChange={(e) => setData({ ...data, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dueDate" className="text-sm font-medium">
                  Due date (optional)
                </Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={data.dueDate ? new Date(data.dueDate).toISOString().split('T')[0] : ''}
                  onChange={(e) =>
                    setData({ ...data, dueDate: e.target.value ? new Date(e.target.value) : undefined })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="estimate" className="text-sm font-medium">
                  Estimated time (min)
                </Label>
                <Input
                  id="estimate"
                  type="number"
                  placeholder="30"
                  value={data.estimatedMinutes || ''}
                  onChange={(e) =>
                    setData({ ...data, estimatedMinutes: parseInt(e.target.value) || undefined })
                  }
                />
              </div>
            </div>
          </div>
        );

      case 'deadline':
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              How urgent is the deadline for this task?
            </p>
            <div className="grid gap-3">
              {deadlineOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    onClick={() => setData({ ...data, deadlineType: option.value })}
                    className={cn(
                      'flex items-center gap-4 rounded-xl border-2 p-4 text-left transition-all',
                      data.deadlineType === option.value
                        ? option.color + ' border-current'
                        : 'border-border hover:border-muted-foreground/30'
                    )}
                  >
                    <div
                      className={cn(
                        'flex h-12 w-12 items-center justify-center rounded-lg',
                        data.deadlineType === option.value
                          ? 'bg-current/10'
                          : 'bg-muted'
                      )}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="font-semibold">{option.label}</p>
                      <p className="text-sm opacity-80">{option.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );

      case 'importance':
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              How important is this task for your goals?
            </p>
            <div className="grid gap-3">
              {importanceOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setData({ ...data, importanceLevel: option.value })}
                  className={cn(
                    'flex items-center gap-4 rounded-xl border-2 p-4 text-left transition-all',
                    data.importanceLevel === option.value
                      ? option.color + ' border-current'
                      : 'border-border hover:border-muted-foreground/30'
                  )}
                >
                  <div
                    className={cn(
                      'flex h-12 w-12 items-center justify-center rounded-lg',
                      data.importanceLevel === option.value
                        ? 'bg-current/10'
                        : 'bg-muted'
                    )}
                  >
                    <Flag className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-semibold">{option.label}</p>
                    <p className="text-sm opacity-80">{option.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );

      case 'energy':
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              How much mental energy does this task require?
            </p>
            <div className="grid gap-3">
              {energyOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    onClick={() => setData({ ...data, energyRequired: option.value })}
                    className={cn(
                      'flex items-center gap-4 rounded-xl border-2 p-4 text-left transition-all',
                      data.energyRequired === option.value
                        ? option.color + ' border-current'
                        : 'border-border hover:border-muted-foreground/30'
                    )}
                  >
                    <div
                      className={cn(
                        'flex h-12 w-12 items-center justify-center rounded-lg',
                        data.energyRequired === option.value
                          ? 'bg-current/10'
                          : 'bg-muted'
                      )}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="font-semibold">{option.label}</p>
                      <p className="text-sm opacity-80">{option.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );

      case 'next-step':
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              What&apos;s the very first step to get started?
            </p>
            <Input
              placeholder="e.g., Open the document and read the first page"
              value={data.nextStep || ''}
              onChange={(e) => setData({ ...data, nextStep: e.target.value })}
              autoFocus
            />
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Quick suggestions:</p>
              <div className="flex flex-wrap gap-2">
                {quickNextSteps.map((suggestion) => (
                  <Button
                    key={suggestion}
                    variant="outline"
                    size="sm"
                    onClick={() => setData({ ...data, nextStep: suggestion })}
                    className={cn(
                      'h-7 text-xs',
                      data.nextStep === suggestion && 'bg-primary/10 border-primary'
                    )}
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const getStepTitle = () => {
    switch (step) {
      case 'basics':
        return 'Task Details';
      case 'deadline':
        return 'Deadline Type';
      case 'importance':
        return 'Importance Level';
      case 'energy':
        return 'Energy Required';
      case 'next-step':
        return 'First Step';
    }
  };

  const getStepIcon = () => {
    switch (step) {
      case 'basics':
        return Target;
      case 'deadline':
        return Calendar;
      case 'importance':
        return Flag;
      case 'energy':
        return Battery;
      case 'next-step':
        return Sparkles;
    }
  };

  const StepIcon = getStepIcon();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <StepIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>{getStepTitle()}</DialogTitle>
              <DialogDescription>
                Step {stepIndex + 1} of {STEPS.length}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Progress Bar */}
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Step Content */}
        <div className="min-h-[280px] py-4">{renderStepContent()}</div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={handleBack}
            disabled={stepIndex === 0}
          >
            Back
          </Button>
          <div className="flex items-center gap-2">
            {step === 'next-step' ? (
              <Button onClick={handleSubmit} disabled={!canProceed()}>
                <Sparkles className="mr-2 h-4 w-4" />
                Create Task
              </Button>
            ) : (
              <Button onClick={handleNext} disabled={!canProceed()}>
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
