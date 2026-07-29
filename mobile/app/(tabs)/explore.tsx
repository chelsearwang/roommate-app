import { useState, useCallback } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, StyleSheet, Alert, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/utils/api';
import { CozyButton } from '@/components/CozyButton';
import { colors, radius } from '@/constants/colors';

type Announcement = {
  id: string;
  content: string;
  pinned: boolean;
  resolved: boolean;
  createdAt: string;
  author?: { name: string };
};

export default function AnnouncementsScreen() {
  const { token } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
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
      if (window.confirm("Delete this announcement? This can't be undone.")) {
        performDelete();
      }
    } else {
      Alert.alert('Delete announcement?', "This can't be undone.", [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: performDelete },
      ]);
    }
  }

  const active = announcements.filter((a) => !a.resolved);
  const resolved = announcements.filter((a) => a.resolved);

  function renderCard(a: Announcement, isResolved: boolean) {
    const isEditing = editingId === a.id;

    return (
      <View key={a.id} style={[styles.card, isResolved && styles.resolvedCard]}>
        <View style={styles.headerRow}>
          {a.pinned && <Text style={styles.pinIcon}>📌</Text>}
          <Text style={styles.author}>{a.author?.name}</Text>
          <Text style={styles.date}>{new Date(a.createdAt).toLocaleDateString()}</Text>
        </View>

        {isEditing ? (
          <>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={editContent}
              onChangeText={setEditContent}
              multiline
            />
            <View style={styles.editActions}>
              <CozyButton title="Save" onPress={() => saveEdit(a.id)} />
              <Pressable onPress={cancelEdit} style={styles.cancelButton}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <Text style={[styles.announcementText, isResolved && styles.resolvedText]}>{a.content}</Text>
            <View style={styles.actionRow}>
              {!isResolved && (
                <Pressable onPress={() => handleResolve(a.id)} style={styles.actionIcon}>
                  <Text style={styles.resolveIcon}>✓</Text>
                </Pressable>
              )}
              <Pressable onPress={() => startEdit(a)} style={styles.actionIcon}>
                <Text style={styles.neutralIcon}>✏️</Text>
              </Pressable>
              {!isResolved && (
                <Pressable onPress={() => handleTogglePin(a)} style={styles.actionIcon}>
                  <Text style={styles.neutralIcon}>📌</Text>
                </Pressable>
              )}
              <Pressable onPress={() => handleDelete(a.id)} style={styles.actionIcon}>
                <Text style={styles.neutralIcon}>🗑️</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Announcements</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>New announcement</Text>
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
        <CozyButton title="Post" onPress={handleCreate} />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {active.map((a) => renderCard(a, false))}

      {resolved.length > 0 && (
        <>
          <Pressable onPress={() => setShowResolved(!showResolved)} style={styles.resolvedHeader}>
            <Text style={styles.resolvedHeaderText}>
              {showResolved ? '▾' : '▸'} Resolved ({resolved.length})
            </Text>
          </Pressable>
          {showResolved && resolved.map((a) => renderCard(a, true))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  content: { padding: 20, paddingBottom: 60 },
  title: { fontSize: 26, fontWeight: 'bold', color: colors.ink, marginBottom: 16 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.mist },
  resolvedCard: { opacity: 0.6 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: colors.ink, marginBottom: 12 },
  input: { borderWidth: 1, borderColor: colors.mist, borderRadius: radius.sm, padding: 12, color: colors.ink, backgroundColor: colors.cream, marginBottom: 12 },
  multiline: { minHeight: 70, textAlignVertical: 'top' },
  chip: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.md, backgroundColor: colors.cream, borderWidth: 1, borderColor: colors.mist, marginBottom: 12 },
  chipSelected: { backgroundColor: colors.sage, borderColor: colors.sage },
  chipText: { color: colors.ink, fontSize: 13 },
  chipTextSelected: { color: '#fff', fontWeight: '600' },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 },
  pinIcon: { fontSize: 13 },
  author: { fontWeight: '600', color: colors.ink, fontSize: 14 },
  date: { color: colors.ink, opacity: 0.6, fontSize: 12, marginLeft: 'auto' },
  announcementText: { color: colors.ink, fontSize: 15, marginBottom: 12 },
  resolvedText: { textDecorationLine: 'line-through' },
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 4 },
  actionIcon: { paddingHorizontal: 8, paddingVertical: 4 },
  resolveIcon: { color: colors.sage, fontSize: 20, fontWeight: '700' },
  neutralIcon: { fontSize: 15, opacity: 0.45 },
  editActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cancelButton: { paddingVertical: 8, paddingHorizontal: 4 },
  cancelText: { color: colors.ink, opacity: 0.6, fontSize: 14 },
  resolvedHeader: { paddingVertical: 12 },
  resolvedHeaderText: { color: colors.ink, opacity: 0.7, fontSize: 14, fontWeight: '600' },
  error: { color: '#B5544A', marginBottom: 12, textAlign: 'center' },
});