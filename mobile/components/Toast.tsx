import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, shadow } from '../constants/colors';

type Props = {
  message: string;
  type?: 'success' | 'error';
  onDismiss: () => void;
};

export function Toast({ message, type = 'success', onDismiss }: Props) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 3000);
    return () => clearTimeout(timer);
  }, [message]);

  if (!message) return null;

  return (
    <View style={[styles.container, type === 'error' && styles.containerError]}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 16,
    left: 20,
    right: 20,
    zIndex: 999,
    backgroundColor: colors.sage,
    borderRadius: radius.md,
    padding: 14,
    ...shadow,
  },
  containerError: { backgroundColor: '#B5544A' },
  text: { color: '#fff', fontWeight: '700', textAlign: 'center' },
});