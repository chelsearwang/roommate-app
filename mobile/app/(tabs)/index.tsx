import { useState, useCallback } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, StyleSheet, Alert, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/utils/api';
import { CozyButton } from '@/components/CozyButton';
import { GamificationBar } from '@/components/GamificationBar';
import { colors, radius } from '@/constants/colors';

const FREQUENCIES = ['daily', 'weekly', 'biweekly', 'monthly'] as const;
const WEIGHTS = [
  { label: 'Light', value: 1 },
  { label: 'Medium', value: 2 },
  { label: 'Heavy', value: 3 },
];

type Assignment = { id: string; userId: string; dueDate: string; status: string; user?: { name: string } };
type Chore = { id: string; name: string; frequency: string; weight: number; assignments: Assignment[] };
type PersonRow = { userId: string; name: string; items: { chore: Chore; assignment: Assignment }[] };
type MeData = { xp: number; avatarLevel: number; household?: { streakCount: number } };

function groupByPerson(chores: Chore[]): PersonRow[] {
  const map: Record<string, PersonRow> = {};
  for (const chore of chores) {
    const assignment = chore.assignments[0];
    if (!assignment || !assignment.user) continue;
    if (!map[assignment.userId]) {
      map[assignment.userId] = { userId: assignment.userId, name: assignment.user.name, items: [] };
    }
    map[assignment.userId].items.push({ chore, assignment });
  }
  return Object.values(map);
}

export default function ChoresScreen() {
  const { token, user } = useAuth();
  const [chores, setChores] = useState<Chore[]>([]);
  const [meData, setMeData] = useState<MeData | null>(null);
  const [name, setName] = useState('');
  const [frequency, setFrequency] = useState<typeof FREQUENCIES[number]>('weekly');
  const [weight, setWeight] = useState(1);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [choresData, meResponse] = await Promise.all([
        apiRequest('/chores', {}, token!),
        apiRequest('/me', {}, token!),
      ]);
      setChores(choresData.chores);
      setMeData(meResponse.user);
    } catch (err: any) {
      setError(err.message);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  async function handleCreate() {
    if (!name) return;
    setError('');
    try {
      await apiRequest('/chores', { method: 'POST', body: JSON.stringify({ name, frequency, weight }) }, token!);
      setName('');
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleComplete(assignmentId: string) {
    try {
      await apiRequest(`/assignments/${assignmentId}/complete`, { method: 'PATCH' }, token!);
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  }

  function handleDelete(choreId: string, choreName: string) {
    const performDelete = async () => {
      try {
        await apiRequest(`/chores/${choreId}`, { method: 'DELETE' }, token!);
        loadData();
      } catch (err: any) {
        setError(err.message);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Delete "${choreName}"? This removes it and its history for everyone. This can't be undone.`)) {
        performDelete();
      }
    } else {
      Alert.alert('Delete chore?', `This removes "${choreName}" and its history for everyone. This can't be undone.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: performDelete },
      ]);
    }
  }

  const people = groupByPerson(chores);
  const myOverdueCount = chores.filter((c) => {
    const a = c.assignments[0];
    return a && a.userId === user?.id && a.status === 'overdue';
  }).length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Chores</Text>

      {meData && (
        <GamificationBar
          xp={meData.xp}
          avatarLevel={meData.avatarLevel}
          streakCount={meData.household?.streakCount ?? 0}
          overdueCount={myOverdueCount}
        />
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Add a chore</Text>
        <TextInput
          style={styles.input}
          placeholder="Chore name"
          placeholderTextColor="#999"
          value={name}
          onChangeText={setName}
        />
        <Text style={styles.label}>Frequency</Text>
        <View style={styles.chipRow}>
          {FREQUENCIES.map((f) => (
            <Pressable key={f} onPress={() => setFrequency(f)} style={[styles.chip, frequency === f && styles.chipSelected]}>
              <Text style={[styles.chipText, frequency === f && styles.chipTextSelected]}>{f}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.label}>Effort</Text>
        <View style={styles.chipRow}>
          {WEIGHTS.map((w) => (
            <Pressable key={w.value} onPress={() => setWeight(w.value)} style={[styles.chip, weight === w.value && styles.chipSelected]}>
              <Text style={[styles.chipText, weight === w.value && styles.chipTextSelected]}>{w.label}</Text>
            </Pressable>
          ))}
        </View>
        <CozyButton title="Add chore" onPress={handleCreate} />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {people.map((person) => (
        <View key={person.userId} style={styles.card}>
          <Text style={styles.personName}>{person.name}</Text>
          {person.items.map(({ chore, assignment }) => {
            const isMine = assignment.userId === user?.id;
            const isOverdue = assignment.status === 'overdue';
            const isDone = assignment.status === 'done';
            return (
              <View key={chore.id} style={styles.taskRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.taskName, isDone && styles.doneText]}>{chore.name}</Text>
                  <Text style={[styles.dueText, isOverdue && styles.overdueText]}>
                    {isDone ? 'Completed' : isOverdue ? 'Overdue' : 'Due'} {new Date(assignment.dueDate).toLocaleDateString()}
                  </Text>
                </View>
                {isMine && !isDone && (
                  <CozyButton title="Done" variant="secondary" onPress={() => handleComplete(assignment.id)} />
                )}
                <Pressable onPress={() => handleDelete(chore.id, chore.name)} style={styles.deleteButton}>
                  <Text style={styles.deleteText}>✕</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  content: { padding: 20, paddingBottom: 60 },
  title: { fontSize: 26, fontWeight: 'bold', color: colors.ink, marginBottom: 16 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.mist },
  cardTitle: { fontSize: 16, fontWeight: '600', color: colors.ink, marginBottom: 12 },
  label: { fontSize: 13, color: colors.ink, marginBottom: 6, marginTop: 8, opacity: 0.7 },
  input: { borderWidth: 1, borderColor: colors.mist, borderRadius: radius.sm, padding: 12, color: colors.ink, backgroundColor: colors.cream },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.md, backgroundColor: colors.cream, borderWidth: 1, borderColor: colors.mist },
  chipSelected: { backgroundColor: colors.sage, borderColor: colors.sage },
  chipText: { color: colors.ink, fontSize: 13 },
  chipTextSelected: { color: '#fff', fontWeight: '600' },
  personName: { fontSize: 17, fontWeight: '600', color: colors.ink, marginBottom: 8 },
  taskRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.mist },
  taskName: { fontSize: 15, color: colors.ink, fontWeight: '500' },
  doneText: { textDecorationLine: 'line-through', opacity: 0.5 },
  dueText: { color: colors.ink, opacity: 0.7, fontSize: 13 },
  overdueText: { color: '#B5544A', opacity: 1, fontWeight: '600' },
  error: { color: '#B5544A', marginBottom: 12, textAlign: 'center' },
  deleteButton: { paddingHorizontal: 8, paddingVertical: 4, marginLeft: 4 },
  deleteText: { color: colors.ink, opacity: 0.35, fontSize: 16 },
});