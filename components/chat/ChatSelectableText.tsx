/**
 * Chat body text with real partial selection (highlight + drag handles).
 *
 * RN `Text selectable` on iOS is UILabel-backed: long-press only offers
 * "Copy" for the entire block with no illumination. A non-editable multiline
 * TextInput uses UITextView and restores native word selection.
 */
import React, { useMemo } from 'react';
import {
  Platform,
  Text,
  TextInput,
  type StyleProp,
  type TextStyle,
} from 'react-native';

const SELECTION_COLOR = 'rgba(201, 168, 124, 0.45)';

function stripMarkdownBold(text: string): string {
  return String(text || '').replace(/\*\*([^*]+)\*\*/g, '$1');
}

function renderBoldSegments(text: string) {
  const safe = typeof text === 'string' ? text : '';
  const parts = safe.split(/(\*\*[^*]+\*\*)/);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <Text key={index} style={{ fontWeight: '700' }}>
          {part.slice(2, -2)}
        </Text>
      );
    }
    return part;
  });
}

type Props = {
  text: string;
  style?: StyleProp<TextStyle>;
  /** When true, force light text (user bubbles). */
  inverted?: boolean;
};

export function ChatSelectableText({ text, style, inverted }: Props) {
  const plain = useMemo(() => stripMarkdownBold(text), [text]);

  if (Platform.OS === 'ios') {
    return (
      <TextInput
        value={plain}
        editable={false}
        multiline
        scrollEnabled={false}
        showSoftInputOnFocus={false}
        caretHidden
        contextMenuHidden={false}
        selectionColor={SELECTION_COLOR}
        underlineColorAndroid="transparent"
        style={[
          {
            padding: 0,
            margin: 0,
          },
          style,
          inverted ? { color: '#FFFFFF' } : null,
        ]}
        accessibilityRole="text"
      />
    );
  }

  // Android Text selectable already supports highlight + handles.
  return (
    <Text
      selectable
      selectionColor={SELECTION_COLOR}
      style={[style, inverted ? { color: '#FFFFFF' } : null]}
    >
      {renderBoldSegments(text)}
    </Text>
  );
}
