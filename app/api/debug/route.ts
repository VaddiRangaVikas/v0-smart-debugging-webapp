import { NextRequest, NextResponse } from 'next/server';
import type { DebugRequest, DebugResult, DiffLine, CodeHealthScore, ProgrammingLanguage } from '@/lib/types';

const OPENROUTER_API_KEY = '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';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Function to repair truncated JSON responses
function repairTruncatedJSON(jsonString: string): Record<string, unknown> {
  let str = jsonString.trim();
  
  // First, try to find and fix common truncation patterns
  // Pattern 1: Truncated in the middle of "correctedCode" string value
  const correctedCodeMatch = str.match(/"correctedCode"\s*:\s*"/);
  if (correctedCodeMatch) {
    const startIdx = correctedCodeMatch.index! + correctedCodeMatch[0].length;
    // Find if the correctedCode value is properly closed
    let inEscape = false;
    let foundEnd = false;
    for (let i = startIdx; i < str.length; i++) {
      if (inEscape) {
        inEscape = false;
        continue;
      }
      if (str[i] === '\\') {
        inEscape = true;
        continue;
      }
      if (str[i] === '"') {
        foundEnd = true;
        break;
      }
    }
    if (!foundEnd) {
      // correctedCode is truncated, close it and the object
      str = str + '"}}';
    }
  }

  // Helper function to count brackets
  const countBrackets = (s: string) => {
    let braces = 0, brackets = 0, inString = false, prev = '';
    for (const c of s) {
      if (c === '"' && prev !== '\\') inString = !inString;
      if (!inString) {
        if (c === '{') braces++;
        if (c === '}') braces--;
        if (c === '[') brackets++;
        if (c === ']') brackets--;
      }
      prev = c;
    }
    return { braces, brackets, inString };
  };

  // Check current state
  let state = countBrackets(str);
  
  // If we're in an unclosed string, close it
  if (state.inString) {
    str = str + '"';
    state = countBrackets(str);
  }
  
  // Remove trailing incomplete content
  str = str.replace(/,\s*$/, '');
  str = str.replace(/,\s*"[^"]*"?\s*:?\s*$/, ''); // Remove incomplete key-value
  str = str.replace(/:\s*$/, '": ""'); // Fix trailing colon
  
  // Recount after cleanup
  state = countBrackets(str);
  
  // Close unclosed structures
  str += ']'.repeat(Math.max(0, state.brackets));
  str += '}'.repeat(Math.max(0, state.braces));
  
  try {
    return JSON.parse(str);
  } catch {
    // More aggressive repair: find last valid JSON position
    for (let i = str.length; i > 100; i -= 20) {
      let testStr = str.slice(0, i);
      
      // Clean up potential truncation points
      testStr = testStr.replace(/,\s*"[^"]*"?\s*:?\s*"?[^"{}[\]]*$/, '');
      testStr = testStr.replace(/,\s*$/, '');
      
      const testState = countBrackets(testStr);
      
      if (testState.inString) {
        testStr += '"';
      }
      
      const finalState = countBrackets(testStr);
      testStr += ']'.repeat(Math.max(0, finalState.brackets));
      testStr += '}'.repeat(Math.max(0, finalState.braces));
      
      try {
        return JSON.parse(testStr);
      } catch {
        continue;
      }
    }
    
    throw new Error('Unable to repair JSON');
  }
}

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

function calculateCodeHealth(errors: { type: string; severity?: string }[]): CodeHealthScore {
  let score = 100;
  let errorCount = 0;
  let warningCount = 0;
  let optimizationCount = 0;
  let securityCount = 0;

  // Severity-based scoring for more accurate health calculation
  const severityDeductions: Record<string, number> = {
    critical: 35,
    high: 25,
    medium: 15,
    low: 8,
    info: 3,
  };

  // Type-based deductions (fallback if severity not provided)
  const typeDeductions: Record<string, { base: number; category: 'error' | 'warning' | 'optimization' }> = {
    syntax: { base: 30, category: 'error' },
    runtime: { base: 28, category: 'error' },
    logical: { base: 25, category: 'error' },
    type_error: { base: 22, category: 'error' },
    null_reference: { base: 25, category: 'error' },
    boundary: { base: 28, category: 'error' },
    memory: { base: 30, category: 'error' },
    security: { base: 35, category: 'error' },
    concurrency: { base: 25, category: 'error' },
    resource_leak: { base: 20, category: 'error' },
    performance: { base: 12, category: 'optimization' },
    warning: { base: 10, category: 'warning' },
    bad_practice: { base: 5, category: 'optimization' },
  };

  for (const error of errors) {
    // Use severity if available, otherwise fall back to type-based scoring
    if (error.severity && severityDeductions[error.severity]) {
      score -= severityDeductions[error.severity];
    } else {
      const typeInfo = typeDeductions[error.type] || { base: 15, category: 'warning' };
      score -= typeInfo.base;
    }

    // Categorize for statistics
    const typeInfo = typeDeductions[error.type];
    if (typeInfo) {
      switch (typeInfo.category) {
        case 'error':
          if (error.type === 'security') {
            securityCount++;
          }
          errorCount++;
          break;
        case 'warning':
          warningCount++;
          break;
        case 'optimization':
          optimizationCount++;
          break;
      }
    } else {
      warningCount++;
    }
  }

  score = Math.max(0, Math.min(100, score));
  
  // Calculate grade based on score
  const getGrade = (s: number): 'A' | 'B' | 'C' | 'D' | 'F' => {
    if (s >= 90) return 'A';
    if (s >= 80) return 'B';
    if (s >= 70) return 'C';
    if (s >= 60) return 'D';
    return 'F';
  };

  const totalIssues = errorCount + warningCount + optimizationCount;
  
  if (totalIssues === 0) {
    return {
      score: 100,
      correct: 100,
      errors: 0,
      warnings: 0,
      optimizations: 0,
      grade: 'A',
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
    grade: getGrade(score),
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

    // Create numbered code for better line detection
    const numberedCode = codeLines.map((line, i) => `${i + 1}: ${line}`).join('\n');
    
    const prompt = `You are an AI code debugger. Analyze this ${detectedLang} code for ACTUAL CODE ERRORS ONLY.

RULES - ONLY CHECK IF CODE COMPILES AND EXECUTES:
- ONLY flag errors that PREVENT compilation or cause runtime CRASH
- Code is CORRECT if it COMPILES and RUNS without crashing

DO NOT FLAG THESE AS ERRORS (they are NOT code errors):
- Spaces in format specifiers: printf("%d %d") is VALID, not an error
- String content/spelling: printf("helo wrld") is VALID code
- Variable naming style: int x, int myVar, int my_var - all VALID
- Comment grammar: // this do thing - VALID
- Formatting preferences: spaces, indentation - VALID
- Output formatting choices - VALID

ONLY FLAG THESE AS ERRORS:
- Missing semicolons, brackets, parentheses (syntax)
- Undeclared variables, undefined functions (syntax)
- Null pointer access, array out of bounds (runtime)
- Division by zero, infinite loops (runtime)
- Wrong operator like = instead of == in conditions (logical)

If code COMPILES and RUNS: Set "error": "No errors found. Code is correct." and "errors": []

CODE WITH LINE NUMBERS (use these EXACT line numbers in errors):
\`\`\`
${numberedCode}
\`\`\`

Respond ONLY with this JSON:
{
  "intent": "What code does",
  "actualBehavior": "What it actually does",
  "error": "Main error OR 'No errors found. Code is correct.'",
  "explanation": "${userLevel === 'beginner' ? 'Simple explanation' : 'Technical explanation'}",
  "rootCause": "Why error occurs",
  "learning": {"whyItHappened": "", "whenItHappens": "", "howToAvoid": "", "concept": ""},
  "mentalModel": "Analogy",
  "teacherMode": "Teaching explanation",
  "thinkMode": "Guiding questions",
  "conceptBuilder": "Core concept",
  "debugTrace": "Execution trace",
  "interviewMode": "Interview explanation",
  "challengeMode": "Hints",
  "generalization": "Pattern",
  "resources": {"youtubeSearchQueries": [], "documentationLinks": []},
  "errors": [
    {
      "type": "syntax|runtime|logical|memory",
      "severity": "critical|high|medium|low",
      "line": <EXACT line number from above>,
      "message": "what is wrong",
      "fix": "THE COMPLETE CORRECTED LINE (without line number prefix)"
    }
  ],
  "correctedCode": "ALL ${codeLength} lines with fixes applied"
}

CRITICAL FOR ERRORS ARRAY:
- "line" MUST be the EXACT line number shown above (1, 2, 3, etc.)
- "fix" MUST be the COMPLETE corrected version of that line (code only, no line number)
- Example: If line "5: printf("hello")" has missing semicolon, fix is: printf("hello");

ERROR TYPES: syntax (missing ;{}), runtime (null/bounds), logical (wrong ==), memory (leak/overflow)

IF NO ERRORS: Return "errors": [] and "error": "No errors found. Code is correct."

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
      // Try to repair truncated JSON
      console.log('[v0] Attempting to repair truncated JSON response');
      try {
        parsedResult = repairTruncatedJSON(cleanedContent);
      } catch {
        console.error('Failed to parse or repair OpenRouter response:', cleanedContent.slice(0, 500) + '...');
        throw new Error('Failed to parse AI response');
      }
    }

    const errors = parsedResult.errors || [];
    
    // Check the error message for "no errors" indication FIRST
    const errorMessage = (parsedResult.error || '').toLowerCase();
    const errorMessageIndicatesCorrect = 
      errorMessage.includes('no error') || 
      errorMessage.includes('code is correct') ||
      errorMessage.includes('no issues') ||
      errorMessage.includes('correct') ||
      errorMessage.includes('well-written') ||
      errorMessage.includes('looks good');
    
    // If the AI says code is correct, trust that - ignore any false positive errors
    const isCodeCorrect = errorMessageIndicatesCorrect || errors.length === 0;
    
    // Only consider real errors if the code is NOT marked as correct
    const realErrorTypes = ['syntax', 'runtime', 'logical', 'memory', 'security', 'type_error', 'null_reference', 'boundary'];
    const hasRealErrors = !isCodeCorrect && errors.length > 0 && errors.some((e: { type: string }) => 
      realErrorTypes.includes(e.type)
    );
    
    // Calculate code health - force 100 if code is correct
    const codeHealth = isCodeCorrect 
      ? { score: 100, correct: 100, errors: 0, warnings: 0, optimizations: 0, grade: 'A' as const }
      : calculateCodeHealth(errors);
    
    // Clean the corrected code to remove markdown formatting
    // If correctedCode is truncated, try to generate diff from error information
    let correctedCodeRaw = parsedResult.correctedCode || code;
    let isTruncated = false;
    
    if (typeof correctedCodeRaw === 'string' && 
        (correctedCodeRaw.endsWith('...') || 
         correctedCodeRaw.endsWith('..') ||
         (correctedCodeRaw.length < code.length * 0.5 && code.length > 100))) {
      console.log('[v0] Corrected code appears truncated');
      isTruncated = true;
    }
    
    let cleanedCorrectedCode = cleanCorrectedCode(correctedCodeRaw);
    let diffView: DiffLine[];
    
    // If code is correct, don't generate any diff - just use original code
    if (isCodeCorrect) {
      cleanedCorrectedCode = code;
      diffView = code.split('\n').map((line, i) => ({
        type: 'unchanged' as const,
        content: line,
        lineNumber: i + 1
      }));
    }
    // If truncated but we have errors, generate a diff based on error lines with their fixes
    else if (isTruncated && hasRealErrors) {
      console.log('[v0] Generating diff from error information with fixes');
      
      // Create a map of line numbers to their fixes
      const errorFixMap = new Map<number, { message: string; fix: string }>();
      errors.forEach((e: { line: number; message: string; fix?: string }) => {
        if (e.line > 0) {
          errorFixMap.set(e.line, { message: e.message, fix: e.fix || '' });
        }
      });
      
      const codeLines = code.split('\n');
      diffView = [];
      const correctedLines: string[] = [];
      
      codeLines.forEach((line, i) => {
        const lineNum = i + 1;
        const errorInfo = errorFixMap.get(lineNum);
        
        if (errorInfo) {
          // This line has an error - mark it as removed (red)
          diffView.push({ type: 'removed' as const, content: line, lineNumber: lineNum });
          
          // If we have a fix, add it as added (blue) and use it in corrected code
          if (errorInfo.fix && errorInfo.fix.trim()) {
            diffView.push({ type: 'added' as const, content: errorInfo.fix, lineNumber: lineNum });
            correctedLines.push(errorInfo.fix);
          } else {
            // No fix provided, keep original line in corrected code
            correctedLines.push(line);
          }
        } else {
          // No error on this line
          diffView.push({ type: 'unchanged' as const, content: line, lineNumber: lineNum });
          correctedLines.push(line);
        }
      });
      
      // Build the corrected code from the fixed lines
      cleanedCorrectedCode = correctedLines.join('\n');
    } else {
      diffView = generateDiff(code, cleanedCorrectedCode);
    }

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
