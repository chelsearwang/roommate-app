import { useState, useCallback } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, Alert, Platform, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/utils/api';
import { ScreenHeader } from '@/components/ScreenHeader';
import { colors, radius, shadow } from '@/constants/colors';

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
  const [showAddForm, setShowAddForm] = useState(false);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [editAmount, setEditAmount] = useState('');
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
  
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentExpenses = expenses.filter((e) => new Date(e.createdAt).getTime() >= thirtyDaysAgo);
  const totalSpent = recentExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

  async function handleCreate() {
    const parsedAmount = parseFloat(amount);
    if (!description || !parsedAmount) return;
    setError('');
    try {
      await apiRequest('/expenses', { method: 'POST', body: JSON.stringify({ description, amount: parsedAmount }) }, token!);
      setDescription('');
      setAmount('');
      setShowAddForm(false);
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

  function startEditExpense(e: Expense) {
    setEditingExpenseId(e.id);
    setEditDescription(e.description);
    setEditAmount(String(e.amount));
  }

  function cancelEditExpense() {
    setEditingExpenseId(null);
    setEditDescription('');
    setEditAmount('');
  }

  function handleDeleteExpense(id: string, description: string) {
    const performDelete = async () => {
      try {
        await apiRequest(`/expenses/${id}`, { method: 'DELETE' }, token!);
        loadData();
      } catch (err: any) {
        setError(err.message);
      }
    };
    const message = `Delete "${description}"? This can't be undone.`;
    if (Platform.OS === 'web') {
      if (window.confirm(message)) performDelete();
    } else {
      Alert.alert('Delete expense?', message, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: performDelete },
      ]);
    }
  }

  async function saveEditExpense(id: string) {
    const parsedAmount = parseFloat(editAmount);
    try {
      await apiRequest(`/expenses/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ description: editDescription, amount: parsedAmount }),
      }, token!);
      setEditingExpenseId(null);
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenHeader eyebrow="MONEY" title="Expenses" emoji="💸" rightAction={{ label: 'Log expense', onPress: () => setShowAddForm(true) }} />

      {showAddForm && (
        <View style={styles.card}>
          <View style={styles.addFormHeader}>
            <Text style={styles.cardTitle}>New expense</Text>
            <Pressable onPress={() => setShowAddForm(false)}>
              <Ionicons name="close" size={20} color={colors.text} style={{ opacity: 0.5 }} />
            </Pressable>
          </View>
          <TextInput style={styles.input} placeholder="What was it for?" placeholderTextColor="#999" value={description} onChangeText={setDescription} />
          <TextInput style={styles.input} placeholder="Amount" placeholderTextColor="#999" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
          <Pressable onPress={handleCreate} style={styles.saveButton}>
            <Text style={styles.saveButtonText}>Log expense</Text>
          </Pressable>
        </View>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: colors.sageTint }]}>
          <View style={styles.statHeaderRow}>
            <Ionicons name="cash-outline" size={15} color={colors.sage} />
            <Text style={[styles.statHeaderLabel, { color: colors.sage }]}>PAST 30 DAYS</Text>
          </View>
          <Text style={[styles.statNumber, { color: colors.sage }]}>${totalSpent.toFixed(2)}</Text>
          <Text style={styles.statLabel}>total spent</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.coralTint }]}>
          <View style={styles.statHeaderRow}>
            <Ionicons name="receipt-outline" size={15} color={colors.coral} />
            <Text style={[styles.statHeaderLabel, { color: colors.coral }]}>PAST 30 DAYS</Text>
          </View>
          <Text style={[styles.statNumber, { color: colors.coral }]}>{recentExpenses.length}</Text>
          <Text style={styles.statLabel}>transactions logged</Text>
        </View>
      </View>

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
              <Pressable onPress={() => handleSettle(t)} style={styles.iconButton}>
                <Ionicons name="checkmark-circle" size={20} color={colors.sage} />
              </Pressable>
            </View>
          ))
        )}
      </View>

      <Text style={styles.sectionTitle}>History</Text>
      {expenses.map((e) => {
        const isSettled = e.shares.every((s) => s.settled);
        const isEditing = editingExpenseId === e.id;
        return (
          <View key={e.id} style={[styles.historyRow, isSettled && styles.historyRowSettled]}>
            {isEditing ? (
              <View style={{ flex: 1 }}>
                <TextInput style={styles.input} value={editDescription} onChangeText={setEditDescription} />
                <TextInput style={styles.input} value={editAmount} onChangeText={setEditAmount} keyboardType="decimal-pad" />
                <View style={styles.editActionRow}>
                  <Pressable onPress={() => saveEditExpense(e.id)} style={styles.editSaveButton}>
                    <Text style={styles.editSaveText}>Save</Text>
                  </Pressable>
                  <Pressable onPress={cancelEditExpense} style={styles.iconButton}>
                    <Ionicons name="close" size={15} color={colors.text} />
                  </Pressable>
                </View>
              </View>
            ) : (
              <>
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyDesc}>{e.description}</Text>
                  <Text style={styles.historyMeta}>{e.payer?.name} · {new Date(e.createdAt).toLocaleDateString()}</Text>
                </View>
                <Text style={styles.historyAmount}>${Number(e.amount).toFixed(2)}</Text>
                <Pressable onPress={() => startEditExpense(e)} style={styles.iconButton}>
                  <Ionicons name="create-outline" size={15} color={colors.blue} />
                </Pressable>
                <Pressable onPress={() => handleDeleteExpense(e.id, e.description)} style={[styles.iconButton, styles.iconButtonDanger]}>
                  <Ionicons name="trash-outline" size={15} color={colors.coral} />
                </Pressable>
              </>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 24, paddingBottom: 120 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginTop: 8, marginBottom: 12 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border, ...shadow },
  addFormHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 12 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, color: colors.text, backgroundColor: colors.background, marginBottom: 12 },
  saveButton: { backgroundColor: colors.blue, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', marginTop: 4, ...shadow },
  saveButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  settledText: { color: colors.sage, fontStyle: 'italic' },
  transactionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  transactionText: { color: colors.text, fontSize: 15, flex: 1 },
  bold: { fontWeight: '700' },
  amount: { color: colors.coral, fontWeight: '700' },
  iconButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.blueTint, alignItems: 'center', justifyContent: 'center' },
  iconButtonDanger: { backgroundColor: colors.coralTint },
  editActionRow: { flexDirection: 'row', gap: 8 },
  editSaveButton: { backgroundColor: colors.sageTint, borderRadius: radius.md, paddingVertical: 8, paddingHorizontal: 16, alignItems: 'center' },
  editSaveText: { color: colors.sage, fontWeight: '700', fontSize: 13 },
  historyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, backgroundColor: colors.card, borderRadius: radius.md, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border, ...shadow },
  historyRowSettled: { opacity: 0.5 },
  historyDesc: { color: colors.text, fontSize: 15, fontWeight: '500' },
  historyMeta: { color: colors.text, opacity: 0.6, fontSize: 12, marginTop: 2 },
  historyAmount: { color: colors.text, fontWeight: '700', fontSize: 15 },
  error: { color: '#B5544A', marginBottom: 12, textAlign: 'center' },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  statCard: { flex: 1, borderRadius: radius.lg, padding: 16 },
  statHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10 },
  statHeaderLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  statNumber: { fontSize: 30, fontWeight: '800', marginBottom: 4 },
  statLabel: { fontSize: 12, color: colors.text, opacity: 0.7 },
});