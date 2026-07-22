import { NextResponse } from 'next/server';
import { db, unifiedDb, getSql } from '@/lib/database';
import { resolveEventRegistrationFee } from '@/lib/event-pricing';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eodsaId: string }> }
) {
  try {
    const { eodsaId } = await params;
    
    // Get the dancer info with registration fee data
    const sqlClient = getSql();
    const dancerResult = await sqlClient`
      SELECT * FROM dancers WHERE eodsa_id = ${eodsaId}
    ` as any[];
    
    if (dancerResult.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Dancer not found' },
        { status: 404 }
      );
    }
    
    const row = dancerResult[0];
    const dancer = {
      id: row.id,
      eodsaId: row.eodsa_id,
      name: row.name,
      age: row.age,
      dateOfBirth: row.date_of_birth,
      nationalId: row.national_id,
      email: row.email,
      phone: row.phone,
      guardianName: row.guardian_name,
      guardianEmail: row.guardian_email,
      guardianPhone: row.guardian_phone,
      approved: row.approved,
      approvedBy: row.approved_by,
      approvedAt: row.approved_at,
      rejectionReason: row.rejection_reason,
      createdAt: row.created_at,
      registrationFeePaid: row.registration_fee_paid || false,
      registrationFeePaidAt: row.registration_fee_paid_at,
      registrationFeeMasteryLevel: row.registration_fee_mastery_level
    };

    // Get all event entries
    const allEntries = await db.getAllEventEntries();
    
    // Filter entries related to this dancer
    const relatedEntries = allEntries.filter(entry => {
      // Entry is related if:
      // 1. The dancer is the main contestant (entry.eodsaId === eodsaId)
      // 2. The dancer is a participant in the entry (participantIds includes dancer.id)
      return entry.eodsaId === eodsaId || 
             entry.participantIds.includes(dancer.id);
    });

    // Get all events to include event names
    const allEvents = await db.getAllEvents();
    const eventMap = allEvents.reduce((map, event) => {
      map[event.id] = event;
      return map;
    }, {} as Record<string, any>);

    // Process entries to add additional context
    const enhancedEntries = await Promise.all(
      relatedEntries.map(async (entry) => {
        const event = eventMap[entry.eventId];
        
        // Determine the dancer's role in this entry
        let participationRole = 'solo';
        let isMainContestant = entry.eodsaId === eodsaId;
        
        if (entry.participantIds.length > 1) {
          if (entry.participantIds.length === 2) participationRole = 'duet';
          else if (entry.participantIds.length === 3) participationRole = 'trio';
          else participationRole = 'group';
        }

        // Get all participant names for group entries
        let participantNames: string[] = [];
        if (entry.participantIds.length > 1) {
          participantNames = await Promise.all(
            entry.participantIds.map(async (participantId) => {
              try {
                const participant = await unifiedDb.getDancerById(participantId);
                return participant ? participant.name : 'Unknown Dancer';
              } catch (error) {
                return 'Unknown Dancer';
              }
            })
          );
        }

        // Calculate this dancer's share of the fee
        let dancerShare = entry.calculatedFee;
        if (entry.participantIds.length > 1 && !isMainContestant) {
          // For group entries where this dancer is not the main contestant,
          // we assume they share the cost equally (this might need business logic adjustment)
          dancerShare = entry.calculatedFee / entry.participantIds.length;
        }

        return {
          ...entry,
          eventName: event?.name || 'Unknown Event',
          eventDate: event?.eventDate,
          participationRole,
          isMainContestant,
          participantNames,
          dancerShare,
          isGroupEntry: entry.participantIds.length > 1
        };
      })
    );

    // Separate solo and group entries for display
    const soloEntries = enhancedEntries.filter(entry => entry.participationRole === 'solo');
    const groupEntries = enhancedEntries.filter(entry => entry.participationRole !== 'solo');

    const registrationFlags = await sqlClient`
      SELECT event_id, charged_at
      FROM registration_charged_flags
      WHERE eodsa_id = ${eodsaId}
    ` as Array<{ event_id: string; charged_at: string }>;

    const chargedEventIds = new Set(registrationFlags.map((row) => row.event_id));
    const eventIdsWithEntries = [...new Set(relatedEntries.map((entry) => entry.eventId))];

    const registrationByEvent = eventIdsWithEntries.map((eventId) => {
      const event = eventMap[eventId];
      const amount = resolveEventRegistrationFee(event || {});
      const charged = chargedEventIds.has(eventId);
      const flag = registrationFlags.find((row) => row.event_id === eventId);
      return {
        eventId,
        eventName: event?.name || 'Unknown Event',
        amount,
        charged,
        chargedAt: flag?.charged_at || null,
        outstanding: amount > 0 && !charged ? amount : 0,
      };
    });

    const registrationFeePaidTotal = registrationByEvent
      .filter((item) => item.charged)
      .reduce((sum, item) => sum + item.amount, 0);

    const registrationFeeOutstanding = registrationByEvent
      .reduce((sum, item) => sum + item.outstanding, 0);
    
    const unpaidEntries = enhancedEntries.filter(entry => entry.paymentStatus !== 'paid');
    const totalEntryOutstanding = unpaidEntries.reduce((total, entry) => {
      return total + (entry.dancerShare || 0);
    }, 0);

    const totalOutstanding = registrationFeeOutstanding + totalEntryOutstanding;

    const paidEntries = enhancedEntries.filter(entry => entry.paymentStatus === 'paid');
    const totalEntryPaid = paidEntries.reduce((total, entry) => {
      return total + (entry.dancerShare || 0);
    }, 0);
    const totalPaid = totalEntryPaid + registrationFeePaidTotal;

    return NextResponse.json({
      success: true,
      dancer: {
        id: dancer.id,
        name: dancer.name,
        eodsaId: dancer.eodsaId,
        registrationFeePaid: dancer.registrationFeePaid || false,
        registrationFeePaidAt: dancer.registrationFeePaidAt,
        registrationFeeMasteryLevel: dancer.registrationFeeMasteryLevel
      },
      financial: {
        registrationFeeAmount: registrationByEvent.reduce((sum, item) => sum + item.amount, 0),
        registrationFeePaidTotal,
        registrationFeeOutstanding,
        registrationByEvent,
        totalEntryOutstanding,
        totalOutstanding,
        totalPaid,
        totalEntryPaid,
      },
      entries: {
        all: enhancedEntries,
        solo: soloEntries,
        group: groupEntries,
        totalEntries: enhancedEntries.length,
        soloCount: soloEntries.length,
        groupCount: groupEntries.length
      }
    });

  } catch (error) {
    console.error('Error fetching dancer finances:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch dancer financial data' },
      { status: 500 }
    );
  }
}