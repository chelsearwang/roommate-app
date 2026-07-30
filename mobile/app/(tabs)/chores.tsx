import { useState, useCallback } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, StyleSheet, Alert, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/utils/api';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Toast } from '@/components/Toast';
import { colors, radius, shadow } from '@/constants/colors';

const FREQUENCIES = ['daily', 'weekly', 'biweekly', 'monthly'] as const;
const WEIGHTS = [
  { label: 'Light', value: 1 },
  { label: 'Medium', value: 2 },
  { label: 'Heavy', value: 3 },
];

type Assignment = { id: string; userId: string; dueDate: string; status: string; user?: { name: string; avatarEmoji: string } };
type Chore = { id: string; name: string; frequency: string; weight: number; assignments: Assignment[] };
type PersonRow = { userId: string; name: string; avatarEmoji: string; items: { chore: Chore; assignment: Assignment }[] };

function groupByPerson(chores: Chore[]): PersonRow[] {
  const map: Record<string, PersonRow> = {};
  for (const chore of chores) {
    const assignment = chore.assignments[0];
    if (!assignment || !assignment.user) continue;
    if (!map[assignment.userId]) {
      map[assignment.userId] = { userId: assignment.userId, name: assignment.user.name, avatarEmoji: assignment.user.avatarEmoji, items: [] };
    }
    map[assignment.userId].items.push({ chore, assignment });
  }
  // Not-done items first, done items sink to the bottom within each person's list.
  for (const person of Object.values(map)) {
    person.items.sort((a, b) => {
      const aDone = a.assignment.status === 'done' ? 1 : 0;
      const bDone = b.assignment.status === 'done' ? 1 : 0;
      return aDone - bDone;
    });
  }
  return Object.values(map);
}

function weightMeta(weight: number) {
  if (weight === 1) return { label: 'light', bg: colors.sageTint, color: colors.sage, icon: '🌿' };
  if (weight === 2) return { label: 'medium', bg: colors.mist, color: colors.ink, icon: '⚡' };
  return { label: 'heavy', bg: colors.terracottaTint, color: colors.terracotta, icon: '🔥' };
}

