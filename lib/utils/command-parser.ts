// Natural Language Command Parser for Chat-First Interface
// Parses user messages to detect commands and extract parameters

export type CommandType =
  | 'switch_task'      // "Show task 2", "Let's work on budget planning"
  | 'create_task'      // "Create a new task to outline my pitch"
  | 'update_task'      // "Update task 3 priority to high"
  | 'delete_task'      // "Delete task 2", "Remove the budget task"
  | 'complete_task'    // "Mark task done", "Complete the current task"
  | 'list_tasks'       // "Show all tasks", "What tasks do I have?"
  | 'analyze_document' // "Summarize the PDF from task 2"
  | 'golden_time'      // "Start golden time", "I have 30 minutes"
  | 'help'             // "Help", "What can you do?"
  | 'status'           // "What's my progress?", "Task status"
  | 'chat'             // Regular conversation with agent

export interface ParsedCommand {
  type: CommandType;
  confidence: number;
  parameters: CommandParameters;
  originalMessage: string;
}

export interface CommandParameters {
  taskId?: string;
  taskNumber?: number;
  taskTitle?: string;
  searchQuery?: string;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  deadline?: string;
  deadlineType?: 'urgent' | 'flexible' | 'none';
  energyLevel?: 'high' | 'medium' | 'low';
  dueDate?: Date;
  description?: string;
  documentReference?: string;
  duration?: number;
  updateField?: string;
  updateValue?: string;
}

