'use client';

import * as React from 'react';

import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Coffee,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Settings,
  Sparkles,
  Target,
  Timer,
  Trophy,
  Zap,
} from 'lucide-react';

import { EnergyLevel, Task } from '@/lib/types/task';
import { cn } from '@/lib/utils';
import { filterTasksForGoldenTime, formatDuration } from '@/lib/utils/task-utils';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';

interface GoldenTimeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: Task[];
  onStartTask: (task: Task) => void;
  onCompleteStep: (taskId: string, stepId: string) => void;
}

type ModalStep = 'select-time' | 'task-bundle' | 'working' | 'break' | 'completed';

interface TaskBundle {
  tasks: Task[];
  totalTime: number;
  canComplete: string;
}

interface PomodoroSettings {
  workDuration: number; // minutes
  breakDuration: number; // minutes
}

interface SessionExpectation {
  tasksToComplete: number;
  stepsToComplete: number;
  description: string;
}

interface SessionResult {
  tasksCompleted: number;
  stepsCompleted: number;
  timeWorked: number;
  pomodorosCompleted: number;
}

const timePresets = [10, 15, 20, 30, 45, 60, 90, 120];

const energyOptions: { value: EnergyLevel; label: string; icon: string }[] = [
  { value: 'high', label: 'Energized', icon: '⚡' },
  { value: 'medium', label: 'Normal', icon: '🔋' },
  { value: 'low', label: 'Low Energy', icon: '😴' },
];

const defaultPomodoroSettings: PomodoroSettings = {
  workDuration: 25,
  breakDuration: 5,
};

