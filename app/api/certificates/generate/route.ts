import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { getSql } from '@/lib/database';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

interface CertificateData {
  dancerId: string;
  dancerName: string;
  eodsaId?: string;
  email?: string;
  performanceId?: string;
  eventEntryId?: string;
  eventId?: string;
  performanceType?: string;
  studioName?: string;
  percentage: number;
  style: string;
  title: string;
  medallion: string;
  eventDate: string;
  createdBy?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: CertificateData = await request.json();
    const {
      dancerId,
      dancerName,
      eodsaId,
      email,
      performanceId,
      eventEntryId,
      eventId,
      performanceType,
      studioName,
      percentage,
      style,
      title: originalTitle,
      medallion,
      eventDate,
      createdBy
    } = body;

    // Validate required fields
    if (!dancerId || !dancerName || percentage === undefined || percentage === null || !style || !originalTitle || !medallion || !eventDate) {
      return NextResponse.json(
        { error: 'Missing required certificate data', details: { dancerId: !!dancerId, dancerName: !!dancerName, percentage, style: !!style, title: !!originalTitle, medallion: !!medallion, eventDate: !!eventDate } },
        { status: 400 }
      );
    }
    
    // Ensure percentage is a valid number
    let percentageValue = Number(percentage);
    if (isNaN(percentageValue) || percentageValue < 0) {
      console.error(`❌ Invalid percentage value: ${percentage}, defaulting to 0`);
      percentageValue = 0;
    }
    if (percentageValue > 100) {
      console.warn(`⚠️ Percentage value exceeds 100: ${percentageValue}, capping at 100`);
      percentageValue = 100;
    }
    
    // Ensure percentage is a whole number (round it)
    percentageValue = Math.round(percentageValue);
    
    console.log(`📊 Certificate generation - Percentage: ${percentageValue} (original: ${percentage}, type: ${typeof percentage})`);
    
    // Validate that percentage is not 0 or undefined before proceeding
    if (percentageValue === 0 && percentage !== 0) {
      console.error(`❌ Percentage is 0 but original was not 0. Original: ${percentage}`);
    }

    // Truncate title if too long (max 26 characters to fit on certificate)
    const MAX_TITLE_LENGTH = 26;
    let title = originalTitle;
    if (title.length > MAX_TITLE_LENGTH) {
      title = title.substring(0, MAX_TITLE_LENGTH - 3) + '...';
    }

    // Check if this dancer has custom position settings
    const sqlClient = getSql();
    const positionsResult = await sqlClient`
      SELECT * FROM certificate_positions WHERE dancer_id = ${dancerId}
    ` as any[];

    // Use custom positions if available, otherwise use defaults
    const hasCustom = positionsResult.length > 0;
    const pos = hasCustom ? positionsResult[0] : null;

    const nameTop = pos?.name_top || 48.5;
    // Default font size - will be adjusted dynamically based on name length if not custom
    const baseNameFontSize = pos?.name_font_size || 65;
    const percentageTop = pos?.percentage_top || 65.5;
    const percentageLeft = pos?.percentage_left || 15.5;
    const percentageFontSize = pos?.percentage_font_size || 76;
    // For style, title, and medallion - use standardized font size (26px) to ensure text always fits
    const styleTop = pos?.style_top || 68.5; // Adjusted up from 69.5
    const styleLeft = pos?.style_left || 77.5;
    const styleFontSize = pos?.style_font_size || 26; // Standardized to 26px
    const titleTop = pos?.title_top || 74;
    const titleLeft = pos?.title_left || 74;
    const titleFontSize = pos?.title_font_size || 26; // Standardized to 26px
    const medallionTop = pos?.medallion_top || 80.5;
    const medallionLeft = pos?.medallion_left || 72;
    const medallionFontSize = pos?.medallion_font_size || 26; // Standardized to 26px
    const dateTop = pos?.date_top || 89; // Adjusted up from 90
    const dateLeft = pos?.date_left || 66.5;
    const dateFontSize = pos?.date_font_size || 39;

    // For groups, duos, and trios (non-solo performances), use studio name instead of dancer names
    // This prevents unreadable certificates with long lists of participant names
    
    // Infer performance type if missing - check if dancerName contains commas (multiple participants)
    let inferredPerformanceType: string | null = performanceType || null;
    if (!inferredPerformanceType && dancerName && dancerName.includes(',')) {
      // If dancerName contains commas, it's likely a group performance with multiple names
      const nameCount = dancerName.split(',').length;
      if (nameCount === 2) {
        inferredPerformanceType = 'Duet';
      } else if (nameCount === 3) {
        inferredPerformanceType = 'Trio';
      } else if (nameCount >= 4) {
        inferredPerformanceType = 'Group';
      }
      console.log(`📝 Inferred performance type from dancerName (${nameCount} names): ${inferredPerformanceType}`);
    }
    
