import { useState, useCallback } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, StyleSheet, Alert, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/utils/api';
import { CozyButton } from '@/components/CozyButton';
import { ScreenHeader } from '@/components/ScreenHeader';
import { AVATAR_OPTIONS } from '@/constants/avatars';
import { colors, radius, shadow } from '@/constants/colors';

type Member = { id: string; name: string; avatarEmoji: string };

export default function SettingsScreen() {
  const { token, user, refreshUser } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [householdName, setHouseholdName] = useState('');
  const [avatarEmoji, setAvatarEmoji] = useState('🐰');
  const [editingName, setEditingName] = useState(false);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [membersData, meData] = await Promise.all([
        apiRequest('/households/members', {}, token!),
        apiRequest('/me', {}, token!),
      ]);
      setMembers(membersData.members);
      setHouseholdName(meData.user.household?.name ?? '');
      setAvatarEmoji(meData.user.avatarEmoji);
    } catch (err: any) {
      setError(err.message);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  async function saveName() {
    try {
      await apiRequest('/households/rename', { method: 'PATCH', body: JSON.stringify({ name: householdName }) }, token!);
      await refreshUser();
      setEditingName(false);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function selectAvatar(emoji: string) {
    try {
      await apiRequest('/me/avatar', { method: 'PATCH', body: JSON.stringify({ avatarEmoji: emoji }) }, token!);
      setAvatarEmoji(emoji);
      await refreshUser();
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  }

  function handleLeave() {
    const performLeave = async () => {
      try {
        await apiRequest('/households/leave', { method: 'POST' }, token!);
        await refreshUser();
      } catch (err: any) {
        setError(err.message);
      }
    };
    const message = "You'll need an invite code to rejoin. Are you sure?";
    if (Platform.OS === 'web') {
      if (window.confirm(message)) performLeave();
    } else {
      Alert.alert('Leave household?', message, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: performLeave },
      ]);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenHeader eyebrow="ACCOUNT" title="Settings" emoji="⚙️" />

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Your avatar</Text>
        <View style={styles.avatarGrid}>
          {AVATAR_OPTIONS.map((emoji) => (
            <Pressable key={emoji} onPress={() => selectAvatar(emoji)} style={[styles.avatarOption, avatarEmoji === emoji && styles.avatarOptionSelected]}>
              <Text style={styles.avatarOptionEmoji}>{emoji}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Household name</Text>
        {editingName ? (
          <>
            <TextInput style={styles.input} value={householdName} onChangeText={setHouseholdName} />
            <View style={styles.editRow}>
              <CozyButton title="Save" onPress={saveName} />
              <Pressable onPress={() => setEditingName(false)} style={styles.cancelButton}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <Pressable onPress={() => setEditingName(true)}>
            <Text style={styles.householdName}>{householdName} ✏️</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Members</Text>
        {members.map((m) => (
          <View key={m.id} style={styles.memberRow}>
            <Text style={styles.memberAvatar}>{m.avatarEmoji}</Text>
            <Text style={styles.memberName}>{m.name}{m.id === user?.id ? ' (you)' : ''}</Text>
          </View>
        ))}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <CozyButton title="Leave household" variant="secondary" onPress={handleLeave} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  content: { paddingHorizontal: 24, paddingBottom: 60 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.mist, ...shadow },
  cardTitle: { fontSize: 14, color: colors.ink, opacity: 0.7, marginBottom: 12 },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  avatarOption: { width: 50, height: 50, borderRadius: 25, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  avatarOptionSelected: { borderColor: colors.sage, backgroundColor: colors.sageTint },
  avatarOptionEmoji: { fontSize: 24 },
  householdName: { fontSize: 18, fontWeight: '700', color: colors.ink },
  input: { borderWidth: 1, borderColor: colors.mist, borderRadius: radius.sm, padding: 12, color: colors.ink, backgroundColor: colors.cream, marginBottom: 12 },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cancelButton: { paddingVertical: 8 },
  cancelText: { color: colors.ink, opacity: 0.6 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.mist },
  memberAvatar: { fontSize: 18 },
  memberName: { fontSize: 15, color: colors.ink },
  error: { color: '#B5544A', marginBottom: 12, textAlign: 'center' },
});