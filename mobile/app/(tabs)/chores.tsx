import { useState, useCallback } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, StyleSheet, Alert, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/utils/api';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Toast } from '@/components/Toast';
import { CalendarPicker, toDateString } from '@/components/CalendarPicker';
import { colors, radius, shadow } from '@/constants/colors';

const FREQUENCIES = ['daily', 'weekly', 'biweekly', 'monthly'] as const;
const WEIGHTS = [
  { label: 'Light', value: 1 },
  { label: 'Medium', value: 2 },
  { label: 'Heavy', value: 3 },
];
const WEEKDAYS = [
  { label: 'Sun', value: 0 }, { label: 'Mon', value: 1 }, { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 }, { label: 'Thu', value: 4 }, { label: 'Fri', value: 5 }, { label: 'Sat', value: 6 },
];
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const OCCURRENCE_LABELS: Record<string, string> = { first: '1st', second: '2nd', third: '3rd', fourth: '4th', last: 'last' };


const OCCURRENCE_INDEX: Record<string, number> = { first: 0, second: 1, third: 2, fourth: 3 };

function getNthWeekdayOfMonthLocal(year: number, month: number, weekday: number, occurrence: string): Date {
  if (occurrence === 'last') {
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const diff = (lastDayOfMonth.getDay() - weekday + 7) % 7;
    lastDayOfMonth.setDate(lastDayOfMonth.getDate() - diff);
    return lastDayOfMonth;
  }
  const firstOfMonth = new Date(year, month, 1);
  const offset = (weekday - firstOfMonth.getDay() + 7) % 7;
  const day = 1 + offset + OCCURRENCE_INDEX[occurrence] * 7;
  return new Date(year, month, day);
}

// Display-only mirror of the backend's getOccurrenceOfWeekday — just for showing
// a friendly preview label. The backend independently re-derives the real value;
// this duplication is low-risk since it only affects what text is shown, not what's stored.
function describeMonthlyPattern(dateString: string): string {
  const [y, m, d] = dateString.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const weekday = date.getDay();
  const occurrenceIndex = Math.floor((d - 1) / 7);
  const occurrence = occurrenceIndex < 4 ? ['first', 'second', 'third', 'fourth'][occurrenceIndex] : 'last';
  return `Recurs on the ${OCCURRENCE_LABELS[occurrence]} ${WEEKDAY_NAMES[weekday]} of each month`;
}

type Assignment = { id: string; userId: string; dueDate: string; status: string; user?: { name: string; avatarEmoji: string } };
type Chore = {
  id: string; name: string; type: string; frequency: string | null; weight: number;
  scheduleWeekday: number | null; scheduleOccurrence: string | null; assignments: Assignment[];
};
type Member = { id: string; name: string; avatarEmoji: string };
type PersonRow = { userId: string; name: string; avatarEmoji: string; items: { chore: Chore; assignment: Assignment }[] };

