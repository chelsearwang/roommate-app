import { useState, useCallback } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, StyleSheet, Alert, Platform, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/utils/api';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Toast } from '@/components/Toast';
import { CalendarPicker, toDateString } from '@/components/CalendarPicker';
import { colors, radius, shadow } from '@/constants/colors';
import { LoadingScreen } from '@/components/LoadingScreen';

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
const OCCURRENCES = [
  { label: '1st', value: 'first' }, { label: '2nd', value: 'second' }, { label: '3rd', value: 'third' },
  { label: '4th', value: 'fourth' }, { label: 'Last', value: 'last' },
];

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

function describeMonthlyPattern(dateString: string): string {
  const [y, m, d] = dateString.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const weekday = date.getDay();
  const occurrenceIndex = Math.floor((d - 1) / 7);
  const occurrence = occurrenceIndex < 4 ? ['first', 'second', 'third', 'fourth'][occurrenceIndex] : 'last';
  const OCCURRENCE_LABELS: Record<string, string> = { first: '1st', second: '2nd', third: '3rd', fourth: '4th', last: 'last' };
  const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return `Recurs on the ${OCCURRENCE_LABELS[occurrence]} ${WEEKDAY_NAMES[weekday]} of each month`;
}

type Assignment = { id: string; userId: string; dueDate: string; status: string; user?: { name: string; avatarEmoji: string } };
type Chore = {
  id: string; name: string; type: string; frequency: string | null; weight: number;
  scheduleWeekday: number | null; scheduleOccurrence: string | null; assignmentMode: string;
  assignments: Assignment[];
};
type Member = { id: string; name: string; avatarEmoji: string };
type PersonRow = { userId: string; name: string; avatarEmoji: string; items: { chore: Chore; assignment: Assignment }[] };

function groupByPerson(chores: Chore[], members: Member[]): PersonRow[] {
  const map: Record<string, PersonRow> = {};
  for (const member of members) {
    map[member.id] = { userId: member.id, name: member.name, avatarEmoji: member.avatarEmoji, items: [] };
  }
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
  if (weight === 2) return { label: 'medium', bg: colors.neutral, color: colors.text, icon: '⚡' };
  return { label: 'heavy', bg: colors.coralTint, color: colors.coral, icon: '🔥' };
}

