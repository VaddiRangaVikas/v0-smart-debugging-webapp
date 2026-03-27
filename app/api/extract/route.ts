import { NextRequest, NextResponse } from 'next/server';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyC07Ha41-6z6hFIj5J4G_xLmTNv4HDI3LY';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const fileType = file.type;
    const fileName = file.name.toLowerCase();

    // Handle text-based files directly
    if (
      fileType === 'text/plain' ||
      fileName.endsWith('.py') ||
      fileName.endsWith('.java') ||
      fileName.endsWith('.c') ||
      fileName.endsWith('.cpp') ||
      fileName.endsWith('.js') ||
      fileName.endsWith('.ts') ||
      fileName.endsWith('.go') ||
      fileName.endsWith('.rs') ||
      fileName.endsWith('.php') ||
      fileName.endsWith('.rb') ||
      fileName.endsWith('.swift') ||
      fileName.endsWith('.kt') ||
      fileName.endsWith('.sql') ||
      fileName.endsWith('.cs')
    ) {
      const text = await file.text();
      return NextResponse.json({ code: text, method: 'direct' });
    }

    // Handle images and PDFs with Gemini Vision
    if (
      fileType.startsWith('image/') ||
      fileType === 'application/pdf'
    ) {
      const bytes = await file.arrayBuffer();
      const base64 = Buffer.from(bytes).toString('base64');

      const mimeType = fileType === 'application/pdf' ? 'application/pdf' : fileType;

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
                  inlineData: {
                    mimeType,
                    data: base64,
                  },
                },
                {
                  text: `Extract all code from this ${fileType === 'application/pdf' ? 'PDF document' : 'image'}. 
                  
Return ONLY the extracted code, nothing else. No explanations, no markdown formatting, no code blocks.
If there are multiple code snippets, combine them in order.
If there's no code visible, return an empty string.
Preserve the exact formatting, indentation, and line breaks of the original code.`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 8192,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Gemini Vision API error:', errorText);
        throw new Error(`Failed to extract code from ${fileType}`);
      }

      const data = await response.json();
      let extractedCode = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      // Clean up any markdown code blocks that might have been added
      extractedCode = extractedCode.trim();
      if (extractedCode.startsWith('```')) {
        const lines = extractedCode.split('\n');
        lines.shift(); // Remove first line with ```
        if (lines[lines.length - 1] === '```') {
          lines.pop(); // Remove last line with ```
        }
        extractedCode = lines.join('\n');
      }

      return NextResponse.json({ code: extractedCode, method: 'ocr' });
    }

    return NextResponse.json(
      { error: 'Unsupported file type. Please upload code files, images, or PDFs.' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Extract API error:', error);
    return NextResponse.json(
      { error: 'Failed to extract code from file. Please try again.' },
      { status: 500 }
    );
  }
}
