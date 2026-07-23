/**
 * DD / MM / YYYY date entry with fixed slash separators and auto-advance.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
} from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { BorderRadius, Spacing } from '@/constants/theme';
import { formatDisplayDate, parseDisplayDate } from '@/utils/lookbookTripDay';

type Props = {
  /** ISO date key YYYY-MM-DD (or empty). */
  value: string;
  onChangeIso: (iso: string) => void;
  onInvalidBlur?: () => void;
  textColor: string;
  borderColor: string;
  backgroundColor: string;
  placeholderColor?: string;
  style?: StyleProp<ViewStyle>;
  partStyle?: StyleProp<TextStyle>;
  editable?: boolean;
  accessibilityLabel?: string;
};

function digitsOnly(raw: string, maxLen: number): string {
  return raw.replace(/\D/g, '').slice(0, maxLen);
}

function partsFromIso(iso: string): { day: string; month: string; year: string } {
  const display = formatDisplayDate(iso);
  if (!display) return { day: '', month: '', year: '' };
  const [day = '', month = '', year = ''] = display.split('/');
  return { day, month, year };
}

function tryBuildIso(day: string, month: string, year: string): string | null {
  if (day.length < 1 || month.length < 1 || year.length !== 4) return null;
  return parseDisplayDate(`${day}/${month}/${year}`);
}

export function DatePartsInput({
  value,
  onChangeIso,
  onInvalidBlur,
  textColor,
  borderColor,
  backgroundColor,
  placeholderColor,
  style,
  partStyle,
  editable = true,
  accessibilityLabel,
}: Props) {
  const monthRef = useRef<TextInput>(null);
  const yearRef = useRef<TextInput>(null);
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');

  useEffect(() => {
    const next = partsFromIso(value);
    setDay(next.day);
    setMonth(next.month);
    setYear(next.year);
  }, [value]);

  const commitIfComplete = (nextDay: string, nextMonth: string, nextYear: string) => {
    const iso = tryBuildIso(nextDay, nextMonth, nextYear);
    if (iso) {
      onChangeIso(iso);
      const normalized = partsFromIso(iso);
      setDay(normalized.day);
      setMonth(normalized.month);
      setYear(normalized.year);
      return true;
    }
    return false;
  };

  const handleBlur = () => {
    if (!day && !month && !year) return;
    const iso = tryBuildIso(day, month, year);
    if (iso) {
      onChangeIso(iso);
      const normalized = partsFromIso(iso);
      setDay(normalized.day);
      setMonth(normalized.month);
      setYear(normalized.year);
      return;
    }
    // Revert to last valid ISO value
    const fallback = partsFromIso(value);
    setDay(fallback.day);
    setMonth(fallback.month);
    setYear(fallback.year);
    onInvalidBlur?.();
  };

  const sharedInputProps: TextInputProps = {
    keyboardType: 'number-pad',
    maxLength: 4,
    placeholderTextColor: placeholderColor,
    editable,
    selectTextOnFocus: true,
    onBlur: handleBlur,
  };

  const partBase: TextStyle = {
    color: textColor,
    borderColor,
    backgroundColor,
  };

  return (
    <View
      style={[styles.row, style]}
      accessibilityLabel={accessibilityLabel || 'Date DD/MM/YYYY'}
    >
      <TextInput
        {...sharedInputProps}
        value={day}
        placeholder="DD"
        maxLength={2}
        style={[styles.part, styles.day, partBase, partStyle]}
        onChangeText={(raw) => {
          const next = digitsOnly(raw, 2);
          setDay(next);
          if (next.length === 2) {
            monthRef.current?.focus();
            commitIfComplete(next, month, year);
          }
        }}
        returnKeyType="next"
        onSubmitEditing={() => monthRef.current?.focus()}
      />
      <ThemedText type="body" style={[styles.slash, { color: textColor, opacity: 0.45 }]}>
        /
      </ThemedText>
      <TextInput
        {...sharedInputProps}
        ref={monthRef}
        value={month}
        placeholder="MM"
        maxLength={2}
        style={[styles.part, styles.month, partBase, partStyle]}
        onChangeText={(raw) => {
          const next = digitsOnly(raw, 2);
          setMonth(next);
          if (next.length === 2) {
            yearRef.current?.focus();
            commitIfComplete(day, next, year);
          }
        }}
        returnKeyType="next"
        onSubmitEditing={() => yearRef.current?.focus()}
      />
      <ThemedText type="body" style={[styles.slash, { color: textColor, opacity: 0.45 }]}>
        /
      </ThemedText>
      <TextInput
        {...sharedInputProps}
        ref={yearRef}
        value={year}
        placeholder="YYYY"
        maxLength={4}
        style={[styles.part, styles.year, partBase, partStyle]}
        onChangeText={(raw) => {
          const next = digitsOnly(raw, 4);
          setYear(next);
          if (next.length === 4) {
            commitIfComplete(day, month, next);
          }
        }}
        returnKeyType="done"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  part: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 12,
    fontSize: 16,
    textAlign: 'center',
  },
  day: { flex: 0, minWidth: 44, maxWidth: 52 },
  month: { flex: 0, minWidth: 44, maxWidth: 52 },
  year: { flex: 1, minWidth: 64 },
  slash: {
    marginHorizontal: 4,
    fontWeight: '600',
  },
});
