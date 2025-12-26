import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// PATCH /api/citations/[id] - Update citation metadata
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { id } = params;

    // Filter out fields that shouldn't be updated via this endpoint
    const {
      createdAt,
      updatedAt,
      uploadedAt,
      pdfPath,
      pdfFileName,
      fullText,
      ...updateData
    } = body;

    const citation = await prisma.citation.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(citation);
  } catch (error: any) {
    console.error('Error updating citation:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update citation' },
      { status: 500 }
    );
  }
}

// DELETE /api/citations/[id] - Delete citation
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    await prisma.citation.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting citation:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete citation' },
      { status: 500 }
    );
  }
}
