import { NextRequest, NextResponse } from 'next/server';
import type { DebugRequest, DebugResult, DiffLine, CodeHealthScore, ProgrammingLanguage } from '@/lib/types';

// OpenRouter API configuration
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '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';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Retry helper with exponential backoff
async function callOpenRouterWithRetry(body: object, retries = 5): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000); // 90 second timeout
      
      const response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://smart-debugger.vercel.app',
          'X-Title': 'Smart AI Debugger',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) return response;
      
      // Handle rate limiting with exponential backoff
      if (response.status === 429 && i < retries - 1) {
        const waitTime = Math.min((i + 1) * 3000, 15000);
        console.log(`Rate limited, waiting ${waitTime}ms before retry ${i + 1}/${retries}`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      // Handle server errors with retry
      if (response.status >= 500 && i < retries - 1) {
        const waitTime = (i + 1) * 2000;
        console.log(`Server error ${response.status}, waiting ${waitTime}ms before retry ${i + 1}/${retries}`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      // For other errors, try to get error details
      const errorData = await response.json().catch(() => ({}));
      console.error('OpenRouter API error:', errorData);
      
      if (response.status === 401) {
        throw new Error('Invalid API key. Please check your OpenRouter API key.');
      }
      
      return response;
    } catch (error) {
      lastError = error as Error;
      if ((error as Error).name === 'AbortError') {
        throw new Error('Request timeout - the code analysis is taking too long. Please try with smaller code.');
      }
      if (i < retries - 1) {
        const waitTime = (i + 1) * 2000;
        console.log(`Network error, waiting ${waitTime}ms before retry ${i + 1}/${retries}`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}

function detectLanguage(code: string): ProgrammingLanguage {
  // Enhanced patterns with weights for better detection
  const patterns: Record<ProgrammingLanguage, { pattern: RegExp; weight: number }[]> = {
    python: [
      { pattern: /\bdef\s+\w+\s*\(/, weight: 3 },
      { pattern: /\bprint\s*\([^)]*\)/, weight: 2 },
      { pattern: /^import\s+\w+/m, weight: 2 },
      { pattern: /^from\s+\w+\s+import/m, weight: 3 },
      { pattern: /:\s*$/m, weight: 1 },
      { pattern: /\bself\./, weight: 3 },
      { pattern: /\bif\s+__name__\s*==\s*['"]__main__['"]/, weight: 5 },
      { pattern: /\bclass\s+\w+.*:/, weight: 2 },
      { pattern: /\belif\s+/, weight: 3 },
      { pattern: /\bTrue\b|\bFalse\b|\bNone\b/, weight: 2 },
    ],
    javascript: [
      { pattern: /\bconst\s+\w+\s*=/, weight: 2 },
      { pattern: /\blet\s+\w+\s*=/, weight: 2 },
      { pattern: /\bfunction\s+\w+\s*\(/, weight: 2 },
      { pattern: /=>\s*[{(]/, weight: 3 },
      { pattern: /console\.log\s*\(/, weight: 3 },
      { pattern: /\bvar\s+\w+\s*=/, weight: 1 },
      { pattern: /\brequire\s*\(['"]/, weight: 2 },
      { pattern: /\bmodule\.exports/, weight: 3 },
      { pattern: /===|!==/, weight: 1 },
      { pattern: /\.then\s*\(/, weight: 2 },
    ],
    typescript: [
      { pattern: /:\s*(string|number|boolean|any|void)\b/, weight: 4 },
      { pattern: /\binterface\s+\w+\s*{/, weight: 4 },
      { pattern: /\btype\s+\w+\s*=/, weight: 4 },
      { pattern: /<\w+>/, weight: 2 },
      { pattern: /\bas\s+\w+/, weight: 3 },
      { pattern: /\benum\s+\w+/, weight: 4 },
      { pattern: /:\s*\w+\[\]/, weight: 3 },
      { pattern: /\bReadonly</, weight: 5 },
      { pattern: /\bPartial</, weight: 5 },
    ],
    java: [
      { pattern: /\bpublic\s+class\s+\w+/, weight: 5 },
      { pattern: /\bSystem\.out\.print/, weight: 5 },
      { pattern: /\bpublic\s+static\s+void\s+main/, weight: 6 },
      { pattern: /\bimport\s+java\./, weight: 4 },
      { pattern: /\bprivate\s+(int|String|boolean|double|float)/, weight: 4 },
      { pattern: /\bextends\s+\w+/, weight: 2 },
      { pattern: /\bimplements\s+\w+/, weight: 3 },
      { pattern: /\bnew\s+\w+\s*\(/, weight: 1 },
      { pattern: /@Override/, weight: 4 },
      { pattern: /\bArrayList</, weight: 4 },
      { pattern: /\.length\b/, weight: 1 },
      { pattern: /\bvoid\s+\w+\s*\(/, weight: 2 },
    ],
    c: [
      { pattern: /#include\s*<stdio\.h>/, weight: 5 },
      { pattern: /#include\s*<stdlib\.h>/, weight: 4 },
      { pattern: /\bint\s+main\s*\(/, weight: 3 },
      { pattern: /\bprintf\s*\(/, weight: 4 },
      { pattern: /\bscanf\s*\(/, weight: 4 },
      { pattern: /\bmalloc\s*\(/, weight: 4 },
      { pattern: /\bfree\s*\(/, weight: 3 },
      { pattern: /\bstruct\s+\w+\s*{/, weight: 2 },
    ],
    cpp: [
      { pattern: /#include\s*<iostream>/, weight: 5 },
      { pattern: /\bcout\s*<</, weight: 5 },
      { pattern: /\bcin\s*>>/, weight: 5 },
      { pattern: /\busing\s+namespace\s+std/, weight: 5 },
      { pattern: /\bstd::/, weight: 4 },
      { pattern: /#include\s*<vector>/, weight: 4 },
      { pattern: /#include\s*<string>/, weight: 3 },
      { pattern: /\bclass\s+\w+\s*{/, weight: 2 },
    ],
    csharp: [
      { pattern: /\busing\s+System/, weight: 5 },
      { pattern: /\bnamespace\s+\w+/, weight: 4 },
      { pattern: /\bConsole\.Write/, weight: 5 },
      { pattern: /\bpublic\s+class\s+\w+/, weight: 3 },
      { pattern: /\bstring\[\]\s+args/, weight: 4 },
      { pattern: /\bvar\s+\w+\s*=/, weight: 1 },
    ],
    go: [
      { pattern: /\bpackage\s+\w+/, weight: 5 },
      { pattern: /\bfunc\s+\w+/, weight: 3 },
      { pattern: /\bfmt\.Print/, weight: 5 },
      { pattern: /\bimport\s+"/, weight: 3 },
      { pattern: /:=/, weight: 4 },
      { pattern: /\bgo\s+\w+/, weight: 4 },
      { pattern: /\bdefer\s+/, weight: 4 },
    ],
    rust: [
      { pattern: /\bfn\s+\w+/, weight: 3 },
      { pattern: /\blet\s+mut\s+/, weight: 5 },
      { pattern: /\bprintln!\s*\(/, weight: 5 },
      { pattern: /\bimpl\s+\w+/, weight: 4 },
      { pattern: /\b->\s*\w+/, weight: 3 },
      { pattern: /\buse\s+std::/, weight: 4 },
      { pattern: /\bOption</, weight: 4 },
      { pattern: /\bResult</, weight: 4 },
    ],
    php: [
      { pattern: /<\?php/, weight: 6 },
      { pattern: /\$\w+\s*=/, weight: 3 },
      { pattern: /\becho\s+/, weight: 3 },
      { pattern: /\bfunction\s+\w+\s*\(/, weight: 1 },
      { pattern: /->/, weight: 1 },
      { pattern: /\$this->/, weight: 3 },
    ],
    ruby: [
      { pattern: /\bdef\s+\w+/, weight: 2 },
      { pattern: /\bputs\s+/, weight: 4 },
      { pattern: /\bend\s*$/m, weight: 2 },
      { pattern: /\brequire\s+['"]/, weight: 3 },
      { pattern: /\battr_accessor/, weight: 5 },
      { pattern: /\bdo\s*\|/, weight: 3 },
    ],
    swift: [
      { pattern: /\bvar\s+\w+\s*:/, weight: 3 },
      { pattern: /\bfunc\s+\w+/, weight: 2 },
      { pattern: /\bprint\s*\(/, weight: 1 },
      { pattern: /\blet\s+\w+\s*:/, weight: 3 },
      { pattern: /\bguard\s+let/, weight: 5 },
      { pattern: /\bif\s+let/, weight: 4 },
    ],
    kotlin: [
      { pattern: /\bfun\s+\w+/, weight: 3 },
      { pattern: /\bval\s+\w+/, weight: 3 },
      { pattern: /\bvar\s+\w+/, weight: 2 },
      { pattern: /\bprintln\s*\(/, weight: 2 },
      { pattern: /\bdata\s+class/, weight: 5 },
      { pattern: /\bobject\s+\w+/, weight: 4 },
    ],
    sql: [
      { pattern: /\bSELECT\s+/i, weight: 3 },
      { pattern: /\bFROM\s+/i, weight: 2 },
      { pattern: /\bWHERE\s+/i, weight: 2 },
      { pattern: /\bINSERT\s+INTO/i, weight: 3 },
      { pattern: /\bCREATE\s+TABLE/i, weight: 4 },
      { pattern: /\bJOIN\s+/i, weight: 3 },
    ],
    auto: [],
  };

  let maxScore = 0;
  let detectedLang: ProgrammingLanguage = 'auto';

  for (const [lang, patternList] of Object.entries(patterns)) {
    if (lang === 'auto') continue;
    let score = 0;
    for (const { pattern, weight } of patternList) {
      if (pattern.test(code)) {
        score += weight;
      }
    }
    if (score > maxScore) {
      maxScore = score;
      detectedLang = lang as ProgrammingLanguage;
    }
  }

  return detectedLang === 'auto' ? 'javascript' : detectedLang;
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

  score = Math.max(0, Math.min(100, score));
  
  const totalIssues = errorCount + warningCount + optimizationCount;
  
  if (totalIssues === 0) {
    return {
      score: 100,
      correct: 100,
      errors: 0,
      warnings: 0,
      optimizations: 0,
    };
  }

  const correctPortion = score;
  const issuesPortion = 100 - score;
  
  const errorPercent = totalIssues > 0 ? Math.round((errorCount / totalIssues) * issuesPortion) : 0;
  const warningPercent = totalIssues > 0 ? Math.round((warningCount / totalIssues) * issuesPortion) : 0;
  const optimizationPercent = totalIssues > 0 ? Math.round((optimizationCount / totalIssues) * issuesPortion) : 0;
  
  const total = correctPortion + errorPercent + warningPercent + optimizationPercent;
  const adjustment = 100 - total;
  
  return {
    score,
    correct: correctPortion + adjustment,
    errors: errorPercent,
    warnings: warningPercent,
    optimizations: optimizationPercent,
  };
}

function cleanCorrectedCode(code: string): string {
  if (!code) return '';
  
  let cleaned = code.trim();
  
  const codeBlockRegex = /^```[\w]*\n?([\s\S]*?)\n?```$/;
  const match = cleaned.match(codeBlockRegex);
  if (match) {
    cleaned = match[1].trim();
  }
  
  if (cleaned.startsWith('```')) {
    const lines = cleaned.split('\n');
    if (lines[0].match(/^```\w*$/)) {
      lines.shift();
    }
    if (lines[lines.length - 1] === '```') {
      lines.pop();
    }
    cleaned = lines.join('\n');
  }
  
  return cleaned.trim();
}

// Validate and clean YouTube links
function validateYoutubeLinks(links: string[]): string[] {
  if (!Array.isArray(links)) return [];
  
  const validLinks: string[] = [];
  const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/;
  
  for (const link of links) {
    if (typeof link !== 'string') continue;
    if (link.includes('IMPORTANT:') || link.includes('VIDEO_ID') || link.includes('Provide')) continue;
    
    const match = link.match(youtubeRegex);
    if (match) {
      const videoId = match[4];
      validLinks.push(`https://www.youtube.com/watch?v=${videoId}`);
    }
  }
  
  return validLinks.slice(0, 5);
}

// Validate documentation links
function validateDocLinks(links: string[], language: ProgrammingLanguage): string[] {
  if (!Array.isArray(links)) return [];
  
  const validLinks: string[] = [];
  const docDomains: Record<string, string[]> = {
    python: ['docs.python.org', 'realpython.com', 'python.org'],
    javascript: ['developer.mozilla.org', 'javascript.info', 'nodejs.org', 'ecma-international.org'],
    typescript: ['typescriptlang.org', 'developer.mozilla.org'],
    java: ['docs.oracle.com', 'dev.java', 'openjdk.org'],
    c: ['en.cppreference.com', 'devdocs.io', 'gnu.org'],
    cpp: ['en.cppreference.com', 'isocpp.org', 'cplusplus.com'],
    csharp: ['docs.microsoft.com', 'learn.microsoft.com'],
    go: ['go.dev', 'golang.org', 'pkg.go.dev'],
    rust: ['doc.rust-lang.org', 'rust-lang.org', 'docs.rs'],
    php: ['php.net', 'phpdoc.org'],
    ruby: ['ruby-doc.org', 'ruby-lang.org'],
    swift: ['developer.apple.com', 'swift.org'],
    kotlin: ['kotlinlang.org', 'developer.android.com'],
    sql: ['w3schools.com', 'postgresql.org', 'mysql.com', 'sqlite.org'],
  };
  
  for (const link of links) {
    if (typeof link !== 'string') continue;
    if (link.includes('Provide') || link.includes('REAL')) continue;
    
    try {
      const url = new URL(link.startsWith('http') ? link : `https://${link}`);
      const isValidDomain = docDomains[language]?.some(domain => url.hostname.includes(domain)) ||
                           url.hostname.includes('developer.') ||
                           url.hostname.includes('docs.') ||
                           url.hostname.includes('devdocs.io') ||
                           url.hostname.includes('stackoverflow.com');
      if (isValidDomain) {
        validLinks.push(url.href);
      }
    } catch {
      // Invalid URL, skip
    }
  }
  
  return validLinks.slice(0, 4);
}

function generateDiff(original: string, corrected: string): DiffLine[] {
  const cleanOriginal = original.trim();
  const cleanCorrected = cleanCorrectedCode(corrected);
  
  if (cleanOriginal === cleanCorrected) {
    return cleanOriginal.split('\n').map((line, i) => ({
      type: 'unchanged' as const,
      content: line,
      lineNumber: i + 1,
    }));
  }
  
  const originalLines = cleanOriginal.split('\n');
  const correctedLines = cleanCorrected.split('\n');
  const diff: DiffLine[] = [];
  
  let origIndex = 0;
  let corrIndex = 0;
  
  while (origIndex < originalLines.length || corrIndex < correctedLines.length) {
    const origLine = originalLines[origIndex] || '';
    const corrLine = correctedLines[corrIndex] || '';
    
    if (origIndex >= originalLines.length) {
      diff.push({ type: 'added', content: corrLine, lineNumber: corrIndex + 1 });
      corrIndex++;
    } else if (corrIndex >= correctedLines.length) {
      diff.push({ type: 'removed', content: origLine, lineNumber: origIndex + 1 });
      origIndex++;
    } else if (origLine.trim() === corrLine.trim()) {
      diff.push({ type: 'unchanged', content: corrLine, lineNumber: corrIndex + 1 });
      origIndex++;
      corrIndex++;
    } else {
      const foundInCorrected = correctedLines.slice(corrIndex + 1, corrIndex + 5).findIndex(l => l.trim() === origLine.trim());
      const foundInOriginal = originalLines.slice(origIndex + 1, origIndex + 5).findIndex(l => l.trim() === corrLine.trim());
      
      if (foundInCorrected >= 0 && (foundInOriginal < 0 || foundInCorrected <= foundInOriginal)) {
        diff.push({ type: 'added', content: corrLine, lineNumber: corrIndex + 1 });
        corrIndex++;
      } else if (foundInOriginal >= 0) {
        diff.push({ type: 'removed', content: origLine, lineNumber: origIndex + 1 });
        origIndex++;
      } else {
        diff.push({ type: 'removed', content: origLine, lineNumber: origIndex + 1 });
        diff.push({ type: 'added', content: corrLine, lineNumber: corrIndex + 1 });
        origIndex++;
        corrIndex++;
      }
    }
  }
  
  return diff;
}

export async function POST(request: NextRequest) {
  try {
    const body: DebugRequest = await request.json();
    const { code, language, explanationLanguage, userLevel, learningMode } = body;

    if (!code || code.trim().length === 0) {
      return NextResponse.json(
        { error: 'Please provide code to debug.' },
        { status: 400 }
      );
    }

    const detectedLang = language === 'auto' ? detectLanguage(code) : language;

    const prompt = `You are an expert AI debugging assistant with deep knowledge of ${detectedLang}. Carefully analyze the following code line by line and provide comprehensive debugging assistance.

IMPORTANT INSTRUCTIONS:
1. Analyze EVERY line of code thoroughly, even if the code is large
2. Look for ALL types of errors: syntax errors, runtime errors, logical errors, type errors, edge cases, bad practices
3. For large code, systematically check each function/block
4. Be thorough - don't miss any issues

CODE TO DEBUG (${code.split('\n').length} lines):
\`\`\`${detectedLang}
${code}
\`\`\`

USER LEVEL: ${userLevel}
EXPLANATION LANGUAGE: ${explanationLanguage}
LEARNING MODE: ${learningMode}

Please provide your response in the following JSON format (respond ONLY with valid JSON, no markdown):
{
  "intent": "What the code is trying to accomplish (be specific about the algorithm/functionality)",
  "actualBehavior": "What the code actually does (describe the current behavior in detail)",
  "error": "Description of what went wrong (or 'No errors found - code is correct' if no issues). Be specific about the error type and location",
  "explanation": "Detailed explanation based on user level (${userLevel}) - ${userLevel === 'beginner' ? 'Use simple language, no jargon, explain like talking to a student' : userLevel === 'intermediate' ? 'Use technical terms with clear explanations' : 'Deep technical explanation with compiler-level reasoning, memory management details, and performance implications'}",
  "rootCause": "The fundamental reason for the error - explain WHY the code fails, not just WHAT is wrong",
  "learning": {
    "whyItHappened": "Detailed explanation of why this specific error occurred in this context",
    "whenItHappens": "Common scenarios and patterns where this type of error occurs",
    "howToAvoid": "Best practices and coding patterns to prevent this error in the future",
    "concept": "The underlying programming concept (e.g., variable scope, memory management, async/await, etc.)"
  },
  "mentalModel": "A clear analogy or mental model to understand this concept (use real-world examples)",
  "teacherMode": "Step-by-step teaching explanation with examples - explain as if teaching a class",
  "thinkMode": "Socratic questions to guide the user to understand the error themselves (3-5 thought-provoking questions)",
  "conceptBuilder": "Focus on the core programming concept behind the error - explain the theory",
  "debugTrace": "Step-by-step execution trace showing variable values at each step (format: Line X: variable = value)",
  "interviewMode": "How to explain this error and its fix in a technical interview (include what interviewer expects to hear)",
  "challengeMode": "Progressive hints for the user to solve it themselves (Hint 1: vague, Hint 2: more specific, Hint 3: almost gives it away)",
  "generalization": "How this error pattern applies to other programming scenarios and languages",
  "resources": {
    "youtubeLinks": [
      "Provide 2-4 REAL YouTube video URLs that teach this concept from channels like: freeCodeCamp, Traversy Media, Programming with Mosh, CS Dojo, Corey Schafer, Web Dev Simplified, Fireship"
    ],
    "documentationLinks": [
      "Provide 2-3 REAL official documentation links for ${detectedLang} related to this error/concept"
    ]
  },
  "errors": [
    {"type": "syntax|runtime|logical|warning|bad_practice", "line": 1, "message": "detailed error description with fix suggestion"}
  ],
  "correctedCode": "The complete fixed version of the code with ALL errors corrected. Preserve the original structure and add helpful comments where you made changes."
}`;

    // Calculate dynamic max tokens based on code size
    const codeLength = code.length;
    const baseTokens = 8192;
    const additionalTokens = Math.min(Math.floor(codeLength / 100) * 500, 8000);
    const maxTokens = baseTokens + additionalTokens;

    // Use OpenRouter API with retry logic
    const requestBody = {
      model: 'google/gemini-2.0-flash-001',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: maxTokens,
    };

    const response = await callOpenRouterWithRetry(requestBody);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('OpenRouter API error:', errorData);
      
      if (response.status === 401) {
        return NextResponse.json(
          { error: 'Invalid API key. Please check your OpenRouter API key.' },
          { status: 401 }
        );
      }
      
      return NextResponse.json(
        { error: 'AI service error. Please try again.' },
        { status: response.status }
      );
    }

    const data = await response.json();
    const responseText = data.choices?.[0]?.message?.content || '';

    // Parse JSON response
    let parsedResult;
    try {
      // Clean up the response - remove markdown code blocks if present
      let cleanedResponse = responseText.trim();
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.slice(7);
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.slice(3);
      }
      if (cleanedResponse.endsWith('```')) {
        cleanedResponse = cleanedResponse.slice(0, -3);
      }
      cleanedResponse = cleanedResponse.trim();
      
      parsedResult = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      console.error('Raw response:', responseText.substring(0, 500));
      return NextResponse.json(
        { error: 'Failed to parse AI response. Please try again.' },
        { status: 500 }
      );
    }

    // Generate diff and health score
    const diff = generateDiff(code, parsedResult.correctedCode || code);
    const errors = parsedResult.errors || [];
    const codeHealth = calculateCodeHealth(errors);

    const debugResult: DebugResult = {
      intent: parsedResult.intent || 'Unable to determine intent',
      actualBehavior: parsedResult.actualBehavior || 'Unable to determine behavior',
      error: parsedResult.error || 'No errors found',
      explanation: parsedResult.explanation || 'No explanation available',
      rootCause: parsedResult.rootCause || 'Unable to determine root cause',
      learning: parsedResult.learning || {
        whyItHappened: 'Not available',
        whenItHappens: 'Not available',
        howToAvoid: 'Not available',
        concept: 'Not available',
      },
      mentalModel: parsedResult.mentalModel || 'No mental model available',
      teacherMode: parsedResult.teacherMode || 'No teacher mode explanation available',
      thinkMode: parsedResult.thinkMode || 'No think mode questions available',
      conceptBuilder: parsedResult.conceptBuilder || 'No concept builder available',
      debugTrace: parsedResult.debugTrace || 'No debug trace available',
      interviewMode: parsedResult.interviewMode || 'No interview mode explanation available',
      challengeMode: parsedResult.challengeMode || 'No challenge mode hints available',
      generalization: parsedResult.generalization || 'No generalization available',
      resources: {
        youtubeLinks: validateYoutubeLinks(parsedResult.resources?.youtubeLinks || []),
        documentationLinks: validateDocLinks(parsedResult.resources?.documentationLinks || [], detectedLang),
      },
      errors: errors,
      correctedCode: cleanCorrectedCode(parsedResult.correctedCode || code),
      diff: diff,
      codeHealth: codeHealth,
      detectedLanguage: detectedLang,
    };

    return NextResponse.json(debugResult);
  } catch (error) {
    console.error('Debug API error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Handle API key errors
    if (errorMessage.includes('API key') || errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
      return NextResponse.json(
        { error: 'API key error. The service is temporarily unavailable. Please try again later.' },
        { status: 401 }
      );
    }
    
    if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
      return NextResponse.json(
        { error: 'The code analysis is taking too long. Please try with smaller code or try again.' },
        { status: 504 }
      );
    }
    
    if (errorMessage.includes('parse') || errorMessage.includes('JSON')) {
      return NextResponse.json(
        { error: 'Failed to process AI response. Please try again.' },
        { status: 500 }
      );
    }
    
    if (errorMessage.includes('rate') || errorMessage.includes('limit') || errorMessage.includes('429')) {
      return NextResponse.json(
        { error: 'The AI service is currently busy. Please wait a moment and try again.' },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to debug code. Please try again.' },
      { status: 500 }
    );
  }
}
