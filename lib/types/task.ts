// Task Management Types for Quartz Smart Task App

export type DeadlineType = 'urgent' | 'flexible' | 'none';
export type ImportanceLevel = 'critical' | 'high' | 'medium' | 'low';
export type EnergyLevel = 'high' | 'medium' | 'low';
export type TaskStatus = 'planned' | 'in_progress' | 'blocked' | 'waiting_customer' | 'done';
export type TaskCategory = 'internal' | 'customer' | 'needs_action';

export interface SubStep {
  id: string;
  title: string;
  completed: boolean;
  estimatedMinutes?: number;
}

export interface TaskAgent {
  id: string;
  name: string;
  type: 'research' | 'design' | 'writing' | 'coding' | 'planning' | 'general';
  avatar: string;
  description: string;
  capabilities: string[];
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  
  // Smart Interview Fields
  deadlineType: DeadlineType;
  importanceLevel: ImportanceLevel;
  energyRequired: EnergyLevel;
  nextStep?: string;
  
  // Status & Category
  status: TaskStatus;
  category: TaskCategory;
  
  // Dates
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  
  // Time Tracking
  estimatedMinutes?: number;
  actualMinutes?: number;
  
  // Priority Score (auto-calculated)
  priorityScore: number;
  
  // Substeps
  subSteps: SubStep[];
  
  // Agent Assignment
  assignedAgent?: TaskAgent;
  
  // Comments count
  commentsCount: number;
  
  // User assignment
  assignee?: {
    id: string;
    name: string;
    avatar?: string;
  };
  
  // Tags
  tags: string[];
  
  // Parent task for subtasks
  parentTaskId?: string;
  
  // Board/Column position
  columnId: string;
  position: number;
}

export interface TaskColumn {
  id: string;
  title: string;
  color: string;
  tasks: Task[];
  limit?: number;
}

export interface TaskBoard {
  id: string;
  title: string;
  columns: TaskColumn[];
}

export interface GoldenTimeSession {
  id: string;
  availableMinutes: number;
  selectedTask?: Task;
  startedAt?: Date;
  completedSteps: string[];
  aiSuggestion?: string;
}

export interface TaskInterviewData {
  deadlineType: DeadlineType;
  importanceLevel: ImportanceLevel;
  energyRequired: EnergyLevel;
  nextStep: string;
  title: string;
  description?: string;
  dueDate?: Date;
  estimatedMinutes?: number;
}

// Status Configuration
export const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; bgColor: string; icon: string }> = {
  planned: {
    label: 'Planned',
    color: 'text-slate-600 dark:text-slate-400',
    bgColor: 'bg-slate-100 dark:bg-slate-800',
    icon: 'circle'
  },
  in_progress: {
    label: 'In Progress',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    icon: 'clock'
  },
  blocked: {
    label: 'Blocked',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    icon: 'alert-circle'
  },
  waiting_customer: {
    label: 'Waiting Customer',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    icon: 'user'
  },
  done: {
    label: 'Done',
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    icon: 'check-circle'
  }
};

// Category Configuration
export const CATEGORY_CONFIG: Record<TaskCategory, { label: string; color: string; bgColor: string }> = {
  internal: {
    label: 'Internal',
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30'
  },
  customer: {
    label: 'Customer',
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30'
  },
  needs_action: {
    label: 'Needs Action',
    color: 'text-rose-600 dark:text-rose-400',
    bgColor: 'bg-rose-100 dark:bg-rose-900/30'
  }
};

// Priority Badge Configuration
export const PRIORITY_CONFIG: Record<ImportanceLevel, { label: string; color: string; bgColor: string; dotColor: string }> = {
  critical: {
    label: 'Critical',
    color: 'text-red-700 dark:text-red-300',
    bgColor: 'bg-red-100 dark:bg-red-900/40',
    dotColor: 'bg-red-500'
  },
  high: {
    label: 'High',
    color: 'text-orange-700 dark:text-orange-300',
    bgColor: 'bg-orange-100 dark:bg-orange-900/40',
    dotColor: 'bg-orange-500'
  },
  medium: {
    label: 'Medium',
    color: 'text-blue-700 dark:text-blue-300',
    bgColor: 'bg-blue-100 dark:bg-blue-900/40',
    dotColor: 'bg-blue-500'
  },
  low: {
    label: 'Low',
    color: 'text-slate-600 dark:text-slate-400',
    bgColor: 'bg-slate-100 dark:bg-slate-800',
    dotColor: 'bg-slate-400'
  }
};

// Default Agents
export const DEFAULT_AGENTS: TaskAgent[] = [
  {
    id: 'research-agent',
    name: 'Research Agent',
    type: 'research',
    avatar: '/agents/research.svg',
    description: 'Helps with research, data gathering, and analysis',
    capabilities: ['Web research', 'Data analysis', 'Summarization', 'Fact checking']
  },
  {
    id: 'design-agent',
    name: 'Design Agent',
    type: 'design',
    avatar: '/agents/design.svg',
    description: 'Assists with design decisions and visual tasks',
    capabilities: ['UI/UX suggestions', 'Color schemes', 'Layout advice', 'Design critique']
  },
  {
    id: 'writing-agent',
    name: 'Writing Agent',
    type: 'writing',
    avatar: '/agents/writing.svg',
    description: 'Helps with writing, editing, and content creation',
    capabilities: ['Drafting', 'Editing', 'Proofreading', 'Content ideas']
  },
  {
    id: 'coding-agent',
    name: 'Coding Agent',
    type: 'coding',
    avatar: '/agents/coding.svg',
    description: 'Assists with coding and technical tasks',
    capabilities: ['Code review', 'Bug fixing', 'Implementation help', 'Architecture advice']
  },
  {
    id: 'planning-agent',
    name: 'Planning Agent',
    type: 'planning',
    avatar: '/agents/planning.svg',
    description: 'Helps with planning and organization',
    capabilities: ['Task breakdown', 'Timeline estimation', 'Resource planning', 'Prioritization']
  },
  {
    id: 'main-agent',
    name: 'Quartz AI',
    type: 'general',
    avatar: '/agents/main.svg',
    description: 'Your main AI assistant with full context access',
    capabilities: ['All tasks', 'Cross-task insights', 'General assistance', 'Coordination']
  }
];
