import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Modal, Pressable, TextInput, FlatList } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { getUserDetails } from '@/services/authStorage';
import api from '@/services/api';
import GroupedBarChart from '@/components/charts/GroupedBarChart';
import DonutChart from '@/components/charts/DonutChart';
import SimpleLineChart from '@/components/charts/SimpleLineChart';

const GOAL_CONFIG: Record<string, { label: string; color: string }> = {
  lose_weight: { label: 'Weight Loss', color: '#E74C3C' },
  gain_muscle: { label: 'Muscle Gain', color: '#2ECC71' },
  maintain_weight: { label: 'Maintain', color: '#F1C40F' },
  not_set: { label: 'Not Set', color: '#888' },
};

export default function CoachHomepage() {
  const insets = useSafeAreaInsets();
  const navigation = useRouter();
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [coachName, setCoachName] = useState('');
  const [coachId, setCoachId] = useState<number | null>(null);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [allClients, setAllClients] = useState<any[]>([]);

  // Workout detail modal
  const [showWorkoutModal, setShowWorkoutModal] = useState(false);

  // Activity modal
  const [showActivityModal, setShowActivityModal] = useState(false);

  const fetchData = async () => {
    try {
      const user = await getUserDetails();
      if (user?.id) {
        setCoachName(user.firstname);
        setCoachId(user.id);

        const [summaryRes, clientsRes] = await Promise.all([
          api.get(`/coaches/${user.id}/home-summary`),
          api.get(`/coaches/${user.id}/clients`),
        ]);

        setSummary(summaryRes.data);
        setAllClients(clientsRes.data);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, []);

  const filteredClients = searchQuery.trim()
    ? allClients.filter((c: any) =>
        `${c.firstname} ${c.lastname}`.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#3498DB" />
      </View>
    );
  }

  const kpi = summary?.kpi || {};

  // Chart data
  const weeklyActivityData = (summary?.weekly_activity || []).map((w: any) => ({
    label: w.week_start.slice(5),
    value1: w.total || 0,
    value2: w.completed || 0,
  }));

  const goalSegments = Object.entries(summary?.goal_distribution || {})
    .map(([key, value]) => ({
      label: GOAL_CONFIG[key]?.label || key,
      value: value as number,
      color: GOAL_CONFIG[key]?.color || '#888',
    }))
    .filter(s => s.value > 0);

  const satisfactionData = (summary?.avg_satisfaction_weekly || []).map((w: any) => ({
    label: w.week_start.slice(5),
    value: w.avg_rating,
  }));

  const leaderboard = summary?.leaderboard || [];

  const renderActivityCard = (a: any) => {
    const icon = a.type.startsWith('meal') ? 'restaurant-outline' :
                 a.type.startsWith('workout') ? 'barbell-outline' :
                 a.type.startsWith('profile') ? 'person-outline' : 'notifications-outline';
    const typeLabel = ({ meal_created: 'New Meal', meal_updated: 'Meal Updated', workout_updated: 'Workout Updated', profile_updated: 'Profile Updated' } as Record<string, string>)[a.type] || 'Update';
    const iconColor = a.type.startsWith('meal') ? '#2ecc71' :
                      a.type.startsWith('workout') ? '#3498DB' : '#9b59b6';
    return (
      <TouchableOpacity
        key={a.id}
        style={styles.activityCard}
        onPress={() => {
          setShowActivityModal(false);
          const p: any = { clientId: a.client_id, initialDate: a.date || '' };
          if (a.type?.startsWith('meal')) p.openMeal = 'true';
          navigation.push({ pathname: '/coachs/client-details' as any, params: p });
        }}
      >
        <View style={[styles.activityIcon, { backgroundColor: `${iconColor}20` }]}>
          <Ionicons name={icon as any} size={18} color={iconColor} />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.activityName}>{a.client_name}</Text>
          <Text style={styles.activityDetail}>{typeLabel}: {a.label}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.activityTime}>{getTimeAgo(a.timestamp)}</Text>
          {!a.is_read && <View style={styles.unreadDot} />}
        </View>
      </TouchableOpacity>
    );
  };

  const getTimeAgo = (timestamp: string) => {
    if (!timestamp) return '';
    const diff = Date.now() - new Date(timestamp).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <Text style={styles.greeting}>Hello, {coachName} 👋</Text>
        <Text style={styles.subtitle}>Your coaching dashboard</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
        showsVerticalScrollIndicator={false}
      >
        {/* Search bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color="#888" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search a client..."
            placeholderTextColor="#666"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#888" />
            </TouchableOpacity>
          )}
        </View>

        {/* Search results */}
        {searchQuery.trim().length > 0 && (
          <View style={styles.searchResults}>
            {filteredClients.length > 0 ? filteredClients.map((c: any) => (
              <TouchableOpacity
                key={c.id}
                style={styles.searchResultItem}
                onPress={() => {
                  setSearchQuery('');
                  navigation.push({ pathname: '/coachs/client-details', params: { clientId: c.id } });
                }}
              >
                <View style={styles.searchAvatar}>
                  <Text style={styles.searchAvatarText}>{c.firstname?.[0]?.toUpperCase() || '?'}</Text>
                </View>
                <Text style={styles.searchResultName}>{c.firstname} {c.lastname}</Text>
                <Ionicons name="chevron-forward" size={16} color="#666" />
              </TouchableOpacity>
            )) : (
              <Text style={{ color: '#666', textAlign: 'center', paddingVertical: 12 }}>No client found</Text>
            )}
          </View>
        )}

        {/* Notification badges */}
        {(summary?.unread_messages > 0 || summary?.pending_requests > 0) && (
          <View style={styles.notifRow}>
            {summary.unread_messages > 0 && (
              <TouchableOpacity style={styles.notifBadge} onPress={() => navigation.push('/coachs/message-list')}>
                <Ionicons name="chatbubbles" size={16} color="#e74c3c" />
                <Text style={styles.notifText}>{summary.unread_messages} unread message{summary.unread_messages > 1 ? 's' : ''}</Text>
                <Ionicons name="chevron-forward" size={14} color="#888" />
              </TouchableOpacity>
            )}
            {summary.pending_requests > 0 && (
              <TouchableOpacity style={styles.notifBadge} onPress={() => navigation.push('/coachs/client-list')}>
                <Ionicons name="person-add" size={16} color="#3498DB" />
                <Text style={styles.notifText}>{summary.pending_requests} pending request{summary.pending_requests > 1 ? 's' : ''}</Text>
                <Ionicons name="chevron-forward" size={14} color="#888" />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Recent Activity */}
        {(summary?.recent_activity || []).length > 0 && (
          <View style={styles.activitySection}>
            <Text style={styles.activityTitle}>Recent Activity</Text>
            {(summary.recent_activity as any[]).slice(0, 5).map((a: any) => renderActivityCard(a))}
            {(summary.recent_activity || []).length > 5 && (
              <TouchableOpacity style={styles.seeMoreBtn} onPress={() => setShowActivityModal(true)}>
                <Text style={styles.seeMoreText}>See all activity</Text>
                <Ionicons name="chevron-forward" size={14} color="#3498DB" />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* KPI Cards */}
        <View style={styles.kpiRow}>
          <TouchableOpacity style={styles.kpiCard} activeOpacity={0.7} onPress={() => navigation.push('/coachs/client-list')}>
            <View style={styles.kpiIcon}>
              <Ionicons name="people" size={20} color="#3498DB" />
            </View>
            <Text style={styles.kpiValue}>{kpi.total_clients || 0}</Text>
            <Text style={styles.kpiLabel}>Clients</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.kpiCard} activeOpacity={0.7} onPress={() => setShowWorkoutModal(true)}>
            <View style={[styles.kpiIcon, { backgroundColor: 'rgba(46,204,113,0.15)' }]}>
              <Ionicons name="barbell" size={20} color="#2ecc71" />
            </View>
            <Text style={styles.kpiValue}>{kpi.week_workouts_completed || 0}<Text style={styles.kpiTotal}>/{kpi.week_workouts_total || 0}</Text></Text>
            <Text style={styles.kpiLabel}>This Week</Text>
          </TouchableOpacity>

          <View style={styles.kpiCard}>
            <View style={[styles.kpiIcon, { backgroundColor: 'rgba(243,156,18,0.15)' }]}>
              <Ionicons name="star" size={20} color="#f39c12" />
            </View>
            <Text style={styles.kpiValue}>{kpi.avg_rating?.toFixed(1) || '-'}</Text>
            <Text style={styles.kpiLabel}>Avg Rating</Text>
          </View>

          <View style={styles.kpiCard}>
            <View style={[styles.kpiIcon, { backgroundColor: 'rgba(155,89,182,0.15)' }]}>
              <Ionicons name="checkmark-done" size={20} color="#9b59b6" />
            </View>
            <Text style={styles.kpiValue}>{kpi.avg_completion != null ? `${kpi.avg_completion}%` : '-'}</Text>
            <Text style={styles.kpiLabel}>Completion</Text>
          </View>
        </View>

        {/* Weekly Activity */}
        {weeklyActivityData.length > 0 && (
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Weekly Activity (All Clients)</Text>
            <GroupedBarChart data={weeklyActivityData} color1="#3498DB" color2="#2ecc71" label1="Planned" label2="Completed" />
          </View>
        )}

        {/* Goal Distribution + Satisfaction side by side or stacked */}
        {goalSegments.length > 0 && (
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Client Goals</Text>
            <DonutChart segments={goalSegments} />
          </View>
        )}

        {satisfactionData.length > 0 && (
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Average Satisfaction</Text>
            <SimpleLineChart data={satisfactionData} color="#f39c12" suffix="" />
          </View>
        )}

        {/* Leaderboard */}
        {leaderboard.length > 0 && (
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Client Leaderboard</Text>
            {leaderboard.map((c: any, i: number) => (
              <TouchableOpacity
                key={c.id}
                style={styles.leaderRow}
                onPress={() => navigation.push({ pathname: '/coachs/client-details', params: { clientId: c.id } })}
              >
                <View style={[styles.rankBadge, i === 0 && { backgroundColor: 'rgba(241,196,15,0.2)' }, i === 1 && { backgroundColor: 'rgba(189,195,199,0.2)' }, i === 2 && { backgroundColor: 'rgba(205,127,50,0.2)' }]}>
                  <Text style={[styles.rankText, i === 0 && { color: '#f1c40f' }, i === 1 && { color: '#bdc3c7' }, i === 2 && { color: '#cd7f32' }]}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.leaderName}>{c.name}</Text>
                  <Text style={styles.leaderMeta}>{c.completed}/{c.total} workouts · {c.completion}%</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.leaderFreq}>{c.sessions_per_week}</Text>
                  <Text style={styles.leaderFreqLabel}>sess/wk</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Workout Detail Modal */}
      <Modal visible={showWorkoutModal} transparent animationType="slide" onRequestClose={() => setShowWorkoutModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowWorkoutModal(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>This Week's Workouts</Text>
              <TouchableOpacity onPress={() => setShowWorkoutModal(false)}>
                <Ionicons name="close" size={24} color="#888" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalSummary}>
              <Text style={styles.modalSummaryText}>
                {kpi.week_workouts_completed || 0} completed out of {kpi.week_workouts_total || 0} planned
              </Text>
            </View>

            <FlatList
              data={summary?.clients_week_workouts || []}
              keyExtractor={(item) => item.id.toString()}
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: 400 }}
              renderItem={({ item }) => {
                const pct = item.total > 0 ? Math.round(item.completed / item.total * 100) : 0;
                const barColor = pct === 100 ? '#2ecc71' : pct > 0 ? '#f39c12' : '#e74c3c';
                return (
                  <TouchableOpacity
                    style={styles.clientWorkoutRow}
                    onPress={() => {
                      setShowWorkoutModal(false);
                      navigation.push({ pathname: '/coachs/client-details', params: { clientId: item.id } });
                    }}
                  >
                    <View style={styles.clientWorkoutAvatar}>
                      <Text style={styles.clientWorkoutAvatarText}>{item.name?.[0]?.toUpperCase() || '?'}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.clientWorkoutName}>{item.name}</Text>
                      <View style={styles.progressBarBg}>
                        <View style={[styles.progressBarFill, { width: `${pct}%`, backgroundColor: barColor }]} />
                      </View>
                    </View>
                    <Text style={[styles.clientWorkoutCount, { color: barColor }]}>{item.completed}/{item.total}</Text>
                    <Ionicons name="chevron-forward" size={16} color="#555" style={{ marginLeft: 8 }} />
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text style={{ color: '#666', textAlign: 'center', paddingVertical: 20 }}>No workouts scheduled this week</Text>
              }
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Activity Modal */}
      <Modal visible={showActivityModal} transparent animationType="slide" onRequestClose={() => setShowActivityModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowActivityModal(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>All Activity</Text>
              <TouchableOpacity onPress={() => setShowActivityModal(false)}>
                <Ionicons name="close" size={24} color="#888" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 500 }} showsVerticalScrollIndicator={false}>
              {(summary?.recent_activity || []).map((a: any) => renderActivityCard(a))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A1F2B' },
  header: { paddingHorizontal: 20, marginBottom: 10, marginTop: 15 },
  greeting: { color: 'white', fontSize: 24, fontWeight: 'bold' },
  subtitle: { color: '#888', fontSize: 14, marginTop: 5 },
  content: { padding: 16 },

  // Search
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#232D3F', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12, gap: 10 },
  searchInput: { flex: 1, color: 'white', fontSize: 15 },
  searchResults: { backgroundColor: '#232D3F', borderRadius: 12, marginBottom: 12, overflow: 'hidden' },
  searchResultItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  searchAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#3498DB', justifyContent: 'center', alignItems: 'center' },
  searchAvatarText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
  searchResultName: { flex: 1, color: 'white', fontSize: 15, marginLeft: 12 },

  // Notifications
  notifRow: { gap: 8, marginBottom: 14 },
  notifBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#232D3F', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  notifText: { flex: 1, color: '#ccc', fontSize: 13 },

  // KPI
  kpiRow: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  kpiCard: { width: '48%', backgroundColor: '#232D3F', borderRadius: 14, padding: 14, alignItems: 'center', marginBottom: 8 },
  kpiIcon: { backgroundColor: 'rgba(52,152,219,0.15)', padding: 8, borderRadius: 10, marginBottom: 8 },
  kpiValue: { color: 'white', fontSize: 26, fontWeight: 'bold' },
  kpiTotal: { color: '#888', fontSize: 16, fontWeight: 'normal' },
  kpiLabel: { color: '#888', fontSize: 11, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Activity feed
  activitySection: { marginBottom: 16 },
  activityTitle: { color: 'white', fontSize: 16, fontWeight: 'bold', marginBottom: 10 },
  activityCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#232D3F', borderRadius: 12, padding: 12, marginBottom: 8 },
  activityIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  activityName: { color: 'white', fontWeight: '600', fontSize: 13 },
  activityDetail: { color: '#888', fontSize: 12, marginTop: 2 },
  activityTime: { color: '#555', fontSize: 11 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#e74c3c', marginTop: 4 },
  seeMoreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10, marginTop: 4 },
  seeMoreText: { color: '#3498DB', fontSize: 13, fontWeight: '600' },

  // Charts
  chartCard: { backgroundColor: '#232D3F', borderRadius: 14, padding: 16, marginBottom: 14 },
  chartTitle: { color: 'white', fontSize: 15, fontWeight: 'bold', marginBottom: 14 },

  // Leaderboard
  leaderRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  rankBadge: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' },
  rankText: { color: '#888', fontWeight: 'bold', fontSize: 14 },
  leaderName: { color: 'white', fontWeight: '600', fontSize: 14 },
  leaderMeta: { color: '#666', fontSize: 11, marginTop: 2 },
  leaderFreq: { color: '#2ecc71', fontWeight: 'bold', fontSize: 18 },
  leaderFreqLabel: { color: '#888', fontSize: 9, textTransform: 'uppercase' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#1A1F2B', width: '100%', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#2A4562', maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  modalSummary: { backgroundColor: '#2A4562', borderRadius: 10, padding: 12, marginBottom: 16, alignItems: 'center' },
  modalSummaryText: { color: '#3498DB', fontWeight: '600', fontSize: 14 },

  clientWorkoutRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  clientWorkoutAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#3498DB', justifyContent: 'center', alignItems: 'center' },
  clientWorkoutAvatarText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
  clientWorkoutName: { color: 'white', fontSize: 14, fontWeight: '500', marginBottom: 6 },
  clientWorkoutCount: { fontWeight: 'bold', fontSize: 16 },

  progressBarBg: { height: 5, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 3 },
});
