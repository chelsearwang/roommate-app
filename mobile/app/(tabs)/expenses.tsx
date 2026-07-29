import { useState, useCallback } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, Alert, Platform, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/utils/api';
import { CozyButton } from '@/components/CozyButton';
import { colors, radius } from '@/constants/colors';

type Expense = {
  id: string;
  description: string;
  amount: string;
  createdAt: string;
  payer?: { name: string };
  shares: { settled: boolean }[];
};

type Transaction = { from: string; to: string; amount: number; fromName: string; toName: string };

export default function ExpensesScreen() {
  const { token } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [expensesData, settleData] = await Promise.all([
        apiRequest('/expenses', {}, token!),
        apiRequest('/households/settle-up', {}, token!),
      ]);
      setExpenses(expensesData.expenses);
      setTransactions(settleData.transactions);
    } catch (err: any) {
      setError(err.message);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  async function handleCreate() {
    const parsedAmount = parseFloat(amount);
    if (!description || !parsedAmount) return;
    setError('');
    try {
      await apiRequest('/expenses', { method: 'POST', body: JSON.stringify({ description, amount: parsedAmount }) }, token!);
      setDescription('');
      setAmount('');
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  }
  function handleSettle(t: Transaction) {
  const performSettle = async () => {
    try {
      await apiRequest('/households/settle-up/confirm', { method: 'POST', body: JSON.stringify({ userA: t.from, userB: t.to }) }, token!);
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const message = `Mark the debt between ${t.fromName} and ${t.toName} as settled?`;
  if (Platform.OS === 'web') {
    if (window.confirm(message)) performSettle();
  } else {
    Alert.alert('Mark settled?', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: performSettle },
    ]);
  }
}

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Expenses</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Log an expense</Text>
        <TextInput
          style={styles.input}
          placeholder="What was it for?"
          placeholderTextColor="#999"
          value={description}
          onChangeText={setDescription}
        />
        <TextInput
          style={styles.input}
          placeholder="Amount"
          placeholderTextColor="#999"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
        />
        <CozyButton title="Log expense" onPress={handleCreate} />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Settle Up</Text>
        {transactions.length === 0 ? (
          <Text style={styles.settledText}>All settled up 🎉</Text>
        ) : (
          transactions.map((t, i) => (
            <View key={i} style={styles.transactionRow}>
                <Text style={styles.transactionText}>
                <Text style={styles.bold}>{t.fromName}</Text> owes <Text style={styles.bold}>{t.toName}</Text>{' '}
                <Text style={styles.amount}>${t.amount.toFixed(2)}</Text>
                </Text>
                <Pressable onPress={() => handleSettle(t)} style={styles.actionIcon}>
                <Text style={styles.resolveIcon}>✓</Text>
                </Pressable>
            </View>
            ))
        )}
      </View>

      <Text style={styles.sectionTitle}>History</Text>
      {expenses.map((e) => {
        const isSettled = e.shares.every((s) => s.settled);
        return (
            <View key={e.id} style={[styles.historyRow, isSettled && styles.historyRowSettled]}>
            <View style={{ flex: 1 }}>
                <Text style={styles.historyDesc}>{e.description}</Text>
                <Text style={styles.historyMeta}>
                {e.payer?.name} · {new Date(e.createdAt).toLocaleDateString()}
                </Text>
            </View>
            <Text style={styles.historyAmount}>${Number(e.amount).toFixed(2)}</Text>
            </View>
        );
        })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  content: { padding: 20, paddingBottom: 60 },
  title: { fontSize: 26, fontWeight: 'bold', color: colors.ink, marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: colors.ink, marginTop: 8, marginBottom: 12 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.mist },
  cardTitle: { fontSize: 16, fontWeight: '600', color: colors.ink, marginBottom: 12 },
  input: { borderWidth: 1, borderColor: colors.mist, borderRadius: radius.sm, padding: 12, color: colors.ink, backgroundColor: colors.cream, marginBottom: 12 },
  settledText: { color: colors.sage, fontStyle: 'italic' },
  transactionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.mist },
  transactionText: { color: colors.ink, fontSize: 15, flex: 1 },
  bold: { fontWeight: '700' },
  amount: { color: colors.clay, fontWeight: '700' },
  historyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: radius.md, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.mist },
  historyDesc: { color: colors.ink, fontSize: 15, fontWeight: '500' },
  historyMeta: { color: colors.ink, opacity: 0.6, fontSize: 12, marginTop: 2 },
  historyAmount: { color: colors.ink, fontWeight: '700', fontSize: 15 },
  historyRowSettled: { opacity: 0.5 },
  actionIcon: { paddingHorizontal: 8, paddingVertical: 4 },
  resolveIcon: { color: colors.sage, fontSize: 20, fontWeight: '700' },
  error: { color: '#B5544A', marginBottom: 12, textAlign: 'center' },
});