export function GoldenTimeModal({
  open,
  onOpenChange,
  tasks,
  onStartTask,
  onCompleteStep,
}: GoldenTimeModalProps) {
  const [modalStep, setModalStep] = React.useState<ModalStep>('select-time');
  const [availableMinutes, setAvailableMinutes] = React.useState(30);
  const [energyLevel, setEnergyLevel] = React.useState<EnergyLevel>('medium');
  const [taskBundle, setTaskBundle] = React.useState<TaskBundle | null>(null);
  const [currentTaskIndex, setCurrentTaskIndex] = React.useState(0);
  const [isRunning, setIsRunning] = React.useState(false);
  const [elapsedSeconds, setElapsedSeconds] = React.useState(0);
  const [pomodoroSettings, setPomodoroSettings] = React.useState<PomodoroSettings>(defaultPomodoroSettings);
  const [showSettings, setShowSettings] = React.useState(false);
  const [pomodorosCompleted, setPomodorosCompleted] = React.useState(0);
  const [isInBreak, setIsInBreak] = React.useState(false);
  const [breakSecondsLeft, setBreakSecondsLeft] = React.useState(0);
  const [sessionExpectation, setSessionExpectation] = React.useState<SessionExpectation | null>(null);
  const [sessionResult, setSessionResult] = React.useState<SessionResult>({
    tasksCompleted: 0,
    stepsCompleted: 0,
    timeWorked: 0,
    pomodorosCompleted: 0,
  });
  const [completedStepIds, setCompletedStepIds] = React.useState<Set<string>>(new Set());

  const timerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Reset state when modal closes
  React.useEffect(() => {
    if (!open) {
      setModalStep('select-time');
      setTaskBundle(null);
      setCurrentTaskIndex(0);
      setIsRunning(false);
      setElapsedSeconds(0);
      setPomodorosCompleted(0);
      setIsInBreak(false);
      setBreakSecondsLeft(0);
      setSessionExpectation(null);
      setSessionResult({ tasksCompleted: 0, stepsCompleted: 0, timeWorked: 0, pomodorosCompleted: 0 });
      setCompletedStepIds(new Set());
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  }, [open]);

  // Work timer logic
  React.useEffect(() => {
    if (isRunning && !isInBreak) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => {
          const newValue = prev + 1;
          // Check if pomodoro is complete
          if (newValue >= pomodoroSettings.workDuration * 60) {
            setIsRunning(false);
            setPomodorosCompleted((p) => p + 1);
            // Trigger break
            setIsInBreak(true);
            setBreakSecondsLeft(pomodoroSettings.breakDuration * 60);
          }
          return newValue;
        });
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRunning, isInBreak, pomodoroSettings.workDuration, pomodoroSettings.breakDuration]);

  // Break timer logic
  React.useEffect(() => {
    if (isInBreak && breakSecondsLeft > 0) {
      const breakTimer = setInterval(() => {
        setBreakSecondsLeft((prev) => {
          if (prev <= 1) {
            setIsInBreak(false);
            setModalStep('working');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(breakTimer);
    }
  }, [isInBreak, breakSecondsLeft]);

  // Create task bundle for Golden Time
  const createTaskBundle = (): TaskBundle => {
    const eligibleTasks = filterTasksForGoldenTime(tasks, availableMinutes * 2, energyLevel);
    
    let bundledTasks: Task[] = [];
    let totalTime = 0;
    
    // Greedy algorithm to fill available time
    for (const task of eligibleTasks) {
      const taskTime = task.estimatedMinutes || 20;
      if (totalTime + taskTime <= availableMinutes) {
        bundledTasks.push(task);
        totalTime += taskTime;
      }
      // Stop if we have enough tasks or reached time limit
      if (bundledTasks.length >= 5 || totalTime >= availableMinutes * 0.9) {
        break;
      }
    }

    // If no tasks fit, just take the highest priority one
    if (bundledTasks.length === 0 && eligibleTasks.length > 0) {
      bundledTasks = [eligibleTasks[0]];
      totalTime = eligibleTasks[0].estimatedMinutes || 20;
    }

    // Generate expectation description
    const totalSteps = bundledTasks.reduce((sum, t) => sum + (t.subSteps?.filter(s => !s.completed).length || 0), 0);
    let description = '';
    if (bundledTasks.length === 1) {
      const task = bundledTasks[0];
      const incompleteSteps = task.subSteps?.filter(s => !s.completed).length || 0;
      if (incompleteSteps > 0) {
        description = `You can likely complete ${Math.min(incompleteSteps, Math.ceil(availableMinutes / 10))} subtask(s) of "${task.title}"`;
      } else {
        description = `You can make significant progress on "${task.title}"`;
      }
    } else {
      description = `You can complete ${bundledTasks.length} task(s) and ${Math.min(totalSteps, 5)} subtask(s)`;
    }

    return {
      tasks: bundledTasks,
      totalTime,
      canComplete: description,
    };
  };

  const handleFindTasks = () => {
    const bundle = createTaskBundle();
    setTaskBundle(bundle);
    
    // Set expectations
    const totalSteps = bundle.tasks.reduce((sum, t) => sum + (t.subSteps?.filter(s => !s.completed).length || 0), 0);
    setSessionExpectation({
      tasksToComplete: bundle.tasks.length,
      stepsToComplete: Math.min(totalSteps, Math.ceil(availableMinutes / 8)),
      description: bundle.canComplete,
    });
    
    setModalStep('task-bundle');
  };

  const handleStartWorking = () => {
    if (taskBundle && taskBundle.tasks.length > 0) {
      onStartTask(taskBundle.tasks[0]);
      setModalStep('working');
      setIsRunning(true);
      setElapsedSeconds(0);
    }
  };

  const handleToggleTimer = () => {
    setIsRunning(!isRunning);
  };

  const handleStepComplete = (taskId: string, stepId: string) => {
    if (!completedStepIds.has(stepId)) {
      onCompleteStep(taskId, stepId);
      setCompletedStepIds((prev) => new Set([...prev, stepId]));
      setSessionResult((prev) => ({
        ...prev,
        stepsCompleted: prev.stepsCompleted + 1,
      }));
    }
  };

  const handleTaskComplete = () => {
    setSessionResult((prev) => ({
      ...prev,
      tasksCompleted: prev.tasksCompleted + 1,
    }));

    // Move to next task or complete session
    if (taskBundle && currentTaskIndex < taskBundle.tasks.length - 1) {
      setCurrentTaskIndex((prev) => prev + 1);
      onStartTask(taskBundle.tasks[currentTaskIndex + 1]);
    } else {
      handleCompleteSession();
    }
  };

  const handleCompleteSession = () => {
    setIsRunning(false);
    setSessionResult((prev) => ({
      ...prev,
      timeWorked: Math.floor(elapsedSeconds / 60),
      pomodorosCompleted,
    }));
    setModalStep('completed');
  };

  const handleSkipBreak = () => {
    setIsInBreak(false);
    setBreakSecondsLeft(0);
    setElapsedSeconds(0);
    setIsRunning(true);
    setModalStep('working');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const currentTask = taskBundle?.tasks[currentTaskIndex];
  const pomodoroProgress = (elapsedSeconds / (pomodoroSettings.workDuration * 60)) * 100;

  // Render time selection step
  const renderSelectTime = () => (
    <div className="space-y-6">
      {/* Settings Toggle */}
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => setShowSettings(!showSettings)}>
          <Settings className="mr-2 h-4 w-4" />
          Pomodoro Settings
        </Button>
      </div>

      {/* Pomodoro Settings */}
      {showSettings && (
        <div className="rounded-lg border bg-muted/50 p-4 space-y-4">
          <h4 className="font-medium text-sm">Pomodoro Settings</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground">Work Duration</label>
              <div className="flex items-center gap-2 mt-1">
                <Slider
                  value={[pomodoroSettings.workDuration]}
                  onValueChange={([v]) => setPomodoroSettings(p => ({ ...p, workDuration: v }))}
                  min={15}
                  max={60}
                  step={5}
                  className="flex-1"
                />
                <span className="text-sm font-medium w-12">{pomodoroSettings.workDuration}m</span>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Break Duration</label>
              <div className="flex items-center gap-2 mt-1">
                <Slider
                  value={[pomodoroSettings.breakDuration]}
                  onValueChange={([v]) => setPomodoroSettings(p => ({ ...p, breakDuration: v }))}
                  min={3}
                  max={15}
                  step={1}
                  className="flex-1"
                />
                <span className="text-sm font-medium w-12">{pomodoroSettings.breakDuration}m</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Time Selection */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">How much time do you have?</p>
          <span className="text-2xl font-bold text-primary">
            {formatDuration(availableMinutes)}
          </span>
        </div>
        <Slider
          value={[availableMinutes]}
          onValueChange={([value]) => setAvailableMinutes(value)}
          min={10}
          max={180}
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
              {formatDuration(preset)}
            </Button>
          ))}
        </div>
      </div>

      {/* Energy Level */}
      <div className="space-y-3">
        <p className="text-sm font-medium">How are you feeling?</p>
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

      <Button onClick={handleFindTasks} className="w-full" size="lg">
        <Sparkles className="mr-2 h-5 w-5" />
        Find My Tasks
      </Button>
    </div>
  );

  // Render task bundle (grouped tasks)
  const renderTaskBundle = () => (
    <div className="space-y-6">
      {/* Expectation Card */}
      {sessionExpectation && (
        <div className="rounded-xl border bg-gradient-to-br from-primary/5 to-primary/10 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-5 w-5 text-primary" />
            <span className="font-medium">Session Expectation</span>
          </div>
          <p className="text-sm text-muted-foreground">{sessionExpectation.description}</p>
          <div className="flex gap-4 mt-3 text-xs">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              {sessionExpectation.tasksToComplete} task(s)
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {taskBundle?.totalTime || 0}m estimated
            </span>
          </div>
        </div>
      )}

      {/* Task Bundle List */}
      <div className="space-y-3">
        <p className="text-sm font-medium">Tasks for this session:</p>
        {taskBundle?.tasks.map((task, idx) => (
          <div
            key={task.id}
            className={cn(
              'rounded-lg border p-4 transition-all',
              idx === 0 ? 'border-primary bg-primary/5' : ''
            )}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold',
                  idx === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted'
                )}>
                  {idx + 1}
                </div>
                <div>
                  <p className="font-medium">{task.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {task.estimatedMinutes ? formatDuration(task.estimatedMinutes) : '~20m'} • {task.subSteps?.filter(s => !s.completed).length || 0} steps left
                  </p>
                </div>
              </div>
              {idx === 0 && (
                <Badge className="bg-primary/10 text-primary">Start Here</Badge>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Pomodoro Info */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Timer className="h-4 w-4" />
        <span>
          Using {pomodoroSettings.workDuration}m work / {pomodoroSettings.breakDuration}m break cycles
        </span>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={() => setModalStep('select-time')} className="flex-1">
          <RotateCcw className="mr-2 h-4 w-4" />
          Adjust
        </Button>
        <Button onClick={handleStartWorking} className="flex-1" size="lg">
          <Play className="mr-2 h-4 w-4" />
          Start Session
        </Button>
      </div>
    </div>
  );

  // Render working step with Pomodoro
  const renderWorking = () => (
    <div className="space-y-6">
      {/* Pomodoro Timer */}
      <div className="flex flex-col items-center py-4">
        <div className="relative mb-4">
          <div className="flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-primary/10 to-primary/20">
            <div className="text-center">
              <span className="text-3xl font-bold tabular-nums">
                {formatTime(elapsedSeconds)}
              </span>
              <p className="text-xs text-muted-foreground mt-1">
                of {pomodoroSettings.workDuration}:00
              </p>
            </div>
          </div>
          {isRunning && (
            <div className="absolute inset-0 animate-pulse rounded-full border-2 border-primary/30" />
          )}
        </div>

        {/* Progress bar */}
        <div className="w-full max-w-xs mb-4">
          <Progress value={pomodoroProgress} className="h-2" />
        </div>

        {/* Pomodoro count */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <Coffee className="h-4 w-4" />
          <span>{pomodorosCompleted} pomodoro(s) completed</span>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={handleToggleTimer}
            className="h-12 w-12 rounded-full"
          >
            {isRunning ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Current Task */}
      {currentTask && (
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">{currentTask.title}</h3>
            <Badge variant="secondary">
              Task {currentTaskIndex + 1}/{taskBundle?.tasks.length}
            </Badge>
          </div>

          {/* Substeps Checklist */}
          {currentTask.subSteps && currentTask.subSteps.length > 0 && (
            <div className="space-y-2">
              {currentTask.subSteps.map((step) => {
                const isCompleted = step.completed || completedStepIds.has(step.id);
                return (
                  <button
                    key={step.id}
                    onClick={() => handleStepComplete(currentTask.id, step.id)}
                    disabled={isCompleted}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors',
                      isCompleted ? 'opacity-60' : 'hover:bg-muted/50'
                    )}
                  >
                    <CheckCircle2
                      className={cn(
                        'h-5 w-5 flex-shrink-0',
                        isCompleted ? 'text-green-500' : 'text-muted-foreground/50'
                      )}
                    />
                    <span className={cn('text-sm', isCompleted && 'line-through text-muted-foreground')}>
                      {step.title}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Next Task Preview */}
          {taskBundle && currentTaskIndex < taskBundle.tasks.length - 1 && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-xs text-muted-foreground mb-2">Up next:</p>
              <p className="text-sm font-medium">{taskBundle.tasks[currentTaskIndex + 1].title}</p>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <Button variant="outline" onClick={handleTaskComplete} className="flex-1">
          <ArrowRight className="mr-2 h-4 w-4" />
          {taskBundle && currentTaskIndex < taskBundle.tasks.length - 1 ? 'Next Task' : 'Finish'}
        </Button>
        <Button onClick={handleCompleteSession} className="flex-1">
          <CheckCircle2 className="mr-2 h-5 w-5" />
          Complete Session
        </Button>
      </div>
    </div>
  );

  // Render break step
  const renderBreak = () => (
    <div className="space-y-6 text-center">
      <div className="flex flex-col items-center py-6">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
          <Coffee className="h-10 w-10 text-blue-600 dark:text-blue-400" />
        </div>
        <h3 className="text-xl font-semibold">Break Time!</h3>
        <p className="text-muted-foreground">Take a moment to rest</p>
        <div className="mt-4 text-3xl font-bold tabular-nums">
          {formatTime(breakSecondsLeft)}
        </div>
      </div>

      {/* Agent suggestion during break */}
      <div className="rounded-lg bg-muted/50 p-4 text-left">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Quick Recap</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Great progress! You&apos;ve completed {sessionResult.stepsCompleted} step(s) so far.
          {taskBundle && currentTaskIndex < taskBundle.tasks.length - 1 && (
            <> After the break, you&apos;ll continue with &quot;{taskBundle.tasks[currentTaskIndex + 1]?.title}&quot;.</>
          )}
        </p>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={handleSkipBreak} className="flex-1">
          Skip Break
        </Button>
        <Button onClick={handleCompleteSession} className="flex-1">
          End Session
        </Button>
      </div>
    </div>
  );

  // Render completed step with results comparison
  const renderCompleted = () => (
    <div className="space-y-6 text-center">
      <div className="flex flex-col items-center py-6">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <Trophy className="h-10 w-10 text-green-600 dark:text-green-400" />
        </div>
        <h3 className="text-xl font-semibold">Great Work!</h3>
        <p className="text-muted-foreground">
          Session completed in {sessionResult.timeWorked || Math.floor(elapsedSeconds / 60)} minutes
        </p>
      </div>

      {/* Expectation vs Reality */}
      {sessionExpectation && (
        <div className="rounded-xl border bg-card p-4 text-left">
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <Target className="h-4 w-4" />
            Results vs Expectations
          </h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Tasks worked on</span>
              <div className="flex items-center gap-2">
                <span className="font-medium">{sessionResult.tasksCompleted}</span>
                <span className="text-muted-foreground">/</span>
                <span className="text-muted-foreground">{sessionExpectation.tasksToComplete} expected</span>
                {sessionResult.tasksCompleted >= sessionExpectation.tasksToComplete && (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                )}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Steps completed</span>
              <div className="flex items-center gap-2">
                <span className="font-medium">{sessionResult.stepsCompleted}</span>
                <span className="text-muted-foreground">/</span>
                <span className="text-muted-foreground">{sessionExpectation.stepsToComplete} expected</span>
                {sessionResult.stepsCompleted >= sessionExpectation.stepsToComplete && (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                )}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Pomodoros</span>
              <span className="font-medium">{pomodorosCompleted}</span>
            </div>
          </div>
        </div>
      )}

      {/* Reflection prompt */}
      <div className="rounded-lg bg-primary/5 p-4 text-left">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Quick Reflection</span>
        </div>
        <p className="text-sm text-muted-foreground">
          {sessionResult.stepsCompleted >= (sessionExpectation?.stepsToComplete || 0)
            ? "Amazing! You exceeded your expectations. Keep up the great momentum!"
            : sessionResult.stepsCompleted > 0
            ? "Good progress! Every step counts. Consider what might help you go faster next time."
            : "That's okay! Sometimes sessions don't go as planned. What blocked your progress?"}
        </p>
      </div>

      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={() => {
            setModalStep('select-time');
            setElapsedSeconds(0);
            setPomodorosCompleted(0);
            setSessionResult({ tasksCompleted: 0, stepsCompleted: 0, timeWorked: 0, pomodorosCompleted: 0 });
            setCompletedStepIds(new Set());
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
      case 'select-time': return 'Golden Time';
      case 'task-bundle': return 'Your Task Bundle';
      case 'working': return 'Focus Mode';
      case 'break': return 'Break Time';
      case 'completed': return 'Session Complete';
    }
  };

  const getDescription = () => {
    switch (modalStep) {
      case 'select-time': return 'Make the most of your available time';
      case 'task-bundle': return 'Here\'s what you can accomplish';
      case 'working': return 'Stay focused and make progress';
      case 'break': return 'Rest and recharge';
      case 'completed': return 'Your progress has been saved';
    }
  };

  // Handle break modal display
  React.useEffect(() => {
    if (isInBreak && modalStep === 'working') {
      setModalStep('break');
    }
  }, [isInBreak, modalStep]);

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
          {modalStep === 'task-bundle' && renderTaskBundle()}
          {modalStep === 'working' && renderWorking()}
          {modalStep === 'break' && renderBreak()}
          {modalStep === 'completed' && renderCompleted()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
