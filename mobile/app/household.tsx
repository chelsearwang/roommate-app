import { useState } from 'react';
import { View, TextInput, Pressable, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../utils/api';
import { CozyButton } from '../components/CozyButton';
import { colors, radius, shadow } from '../constants/colors';

export default function HouseholdScreen() {
  const [name, setName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome, {user?.name}! 👋</Text>

      <Pressable onPress={logout} style={styles.signOutLink}>
        <Text style={styles.signOutText}>Not you? Sign out</Text>
      </Pressable>

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
    </View>
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
  signOutLink: { alignSelf: 'center', paddingVertical: 8, marginBottom: 12 },
  signOutText: { color: colors.text, opacity: 0.5, fontSize: 13, textDecorationLine: 'underline' },
});