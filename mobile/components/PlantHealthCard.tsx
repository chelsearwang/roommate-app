import { View, Text, Image, StyleSheet } from 'react-native';
import { colors, radius, shadow } from '../constants/colors';

const PLANT_IMAGES: Record<string, any> = {
  wilted: require('../assets/images/plant-wilted.png'),
  struggling: require('../assets/images/plant-struggling.png'),
  healthy: require('../assets/images/plant-healthy.png'),
  thriving: require('../assets/images/plant-thriving.png'),
};

const HEALTH_LABELS: Record<string, string> = {
  wilted: 'Wilting',
  struggling: 'Struggling',
  healthy: 'Healthy',
  thriving: 'Thriving!',
};

const HEALTH_MESSAGES: Record<string, string> = {
  thriving: 'Your household plant is thriving! 🌟',
  healthy: 'Your household plant is healthy.',
  struggling: 'Your household plant is struggling — complete some chores!',
  wilted: 'Your household plant is wilting — complete more chores to help it recover!',
};

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
  memberBreakdown: MemberBreakdown[];
  monthStart: string;
  monthEnd: string;
};

export function PlantHealthCard({ userName, plantHealth, memberBreakdown, monthStart, monthEnd }: Props) {
  const healthMessage = HEALTH_MESSAGES[plantHealth] || HEALTH_MESSAGES.healthy;
  const plantImage = PLANT_IMAGES[plantHealth] || PLANT_IMAGES.healthy;

  return (
    <View style={styles.card}>
      <View style={styles.plantRow}>
        <View style={styles.plantImageWrapper}>
            <Image source={plantImage} style={styles.plantImage} resizeMode="contain" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.plantLabel}>Hey {userName}! 👋</Text>
          <Text style={styles.plantSubtext}>{healthMessage}</Text>
        </View>
      </View>

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
  plantImageWrapper: { width: 64, height: 64, overflow: 'hidden', borderRadius: 8 },
  plantImage: { width: 64, height: 64, transform: [{ scale: 1.2 }] },
  plantLabel: { fontSize: 17, fontWeight: '700', color: colors.text },
  plantSubtext: { fontSize: 12, color: colors.text, opacity: 0.5, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 14 },
  breakdownTitle: { fontSize: 11, fontWeight: '700', color: colors.text, opacity: 0.5, letterSpacing: 0.5, marginBottom: 10 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  memberEmoji: { fontSize: 18, width: 22 },
  barTrack: { width: 130, height: 10, borderRadius: 6, backgroundColor: colors.neutral, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: colors.sage, borderRadius: 6 },
  memberFraction: { fontSize: 12, color: colors.text, opacity: 0.6, fontWeight: '600', width: 48, textAlign: 'right' },
  memberNameLabel: { fontSize: 13, color: colors.text, fontWeight: '600', flex: 1 },
});