/**
 * Map Outfit-for-an-event step details onto allocator occasion + intent.
 * Mirrors Dripn-Server/services/eventOutfitOccasion.js.
 */
import type { OutfitOccasionId } from '@/constants/outfitOccasions';
import type { OutfitIntentName } from '@/utils/outfitIntent';

export type EventDetailsLike = {
  eventType?: string;
  dressCode?: string;
  venue?: string;
  timeOfDay?: string;
};

export type ResolvedEventOccasion = {
  allocatorOccasion: OutfitOccasionId;
  outfitIntent: OutfitIntentName;
  editorialOccasion: string;
  strict: boolean;
  reason: string;
};

function norm(value?: string | null): string {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[-\s]+/g, '_');
}

export function resolveEventOutfitOccasion(input: {
  eventDetails?: EventDetailsLike | null;
  context?: string;
  decisionType?: string;
} = {}): ResolvedEventOccasion {
  const ed = input.eventDetails && typeof input.eventDetails === 'object' ? input.eventDetails : {};
  const eventType = norm(ed.eventType);
  const dressCode = norm(ed.dressCode);
  const context = String(input.context || '');
  const decisionType = norm(input.decisionType);
  const blob = `${eventType} ${dressCode} ${context} ${decisionType}`.toLowerCase();

  const isInterview =
    eventType === 'interview' || /\b(job[\s_-]?interview|interview)\b/.test(blob);
  const isBusiness =
    eventType === 'business'
    || ['office', 'meeting', 'work'].includes(eventType)
    || /\b(office|boardroom|client\s+meeting|work\s+meeting)\b/.test(blob);

  if (isInterview || isBusiness) {
    if (dressCode === 'smart_casual' || /smart[\s_-]?casual/.test(blob)) {
      return {
        allocatorOccasion: 'smart_casual',
        outfitIntent: 'smart_casual',
        editorialOccasion: 'smart_casual',
        strict: true,
        reason: isInterview ? 'interview_smart_casual' : 'business_smart_casual',
      };
    }
    return {
      allocatorOccasion: 'work_outfit',
      outfitIntent: 'power',
      editorialOccasion: 'work',
      strict: true,
      reason: isInterview ? 'interview' : 'business',
    };
  }

  if (
    ['formal', 'black_tie', 'blacktie', 'cocktail'].includes(dressCode)
    || eventType === 'wedding'
    || /\b(black[\s_-]?tie|gala|ceremony)\b/.test(blob)
  ) {
    return {
      allocatorOccasion: dressCode === 'cocktail' ? 'evening_out' : 'work_outfit',
      outfitIntent: 'power',
      editorialOccasion: 'formal',
      strict: true,
      reason: 'formal_event',
    };
  }

  if (dressCode === 'smart_casual' || dressCode === 'business') {
    return {
      allocatorOccasion: 'smart_casual',
      outfitIntent: 'smart_casual',
      editorialOccasion: 'smart_casual',
      strict: dressCode === 'business',
      reason: 'dress_code_smart_casual',
    };
  }

  if (eventType === 'date' || /\b(date\s*night|first\s*date)\b/.test(blob)) {
    return {
      allocatorOccasion: 'date_night',
      outfitIntent: 'date_night',
      editorialOccasion: 'date',
      strict: false,
      reason: 'date',
    };
  }

  if (eventType === 'party' || eventType === 'dinner' || /\b(party|dinner|drinks|bar)\b/.test(blob)) {
    return {
      allocatorOccasion: 'evening_out',
      outfitIntent: eventType === 'dinner' ? 'date_night' : 'editorial',
      editorialOccasion: 'evening',
      strict: false,
      reason: eventType || 'evening',
    };
  }

  if (dressCode === 'casual') {
    return {
      allocatorOccasion: 'casual_day',
      outfitIntent: 'casual_day',
      editorialOccasion: 'casual',
      strict: false,
      reason: 'dress_code_casual',
    };
  }

  if (decisionType === 'event_outfit' || decisionType === 'event-outfit') {
    return {
      allocatorOccasion: 'evening_out',
      outfitIntent: 'date_night',
      editorialOccasion: 'evening',
      strict: false,
      reason: 'event_outfit_default',
    };
  }

  return {
    allocatorOccasion: 'casual_day',
    outfitIntent: 'casual_day',
    editorialOccasion: 'casual',
    strict: false,
    reason: 'default',
  };
}
