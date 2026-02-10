import { NextRequest, NextResponse } from 'next/server';

import fs from 'fs';
import yaml from 'js-yaml';
import OpenAI from 'openai';
import path from 'path';

// Load configuration
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

interface SubAgentRequest {
  message: string;
  systemPrompt: string;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  agentContext: {
    name: string;
    role: string;
    taskTitle: string;
    documents?: Array<{ name: string; summary?: string }>;
    subtasks?: Array<{ title: string; status: string }>;
    phase: string;
  };
  requestedAction?: 'summarize' | 'draft_email' | 'generate_outline' | 'create_subtasks' | 'quiz' | 'general';
}

export async function POST(request: NextRequest) {
  try {
    const body: SubAgentRequest = await request.json();
    const { 
      message, 
      systemPrompt, 
      conversationHistory, 
      agentContext,
      requestedAction 
    } = body;

    if (!message || !systemPrompt) {
      return NextResponse.json(
        { error: 'Message and system prompt are required' },
        { status: 400 }
      );
    }

    const client = getOpenAIClient();

    // Build enhanced system prompt based on action
    let enhancedSystemPrompt = systemPrompt;
    
    if (requestedAction) {
      const actionInstructions: Record<string, string> = {
        summarize: `\n\nThe user wants you to summarize content. Provide a clear, structured summary with:
- Key points (bullet points)
- Main themes
- Important details to remember
- Suggested follow-up questions`,
        
        draft_email: `\n\nThe user wants you to draft an email. Create a professional email with:
- Clear subject line suggestion
- Appropriate greeting
- Concise, well-structured body
- Clear call-to-action
- Professional closing
Format the email clearly so they can copy it.`,
        
        generate_outline: `\n\nThe user wants you to create an outline. Provide:
- Main sections with headers
- Sub-points under each section
- Logical flow and structure
- Estimated time or length for each section if relevant`,
        
        create_subtasks: `\n\nThe user wants you to break down the task. Create:
- Clear, actionable subtasks
- Logical order of execution
- Estimated time for each (if possible)
- Dependencies between tasks
Format as a numbered list they can follow.`,
        
        quiz: `\n\nThe user wants to be quizzed. Create an engaging quiz:
- Start with easier questions, progress to harder
- Mix question types (multiple choice, short answer, explain)
- Provide encouraging feedback
- After they answer, explain the correct answer
- Track their score and progress`,
        
        general: '',
      };
      
      enhancedSystemPrompt += actionInstructions[requestedAction] || '';
    }

    // Add context about current state
    if (agentContext.documents && agentContext.documents.length > 0) {
      enhancedSystemPrompt += `\n\nAvailable Documents:\n${agentContext.documents.map(d => `- ${d.name}${d.summary ? `: ${d.summary}` : ''}`).join('\n')}`;
    }
    
    if (agentContext.subtasks && agentContext.subtasks.length > 0) {
      const pending = agentContext.subtasks.filter(s => s.status === 'pending').length;
      const completed = agentContext.subtasks.filter(s => s.status === 'completed').length;
      enhancedSystemPrompt += `\n\nCurrent Subtasks (${completed}/${agentContext.subtasks.length} completed):\n${agentContext.subtasks.map(s => `- [${s.status === 'completed' ? 'x' : ' '}] ${s.title}`).join('\n')}`;
    }

    // Build messages
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: enhancedSystemPrompt },
      ...conversationHistory.slice(-15).map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user', content: message },
    ];

    const completion = await client.chat.completions.create({
      model: 'gpt-5',
      messages,
      temperature: 0.7,
      max_tokens: 1500,
    });

    const responseContent = completion.choices[0]?.message?.content || 
      "I'm here to help! Could you tell me more about what you need?";

    // Generate contextual suggestions
    const suggestions = generateSuggestions(message, responseContent, agentContext);

    // Detect if response contains actionable items
    const detectedActions = detectActions(responseContent);

    return NextResponse.json({
      success: true,
      response: {
        id: `msg-${Date.now()}`,
        role: 'agent',
        content: responseContent,
        timestamp: new Date().toISOString(),
        suggestions,
        detectedActions,
      },
    });

  } catch (error) {
    console.error('Sub-agent chat error:', error);
    return NextResponse.json(
      { error: 'Failed to generate response', details: String(error) },
      { status: 500 }
    );
  }
}

function generateSuggestions(
  userMessage: string,
  agentResponse: string,
  context: SubAgentRequest['agentContext']
): string[] {
  const suggestions: string[] = [];
  const lowerResponse = agentResponse.toLowerCase();
  const lowerMessage = userMessage.toLowerCase();

  // Based on response content
  if (lowerResponse.includes('outline') || lowerResponse.includes('structure')) {
    suggestions.push('Expand on this section');
  }
  if (lowerResponse.includes('draft') || lowerResponse.includes('email')) {
    suggestions.push('Make it more formal');
    suggestions.push('Make it shorter');
  }
  if (lowerResponse.includes('question')) {
    suggestions.push('Answer the question');
  }
  if (lowerResponse.includes('subtask') || lowerResponse.includes('step')) {
    suggestions.push('Start the first subtask');
  }

  // Based on context
  if (context.documents && context.documents.length > 0 && !lowerMessage.includes('summarize')) {
    suggestions.push('Summarize my documents');
  }
  if (context.phase === 'onboarding') {
    suggestions.push('Let\'s get started');
  }
  if (context.role === 'lecture') {
    suggestions.push('Quiz me on this');
  }
  if (context.role === 'email') {
    suggestions.push('Draft another version');
  }

  // Default suggestions
  if (suggestions.length < 2) {
    suggestions.push('What should I do next?');
    suggestions.push('Help me with something else');
  }

  return [...new Set(suggestions)].slice(0, 3);
}

function detectActions(response: string): string[] {
  const actions: string[] = [];
  const lower = response.toLowerCase();

  if (lower.includes('subject:') || lower.includes('dear ') || lower.includes('hi ')) {
    if (lower.includes('best regards') || lower.includes('sincerely') || lower.includes('thanks,')) {
      actions.push('email_drafted');
    }
  }
  if (lower.match(/^\d+\.\s/m) || lower.match(/^-\s/m)) {
    if (lower.includes('step') || lower.includes('task')) {
      actions.push('subtasks_suggested');
    }
    if (lower.includes('outline') || lower.includes('section')) {
      actions.push('outline_generated');
    }
  }
  if (lower.includes('```')) {
    actions.push('code_generated');
  }

  return actions;
}
