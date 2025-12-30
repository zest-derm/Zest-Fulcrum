import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { uploadCitationPdf } from '@/lib/supabase';
import { extractTextFromPdf } from '@/lib/pdf-utils';
import {
  analyzeReviewDocument,
  extractStudyData,
  findStudyMentions,
} from '@/lib/review-extractor';

const prisma = new PrismaClient();

// Configure API route to accept larger files (up to 50MB)
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max
export const dynamic = 'force-dynamic';

// Increase body size limit for PDF uploads
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
};

/**
 * POST /api/citations/extract-review
 * Upload a comprehensive review (Cochrane, meta-analysis) and extract all individual studies
 *
 * This is a long-running operation that:
 * 1. Uploads the PDF
 * 2. Extracts full text
 * 3. Analyzes document structure (Stage 1)
 * 4. Extracts individual studies (Stage 2)
 * 5. Returns job ID for status tracking
 */
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

    // Step 1: Upload PDF to Supabase
    let pdfPath: string;
    try {
      const uploadResult = await uploadCitationPdf(pdf, 'comprehensive-review');
      pdfPath = uploadResult.path;
    } catch (error: any) {
      console.error('Error uploading PDF:', error);
      return NextResponse.json(
        { error: `Failed to upload PDF: ${error.message}` },
        { status: 500 }
      );
    }

    // Step 2: Create extraction job
    const job = await prisma.reviewExtractionJob.create({
      data: {
        pdfPath,
        pdfFileName: pdf.name,
        status: 'PENDING',
        uploadedBy: 'system', // TODO: Add user tracking
      },
    });

    // Step 3: Start extraction process asynchronously
    // In production, this would be a background job (queue, worker, etc.)
    // For now, we'll use a simple async process
    processReviewExtraction(job.id, pdf).catch((error) => {
      console.error(`Error processing review ${job.id}:`, error);
      prisma.reviewExtractionJob.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          errorMessage: error.message,
          completedAt: new Date(),
        },
      }).catch(console.error);
    });

    return NextResponse.json({
      jobId: job.id,
      status: 'PENDING',
      message: 'Review extraction started. This may take 1-2 hours.',
    }, { status: 202 });

  } catch (error: any) {
    console.error('Error in extract-review endpoint:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to start extraction' },
      { status: 500 }
    );
  }
}

/**
 * Background process to extract all studies from review
 */
async function processReviewExtraction(jobId: string, pdf: File) {
  try {
    // Update status to ANALYZING_DOCUMENT
    await prisma.reviewExtractionJob.update({
      where: { id: jobId },
      data: {
        status: 'ANALYZING_DOCUMENT',
        startedAt: new Date(),
      },
    });

    // Extract full text from PDF
    console.log(`[Job ${jobId}] Extracting text from PDF...`);
    const fullText = await extractTextFromPdf(pdf);

    // Stage 1: Analyze document structure
    console.log(`[Job ${jobId}] Analyzing document structure...`);
    const { metadata, references, structure } = await analyzeReviewDocument(fullText);

    // Update job with Stage 1 results
    await prisma.reviewExtractionJob.update({
      where: { id: jobId },
      data: {
        reviewTitle: metadata.title,
        reviewAuthors: metadata.authors,
        reviewYear: metadata.year,
        totalStudies: references.length,
        documentStructure: structure as any,
        referenceList: references as any,
        status: 'EXTRACTING_STUDIES',
      },
    });

    console.log(`[Job ${jobId}] Found ${references.length} studies. Starting extraction...`);

    // Stage 2: Extract each study
    for (let i = 0; i < references.length; i++) {
      const studyRef = references[i];

      try {
        console.log(`[Job ${jobId}] Extracting study ${i + 1}/${references.length}: ${studyRef.id}`);

        // Find all mentions of this study in the document
        const { excerpts, pages, sections } = findStudyMentions(fullText, studyRef);

        if (excerpts.length === 0) {
          console.warn(`[Job ${jobId}] No mentions found for ${studyRef.id}, using reference only`);
        }

        // Extract study data using Claude
        const studyData = await extractStudyData(studyRef, excerpts);

        // Save extracted study
        await prisma.extractedStudy.create({
          data: {
            jobId,
            title: studyData.title,
            authors: studyData.authors,
            journal: studyData.journal,
            year: studyData.year,
            pmid: studyData.pmid,
            doi: studyData.doi,
            studyType: studyData.studyType,
            citationType: studyData.citationType,
            sampleSize: studyData.sampleSize,
            population: studyData.population,
            drugName: studyData.drugName,
            indications: studyData.indications,
            referenceDrugName: studyData.referenceDrugName,
            keyFindings: studyData.keyFindings,
            mentionedOnPages: pages,
            extractedFromSections: [...new Set(sections)],
            extractionConfidence: studyData.extractionConfidence,
            needsReview: studyData.needsReview,
          },
        });

        // Update progress
        await prisma.reviewExtractionJob.update({
          where: { id: jobId },
          data: {
            studiesExtracted: i + 1,
          },
        });

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error: any) {
        console.error(`[Job ${jobId}] Error extracting study ${studyRef.id}:`, error);
        // Continue with next study
      }
    }

    // Mark as completed
    await prisma.reviewExtractionJob.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    console.log(`[Job ${jobId}] Extraction completed successfully!`);

  } catch (error: any) {
    console.error(`[Job ${jobId}] Fatal error:`, error);
    throw error;
  }
}
