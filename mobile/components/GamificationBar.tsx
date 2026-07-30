import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius } from '../constants/colors';

type Props = {
  name: string;
  avatarEmoji: string;
  xp: number;
  avatarLevel: number;
  streakCount: number;
  overdueCount: number;
};

export function GamificationBar({ name, avatarEmoji, xp, avatarLevel, streakCount, overdueCount }: Props) {
  const xpAtLevelStart = 50 * (avatarLevel - 1) ** 2;
  const xpAtNextLevel = 50 * avatarLevel ** 2;
  const progress = Math.min(1, Math.max(0, (xp - xpAtLevelStart) / (xpAtNextLevel - xpAtLevelStart)));
  const xpToNext = Math.max(0, xpAtNextLevel - xp);
  const isOverdue = overdueCount > 0;

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.avatarBox}>
          <Text style={styles.avatarEmoji}>{avatarEmoji}</Text>
          <View style={[styles.statusBadge, isOverdue && styles.statusBadgeWarning]}>
            <Ionicons name={isOverdue ? 'alert' : 'checkmark'} size={12} color="#fff" />
          </View>
        </View>
        <View style={styles.greetingColumn}>
          <Text style={styles.greeting}>Hey, {name}! 👋</Text>
          <View style={styles.pillRow}>
            <View style={[styles.pill, { backgroundColor: colors.terracottaTint }]}>
              <Text style={styles.pillText}>🔥 {streakCount}-day streak</Text>
            </View>
            <View style={[styles.pill, { backgroundColor: colors.sageTint }]}>
              <Text style={styles.pillText}>⭐ {xp} XP</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.levelRow}>
        <Text style={styles.levelText}>LVL {avatarLevel}</Text>
        <Text style={styles.xpFraction}>{xp} / {xpAtNextLevel} XP</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${progress * 100}%` }]} />
      </View>
      <Text style={styles.captionText}>{xpToNext} XP until Level {avatarLevel + 1} ✨</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 18, marginBottom: 20, borderWidth: 1, borderColor: colors.mist },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  avatarBox: { width: 60, height: 60, borderRadius: radius.md, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' },
  avatarEmoji: { fontSize: 32 },
  statusBadge: {
    position: 'absolute', bottom: -4, right: -4,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.sage, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.surface,
  },
  statusBadgeWarning: { backgroundColor: colors.terracotta },
  greetingColumn: { flex: 1 },
  greeting: { fontSize: 18, fontWeight: '700', color: colors.ink, marginBottom: 8 },
  pillRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  pill: { paddingVertical: 5, paddingHorizontal: 12, borderRadius: radius.md },
  pillText: { fontSize: 12, fontWeight: '700', color: colors.ink },
  levelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  levelText: { fontSize: 14, fontWeight: '700', color: colors.sage },
  xpFraction: { fontSize: 13, color: colors.ink, opacity: 0.7 },
  track: { height: 10, backgroundColor: colors.mist, borderRadius: 6, overflow: 'hidden', marginBottom: 8 },
  fill: { height: '100%', backgroundColor: colors.sage, borderRadius: 6 },
  captionText: { fontSize: 12, color: colors.ink, opacity: 0.7, textAlign: 'center' },
});