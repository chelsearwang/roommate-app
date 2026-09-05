import { Pressable, Text, StyleSheet } from 'react-native';
import { colors, radius, shadow } from '../constants/colors';

type Props = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  small?: boolean;
};

export function CozyButton({ title, onPress, variant = 'primary', small = false }: Props) {
  const bg = variant === 'primary' ? colors.blue : variant === 'danger' ? colors.coral : colors.sage;
  return (
    <Pressable style={[styles.button, { backgroundColor: bg }, small && styles.buttonSmall]} onPress={onPress}>
      <Text style={[styles.text, small && styles.textSmall]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginBottom: 12,
    ...shadow,
  },
  buttonSmall: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: 'center',
  },
  text: { color: '#fff', fontWeight: '600', fontSize: 16 },
  textSmall: { fontSize: 13 },
});