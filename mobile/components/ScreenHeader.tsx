import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, shadow } from '../constants/colors';

type Props = {
  eyebrow: string;
  title: string;
  emoji?: string;
  rightAction?: { label: string; onPress: () => void };
};

export function ScreenHeader({ eyebrow, title, emoji, rightAction }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 24 }]}>
      <View style={styles.topRow}>
        <Pressable onPress={() => router.replace('/(tabs)')} style={styles.backButton}>
          <Ionicons name="chevron-back" size={18} color={colors.sage} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        {rightAction && (
          <Pressable onPress={rightAction.onPress} style={styles.actionButton}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.actionText}>{rightAction.label}</Text>
          </Pressable>
        )}
      </View>

      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.title}>{title} {emoji}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 20 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backText: { color: colors.sage, fontWeight: '600', fontSize: 15 },
  actionButton: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.sage, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 20,
    ...shadow,
  },
  actionText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  eyebrow: { fontSize: 12, fontWeight: '700', color: colors.ink, opacity: 0.5, letterSpacing: 1, marginBottom: 2 },
  title: { fontSize: 26, fontWeight: 'bold', color: colors.ink },
});