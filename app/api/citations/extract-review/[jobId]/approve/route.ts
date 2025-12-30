import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * POST /api/citations/extract-review/[jobId]/approve
 * Approve selected studies and create citation entries
 *
 * Body: { studyIds: string[] } - IDs of studies to approve
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const { jobId } = params;
    const body = await request.json();
    const { studyIds } = body;

    if (!Array.isArray(studyIds) || studyIds.length === 0) {
      return NextResponse.json(
        { error: 'studyIds array is required' },
        { status: 400 }
      );
    }

    // Get the job and review PDF path
    const job = await prisma.reviewExtractionJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Get all selected studies
    const studiesToApprove = await prisma.extractedStudy.findMany({
      where: {
        id: { in: studyIds },
        jobId,
      },
    });

    if (studiesToApprove.length === 0) {
      return NextResponse.json(
        { error: 'No valid studies found' },
        { status: 404 }
      );
    }

    // Create citations for each approved study
    const createdCitations = [];

    for (const study of studiesToApprove) {
      try {
        // Create citation pointing to the review PDF
        const citation = await prisma.citation.create({
          data: {
            title: study.title,
            authors: study.authors,
            journal: study.journal,
            year: study.year,
            pmid: study.pmid,
            doi: study.doi,
            studyType: study.studyType as any,
            citationType: study.citationType as any,
            sampleSize: study.sampleSize,
            population: study.population,
            pdfPath: job.pdfPath, // Links to the review PDF
            pdfFileName: `${job.pdfFileName} (Study: ${study.authors.split(',')[0]} ${study.year})`,
            fullText: `Extracted from comprehensive review: ${job.reviewTitle}\n\n${study.keyFindings}`,
            keyFindings: study.keyFindings,
            drugName: study.drugName,
            indications: study.indications as any,
            referenceDrugName: study.referenceDrugName,
            notes: `Source: ${job.reviewTitle} (${job.reviewAuthors}, ${job.reviewYear})\nMentioned on pages: ${study.mentionedOnPages.join(', ')}\nSections: ${study.extractedFromSections.join(', ')}`,
            reviewed: true,
          },
        });

        // Link citation back to extracted study
        await prisma.extractedStudy.update({
          where: { id: study.id },
          data: {
            approved: true,
            citationId: citation.id,
          },
        });

        createdCitations.push(citation);

      } catch (error: any) {
        console.error(`Error creating citation for study ${study.id}:`, error);
        // Continue with other studies
      }
    }

    // Update job statistics
    const approvedCount = await prisma.extractedStudy.count({
      where: { jobId, approved: true },
    });

    await prisma.reviewExtractionJob.update({
      where: { id: jobId },
      data: {
        studiesApproved: approvedCount,
        status: approvedCount === job.totalStudies ? 'APPROVED' : job.status,
      },
    });

    return NextResponse.json({
      success: true,
      createdCount: createdCitations.length,
      citations: createdCitations,
    });

  } catch (error: any) {
    console.error('Error approving studies:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to approve studies' },
      { status: 500 }
    );
  }
}
