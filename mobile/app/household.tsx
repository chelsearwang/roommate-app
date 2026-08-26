import { useState } from 'react';
import { View, TextInput, Pressable, Text, StyleSheet, Modal, Platform, Alert } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../utils/api';
import { CozyButton } from '../components/CozyButton';
import { colors, radius, shadow } from '../constants/colors';
import Ionicons from '@expo/vector-icons/Ionicons';

export default function HouseholdScreen() {
  const [name, setName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false);
  const [deleteAccountText, setDeleteAccountText] = useState('');
  const { token, user, refreshUser, logout } = useAuth();

  async function handleCreate() {
    setError('');
    try {
      await apiRequest('/households/create', {
        method: 'POST',
        body: JSON.stringify({ name }),
      }, token!);
      await refreshUser();
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleJoin() {
    setError('');
    try {
      await apiRequest('/households/join', {
        method: 'POST',
        body: JSON.stringify({ inviteCode }),
      }, token!);
      await refreshUser();
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleDeleteAccount() {
    try {
      await apiRequest('/me', { method: 'DELETE' }, token!);
      logout();
    } catch (err: any) {
      setShowDeleteAccountConfirm(false);
      setDeleteAccountText('');
      if (Platform.OS === 'web') {
        window.alert(err.message);
      } else {
        Alert.alert('Unable to delete account', err.message);
      }
    }
  }

  return (
    <>
    <View style={styles.container}>
      <Text style={styles.title}>Welcome, {user?.name}! 👋</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Create a household</Text>
        <TextInput
          style={styles.input}
          placeholder="Household name"
          placeholderTextColor="#999"
          value={name}
          onChangeText={setName}
        />
        <CozyButton title="Create" onPress={handleCreate} />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Or join one</Text>
        <TextInput
          style={styles.input}
          placeholder="Invite code"
          placeholderTextColor="#999"
          value={inviteCode}
          onChangeText={setInviteCode}
        />
        <CozyButton title="Join" variant="secondary" onPress={handleJoin} />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.accountOptionsRow}>
        <Pressable onPress={logout} style={styles.accountOptionPill}>
          <Ionicons name="log-out-outline" size={15} color={colors.text} style={{ opacity: 0.7 }} />
          <Text style={styles.accountOptionText}>Sign out</Text>
        </Pressable>
        <Pressable onPress={() => setShowDeleteAccountConfirm(true)} style={[styles.accountOptionPill, styles.deleteAccountPill]}>
          <Ionicons name="trash-outline" size={15} color={colors.coral} />
          <Text style={styles.deleteAccountPillText}>Delete my account</Text>
        </Pressable>
      </View>
    </View>


    <Modal
      visible={showDeleteAccountConfirm}
      transparent
      animationType="fade"
      onRequestClose={() => { setShowDeleteAccountConfirm(false); setDeleteAccountText(''); }}
    >
      <View style={styles.modalOverlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => { setShowDeleteAccountConfirm(false); setDeleteAccountText(''); }}
        />
        <View style={styles.modalCard}>
          <Text style={styles.dangerTitle}>⚠️ Delete your account</Text>
          <Text style={styles.dangerText}>
            This permanently deletes your account and everything tied to it. This can't be undone.
          </Text>
          <Text style={styles.dangerLabel}>Type DELETE to confirm</Text>
          <TextInput
            style={styles.input}
            value={deleteAccountText}
            onChangeText={setDeleteAccountText}
            placeholder="DELETE"
            placeholderTextColor="#999"
            autoCapitalize="characters"
          />
          <View style={styles.editRow}>
            <Pressable onPress={() => { setShowDeleteAccountConfirm(false); setDeleteAccountText(''); }} style={styles.modalCancelButton}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleDeleteAccount}
              disabled={deleteAccountText !== 'DELETE'}
              style={[styles.deleteConfirmButton, deleteAccountText !== 'DELETE' && styles.deleteConfirmButtonDisabled]}
            >
              <Text style={styles.deleteConfirmButtonText}>Permanently delete</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.background },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 24, textAlign: 'center', color: colors.text },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border, ...shadow },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12, color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 12,
    marginBottom: 12,
    color: colors.text,
    backgroundColor: colors.background,
  },
  error: { color: '#B5544A', marginTop: 12, textAlign: 'center' },
  // signOutLink: { alignSelf: 'center', paddingVertical: 8, marginBottom: 12 },
  // signOutText: { color: colors.text, opacity: 0.5, fontSize: 13, textDecorationLine: 'underline' },
  // deleteAccountLink: { alignSelf: 'center', paddingVertical: 4 },
  // deleteAccountText: { color: colors.coral, opacity: 0.7, fontSize: 12, textDecorationLine: 'underline' },
  accountOptionsRow: { flexDirection: 'row', gap: 10, marginTop: 24 },
  accountOptionPill: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 14, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  accountOptionText: { color: colors.text, opacity: 0.7, fontSize: 13, fontWeight: '600' },
  deleteAccountPill: { backgroundColor: colors.coralTint, borderColor: colors.coral },
  deleteAccountPillText: { color: colors.coral, fontSize: 13, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 20, width: '100%', maxWidth: 400, borderWidth: 1.5, borderColor: colors.coral },
  dangerTitle: { fontSize: 15, fontWeight: '700', color: colors.coral, marginBottom: 8 },
  dangerText: { fontSize: 13, color: colors.text, opacity: 0.8, marginBottom: 12, lineHeight: 18 },
  dangerLabel: { fontSize: 12, fontWeight: '700', color: colors.text, opacity: 0.6, marginBottom: 6 },
  deleteConfirmButton: { flex: 1, backgroundColor: colors.coral, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center' },
  deleteConfirmButtonDisabled: { opacity: 0.4 },
  deleteConfirmButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  iconButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.blueTint, alignItems: 'center', justifyContent: 'center' },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  modalCancelButton: { paddingVertical: 12, paddingHorizontal: 16 },
  modalCancelText: { color: colors.text, opacity: 0.6, fontWeight: '600', fontSize: 14 },
});