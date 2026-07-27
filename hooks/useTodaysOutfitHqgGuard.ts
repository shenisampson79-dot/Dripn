/**
 * Runtime HQG guard for Today's Outfit sheet.
 * Invalid / stuck states are auto-corrected within ~500ms.
 */

import { useEffect, useRef } from 'react';

import {
  TODAYS_OUTFIT_GENERATE_TIMEOUT_MS,
  evaluateTodaysOutfitHqg,
  type TodaysOutfitCardState,
} from '@/utils/todaysOutfitControlFlow';

type Args = {
  cardState: TodaysOutfitCardState;
  isOpen: boolean;
  setCardState: (s: TodaysOutfitCardState) => void;
  setErrorMessage: (msg: string | null) => void;
  /** Invalidate in-flight generate when forcing idle from closed+loading. */
  bumpRequestId: () => void;
  timeoutMs?: number;
  label?: string;
};

export function useTodaysOutfitHqgGuard({
  cardState,
  isOpen,
  setCardState,
  setErrorMessage,
  bumpRequestId,
  timeoutMs = TODAYS_OUTFIT_GENERATE_TIMEOUT_MS,
  label = 'TodaysOutfit',
}: Args) {
  const loadingEnteredAt = useRef<number | null>(null);
  const lastState = useRef(cardState);

  useEffect(() => {
    if (cardState !== lastState.current) {
      lastState.current = cardState;
      loadingEnteredAt.current = cardState === 'loading' ? Date.now() : null;
    } else if (cardState === 'loading' && loadingEnteredAt.current == null) {
      loadingEnteredAt.current = Date.now();
    }
  }, [cardState]);

  useEffect(() => {
    const tick = () => {
      const action = evaluateTodaysOutfitHqg({
        cardState,
        isOpen,
        loadingEnteredAt: loadingEnteredAt.current,
        timeoutMs,
      });
      if (action.type === 'NONE') return;
      console.warn(`[HQG] ${label}: ${action.reason}`);
      if (action.type === 'FORCE_IDLE') {
        bumpRequestId();
        setErrorMessage(null);
        setCardState('idle');
        return;
      }
      if (action.type === 'FORCE_ERROR') {
        setErrorMessage(action.message);
        setCardState('error');
      }
    };

    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [
    cardState,
    isOpen,
    setCardState,
    setErrorMessage,
    bumpRequestId,
    timeoutMs,
    label,
  ]);
}
