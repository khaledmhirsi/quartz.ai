// Task utility functions for smart sorting and prioritization

import {
  DeadlineType,
  EnergyLevel,
  ImportanceLevel,
  Task,
  TaskInterviewData,
} from '../types/task';

/**
 * Calculate priority score based on task interview data
 * Higher score = higher priority
 */
export function calculatePriorityScore(task: Partial<Task>): number {
  let score = 0;

  // Deadline Type Score (0-40)
  const deadlineScores: Record<DeadlineType, number> = {
    urgent: 40,
    flexible: 20,
    none: 5,
  };
  score += deadlineScores[task.deadlineType || 'none'];

  // Importance Level Score (0-35)
  const importanceScores: Record<ImportanceLevel, number> = {
    critical: 35,
    high: 25,
    medium: 15,
    low: 5,
  };
  score += importanceScores[task.importanceLevel || 'medium'];

  // Due Date Proximity Score (0-25)
  if (task.dueDate) {
    const now = new Date();
    const dueDate = new Date(task.dueDate);
    const daysUntilDue = Math.ceil(
      (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilDue < 0) {
      score += 25; // Overdue
    } else if (daysUntilDue === 0) {
      score += 23; // Due today
    } else if (daysUntilDue === 1) {
      score += 20; // Due tomorrow
    } else if (daysUntilDue <= 3) {
      score += 15; // Due within 3 days
    } else if (daysUntilDue <= 7) {
      score += 10; // Due within a week
    } else {
      score += 5; // Due later
    }
  }

  return Math.min(score, 100);
}

/**
 * Sort tasks by priority score (descending)
 */
export function sortTasksByPriority(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => b.priorityScore - a.priorityScore);
}

/**
 * Filter tasks suitable for Golden Time session
 */
export function filterTasksForGoldenTime(
  tasks: Task[],
  availableMinutes: number,
  currentEnergyLevel: EnergyLevel
): Task[] {
  const energyMatch: Record<EnergyLevel, EnergyLevel[]> = {
    high: ['high', 'medium', 'low'],
    medium: ['medium', 'low'],
    low: ['low'],
  };

  return tasks
    .filter((task) => {
      // Must not be completed
      if (task.status === 'done') return false;

      // Must fit within available time
      if (task.estimatedMinutes && task.estimatedMinutes > availableMinutes) {
        return false;
      }

      // Must match energy level
      if (
        task.energyRequired &&
        !energyMatch[currentEnergyLevel].includes(task.energyRequired)
      ) {
        return false;
      }

      return true;
    })
    .sort((a, b) => b.priorityScore - a.priorityScore);
}

/**
 * Get the best task suggestion for Golden Time
 */
export function getBestTaskForGoldenTime(
  tasks: Task[],
  availableMinutes: number,
  currentEnergyLevel: EnergyLevel = 'medium'
): Task | null {
  const eligibleTasks = filterTasksForGoldenTime(
    tasks,
    availableMinutes,
    currentEnergyLevel
  );
  return eligibleTasks.length > 0 ? eligibleTasks[0] : null;
}

/**
 * Create a new task from interview data
 */
export function createTaskFromInterview(
  data: TaskInterviewData,
  columnId: string = 'todo'
): Omit<Task, 'id'> {
  const now = new Date();

  const partialTask: Partial<Task> = {
    deadlineType: data.deadlineType,
    importanceLevel: data.importanceLevel,
    dueDate: data.dueDate,
  };

  return {
    title: data.title,
    description: data.description,
    deadlineType: data.deadlineType,
    importanceLevel: data.importanceLevel,
    energyRequired: data.energyRequired,
    nextStep: data.nextStep,
    status: 'planned',
    category: 'internal',
    dueDate: data.dueDate,
    createdAt: now,
    updatedAt: now,
    estimatedMinutes: data.estimatedMinutes,
    priorityScore: calculatePriorityScore(partialTask),
    subSteps: [],
    commentsCount: 0,
    tags: [],
    columnId,
    position: 0,
  };
}

/**
 * Format time duration
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/**
 * Get relative time string
 */
