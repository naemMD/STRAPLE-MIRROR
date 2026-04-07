import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Modal, Dimensions, Pressable } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { getUserDetails } from '@/services/authStorage';
import api from '@/services/api';
import Toast from 'react-native-toast-message';

export default function CoachHomepage() {
  const insets = useSafeAreaInsets();
  const navigation = useRouter();
  const [summary, setSummary] = useState<any>(null);
  const [attentionData, setAttentionData] = useState<any>(null);
  const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [coachName, setCoachName] = useState('');

  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);

  // --- 🔥 CONFIGURATION DES OBJECTIFS (Traductions, Icônes & Couleurs) ---
  const goalConfig: { [key: string]: { label: string; color: string } } = {
    'lose_weight': { label: 'Weight Loss', color: '#E74C3C' },
    'gain_muscle': { label: 'Muscle Gain', color: '#2ECC71' },
    'maintain_weight': { label: 'Maintain', color: '#F1C40F' }
  };

  const fetchData = async () => {
    try {
      const user = await getUserDetails();

      if (user?.id) {
        setCoachName(user.firstname);

        const [summaryResponse, attentionResponse, requestsResponse] = await Promise.all([
            api.get(`/coaches/${user.id}/home-summary`),
            api.get(`/coaches/me/needs-attention?current_user_id=${user.id}`),
            api.get(`/coaches/me/pending-requests?current_user_id=${user.id}`)
        ]);

        setSummary(summaryResponse.data);
        setAttentionData(attentionResponse.data);
        setIncomingRequests(requestsResponse.data);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, []);

  const handleRequestAction = async (requestId: number, status: 'accepted' | 'rejected') => {
    try {
      const user = await getUserDetails();

      await api.patch(`/coaches/requests/${requestId}?status=${status}&current_user_id=${user?.id}`);

      Toast.show({
        type: 'success',
        text1: status === 'accepted' ? 'Client Assigned' : 'Request Declined',
        text2: status === 'accepted' ? 'New client added to your roster.' : 'The request has been removed.'
      });

      setIsModalVisible(false);
      fetchData(); 
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Error updating request' });
    }
  };

    const currentClientGoal = goalConfig[selectedRequest?.client_goal] || {
        label: 'Not specified',
        color: '#8A8D91' 
    };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#3498DB" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      <View style={styles.header}>
          <Text style={styles.greeting}>Hello, {coachName} 👋</Text>
          <Text style={styles.subtitle}>Here is your daily overview</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
        showsVerticalScrollIndicator={false}
      >
        
        {/* --- KPIs SECTION --- */}
        <View style={styles.kpiContainer}>
            {/* KPI: TOTAL CLIENTS (CLIQUABLE) */}
            <TouchableOpacity 
              style={styles.kpiCard} 
              activeOpacity={0.7}
              onPress={() => navigation.push('/coachs/client-list')}
            >
                <View style={styles.iconBg}>
                    <Ionicons name="people" size={24} color="#3498DB" />
                </View>
                <Text style={styles.kpiValue}>{summary?.kpi?.total_clients || 0}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.kpiLabel}>Total Clients</Text>
                  <Ionicons name="chevron-forward" size={12} color="#aaa" style={{ marginLeft: 4 }} />
                </View>
            </TouchableOpacity>

            {/* KPI: ACTIVE TODAY */}
            <View style={styles.kpiCard}>
                <View style={[styles.iconBg, {backgroundColor: 'rgba(46, 204, 113, 0.2)'}]}>
                    <Ionicons name="flash" size={24} color="#2ecc71" />
                </View>
                <Text style={styles.kpiValue}>{summary?.kpi?.active_today || 0}</Text>
                <Text style={styles.kpiLabel}>Active Today</Text>
            </View>
        </View>

        {/* --- ALERTS SECTION --- */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>⚠️ Needs Attention</Text>
          
          {(attentionData && attentionData.total_alerts > 0) || incomingRequests.length > 0 ? (
              <>
                  {incomingRequests.length > 0 && (
                      <TouchableOpacity 
                          style={[styles.alertCard, { borderLeftColor: '#3498DB', backgroundColor: 'rgba(52, 152, 219, 0.1)' }]}
                          onPress={() => {
                              setSelectedRequest(incomingRequests[0]);
                              setIsModalVisible(true);
                          }}
                      >
                          <View style={styles.cardHeader}>
                              <View style={[styles.avatarPlaceholder, { backgroundColor: 'rgba(52, 152, 219, 0.2)' }]}>
                                  <Ionicons name="person-add" size={24} color="#3498DB" />
                              </View>
                              <View style={{flex: 1, marginLeft: 15}}>
                                  <Text style={styles.clientName}>Coaching Request</Text>
                                  <Text style={[styles.alertIssue, { color: '#3498DB' }]}>
                                      {incomingRequests.length} user(s) want to be your client
                                  </Text>
                              </View>
                              <View style={styles.viewBadge}>
                                  <Text style={styles.viewBadgeText}>VIEW</Text>
                              </View>
                          </View>
                      </TouchableOpacity>
                  )}

                  {attentionData?.unread_messages > 0 && (
                      <TouchableOpacity 
                          style={[styles.alertCard, { borderLeftColor: '#e74c3c', backgroundColor: 'rgba(231, 76, 60, 0.1)' }]}
                          onPress={() => navigation.push('/coachs/message-list')}
                      >
                          <View style={styles.cardHeader}>
                              <View style={[styles.avatarPlaceholder, { backgroundColor: 'rgba(231, 76, 60, 0.2)' }]}>
                                  <Ionicons name="chatbubbles-outline" size={24} color="#e74c3c" />
                              </View>
                              <View style={{flex: 1, marginLeft: 15}}>
                                  <Text style={styles.clientName}>Unread Messages</Text>
                                  <Text style={styles.alertIssue}>
                                      {attentionData.unread_messages} new message(s) received
                                  </Text>
                              </View>
                              <Ionicons name="chevron-forward" size={20} color="#8A8D91" />
                          </View>
                      </TouchableOpacity>
                  )}
              </>
          ) : (
              <View style={styles.emptyState}>
                  <Ionicons name="checkmark-circle" size={40} color="#2ecc71" />
                  <Text style={styles.emptyText}>You're all caught up!</Text>
              </View>
          )}
        </View>

        {/* --- TOP PERFORMERS SECTION --- */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>🏆 Top Performers (Yesterday)</Text>
          {summary?.top_performers && summary.top_performers.length > 0 ? (
              summary.top_performers.map((client: any, index: number) => (
                <View key={client.id} style={styles.performerCard}>
                    <View style={styles.cardHeader}>
                        <View style={[styles.avatarPlaceholder, {backgroundColor: '#f1c40f'}]}>
                            <Text style={[styles.avatarText, {color: '#1A1F2B'}]}>{index + 1}</Text>
                        </View>
                        <View style={{flex: 1, marginLeft: 10}}>
                            <Text style={styles.clientName}>{client.name}</Text>
                            <View style={styles.badgeContainer}>
                                <Text style={styles.badgeText}>{client.score}</Text>
                            </View>
                        </View>
                        <View style={{alignItems: 'flex-end'}}>
                             <Text style={styles.performerValue}>{client.value} kcal</Text>
                             <Text style={styles.performerGoal}>Goal: {client.goal}</Text>
                        </View>
                    </View>
                </View>
              ))
          ) : (
              <Text style={{color: '#888', fontStyle: 'italic'}}>No data recorded yesterday.</Text>
          )}
        </View>
      </ScrollView>

      {/* --- CLIENT PROFILE PREVIEW MODAL --- */}
      <Modal visible={isModalVisible} animationType="slide" transparent onRequestClose={() => setIsModalVisible(false)}>
          <Pressable style={styles.modalOverlay} onPress={() => setIsModalVisible(false)}>
              <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
                  {selectedRequest && (
                      <>
                          <View style={styles.modalHeaderInfo}>
                              <View style={styles.avatarLarge}>
                                  <Text style={styles.avatarLargeText}>{selectedRequest.client_name[0]}</Text>
                              </View>
                              <Text style={styles.modalName}>{selectedRequest.client_name}</Text>
                              <Text style={styles.modalEmail}>{selectedRequest.client_email}</Text>
                              
                              <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 8}}>
                                  <Ionicons name="location-outline" size={14} color="#8A8D91" />
                                  <Text style={{color: '#8A8D91', marginLeft: 4}}>
                                      {selectedRequest.client_city || "City not specified"}
                                  </Text>
                              </View>
                          </View>

                          <View style={styles.metricsGrid}>
                              <View style={styles.metricRow}>
                                  <View style={styles.metricItem}>
                                      <Text style={[styles.metricVal, { color: currentClientGoal.color }]}>
                                          {currentClientGoal.label}
                                      </Text>
                                      <Text style={styles.metricLab}>Goal</Text>
                                  </View>

                                  <View style={styles.metricItem}>
                                      <Ionicons name="calendar-outline" size={22} color="#3498DB" />
                                      <Text style={styles.metricVal}>{selectedRequest.client_age || '--'} y/o</Text>
                                      <Text style={styles.metricLab}>Age</Text>
                                  </View>
                              </View>

                              <View style={styles.divider} />

                              <View style={styles.metricRow}>
                                  <View style={styles.metricItem}>
                                      <Ionicons name="speedometer-outline" size={22} color="#3498DB" />
                                      <Text style={styles.metricVal}>{selectedRequest.client_weight || '--'} kg</Text>
                                      <Text style={styles.metricLab}>Weight</Text>
                                  </View>
                                  <View style={styles.metricItem}>
                                      <Ionicons name="resize-outline" size={22} color="#3498DB" />
                                      <Text style={styles.metricVal}>{selectedRequest.client_height || '--'} cm</Text>
                                      <Text style={styles.metricLab}>Height</Text>
                                  </View>
                              </View>
                          </View>

                          <View style={styles.modalActions}>
                              <TouchableOpacity 
                                  style={[styles.modalBtn, styles.declineBtn]} 
                                  onPress={() => handleRequestAction(selectedRequest.request_id, 'rejected')}
                              >
                                  <Text style={styles.declineText}>Decline</Text>
                              </TouchableOpacity>
                              <TouchableOpacity 
                                  style={[styles.modalBtn, styles.acceptBtn]} 
                                  onPress={() => handleRequestAction(selectedRequest.request_id, 'accepted')}
                              >
                                  <Text style={styles.acceptText}>Accept Client</Text>
                              </TouchableOpacity>
                          </View>
                          
                          <TouchableOpacity style={styles.closeModal} onPress={() => setIsModalVisible(false)}>
                              <Text style={{color: '#8A8D91', fontWeight: 'bold'}}>Close</Text>
                          </TouchableOpacity>
                      </>
                  )}
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
  kpiContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25 },
  kpiCard: { backgroundColor: '#2A4562', width: '48%', padding: 15, borderRadius: 15, alignItems: 'flex-start' },
  iconBg: { backgroundColor: 'rgba(52, 152, 219, 0.2)', padding: 8, borderRadius: 10, marginBottom: 10 },
  kpiValue: { color: 'white', fontSize: 32, fontWeight: 'bold' },
  kpiLabel: { color: '#aaa', fontSize: 14 },
  sectionContainer: { marginBottom: 25 },
  sectionTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  alertCard: { borderRadius: 12, padding: 15, marginBottom: 12, borderLeftWidth: 4 },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  avatarPlaceholder: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#2A4562', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: 'white', fontWeight: 'bold', fontSize: 18 },
  clientName: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  alertIssue: { fontWeight: 'bold', fontSize: 12, marginTop: 4 },
  viewBadge: { backgroundColor: '#3498DB', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  viewBadgeText: { color: 'white', fontWeight: 'bold', fontSize: 10 },
  emptyState: { backgroundColor: '#2A4562', borderRadius: 12, padding: 20, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  emptyText: { color: 'white', marginLeft: 10, fontSize: 16 },
  performerCard: { backgroundColor: '#2A4562', borderRadius: 12, padding: 15, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: '#f1c40f' },
  badgeContainer: { backgroundColor: 'rgba(46, 204, 113, 0.2)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 5, alignSelf: 'flex-start', marginTop: 4 },
  badgeText: { color: '#2ecc71', fontSize: 12, fontWeight: 'bold' },
  performerValue: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  performerGoal: { color: '#aaa', fontSize: 12 },

  // MODAL STYLES
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#1A1F2B', width: '100%', borderRadius: 25, padding: 25, alignItems: 'center', borderWidth: 1, borderColor: '#3498DB' },
  modalHeaderInfo: { alignItems: 'center', marginBottom: 25 },
  avatarLarge: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#3498DB', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  avatarLargeText: { color: 'white', fontSize: 36, fontWeight: 'bold' },
  modalName: { color: 'white', fontSize: 24, fontWeight: 'bold' },
  modalEmail: { color: '#8A8D91', marginTop: 4 },
  
  metricsGrid: { width: '100%', marginBottom: 35, backgroundColor: '#2A4562', padding: 20, borderRadius: 20 },
  metricRow: { flexDirection: 'row', justifyContent: 'space-around', width: '100%' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginVertical: 15, width: '100%' },
  metricItem: { alignItems: 'center', flex: 1 },
  iconGoalCircle: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  metricVal: { color: 'white', fontWeight: 'bold', marginTop: 8, fontSize: 14, textAlign: 'center' },
  metricLab: { color: '#8A8D91', fontSize: 10, textTransform: 'uppercase', marginTop: 2 },
  
  modalActions: { flexDirection: 'row', gap: 15, width: '100%' },
  modalBtn: { flex: 1, paddingVertical: 16, borderRadius: 15, alignItems: 'center' },
  declineBtn: { backgroundColor: 'rgba(231, 76, 60, 0.1)', borderWidth: 1, borderColor: '#e74c3c' },
  acceptBtn: { backgroundColor: '#2ECC71' },
  declineText: { color: '#e74c3c', fontWeight: 'bold', fontSize: 16 },
  acceptText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  closeModal: { marginTop: 25 }
});