export default function ChoresScreen() {
  const { token, user } = useAuth();
  const [chores, setChores] = useState<Chore[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [choreType, setChoreType] = useState<'recurring' | 'one_time'>('recurring');
  const [name, setName] = useState('');
  const [frequency, setFrequency] = useState<typeof FREQUENCIES[number]>('weekly');
  const [weight, setWeight] = useState(1);
  const [weeklyWeekday, setWeeklyWeekday] = useState<number | null>(null);
  const [monthlyScheduleDate, setMonthlyScheduleDate] = useState<string | null>(null);
  const [oneTimeDueDate, setOneTimeDueDate] = useState('');
  const [oneTimeAssigneeId, setOneTimeAssigneeId] = useState<string | null>(null);
  const [assignmentMode, setAssignmentMode] = useState<'rotating' | 'fixed'>('rotating');
  const [fixedAssigneeId, setFixedAssigneeId] = useState<string | null>(null);

  const [editingChoreId, setEditingChoreId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editWeight, setEditWeight] = useState(1);
  const [editFrequency, setEditFrequency] = useState<typeof FREQUENCIES[number]>('weekly');
  const [editWeeklyWeekday, setEditWeeklyWeekday] = useState<number | null>(null);
  const [editMonthlyScheduleDate, setEditMonthlyScheduleDate] = useState<string | null>(null);
  const [editDueDate, setEditDueDate] = useState('');
  const [editAssigneeId, setEditAssigneeId] = useState<string | null>(null);
  const [editAssignmentMode, setEditAssignmentMode] = useState<'rotating' | 'fixed'>('rotating');

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
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  function resetAddForm() {
    setName(''); setChoreType('recurring'); setFrequency('weekly'); setWeight(1);
    setWeeklyWeekday(null); setMonthlyScheduleDate(null);
    setOneTimeDueDate(''); setOneTimeAssigneeId(null);
    setAssignmentMode('rotating'); setFixedAssigneeId(null);
    setShowAddForm(false);
  }

  async function handleCreate() {
    if (!name) return;
    setError('');

    if (choreType === 'recurring' && assignmentMode === 'fixed' && !fixedAssigneeId) {
      setError('Pick who this fixed chore belongs to');
      return;
    }

    setIsCreating(true);
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
          body: JSON.stringify({
            name, type: 'recurring', frequency, weight, scheduleDate: monthlyScheduleDate,
            assignmentMode,
            ...(assignmentMode === 'fixed' ? { assigneeId: fixedAssigneeId } : {}),
          }),
        }, token!);
      } else {
        await apiRequest('/chores', {
          method: 'POST',
          body: JSON.stringify({
            name, type: 'recurring', frequency, weight,
            assignmentMode,
            ...(assignmentMode === 'fixed' ? { assigneeId: fixedAssigneeId } : {}),
            ...(weeklyWeekday !== null ? { scheduleWeekday: weeklyWeekday } : {}),
          }),
        }, token!);
      }
      await loadData();
      resetAddForm();
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsCreating(false);
      }
  }

  /*
  async function handleComplete(assignmentId: string) {
    try {
      await apiRequest(`/assignments/${assignmentId}/complete`, { method: 'PATCH' }, token!);
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  } */

  async function handleComplete(assignmentId: string) {
    setCompletingId(assignmentId);
    try {
      await apiRequest(`/assignments/${assignmentId}/complete`, { method: 'PATCH' }, token!);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCompletingId(null);
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
      setEditAssignmentMode((chore.assignmentMode as 'rotating' | 'fixed') || 'rotating');
      if (chore.assignmentMode === 'fixed') {
        const assignment = chore.assignments[0];
        setEditAssigneeId(assignment ? assignment.userId : null);
      } else {
        setEditAssigneeId(null);
      }
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
    setIsSavingEdit(true);
    try {
      const body: any = { name: editName, weight: editWeight };
      if (chore.type === 'recurring') {
        body.frequency = editFrequency;
        body.assignmentMode = editAssignmentMode;
        if (editAssignmentMode === 'fixed' && editAssigneeId) {
          body.assigneeId = editAssigneeId;
        }
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
      await loadData();
      setEditingChoreId(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSavingEdit(false);
    }
  }

  /*
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
  } */

  function handleDelete(choreId: string, choreName: string) {
    const performDelete = () => {
      setChores((prev) => prev.filter((c) => c.id !== choreId));
      apiRequest(`/chores/${choreId}`, { method: 'DELETE' }, token!).catch((err) => {
        setError(err.message);
        loadData();
      });
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

  const people = groupByPerson(chores, members);
  people.sort((a, b) => {
    if (a.userId === user?.id) return -1;
    if (b.userId === user?.id) return 1;
    return 0;
  });

  if (isLoading) {
    return <LoadingScreen message="Loading chores..." />;
  }

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
                <Ionicons name="close" size={20} color={colors.text} style={{ opacity: 0.5 }} />
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

                <Text style={styles.label}>ASSIGNMENT</Text>
                <View style={styles.chipRow}>
                  <Pressable onPress={() => setAssignmentMode('rotating')} style={[styles.chip, assignmentMode === 'rotating' && styles.chipSelected]}>
                    <Text style={[styles.chipText, assignmentMode === 'rotating' && styles.chipTextSelected]}>🔁 Rotates between roommates</Text>
                  </Pressable>
                  <Pressable onPress={() => setAssignmentMode('fixed')} style={[styles.chip, assignmentMode === 'fixed' && styles.chipSelected]}>
                    <Text style={[styles.chipText, assignmentMode === 'fixed' && styles.chipTextSelected]}>📌 Fixed to one person</Text>
                  </Pressable>
                </View>
                {assignmentMode === 'fixed' && (
                  <>
                    <Text style={styles.label}>ASSIGN TO</Text>
                    <View style={styles.chipRow}>
                      {members.map((m) => (
                        <Pressable key={m.id} onPress={() => setFixedAssigneeId(m.id)} style={[styles.chip, fixedAssigneeId === m.id && styles.chipSelected]}>
                          <Text style={[styles.chipText, fixedAssigneeId === m.id && styles.chipTextSelected]}>{m.avatarEmoji} {m.name}</Text>
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

            <Pressable onPress={handleCreate} disabled={isCreating} style={[styles.saveButton, isCreating && { opacity: 0.6 }]}>
              <Text style={styles.saveButtonText}>{isCreating ? 'Saving...' : 'Save chore'}</Text>
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
            {person.items.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No chores at the moment 🎉</Text>
              </View>
            ) : person.items.map(({ chore, assignment }) => {
              const isMine = assignment.userId === user?.id;
              const isOverdue = assignment.status === 'overdue';
              const isDone = assignment.status === 'done';
              const isEditing = editingChoreId === chore.id;
              const wMeta = weightMeta(chore.weight);
              const isOneTime = chore.type === 'one_time';
              const isFixed = chore.type === 'recurring' && chore.assignmentMode === 'fixed';

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

                            <Text style={styles.label}>ASSIGNMENT</Text>
                            <View style={styles.chipRow}>
                              <Pressable onPress={() => setEditAssignmentMode('rotating')} style={[styles.chip, editAssignmentMode === 'rotating' && styles.chipSelected]}>
                                <Text style={[styles.chipText, editAssignmentMode === 'rotating' && styles.chipTextSelected]}>🔁 Rotating</Text>
                              </Pressable>
                              <Pressable onPress={() => setEditAssignmentMode('fixed')} style={[styles.chip, editAssignmentMode === 'fixed' && styles.chipSelected]}>
                                <Text style={[styles.chipText, editAssignmentMode === 'fixed' && styles.chipTextSelected]}>📌 Fixed</Text>
                              </Pressable>
                            </View>
                            {editAssignmentMode === 'fixed' && (
                              <>
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

                            {editFrequency === 'monthly' && (
                              <>
                                <Text style={styles.label}>NEW EXAMPLE DATE (LEAVE BLANK TO KEEP CURRENT PATTERN)</Text>
                                <CalendarPicker value={editMonthlyScheduleDate} onSelect={setEditMonthlyScheduleDate} />
                                {editMonthlyScheduleDate && (
                                  <Text style={styles.patternPreview}>{describeMonthlyPattern(editMonthlyScheduleDate)}</Text>
                                )}
                              </>
                            )}
                            {(editFrequency === 'weekly' || editFrequency === 'biweekly') && (
                              <>
                                <Text style={styles.label}>WEEKDAY</Text>
                                <View style={styles.chipRow}>
                                  {WEEKDAYS.map((w) => (
                                    <Pressable key={w.value} onPress={() => setEditWeeklyWeekday(w.value)} style={[styles.chip, editWeeklyWeekday === w.value && styles.chipSelected]}>
                                      <Text style={[styles.chipText, editWeeklyWeekday === w.value && styles.chipTextSelected]}>{w.label}</Text>
                                    </Pressable>
                                  ))}
                                </View>
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
                            <View style={[styles.tag, { backgroundColor: colors.neutral }]}><Text style={styles.tagText}>📌 one-time</Text></View>
                          ) : (
                            <View style={styles.tag}><Text style={styles.tagText}>{chore.frequency}</Text></View>
                          )}
                          {isFixed && (
                            <View style={[styles.tag, { backgroundColor: colors.neutral }]}><Text style={styles.tagText}>📌 fixed</Text></View>
                          )}
                          <View style={[styles.tag, { backgroundColor: wMeta.bg }]}><Text style={[styles.tagText, { color: wMeta.color }]}>{wMeta.icon} {wMeta.label}</Text></View>
                          {isOverdue && <View style={[styles.tag, { backgroundColor: colors.coralTint }]}><Text style={[styles.tagText, { color: colors.coral }]}>overdue</Text></View>}
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
                      <Pressable onPress={() => saveEdit(chore)} disabled={isSavingEdit} style={[styles.markDoneButton, { backgroundColor: colors.sageTint }, isSavingEdit && { opacity: 0.6 }]}>
                        <Text style={styles.markDoneText}>{isSavingEdit ? 'Saving...' : 'Save'}</Text>
                      </Pressable>
                      <Pressable onPress={cancelEdit} style={styles.iconButton}>
                        <Ionicons name="close" size={15} color={colors.text} />
                      </Pressable>
                    </View>
                  ) : (
                    <View style={styles.actionRow}>
                      {isDone ? (
                        <View style={[styles.markDoneButton, styles.markDoneButtonComplete]}>
                          <Ionicons name="checkmark-circle" size={16} color={colors.text} style={{ opacity: 0.4 }} />
                          <Text style={styles.markDoneTextComplete}>Complete</Text>
                        </View>
                      ) : isMine ? (
                        <Pressable
                          onPress={() => handleComplete(assignment.id)}
                          disabled={completingId === assignment.id}
                          style={[styles.markDoneButton, completingId === assignment.id && { opacity: 0.6 }]}
                        >
                          {completingId === assignment.id ? (
                            <>
                              <ActivityIndicator size="small" color={colors.sage} />
                              <Text style={styles.markDoneText}>Completing...</Text>
                            </>
                          ) : (
                            <>
                              <Ionicons name="checkmark-circle" size={16} color={colors.sage} />
                              <Text style={styles.markDoneText}>Mark done</Text>
                            </>
                          )}
                        </Pressable>
                      ) : (
                        <Pressable onPress={() => handleNudge(assignment.id, person.name)} style={[styles.markDoneButton, styles.nudgeButton]}>
                          <Ionicons name="notifications-outline" size={16} color={colors.coral} />
                          <Text style={styles.nudgeText}>Nudge</Text>
                        </Pressable>
                      )}
                      <Pressable onPress={() => startEdit(chore)} style={styles.iconButton}>
                        <Ionicons name="create-outline" size={15} color={colors.blue} />
                      </Pressable>
                      <Pressable onPress={() => handleDelete(chore.id, chore.name)} style={[styles.iconButton, styles.iconButtonDanger]}>
                        <Ionicons name="trash-outline" size={15} color={colors.coral} />
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
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 24, paddingBottom: 120 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: colors.border, ...shadow },
  addFormHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  label: { fontSize: 11, fontWeight: '700', color: colors.text, opacity: 0.5, letterSpacing: 0.5, marginBottom: 8, marginTop: 12 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, color: colors.text, backgroundColor: colors.background, marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.md, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  typeChip: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: radius.md, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  chipSelected: { backgroundColor: colors.blue, borderColor: colors.blue },
  chipText: { color: colors.text, fontSize: 13 },
  chipTextSelected: { color: '#fff', fontWeight: '600' },
  patternPreview: { fontSize: 12, color: colors.sage, fontWeight: '600', marginTop: 4, fontStyle: 'italic' },
  saveButton: { backgroundColor: colors.blue, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', marginTop: 16, ...shadow },
  saveButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  personHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, marginTop: 8 },
  personAvatar: { fontSize: 18 },
  personName: { fontSize: 16, fontWeight: '700', color: colors.text, flex: 1 },
  activeCount: { fontSize: 13, color: colors.text, opacity: 0.6 },
  emptyState: { paddingVertical: 20, alignItems: 'center' },
  emptyStateText: { color: colors.text, opacity: 0.5, fontSize: 14, fontStyle: 'italic' },
  choreCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border, ...shadow },
  choreCardDone: { opacity: 0.5 },
  choreTopRow: { flexDirection: 'row', gap: 12, marginBottom: 12, alignItems: 'flex-start' },
  statusCircle: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  statusCircleDone: { backgroundColor: colors.sage, borderColor: colors.sage },
  choreName: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 6 },
  doneText: { textDecorationLine: 'line-through' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { backgroundColor: colors.neutral, borderRadius: radius.sm, paddingVertical: 4, paddingHorizontal: 10 },
  tagText: { fontSize: 11, color: colors.text, fontWeight: '600' },
  dueDateText: { fontSize: 12, color: colors.text, opacity: 0.6, fontWeight: '600' },
  dueDateOverdue: { color: colors.coral, opacity: 1 },
  divider: { height: 1, backgroundColor: colors.neutral, marginBottom: 12 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  markDoneButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.sageTint, borderRadius: radius.md, paddingVertical: 10 },
  markDoneButtonComplete: { backgroundColor: colors.neutral },
  markDoneText: { color: colors.sage, fontWeight: '700', fontSize: 13 },
  markDoneTextComplete: { color: colors.text, opacity: 0.6, fontWeight: '700', fontSize: 13 },
  iconButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.blueTint, alignItems: 'center', justifyContent: 'center' },
  iconButtonDanger: { backgroundColor: colors.coralTint },
  nudgeButton: { backgroundColor: colors.coralTint },
  nudgeText: { color: colors.coral, fontWeight: '700', fontSize: 13 },
});