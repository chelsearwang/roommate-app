import { View, Text, StyleSheet } from 'react-native';
import { colors, radius } from '../constants/colors';

type Props = {
  xp: number;
  avatarLevel: number;
  streakCount: number;
  overdueCount: number;
};

function getMood(overdueCount: number): { emoji: string; label: string } {
  if (overdueCount === 0) return { emoji: '😄', label: 'On top of it' };
  if (overdueCount === 1) return { emoji: '😕', label: 'Falling behind' };
  if (overdueCount === 2) return { emoji: '😟', label: 'Behind' };
  return { emoji: '😫', label: 'Overwhelmed' };
}

export function GamificationBar({ xp, avatarLevel, streakCount, overdueCount }: Props) {
  const xpAtLevelStart = 50 * (avatarLevel - 1) ** 2;
  const xpAtNextLevel = 50 * avatarLevel ** 2;
  const progress = Math.min(1, Math.max(0, (xp - xpAtLevelStart) / (xpAtNextLevel - xpAtLevelStart)));
  const mood = getMood(overdueCount);

  return (
    <View style={styles.card}>
      <View style={styles.contentRow}>
        <View style={styles.avatarBox}>
          <Text style={styles.avatarEmoji}>{mood.emoji}</Text>
          <Text style={styles.avatarLabel}>{mood.label}</Text>
        </View>
        <View style={styles.statsColumn}>
          <View style={styles.row}>
            <Text style={styles.level}>Level {avatarLevel}</Text>
            <Text style={styles.streak}>🔥 {streakCount} streak</Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${progress * 100}%` }]} />
          </View>
          <Text style={styles.xpText}>{xp} / {xpAtNextLevel} XP to next level</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.mist },
  contentRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatarBox: { alignItems: 'center', width: 64 },
  avatarEmoji: { fontSize: 40 },
  avatarLabel: { fontSize: 10, color: colors.ink, opacity: 0.7, textAlign: 'center', marginTop: 2 },
  statsColumn: { flex: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  level: { fontSize: 18, fontWeight: '700', color: colors.ink },
  streak: { fontSize: 14, color: colors.clay, fontWeight: '600' },
  track: { height: 10, backgroundColor: colors.mist, borderRadius: radius.sm, overflow: 'hidden', marginBottom: 6 },
  fill: { height: '100%', backgroundColor: colors.sage, borderRadius: radius.sm },
  xpText: { fontSize: 12, color: colors.ink, opacity: 0.7, textAlign: 'right' },
});