'use client';

import * as React from 'react';

import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Timer,
  Zap,
} from 'lucide-react';

import { EnergyLevel, Task } from '@/lib/types/task';
import { cn } from '@/lib/utils';
import { formatDuration, getBestTaskForGoldenTime } from '@/lib/utils/task-utils';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';

interface GoldenTimeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: Task[];
  onStartTask: (task: Task) => void;
  onCompleteStep: (taskId: string, stepId: string) => void;
}

type ModalStep = 'select-time' | 'task-suggestion' | 'working' | 'completed';

const timePresets = [10, 15, 20, 30, 45, 60];

const energyOptions: { value: EnergyLevel; label: string; icon: string }[] = [
  { value: 'high', label: 'Energized', icon: '⚡' },
  { value: 'medium', label: 'Normal', icon: '🔋' },
  { value: 'low', label: 'Low Energy', icon: '😴' },
];

export function GoldenTimeModal({
  open,
  onOpenChange,
  tasks,
  onStartTask,
  onCompleteStep,
}: GoldenTimeModalProps) {
  const [modalStep, setModalStep] = React.useState<ModalStep>('select-time');
  const [availableMinutes, setAvailableMinutes] = React.useState(20);
  const [energyLevel, setEnergyLevel] = React.useState<EnergyLevel>('medium');
  const [selectedTask, setSelectedTask] = React.useState<Task | null>(null);
  const [isRunning, setIsRunning] = React.useState(false);
  const [elapsedSeconds, setElapsedSeconds] = React.useState(0);
  const [aiSuggestion, setAiSuggestion] = React.useState<string>('');
  const [isLoadingSuggestion, setIsLoadingSuggestion] = React.useState(false);

  const timerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Reset state when modal closes
  React.useEffect(() => {
    if (!open) {
      setModalStep('select-time');
      setSelectedTask(null);
      setIsRunning(false);
      setElapsedSeconds(0);
      setAiSuggestion('');
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  }, [open]);

  // Timer logic
  React.useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRunning]);

  const handleFindTask = () => {
    const bestTask = getBestTaskForGoldenTime(tasks, availableMinutes, energyLevel);
    if (bestTask) {
      setSelectedTask(bestTask);
      setModalStep('task-suggestion');
      // Simulate AI suggestion
      setIsLoadingSuggestion(true);
      setTimeout(() => {
        setAiSuggestion(
          bestTask.nextStep ||
            `Start by reviewing ${bestTask.title.toLowerCase()} and identify the key action items.`
        );
        setIsLoadingSuggestion(false);
      }, 1000);
    }
  };

  const handleStartWorking = () => {
    if (selectedTask) {
      onStartTask(selectedTask);
      setModalStep('working');
      setIsRunning(true);
    }
  };

  const handleToggleTimer = () => {
    setIsRunning(!isRunning);
  };

  const handleCompleteTask = () => {
    setIsRunning(false);
    setModalStep('completed');
  };

  const handleStepComplete = (stepId: string) => {
    if (selectedTask) {
      onCompleteStep(selectedTask.id, stepId);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const renderSelectTime = () => (
    <div className="space-y-6">
      {/* Time Selection */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">How much time do you have?</Label>
          <span className="text-2xl font-bold text-primary">
            {formatDuration(availableMinutes)}
          </span>
        </div>
        <Slider
          value={[availableMinutes]}
          onValueChange={([value]) => setAvailableMinutes(value)}
          min={5}
          max={120}
          step={5}
          className="py-2"
        />
        <div className="flex flex-wrap gap-2">
          {timePresets.map((preset) => (
            <Button
              key={preset}
              variant={availableMinutes === preset ? 'default' : 'outline'}
              size="sm"
              onClick={() => setAvailableMinutes(preset)}
              className="h-8"
            >
              {preset}m
            </Button>
          ))}
        </div>
      </div>

      {/* Energy Level */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">How are you feeling?</Label>
        <div className="grid grid-cols-3 gap-2">
          {energyOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setEnergyLevel(option.value)}
              className={cn(
                'flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all',
                energyLevel === option.value
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground/30'
              )}
            >
              <span className="text-2xl">{option.icon}</span>
              <span className="text-sm font-medium">{option.label}</span>
            </button>
          ))}
        </div>
      </div>

      <Button onClick={handleFindTask} className="w-full" size="lg">
        <Sparkles className="mr-2 h-5 w-5" />
        Find My Task
      </Button>
    </div>
  );

  const renderTaskSuggestion = () => (
    <div className="space-y-6">
      {/* Task Card */}
      {selectedTask && (
        <div className="rounded-xl border bg-card p-5">
          <div className="mb-3 flex items-start justify-between">
            <div>
              <Badge variant="secondary" className="mb-2 bg-primary/10 text-primary">
                Best Match
              </Badge>
              <h3 className="text-lg font-semibold">{selectedTask.title}</h3>
            </div>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              {selectedTask.estimatedMinutes
                ? formatDuration(selectedTask.estimatedMinutes)
                : '~20m'}
            </div>
          </div>

          {selectedTask.description && (
            <p className="mb-4 text-sm text-muted-foreground">
              {selectedTask.description}
            </p>
          )}

          {/* AI Suggestion */}
          <div className="rounded-lg bg-gradient-to-br from-primary/5 to-primary/10 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">AI Suggestion</span>
            </div>
            {isLoadingSuggestion ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing task...
              </div>
            ) : (
              <p className="text-sm">{aiSuggestion}</p>
            )}
          </div>

          {/* Substeps Preview */}
          {selectedTask.subSteps.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-sm font-medium">Steps to complete:</p>
              {selectedTask.subSteps.slice(0, 3).map((step) => (
                <div
                  key={step.id}
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                >
                  <CheckCircle2
                    className={cn(
                      'h-4 w-4',
                      step.completed ? 'text-green-500' : 'text-muted-foreground/50'
                    )}
                  />
                  <span className={step.completed ? 'line-through' : ''}>
                    {step.title}
                  </span>
                </div>
              ))}
              {selectedTask.subSteps.length > 3 && (
                <p className="text-xs text-muted-foreground">
                  +{selectedTask.subSteps.length - 3} more steps
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={() => setModalStep('select-time')}
          className="flex-1"
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Find Another
        </Button>
        <Button onClick={handleStartWorking} className="flex-1" size="lg">
          <Play className="mr-2 h-4 w-4" />
          Start Now
        </Button>
      </div>
    </div>
  );

  const renderWorking = () => (
    <div className="space-y-6">
      {/* Timer Display */}
      <div className="flex flex-col items-center py-6">
        <div className="relative mb-4">
          <div className="flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-primary/10 to-primary/20">
            <span className="text-4xl font-bold tabular-nums">
              {formatTime(elapsedSeconds)}
            </span>
          </div>
          {isRunning && (
            <div className="absolute inset-0 animate-pulse rounded-full border-2 border-primary/30" />
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={handleToggleTimer}
            className="h-12 w-12 rounded-full"
          >
            {isRunning ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>

      {/* Current Task */}
      {selectedTask && (
        <div className="rounded-xl border bg-card p-4">
          <h3 className="mb-3 font-semibold">{selectedTask.title}</h3>

          {/* Substeps Checklist */}
          {selectedTask.subSteps.length > 0 && (
            <div className="space-y-2">
              {selectedTask.subSteps.map((step) => (
                <button
                  key={step.id}
                  onClick={() => handleStepComplete(step.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-muted/50',
                    step.completed && 'opacity-60'
                  )}
                >
                  <CheckCircle2
                    className={cn(
                      'h-5 w-5 flex-shrink-0',
                      step.completed ? 'text-green-500' : 'text-muted-foreground/50'
                    )}
                  />
                  <span
                    className={cn(
                      'text-sm',
                      step.completed && 'line-through text-muted-foreground'
                    )}
                  >
                    {step.title}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* AI Tip */}
          {aiSuggestion && (
            <div className="mt-4 rounded-lg bg-primary/5 p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Sparkles className="h-3 w-3" />
                <span>{aiSuggestion}</span>
              </div>
            </div>
          )}
        </div>
      )}

      <Button onClick={handleCompleteTask} className="w-full" size="lg">
        <CheckCircle2 className="mr-2 h-5 w-5" />
        Complete Session
      </Button>
    </div>
  );

  const renderCompleted = () => (
    <div className="space-y-6 text-center">
      <div className="flex flex-col items-center py-6">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
        </div>
        <h3 className="text-xl font-semibold">Great Work!</h3>
        <p className="text-muted-foreground">
          You worked for {formatTime(elapsedSeconds)}
        </p>
      </div>

      {selectedTask && (
        <div className="rounded-xl border bg-card p-4 text-left">
          <div className="flex items-center justify-between">
            <span className="font-medium">{selectedTask.title}</span>
            <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
              Progress Saved
            </Badge>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={() => {
            setModalStep('select-time');
            setElapsedSeconds(0);
          }}
          className="flex-1"
        >
          <Timer className="mr-2 h-4 w-4" />
          Another Session
        </Button>
        <Button onClick={() => onOpenChange(false)} className="flex-1">
          Done
        </Button>
      </div>
    </div>
  );

  const getTitle = () => {
    switch (modalStep) {
      case 'select-time':
        return 'Golden Time';
      case 'task-suggestion':
        return 'Your Task';
      case 'working':
        return 'Focus Mode';
      case 'completed':
        return 'Session Complete';
    }
  };

  const getDescription = () => {
    switch (modalStep) {
      case 'select-time':
        return 'Make the most of your available time';
      case 'task-suggestion':
        return "Here's what we recommend based on your time and energy";
      case 'working':
        return "Stay focused and make progress";
      case 'completed':
        return 'Your progress has been saved';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle>{getTitle()}</DialogTitle>
              <DialogDescription>{getDescription()}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-4">
          {modalStep === 'select-time' && renderSelectTime()}
          {modalStep === 'task-suggestion' && renderTaskSuggestion()}
          {modalStep === 'working' && renderWorking()}
          {modalStep === 'completed' && renderCompleted()}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Helper Label component
function Label({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <p className={className}>{children}</p>;
}
