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
  
  // Calculate percentages that add up to exactly 100%
  const totalIssues = errorCount + warningCount + optimizationCount;
  
  if (totalIssues === 0) {
    // No issues - 100% correct
    return {
      score: 100,
      correct: 100,
      errors: 0,
      warnings: 0,
      optimizations: 0,
    };
  }

  // Calculate the "correct" portion based on score
  const correctPortion = score;
  const issuesPortion = 100 - score;
  
  // Distribute the issues portion among error types proportionally
  const errorPercent = totalIssues > 0 ? Math.round((errorCount / totalIssues) * issuesPortion) : 0;
  const warningPercent = totalIssues > 0 ? Math.round((warningCount / totalIssues) * issuesPortion) : 0;
  const optimizationPercent = totalIssues > 0 ? Math.round((optimizationCount / totalIssues) * issuesPortion) : 0;
  
  // Adjust for rounding errors to ensure total is exactly 100%
  const total = correctPortion + errorPercent + warningPercent + optimizationPercent;
  const adjustment = 100 - total;
  
  return {
    score,
    correct: correctPortion + adjustment, // Add any rounding adjustment to correct
    errors: errorPercent,
    warnings: warningPercent,
    optimizations: optimizationPercent,
  };
}

function cleanCorrectedCode(code: string): string {
  if (!code) return '';
  
  let cleaned = code.trim();
  
  // Remove markdown code fences with language identifiers
  const codeBlockRegex = /^```[\w]*\n?([\s\S]*?)\n?```$/;
  const match = cleaned.match(codeBlockRegex);
  if (match) {
    cleaned = match[1].trim();
  }
  
  // Also handle cases where only opening fence exists
  if (cleaned.startsWith('```')) {
    const lines = cleaned.split('\n');
    // Remove first line if it's a code fence
    if (lines[0].match(/^```\w*$/)) {
      lines.shift();
    }
    // Remove last line if it's a closing fence
    if (lines[lines.length - 1] === '```') {
      lines.pop();
    }
    cleaned = lines.join('\n');
  }
  
  return cleaned.trim();
}

function generateDiff(original: string, corrected: string): DiffLine[] {
  // Clean both codes for comparison
  const cleanOriginal = original.trim();
  const cleanCorrected = cleanCorrectedCode(corrected);
  
  // If codes are essentially the same, return all as unchanged
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
  
  // Use a simple LCS-based diff approach for better accuracy
  const maxLen = Math.max(originalLines.length, correctedLines.length);
  let origIndex = 0;
  let corrIndex = 0;
  
  while (origIndex < originalLines.length || corrIndex < correctedLines.length) {
    const origLine = originalLines[origIndex] || '';
    const corrLine = correctedLines[corrIndex] || '';
    
    if (origIndex >= originalLines.length) {
      // Only corrected lines left - these are additions
      diff.push({ type: 'added', content: corrLine, lineNumber: corrIndex + 1 });
      corrIndex++;
    } else if (corrIndex >= correctedLines.length) {
      // Only original lines left - these are removals
      diff.push({ type: 'removed', content: origLine, lineNumber: origIndex + 1 });
      origIndex++;
    } else if (origLine.trim() === corrLine.trim()) {
      // Lines match (ignoring whitespace)
      diff.push({ type: 'unchanged', content: corrLine, lineNumber: corrIndex + 1 });
      origIndex++;
      corrIndex++;
    } else {
      // Lines differ - check if it's a modification or insertion/deletion
      // Look ahead to see if the original line appears later in corrected
      const foundInCorrected = correctedLines.slice(corrIndex + 1, corrIndex + 5).findIndex(l => l.trim() === origLine.trim());
      const foundInOriginal = originalLines.slice(origIndex + 1, origIndex + 5).findIndex(l => l.trim() === corrLine.trim());
      
      if (foundInCorrected >= 0 && (foundInOriginal < 0 || foundInCorrected <= foundInOriginal)) {
        // Original line appears later - current corrected line is an addition
        diff.push({ type: 'added', content: corrLine, lineNumber: corrIndex + 1 });
        corrIndex++;
      } else if (foundInOriginal >= 0) {
        // Corrected line appears later - current original line is a removal
        diff.push({ type: 'removed', content: origLine, lineNumber: origIndex + 1 });
        origIndex++;
      } else {
        // Both lines are different - it's a modification
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

    const detectedLang = language === 'auto' ? detectLanguage(code) : language;

    // Calculate code length for better handling
    const codeLines = code.split('\n');
    const codeLength = codeLines.length;
    const isLongCode = codeLength > 50;

    const prompt = `You are an expert AI debugging assistant. Analyze the following ${detectedLang} code COMPLETELY and provide comprehensive debugging assistance.

IMPORTANT INSTRUCTIONS:
- This code has ${codeLength} lines. You MUST analyze EVERY SINGLE LINE carefully.
- Do NOT skip any part of the code, regardless of its length.
- Examine each line for potential errors, warnings, or bad practices.
- For long code, take your time to analyze thoroughly - completeness is more important than speed.

CODE TO DEBUG (${codeLength} lines):
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
  "debugTrace": "Step-by-step execution flow showing what happens at each important line with variable values",
  "interviewMode": "How to explain this in a technical interview",
  "challengeMode": "Hints for the user to solve it themselves (without giving the answer directly)",
  "generalization": "How this error pattern applies to other scenarios",
  "resources": {
    "youtubeSearchQueries": ["Provide 2-4 specific YouTube SEARCH QUERIES (not URLs) that would help find tutorials for this error. Example: 'Python function return statement tutorial', 'C binary search tree implementation'"],
    "documentationLinks": ["Official documentation links for the programming language related to this error"]
  },
  "errors": [
    {"type": "syntax|runtime|logical|warning|bad_practice", "line": <exact line number>, "message": "detailed error description for this specific line"}
  ],
  "correctedCode": "The COMPLETE fixed version of the code - include ALL ${codeLength} lines with corrections applied"
}

CRITICAL REQUIREMENTS:
1. The "errors" array MUST include ALL errors found in the code with their EXACT line numbers (1-indexed).
2. The "correctedCode" MUST be the COMPLETE fixed code - do NOT truncate or abbreviate it.
3. For "youtubeSearchQueries", provide helpful search terms users can use on YouTube to learn about the concepts. Do NOT provide actual URLs as they may be invalid.
4. Analyze every line from line 1 to line ${codeLength} - do not skip any section.

${explanationLanguage !== 'english' ? `
CRITICAL LANGUAGE INSTRUCTION: You MUST write ALL explanations, descriptions, and text content in ${explanationLanguage.toUpperCase()} language. This includes:
- "intent" field - write in ${explanationLanguage}
- "actualBehavior" field - write in ${explanationLanguage}
- "error" field - write in ${explanationLanguage}
- "explanation" field - write in ${explanationLanguage}
- "rootCause" field - write in ${explanationLanguage}
- All "learning" fields - write in ${explanationLanguage}
- "mentalModel" field - write in ${explanationLanguage}
- "teacherMode" field - write in ${explanationLanguage}
- "thinkMode" field - write in ${explanationLanguage}
- "conceptBuilder" field - write in ${explanationLanguage}
- "debugTrace" field - write in ${explanationLanguage}
- "interviewMode" field - write in ${explanationLanguage}
- "challengeMode" field - write in ${explanationLanguage}
- "generalization" field - write in ${explanationLanguage}

ONLY keep the following in English:
- Code snippets and correctedCode
- Programming keywords and function names
- Variable names in examples

The user selected ${explanationLanguage} as their preferred language. Please respect this choice.
` : ''}

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
      max_tokens: 16384,
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
    
    // Clean the corrected code to remove markdown formatting
    const cleanedCorrectedCode = cleanCorrectedCode(parsedResult.correctedCode || code);
    const diffView = generateDiff(code, cleanedCorrectedCode);

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
        youtubeSearchQueries: parsedResult.resources?.youtubeSearchQueries || [],
        documentationLinks: parsedResult.resources?.documentationLinks || [],
      },
      codeHealth,
      correctedCode: cleanedCorrectedCode,
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
