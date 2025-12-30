import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * GET /api/citations/extract-review/[jobId]
 * Check status of review extraction job
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const { jobId } = params;

    const job = await prisma.reviewExtractionJob.findUnique({
      where: { id: jobId },
      include: {
        extractedStudies: {
          orderBy: { year: 'desc' },
        },
      },
    });

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Calculate progress
    const progress = job.totalStudies > 0
      ? Math.round((job.studiesExtracted / job.totalStudies) * 100)
      : 0;

    return NextResponse.json({
      id: job.id,
      status: job.status,
      progress,
      reviewTitle: job.reviewTitle,
      reviewAuthors: job.reviewAuthors,
      reviewYear: job.reviewYear,
      totalStudies: job.totalStudies,
      studiesExtracted: job.studiesExtracted,
      studiesApproved: job.studiesApproved,
      extractedStudies: job.extractedStudies,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      errorMessage: job.errorMessage,
    });

  } catch (error: any) {
    console.error('Error fetching extraction job:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch job status' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/citations/extract-review/[jobId]
 * Update extracted studies (approve/edit)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const { jobId } = params;
    const body = await request.json();
    const { studyId, updates } = body;

    if (!studyId || !updates) {
      return NextResponse.json(
        { error: 'studyId and updates are required' },
        { status: 400 }
      );
    }

    // Update the extracted study
    const updatedStudy = await prisma.extractedStudy.update({
      where: { id: studyId },
      data: {
        ...updates,
        edited: true,
      },
    });

    return NextResponse.json(updatedStudy);

  } catch (error: any) {
    console.error('Error updating extracted study:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update study' },
      { status: 500 }
    );
  }
}