    const isGroupPerformance = inferredPerformanceType && ['Duet', 'Trio', 'Group'].includes(inferredPerformanceType);
    
    // CRITICAL: Determine what should be stored in certificates.dancer_name
    // SOLO → dancer_name = dancer/participant name
    // DUO/TRIO/GROUP → dancer_name = studio name from event_entries.studio_name (NEVER participant names)
    let displayName: string;
    let nameToStoreInDatabase: string; // This is what goes into certificates.dancer_name
    
    if (isGroupPerformance) {
      // For groups/duos/trios, ALWAYS use studioName, NEVER dancer names
      // Priority: 1) studioName parameter, 2) dancerName if it's a single name (not comma-separated), 3) fallback
      if (studioName && studioName.trim() !== '') {
        displayName = studioName.toUpperCase();
        nameToStoreInDatabase = studioName; // Store studio name, not participant names
        console.log(`📝 Group performance - Using studioName parameter: ${displayName}`);
      } else if (dancerName && !dancerName.includes(',') && dancerName.trim() !== '' && dancerName !== 'Studio Name') {
        // If dancerName is a single name (not a list), use it as studio name
        // But exclude the literal "Studio Name" fallback
        displayName = dancerName.toUpperCase();
        nameToStoreInDatabase = dancerName;
        console.log(`📝 Group performance - Using dancerName as studio (single name, not comma-separated): ${displayName}`);
      } else {
        // Last resort: use a generic name instead of dancer names
        displayName = 'STUDIO NAME';
        nameToStoreInDatabase = 'Studio Name'; // Store generic, NOT participant names
        console.error(`❌ Group performance - Studio name not found! Using fallback.`);
        console.error(`❌ studioName: ${studioName || 'N/A'}, dancerName: ${dancerName || 'N/A'}`);
        console.error(`❌ performanceType: ${performanceType}, isGroupPerformance: ${isGroupPerformance}`);
        console.error(`❌ NOT storing participant names in database for group performance!`);
      }
    } else {
      // For solo performances, use dancer name
      displayName = dancerName.toUpperCase();
      nameToStoreInDatabase = dancerName; // Store dancer name for solo
      console.log(`📝 Solo performance - Using dancer name: ${displayName}`);
    }
    
    console.log(`📝 Certificate display name: ${displayName}`);
    console.log(`📝 Name to store in database (certificates.dancer_name): ${nameToStoreInDatabase}`);
    console.log(`📝 isGroup: ${isGroupPerformance}, performanceType (from request): ${performanceType || 'null'}, inferredPerformanceType: ${inferredPerformanceType || 'null'}`);
    console.log(`📝 studioName from event_entries: ${studioName || 'N/A'}, dancerName: ${dancerName || 'N/A'}`);

    // Get event to check for custom certificate template
    let templatePublicId = 'Template_syz7di'; // Default template
    console.log('🔍 Certificate Generation - Checking for custom template...');
    console.log('   eventId from request:', eventId);
    console.log('   performanceId from request:', performanceId);
    
    // If eventId not provided, try to get it from performanceId
    let finalEventId = eventId;
    if (!finalEventId && performanceId) {
      try {
        const { db } = await import('@/lib/database');
        const performance = await db.getPerformanceById(performanceId);
        if (performance?.eventId) {
          finalEventId = performance.eventId;
          console.log('   ℹ️ Got eventId from performance:', finalEventId);
        }
      } catch (err) {
        console.warn('   ⚠️ Could not fetch performance to get eventId:', err);
      }
    }
    
