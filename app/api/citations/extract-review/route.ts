import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { supabaseAdmin, CITATIONS_BUCKET } from '@/lib/supabase';
import { extractTextFromPdf } from '@/lib/pdf-utils';
import {
  analyzeReviewDocument,
  extractStudyData,
  findStudyMentions,
} from '@/lib/review-extractor';

const prisma = new PrismaClient();

// Configure API route for large file uploads and long processing
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max
export const dynamic = 'force-dynamic';

/**
 * POST /api/citations/extract-review
 * Start extraction of a comprehensive review from Supabase storage
 *
 * This is a long-running operation that:
 * 1. Downloads PDF from Supabase storage
 * 2. Extracts full text
 * 3. Analyzes document structure (Stage 1)
 * 4. Extracts individual studies (Stage 2)
 * 5. Returns job ID for status tracking
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pdfPath, pdfFileName } = body;

    if (!pdfPath || !pdfFileName) {
      return NextResponse.json(
        { error: 'pdfPath and pdfFileName are required' },
        { status: 400 }
      );
    }

    // Create extraction job
    const job = await prisma.reviewExtractionJob.create({
      data: {
        pdfPath,
        pdfFileName,
        status: 'PENDING',
        uploadedBy: 'system', // TODO: Add user tracking
      },
    });

    // Start extraction process asynchronously
    // In production, this would be a background job (queue, worker, etc.)
    // For now, we'll use a simple async process
    processReviewExtraction(job.id, pdfPath).catch((error) => {
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
async function processReviewExtraction(jobId: string, pdfPath: string) {
  try {
    // Update status to ANALYZING_DOCUMENT
    await prisma.reviewExtractionJob.update({
      where: { id: jobId },
      data: {
        status: 'ANALYZING_DOCUMENT',
        startedAt: new Date(),
      },
    });

    // Download PDF from Supabase storage
    console.log(`[Job ${jobId}] Downloading PDF from storage...`);
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from(CITATIONS_BUCKET)
      .download(pdfPath);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download PDF: ${downloadError?.message}`);
    }

    // Convert Blob to File
    const file = new File([fileData], pdfPath.split('/').pop() || 'review.pdf', {
      type: 'application/pdf',
    });

    // Extract full text from PDF
    console.log(`[Job ${jobId}] Extracting text from PDF...`);
    const fullText = await extractTextFromPdf(file);

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
