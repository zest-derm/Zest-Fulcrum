import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { supabase, CITATIONS_BUCKET } from '@/lib/supabase';

const prisma = new PrismaClient();

// GET /api/citations/[id]/pdf - Get PDF URL for viewing
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Get citation from database
    const citation = await prisma.citation.findUnique({
      where: { id },
      select: { pdfPath: true },
    });

    if (!citation) {
      return NextResponse.json(
        { error: 'Citation not found' },
        { status: 404 }
      );
    }

    // Get public URL from Supabase
    const { data } = supabase.storage
      .from(CITATIONS_BUCKET)
      .getPublicUrl(citation.pdfPath);

    return NextResponse.json({ url: data.publicUrl });
  } catch (error: any) {
    console.error('Error getting PDF URL:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get PDF URL' },
      { status: 500 }
    );
  }
}
