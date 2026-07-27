import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/database';

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const title = searchParams.get('title');
    const performanceId = searchParams.get('performanceId');
    const deleteAll = searchParams.get('deleteAll') === 'true';

    if (!title && !performanceId && !deleteAll) {
      return NextResponse.json(
        { error: 'Please provide title, performanceId, or set deleteAll=true' },
        { status: 400 }
      );
    }

    const sqlClient = getSql();

    let deletedCount = 0;
    let deletedCertificates: any[] = [];

    if (performanceId) {
      // Delete certificates for specific performance
      const certs = await sqlClient`
        SELECT id, title, dancer_name, percentage, certificate_url 
        FROM certificates 
        WHERE performance_id = ${performanceId}
      ` as any[];

      if (certs.length > 0) {
        await sqlClient`
          DELETE FROM certificates WHERE performance_id = ${performanceId}
        `;
        deletedCount = certs.length;
        deletedCertificates = certs;
        console.log(` Deleted ${deletedCount} certificate(s) for performance ${performanceId}`);
      }
    } else if (title) {
      // Delete certificates by title (case-insensitive)
      const certs = await sqlClient`
        SELECT id, title, dancer_name, percentage, certificate_url, performance_id
        FROM certificates 
        WHERE LOWER(title) = LOWER(${title})
      ` as any[];

      if (certs.length > 0) {
        await sqlClient`
          DELETE FROM certificates WHERE LOWER(title) = LOWER(${title})
        `;
        deletedCount = certs.length;
        deletedCertificates = certs;
        console.log(` Deleted ${deletedCount} certificate(s) for title "${title}"`);
      }
    } else if (deleteAll) {
      // Delete all certificates (use with caution!)
      const certs = await sqlClient`
        SELECT id, title, dancer_name, percentage 
        FROM certificates
      ` as any[];

      if (certs.length > 0) {
        await sqlClient`DELETE FROM certificates`;
        deletedCount = certs.length;
        deletedCertificates = certs;
        console.log(` Deleted ALL ${deletedCount} certificate(s)`);
      }
    }

    return NextResponse.json({
      success: true,
      deletedCount,
      deletedCertificates: deletedCertificates.map(c => ({
        id: c.id,
        title: c.title,
        dancerName: c.dancer_name,
        percentage: c.percentage,
        performanceId: c.performance_id || null
      })),
      message: `Deleted ${deletedCount} certificate(s)`
    });

  } catch (error: any) {
    console.error('Error deleting certificates:', error);
    return NextResponse.json(
      { error: 'Failed to delete certificates', details: error.message },
      { status: 500 }
    );
  }
}

