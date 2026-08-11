import { useState, useCallback } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, StyleSheet, Alert, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/utils/api';
import { CozyButton } from '@/components/CozyButton';
import { ScreenHeader } from '@/components/ScreenHeader';
import { AVATAR_OPTIONS } from '@/constants/avatars';
import { colors, radius, shadow } from '@/constants/colors';
import * as Clipboard from 'expo-clipboard';
import { Share } from 'react-native';

type Member = { id: string; name: string; avatarEmoji: string };

export default function SettingsScreen() {
  const { token, user, refreshUser, logout } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [householdName, setHouseholdName] = useState('');
  const [avatarEmoji, setAvatarEmoji] = useState('🐰');
  const [editingName, setEditingName] = useState(false);
  const [error, setError] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [copied, setCopied] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [membersData, meData] = await Promise.all([
        apiRequest('/households/members', {}, token!),
        apiRequest('/me', {}, token!),
      ]);
      setMembers(membersData.members);
      setHouseholdName(meData.user.household?.name ?? '');
      setInviteCode(meData.user.household?.inviteCode ?? '');
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
  
  /*
  async function copyInviteCode() {
    await Clipboard.setStringAsync(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
    */
  
  async function copyInviteCode() {
    await Clipboard.setStringAsync(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function shareInviteCode() {
    try {
      await Share.share({ message: `Join my household on Household Platform! Invite code: ${inviteCode}` });
    } catch {
      // cancelled or failed silently — nothing to surface
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

  const sortedMembers = [...members].sort((a, b) => {
    if (a.id === user?.id) return -1;
    if (b.id === user?.id) return 1;
    return 0;
  });

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
              <Pressable onPress={saveName} style={styles.saveEditButton}>
                <Text style={styles.saveEditText}>Save</Text>
              </Pressable>
              <Pressable onPress={() => setEditingName(false)} style={styles.iconButton}>
                <Ionicons name="close" size={15} color={colors.text} />
              </Pressable>
            </View>
          </>
        ) : (
          <View style={styles.nameRow}>
            <Text style={styles.householdName}>{householdName}</Text>
            <Pressable onPress={() => setEditingName(true)} style={styles.iconButton}>
              <Ionicons name="create-outline" size={15} color={colors.blue} />
            </Pressable>
          </View>
        )}
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Invite code</Text>
        <View style={styles.inviteRow}>
          <Text style={styles.inviteCode} numberOfLines={1} adjustsFontSizeToFit>{inviteCode}</Text>
          <Pressable onPress={copyInviteCode} style={styles.iconButton}>
            <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color={colors.blue} />
          </Pressable>
          <Pressable onPress={shareInviteCode} style={styles.iconButton}>
            <Ionicons name="share-outline" size={16} color={colors.blue} />
          </Pressable>
        </View>
        {copied ? <Text style={styles.copiedText}>Copied!</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Members</Text>
        {sortedMembers.map((m) => (
          <View key={m.id} style={styles.memberRow}>
            <Text style={styles.memberAvatar}>{m.avatarEmoji}</Text>
            <Text style={styles.memberName}>{m.name}{m.id === user?.id ? ' (you)' : ''}</Text>
          </View>
        ))}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <CozyButton title="Log out" onPress={logout} />
      <CozyButton title="Leave household" variant="secondary" onPress={handleLeave} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 24, paddingBottom: 60 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border, ...shadow },
  cardTitle: { fontSize: 14, color: colors.text, opacity: 0.7, marginBottom: 12 },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  avatarOption: { width: 50, height: 50, borderRadius: 25, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  avatarOptionSelected: { borderColor: colors.sage, backgroundColor: colors.sageTint },
  avatarOptionEmoji: { fontSize: 24 },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  householdName: { fontSize: 18, fontWeight: '700', color: colors.text },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: 12, color: colors.text, backgroundColor: colors.background, marginBottom: 12 },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cancelButton: { paddingVertical: 8 },
  cancelText: { color: colors.text, opacity: 0.6 },
  iconButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.blueTint, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border },
  memberAvatar: { fontSize: 18 },
  memberName: { fontSize: 15, color: colors.text },
  error: { color: '#B5544A', marginBottom: 12, textAlign: 'center' },
  saveEditButton: { backgroundColor: colors.sageTint, borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 20 },
  saveEditText: { color: colors.sage, fontWeight: '700', fontSize: 14 },
  inviteRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inviteCode: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.text, letterSpacing: 1 },
  copiedText: { fontSize: 12, color: colors.sage, marginTop: 8, fontWeight: '600' },
});