export default function ChoresScreen() {
  const { token, user } = useAuth();
  const [chores, setChores] = useState<Chore[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [frequency, setFrequency] = useState<typeof FREQUENCIES[number]>('weekly');
  const [weight, setWeight] = useState(1);
  const [editingChoreId, setEditingChoreId] = useState<string | null>(null);
  const [editChoreName, setEditChoreName] = useState('');
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  const loadChores = useCallback(async () => {
    try {
      const data = await apiRequest('/chores', {}, token!);
      setChores(data.chores);
    } catch (err: any) {
      setError(err.message);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { loadChores(); }, [loadChores]));

  async function handleCreate() {
    if (!name) return;
    setError('');
    try {
      await apiRequest('/chores', { method: 'POST', body: JSON.stringify({ name, frequency, weight }) }, token!);
      setName('');
      setShowAddForm(false);
      loadChores();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleComplete(assignmentId: string) {
    try {
      await apiRequest(`/assignments/${assignmentId}/complete`, { method: 'PATCH' }, token!);
      loadChores();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleNudge(assignmentId: string, personName: string) {
    setError('');
    setFeedback('');
    try {
      await apiRequest(`/assignments/${assignmentId}/nudge`, { method: 'POST' }, token!);
      setFeedback(`Nudged ${personName}! 👋`);
    } catch (err: any) {
      setError(err.message);
    }
  }

  function startEdit(chore: Chore) {
    setEditingChoreId(chore.id);
    setEditChoreName(chore.name);
  }

  function cancelEdit() {
    setEditingChoreId(null);
    setEditChoreName('');
  }

  async function saveEdit(choreId: string) {
    try {
      await apiRequest(`/chores/${choreId}`, { method: 'PATCH', body: JSON.stringify({ name: editChoreName }) }, token!);
      setEditingChoreId(null);
      loadChores();
    } catch (err: any) {
      setError(err.message);
    }
  }

  function handleDelete(choreId: string, choreName: string) {
    const performDelete = async () => {
      try {
        await apiRequest(`/chores/${choreId}`, { method: 'DELETE' }, token!);
        loadChores();
      } catch (err: any) {
        setError(err.message);
      }
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`Delete "${choreName}"? This removes it and its history for everyone. This can't be undone.`)) performDelete();
    } else {
      Alert.alert('Delete chore?', `This removes "${choreName}" and its history for everyone. This can't be undone.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: performDelete },
      ]);
    }
  }

  const people = groupByPerson(chores);
  people.sort((a, b) => {
    if (a.userId === user?.id) return -1;
    if (b.userId === user?.id) return 1;
    return 0;
  });

  return (
    <View style={{ flex: 1 }}>
      {error ? <Toast message={error} type="error" onDismiss={() => setError('')} /> : null}
      {feedback ? <Toast message={feedback} type="success" onDismiss={() => setFeedback('')} /> : null}

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <ScreenHeader eyebrow="MANAGE" title="Chores" emoji="🧹" rightAction={{ label: 'Add chore', onPress: () => setShowAddForm(true) }} />

        {showAddForm && (
          <View style={styles.card}>
            <View style={styles.addFormHeader}>
              <Text style={styles.cardTitle}>New chore ✨</Text>
              <Pressable onPress={() => setShowAddForm(false)}>
                <Ionicons name="close" size={20} color={colors.ink} style={{ opacity: 0.5 }} />
              </Pressable>
            </View>
            <Text style={styles.label}>CHORE NAME</Text>
            <TextInput style={styles.input} placeholder="e.g. Scrub the sink..." placeholderTextColor="#999" value={name} onChangeText={setName} />
            <Text style={styles.label}>FREQUENCY</Text>
            <View style={styles.chipRow}>
              {FREQUENCIES.map((f) => (
                <Pressable key={f} onPress={() => setFrequency(f)} style={[styles.chip, frequency === f && styles.chipSelected]}>
                  <Text style={[styles.chipText, frequency === f && styles.chipTextSelected]}>{f}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.label}>WEIGHT</Text>
            <View style={styles.chipRow}>
              {WEIGHTS.map((w) => (
                <Pressable key={w.value} onPress={() => setWeight(w.value)} style={[styles.chip, weight === w.value && styles.chipSelected]}>
                  <Text style={[styles.chipText, weight === w.value && styles.chipTextSelected]}>{w.label}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable onPress={handleCreate} style={styles.saveButton}>
              <Text style={styles.saveButtonText}>Save chore</Text>
            </Pressable>
          </View>
        )}

        {people.map((person) => (
          <View key={person.userId}>
            <View style={styles.personHeaderRow}>
              <Text style={styles.personAvatar}>{person.avatarEmoji}</Text>
              <Text style={styles.personName}>{person.name}</Text>
              <Text style={styles.activeCount}>{person.items.filter((i) => i.assignment.status !== 'done').length} active</Text>
            </View>
            {person.items.map(({ chore, assignment }) => {
              const isMine = assignment.userId === user?.id;
              const isOverdue = assignment.status === 'overdue';
              const isDone = assignment.status === 'done';
              const isEditing = editingChoreId === chore.id;
              const wMeta = weightMeta(chore.weight);
              return (
                <View key={chore.id} style={[styles.choreCard, isDone && styles.choreCardDone]}>
                  <View style={styles.choreTopRow}>
                    <View style={[styles.statusCircle, isDone && styles.statusCircleDone]}>
                      {isDone && <Ionicons name="checkmark" size={14} color="#fff" />}
                    </View>
                    {isEditing ? (
                      <TextInput style={[styles.input, { flex: 1 }]} value={editChoreName} onChangeText={setEditChoreName} autoFocus />
                    ) : (
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.choreName, isDone && styles.doneText]}>{chore.name}</Text>
                        <View style={styles.tagRow}>
                          <View style={styles.tag}><Text style={styles.tagText}>{chore.frequency}</Text></View>
                          <View style={[styles.tag, { backgroundColor: wMeta.bg }]}><Text style={[styles.tagText, { color: wMeta.color }]}>{wMeta.icon} {wMeta.label}</Text></View>
                          {isOverdue && <View style={[styles.tag, { backgroundColor: colors.terracottaTint }]}><Text style={[styles.tagText, { color: colors.terracotta }]}>overdue</Text></View>}
                        </View>
                      </View>
                    )}
                  </View>
                  <View style={styles.divider} />
                  {isEditing ? (
                    <View style={styles.actionRow}>
                      <Pressable onPress={() => saveEdit(chore.id)} style={[styles.markDoneButton, { backgroundColor: colors.sageTint }]}>
                        <Text style={styles.markDoneText}>Save</Text>
                      </Pressable>
                      <Pressable onPress={cancelEdit} style={styles.iconButton}>
                        <Ionicons name="close" size={15} color={colors.ink} />
                      </Pressable>
                    </View>
                  ) : (
                    <View style={styles.actionRow}>
                      {isDone ? (
                        <View style={[styles.markDoneButton, styles.markDoneButtonComplete]}>
                          <Ionicons name="checkmark-circle" size={16} color={colors.ink} style={{ opacity: 0.4 }} />
                          <Text style={styles.markDoneTextComplete}>Complete</Text>
                        </View>
                      ) : isMine ? (
                        <Pressable onPress={() => handleComplete(assignment.id)} style={styles.markDoneButton}>
                          <Ionicons name="checkmark-circle" size={16} color={colors.sage} />
                          <Text style={styles.markDoneText}>Mark done</Text>
                        </Pressable>
                      ) : (
                        <Pressable onPress={() => handleNudge(assignment.id, person.name)} style={[styles.markDoneButton, styles.nudgeButton]}>
                          <Ionicons name="notifications-outline" size={16} color={colors.terracotta} />
                          <Text style={styles.nudgeText}>Nudge</Text>
                        </Pressable>
                      )}
                      <Pressable onPress={() => startEdit(chore)} style={styles.iconButton}>
                        <Ionicons name="create-outline" size={15} color={colors.sage} />
                      </Pressable>
                      <Pressable onPress={() => handleDelete(chore.id, chore.name)} style={[styles.iconButton, styles.iconButtonDanger]}>
                        <Ionicons name="trash-outline" size={15} color={colors.terracotta} />
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  content: { paddingHorizontal: 24, paddingBottom: 120 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: colors.mist, ...shadow },
  addFormHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: colors.ink },
  label: { fontSize: 11, fontWeight: '700', color: colors.ink, opacity: 0.5, letterSpacing: 0.5, marginBottom: 8, marginTop: 12 },
  input: { borderWidth: 1, borderColor: colors.mist, borderRadius: radius.md, padding: 12, color: colors.ink, backgroundColor: colors.cream },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.md, backgroundColor: colors.cream, borderWidth: 1, borderColor: colors.mist },
  chipSelected: { backgroundColor: colors.sage, borderColor: colors.sage },
  chipText: { color: colors.ink, fontSize: 13 },
  chipTextSelected: { color: '#fff', fontWeight: '600' },
  saveButton: { backgroundColor: colors.sage, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', marginTop: 16, ...shadow },
  saveButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  personHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, marginTop: 8 },
  personAvatar: { fontSize: 18 },
  personName: { fontSize: 16, fontWeight: '700', color: colors.ink, flex: 1 },
  activeCount: { fontSize: 13, color: colors.ink, opacity: 0.6 },
  choreCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.mist, ...shadow },
  choreCardDone: { opacity: 0.5 },
  choreTopRow: { flexDirection: 'row', gap: 12, marginBottom: 12, alignItems: 'flex-start' },
  statusCircle: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.clay, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  statusCircleDone: { backgroundColor: colors.sage, borderColor: colors.sage },
  choreName: { fontSize: 15, fontWeight: '600', color: colors.ink, marginBottom: 6 },
  doneText: { textDecorationLine: 'line-through' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { backgroundColor: colors.mist, borderRadius: radius.sm, paddingVertical: 4, paddingHorizontal: 10 },
  tagText: { fontSize: 11, color: colors.ink, fontWeight: '600' },
  divider: { height: 1, backgroundColor: colors.mist, marginBottom: 12 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  markDoneButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.sageTint, borderRadius: radius.md, paddingVertical: 10 },
  markDoneButtonComplete: { backgroundColor: colors.mist },
  markDoneText: { color: colors.sage, fontWeight: '700', fontSize: 13 },
  markDoneTextComplete: { color: colors.ink, opacity: 0.6, fontWeight: '700', fontSize: 13 },
  iconButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.sageTint, alignItems: 'center', justifyContent: 'center' },
  iconButtonDanger: { backgroundColor: colors.terracottaTint },
  error: { color: '#B5544A', marginBottom: 12, textAlign: 'center' },
  nudgeButton: { backgroundColor: colors.terracottaTint },
  nudgeText: { color: colors.terracotta, fontWeight: '700', fontSize: 13 },
  feedback: { color: colors.sage, marginBottom: 12, textAlign: 'center', fontWeight: '600' },
});