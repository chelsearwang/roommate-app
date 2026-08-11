import { useState, useCallback } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, StyleSheet, Alert, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/utils/api';
import { ScreenHeader } from '@/components/ScreenHeader';
import { colors, radius, shadow } from '@/constants/colors';

type Announcement = {
  id: string;
  content: string;
  pinned: boolean;
  resolved: boolean;
  createdAt: string;
  author?: { name: string; avatarEmoji: string };
};

export default function AnnouncementsScreen() {
  const { token } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [content, setContent] = useState('');
  const [pinned, setPinned] = useState(false);
  const [error, setError] = useState('');
  const [showResolved, setShowResolved] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  const loadAnnouncements = useCallback(async () => {
    try {
      const data = await apiRequest('/announcements', {}, token!);
      setAnnouncements(data.announcements);
    } catch (err: any) {
      setError(err.message);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { loadAnnouncements(); }, [loadAnnouncements]));

  async function handleCreate() {
    if (!content) return;
    setError('');
    try {
      await apiRequest('/announcements', { method: 'POST', body: JSON.stringify({ content, pinned }) }, token!);
      setContent('');
      setPinned(false);
      setShowAddForm(false);
      loadAnnouncements();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleResolve(id: string) {
    try {
      await apiRequest(`/announcements/${id}/resolve`, { method: 'PATCH' }, token!);
      loadAnnouncements();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleTogglePin(a: Announcement) {
    try {
      await apiRequest(`/announcements/${a.id}`, { method: 'PATCH', body: JSON.stringify({ pinned: !a.pinned }) }, token!);
      loadAnnouncements();
    } catch (err: any) {
      setError(err.message);
    }
  }

  function startEdit(a: Announcement) {
    setEditingId(a.id);
    setEditContent(a.content);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditContent('');
  }

  async function saveEdit(id: string) {
    try {
      await apiRequest(`/announcements/${id}`, { method: 'PATCH', body: JSON.stringify({ content: editContent }) }, token!);
      setEditingId(null);
      loadAnnouncements();
    } catch (err: any) {
      setError(err.message);
    }
  }

  function handleDelete(id: string) {
    const performDelete = async () => {
      try {
        await apiRequest(`/announcements/${id}`, { method: 'DELETE' }, token!);
        loadAnnouncements();
      } catch (err: any) {
        setError(err.message);
      }
    };
    if (Platform.OS === 'web') {
      if (window.confirm("Delete this announcement? This can't be undone.")) performDelete();
    } else {
      Alert.alert('Delete announcement?', "This can't be undone.", [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: performDelete },
      ]);
    }
  }

  function handleDeleteAllResolved() {
    const performDelete = async () => {
      try {
        await Promise.all(resolved.map((a) => apiRequest(`/announcements/${a.id}`, { method: 'DELETE' }, token!)));
        loadAnnouncements();
      } catch (err: any) {
        setError(err.message);
      }
    };
    const message = `Delete all ${resolved.length} resolved announcements? This can't be undone.`;
    if (Platform.OS === 'web') {
      if (window.confirm(message)) performDelete();
    } else {
      Alert.alert('Delete all resolved?', message, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete All', style: 'destructive', onPress: performDelete },
      ]);
    }
  }

  const active = announcements.filter((a) => !a.resolved);
  const resolved = announcements.filter((a) => a.resolved);

  function renderCard(a: Announcement, isResolved: boolean) {
    const isEditing = editingId === a.id;
    const showPinnedStyle = a.pinned && !isResolved;

    return (
      <View key={a.id} style={[styles.card, isResolved && styles.resolvedCard, showPinnedStyle && styles.pinnedCard]}>
        {showPinnedStyle && (
          <View style={styles.pinnedLabelRow}>
            <Ionicons name="pin" size={12} color={colors.coral} />
            <Text style={styles.pinnedLabel}>PINNED</Text>
          </View>
        )}
        <View style={styles.headerRow}>
          <Text style={{ fontSize: 14 }}>{a.author?.avatarEmoji}</Text>
          <Text style={styles.author}>{a.author?.name}</Text>
          <Text style={styles.date}>{new Date(a.createdAt).toLocaleDateString()}</Text>
        </View>

        {isEditing ? (
          <>
            <TextInput style={[styles.input, styles.multiline]} value={editContent} onChangeText={setEditContent} multiline />
            <View style={styles.actionRow}>
              <Pressable onPress={() => saveEdit(a.id)} style={[styles.actionPill, { backgroundColor: colors.sageTint }]}>
                <Text style={[styles.actionPillText, { color: colors.sage }]}>Save</Text>
              </Pressable>
              <Pressable onPress={cancelEdit} style={styles.iconButton}>
                <Ionicons name="close" size={15} color={colors.text} />
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <Text style={[styles.announcementText, isResolved && styles.resolvedText]}>{a.content}</Text>
            <View style={styles.actionRow}>
              {!isResolved && (
                <Pressable onPress={() => handleTogglePin(a)} style={[styles.actionPill, { backgroundColor: colors.coralTint }]}>
                  <Ionicons name={a.pinned ? 'pin-outline' : 'pin'} size={14} color={colors.coral} />
                  <Text style={[styles.actionPillText, { color: colors.coral }]}>{a.pinned ? 'Unpin' : 'Pin'}</Text>
                </Pressable>
              )}
              <Pressable onPress={() => startEdit(a)} style={[styles.actionPill, { backgroundColor: colors.blueTint }]}>
                <Ionicons name="create-outline" size={14} color={colors.blue} />
                <Text style={[styles.actionPillText, { color: colors.blue }]}>Edit</Text>
              </Pressable>
              {!isResolved && (
                <Pressable onPress={() => handleResolve(a.id)} style={[styles.actionPill, { backgroundColor: colors.sageTint }]}>
                  <Ionicons name="checkmark-circle" size={14} color={colors.sage} />
                  <Text style={[styles.actionPillText, { color: colors.sage }]}>Resolve</Text>
                </Pressable>
              )}
              <Pressable onPress={() => handleDelete(a.id)} style={styles.iconButton}>
                <Ionicons name="trash-outline" size={15} color={colors.coral} />
              </Pressable>
            </View>
          </>
        )}
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenHeader eyebrow="THE BOARD" title="Announcements" emoji="📣" rightAction={{ label: 'Post', onPress: () => setShowAddForm(true) }} />

      {showAddForm && (
        <View style={styles.card}>
          <View style={styles.addFormHeader}>
            <Text style={styles.cardTitle}>New announcement</Text>
            <Pressable onPress={() => setShowAddForm(false)}>
              <Ionicons name="close" size={20} color={colors.text} style={{ opacity: 0.5 }} />
            </Pressable>
          </View>
          <TextInput
            style={[styles.input, styles.multiline]}
            placeholder="What's up?"
            placeholderTextColor="#999"
            value={content}
            onChangeText={setContent}
            multiline
          />
          <Pressable onPress={() => setPinned(!pinned)} style={[styles.chip, pinned && styles.chipSelected]}>
            <Text style={[styles.chipText, pinned && styles.chipTextSelected]}>📌 Pin this</Text>
          </Pressable>
          <Pressable onPress={handleCreate} style={styles.saveButton}>
            <Text style={styles.saveButtonText}>Post</Text>
          </Pressable>
        </View>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {active.map((a) => renderCard(a, false))}

      {resolved.length > 0 && (
        <>
          <View style={styles.resolvedHeaderRow}>
            <Pressable onPress={() => setShowResolved(!showResolved)} style={styles.resolvedHeader}>
              <Text style={styles.resolvedHeaderText}>
                {showResolved ? '▾' : '▸'} Resolved ({resolved.length})
              </Text>
            </Pressable>
            <Pressable onPress={handleDeleteAllResolved} style={styles.deleteAllButton}>
              <Text style={styles.deleteAllText}>Delete all</Text>
            </Pressable>
          </View>
          {showResolved && resolved.map((a) => renderCard(a, true))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 24, paddingBottom: 120 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border, ...shadow },
  pinnedCard: { borderWidth: 1.5, borderColor: colors.coral },
  resolvedCard: { opacity: 0.55 },
  pinnedLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  pinnedLabel: { fontSize: 11, fontWeight: '700', color: colors.coral, letterSpacing: 0.5 },
  addFormHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, color: colors.text, backgroundColor: colors.background, marginBottom: 12 },
  multiline: { minHeight: 70, textAlignVertical: 'top' },
  chip: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.md, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, marginBottom: 12 },
  chipSelected: { backgroundColor: colors.sage, borderColor: colors.sage },
  chipText: { color: colors.text, fontSize: 13 },
  chipTextSelected: { color: '#fff', fontWeight: '600' },
  saveButton: { backgroundColor: colors.blue, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', marginTop: 4, ...shadow },
  saveButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 },
  author: { fontWeight: '600', color: colors.text, fontSize: 14 },
  date: { color: colors.text, opacity: 0.6, fontSize: 12, marginLeft: 'auto' },
  announcementText: { color: colors.text, fontSize: 15, marginBottom: 12 },
  resolvedText: { textDecorationLine: 'line-through' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionPill: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: radius.md },
  actionPillText: { fontSize: 13, fontWeight: '700' },
  iconButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.coralTint, alignItems: 'center', justifyContent: 'center' },
  resolvedHeader: { paddingVertical: 12 },
  resolvedHeaderText: { color: colors.text, opacity: 0.7, fontSize: 14, fontWeight: '600' },
  resolvedHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  deleteAllButton: { paddingVertical: 8 },
  deleteAllText: { color: colors.coral, fontSize: 13, fontWeight: '600' },
  error: { color: '#B5544A', marginBottom: 12, textAlign: 'center' },
});