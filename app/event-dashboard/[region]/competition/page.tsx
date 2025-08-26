'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { PERFORMANCE_TYPES, MASTERY_LEVELS, ITEM_STYLES } from '@/lib/types';
import CountdownTimer from '@/app/components/CountdownTimer';
import { useToast } from '@/components/ui/simple-toast';
import MusicUpload from '@/components/MusicUpload';

interface Event {
  id: string;
  name: string;
  description: string;
  region: string;
  ageCategory: string;
  performanceType: string;
  eventDate: string;
  registrationDeadline: string;
  venue: string;
  status: string;
  maxParticipants?: number;
  entryFee: number;
}

interface Contestant {
  id: string;
  eodsaId: string;
  name: string;
  email: string;
  phone: string;
  type: 'studio' | 'private';
  studioName?: string;
  dancers: {
    id: string;
    name: string;
    age: number;
    style: string;
    nationalId: string;
  }[];
}

interface StudioSession {
  id: string;
  name: string;
  email: string;
  registrationNumber: string;
}

interface PerformanceEntry {
  id: string;
  performanceType: 'Solo' | 'Duet' | 'Trio' | 'Group';
  itemName: string;
  choreographer: string;
  mastery: string;
  itemStyle: string;
  estimatedDuration: string;
  participantIds: string[];
  participants: any[];
  ageCategory: string;
  fee: number;
  // PHASE 2: Live vs Virtual Entry Support
  entryType: 'live' | 'virtual';
  musicFileUrl?: string;
  musicFileName?: string;
  videoExternalUrl?: string;
  videoExternalType?: 'youtube' | 'vimeo' | 'other';
}

