import { NextRequest, NextResponse } from 'next/server';

import fs from 'fs';
import yaml from 'js-yaml';
import OpenAI from 'openai';
import path from 'path';

// Load configuration from ~/.genspark_llm.yaml or environment
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

interface TaskContext {
  id: string;
  title: string;
  description?: string;
  deadlineType: string;
  importanceLevel: string;
  energyRequired: string;
  nextStep?: string;
  status: string;
  dueDate?: string;
  estimatedMinutes?: number;
  subSteps?: Array<{ id: string; title: string; completed: boolean }>;
  documents?: Array<{ name: string; summary?: string; extractedInsights?: string[] }>;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      message, 
      taskContext, 
      conversationHistory = [],
      agentName = 'TaskBot'
    }: {
      message: string;
      taskContext: TaskContext;
      conversationHistory: ChatMessage[];
      agentName: string;
    } = body;

    if (!message || !taskContext) {
      return NextResponse.json(
        { error: 'Message and task context are required' },
        { status: 400 }
      );
    }

    const client = getOpenAIClient();

    // Build task context for the agent
    const taskInfo = `
Task: ${taskContext.title}
${taskContext.description ? `Description: ${taskContext.description}` : ''}
Priority: ${taskContext.importanceLevel}
Deadline: ${taskContext.deadlineType}${taskContext.dueDate ? ` (Due: ${taskContext.dueDate})` : ''}
Energy Required: ${taskContext.energyRequired}
Status: ${taskContext.status}
${taskContext.estimatedMinutes ? `Estimated Time: ${taskContext.estimatedMinutes} minutes` : ''}
${taskContext.nextStep ? `Suggested Next Step: ${taskContext.nextStep}` : ''}
${taskContext.subSteps?.length ? `\nSubtasks:\n${taskContext.subSteps.map((s, i) => `${i + 1}. [${s.completed ? 'x' : ' '}] ${s.title}`).join('\n')}` : ''}
${taskContext.documents?.length ? `\nAttached Documents:\n${taskContext.documents.map(d => `- ${d.name}${d.summary ? `: ${d.summary}` : ''}`).join('\n')}` : ''}
`.trim();

    // Convert conversation history to OpenAI format
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: `You are ${agentName}, a friendly and proactive AI assistant embedded within a task in the Quartz task management app.

YOUR PERSONALITY:
- Warm, encouraging, and conversational
- Proactive - offer help and suggestions without being asked
- Time-conscious - offer quick tips to save time
- Detail-oriented - remember context from documents and conversation
- Action-oriented - focus on getting things done

YOUR CAPABILITIES:
- Generate subtasks and break down work
- Write drafts, outlines, and content
- Summarize documents attached to this task
- Suggest next steps and priorities
- Answer questions about the task
- Offer encouragement and time-saving tips
- Ask clarifying questions when needed

TASK CONTEXT:
${taskInfo}

RESPONSE GUIDELINES:
1. Keep responses concise but helpful (2-4 paragraphs max)
2. Use bullet points for lists
3. Offer specific, actionable suggestions
4. If the user seems stuck, offer 2-3 concrete next steps
5. Reference attached documents when relevant
6. Acknowledge progress and celebrate small wins
7. End with a helpful question or suggestion when appropriate

Remember: You're here to help the user complete this specific task efficiently and enjoyably!`
      },
      // Add conversation history
      ...conversationHistory.slice(-10).map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      })),
      // Add current message
      {
        role: 'user' as const,
        content: message
      }
    ];

    const completion = await client.chat.completions.create({
      model: 'gpt-5',
      messages,
      temperature: 0.7,
      max_tokens: 800,
    });

    const responseContent = completion.choices[0]?.message?.content || "I'm here to help! Could you tell me more about what you need?";

    // Generate contextual suggestions based on the response
    const suggestions = generateSuggestions(message, responseContent, taskContext);

    return NextResponse.json({
      success: true,
      response: {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: responseContent,
        timestamp: new Date().toISOString(),
        suggestions
      }
    });

  } catch (error) {
    console.error('Agent chat error:', error);
    return NextResponse.json(
      { error: 'Failed to generate response', details: String(error) },
      { status: 500 }
    );
  }
}

function generateSuggestions(
  userMessage: string, 
  agentResponse: string, 
  taskContext: TaskContext
): string[] {
  const suggestions: string[] = [];
  const lowercaseMessage = userMessage.toLowerCase();
  const lowercaseResponse = agentResponse.toLowerCase();

  // Context-aware suggestions
  if (lowercaseMessage.includes('help') || lowercaseMessage.includes('start')) {
    suggestions.push('What should I focus on first?');
  }

  if (taskContext.subSteps && taskContext.subSteps.some(s => !s.completed)) {
    suggestions.push('Show me the next subtask');
  }

  if (taskContext.documents && taskContext.documents.length > 0) {
    suggestions.push('Summarize the attached documents');
  }

  if (!lowercaseMessage.includes('subtask') && !lowercaseResponse.includes('subtask')) {
    suggestions.push('Break this into subtasks');
  }

  if (lowercaseResponse.includes('draft') || lowercaseResponse.includes('write')) {
    suggestions.push('Write a first draft');
  }

  suggestions.push('What tips do you have?');

  // Return max 3 suggestions
  return suggestions.slice(0, 3);
}
