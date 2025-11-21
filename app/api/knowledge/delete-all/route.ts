import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * DELETE /api/knowledge/delete-all
 *
 * Deletes all knowledge documents from the database.
 * Use this to clear the knowledge base before re-uploading with better chunking strategy.
 *
 * DANGER: This is irreversible. All RAG knowledge will be deleted.
 */
export async function DELETE(request: NextRequest) {
  try {
    // Delete all knowledge documents
    const result = await prisma.knowledgeDocument.deleteMany({});

    return NextResponse.json({
      success: true,
      deletedCount: result.count,
      message: `Successfully deleted ${result.count} knowledge documents`,
    });
  } catch (error: any) {
    console.error('Error deleting knowledge documents:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/knowledge/delete-all
 *
 * Returns count of knowledge documents (for confirmation before delete)
 */
export async function GET(request: NextRequest) {
  try {
    const count = await prisma.knowledgeDocument.count();

    return NextResponse.json({
      count,
      message: `There are currently ${count} knowledge documents in the database`,
    });
  } catch (error: any) {
    console.error('Error counting knowledge documents:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
