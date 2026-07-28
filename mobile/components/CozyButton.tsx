import { Pressable, Text, StyleSheet } from 'react-native';
import { colors, radius } from '../constants/colors';

type Props = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
};

export function CozyButton({ title, onPress, variant = 'primary' }: Props) {
  const bg = variant === 'primary' ? colors.sage : colors.clay;
  return (
    <Pressable style={[styles.button, { backgroundColor: bg }]} onPress={onPress}>
      <Text style={styles.text}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  text: { color: '#fff', fontWeight: '600', fontSize: 16 },
});