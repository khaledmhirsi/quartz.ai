import { NextRequest, NextResponse } from 'next/server';

import fs from 'fs';
import yaml from 'js-yaml';
import OpenAI from 'openai';
import path from 'path';

// Load OpenAI configuration
function getOpenAIClient(): OpenAI {
  const configPath = path.join(process.env.HOME || '/home/user', '.genspark_llm.yaml');
  let config: { openai?: { api_key?: string; base_url?: string } } | null = null;

  try {
    if (fs.existsSync(configPath)) {
      const fileContents = fs.readFileSync(configPath, 'utf8');
      config = yaml.load(fileContents) as typeof config;
    }
  } catch (error) {
    console.error('Error reading config file:', error);
  }

  return new OpenAI({
    apiKey: config?.openai?.api_key || process.env.OPENAI_API_KEY,
    baseURL: config?.openai?.base_url || process.env.OPENAI_BASE_URL,
  });
}

// Master system prompt for the unified Quartz AI assistant
const MASTER_SYSTEM_PROMPT = `You are Quartz, a powerful personal AI assistant that helps users manage tasks and get work done through natural conversation.

## Your Personality
- Friendly, proactive, and intelligent
- Adapt your tone based on task type (creative, academic, professional)
- Be encouraging but not overly cheerful
- Offer time-saving tips and explain next steps clearly
- Ask clarifying questions when needed

## Your Capabilities
1. **Task Management** - Create, update, switch between, and complete tasks
2. **Document Analysis** - Summarize PDFs, extract key insights, answer questions
3. **Drafting** - Write emails, outlines, code, content
4. **Planning** - Break work into subtasks, create timelines
5. **Research** - Help gather and synthesize information
6. **Teaching** - Explain concepts, create quizzes

## Context
{CONTEXT}

## Guidelines
- Always confirm actions before making changes
- When switching tasks, briefly acknowledge the switch
- Suggest next steps after completing actions
- Remember previous conversations and documents
- Keep responses focused and actionable
- Use formatting (bold, bullets) for clarity

## Available Commands (use naturally in conversation)
- Task switching: Reference tasks by number or name
- Creating tasks: Detect when user wants to start something new
- Updates: Recognize priority/deadline changes
- Document analysis: Help with uploaded files
- Progress tracking: Keep users informed`;