export function getRelativeTimeString(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const absDays = Math.abs(diffDays);
    if (absDays === 1) return 'Yesterday';
    if (absDays < 7) return `${absDays} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays < 7) return `In ${diffDays} days`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Generate sample tasks for demo
 */
export function generateSampleTasks(): Task[] {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  return [
    {
      id: '1',
      title: 'Approve SMB documents',
      description:
        'We need to approve the SMB documents before we even get started on this project.',
      deadlineType: 'urgent',
      importanceLevel: 'critical',
      energyRequired: 'medium',
      nextStep: 'Review the contract terms',
      status: 'done',
      category: 'internal',
      dueDate: tomorrow,
      createdAt: now,
      updatedAt: now,
      estimatedMinutes: 30,
      priorityScore: 85,
      subSteps: [
        { id: '1-1', title: 'Review contract terms', completed: true },
        { id: '1-2', title: 'Check compliance', completed: true },
        { id: '1-3', title: 'Get approval signature', completed: true },
      ],
      commentsCount: 0,
      tags: ['contract', 'legal'],
      columnId: 'done',
      position: 0,
    },
    {
      id: '2',
      title: 'Check on email open rate and follow-up with their CEO',
      description: 'Review email campaign metrics and schedule follow-up call.',
      deadlineType: 'urgent',
      importanceLevel: 'high',
      energyRequired: 'low',
      nextStep: 'Check analytics dashboard',
      status: 'in_progress',
      category: 'needs_action',
      dueDate: now,
      createdAt: now,
      updatedAt: now,
      estimatedMinutes: 20,
      priorityScore: 78,
      subSteps: [
        { id: '2-1', title: 'Check analytics dashboard', completed: true },
        { id: '2-2', title: 'Prepare follow-up email', completed: false },
        { id: '2-3', title: 'Schedule call with CEO', completed: false },
      ],
      commentsCount: 3,
      tags: ['email', 'follow-up'],
      columnId: 'in-progress',
      position: 0,
    },
    {
      id: '3',
      title: 'Champion has departed and needs action',
      description: 'Our main contact has left the company. Need to establish new relationship.',
      deadlineType: 'flexible',
      importanceLevel: 'medium',
      energyRequired: 'high',
      nextStep: 'Identify new point of contact',
      status: 'planned',
      category: 'customer',
      dueDate: nextWeek,
      createdAt: now,
      updatedAt: now,
      estimatedMinutes: 45,
      priorityScore: 55,
      subSteps: [
        { id: '3-1', title: 'Identify new point of contact', completed: false },
        { id: '3-2', title: 'Schedule intro meeting', completed: false },
        { id: '3-3', title: 'Transfer context and history', completed: false },
      ],
      commentsCount: 0,
      tags: ['relationship', 'customer'],
      columnId: 'todo',
      position: 0,
    },
    {
      id: '4',
      title: 'Review project proposal',
      description: 'Review the Q2 project proposal document.',
      deadlineType: 'urgent',
      importanceLevel: 'high',
      energyRequired: 'medium',
      nextStep: 'Read through proposal',
      status: 'planned',
      category: 'internal',
      dueDate: now,
      createdAt: now,
      updatedAt: now,
      estimatedMinutes: 25,
      priorityScore: 82,
      subSteps: [],
      commentsCount: 0,
      tags: ['proposal', 'review'],
      columnId: 'todo',
      position: 1,
    },
    {
      id: '5',
      title: 'Team meeting at 3 PM',
      description: 'Weekly team sync to discuss progress and blockers.',
      deadlineType: 'urgent',
      importanceLevel: 'medium',
      energyRequired: 'low',
      nextStep: 'Prepare agenda',
      status: 'planned',
      category: 'internal',
      dueDate: now,
      createdAt: now,
      updatedAt: now,
      estimatedMinutes: 60,
      priorityScore: 70,
      subSteps: [],
      commentsCount: 0,
      tags: ['meeting', 'team'],
      columnId: 'todo',
      position: 2,
    },
    {
      id: '6',
      title: 'Update documentation',
      description: 'Update the API documentation with new endpoints.',
      deadlineType: 'flexible',
      importanceLevel: 'medium',
      energyRequired: 'medium',
      nextStep: 'Review current docs',
      status: 'planned',
      category: 'internal',
      dueDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
      createdAt: now,
      updatedAt: now,
      estimatedMinutes: 90,
      priorityScore: 45,
      subSteps: [],
      commentsCount: 0,
      tags: ['docs', 'api'],
      columnId: 'todo',
      position: 3,
    },
    {
      id: '7',
      title: 'Prepare presentation',
      description: 'Create slides for the client presentation next week.',
      deadlineType: 'flexible',
      importanceLevel: 'high',
      energyRequired: 'high',
      nextStep: 'Outline key points',
      status: 'planned',
      category: 'customer',
      dueDate: new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000),
      createdAt: now,
      updatedAt: now,
      estimatedMinutes: 120,
      priorityScore: 60,
      subSteps: [],
      commentsCount: 0,
      tags: ['presentation', 'client'],
      columnId: 'todo',
      position: 4,
    },
  ];
}
