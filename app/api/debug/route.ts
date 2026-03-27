import { NextRequest, NextResponse } from 'next/server';
import type { DebugRequest, DebugResult, DiffLine, CodeHealthScore, ProgrammingLanguage } from '@/lib/types';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyC07Ha41-6z6hFIj5J4G_xLmTNv4HDI3LY';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

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

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
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
      console.error('Failed to parse Gemini response:', cleanedContent);
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