function groupByPerson(chores: Chore[]): PersonRow[] {
  const map: Record<string, PersonRow> = {};
  for (const chore of chores) {
    for (const assignment of chore.assignments) {
      if (!assignment.user) continue;
      if (!map[assignment.userId]) {
        map[assignment.userId] = { userId: assignment.userId, name: assignment.user.name, avatarEmoji: assignment.user.avatarEmoji, items: [] };
      }
      map[assignment.userId].items.push({ chore, assignment });
    }
  }
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
  const [members, setMembers] = useState<Member[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  const [choreType, setChoreType] = useState<'recurring' | 'one_time'>('recurring');
  const [name, setName] = useState('');
  const [frequency, setFrequency] = useState<typeof FREQUENCIES[number]>('weekly');
  const [weight, setWeight] = useState(1);
  const [weeklyWeekday, setWeeklyWeekday] = useState<number | null>(null);
  const [monthlyScheduleDate, setMonthlyScheduleDate] = useState<string | null>(null);
  const [oneTimeDueDate, setOneTimeDueDate] = useState('');
  const [oneTimeAssigneeId, setOneTimeAssigneeId] = useState<string | null>(null);

  const [editingChoreId, setEditingChoreId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editWeight, setEditWeight] = useState(1);
  const [editFrequency, setEditFrequency] = useState<typeof FREQUENCIES[number]>('weekly');
  const [editWeeklyWeekday, setEditWeeklyWeekday] = useState<number | null>(null);
  const [editMonthlyScheduleDate, setEditMonthlyScheduleDate] = useState<string | null>(null);
  const [editDueDate, setEditDueDate] = useState('');
  const [editAssigneeId, setEditAssigneeId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [choresData, membersData] = await Promise.all([
        apiRequest('/chores', {}, token!),
        apiRequest('/households/members', {}, token!),
      ]);
      setChores(choresData.chores);
      setMembers(membersData.members);
    } catch (err: any) {
      setError(err.message);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  function resetAddForm() {
    setName(''); setChoreType('recurring'); setFrequency('weekly'); setWeight(1);
    setWeeklyWeekday(null); setMonthlyScheduleDate(null);
    setOneTimeDueDate(''); setOneTimeAssigneeId(null);
    setShowAddForm(false);
  }

  async function handleCreate() {
    if (!name) return;
    setError('');
    try {
      if (choreType === 'one_time') {
        if (!oneTimeDueDate || !oneTimeAssigneeId) {
          setError('Pick a due date and an assignee for a one-time chore');
          return;
        }
        await apiRequest('/chores', {
          method: 'POST',
          body: JSON.stringify({ name, type: 'one_time', dueDate: oneTimeDueDate, assigneeId: oneTimeAssigneeId, weight }),
        }, token!);
      } else if (frequency === 'monthly') {
        if (!monthlyScheduleDate) {
          setError('Pick an example date on the calendar for a monthly chore');
          return;
        }
        await apiRequest('/chores', {
          method: 'POST',
          body: JSON.stringify({ name, type: 'recurring', frequency, weight, scheduleDate: monthlyScheduleDate }),
        }, token!);
      } else {
        await apiRequest('/chores', {
          method: 'POST',
          body: JSON.stringify({
            name, type: 'recurring', frequency, weight,
            ...(weeklyWeekday !== null ? { scheduleWeekday: weeklyWeekday } : {}),
          }),
        }, token!);
      }
      resetAddForm();
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

  async function handleNudge(assignmentId: string, personName: string) {
    setError(''); setFeedback('');
    try {
      await apiRequest(`/assignments/${assignmentId}/nudge`, { method: 'POST' }, token!);
      setFeedback(`Nudged ${personName}! 👋`);
    } catch (err: any) {
      setError(err.message);
    }
  }

  function startEdit(chore: Chore) {
    setEditingChoreId(chore.id);
    setEditName(chore.name);
    setEditWeight(chore.weight);
    if (chore.type === 'recurring') {
      setEditFrequency((chore.frequency as typeof FREQUENCIES[number]) || 'weekly');
      setEditWeeklyWeekday(chore.scheduleWeekday ?? null);
      if (chore.frequency === 'monthly' && chore.scheduleWeekday !== null && chore.scheduleOccurrence) {
        const now = new Date();
        const exampleDate = getNthWeekdayOfMonthLocal(now.getFullYear(), now.getMonth(), chore.scheduleWeekday, chore.scheduleOccurrence);
        setEditMonthlyScheduleDate(toDateString(exampleDate));
      } else {
        setEditMonthlyScheduleDate(null);
      }
    } else {
      const assignment = chore.assignments[0];
      setEditDueDate(assignment ? toDateString(new Date(assignment.dueDate)) : '');
      setEditAssigneeId(assignment ? assignment.userId : null);
    }
  }

  function cancelEdit() {
    setEditingChoreId(null);
  }

  async function saveEdit(chore: Chore) {
    try {
      const body: any = { name: editName, weight: editWeight };
      if (chore.type === 'recurring') {
        body.frequency = editFrequency;
        if (editFrequency === 'monthly') {
          if (editMonthlyScheduleDate) body.scheduleDate = editMonthlyScheduleDate;
        } else if (editWeeklyWeekday !== null) {
          body.scheduleWeekday = editWeeklyWeekday;
        }
      } else {
        body.dueDate = editDueDate;
        body.assigneeId = editAssigneeId;
      }
      await apiRequest(`/chores/${chore.id}`, { method: 'PATCH', body: JSON.stringify(body) }, token!);
      setEditingChoreId(null);
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
              <Pressable onPress={resetAddForm}>
                <Ionicons name="close" size={20} color={colors.ink} style={{ opacity: 0.5 }} />
              </Pressable>
            </View>

            <View style={styles.chipRow}>
              <Pressable onPress={() => setChoreType('recurring')} style={[styles.typeChip, choreType === 'recurring' && styles.chipSelected]}>
                <Text style={[styles.chipText, choreType === 'recurring' && styles.chipTextSelected]}>🔁 Recurring</Text>
              </Pressable>
              <Pressable onPress={() => setChoreType('one_time')} style={[styles.typeChip, choreType === 'one_time' && styles.chipSelected]}>
                <Text style={[styles.chipText, choreType === 'one_time' && styles.chipTextSelected]}>📌 One-time</Text>
              </Pressable>
            </View>

            <Text style={styles.label}>CHORE NAME</Text>
            <TextInput style={styles.input} placeholder="e.g. Scrub the sink..." placeholderTextColor="#999" value={name} onChangeText={setName} />

            {choreType === 'recurring' ? (
              <>
                <Text style={styles.label}>FREQUENCY</Text>
                <View style={styles.chipRow}>
                  {FREQUENCIES.map((f) => (
                    <Pressable key={f} onPress={() => setFrequency(f)} style={[styles.chip, frequency === f && styles.chipSelected]}>
                      <Text style={[styles.chipText, frequency === f && styles.chipTextSelected]}>{f}</Text>
                    </Pressable>
                  ))}
                </View>

                {(frequency === 'weekly' || frequency === 'biweekly') && (
                  <>
                    <Text style={styles.label}>PREFERRED DAY (OPTIONAL)</Text>
                    <View style={styles.chipRow}>
                      {WEEKDAYS.map((w) => (
                        <Pressable
                          key={w.value}
                          onPress={() => setWeeklyWeekday(weeklyWeekday === w.value ? null : w.value)}
                          style={[styles.chip, weeklyWeekday === w.value && styles.chipSelected]}
                        >
                          <Text style={[styles.chipText, weeklyWeekday === w.value && styles.chipTextSelected]}>{w.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </>
                )}

                {frequency === 'monthly' && (
                  <>
                    <Text style={styles.label}>PICK AN EXAMPLE DATE</Text>
                    <CalendarPicker value={monthlyScheduleDate} onSelect={setMonthlyScheduleDate} />
                    {monthlyScheduleDate && (
                      <Text style={styles.patternPreview}>{describeMonthlyPattern(monthlyScheduleDate)}</Text>
                    )}
                  </>
                )}
              </>
            ) : (
              <>
                <Text style={styles.label}>DUE DATE</Text>
                <CalendarPicker value={oneTimeDueDate || null} onSelect={setOneTimeDueDate} />
                <Text style={styles.label}>ASSIGN TO</Text>
                <View style={styles.chipRow}>
                  {members.map((m) => (
                    <Pressable key={m.id} onPress={() => setOneTimeAssigneeId(m.id)} style={[styles.chip, oneTimeAssigneeId === m.id && styles.chipSelected]}>
                      <Text style={[styles.chipText, oneTimeAssigneeId === m.id && styles.chipTextSelected]}>{m.avatarEmoji} {m.name}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}

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
              const isOneTime = chore.type === 'one_time';

              return (
                <View key={assignment.id} style={[styles.choreCard, isDone && styles.choreCardDone]}>
                  <View style={styles.choreTopRow}>
                    <View style={[styles.statusCircle, isDone && styles.statusCircleDone]}>
                      {isDone && <Ionicons name="checkmark" size={14} color="#fff" />}
                    </View>

                    {isEditing ? (
                      <View style={{ flex: 1 }}>
                        <TextInput style={styles.input} value={editName} onChangeText={setEditName} autoFocus />

                        {chore.type === 'recurring' ? (
                          <>
                            <Text style={styles.label}>FREQUENCY</Text>
                            <View style={styles.chipRow}>
                              {FREQUENCIES.map((f) => (
                                <Pressable key={f} onPress={() => setEditFrequency(f)} style={[styles.chip, editFrequency === f && styles.chipSelected]}>
                                  <Text style={[styles.chipText, editFrequency === f && styles.chipTextSelected]}>{f}</Text>
                                </Pressable>
                              ))}
                            </View>

                            {(editFrequency === 'weekly' || editFrequency === 'biweekly') && (
                              <>
                                <Text style={styles.label}>PREFERRED DAY (OPTIONAL)</Text>
                                <View style={styles.chipRow}>
                                  {WEEKDAYS.map((w) => (
                                    <Pressable
                                      key={w.value}
                                      onPress={() => setEditWeeklyWeekday(editWeeklyWeekday === w.value ? null : w.value)}
                                      style={[styles.chip, editWeeklyWeekday === w.value && styles.chipSelected]}
                                    >
                                      <Text style={[styles.chipText, editWeeklyWeekday === w.value && styles.chipTextSelected]}>{w.label}</Text>
                                    </Pressable>
                                  ))}
                                </View>
                              </>
                            )}

                            {editFrequency === 'monthly' && (
                              <>
                                <Text style={styles.label}>NEW EXAMPLE DATE (LEAVE BLANK TO KEEP CURRENT PATTERN)</Text>
                                <CalendarPicker value={editMonthlyScheduleDate} onSelect={setEditMonthlyScheduleDate} />
                                {editMonthlyScheduleDate && (
                                  <Text style={styles.patternPreview}>{describeMonthlyPattern(editMonthlyScheduleDate)}</Text>
                                )}
                              </>
                            )}
                          </>
                        ) : (
                          <>
                            <Text style={styles.label}>DUE DATE</Text>
                            <CalendarPicker value={editDueDate || null} onSelect={setEditDueDate} />
                            <Text style={styles.label}>ASSIGN TO</Text>
                            <View style={styles.chipRow}>
                              {members.map((m) => (
                                <Pressable key={m.id} onPress={() => setEditAssigneeId(m.id)} style={[styles.chip, editAssigneeId === m.id && styles.chipSelected]}>
                                  <Text style={[styles.chipText, editAssigneeId === m.id && styles.chipTextSelected]}>{m.avatarEmoji} {m.name}</Text>
                                </Pressable>
                              ))}
                            </View>
                          </>
                        )}

                        <Text style={styles.label}>WEIGHT</Text>
                        <View style={styles.chipRow}>
                          {WEIGHTS.map((w) => (
                            <Pressable key={w.value} onPress={() => setEditWeight(w.value)} style={[styles.chip, editWeight === w.value && styles.chipSelected]}>
                              <Text style={[styles.chipText, editWeight === w.value && styles.chipTextSelected]}>{w.label}</Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>
                    ) : (
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.choreName, isDone && styles.doneText]}>{chore.name}</Text>
                        <View style={styles.tagRow}>
                          {isOneTime ? (
                            <View style={[styles.tag, { backgroundColor: colors.mist }]}><Text style={styles.tagText}>📌 one-time</Text></View>
                          ) : (
                            <View style={styles.tag}><Text style={styles.tagText}>{chore.frequency}</Text></View>
                          )}
                          <View style={[styles.tag, { backgroundColor: wMeta.bg }]}><Text style={[styles.tagText, { color: wMeta.color }]}>{wMeta.icon} {wMeta.label}</Text></View>
                          {isOverdue && <View style={[styles.tag, { backgroundColor: colors.terracottaTint }]}><Text style={[styles.tagText, { color: colors.terracotta }]}>overdue</Text></View>}
                        </View>
                      </View>
                    )}

                    {!isEditing && (
                      <Text style={[styles.dueDateText, isOverdue && styles.dueDateOverdue]}>
                        Due {new Date(assignment.dueDate).toLocaleDateString()}
                      </Text>
                    )}
                  </View>
                  <View style={styles.divider} />
                  {isEditing ? (
                    <View style={styles.actionRow}>
                      <Pressable onPress={() => saveEdit(chore)} style={[styles.markDoneButton, { backgroundColor: colors.sageTint }]}>
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
  input: { borderWidth: 1, borderColor: colors.mist, borderRadius: radius.md, padding: 12, color: colors.ink, backgroundColor: colors.cream, marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.md, backgroundColor: colors.cream, borderWidth: 1, borderColor: colors.mist },
  typeChip: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: radius.md, backgroundColor: colors.cream, borderWidth: 1, borderColor: colors.mist },
  chipSelected: { backgroundColor: colors.sage, borderColor: colors.sage },
  chipText: { color: colors.ink, fontSize: 13 },
  chipTextSelected: { color: '#fff', fontWeight: '600' },
  patternPreview: { fontSize: 12, color: colors.sage, fontWeight: '600', marginTop: 4, fontStyle: 'italic' },
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
  dueDateText: { fontSize: 12, color: colors.ink, opacity: 0.6, fontWeight: '600' },
  dueDateOverdue: { color: colors.terracotta, opacity: 1 },
  divider: { height: 1, backgroundColor: colors.mist, marginBottom: 12 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  markDoneButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.sageTint, borderRadius: radius.md, paddingVertical: 10 },
  markDoneButtonComplete: { backgroundColor: colors.mist },
  markDoneText: { color: colors.sage, fontWeight: '700', fontSize: 13 },
  markDoneTextComplete: { color: colors.ink, opacity: 0.6, fontWeight: '700', fontSize: 13 },
  iconButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.sageTint, alignItems: 'center', justifyContent: 'center' },
  iconButtonDanger: { backgroundColor: colors.terracottaTint },
  nudgeButton: { backgroundColor: colors.terracottaTint },
  nudgeText: { color: colors.terracotta, fontWeight: '700', fontSize: 13 },
});