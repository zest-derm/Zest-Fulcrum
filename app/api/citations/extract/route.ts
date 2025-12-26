import { NextRequest, NextResponse } from 'next/server';
import { extractTextFromPdf } from '@/lib/pdf-utils';
import { extractCitationMetadata } from '@/lib/citation-metadata-extractor';

// POST /api/citations/extract - Extract metadata from PDF
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const pdf = formData.get('pdf') as File;

    if (!pdf) {
      return NextResponse.json(
        { error: 'PDF file is required' },
        { status: 400 }
      );
    }

    // Step 1: Extract text from PDF
    let fullText: string;
    try {
      fullText = await extractTextFromPdf(pdf);
    } catch (error: any) {
      return NextResponse.json(
        { error: `Failed to extract text from PDF: ${error.message}` },
        { status: 500 }
      );
    }

    // Step 2: Extract metadata using GPT-5.2
    let metadata;
    try {
      metadata = await extractCitationMetadata(fullText);
    } catch (error: any) {
      return NextResponse.json(
        { error: `Failed to extract metadata: ${error.message}` },
        { status: 500 }
      );
    }

    // Return extracted metadata and full text
    return NextResponse.json({
      metadata,
      fullText,
      pdfFileName: pdf.name,
    });
  } catch (error: any) {
    console.error('Error in citation extraction:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to extract citation data' },
      { status: 500 }
    );
  }
}
