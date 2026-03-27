import { NextRequest, NextResponse } from 'next/server';
import type { DebugRequest, DebugResult, DiffLine, CodeHealthScore, ProgrammingLanguage } from '@/lib/types';

const OPENROUTER_API_KEY = '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';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

async function callOpenRouterWithRetry(body: object, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://v0.dev',
        'X-Title': 'AI Debug Assistant',
      },
      body: JSON.stringify(body),
    });
    
    if (response.ok) return response;
    
    if (response.status === 429 && i < retries - 1) {
      await new Promise(resolve => setTimeout(resolve, (i + 1) * 2000));
      continue;
    }
    
    return response;
  }
  throw new Error('Max retries exceeded');
}

function detectLanguage(code: string): ProgrammingLanguage {
  const patterns: Record<ProgrammingLanguage, RegExp[]> = {
    python: [/\bdef\s+\w+\s*\(/, /\bprint\s*\(/, /\bimport\s+\w+/, /:\s*$/m, /\bself\./],
    javascript: [/\bconst\s+\w+/, /\blet\s+\w+/, /\bfunction\s+\w+/, /=>\s*{/, /console\.log/],
    typescript: [/:\s*(string|number|boolean|any)/, /interface\s+\w+/, /type\s+\w+\s*=/, /<\w+>/],
    java: [/\bpublic\s+class/, /\bSystem\.out\.print/, /\bpublic\s+static\s+void\s+main/, /\bimport\s+java\./],
    c: [/\b#include\s*</, /\bint\s+main\s*\(/, /\bprintf\s*\(/, /\bscanf\s*\(/],
    cpp: [/\b#include\s*<iostream>/, /\bcout\s*<</, /\bcin\s*>>/, /\busing\s+namespace\s+std/],
    csharp: [/\busing\s+System/, /\bnamespace\s+\w+/, /\bConsole\.Write/],
    go: [/\bpackage\s+\w+/, /\bfunc\s+\w+/, /\bfmt\.Print/],
    rust: [/\bfn\s+\w+/, /\blet\s+mut/, /\bprintln!\s*\(/],
    php: [/<\?php/, /\$\w+\s*=/, /\becho\s+/],
    ruby: [/\bdef\s+\w+/, /\bputs\s+/, /\bend\s*$/m, /\brequire\s+['"]/],
    swift: [/\bvar\s+\w+:/, /\bfunc\s+\w+/, /\bprint\s*\(/],
    kotlin: [/\bfun\s+\w+/, /\bval\s+\w+/, /\bprintln\s*\(/],
    sql: [/\bSELECT\s+/i, /\bFROM\s+/i, /\bWHERE\s+/i, /\bINSERT\s+INTO/i],
    auto: [],
  };

  let maxScore = 0;
  let detectedLang: ProgrammingLanguage = 'auto';

  for (const [lang, regexes] of Object.entries(patterns)) {
    if (lang === 'auto') continue;
    const score = regexes.filter(regex => regex.test(code)).length;
    if (score > maxScore) {
      maxScore = score;
      detectedLang = lang as ProgrammingLanguage;
    }
  }

  return detectedLang === 'auto' ? 'python' : detectedLang;
}

function calculateCodeHealth(errors: { type: string }[]): CodeHealthScore {
  let score = 100;
  let errorCount = 0;
  let warningCount = 0;
  let optimizationCount = 0;

  for (const error of errors) {
    switch (error.type) {
      case 'syntax':
        score -= 30;
        errorCount++;
        break;
      case 'runtime':
        score -= 25;
        errorCount++;
        break;
      case 'logical':
        score -= 20;
        errorCount++;
        break;
      case 'warning':
        score -= 10;
        warningCount++;
        break;
      case 'bad_practice':
        score -= 5;
        optimizationCount++;
        break;
    }
  }

  score = Math.max(0, score);
  const total = errorCount + warningCount + optimizationCount + 1;
  const correct = Math.round((score / 100) * 100);

  return {
    score,
    correct,
    errors: Math.round((errorCount / total) * 100),
    warnings: Math.round((warningCount / total) * 100),
    optimizations: Math.round((optimizationCount / total) * 100),
  };
}

function generateDiff(original: string, corrected: string): DiffLine[] {
  const originalLines = original.split('\n');
  const correctedLines = corrected.split('\n');
  const diff: DiffLine[] = [];
  
  const maxLen = Math.max(originalLines.length, correctedLines.length);
  
  for (let i = 0; i < maxLen; i++) {
    const origLine = originalLines[i] || '';
    const corrLine = correctedLines[i] || '';
    
    if (i >= originalLines.length) {
      diff.push({ type: 'added', content: corrLine, lineNumber: i + 1 });
    } else if (i >= correctedLines.length) {
      diff.push({ type: 'removed', content: origLine, lineNumber: i + 1 });
    } else if (origLine !== corrLine) {
      if (origLine.trim()) {
        diff.push({ type: 'removed', content: origLine, lineNumber: i + 1 });
      }
      if (corrLine.trim()) {
        diff.push({ type: 'added', content: corrLine, lineNumber: i + 1 });
      }
    } else {
      diff.push({ type: 'unchanged', content: origLine, lineNumber: i + 1 });
    }
  }
  
  return diff;
}

export async function POST(request: NextRequest) {
  try {
    const body: DebugRequest = await request.json();
    const { code, language, explanationLanguage, userLevel, learningMode } = body;

    const detectedLang = language === 'auto' ? detectLanguage(code) : language;

    const prompt = `You are an expert AI debugging assistant. Analyze the following ${detectedLang} code and provide comprehensive debugging assistance.

CODE TO DEBUG:
\`\`\`${detectedLang}
${code}
\`\`\`

USER LEVEL: ${userLevel}
EXPLANATION LANGUAGE: ${explanationLanguage}
LEARNING MODE: ${learningMode}

Please provide your response in the following JSON format (respond ONLY with valid JSON, no markdown):
{
  "intent": "What the code is trying to accomplish",
  "actualBehavior": "What the code actually does",
  "error": "Description of what went wrong (or 'No errors found' if code is correct)",
  "explanation": "Detailed explanation based on user level (${userLevel}) - ${userLevel === 'beginner' ? 'Use simple language, no jargon' : userLevel === 'intermediate' ? 'Use some technical terms with explanations' : 'Deep technical explanation with compiler-level reasoning'}",
  "rootCause": "The fundamental reason for the error",
  "learning": {
    "whyItHappened": "Why this error occurred",
    "whenItHappens": "Common scenarios where this error occurs",
    "howToAvoid": "Best practices to prevent this error",
    "concept": "The underlying programming concept"
  },
  "mentalModel": "An analogy or mental model to understand this better",
  "teacherMode": "Step-by-step teaching explanation with examples",
  "thinkMode": "Socratic questions to guide the user to understand the error themselves",
  "conceptBuilder": "Focus on the core concept behind the error",
  "debugTrace": "Step-by-step execution flow with variable values",
  "interviewMode": "How to explain this in a technical interview",
  "challengeMode": "Hints for the user to solve it themselves (without giving the answer directly)",
  "generalization": "How this error pattern applies to other scenarios",
  "resources": {
    "youtubeLinks": ["Relevant YouTube video URLs for learning this concept"],
    "documentationLinks": ["Official documentation links for the programming language"]
  },
  "errors": [
    {"type": "syntax|runtime|logical|warning|bad_practice", "line": 1, "message": "error description"}
  ],
  "correctedCode": "The fixed version of the code"
}

${explanationLanguage !== 'english' ? `IMPORTANT: Provide all text explanations in ${explanationLanguage}. Keep code and technical terms in English.` : ''}

Respond with ONLY the JSON object, no additional text or markdown formatting.`;

    const requestBody = {
      model: 'google/gemini-2.0-flash-001',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 4096,
    };

    const response = await callOpenRouterWithRetry(requestBody);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error:', errorText);
      
      if (response.status === 429) {
        return NextResponse.json(
          { error: 'API rate limit exceeded. Please wait a moment and try again.' },
          { status: 429 }
        );
      }
      
      if (response.status === 401) {
        return NextResponse.json(
          { error: 'Invalid API key. Please check your OpenRouter API key.' },
          { status: 401 }
        );
      }
      
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    const textContent = data.choices?.[0]?.message?.content || '';
    
    // Clean the response - remove markdown code blocks if present
    let cleanedContent = textContent.trim();
    if (cleanedContent.startsWith('```json')) {
      cleanedContent = cleanedContent.slice(7);
    } else if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent.slice(3);
    }
    if (cleanedContent.endsWith('```')) {
      cleanedContent = cleanedContent.slice(0, -3);
    }
    cleanedContent = cleanedContent.trim();

    let parsedResult;
    try {
      parsedResult = JSON.parse(cleanedContent);
    } catch {
      console.error('Failed to parse OpenRouter response:', cleanedContent);
      throw new Error('Failed to parse AI response');
    }

    const codeHealth = calculateCodeHealth(parsedResult.errors || []);
    const diffView = generateDiff(code, parsedResult.correctedCode || code);

    const result: DebugResult = {
      intent: parsedResult.intent || 'Unable to determine intent',
      actualBehavior: parsedResult.actualBehavior || 'Unable to determine behavior',
      error: parsedResult.error || 'No errors found',
      explanation: parsedResult.explanation || 'No explanation available',
      rootCause: parsedResult.rootCause || 'Unable to determine root cause',
      learning: {
        whyItHappened: parsedResult.learning?.whyItHappened || '',
        whenItHappens: parsedResult.learning?.whenItHappens || '',
        howToAvoid: parsedResult.learning?.howToAvoid || '',
        concept: parsedResult.learning?.concept || '',
      },
      mentalModel: parsedResult.mentalModel || '',
      teacherMode: parsedResult.teacherMode,
      thinkMode: parsedResult.thinkMode,
      conceptBuilder: parsedResult.conceptBuilder,
      debugTrace: parsedResult.debugTrace,
      interviewMode: parsedResult.interviewMode,
      challengeMode: parsedResult.challengeMode,
      generalization: parsedResult.generalization || '',
      resources: {
        youtubeLinks: parsedResult.resources?.youtubeLinks || [],
        documentationLinks: parsedResult.resources?.documentationLinks || [],
      },
      codeHealth,
      correctedCode: parsedResult.correctedCode || code,
      diffView,
      detectedLanguage: detectedLang,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Debug API error:', error);
    return NextResponse.json(
      { error: 'Failed to debug code. Please try again.' },
      { status: 500 }
    );
  }
}
