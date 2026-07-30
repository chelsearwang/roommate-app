import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius } from '../constants/colors';

type Props = {
  value: string | null; // YYYY-MM-DD
  onSelect: (dateString: string) => void;
};

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function CalendarPicker({ value, onSelect }: Props) {
  const initial = value ? new Date(value + 'T00:00:00') : new Date();
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());

  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const startWeekday = firstOfMonth.getDay();

  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  function goPrevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  }
  function goNextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={goPrevMonth} style={styles.navButton}>
          <Ionicons name="chevron-back" size={18} color={colors.sage} />
        </Pressable>
        <Text style={styles.monthLabel}>{MONTH_NAMES[viewMonth]} {viewYear}</Text>
        <Pressable onPress={goNextMonth} style={styles.navButton}>
          <Ionicons name="chevron-forward" size={18} color={colors.sage} />
        </Pressable>
      </View>
      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((label, i) => (
          <Text key={i} style={styles.weekdayLabel}>{label}</Text>
        ))}
      </View>
      <View style={styles.grid}>
        {cells.map((day, i) => {
          if (day === null) return <View key={i} style={styles.dayCell} />;
          const dateString = toDateString(new Date(viewYear, viewMonth, day));
          const isSelected = value === dateString;
          return (
            <Pressable key={i} onPress={() => onSelect(dateString)} style={styles.dayCell}>
              <View style={[styles.dayCircle, isSelected && styles.dayCircleSelected]}>
                <Text style={[styles.dayText, isSelected && styles.dayTextSelected]}>{day}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.cream, borderRadius: radius.md, padding: 12, marginBottom: 8 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  navButton: { padding: 6 },
  monthLabel: { fontSize: 14, fontWeight: '700', color: colors.ink },
  weekdayRow: { flexDirection: 'row' },
  weekdayLabel: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 11, fontWeight: '700', color: colors.ink, opacity: 0.5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayCircle: { width: '78%', height: '78%', borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  dayCircleSelected: { backgroundColor: colors.sage },
  dayText: { fontSize: 13, color: colors.ink },
  dayTextSelected: { color: '#fff', fontWeight: '700' },
});