    if (finalEventId) {
      try {
        const { db } = await import('@/lib/database');
        const event = await db.getEventById(finalEventId);
        console.log('   Event fetched:', event ? `Found event: ${event.name}` : 'Event not found');
        console.log('   certificateTemplateUrl:', event?.certificateTemplateUrl || 'NULL');
        
        // Type guard: ensure event is not null
        if (!event) {
          console.log('   ℹ️ Event not found, using default template');
        } else if (event.certificateTemplateUrl) {
          // Extract public_id from Cloudinary URL
          // Format: https://res.cloudinary.com/cloud_name/image/upload/v1234567890/folder/public_id.ext
          // Or: https://res.cloudinary.com/cloud_name/image/upload/v1234567890/folder/subfolder/public_id.ext
          try {
            const url = new URL(event.certificateTemplateUrl);
            console.log('   Parsing Cloudinary URL:', event.certificateTemplateUrl);
            
            const pathParts = url.pathname.split('/').filter(part => part.length > 0);
            const uploadIndex = pathParts.findIndex(part => part === 'upload');
            
            if (uploadIndex !== -1 && uploadIndex < pathParts.length - 1) {
              // Get everything after 'upload', skip version (v1234567890), keep folder and public_id
              const afterUpload = pathParts.slice(uploadIndex + 1);
              console.log('   Path parts after upload:', afterUpload);
              
              // Remove version and extension
              const filtered = afterUpload.filter((part, idx) => {
                // Skip version (v followed by numbers)
                if (idx === 0 && /^v\d+$/.test(part)) {
                  console.log('   Skipping version:', part);
                  return false;
                }
                return part.length > 0;
              });
              
              // Remove file extension from last part
              if (filtered.length > 0) {
                const lastPart = filtered[filtered.length - 1];
                filtered[filtered.length - 1] = lastPart.replace(/\.(pdf|png|jpg|jpeg)$/i, '');
                console.log('   Removed extension from:', lastPart, '→', filtered[filtered.length - 1]);
              }
              
              templatePublicId = filtered.join('/');
              console.log('✅ Using custom template with public_id:', templatePublicId);
            } else {
              console.warn('   ⚠️ Could not find "upload" in path, using default template');
              console.warn('   Path parts:', pathParts);
            }
          } catch (urlError) {
            console.error('   ❌ Could not parse certificate template URL, using default:', urlError);
            console.error('   URL was:', event?.certificateTemplateUrl || 'N/A');
          }
        } else {
          // event is guaranteed to be non-null here due to the type guard above
          console.log('   ℹ️ No custom template URL found, using default template');
          const eventInfo = {
            id: event.id,
            name: event.name,
            hasTemplateUrl: !!(event as any).certificateTemplateUrl
          };
          console.log('   Event object:', JSON.stringify(eventInfo));
        }
      } catch (err) {
        console.error('   ❌ Could not fetch event for custom template, using default:', err);
        console.error('   EventId used:', finalEventId);
      }
    } else {
      console.log('   ℹ️ No eventId provided, using default template');
      console.log('   eventId was:', eventId);
      console.log('   performanceId was:', performanceId);
    }
    
    console.log('   📋 Final template public_id:', templatePublicId);
    console.log('   📋 Will generate certificate with this template');

    // Generate certificate using Cloudinary with custom or default positioning
    const certificateUrl = cloudinary.url(templatePublicId, {
      transformation: [
        {
          overlay: {
            font_family: 'Montserrat',
            font_size: nameFontSize,
            font_weight: 'bold',
            text: displayName,
            letter_spacing: 2
          },
          color: 'white',
          gravity: 'north',
          y: Math.floor(nameTop * 13)
        },
        {
          overlay: {
            font_family: 'Montserrat',
            font_size: percentageFontSize,
            font_weight: 'bold',
            text: String(percentageValue) // Ensure it's a string, not empty
          },
          color: 'white',
          gravity: 'north_west',
          x: Math.floor(percentageLeft * 9),
          y: Math.floor(percentageTop * 13)
        },
        {
          overlay: {
            font_family: 'Montserrat',
            font_size: styleFontSize,
            font_weight: 'bold',
            text: style.toUpperCase()
          },
          color: 'white',
          gravity: 'north',
          x: Math.floor((styleLeft - 50) * 9),
          y: Math.floor(styleTop * 13)
        },
        {
          overlay: {
            font_family: 'Montserrat',
            font_size: titleFontSize,
            font_weight: 'bold',
            text: title.toUpperCase()
          },
          color: 'white',
          gravity: 'north',
          x: Math.floor((titleLeft - 50) * 9),
          y: Math.floor(titleTop * 13)
        },
        {
          overlay: {
            font_family: 'Montserrat',
            font_size: medallionFontSize,
            font_weight: 'bold',
            text: medallion.toUpperCase()
          },
          color: 'white',
          gravity: 'north',
          x: Math.floor((medallionLeft - 50) * 9),
          y: Math.floor(medallionTop * 13)
        },
        {
          overlay: {
            font_family: 'Montserrat',
            font_size: dateFontSize,
            text: eventDate
          },
          color: 'white',
          gravity: 'north',
          x: Math.floor((dateLeft - 50) * 9),
          y: Math.floor(dateTop * 13)
        }
      ],
      format: 'jpg',
      quality: 95
    });

