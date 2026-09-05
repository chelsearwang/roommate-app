import { useState, useCallback } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, StyleSheet, Alert, Platform, Modal } from 'react-native';
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
import { router } from 'expo-router';
import { LoadingScreen } from '@/components/LoadingScreen';

type Member = { id: string; name: string; avatarEmoji: string };

const APP_VERSION = '1.0.0';

export default function SettingsScreen() {
  const { token, user, refreshUser, logout } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [householdName, setHouseholdName] = useState('');
  const [avatarEmoji, setAvatarEmoji] = useState('🐰');
  const [email, setEmail] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [error, setError] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingName, setIsSavingName] = useState(false);
  const [isDeletingHousehold, setIsDeletingHousehold] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

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
      setEmail(meData.user.email ?? '');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  async function saveName() {
    setIsSavingName(true);
    try {
      await apiRequest('/households/rename', { method: 'PATCH', body: JSON.stringify({ name: householdName }) }, token!);
      await refreshUser();
      setEditingName(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSavingName(false);
    }
  }

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
        if (err.message.includes('only member')) {
          const explainMessage = "You're the only member, so leaving isn't possible — it would leave the household empty. Delete it instead?";
          if (Platform.OS === 'web') {
            if (window.confirm(explainMessage)) setShowDeleteConfirm(true);
          } else {
            Alert.alert("Can't leave — you're the only member", explainMessage, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete household', style: 'destructive', onPress: () => setShowDeleteConfirm(true) },
            ]);
          }
        } else if (err.message.includes('Settle up before leaving')) {
          const explainMessage = 'Settle up your expenses before leaving this household.';
          if (Platform.OS === 'web') {
            if (window.confirm(explainMessage + ' Go to Expenses now?')) router.push('/expenses');
          } else {
            Alert.alert('Unsettled expenses', explainMessage, [
              { text: 'Later', style: 'cancel' },
              { text: 'Go to Expenses', onPress: () => router.push('/expenses') },
            ]);
          }
        } else {
          setError(err.message);
        }
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

  async function handleDeleteHousehold() {
    setIsDeletingHousehold(true);
    try {
      await apiRequest('/households', { method: 'DELETE' }, token!);
      await refreshUser();
    } catch (err: any) {
      setError(err.message);
      setIsDeletingHousehold(false);
    }
  }

  function handleDeleteAccountFromSettings() {
    const message = 'You need to leave or delete this household before you can delete your account.';
    if (Platform.OS === 'web') {
      window.alert(message);
    } else {
      Alert.alert("Can't delete account yet", message);
    }
  }

  function handleLogout() {
    setIsLoggingOut(true);
    logout();
  }

  if (isLoading) {
    return <LoadingScreen message="Loading settings..." />;
  }

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <ScreenHeader eyebrow="ACCOUNT" title="Settings" icon="settings-outline" />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* PROFILE */}
        <Text style={styles.sectionLabel}>PROFILE</Text>
        <View style={styles.card}>
          <View style={styles.profileRow}>
            <View style={styles.profileAvatarCircle}>
              <Text style={styles.profileAvatarEmoji}>{avatarEmoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileName}>{user?.name}</Text>
              {email ? <Text style={styles.profileEmail}>{email}</Text> : null}
            </View>
            <Pressable onPress={() => setShowAvatarPicker(!showAvatarPicker)} style={styles.editPill}>
              <Text style={styles.editPillText}>Edit</Text>
            </Pressable>
          </View>
          {showAvatarPicker && (
            <View style={styles.avatarGrid}>
              {AVATAR_OPTIONS.map((emoji) => (
                <Pressable key={emoji} onPress={() => selectAvatar(emoji)} style={[styles.avatarOption, avatarEmoji === emoji && styles.avatarOptionSelected]}>
                  <Text style={styles.avatarOptionEmoji}>{emoji}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* HOUSEHOLD */}
        <Text style={styles.sectionLabel}>HOUSEHOLD</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Household name</Text>
          {editingName ? (
            <>
              <TextInput style={styles.input} value={householdName} onChangeText={setHouseholdName} />
              <View style={styles.editRow}>
                <Pressable onPress={saveName} disabled={isSavingName} style={[styles.saveEditButton, isSavingName && { opacity: 0.6 }]}>
                  <Text style={styles.saveEditText}>{isSavingName ? 'Saving...' : 'Save'}</Text>
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

        {/* APP */}
        <Text style={styles.sectionLabel}>APP</Text>
        <View style={styles.card}>
          <Pressable onPress={() => router.push('/privacy')} style={styles.linkRow}>
            <Text style={styles.linkRowText}>Privacy Policy</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.text} style={{ opacity: 0.4 }} />
          </Pressable>
          <View style={styles.linkDivider} />
          <View style={styles.linkRow}>
            <Text style={styles.linkRowText}>Version</Text>
            <Text style={styles.versionText}>{APP_VERSION}</Text>
          </View>
        </View>

        {/* ACCOUNT */}
        <Text style={styles.sectionLabel}>ACCOUNT</Text>
        <CozyButton title={isLoggingOut ? 'Logging out...' : 'Log out'} onPress={handleLogout} />
        <CozyButton title="Leave household" variant="secondary" onPress={handleLeave} />
        <CozyButton title="Delete household" variant="danger" onPress={() => setShowDeleteConfirm(true)} />
        <CozyButton title="Delete my account" variant="danger" onPress={handleDeleteAccountFromSettings} />
      </ScrollView>

      <Modal
        visible={showDeleteConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }}
          />
          <View style={styles.modalCard}>
            <Text style={styles.dangerTitle}>⚠️ Delete household</Text>
            <Text style={styles.dangerText}>
              This permanently deletes all chores, expenses, and announcements for every member of "{householdName}". This can't be undone.
            </Text>
            <Text style={styles.dangerLabel}>Type "{householdName}" to confirm</Text>
            <TextInput
              style={styles.input}
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              placeholder={householdName}
              placeholderTextColor="#999"
              autoCapitalize="none"
            />
            <View style={styles.editRow}>
              <Pressable
                onPress={handleDeleteHousehold}
                disabled={isDeletingHousehold || deleteConfirmText !== householdName}
                style={[styles.deleteConfirmButton, (isDeletingHousehold || deleteConfirmText !== householdName) && styles.deleteConfirmButtonDisabled]}
              >
                <Text style={styles.deleteConfirmButtonText}>{isDeletingHousehold ? 'Deleting...' : 'Permanently delete'}</Text>
              </Pressable>
              <Pressable onPress={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }} style={styles.iconButton}>
                <Ionicons name="close" size={15} color={colors.text} />
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 24, paddingBottom: 60 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: colors.text, opacity: 0.5, letterSpacing: 0.5, marginTop: 20, marginBottom: 8 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border, ...shadow },
  cardTitle: { fontSize: 14, color: colors.text, opacity: 0.7, marginBottom: 12 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  profileAvatarCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.blueTint, alignItems: 'center', justifyContent: 'center' },
  profileAvatarEmoji: { fontSize: 28 },
  profileName: { fontSize: 17, fontWeight: '700', color: colors.text },
  profileEmail: { fontSize: 13, color: colors.text, opacity: 0.6, marginTop: 2 },
  editPill: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: colors.blue },
  editPillText: { color: colors.blue, fontWeight: '700', fontSize: 13 },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  avatarOption: { width: 50, height: 50, borderRadius: 25, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  avatarOptionSelected: { borderColor: colors.sage, backgroundColor: colors.sageTint },
  avatarOptionEmoji: { fontSize: 24 },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  householdName: { fontSize: 18, fontWeight: '700', color: colors.text },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: 12, color: colors.text, backgroundColor: colors.background, marginBottom: 12 },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
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
  linkRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  linkRowText: { fontSize: 15, color: colors.text, fontWeight: '600' },
  linkDivider: { height: 1, backgroundColor: colors.border, marginVertical: 8 },
  versionText: { fontSize: 13, color: colors.text, opacity: 0.5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 20, width: '100%', maxWidth: 400, borderWidth: 1.5, borderColor: colors.coral },
  dangerTitle: { fontSize: 15, fontWeight: '700', color: colors.coral, marginBottom: 8 },
  dangerText: { fontSize: 13, color: colors.text, opacity: 0.8, marginBottom: 12, lineHeight: 18 },
  dangerLabel: { fontSize: 12, fontWeight: '700', color: colors.text, opacity: 0.6, marginBottom: 6 },
  deleteConfirmButton: { flex: 1, backgroundColor: colors.coral, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center' },
  deleteConfirmButtonDisabled: { opacity: 0.4 },
  deleteConfirmButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});