interface UnifiedChatRequest {
  message: string;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  currentContext: {
    activeTask?: {
      id: string;
      title: string;
      description?: string;
      priority: string;
      deadlineType: string;
      energyRequired: string;
      dueDate?: string;
      agentName: string;
      agentRole: string;
      documents: Array<{ name: string; summary?: string; keyInsights?: string[] }>;
      subtasks: Array<{ title: string; status: string }>;
      phase: string;
    };
    allTasks: Array<{
      id: string;
      number: number;
      title: string;
      status: string;
      priority: string;
      agentName: string;
    }>;
    recentTasks: Array<{ id: string; title: string; agentName: string }>;
  };
  parsedCommand?: {
    type: string;
    confidence: number;
    parameters: Record<string, unknown>;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: UnifiedChatRequest = await request.json();
    const { message, conversationHistory, currentContext, parsedCommand } = body;

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const client = getOpenAIClient();

    // Build dynamic context
    const contextParts: string[] = [];

    // Add task list context
    if (currentContext.allTasks.length > 0) {
      contextParts.push('## Your Tasks');
      currentContext.allTasks.forEach((task, idx) => {
        const active = currentContext.activeTask?.id === task.id ? ' (ACTIVE)' : '';
        contextParts.push(`${idx + 1}. [${task.status}] ${task.title} - ${task.agentName}${active}`);
      });
      contextParts.push('');
    }

    // Add active task details
    if (currentContext.activeTask) {
      const task = currentContext.activeTask;
      contextParts.push('## Current Active Task');
      contextParts.push(`Title: ${task.title}`);
      contextParts.push(`Agent: ${task.agentName} (${task.agentRole})`);
      if (task.description) contextParts.push(`Description: ${task.description}`);
      contextParts.push(`Priority: ${task.priority} | Deadline: ${task.deadlineType} | Energy: ${task.energyRequired}`);
      if (task.dueDate) contextParts.push(`Due: ${task.dueDate}`);
      
      if (task.documents.length > 0) {
        contextParts.push('\nUploaded Documents:');
        task.documents.forEach(doc => {
          contextParts.push(`- ${doc.name}${doc.summary ? ` (Summary: ${doc.summary.substring(0, 100)}...)` : ''}`);
        });
      }
      
      if (task.subtasks.length > 0) {
        const completed = task.subtasks.filter(s => s.status === 'completed').length;
        contextParts.push(`\nSubtasks: ${completed}/${task.subtasks.length} completed`);
        task.subtasks.forEach(s => {
          contextParts.push(`- [${s.status === 'completed' ? 'x' : ' '}] ${s.title}`);
        });
      }
      contextParts.push('');
    }

    // Add command context if detected
    if (parsedCommand && parsedCommand.type !== 'chat') {
      contextParts.push('## Detected Intent');
      contextParts.push(`The user appears to want to: ${parsedCommand.type.replace(/_/g, ' ')}`);
      contextParts.push(`Confidence: ${(parsedCommand.confidence * 100).toFixed(0)}%`);
      if (Object.keys(parsedCommand.parameters).length > 0) {
        contextParts.push(`Parameters: ${JSON.stringify(parsedCommand.parameters)}`);
      }
      contextParts.push('\nRespond appropriately to this intent. Confirm the action and execute it conversationally.');
    }

    const systemPrompt = MASTER_SYSTEM_PROMPT.replace('{CONTEXT}', contextParts.join('\n'));

    // Build enhanced prompt based on command type
    let enhancedUserMessage = message;
    
    if (parsedCommand) {
      switch (parsedCommand.type) {
        case 'help':
          enhancedUserMessage = `The user is asking for help. Explain what you can do in a friendly, organized way. Include examples of commands they can use naturally in conversation.`;
          break;
          
        case 'list_tasks':
          enhancedUserMessage = `The user wants to see their tasks. List them in a clear, organized format with task numbers, titles, and agents. Indicate which one is currently active.`;
          break;
          
        case 'create_task':
          enhancedUserMessage = `${message}\n\nThe user wants to create a new task. Extract the task title/description from their message. Confirm what you understood and ask any clarifying questions (deadline, priority, energy level) before creating it.`;
          break;
          
        case 'switch_task':
          enhancedUserMessage = `${message}\n\nThe user wants to switch to a different task. Identify which task they want based on the number or name. Confirm the switch and greet them with context about that task.`;
          break;
          
        case 'update_task':
          enhancedUserMessage = `${message}\n\nThe user wants to update a task. Confirm what change they want to make (priority, deadline, etc.) and to which task. Then confirm the update.`;
          break;
          
        case 'complete_task':
          enhancedUserMessage = `${message}\n\nThe user wants to mark a task as complete. Confirm which task and celebrate their accomplishment briefly. Suggest what they might want to work on next.`;
          break;
          
        case 'delete_task':
          enhancedUserMessage = `${message}\n\nThe user wants to delete a task. Confirm which task they mean and ask for final confirmation before proceeding.`;
          break;
          
        case 'analyze_document':
          enhancedUserMessage = `${message}\n\nThe user wants to analyze a document. If they specified a task, find that document. Summarize it and offer follow-up options like extracting questions or key deadlines.`;
          break;
          
        case 'golden_time':
          enhancedUserMessage = `${message}\n\nThe user wants to start a focused work session (Golden Time). Acknowledge this and help them pick the best task based on their available time and energy. Offer encouragement.`;
          break;
          
        case 'status':
          enhancedUserMessage = `${message}\n\nThe user wants a progress update. Summarize their current task's progress, what's been accomplished, and what's next.`;
          break;
      }
    }

    // Build messages for API
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-20).map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user', content: enhancedUserMessage },
    ];

    const completion = await client.chat.completions.create({
      model: 'gpt-5',
      messages,
      temperature: 0.7,
      max_tokens: 2000,
    });

    const responseContent = completion.choices[0]?.message?.content || 
      "I'm here to help! Tell me what you'd like to work on.";

    // Generate action suggestions based on context and response
    const suggestions = generateSuggestions(responseContent, parsedCommand?.type, currentContext);

    // Detect if response indicates an action should be taken
    const actionResult = detectActionResult(responseContent, parsedCommand?.type);

    return NextResponse.json({
      success: true,
      response: {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: responseContent,
        timestamp: new Date().toISOString(),
        suggestions,
        actionResult,
      },
    });

  } catch (error) {
    console.error('Unified chat error:', error);
    return NextResponse.json(
      { error: 'Failed to generate response', details: String(error) },
      { status: 500 }
    );
  }
}

