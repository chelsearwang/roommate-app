import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, radius, shadow } from '../constants/colors';

const PLANT_STAGES: Record<string, { emoji: string; label: string }> = {
  wilted: { emoji: '🥀', label: 'Wilting — needs attention' },
  struggling: { emoji: '🌱', label: 'Struggling' },
  healthy: { emoji: '🪴', label: 'Healthy' },
  thriving: { emoji: '🌻', label: 'Thriving!' },
};

const HEALTH_MESSAGES: Record<string, string> = {
  thriving: 'Your plant is thriving! Tap to change it 🌟',
  healthy: 'Your plant is healthy. Tap to change it',
  struggling: 'Your plant is struggling — complete some chores!',
  wilted: 'Your plant is wilting — complete more chores to help it recover!',
};

const PLANT_TYPES = [
  { value: 'default', emoji: '🪴', label: 'Classic' },
  { value: 'succulent', emoji: '🌵', label: 'Succulent' },
  { value: 'flower', emoji: '🌸', label: 'Flower' },
  { value: 'fern', emoji: '🌿', label: 'Fern' },
];

function formatMonthRange(startISO: string, endISO: string): string {
  const start = new Date(startISO);
  const end = new Date(endISO);
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString(undefined, options)} – ${end.toLocaleDateString(undefined, options)}`;
}

type MemberBreakdown = { userId: string; name: string; avatarEmoji: string; dueThisMonth: number; completedThisMonth: number };

type Props = {
  userName: string;
  plantHealth: string;
  plantType: string;
  memberBreakdown: MemberBreakdown[];
  monthStart: string;
  monthEnd: string;
  onChangePlantType: (type: string) => void;
};

export function PlantHealthCard({ userName, plantHealth, plantType, memberBreakdown, monthStart, monthEnd, onChangePlantType }: Props) {
  const [showPicker, setShowPicker] = useState(false);
  const stage = PLANT_STAGES[plantHealth] || PLANT_STAGES.healthy;
  const healthMessage = HEALTH_MESSAGES[plantHealth] || HEALTH_MESSAGES.healthy;

  return (
    <View style={styles.card}>
      <Pressable style={styles.plantRow} onPress={() => setShowPicker(!showPicker)}>
        <Text style={styles.plantEmoji}>{stage.emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.plantLabel}>Hey {userName}! 👋</Text>
          <Text style={styles.plantSubtext}>{healthMessage}</Text>
        </View>
      </Pressable>

      {showPicker && (
        <View style={styles.pickerRow}>
          {PLANT_TYPES.map((p) => (
            <Pressable
              key={p.value}
              onPress={() => { onChangePlantType(p.value); setShowPicker(false); }}
              style={[styles.pickerOption, plantType === p.value && styles.pickerOptionSelected]}
            >
              <Text style={{ fontSize: 22 }}>{p.emoji}</Text>
              <Text style={styles.pickerLabel}>{p.label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.divider} />

      <Text style={styles.breakdownTitle}>THIS MONTH · {formatMonthRange(monthStart, monthEnd)}</Text>
      {memberBreakdown.map((m) => {
        const ratio = m.dueThisMonth > 0 ? m.completedThisMonth / m.dueThisMonth : 1;
        return (
          <View key={m.userId} style={styles.memberRow}>
            <Text style={styles.memberEmoji}>{m.avatarEmoji}</Text>
            <Text style={styles.memberNameLabel} numberOfLines={1}>{m.name}</Text>
            <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${Math.min(ratio, 1) * 100}%` }]} />
            </View>
            <Text style={styles.memberFraction}>{m.completedThisMonth}/{m.dueThisMonth}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 18, marginBottom: 20, borderWidth: 1, borderColor: colors.border, ...shadow },
  plantRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  plantEmoji: { fontSize: 44 },
  plantLabel: { fontSize: 17, fontWeight: '700', color: colors.text },
  plantSubtext: { fontSize: 12, color: colors.text, opacity: 0.5, marginTop: 2 },
  pickerRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  pickerOption: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.md, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  pickerOptionSelected: { borderColor: colors.sage, backgroundColor: colors.sageTint },
  pickerLabel: { fontSize: 10, color: colors.text, opacity: 0.7, marginTop: 4, fontWeight: '600' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 14 },
  breakdownTitle: { fontSize: 11, fontWeight: '700', color: colors.text, opacity: 0.5, letterSpacing: 0.5, marginBottom: 10 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  memberEmoji: { fontSize: 18, width: 22 },
  barTrack: { width: 130, height: 10, borderRadius: 6, backgroundColor: colors.neutral, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: colors.sage, borderRadius: 6 },
  memberFraction: { fontSize: 12, color: colors.text, opacity: 0.6, fontWeight: '600', width: 48, textAlign: 'right' },
  memberNameLabel: { fontSize: 13, color: colors.text, fontWeight: '600', flex: 1 },
});