export default function CompetitionEntryPage() {
  const searchParams = useSearchParams();
  const params = useParams();
  const router = useRouter();
  const { success, error, validationError } = useToast();
  const region = decodeURIComponent(params?.region as string || '');
  const eodsaId = searchParams?.get('eodsaId') || '';
  const studioId = searchParams?.get('studioId') || '';
  const eventId = searchParams?.get('eventId') || '';
  
  const [contestant, setContestant] = useState<Contestant | null>(null);
  const [studioInfo, setStudioInfo] = useState<StudioSession | null>(null);
  const [availableDancers, setAvailableDancers] = useState<any[]>([]);
  const [isStudioMode, setIsStudioMode] = useState(false);
  const [event, setEvent] = useState<Event | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [entries, setEntries] = useState<PerformanceEntry[]>([]);
  const [showAddForm, setShowAddForm] = useState<string | null>(null);
  const [currentForm, setCurrentForm] = useState({
    itemName: '',
    choreographer: '',
    mastery: 'Water (Competitive)',
    itemStyle: '',
    estimatedDuration: '',
    participantIds: [] as string[],
    ageCategory: 'All',
    // PHASE 2: Live vs Virtual Entry Support
    entryType: 'live' as 'live' | 'virtual',
    // For Live entries - music file
    musicFileUrl: '',
    musicFileName: '',
    // For Virtual entries - video file or URL
    videoExternalUrl: '',
    videoExternalType: 'youtube' as 'youtube' | 'vimeo' | 'other'
  });
  const [savedForms, setSavedForms] = useState<Record<string, typeof currentForm>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<{entries: number, totalFee: number} | null>(null);

  useEffect(() => {
    if (region && eventId) {
      if (eodsaId) {
        setIsStudioMode(false);
        loadContestant(eodsaId);
      } else if (studioId) {
        setIsStudioMode(true);
        loadStudioData(studioId);
      }
      loadEvent(eventId);
    }
  }, [region, eodsaId, studioId, eventId]);

  // Auto-select current dancer when opening Solo form for independent dancers
  useEffect(() => {
    if (showAddForm === 'Solo' && !isStudioMode && contestant && contestant.type === 'private') {
      if (contestant.dancers.length > 0 && currentForm.participantIds.length === 0) {
        console.log(`🎭 Auto-selecting dancer for Solo form: ${contestant.dancers[0].name}`);
        setCurrentForm(prev => ({
          ...prev,
          participantIds: [contestant.dancers[0].id]
        }));
      }
    }
  }, [showAddForm, isStudioMode, contestant, currentForm.participantIds]);

  const loadContestant = async (id: string) => {
    setIsLoading(true);
    try {
      console.log(`🎭 Loading contestant for competition entry: ${id}`);
      
      // Try unified system first (new dancers)
      console.log(`🔍 Fetching: /api/dancers/by-eodsa-id/${id}`);
      const unifiedResponse = await fetch(`/api/dancers/by-eodsa-id/${id}`);
      console.log(`📡 Unified response status: ${unifiedResponse.status}`);
      
      if (unifiedResponse.ok) {
        const unifiedData = await unifiedResponse.json();
        console.log(`📦 Unified response data:`, unifiedData);
        
        if (unifiedData.success && unifiedData.dancer) {
          const dancer = unifiedData.dancer;
          const isStudioLinked = dancer.studioAssociation !== null;
          
          console.log(`✅ Loaded dancer: ${dancer.name}, Studio linked: ${isStudioLinked}`);
          
          const contestantData = {
            id: dancer.id,
            eodsaId: dancer.eodsaId,
            name: dancer.name,
            email: dancer.email || '',
            phone: dancer.phone || '',
            type: isStudioLinked ? ('studio' as const) : ('private' as const),
            studioName: dancer.studioAssociation?.studioName,
            dancers: [{
              id: dancer.id,
              name: dancer.name,
              age: dancer.age,
              style: '',
              nationalId: dancer.nationalId
            }]
          };
          
          setContestant(contestantData);
          
          // For solo dancers, add them to availableDancers so they can select themselves
          const availableDancerData = {
            id: dancer.id,
            name: dancer.name,
            fullName: dancer.name,
            eodsaId: dancer.eodsaId,
            age: dancer.age,
            nationalId: dancer.nationalId
          };
          
          console.log(`🎭 Setting available dancers:`, [availableDancerData]);
          setAvailableDancers([availableDancerData]);
          
          // Auto-select the dancer as participant for independent dancers
          if (!isStudioLinked) {
            console.log(`🎭 Auto-selecting independent dancer: ${dancer.name}`);
            setCurrentForm(prev => ({
              ...prev,
              participantIds: [dancer.id]
            }));
          }
          setIsLoading(false);
          return;
        } else {
          console.log(`⚠️ Unified API returned but no dancer found: ${JSON.stringify(unifiedData)}`);
        }
      } else {
        console.log(`❌ Unified API failed with status ${unifiedResponse.status}`);
        const errorText = await unifiedResponse.text();
        console.log(`❌ Unified API error response:`, errorText);
      }
      
      // Fallback to legacy system (contestants)
      console.log(`🔄 Trying legacy system for: ${id}`);
      console.log(`🔍 Fetching: /api/contestants/by-eodsa-id/${id}`);
      const legacyResponse = await fetch(`/api/contestants/by-eodsa-id/${id}`);
      console.log(`📡 Legacy response status: ${legacyResponse.status}`);
      
      if (legacyResponse.ok) {
        const legacyData = await legacyResponse.json();
        console.log(`✅ Loaded legacy contestant:`, legacyData);
        
        // For independent dancers, if no dancers exist, create dancer from contestant data
        if (legacyData.type === 'private' && (!legacyData.dancers || legacyData.dancers.length === 0)) {
          console.log(`🎭 Creating dancer entry for independent contestant: ${legacyData.name}`);
          
          // Calculate age from date of birth
          let age = 18; // Default age
          if (legacyData.dateOfBirth) {
            const birthDate = new Date(legacyData.dateOfBirth);
            const today = new Date();
            age = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
              age--;
            }
          }
          
          // Create dancer entry from contestant data
          const dancerEntry = {
            id: legacyData.id, // Use contestant ID as dancer ID
            name: legacyData.name,
            age: age,
            style: '',
            nationalId: legacyData.eodsaId
          };
          
          // Add dancer to contestant data
          legacyData.dancers = [dancerEntry];
          console.log(`✅ Created dancer entry:`, dancerEntry);
        }
        
        setContestant(legacyData);
        
        // For legacy contestants, also add them to availableDancers
        if (legacyData.dancers && legacyData.dancers.length > 0) {
          const mappedDancers = legacyData.dancers.map((dancer: any) => ({
            id: dancer.id,
            name: dancer.name,
            fullName: dancer.name,
            eodsaId: dancer.nationalId || legacyData.eodsaId,
            age: dancer.age
          }));
          console.log(`🎭 Setting legacy available dancers:`, mappedDancers);
          setAvailableDancers(mappedDancers);
          
          // Auto-select for private contestants
          if (legacyData.type === 'private' && legacyData.dancers.length > 0) {
            console.log(`🎭 Auto-selecting legacy private dancer: ${legacyData.dancers[0].name}`);
            setCurrentForm(prev => ({
              ...prev,
              participantIds: [legacyData.dancers[0].id]
            }));
          }
        } else {
          console.log(`⚠️ Legacy contestant has no dancers: ${JSON.stringify(legacyData)}`);
        }
      } else {
        console.log(`❌ Legacy API failed with status ${legacyResponse.status}`);
        const errorText = await legacyResponse.text();
        console.log(`❌ Legacy API error response:`, errorText);
      }
      
      console.log(`❌ No dancer found in either system for EODSA ID: ${id}`);
      
    } catch (error) {
      console.error('❌ Failed to load contestant:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadStudioData = async (id: string) => {
    try {
      const studioSession = localStorage.getItem('studioSession');
      if (!studioSession) {
        router.push('/studio-login');
        return;
      }

      const parsedSession = JSON.parse(studioSession);
      if (parsedSession.id !== id) {
        router.push('/studio-login');
        return;
      }

      const response = await fetch(`/api/studios/dancers-new?studioId=${id}`);
      const data = await response.json();
      
      if (data.success) {
        setStudioInfo(parsedSession);
        setAvailableDancers(data.dancers);
      }
    } catch (error) {
      console.error('Failed to load studio data:', error);
    }
  };

  const loadEvent = async (id: string) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/events');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const selectedEvent = data.events.find((e: Event) => e.id === id);
          setEvent(selectedEvent || null);
        }
      }
    } catch (error) {
      console.error('Failed to load event:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getParticipantRequirements = (performanceType: string) => {
    const typeInfo = PERFORMANCE_TYPES[performanceType as keyof typeof PERFORMANCE_TYPES];
    if (typeInfo) {
      return { description: typeInfo.description };
    }
    switch (performanceType) {
      case 'Solo': return { description: 'Individual performance' };
      case 'Duet': return { description: 'Two dancers together' };
      case 'Trio': return { description: 'Three dancers together' };
      case 'Group': return { description: '4+ dancers together' };
      default: return { description: 'Performance' };
    }
  };

  const getStartingFee = (performanceType: string) => {
    if (performanceType === 'Solo') {
      return 5; // R5 for 1 solo (TESTING - plus R5 registration)
    } else if (performanceType === 'Duet' || performanceType === 'Trio') {
      return 280; // R280 per person (plus R5 registration each)
    } else if (performanceType === 'Group') {
      return 220; // R220 per person for small groups (plus R5 registration each)
    }
    return 0;
  };

  const getFeeExplanation = (performanceType: string) => {
    if (performanceType === 'Solo') {
      return 'Solo packages (TESTING): 1 solo R5, 2 solos R10, 3 solos R15, 4 solos R20, 5th FREE. Plus R5 registration.';
    } else if (performanceType === 'Duet' || performanceType === 'Trio') {
      return 'R280 per person + R5 registration each';
    } else if (performanceType === 'Group') {
      return 'Small groups (4-9): R220pp, Large groups (10+): R190pp. Plus R5 registration each.';
    }
    return 'Per person + R5 registration each';
  };

  // NEW: Helper function to get maximum duration display for performance type
  const getMaxDurationDisplay = (performanceType: string) => {
    const TIME_LIMITS = {
      'Solo': 2,
      'Duet': 3,
      'Trio': 3,
      'Group': 3.5
    };
    const maxTime = TIME_LIMITS[performanceType as keyof typeof TIME_LIMITS] || 0;
    return maxTime === 3.5 ? '3:30' : `${maxTime}:00`;
  };

  // NEW: Helper function to determine age category based on average age
  const getCalculatedAgeCategory = () => {
    if (!currentForm.participantIds.length || !availableDancers.length) {
      return 'All Ages';
    }

    const selectedParticipants = availableDancers.filter(dancer => 
      currentForm.participantIds.includes(dancer.id)
    );

    if (selectedParticipants.length === 0) {
      return 'All Ages';
    }

    // Calculate average age of all participants
    const totalAge = selectedParticipants.reduce((sum, dancer) => sum + dancer.age, 0);
    const averageAge = Math.round(totalAge / selectedParticipants.length);
    
    // Determine age category based on average age
    if (averageAge <= 4) return '4 & Under';
    if (averageAge <= 6) return '6 & Under';
    if (averageAge <= 9) return '7-9';
    if (averageAge <= 12) return '10-12';
    if (averageAge <= 14) return '13-14';
    if (averageAge <= 17) return '15-17';
    if (averageAge <= 24) return '18-24';
    if (averageAge <= 39) return '25-39';
    if (averageAge < 60) return '40+';
    return '60+';
  };

  const getParticipantLimits = (performanceType: string) => {
    switch (performanceType) {
      case 'Solo': return { min: 1, max: 1 };
      case 'Duet': return { min: 2, max: 2 };
      case 'Trio': return { min: 3, max: 3 };
      case 'Group': return { min: 4, max: 10 };
      default: return { min: 1, max: 10 };
    }
  };

  const calculateEntryFee = (performanceType: string, participantCount: number) => {
    if (performanceType === 'Solo') {
      // Solo packages: 1 solo R5 (TESTING), 2 solos R10, 3 solos R15, 4 solos R20, 5th FREE
      const soloCount = entries.filter(entry => entry.performanceType === 'Solo').length + 1; // +1 for current entry
      if (soloCount === 1) return 5; // TESTING: Changed from R400 to R5
      if (soloCount === 2) return 10 - 5; // R5 for 2nd solo (total R10)
      if (soloCount === 3) return 15 - 10; // R5 for 3rd solo (total R15)
      if (soloCount === 4) return 20 - 15; // R5 for 4th solo (total R20)
      if (soloCount >= 5) return 0; // 5th solo is FREE
      return 5; // TESTING: Changed from R400 to R5
    } else if (performanceType === 'Duet' || performanceType === 'Trio') {
      return 280 * participantCount;
    } else if (performanceType === 'Group') {
      return participantCount <= 9 ? 220 * participantCount : 190 * participantCount;
    }
    return 0;
  };

  const handleAddPerformanceType = (performanceType: string) => {
    // Save current form state if switching from another form
    if (showAddForm && showAddForm !== performanceType) {
      setSavedForms(prev => ({
        ...prev,
        [showAddForm]: currentForm
      }));
    }
    
    setShowAddForm(performanceType);
    
    // Restore saved form state or use default
    const savedForm = savedForms[performanceType];
    if (savedForm) {
      setCurrentForm(savedForm);
    } else {
      setCurrentForm({
        itemName: '',
        choreographer: '',
        mastery: 'Water (Competitive)',
        itemStyle: '',
        estimatedDuration: '',
        participantIds: [],
        ageCategory: 'All',
        entryType: 'live' as 'live' | 'virtual',
        musicFileUrl: '',
        musicFileName: '',
        videoExternalUrl: '',
        videoExternalType: 'youtube' as 'youtube' | 'vimeo' | 'other'
      });
    }
  };

  const handleSaveEntry = () => {
    if (!showAddForm || currentForm.participantIds.length === 0 || !currentForm.itemName) {
      return;
    }

    const limits = getParticipantLimits(showAddForm);
    if (currentForm.participantIds.length < limits.min || currentForm.participantIds.length > limits.max) {
      // Add some visual feedback that the form is invalid
      console.warn('Invalid participant selection:', {
        selected: currentForm.participantIds.length,
        required: `${limits.min}-${limits.max}`,
        performanceType: showAddForm
      });
      return;
    }

    // PHASE 2: Validate entry type requirements
    if (currentForm.entryType === 'live' && !currentForm.musicFileUrl) {
      validationError('Please upload a music file for live performances.');
      return;
    }
    
    if (currentForm.entryType === 'virtual' && !currentForm.videoExternalUrl) {
      validationError('Please provide a video URL for virtual performances.');
      return;
    }

    const participants = availableDancers.filter(dancer => 
      currentForm.participantIds.includes(dancer.id)
    );

    const fee = calculateEntryFee(showAddForm, currentForm.participantIds.length);

    const newEntry: PerformanceEntry = {
      id: `entry-${Date.now()}`,
      performanceType: showAddForm as 'Solo' | 'Duet' | 'Trio' | 'Group',
      ...currentForm,
      participants,
      fee
    };

    setEntries(prev => [...prev, newEntry]);
    
    // Clear saved form state for this performance type
    setSavedForms(prev => {
      const newSavedForms = { ...prev };
      delete newSavedForms[showAddForm];
      return newSavedForms;
    });
    
    setShowAddForm(null);
  };

  const handleRemoveEntry = (entryId: string) => {
    setEntries(prev => {
      const newEntries = prev.filter(entry => entry.id !== entryId);
      
      // If we're removing a solo entry, recalculate solo fees for remaining entries
      const removedEntry = prev.find(entry => entry.id === entryId);
      if (removedEntry && removedEntry.performanceType === 'Solo') {
        const soloEntries = newEntries.filter(entry => entry.performanceType === 'Solo');
        
        // Recalculate solo fees based on new positioning
        soloEntries.forEach((entry, index) => {
          const soloCount = index + 1;
          if (soloCount === 1) entry.fee = 5; // TESTING: Changed from 400 to 5
          else if (soloCount === 2) entry.fee = 10 - 5; // R5 for 2nd solo (TESTING)
          else if (soloCount === 3) entry.fee = 15 - 10; // R5 for 3rd solo (TESTING)
          else if (soloCount === 4) entry.fee = 20 - 15; // R5 for 4th solo (TESTING)
          else if (soloCount >= 5) entry.fee = 0; // 5th+ solo is FREE
        });
      }
      
      return newEntries;
    });
  };

  const calculateTotalFee = () => {
    const performanceFee = entries.reduce((total, entry) => total + entry.fee, 0);
    const uniqueParticipants = new Set();
    entries.forEach(entry => {
      entry.participantIds.forEach(id => uniqueParticipants.add(id));
    });
    const registrationFee = uniqueParticipants.size * 5; // TESTING: Changed from 300 to 5
    return { performanceFee, registrationFee, total: performanceFee + registrationFee };
  };

  const getPreviewFee = () => {
    if (!showAddForm || currentForm.participantIds.length === 0) return 0;
    
    // Only show fee if validation passes
    const limits = getParticipantLimits(showAddForm);
    if (currentForm.participantIds.length < limits.min || currentForm.participantIds.length > limits.max) {
      return 0;
    }
    
    return calculateEntryFee(showAddForm, currentForm.participantIds.length);
  };

  // Test payment function - creates a real test entry then initiates R5 payment
  const handleTestPayment = async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);

    try {
      success('Creating test entry and initiating R5 payment...');
      
      // Debug logging
      console.log('🔍 Debug data:', {
        isStudioMode,
        studioInfo,
        contestant,
        availableDancers,
        eventId
      });
      
      // Step 1: Get valid participant IDs (dancers)
      let validParticipantIds: string[] = [];
      let participantName = 'Test Participant';
      
      if (isStudioMode && availableDancers && availableDancers.length > 0) {
        // Use the first available dancer from the studio
        const dancer = availableDancers[0];
        if (dancer && dancer.id) {
          validParticipantIds = [dancer.id];
          participantName = dancer.name || 'Studio Dancer';
          console.log('✅ Using studio dancer:', dancer);
        } else {
          throw new Error('Studio dancer data is invalid - missing ID');
        }
      } else if (!isStudioMode && contestant?.dancers && contestant.dancers.length > 0) {
        // Use the first dancer from the contestant
        const dancer = contestant.dancers[0];
        if (dancer && dancer.id) {
          validParticipantIds = [dancer.id];
          participantName = dancer.name || 'Individual Dancer';
          console.log('✅ Using contestant dancer:', dancer);
        } else {
          throw new Error('Contestant dancer data is invalid - missing ID');
        }
      } else if (!isStudioMode && contestant && contestant.id) {
        // For individual contestants without separate dancer entries, use contestant as participant
        validParticipantIds = [contestant.id];
        participantName = contestant.name || 'Individual Contestant';
        console.log('✅ Using contestant as participant:', contestant);
      } else {
        // No valid dancers available
        console.error('❌ No valid dancers found:', {
          isStudioMode,
          availableDancers,
          contestant,
          availableDancersCount: availableDancers?.length || 0,
          contestantDancersCount: contestant?.dancers?.length || 0
        });
        throw new Error('No dancers available for test entry. Please ensure you have dancers registered.');
      }
      
      // Step 2: Create a real test entry
      const testEntryData = {
        eventId: eventId,
        contestantId: isStudioMode ? studioInfo?.id : contestant?.id,
        eodsaId: isStudioMode ? studioInfo?.registrationNumber : contestant?.eodsaId,
        participantIds: validParticipantIds, // Use actual dancer IDs
        calculatedFee: 5.00, // R5 test fee
        itemName: `🧪 TEST ENTRY - ${participantName} - R5 Payment Test`,
        choreographer: 'Test Choreographer',
        mastery: 'Water (Competitive)',
        itemStyle: 'Test Style',
        estimatedDuration: 2,
        entryType: 'live' as const,
        musicFileUrl: null,
        musicFileName: null,
        videoExternalUrl: null,
        videoExternalType: null,
        performanceType: 'Solo'
      };
      
      console.log('📝 Creating test entry with data:', testEntryData);

      // Create the test entry first
      const createEntryResponse = await fetch('/api/event-entries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testEntryData),
      });

      if (!createEntryResponse.ok) {
        const errorData = await createEntryResponse.json();
        throw new Error(errorData.error || 'Failed to create test entry');
      }

      const { eventEntry } = await createEntryResponse.json();
      success(`Test entry created: ${eventEntry.id}`);

      // Step 2: Initiate payment for the real entry
      const testPaymentData = {
        entryId: eventEntry.id, // Use the real entry ID
        eventId: eventId,
        userId: isStudioMode ? studioInfo?.id : contestant?.id,
        userFirstName: isStudioMode ? 'Test Studio' : (contestant?.name?.split(' ')[0] || 'Test'),
        userLastName: isStudioMode ? 'Payment' : (contestant?.name?.split(' ').slice(1).join(' ') || 'User'),
        userEmail: isStudioMode ? (studioInfo?.email || 'teststudio@eodsa.test') : (contestant?.email || 'testuser@eodsa.test'),
        amount: 5.00, // Fixed R5 for testing
        itemName: 'TEST PAYMENT - Competition Entry',
        itemDescription: `Test payment for entry: ${eventEntry.itemName}`,
        isBatchPayment: false // This is now a real entry payment
      };

      const paymentResponse = await fetch('/api/payments/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testPaymentData),
      });

      if (paymentResponse.ok) {
        // Response should be HTML for PayFast redirect
        const paymentHtml = await paymentResponse.text();
        
        // Create a new window/tab with the payment form
        const paymentWindow = window.open('', '_blank');
        if (paymentWindow) {
          paymentWindow.document.write(paymentHtml);
          paymentWindow.document.close();
          success('Test entry created and payment initiated! Complete the payment in the new window.');
        } else {
          throw new Error('Unable to open payment window. Please check your popup blocker.');
        }
      } else {
        const errorData = await paymentResponse.json();
        throw new Error(errorData.error || 'Failed to initiate test payment');
      }
    } catch (testError: any) {
      console.error('Test payment error:', testError);
      error(`Failed to create test entry or initiate payment: ${testError.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProceedToPayment = async () => {
    if (entries.length === 0 || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const totalFee = calculateTotalFee().total;
      
      // For multiple entries, we'll create a batch payment
      // First, store entry data temporarily and get payment URL
      const batchEntryData = entries.map(entry => ({
        eventId: eventId,
        contestantId: isStudioMode ? studioInfo?.id : contestant?.id,
        eodsaId: isStudioMode ? studioInfo?.registrationNumber : contestant?.eodsaId,
        participantIds: entry.participantIds,
        calculatedFee: entry.fee,
        itemName: entry.itemName,
        choreographer: entry.choreographer,
        mastery: entry.mastery,
        itemStyle: entry.itemStyle,
        estimatedDuration: parseFloat(entry.estimatedDuration.replace(':', '.')) || 2,
        entryType: entry.entryType,
        musicFileUrl: entry.musicFileUrl || null,
        musicFileName: entry.musicFileName || null,
        videoExternalUrl: entry.videoExternalUrl || null,
        videoExternalType: entry.videoExternalType || null,
        performanceType: entry.performanceType
      }));

      // Store entry data in session storage for after payment
      sessionStorage.setItem('pendingEntries', JSON.stringify(batchEntryData));
      sessionStorage.setItem('paymentAmount', totalFee.toString());
      sessionStorage.setItem('paymentEventId', eventId);
      sessionStorage.setItem('paymentEventName', event?.name || 'Competition Entry');

      // Create payment request
      const firstEntry = entries[0];
      const userName = isStudioMode ? 
        (studioInfo?.name || 'Studio Manager') : 
        (contestant?.name || 'Contestant');
      
      const [firstName, ...lastNameParts] = userName.split(' ');
      const lastName = lastNameParts.join(' ') || 'User';
      
      const userEmail = isStudioMode ? 
        (studioInfo?.email || 'studio@example.com') : 
        (contestant?.email || 'contestant@example.com');

      const paymentData = {
        entryId: 'BATCH_' + Date.now(), // Temporary batch ID
        eventId: eventId,
        userId: isStudioMode ? studioInfo?.id : contestant?.id,
        userFirstName: firstName,
        userLastName: lastName,
        userEmail: userEmail,
        amount: totalFee,
        itemName: `${entries.length} Competition Entries`,
        itemDescription: entries.map(e => `${e.performanceType}: ${e.itemName}`).join(', '),
        isBatchPayment: true // Flag to indicate this is for batch entries
      };

      console.log('🔄 Redirecting to payment for batch entries:', {
        entriesCount: entries.length,
        totalAmount: totalFee,
        paymentData
      });

      // Redirect to payment processing
      const response = await fetch('/api/payments/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paymentData),
      });

      if (response.ok) {
        // Response should be HTML for PayFast redirect
        const paymentHtml = await response.text();
        
        // Create a new window/tab with the payment form
        const paymentWindow = window.open('', '_self');
        if (paymentWindow) {
          paymentWindow.document.write(paymentHtml);
          paymentWindow.document.close();
        } else {
          throw new Error('Unable to open payment window. Please check your popup blocker.');
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to initiate payment');
      }
      setSubmissionResult({ entries: entries.length, totalFee });
      setShowSuccessModal(true);
      
      // Navigation is now handled by the modal buttons
    } catch (submitError: any) {
      console.error('Error during submission:', submitError);
      error(`Error during submission: ${submitError.message || 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!region || (!eodsaId && !studioId) || !eventId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-gray-800/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-gray-700/20 p-8 text-center">
          <div className="text-6xl mb-6">❌</div>
          <h2 className="text-2xl font-bold text-white mb-4">Missing Information</h2>
          <p className="text-gray-300 mb-6">Authentication or event information not provided.</p>
          <Link 
            href="/"
            className="block w-full px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl hover:from-purple-600 hover:to-pink-700 transition-all duration-300 font-semibold"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading || !event) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-8">
            <div className="absolute inset-0 rounded-full border-4 border-purple-500/20"></div>
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-purple-500 animate-spin"></div>
            <div className="absolute inset-2 rounded-full border-4 border-transparent border-t-pink-500 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl">🎭</span>
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-white">Loading Competition</h3>
            <p className="text-slate-400 text-sm">Preparing performance options...</p>
                  </div>
      </div>

    </div>
  );
}

  // Calculate fees in real-time
  const feeCalculation = calculateTotalFee();
  const previewFee = getPreviewFee();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 pb-safe-bottom">
      {/* Add mobile-specific bottom padding to prevent iPhone search bar from covering buttons */}
      <style jsx global>{`
        @supports(padding: max(0px)) {
          .pb-safe-bottom {
            padding-bottom: max(env(safe-area-inset-bottom, 0px), 100px);
          }
        }
        
        /* Fallback for older browsers */
        @media screen and (max-width: 640px) {
          .pb-safe-bottom {
            padding-bottom: 120px;
          }
        }
        
        /* iPhone specific adjustments */
        @media screen and (max-width: 414px) and (min-height: 800px) {
          .pb-safe-bottom {
            padding-bottom: 140px;
          }
        }
      `}</style>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-lg border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          {/* Back Navigation */}
          <div className="mb-4">
            <Link 
              href={isStudioMode ? `/event-dashboard/${region}?studioId=${studioId}` : `/`}
              className="inline-flex items-center space-x-2 px-3 py-2 bg-slate-800/80 text-slate-300 rounded-lg hover:bg-slate-700 transition-all duration-300 group text-sm"
            >
              <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>{isStudioMode ? 'Back to Events' : 'Back to Main Portal'}</span>
            </Link>
          </div>

          {/* Event Header */}
          <div className="text-center">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-2">
              {event.name}
            </h1>
            <p className="text-slate-400 text-sm sm:text-base mb-4">Build your competition entry</p>
            
            {/* User Info */}
            {(contestant || studioInfo) && (
              <div className="bg-slate-800/60 backdrop-blur rounded-xl p-3 sm:p-4 inline-block max-w-full">
                {isStudioMode ? (
                  <div className="text-center sm:text-left">
                    <p className="text-slate-300 text-sm sm:text-base">
                      <span className="text-emerald-400 font-semibold">{studioInfo?.name}</span>
                    </p>
                    <p className="text-xs sm:text-sm text-slate-400">
                      Reg: {studioInfo?.registrationNumber} • {availableDancers.length} dancers
                    </p>
                  </div>
                ) : (
                  <div className="text-center sm:text-left">
                    <p className="text-slate-300 text-sm sm:text-base">
                      Welcome, <span className="text-purple-400 font-semibold">{contestant?.name}</span>
                    </p>
                    <p className="text-xs sm:text-sm text-slate-400">
                      ID: {contestant?.eodsaId}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Performance Type Selection and Forms */}
          <div className="lg:col-span-2">
            {/* Performance Type Selection */}
            <div className="bg-slate-800/60 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6 mb-8">
              <h3 className="text-xl font-bold text-white mb-4">Add Performance Types</h3>
                                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {['Solo', 'Duet', 'Trio', 'Group'].map((type) => {
                  const isActive = showAddForm === type;
                  const soloCount = entries.filter(e => e.performanceType === 'Solo').length;
                  const nextSoloFee = type === 'Solo' ? calculateEntryFee('Solo', 1) : 0;
                  
                  // For independent dancers (non-studio mode), only allow Solo
                  const isDisabled = !isStudioMode && type !== 'Solo';
                  
                  return (
                    <button
                      key={type}
                      onClick={() => !isDisabled && handleAddPerformanceType(type)}
                      disabled={isDisabled}
                      className={`p-4 sm:p-5 bg-gradient-to-r text-white rounded-xl transition-all duration-300 transform min-h-[120px] sm:min-h-[140px] ${
                        isDisabled 
                          ? 'from-gray-500 to-gray-600 cursor-not-allowed opacity-50' 
                          : isActive 
                            ? 'from-emerald-600 to-blue-600 ring-2 ring-emerald-400 animate-pulse hover:scale-[1.02] shadow-lg shadow-emerald-500/25' 
                            : 'from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 hover:scale-[1.02] shadow-lg hover:shadow-purple-500/25'
                      }`}
                    >
                       <div className="text-center">
                         <h4 className="text-lg font-semibold mb-2">
                           Add {type}
                           {isDisabled && <span className="block text-xs mt-1 opacity-75">Requires studio membership</span>}
                         </h4>
                         
                         {/* Dynamic pricing for Solo */}
                         {type === 'Solo' && (
                           <div className="text-sm mb-2">
                             <div className="font-semibold text-emerald-200">
                               Next: R{nextSoloFee}
                             </div>
                             {soloCount === 0 && <div className="text-xs opacity-75">1st Solo</div>}
                             {soloCount === 1 && <div className="text-xs opacity-75">2nd Solo (Package deal)</div>}
                             {soloCount === 2 && <div className="text-xs opacity-75">3rd Solo (Package deal)</div>}
                             {soloCount === 3 && <div className="text-xs opacity-75">4th Solo (Package deal)</div>}
                             {soloCount >= 4 && <div className="text-xs opacity-75">FREE!</div>}
                           </div>
                         )}
                         
                         {/* Static pricing for others */}
                         {type !== 'Solo' && (
                           <div className="text-sm mb-2">
                             <div className="font-semibold text-emerald-200">
                               From R{getStartingFee(type)}
                             </div>
                           </div>
                         )}
                         
                         <p className="text-xs opacity-90">
                           {getFeeExplanation(type)}
                         </p>
                       </div>
                     </button>
                   );
                 })}
               </div>
               
               {/* Information for independent dancers */}
               {!isStudioMode && (
                 <div className="mt-4 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                   <div className="flex items-center">
                     <svg className="w-5 h-5 text-blue-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                     </svg>
                     <span className="text-blue-300 font-medium">Independent Dancer Information</span>
                   </div>
                   <p className="text-blue-200 text-sm mt-1">
                     As an independent dancer, you can only register for <strong>Solo</strong> performances. 
                     Duet, Trio, and Group performances require studio membership with multiple dancers.
                   </p>
                 </div>
               )}
            </div>

                         {/* Entry Form */}
             {showAddForm && (
               <div className="bg-slate-800/60 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6 mb-8">
                 <div className="flex justify-between items-center mb-4">
                   <div>
                     <h3 className="text-xl font-semibold text-white">Add {showAddForm} Entry</h3>
                     {savedForms[showAddForm] && (
                       <p className="text-xs text-emerald-400 mt-1">✓ Form data restored</p>
                     )}
                   </div>
                  <button
                    onClick={() => {
                      // Save current form state before closing
                      setSavedForms(prev => ({
                        ...prev,
                        [showAddForm]: currentForm
                      }));
                      setShowAddForm(null);
                    }}
                    className="text-slate-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>
                
                <div className="grid grid-cols-1 gap-4 sm:gap-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-300 mb-3">Item Name *</label>
                      <input
                        type="text"
                        value={currentForm.itemName}
                        onChange={(e) => {
                          const value = e.target.value;
                          // Prevent empty strings with just spaces and enforce minimum length
                          if (value && value.trim().length > 0 && value.trim().length < 3) {
                            validationError('Item name must be at least 3 characters long.');
                          } else if (value && value.trim().length === 0) {
                            validationError('Item name cannot be empty or contain only spaces.');
                          }
                          setCurrentForm({...currentForm, itemName: value});
                        }}
                        className="w-full p-4 bg-slate-700/50 border-2 border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-base"
                        placeholder="Enter your performance title"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-semibold text-slate-300 mb-3">Choreographer *</label>
                      <input
                        type="text"
                        value={currentForm.choreographer}
                        onChange={(e) => {
                          const cleanValue = e.target.value.replace(/[^a-zA-Z\s\-\']/g, '');
                          setCurrentForm({...currentForm, choreographer: cleanValue});
                        }}
                        className="w-full p-4 bg-slate-700/50 border-2 border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-base"
                        placeholder="Who choreographed this piece?"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-300 mb-3">Mastery Level</label>
                      <select
                        value={currentForm.mastery}
                        onChange={(e) => setCurrentForm({...currentForm, mastery: e.target.value})}
                        className="w-full p-4 bg-slate-700/50 border-2 border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-base"
                      >
                        <option value="">Select mastery level</option>
                        {MASTERY_LEVELS.map((level) => (
                          <option key={level} value={level}>{level}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-semibold text-slate-300 mb-3">Item Style *</label>
                      <select
                        value={currentForm.itemStyle}
                        onChange={(e) => setCurrentForm({...currentForm, itemStyle: e.target.value})}
                        className="w-full p-4 bg-slate-700/50 border-2 border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-base"
                        required
                      >
                        <option value="">Select item style</option>
                        {ITEM_STYLES.map((style) => (
                          <option key={style} value={style}>{style}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-300 mb-3">
                        ⏱️ Duration Limit: {getMaxDurationDisplay(showAddForm || '')}
                        <span className="text-xs text-slate-400 block mt-1 font-normal">Maximum time allowed for {showAddForm} performances</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={getMaxDurationDisplay(showAddForm || '')}
                          readOnly
                          className="w-full p-4 bg-slate-600/30 border-2 border-slate-500/50 rounded-xl text-slate-300 cursor-not-allowed text-base"
                          title="Maximum duration automatically set based on performance type"
                        />
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                          <span className="text-slate-400">🔒</span>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-semibold text-slate-300 mb-3">
                        👥 Age Category
                        <span className="text-xs text-slate-400 block mt-1 font-normal">Calculated from participant ages</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={getCalculatedAgeCategory()}
                          readOnly
                          className="w-full p-4 bg-slate-600/30 border-2 border-slate-500/50 rounded-xl text-slate-300 cursor-not-allowed text-base"
                          title="Age category automatically determined by average age of participants"
                        />
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                          <span className="text-slate-400">🔒</span>
                        </div>
                      </div>
                      {currentForm.participantIds.length > 0 && availableDancers.length > 0 && (
                        <div className="mt-3 p-3 bg-purple-900/20 border border-purple-500/30 rounded-lg">
                          <div className="text-purple-300 text-sm">
                            <strong>🎭 Selected Participants:</strong> {
                              availableDancers
                                .filter(dancer => currentForm.participantIds.includes(dancer.id))
                                .map(dancer => `${dancer.name} (${dancer.age}y)`)
                                .join(', ')
                            }
                          </div>
                          <div className="text-purple-200 text-xs mt-2">
                            📊 Average Age: {(() => {
                              const selectedParticipants = availableDancers.filter(dancer => currentForm.participantIds.includes(dancer.id));
                              const totalAge = selectedParticipants.reduce((sum, dancer) => sum + dancer.age, 0);
                              return Math.round(totalAge / selectedParticipants.length);
                            })()} years → Category: <strong>{getCalculatedAgeCategory()}</strong>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* PHASE 2: Live vs Virtual Entry Toggle */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-3">🎯 Entry Type *</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <button
                        type="button"
                        onClick={() => setCurrentForm({...currentForm, entryType: 'live', videoExternalUrl: '', musicFileUrl: currentForm.entryType === 'virtual' ? '' : currentForm.musicFileUrl})}
                        className={`p-4 sm:p-6 rounded-xl border-2 transition-all duration-300 transform hover:scale-[1.02] min-h-[100px] sm:min-h-[120px] ${
                          currentForm.entryType === 'live'
                            ? 'border-purple-500 bg-purple-500/20 text-purple-300 ring-2 ring-purple-500/30 shadow-lg shadow-purple-500/25'
                            : 'border-slate-600 bg-slate-700/30 text-slate-400 hover:border-purple-400 hover:bg-purple-500/10'
                        }`}
                      >
                        <div className="flex flex-col items-center justify-center space-y-2 h-full">
                          <span className="text-3xl">🎵</span>
                          <span className="font-semibold text-base">Live Performance</span>
                          <span className="text-xs text-center opacity-90 leading-relaxed">
                            Upload music file for in-person performance
                          </span>
                        </div>
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => setCurrentForm({...currentForm, entryType: 'virtual', musicFileUrl: '', musicFileName: ''})}
                        className={`p-4 sm:p-6 rounded-xl border-2 transition-all duration-300 transform hover:scale-[1.02] min-h-[100px] sm:min-h-[120px] ${
                          currentForm.entryType === 'virtual'
                            ? 'border-purple-500 bg-purple-500/20 text-purple-300 ring-2 ring-purple-500/30 shadow-lg shadow-purple-500/25'
                            : 'border-slate-600 bg-slate-700/30 text-slate-400 hover:border-purple-400 hover:bg-purple-500/10'
                        }`}
                      >
                        <div className="flex flex-col items-center justify-center space-y-2 h-full">
                          <span className="text-3xl">📹</span>
                          <span className="font-semibold text-base">Virtual Performance</span>
                          <span className="text-xs text-center opacity-90 leading-relaxed">
                            Submit video URL (YouTube/Vimeo)
                          </span>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Conditional Fields Based on Entry Type */}
                  {currentForm.entryType === 'live' && (
                    <div>
                      <label className="block text-sm font-semibold text-slate-300 mb-3">
                        🎵 Music File Upload *
                        <span className="text-xs text-slate-400 block mt-1 font-normal">Upload the music file for your live performance</span>
                      </label>
                      <MusicUpload
                        onUploadSuccess={(fileData) => {
                          setCurrentForm({
                            ...currentForm,
                            musicFileUrl: fileData.url,
                            musicFileName: fileData.originalFilename
                          });
                        }}
                        onUploadError={(error) => {
                          console.error('Music upload error:', error);
                          // You can add toast notification here if needed
                        }}
                        currentFile={currentForm.musicFileUrl ? {
                          url: currentForm.musicFileUrl,
                          filename: currentForm.musicFileName
                        } : null}
                      />
                    </div>
                  )}

                  {currentForm.entryType === 'virtual' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-300 mb-3">
                          📱 Video Platform *
                        </label>
                        <select
                          value={currentForm.videoExternalType}
                          onChange={(e) => setCurrentForm({...currentForm, videoExternalType: e.target.value as 'youtube' | 'vimeo' | 'other'})}
                          className="w-full p-4 bg-slate-700/50 border-2 border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-base"
                        >
                          <option value="youtube">📺 YouTube</option>
                          <option value="vimeo">🎬 Vimeo</option>
                          <option value="other">🌐 Other Platform</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-semibold text-slate-300 mb-3">
                          🔗 Video URL *
                          <span className="text-xs text-slate-400 block mt-1 font-normal">
                            Paste the full URL to your performance video
                          </span>
                        </label>
                        <input
                          type="url"
                          value={currentForm.videoExternalUrl}
                          onChange={(e) => setCurrentForm({...currentForm, videoExternalUrl: e.target.value})}
                          placeholder={
                            currentForm.videoExternalType === 'youtube' 
                              ? 'https://www.youtube.com/watch?v=...' 
                              : currentForm.videoExternalType === 'vimeo'
                              ? 'https://vimeo.com/...'
                              : 'https://...'
                          }
                          className="w-full p-4 bg-slate-700/50 border-2 border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-base"
                        />
                        {currentForm.videoExternalUrl && (
                          <div className="mt-3 p-3 bg-green-900/20 border border-green-500/30 rounded-lg">
                            <div className="text-green-300 text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
                              <div className="flex items-center space-x-2">
                                <span>✅</span>
                                <span className="font-medium">Video URL provided</span>
                              </div>
                              <a 
                                href={currentForm.videoExternalUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center px-3 py-1 bg-green-500/20 text-green-400 hover:text-green-300 hover:bg-green-500/30 rounded-lg transition-all duration-200 text-sm font-medium border border-green-500/30"
                              >
                                <span className="mr-1">🔗</span>
                                Preview Video
                              </a>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                
                                 <div className="mt-4">
                   <label className="block text-sm font-medium text-slate-300 mb-2">
                     Select Participants * ({getParticipantLimits(showAddForm).min} - {getParticipantLimits(showAddForm).max} required)
                     {currentForm.participantIds.length > 0 && (
                       <span className={`ml-2 text-xs px-2 py-1 rounded-full ${
                         currentForm.participantIds.length < getParticipantLimits(showAddForm).min ||
                         currentForm.participantIds.length > getParticipantLimits(showAddForm).max
                           ? 'bg-red-500/20 text-red-400'
                           : 'bg-emerald-500/20 text-emerald-400'
                       }`}>
                         {currentForm.participantIds.length} selected
                       </span>
                     )}
                   </label>
                   
                   {/* Validation Messages */}
                   {currentForm.participantIds.length > 0 && (
                     <div className="mb-3">
                       {currentForm.participantIds.length < getParticipantLimits(showAddForm).min && (
                         <div className="text-amber-400 text-sm flex items-center space-x-1 animate-pulse">
                           <span>⚠️</span>
                           <span>Need {getParticipantLimits(showAddForm).min - currentForm.participantIds.length} more participant(s)</span>
                         </div>
                       )}
                       {currentForm.participantIds.length > getParticipantLimits(showAddForm).max && (
                         <div className="text-red-400 text-sm flex items-center space-x-1 animate-bounce">
                           <span>❌</span>
                           <span>Too many participants! Remove {currentForm.participantIds.length - getParticipantLimits(showAddForm).max} participant(s)</span>
                         </div>
                       )}
                       {currentForm.participantIds.length >= getParticipantLimits(showAddForm).min && 
                        currentForm.participantIds.length <= getParticipantLimits(showAddForm).max && (
                         <div className="text-emerald-400 text-sm flex items-center space-x-1">
                           <span>✅</span>
                           <span>Perfect! {currentForm.participantIds.length} participant(s) selected</span>
                         </div>
                       )}
                     </div>
                   )}
                   
                   <div className={`grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto p-4 rounded-lg transition-all duration-300 ${
                     currentForm.participantIds.length > getParticipantLimits(showAddForm).max 
                       ? 'bg-red-900/20 border-2 border-red-500/50' 
                       : currentForm.participantIds.length >= getParticipantLimits(showAddForm).min && 
                         currentForm.participantIds.length <= getParticipantLimits(showAddForm).max
                         ? 'bg-emerald-900/20 border-2 border-emerald-500/50'
                         : 'bg-slate-700/30 border border-slate-600/50'
                   }`}>
                     {isLoading && (
                       <div className="text-slate-400 text-sm flex items-center space-x-2">
                         <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-500"></div>
                         <span>Loading your dancer information...</span>
                       </div>
                     )}
                     {!isLoading && availableDancers.length === 0 && (
                       <div className="text-slate-400 text-sm">
                         <p>No dancers available for EODSA ID: {eodsaId}</p>
                         <p className="text-xs mt-1">Check console for debug info</p>
                       </div>
                     )}
                     {availableDancers.map(dancer => {
                       const isSelected = currentForm.participantIds.includes(dancer.id);
                       const isOverLimit = currentForm.participantIds.length >= getParticipantLimits(showAddForm).max;
                       
                       return (
                         <label 
                           key={dancer.id} 
                           className={`flex items-center space-x-2 p-2 rounded transition-all duration-200 ${
                             isSelected 
                               ? currentForm.participantIds.length > getParticipantLimits(showAddForm).max
                                 ? 'bg-red-500/20 text-red-300' 
                                 : 'bg-emerald-500/20 text-emerald-300'
                               : isOverLimit && !isSelected
                                 ? 'text-slate-500 opacity-50 cursor-not-allowed'
                                 : 'text-slate-300 hover:bg-slate-600/30 cursor-pointer'
                           }`}
                         >
                           <input
                             type="checkbox"
                             checked={isSelected}
                             onChange={(e) => {
                               if (!isSelected && isOverLimit) {
                                 return; // Don't allow selection if over limit
                               }
                               
                               const newIds = e.target.checked
                                 ? [...currentForm.participantIds, dancer.id]
                                 : currentForm.participantIds.filter(id => id !== dancer.id);
                               setCurrentForm({...currentForm, participantIds: newIds});
                             }}
                             disabled={!isSelected && isOverLimit}
                             className={`rounded ${
                               isSelected && currentForm.participantIds.length > getParticipantLimits(showAddForm).max
                                 ? 'accent-red-500' 
                                 : 'accent-emerald-500'
                             }`}
                           />
                           <span className="text-sm">{dancer.fullName || dancer.name}</span>
                         </label>
                       );
                     })}
                   </div>
                 </div>
                
                                 {/* Fee Preview */}
                 {currentForm.participantIds.length > 0 && (
                   <div className={`mt-4 p-3 rounded-lg border transition-all duration-300 ${
                     currentForm.participantIds.length < getParticipantLimits(showAddForm).min ||
                     currentForm.participantIds.length > getParticipantLimits(showAddForm).max
                       ? 'bg-red-900/20 border-red-500/50'
                       : 'bg-slate-700/30 border-slate-600/50'
                   }`}>
                     <div className="flex justify-between items-center">
                       <span className="text-sm text-slate-300">Entry Fee Preview:</span>
                       <span className={`text-lg font-semibold ${
                         previewFee > 0 ? 'text-emerald-400' : 'text-red-400'
                       }`}>
                         {previewFee > 0 ? `R${previewFee}` : 'Invalid'}
                       </span>
                     </div>
                     {showAddForm === 'Solo' && previewFee > 0 && (
                       <div className="text-xs text-slate-400 mt-1">
                         {entries.filter(e => e.performanceType === 'Solo').length === 0 && '1st Solo: R5 (TESTING)'}
                         {entries.filter(e => e.performanceType === 'Solo').length === 1 && '2nd Solo: R5 (Package: R10 total) - TESTING'}
                         {entries.filter(e => e.performanceType === 'Solo').length === 2 && '3rd Solo: R5 (Package: R15 total) - TESTING'}
                         {entries.filter(e => e.performanceType === 'Solo').length === 3 && '4th Solo: R5 (Package: R20 total) - TESTING'}
                         {entries.filter(e => e.performanceType === 'Solo').length >= 4 && '5th+ Solo: FREE!'}
                       </div>
                     )}
                     {previewFee === 0 && currentForm.participantIds.length > 0 && (
                       <div className="text-xs text-red-400 mt-1">
                         Fix participant selection to see fee
                       </div>
                     )}
                   </div>
                 )}
                 
                 <div className="mt-8 flex flex-col sm:flex-row gap-3 sm:gap-4 sm:justify-end">
                   <button
                     onClick={() => {
                       // Save current form state before closing
                       setSavedForms(prev => ({
                         ...prev,
                         [showAddForm]: currentForm
                       }));
                       setShowAddForm(null);
                     }}
                     className="w-full sm:w-auto px-6 py-3 bg-slate-600 text-white rounded-xl hover:bg-slate-500 transition-all duration-300 font-medium text-base min-h-[48px] sm:min-h-auto order-2 sm:order-1"
                   >
                     Cancel
                   </button>
                   <button
                     onClick={handleSaveEntry}
                     disabled={
                       !currentForm.itemName || 
                       currentForm.participantIds.length === 0 ||
                       currentForm.participantIds.length < getParticipantLimits(showAddForm).min ||
                       currentForm.participantIds.length > getParticipantLimits(showAddForm).max ||
                       (currentForm.entryType === 'live' && !currentForm.musicFileUrl) ||
                       (currentForm.entryType === 'virtual' && !currentForm.videoExternalUrl)
                     }
                     className={`w-full sm:w-auto px-6 py-3 text-white rounded-xl transition-all duration-300 font-semibold text-base min-h-[48px] sm:min-h-auto order-1 sm:order-2 ${
                       !currentForm.itemName || 
                       currentForm.participantIds.length === 0 ||
                       currentForm.participantIds.length < getParticipantLimits(showAddForm).min ||
                       currentForm.participantIds.length > getParticipantLimits(showAddForm).max ||
                       (currentForm.entryType === 'live' && !currentForm.musicFileUrl) ||
                       (currentForm.entryType === 'virtual' && !currentForm.videoExternalUrl)
                         ? 'bg-slate-500 cursor-not-allowed'
                         : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 hover:scale-105 shadow-lg hover:shadow-purple-500/25'
                     }`}
                   >
                     {!currentForm.itemName ? '📝 Enter Item Name' :
                      currentForm.participantIds.length === 0 ? '👥 Select Participants' :
                      currentForm.participantIds.length < getParticipantLimits(showAddForm).min ? 
                        `➕ Need ${getParticipantLimits(showAddForm).min - currentForm.participantIds.length} More` :
                      currentForm.participantIds.length > getParticipantLimits(showAddForm).max ? 
                        `➖ Remove ${currentForm.participantIds.length - getParticipantLimits(showAddForm).max}` :
                      (currentForm.entryType === 'live' && !currentForm.musicFileUrl) ? '🎵 Upload Music File' :
                      (currentForm.entryType === 'virtual' && !currentForm.videoExternalUrl) ? '📹 Enter Video URL' :
                      `✅ Add Entry ${previewFee > 0 ? `(R${previewFee})` : ''}`}
                   </button>
                 </div>
              </div>
            )}

            {/* Added Entries List */}
            {entries.length > 0 && (
              <div className="bg-slate-800/60 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6">
                <h3 className="text-xl font-semibold text-white mb-4">Added Entries ({entries.length})</h3>
                <div className="space-y-4">
                  {entries.map((entry) => (
                    <div key={entry.id} className="bg-slate-700/30 border border-slate-600/50 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-semibold text-lg text-white">{entry.itemName}</h4>
                          <p className="text-slate-300">{entry.performanceType} • {entry.choreographer}</p>
                                                     <p className="text-sm text-slate-400">
                             {entry.participants.map(p => p.fullName || p.name).join(', ')}
                           </p>
                          <p className="text-sm text-slate-400">
                            {entry.mastery} • {entry.itemStyle} • {entry.estimatedDuration}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-lg text-emerald-400">R{entry.fee}</p>
                          <button
                            onClick={() => handleRemoveEntry(entry.id)}
                            className="text-red-400 hover:text-red-300 text-sm"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Summary and Payment */}
          <div className="lg:col-span-1">
            <div className="bg-slate-800/60 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6 sticky top-8">
              <h3 className="text-xl font-semibold text-white mb-4">Registration Summary</h3>
              
                             <div className="space-y-2 mb-4 text-slate-300">
                 <div className="flex justify-between">
                   <span>Entries:</span>
                   <span>{entries.length}{showAddForm && previewFee > 0 && <span className="text-slate-400"> (+1)</span>}</span>
                 </div>
                 
                 {/* Pending entry preview */}
                 {showAddForm && previewFee > 0 && (
                   <div className="text-xs text-slate-400 bg-slate-700/20 p-2 rounded border border-slate-600/30">
                     <div className="flex justify-between">
                       <span>+ Adding {showAddForm}:</span>
                       <span className="text-emerald-400">R{previewFee}</span>
                     </div>
                   </div>
                 )}
                 
                 {/* Solo package info */}
                 {entries.filter(e => e.performanceType === 'Solo').length > 0 && (
                   <div className="text-xs text-slate-400 bg-slate-700/30 p-2 rounded">
                     <div className="flex justify-between">
                       <span>Solo entries:</span>
                       <span>{entries.filter(e => e.performanceType === 'Solo').length}</span>
                     </div>
                     {entries.filter(e => e.performanceType === 'Solo').length >= 2 && (
                       <div className="text-emerald-400 mt-1">
                         ✓ Solo package pricing applied
                       </div>
                     )}
                     {entries.filter(e => e.performanceType === 'Solo').length >= 5 && (
                       <div className="text-emerald-400">
                         ✓ 5th+ solo entries are FREE!
                       </div>
                     )}
                   </div>
                 )}
                 
                 <div className="flex justify-between">
                   <span>Performance Fees:</span>
                   <span>R{feeCalculation.performanceFee}</span>
                 </div>
                 <div className="flex justify-between">
                   <span>Registration Fees:</span>
                   <span>R{feeCalculation.registrationFee}</span>
                 </div>
                 <div className="text-xs text-slate-400">
                   ({new Set(entries.flatMap(e => e.participantIds)).size} unique participants × R5) - TESTING
                 </div>
                 
                 {/* Preview total with pending entry */}
                 {showAddForm && previewFee > 0 && (
                   <div className="border-t border-slate-600/50 pt-2">
                     <div className="flex justify-between text-sm text-slate-400">
                       <span>Preview Total:</span>
                       <span>R{feeCalculation.total + previewFee}</span>
                     </div>
                   </div>
                 )}
                 
                 <div className="border-t border-slate-600 pt-2">
                   <div className="flex justify-between font-semibold text-lg text-emerald-400">
                     <span>Competition Total:</span>
                     <span className="transition-all duration-300 transform hover:scale-110">
                       R{feeCalculation.total}
                     </span>
                   </div>
                 </div>

                 {/* PayFast Processing Fee Breakdown */}
                 <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3 mt-3">
                   <div className="text-sm text-orange-300 font-medium mb-2">💳 Payment Processing</div>
                   <div className="flex justify-between text-sm text-slate-300 mb-1">
                     <span>Subtotal:</span>
                     <span>R{feeCalculation.total}</span>
                   </div>
                   <div className="flex justify-between text-sm text-slate-300 mb-2">
                     <span>PayFast Processing Fee (3.5%):</span>
                     <span>R{Math.max(feeCalculation.total * 0.035, 2.00).toFixed(2)}</span>
                   </div>
                   <div className="border-t border-orange-500/20 pt-2">
                     <div className="flex justify-between font-semibold text-white">
                       <span>Final Payment Amount:</span>
                       <span className="text-green-400">R{(feeCalculation.total + Math.max(feeCalculation.total * 0.035, 2.00)).toFixed(2)}</span>
                     </div>
                   </div>
                 </div>
               </div>

              <div className="space-y-3">
                <button
                  onClick={handleProceedToPayment}
                  disabled={entries.length === 0 || isSubmitting}
                  className={`w-full py-4 sm:py-3 text-white rounded-lg font-semibold transition-all duration-300 text-lg sm:text-base min-h-[56px] sm:min-h-auto ${
                    isSubmitting 
                      ? 'bg-slate-500 cursor-not-allowed' 
                      : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:bg-slate-500 disabled:cursor-not-allowed'
                  }`}
                >
                  {isSubmitting ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Submitting Entries...</span>
                    </div>
                  ) : (
                    'Proceed to Payment'
                  )}
                </button>
                
                <button
                  onClick={handleTestPayment}
                  disabled={isSubmitting}
                  className="w-full py-3 text-white rounded-lg font-semibold transition-all duration-300 text-sm bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 disabled:bg-slate-500 disabled:cursor-not-allowed"
                >
                  🧪 Test Payment (R5) - For Testing Only
                </button>
              </div>
            </div>

            {/* Event Details */}
            <div className="bg-slate-800/60 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6 mt-6">
              <h3 className="text-xl font-semibold text-white mb-4">Event Details</h3>
                             <div className="space-y-2 text-sm text-slate-300">
                 <p><strong>Date:</strong> {event?.eventDate ? new Date(event.eventDate).toLocaleDateString() : 'TBD'}</p>
                 <p><strong>Time:</strong> {event?.eventDate ? new Date(event.eventDate).toLocaleTimeString() : 'TBD'}</p>
                 <p><strong>Venue:</strong> {event?.venue || 'TBD'}</p>
                 <p><strong>Registration Deadline:</strong> {event?.registrationDeadline ? new Date(event.registrationDeadline).toLocaleDateString() : 'TBD'}</p>
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* Success Modal */}
      {showSuccessModal && submissionResult && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-700/50 p-8 max-w-lg w-full">
            {/* Success Icon */}
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">🎉 Entries Submitted Successfully!</h2>
              <p className="text-slate-300">Your competition entries have been registered for {event?.name}</p>
              
              {/* Avalon Blessing */}
              <div className="mt-4 p-3 bg-gradient-to-r from-purple-900/40 to-pink-900/40 border border-purple-500/30 rounded-lg">
                <p className="text-purple-300 text-sm italic font-medium">
                  ✨ "May the Mists of Avalon bring luck upon you" ✨
                </p>
              </div>
            </div>

            {/* Entry Summary */}
            <div className="bg-slate-700/50 rounded-lg p-4 mb-6">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">Entries Submitted:</span>
                                  <span className="text-white font-semibold">{submissionResult?.entries}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-300">Total Fee:</span>
                <span className="text-emerald-400 font-semibold text-lg">R{submissionResult?.totalFee}</span>
                </div>
                <div className="pt-2 border-t border-slate-600">
                  <p className="text-sm text-slate-300">
                    ✅ All entries qualified for nationals
                  </p>
                  <p className="text-sm text-slate-300">
                    ⏳ Payment status: Pending
                  </p>
                </div>
              </div>
            </div>

            {/* Next Steps */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-6">
              <h4 className="text-blue-400 font-semibold mb-2">Next Steps:</h4>
              <ul className="text-sm text-slate-300 space-y-1">
                <li>• Payment invoice will be sent to your email</li>
                <li>• Complete payment to confirm your entries</li>
                <li>• Check your dashboard for updates</li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3">
              {isStudioMode ? (
                <>
                  <button
                    onClick={() => {
                      setShowSuccessModal(false);
                      // Clear entries and reset form
                      setEntries([]);
                      setSubmissionResult(null);
                    }}
                    className="flex-1 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-500 transition-colors"
                  >
                    Enter More Events
                  </button>
                  <button
                    onClick={() => router.push(`/studio-dashboard?studioId=${studioId}`)}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg hover:from-purple-600 hover:to-pink-700 transition-all duration-300 font-semibold"
                  >
                    Studio Dashboard
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setShowSuccessModal(false);
                      // Clear entries and reset form
                      setEntries([]);
                      setSubmissionResult(null);
                    }}
                    className="flex-1 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-500 transition-colors"
                  >
                    Enter More Events
                  </button>
                  <button
                    onClick={() => router.push(`/`)}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg hover:from-purple-600 hover:to-pink-700 transition-all duration-300 font-semibold"
                  >
                    Main Portal
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 