function generateSuggestions(
  response: string,
  commandType: string | undefined,
  context: UnifiedChatRequest['currentContext']
): string[] {
  const suggestions: string[] = [];
  const lowerResponse = response.toLowerCase();

  // Command-specific suggestions
  switch (commandType) {
    case 'help':
      suggestions.push('Create a new task');
      suggestions.push('Show my tasks');
      break;
      
    case 'list_tasks':
      if (context.allTasks.length > 0) {
        suggestions.push(`Work on task 1`);
        suggestions.push('Create new task');
      }
      break;
      
    case 'create_task':
      suggestions.push('Set priority to high');
      suggestions.push('Add a deadline');
      suggestions.push('Start working on it');
      break;
      
    case 'switch_task':
      suggestions.push('What should I do first?');
      suggestions.push('Show me the documents');
      suggestions.push('Break this into subtasks');
      break;
      
    case 'complete_task':
      suggestions.push('Show my other tasks');
      suggestions.push('Create a new task');
      break;
      
    case 'analyze_document':
      suggestions.push('Extract key deadlines');
      suggestions.push('Quiz me on this');
      suggestions.push('Summarize further');
      break;
  }

  // Response-based suggestions
  if (lowerResponse.includes('document') || lowerResponse.includes('file')) {
    suggestions.push('Analyze this document');
  }
  if (lowerResponse.includes('draft') || lowerResponse.includes('email')) {
    suggestions.push('Make it more formal');
    suggestions.push('Create another version');
  }
  if (lowerResponse.includes('subtask') || lowerResponse.includes('step')) {
    suggestions.push('Start the first step');
  }

  // Context-based suggestions
  if (context.activeTask) {
    if (context.activeTask.documents.length > 0 && suggestions.length < 3) {
      suggestions.push('Summarize my documents');
    }
    if (context.activeTask.subtasks.some(s => s.status === 'pending') && suggestions.length < 3) {
      suggestions.push("What's the next step?");
    }
  }

  // Default suggestions
  if (suggestions.length === 0) {
    suggestions.push('Help me get started');
    suggestions.push('Show my tasks');
  }

  return [...new Set(suggestions)].slice(0, 3);
}

function detectActionResult(
  response: string,
  commandType: string | undefined
): { type: string; data?: Record<string, unknown> } | null {
  const lower = response.toLowerCase();

  // Check for task creation confirmation
  if (commandType === 'create_task' && 
      (lower.includes('created') || lower.includes('new task') || lower.includes("let's get started"))) {
    return { type: 'task_created' };
  }

  // Check for task switch
  if (commandType === 'switch_task' && 
      (lower.includes('switching') || lower.includes('now working on') || lower.includes("let's continue"))) {
    return { type: 'task_switched' };
  }

  // Check for task completion
  if (commandType === 'complete_task' && 
      (lower.includes('completed') || lower.includes('done') || lower.includes('finished'))) {
    return { type: 'task_completed' };
  }

  // Check for document analysis
  if (commandType === 'analyze_document' && 
      (lower.includes('summary') || lower.includes('key points') || lower.includes('analysis'))) {
    return { type: 'document_analyzed' };
  }

  return null;
}