    // Generate unique certificate ID
    const certificateId = `cert_${Date.now()}${Math.random().toString(36).substring(2, 9)}`;
    const createdAt = new Date().toISOString();

    // CRITICAL FIX: Save the correct name to certificates.dancer_name
    // For groups: store studio name (NOT participant names)
    // For solo: store dancer name
    // This ensures regeneration uses the correct value
    await sqlClient`
      INSERT INTO certificates (
        id, dancer_id, dancer_name, eodsa_id, email,
        performance_id, event_entry_id, percentage, style, title,
        medallion, event_date, certificate_url, created_at, created_by
      ) VALUES (
        ${certificateId}, ${dancerId}, ${nameToStoreInDatabase}, ${eodsaId || null}, ${email || null},
        ${performanceId || null}, ${eventEntryId || null}, ${percentage}, ${style}, ${title},
        ${medallion}, ${eventDate}, ${certificateUrl}, ${createdAt}, ${createdBy || null}
      )
    `;
    
    console.log(`💾 Saved certificate to database with dancer_name: ${nameToStoreInDatabase} (performance_type: ${performanceType || 'N/A'})`);

    return NextResponse.json({
      success: true,
      certificateId,
      certificateUrl,
      message: 'Certificate generated successfully'
    });

  } catch (error) {
    console.error('Error generating certificate:', error);
    return NextResponse.json(
      { error: 'Failed to generate certificate' },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve certificate by ID
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const certificateId = searchParams.get('id');
    const dancerId = searchParams.get('dancerId');

    const sqlClient = getSql();

    if (certificateId) {
      const result = await sqlClient`
        SELECT * FROM certificates WHERE id = ${certificateId}
      ` as any[];

      if (result.length === 0) {
        return NextResponse.json(
          { error: 'Certificate not found' },
          { status: 404 }
        );
      }

      return NextResponse.json(result[0]);
    }

    if (dancerId) {
      // Try to find certificates by dancer_id, eodsa_id, or by looking up the dancer first
      let result = await sqlClient`
        SELECT * FROM certificates
        WHERE dancer_id = ${dancerId}
        OR eodsa_id = ${dancerId}
        ORDER BY created_at DESC
      ` as any[];

      // If no results, try to get the EODSA ID from the dancers table
      if (result.length === 0) {
        const dancerInfo = await sqlClient`
          SELECT eodsa_id FROM dancers WHERE id = ${dancerId}
        ` as any[];

        if (dancerInfo.length > 0 && dancerInfo[0].eodsa_id) {
          result = await sqlClient`
            SELECT * FROM certificates
            WHERE eodsa_id = ${dancerInfo[0].eodsa_id}
            ORDER BY created_at DESC
          ` as any[];
        }
      }

      // If still no results, check for group/duo entries where this dancer is a participant
      // This handles certificates for group/duo performances
      if (result.length === 0) {
        try {
          // Find performances where this dancer is a participant
          const performanceResults = await sqlClient`
            SELECT DISTINCT p.id
            FROM performances p
            JOIN event_entries ee ON p.event_entry_id = ee.id
            WHERE ee.participant_ids::text ILIKE ${'%' + dancerId + '%'}
            OR p.participant_names::text ILIKE ${'%' + dancerId + '%'}
          ` as any[];

          if (performanceResults.length > 0) {
            const performanceIds = performanceResults.map(r => r.id);
            // Get certificates for these performances
            result = await sqlClient`
              SELECT * FROM certificates
              WHERE performance_id = ANY(${performanceIds})
              ORDER BY created_at DESC
            ` as any[];
          }
        } catch (groupError) {
          console.warn('Error checking group/duo certificates:', groupError);
          // Continue with empty result
        }
      }

      // Map database fields (snake_case) to frontend format (camelCase)
      const mappedResult = result.map((cert: any) => ({
        id: cert.id,
        dancerName: cert.dancer_name,
        eodsaId: cert.eodsa_id,
        email: cert.email,
        percentage: parseFloat(cert.percentage),
        style: cert.style,
        title: cert.title,
        medallion: cert.medallion,
        eventDate: cert.event_date,
        certificateUrl: cert.certificate_url,
        sentAt: cert.sent_at,
        downloaded: cert.downloaded,
        createdAt: cert.created_at
      }));

      return NextResponse.json(mappedResult);
    }

    return NextResponse.json(
      { error: 'Missing certificateId or dancerId parameter' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error fetching certificate:', error);
    return NextResponse.json(
      { error: 'Failed to fetch certificate' },
      { status: 500 }
    );
  }
}
