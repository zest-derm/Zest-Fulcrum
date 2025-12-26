import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { uploadCitationPdf } from '@/lib/supabase';
import { extractTextFromPdf } from '@/lib/pdf-utils';
import { extractKeyFindings } from '@/lib/citation-llm';

const prisma = new PrismaClient();

// GET /api/citations - Get all citations
export async function GET() {
  try {
    const citations = await prisma.citation.findMany({
      orderBy: [
        { drugName: 'asc' },
        { year: 'desc' },
      ],
    });

    return NextResponse.json(citations);
  } catch (error: any) {
    console.error('Error fetching citations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch citations' },
      { status: 500 }
    );
  }
}

// POST /api/citations - Upload new citation
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const pdf = formData.get('pdf') as File;
    const drugName = formData.get('drugName') as string;
    const indicationsJson = formData.get('indications') as string;
    const title = formData.get('title') as string;
    const authors = formData.get('authors') as string;
    const journal = formData.get('journal') as string;
    const year = parseInt(formData.get('year') as string);
    const studyType = formData.get('studyType') as string;
    const citationType = formData.get('citationType') as string;

    // Optional fields
    const pmid = formData.get('pmid') as string | null;
    const doi = formData.get('doi') as string | null;
    const sampleSizeStr = formData.get('sampleSize') as string | null;
    const population = formData.get('population') as string | null;
    const referenceDrugName = formData.get('referenceDrugName') as string | null;
    const keyFindings = formData.get('keyFindings') as string | null;
    const notes = formData.get('notes') as string | null;

    if (!pdf || !drugName || !title || !authors || !journal || !year) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const indications = JSON.parse(indicationsJson || '[]');
    const sampleSize = sampleSizeStr ? parseInt(sampleSizeStr) : null;

    // Step 1: Upload PDF to Supabase storage
    let pdfPath: string;
    let pdfPublicUrl: string;
    try {
      const uploadResult = await uploadCitationPdf(pdf, drugName);
      pdfPath = uploadResult.path;
      pdfPublicUrl = uploadResult.publicUrl;
    } catch (error: any) {
      console.error('Error uploading PDF:', error);
      return NextResponse.json(
        { error: `Failed to upload PDF: ${error.message}` },
        { status: 500 }
      );
    }

    const pdfFileName = pdf.name;

    // Step 2: Extract full text from PDF
    let fullText: string;
    try {
      fullText = await extractTextFromPdf(pdf);
    } catch (error: any) {
      console.error('Error extracting text from PDF:', error);
      // Continue with placeholder text if extraction fails
      fullText = 'Text extraction failed - PDF stored but text not available';
    }

    // Step 3: Use LLM to extract key findings if not provided
    let finalKeyFindings = keyFindings;
    if (!finalKeyFindings && fullText) {
      try {
        finalKeyFindings = await extractKeyFindings(
          fullText,
          drugName,
          citationType
        );
      } catch (error: any) {
        console.error('Error extracting key findings with LLM:', error);
        // Use a placeholder if LLM extraction fails
        finalKeyFindings = 'Key findings extraction failed - please add manually';
      }
    } else if (!finalKeyFindings) {
      finalKeyFindings = 'Key findings not provided';
    }

    // Create citation record
    const citation = await prisma.citation.create({
      data: {
        title,
        authors,
        journal,
        year,
        pmid: pmid || null,
        doi: doi || null,
        studyType: studyType as any,
        citationType: citationType as any,
        sampleSize,
        population,
        pdfPath,
        pdfFileName,
        fullText,
        keyFindings: finalKeyFindings,
        drugName,
        indications: indications as any,
        referenceDrugName: referenceDrugName || null,
        notes,
      },
    });

    return NextResponse.json(citation, { status: 201 });
  } catch (error: any) {
    console.error('Error creating citation:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create citation' },
      { status: 500 }
    );
  }
}