// Command patterns with regex and keywords
const COMMAND_PATTERNS: Array<{
  type: CommandType;
  patterns: RegExp[];
  keywords: string[];
  priority: number;
}> = [
  {
    type: 'switch_task',
    patterns: [
      /(?:show|open|switch to|go to|work on|continue|let'?s? (?:work on|continue)|back to)\s+(?:task\s*)?(?:#?\s*)?(\d+)/i,
      /(?:show|open|switch to|go to|work on|continue|let'?s? (?:work on|continue)|back to)\s+(?:the\s+)?(.+?)\s*(?:task)?$/i,
      /task\s*(?:#?\s*)?(\d+)/i,
    ],
    keywords: ['show', 'open', 'switch', 'continue', 'work on', 'go to', 'back to'],
    priority: 10,
  },
  {
    type: 'create_task',
    patterns: [
      /(?:create|make|add|new|start)\s+(?:a\s+)?(?:new\s+)?task\s+(?:to|for|about|called)?\s*[:\-]?\s*(.+)/i,
      /(?:i need to|i want to|i have to|help me)\s+(.+)/i,
      /(?:can you|could you)\s+help\s+(?:me\s+)?(?:with\s+)?(.+)/i,
      /new task[:\-]?\s*(.+)/i,
    ],
    keywords: ['create', 'make', 'add', 'new task', 'start a task'],
    priority: 9,
  },
  {
    type: 'update_task',
    patterns: [
      /(?:update|change|set|modify)\s+(?:task\s*)?(?:#?\s*)?(\d+)?\s*(?:'?s?)?\s*(priority|deadline|due date|energy|status)\s+(?:to\s+)?(.+)/i,
      /(?:set|change|update)\s+(?:the\s+)?(priority|deadline|due date|energy|status)\s+(?:of\s+)?(?:task\s*)?(?:#?\s*)?(\d+)?\s*(?:to\s+)?(.+)/i,
      /(?:make|mark)\s+(?:task\s*)?(?:#?\s*)?(\d+)?\s*(?:as\s+)?(high priority|low priority|urgent|critical)/i,
      /(?:deadline|due)\s+(?:is\s+)?(?:on\s+)?(?:next\s+)?(.+)/i,
    ],
    keywords: ['update', 'change', 'set', 'modify', 'mark', 'make'],
    priority: 8,
  },
  {
    type: 'complete_task',
    patterns: [
      /(?:complete|finish|done|mark (?:as )?(?:done|complete|finished))\s*(?:task\s*)?(?:#?\s*)?(\d+)?/i,
      /(?:i'?m?\s+)?(?:done|finished)\s+(?:with\s+)?(?:this\s+)?(?:task\s*)?(?:#?\s*)?(\d+)?/i,
      /task\s*(?:#?\s*)?(\d+)?\s+(?:is\s+)?(?:done|complete|finished)/i,
    ],
    keywords: ['complete', 'finish', 'done', 'mark done'],
    priority: 7,
  },
  {
    type: 'delete_task',
    patterns: [
      /(?:delete|remove|cancel|archive)\s+(?:task\s*)?(?:#?\s*)?(\d+)/i,
      /(?:delete|remove|cancel|archive)\s+(?:the\s+)?(.+?)\s*task/i,
    ],
    keywords: ['delete', 'remove', 'cancel', 'archive'],
    priority: 6,
  },
  {
    type: 'list_tasks',
    patterns: [
      /(?:show|list|display|what)\s+(?:all\s+)?(?:my\s+)?tasks/i,
      /what\s+(?:tasks|work)\s+(?:do i have|are there|should i)/i,
      /(?:my|all)\s+tasks/i,
    ],
    keywords: ['all tasks', 'my tasks', 'list tasks', 'show tasks', 'what tasks'],
    priority: 5,
  },
  {
    type: 'analyze_document',
    patterns: [
      /(?:summarize|analyze|read|check|look at)\s+(?:the\s+)?(?:pdf|doc|document|file)\s+(?:from|in|of)\s+(?:task\s*)?(?:#?\s*)?(\d+)/i,
      /(?:summarize|analyze|read)\s+(?:the\s+)?(.+?)\s+(?:document|file|pdf)/i,
      /what'?s?\s+(?:in\s+)?(?:the\s+)?(?:pdf|doc|document|file)/i,
    ],
    keywords: ['summarize', 'analyze', 'document', 'pdf', 'file'],
    priority: 4,
  },
  {
    type: 'golden_time',
    patterns: [
      /(?:start|begin|let'?s?\s+(?:do|start))\s+(?:a\s+)?golden\s+time/i,
      /i\s+have\s+(\d+)\s*(?:minutes?|mins?|m)/i,
      /(?:golden|focus)\s+(?:time|session|mode)/i,
      /(\d+)\s*(?:minutes?|mins?|m)\s+(?:of\s+)?(?:time|focus|work)/i,
    ],
    keywords: ['golden time', 'focus time', 'focus session', 'have minutes'],
    priority: 3,
  },
  {
    type: 'status',
    patterns: [
      /(?:what'?s?\s+)?(?:my|the|current)\s+(?:progress|status)/i,
      /(?:how\s+am\s+i|how'?s?\s+it)\s+going/i,
      /(?:task|progress)\s+(?:status|report|summary)/i,
    ],
    keywords: ['status', 'progress', 'how am i doing'],
    priority: 2,
  },
  {
    type: 'help',
    patterns: [
      /^help$/i,
      /what\s+can\s+you\s+do/i,
      /how\s+(?:do\s+i|does\s+this|to)\s+(?:use|work)/i,
      /(?:show|list)\s+(?:all\s+)?commands/i,
    ],
    keywords: ['help', 'commands', 'what can you do'],
    priority: 1,
  },
];

// Priority words and phrases for update commands
const PRIORITY_MAPPINGS: Record<string, 'critical' | 'high' | 'medium' | 'low'> = {
  'critical': 'critical',
  'urgent': 'critical',
  'very important': 'critical',
  'top priority': 'critical',
  'high': 'high',
  'important': 'high',
  'high priority': 'high',
  'medium': 'medium',
  'normal': 'medium',
  'regular': 'medium',
  'low': 'low',
  'not urgent': 'low',
  'whenever': 'low',
  'low priority': 'low',
};

// Energy level mappings
const ENERGY_MAPPINGS: Record<string, 'high' | 'medium' | 'low'> = {
  'high': 'high',
  'high energy': 'high',
  'energized': 'high',
  'fresh': 'high',
  'medium': 'medium',
  'normal': 'medium',
  'average': 'medium',
  'low': 'low',
  'low energy': 'low',
  'tired': 'low',
  'easy': 'low',
};

// Deadline mappings
const DEADLINE_MAPPINGS: Record<string, 'urgent' | 'flexible' | 'none'> = {
  'urgent': 'urgent',
  'asap': 'urgent',
  'today': 'urgent',
  'immediately': 'urgent',
  'flexible': 'flexible',
  'no rush': 'flexible',
  'whenever': 'flexible',
  'none': 'none',
  'no deadline': 'none',
};

/**
 * Parse a user message to detect commands
 */
export function parseCommand(message: string): ParsedCommand {
  const trimmedMessage = message.trim();
  let bestMatch: ParsedCommand = {
    type: 'chat',
    confidence: 1.0,
    parameters: {},
    originalMessage: trimmedMessage,
  };

  // Sort patterns by priority (higher first)
  const sortedPatterns = [...COMMAND_PATTERNS].sort((a, b) => b.priority - a.priority);

  for (const commandPattern of sortedPatterns) {
    // Check keywords first for quick matching
    const lowerMessage = trimmedMessage.toLowerCase();
    const hasKeyword = commandPattern.keywords.some(k => lowerMessage.includes(k));
    
    if (!hasKeyword) continue;

    // Try each regex pattern
    for (const pattern of commandPattern.patterns) {
      const match = trimmedMessage.match(pattern);
      if (match) {
        const parameters = extractParameters(commandPattern.type, match, trimmedMessage);
        const confidence = calculateConfidence(commandPattern.type, match, trimmedMessage);
        
        if (confidence > bestMatch.confidence || 
            (confidence === bestMatch.confidence && commandPattern.priority > 5)) {
          bestMatch = {
            type: commandPattern.type,
            confidence,
            parameters,
            originalMessage: trimmedMessage,
          };
        }
        break; // Found match for this command type
      }
    }
  }

  return bestMatch;
}

/**
 * Extract parameters from regex match based on command type
 */
function extractParameters(
  type: CommandType,
  match: RegExpMatchArray,
  originalMessage: string
): CommandParameters {
  const params: CommandParameters = {};
  const lowerMessage = originalMessage.toLowerCase();

  switch (type) {
    case 'switch_task': {
      const captured = match[1]?.trim();
      if (captured && /^\d+$/.test(captured)) {
        params.taskNumber = parseInt(captured, 10);
      } else if (captured) {
        params.searchQuery = captured;
      }
      break;
    }

    case 'create_task': {
      const captured = match[1]?.trim();
      if (captured) {
        params.taskTitle = captured;
        // Try to extract priority/deadline from context
        for (const [key, value] of Object.entries(PRIORITY_MAPPINGS)) {
          if (lowerMessage.includes(key)) {
            params.priority = value;
            break;
          }
        }
        for (const [key, value] of Object.entries(DEADLINE_MAPPINGS)) {
          if (lowerMessage.includes(key)) {
            params.deadlineType = value;
            break;
          }
        }
      }
      break;
    }

    case 'update_task': {
      // Match patterns like "update task 3 priority to high"
      const taskNumMatch = originalMessage.match(/task\s*#?\s*(\d+)/i);
      if (taskNumMatch) {
        params.taskNumber = parseInt(taskNumMatch[1], 10);
      }

      // Extract field being updated
      const fieldMatch = originalMessage.match(/(priority|deadline|due date|energy|status)/i);
      if (fieldMatch) {
        params.updateField = fieldMatch[1].toLowerCase();
      }

      // Extract the value
      for (const [key, value] of Object.entries(PRIORITY_MAPPINGS)) {
        if (lowerMessage.includes(key)) {
          params.priority = value;
          params.updateValue = value;
          break;
        }
      }
      for (const [key, value] of Object.entries(ENERGY_MAPPINGS)) {
        if (lowerMessage.includes(key)) {
          params.energyLevel = value;
          params.updateValue = value;
          break;
        }
      }
      for (const [key, value] of Object.entries(DEADLINE_MAPPINGS)) {
        if (lowerMessage.includes(key)) {
          params.deadlineType = value;
          params.updateValue = value;
          break;
        }
      }

      // Parse date expressions like "next Friday"
      const dateMatch = originalMessage.match(/(?:next|this)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);
      if (dateMatch) {
        params.dueDate = parseRelativeDate(dateMatch[0]);
      }
      break;
    }

    case 'complete_task':
    case 'delete_task': {
      const taskNumMatch = originalMessage.match(/task\s*#?\s*(\d+)/i) || match;
      if (taskNumMatch?.[1] && /^\d+$/.test(taskNumMatch[1])) {
        params.taskNumber = parseInt(taskNumMatch[1], 10);
      } else if (match[1] && !/^\d+$/.test(match[1])) {
        params.searchQuery = match[1].trim();
      }
      break;
    }

    case 'analyze_document': {
      const taskNumMatch = originalMessage.match(/task\s*#?\s*(\d+)/i);
      if (taskNumMatch) {
        params.taskNumber = parseInt(taskNumMatch[1], 10);
      }
      const docMatch = originalMessage.match(/(?:the\s+)?([a-zA-Z0-9_\-\.]+\.(?:pdf|doc|docx|txt|md))/i);
      if (docMatch) {
        params.documentReference = docMatch[1];
      }
      break;
    }

    case 'golden_time': {
      const durationMatch = originalMessage.match(/(\d+)\s*(?:minutes?|mins?|m)/i);
      if (durationMatch) {
        params.duration = parseInt(durationMatch[1], 10);
      }
      break;
    }
  }

  return params;
}

/**
 * Calculate confidence score for a command match
 */
function calculateConfidence(
  type: CommandType,
  match: RegExpMatchArray,
  originalMessage: string
): number {
  let confidence = 0.7; // Base confidence for a pattern match
  const lowerMessage = originalMessage.toLowerCase();

  // Increase confidence if we have explicit task references
  if (lowerMessage.includes('task') || /task\s*#?\s*\d+/i.test(originalMessage)) {
    confidence += 0.15;
  }

  // Increase for stronger command words
  const strongCommands = ['create', 'delete', 'switch', 'update', 'complete'];
  if (strongCommands.some(cmd => lowerMessage.startsWith(cmd))) {
    confidence += 0.1;
  }

  // Decrease if message is very long (likely conversational)
  if (originalMessage.length > 100) {
    confidence -= 0.2;
  }

  // Increase for short, direct commands
  if (originalMessage.length < 30) {
    confidence += 0.05;
  }

  return Math.min(Math.max(confidence, 0), 1);
}

/**
 * Parse relative date expressions
 */
function parseRelativeDate(expression: string): Date {
  const lower = expression.toLowerCase();
  const now = new Date();
  const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  
  for (let i = 0; i < dayOfWeek.length; i++) {
    if (lower.includes(dayOfWeek[i])) {
      const currentDay = now.getDay();
      let daysUntil = i - currentDay;
      if (daysUntil <= 0) daysUntil += 7; // Next week
      if (lower.includes('next')) daysUntil += 7;
      
      const targetDate = new Date(now);
      targetDate.setDate(now.getDate() + daysUntil);
      return targetDate;
    }
  }
  
  // Default to a week from now
  const weekFromNow = new Date(now);
  weekFromNow.setDate(now.getDate() + 7);
  return weekFromNow;
}

/**
 * Generate help text for available commands
 */
export function getHelpText(): string {
  return `
🌟 **Here's what I can help you with:**

**📋 Task Management**
• "Create a task to [description]" - Start a new task
• "Show task 3" or "Work on [task name]" - Switch to a task
• "Update task 2 priority to high" - Modify task details
• "Set deadline to next Friday" - Set due dates
• "Complete task" or "I'm done" - Mark task complete
• "Delete task 3" - Remove a task
• "Show all tasks" - List your tasks

**📄 Documents**
• "Summarize the PDF from task 2" - Analyze documents
• Upload files anytime - I'll analyze them automatically

**⏱️ Golden Time**
• "Start golden time" - Begin a focused work session
• "I have 30 minutes" - Quick session mode

**💬 Just Chat**
• Ask anything about your current task
• Request drafts, outlines, code, or ideas
• Get help breaking down work into steps

**Tips:**
• You can reference tasks by number (task 2) or by name
• I remember our conversation and your documents
• Just type naturally - I'll understand!
`.trim();
}

/**
 * Generate task list summary
 */
export function generateTaskListText(
  tasks: Array<{ id: string; title: string; status: string; priority: string; agent: { name: string } }>,
  activeTaskId?: string | null
): string {
  if (tasks.length === 0) {
    return "You don't have any tasks yet. Want to create one? Just say \"Create a task to [what you want to do]\"";
  }

  const activeTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'archived');
  const completedTasks = tasks.filter(t => t.status === 'completed');

  let text = `**📋 Your Tasks:**\n\n`;

  if (activeTasks.length > 0) {
    text += '**Active:**\n';
    activeTasks.forEach((task, index) => {
      const indicator = task.id === activeTaskId ? '→ ' : '  ';
      const priorityEmoji = task.priority === 'critical' ? '🔴' : task.priority === 'high' ? '🟠' : task.priority === 'medium' ? '🟡' : '🟢';
      text += `${indicator}${index + 1}. ${priorityEmoji} **${task.title}** (${task.agent.name})\n`;
    });
    text += '\n';
  }

  if (completedTasks.length > 0) {
    text += `**Completed:** ${completedTasks.length} task${completedTasks.length > 1 ? 's' : ''}\n`;
  }

  text += `\nTo switch tasks, say "show task [number]" or "work on [task name]"`;

  return text;
}

/**
 * Fuzzy search tasks by title
 */
export function findTaskByQuery(
  tasks: Array<{ id: string; title: string; description?: string }>,
  query: string
): { id: string; title: string } | null {
  const lowerQuery = query.toLowerCase();
  
  // Exact match first
  const exact = tasks.find(t => t.title.toLowerCase() === lowerQuery);
  if (exact) return exact;
  
  // Partial match
  const partial = tasks.find(t => t.title.toLowerCase().includes(lowerQuery));
  if (partial) return partial;
  
  // Words match
  const queryWords = lowerQuery.split(/\s+/);
  const wordMatch = tasks.find(t => {
    const titleLower = t.title.toLowerCase();
    return queryWords.every(word => titleLower.includes(word));
  });
  if (wordMatch) return wordMatch;
  
  // Description match
  const descMatch = tasks.find(t => t.description?.toLowerCase().includes(lowerQuery));
  if (descMatch) return descMatch;
  
  return null;
}
