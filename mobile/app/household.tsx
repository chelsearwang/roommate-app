import { useState } from 'react';
import { View, TextInput, Button, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../utils/api';

export default function HouseholdScreen() {
  const [name, setName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const { token, user } = useAuth();

  async function handleCreate() {
    setError('');
    try {
      await apiRequest('/households/create', {
        method: 'POST',
        body: JSON.stringify({ name }),
      }, token!);
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
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome, {user?.name}!</Text>

      <Text style={styles.sectionTitle}>Create a household</Text>
      <TextInput
        style={styles.input}
        placeholder="Household name"
        placeholderTextColor="#999"
        value={name}
        onChangeText={setName}
      />
      <Button title="Create" onPress={handleCreate} />

      <Text style={styles.sectionTitle}>Or join one</Text>
      <TextInput
        style={styles.input}
        placeholder="Invite code"
        placeholderTextColor="#999"
        value={inviteCode}
        onChangeText={setInviteCode}
      />
      <Button title="Join" onPress={handleJoin} />

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 24, textAlign: 'center', color: '#000' },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginTop: 24, marginBottom: 8, color: '#000' },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    color: '#000',
    backgroundColor: '#fff',
  },
  error: { color: 'red', marginTop: 12, textAlign: 'center' },
});