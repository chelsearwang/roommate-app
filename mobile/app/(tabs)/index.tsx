import { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/utils/api';
import { GamificationBar } from '@/components/GamificationBar';
import { formatRelativeTime } from '@/utils/time';
import { colors, radius, shadow } from '@/constants/colors';

type Announcement = { id: string; content: string; pinned: boolean; resolved: boolean; createdAt: string; author?: { name: string } };
type Chore = { id: string; assignments: { userId: string; status: string }[] };
type MeData = { xp: number; avatarLevel: number; name: string; household?: { streakCount: number; name: string } };
type Stats = { completedThisWeek: number; householdOverdueCount: number };
type Transaction = { from: string; to: string; amount: number };
type NotificationItem = { id: string; content: string };

export default function DashboardScreen() {
  const { user, token } = useAuth();
  const insets = useSafeAreaInsets();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [chores, setChores] = useState<Chore[]>([]);
  const [meData, setMeData] = useState<MeData | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [announcementsData, choresData, meResponse, statsData, settleData, notificationsData] = await Promise.all([
        apiRequest('/announcements', {}, token!),
        apiRequest('/chores', {}, token!),
        apiRequest('/me', {}, token!),
        apiRequest('/households/stats', {}, token!),
        apiRequest('/households/settle-up', {}, token!),
        apiRequest('/notifications', {}, token!),
      ]);
      setAnnouncements(announcementsData.announcements.filter((a: Announcement) => !a.resolved).slice(0, 3));
      setChores(choresData.chores);
      setMeData(meResponse.user);
      setStats(statsData);
      setTransactions(settleData.transactions);
      setNotifications(notificationsData.notifications);
    } catch (err: any) {
      setError(err.message);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const myOverdueCount = chores.filter((c) => {
    const a = c.assignments[0];
    return a && a.userId === user?.id && a.status === 'overdue';
  }).length;

  const myPendingCount = chores.filter((c) => {
    const a = c.assignments[0];
    return a && a.userId === user?.id && a.status !== 'done';
  }).length;

  const myOwedAmount = transactions
    .filter((t) => t.from === user?.id)
    .reduce((sum, t) => sum + t.amount, 0);

  async function dismissNotification(id: string) {
    try {
      await apiRequest(`/notifications/${id}/read`, { method: 'PATCH' }, token!);
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + 40 }]}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.eyebrow}>YOUR HOME</Text>
          <Text style={styles.title}>{meData?.household?.name ?? 'Household'}</Text>
        </View>
        <Pressable onPress={() => router.push('/settings')}>
          <Ionicons name="settings-outline" size={26} color={colors.ink} />
        </Pressable>
      </View>

      {meData && (
        <GamificationBar
          name={meData.name}
          avatarEmoji={meData.avatarEmoji}
          xp={meData.xp}
          avatarLevel={meData.avatarLevel}
          streakCount={meData.household?.streakCount ?? 0}
          overdueCount={myOverdueCount}
        />
      )}

      {notifications.map((n) => (
        <Pressable key={n.id} onPress={() => dismissNotification(n.id)} style={styles.nudgeBanner}>
          <Ionicons name="notifications" size={18} color={colors.terracotta} />
          <Text style={styles.nudgeBannerText}>{n.content}</Text>
          <Ionicons name="close" size={16} color={colors.ink} style={{ opacity: 0.4 }} />
        </Pressable>
      ))}

      {myOverdueCount > 0 && (
        <Pressable onPress={() => router.push('/chores')} style={styles.overdueBanner}>
          <Ionicons name="alert-circle-outline" size={20} color={colors.terracotta} />
          <Text style={styles.overdueText}>
            You have {myOverdueCount} overdue chore{myOverdueCount > 1 ? 's' : ''} — tap to view
          </Text>
        </Pressable>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {stats && (
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.sageTint }]}>
            <View style={styles.statHeaderRow}>
              <Ionicons name="checkmark-circle" size={15} color={colors.sage} />
              <Text style={[styles.statHeaderLabel, { color: colors.sage }]}>THIS WEEK</Text>
            </View>
            <Text style={[styles.statNumber, { color: colors.sage }]}>{stats.completedThisWeek}</Text>
            <Text style={styles.statLabel}>chores completed</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.terracottaTint }]}>
            <View style={styles.statHeaderRow}>
              <Ionicons name="alert-circle" size={15} color={colors.terracotta} />
              <Text style={[styles.statHeaderLabel, { color: colors.terracotta }]}>OVERDUE</Text>
            </View>
            <Text style={[styles.statNumber, { color: colors.terracotta }]}>{stats.householdOverdueCount}</Text>
            <Text style={styles.statLabel}>across all roommates</Text>
          </View>
        </View>
      )}

      <View style={styles.card}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionHeaderLeft}>
            <Ionicons name="sparkles" size={17} color={colors.terracotta} />
            <Text style={styles.cardSectionTitle}>Announcements</Text>
          </View>
          <Pressable onPress={() => router.push('/announcements')}>
            <Text style={styles.seeAllText}>See all →</Text>
          </Pressable>
        </View>
        {announcements.length === 0 ? (
          <Text style={styles.emptyText}>Nothing new right now.</Text>
        ) : (
          announcements.map((a, i) => (
            <View key={a.id} style={[styles.announcementItem, i < announcements.length - 1 && styles.announcementDivider]}>
              <View style={styles.announcementTopRow}>
                {a.pinned && <Ionicons name="pin" size={12} color={colors.terracotta} />}
                <Text style={styles.announcementAuthor}>{a.author?.name}</Text>
                <Text style={styles.announcementTime}>{formatRelativeTime(a.createdAt)}</Text>
              </View>
              <Text style={styles.announcementContent} numberOfLines={1}>{a.content}</Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.buttonGrid}>
        <Pressable onPress={() => router.push('/chores')} style={[styles.navCard, { backgroundColor: colors.sage }]}>
          <Ionicons name="list-outline" size={28} color="#fff" />
          <Text style={styles.navLabelLight}>Chores</Text>
          <Text style={styles.navSubtitle}>{myPendingCount} pending</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/expenses')} style={[styles.navCard, { backgroundColor: colors.terracotta }]}>
          <Ionicons name="cash-outline" size={28} color="#fff" />
          <Text style={styles.navLabelLight}>Expenses</Text>
          <Text style={styles.navSubtitle}>{myOwedAmount > 0 ? `You owe $${myOwedAmount.toFixed(2)}` : 'All settled'}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  content: { paddingHorizontal: 24, paddingBottom: 120 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  eyebrow: { fontSize: 12, fontWeight: '700', color: colors.ink, opacity: 0.5, letterSpacing: 1, marginBottom: 2 },
  title: { fontSize: 26, fontWeight: 'bold', color: colors.ink },
  overdueBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.terracottaTint, borderRadius: radius.md, padding: 14, marginBottom: 20,
  },
  overdueText: { color: colors.ink, fontSize: 14, fontWeight: '600', flex: 1 },
  nudgeBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.terracottaTint, borderRadius: radius.md, padding: 14, marginBottom: 12,
  },
  nudgeBannerText: { color: colors.ink, fontSize: 14, fontWeight: '600', flex: 1 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  statCard: { flex: 1, borderRadius: radius.lg, padding: 16 },
  statHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10 },
  statHeaderLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  statNumber: { fontSize: 30, fontWeight: '800', marginBottom: 4 },
  statLabel: { fontSize: 12, color: colors.ink, opacity: 0.7 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: colors.mist, ...shadow },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardSectionTitle: { fontSize: 17, fontWeight: '700', color: colors.ink },
  seeAllText: { color: colors.sage, fontWeight: '600', fontSize: 13 },
  emptyText: { color: colors.ink, opacity: 0.6, fontStyle: 'italic' },
  announcementItem: { paddingVertical: 10 },
  announcementDivider: { borderBottomWidth: 1, borderBottomColor: colors.mist },
  announcementTopRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  announcementAuthor: { fontWeight: '700', color: colors.ink, fontSize: 13 },
  announcementTime: { color: colors.ink, opacity: 0.5, fontSize: 12, marginLeft: 'auto' },
  announcementContent: { color: colors.ink, opacity: 0.8, fontSize: 13 },
  buttonGrid: { flexDirection: 'row', gap: 12 },
  navCard: { flex: 1, borderRadius: radius.lg, padding: 20, alignItems: 'center', ...shadow },
  navLabelLight: { fontSize: 16, fontWeight: '700', color: '#fff', marginTop: 8 },
  navSubtitle: { fontSize: 12, color: '#fff', opacity: 0.9, marginTop: 4 },
  error: { color: '#B5544A', marginBottom: 12, textAlign: 'center' },
});