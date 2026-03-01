import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import axios from 'axios';
import Constants from 'expo-constants';
// 🔥 N'oublie pas d'importer getToken
import { getUserDetails, getToken } from '@/services/authStorage'; 

export default function CoachHomepage() {
  const insets = useSafeAreaInsets();
  const navigation = useRouter();
  const API_URL = Constants.expoConfig?.extra?.API_URL ?? '';

  const [summary, setSummary] = useState<any>(null);
  const [attentionData, setAttentionData] = useState<any>(null); // 🔥 Nouvel état pour les alertes
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [coachName, setCoachName] = useState('');

  const fetchData = async () => {
    try {
      const user = await getUserDetails();
      const token = await getToken();
      
      if (user?.id && token) {
        setCoachName(user.firstname);
        
        // 🔥 On charge le résumé ET les alertes en même temps (Promise.all est super rapide)
        const [summaryResponse, attentionResponse] = await Promise.all([
            axios.get(`${API_URL}/coaches/${user.id}/home-summary`),
            axios.get(`${API_URL}/coaches/me/needs-attention?current_user_id=${user.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            })
        ]);

        setSummary(summaryResponse.data);
        setAttentionData(attentionResponse.data);
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

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#3498DB" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />
      
      <View style={styles.header}>
          <Text style={styles.greeting}>Hello, {coachName} 👋</Text>
          <Text style={styles.subtitle}>Here is your daily overview</Text>
      </View>

      <ScrollView 
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
        showsVerticalScrollIndicator={false}
      >
        
        {/* --- KPIs SECTION --- */}
        <View style={styles.kpiContainer}>
            <View style={styles.kpiCard}>
                <View style={styles.iconBg}>
                    <Ionicons name="people" size={24} color="#3498DB" />
                </View>
                <Text style={styles.kpiValue}>{summary?.kpi?.total_clients || 0}</Text>
                <Text style={styles.kpiLabel}>Total Clients</Text>
            </View>

            <View style={styles.kpiCard}>
                <View style={[styles.iconBg, {backgroundColor: 'rgba(46, 204, 113, 0.2)'}]}>
                    <Ionicons name="flash" size={24} color="#2ecc71" />
                </View>
                <Text style={styles.kpiValue}>{summary?.kpi?.active_today || 0}</Text>
                <Text style={styles.kpiLabel}>Active Today</Text>
            </View>
        </View>

        {/* --- ALERTS SECTION (DYNAMIQUE) --- */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>⚠️ Needs Attention</Text>
          
          {attentionData && attentionData.total_alerts > 0 ? (
              <>
                  {/* Carte : Invitations en attente */}
                  {attentionData.pending_invitations > 0 && (
                      <TouchableOpacity 
                          style={[styles.alertCard, { borderLeftColor: '#f39c12' }]}
                          onPress={() => navigation.push('/coachs/client-list')}
                      >
                          <View style={styles.cardHeader}>
                              <View style={[styles.avatarPlaceholder, { backgroundColor: 'rgba(243, 156, 18, 0.2)' }]}>
                                  <Ionicons name="people-outline" size={24} color="#f39c12" />
                              </View>
                              <View style={{flex: 1, marginLeft: 15}}>
                                  <Text style={styles.clientName}>Pending Invitations</Text>
                                  <Text style={[styles.alertIssue, { color: '#f39c12' }]}>
                                      {attentionData.pending_invitations} client(s) waiting for approval
                                  </Text>
                              </View>
                              <Ionicons name="chevron-forward" size={20} color="#8A8D91" />
                          </View>
                      </TouchableOpacity>
                  )}

                  {/* Carte : Messages non lus */}
                  {attentionData.unread_messages > 0 && (
                      <TouchableOpacity 
                          style={[styles.alertCard, { borderLeftColor: '#e74c3c' }]}
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
                  <Text style={styles.emptyText}>You're all caught up! Great job.</Text>
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

        <View style={{height: 20}} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1F2B',
  },
  header: {
      paddingHorizontal: 20,
      paddingBottom: 10,
      marginBottom: 10
  },
  greeting: {
      color: 'white',
      fontSize: 24,
      fontWeight: 'bold'
  },
  subtitle: {
      color: '#888',
      fontSize: 14,
      marginTop: 5
  },
  content: {
    padding: 16,
  },
  // KPIs
  kpiContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 25
  },
  kpiCard: {
      backgroundColor: '#2A4562',
      width: '48%',
      padding: 15,
      borderRadius: 15,
      alignItems: 'flex-start'
  },
  iconBg: {
      backgroundColor: 'rgba(52, 152, 219, 0.2)',
      padding: 8,
      borderRadius: 10,
      marginBottom: 10
  },
  kpiValue: {
      color: 'white',
      fontSize: 32,
      fontWeight: 'bold'
  },
  kpiLabel: {
      color: '#aaa',
      fontSize: 14
  },
  // Sections
  sectionContainer: {
    marginBottom: 25,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  // Alerts
  alertCard: {
    backgroundColor: '#3b2a2a', // Teinte qui est écrasée par le style inline pour matcher l'alerte
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    borderLeftWidth: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarPlaceholder: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: '#2A4562',
    justifyContent: 'center',
    alignItems: 'center'
  },
  avatarText: {
      color: 'white',
      fontWeight: 'bold',
      fontSize: 18
  },
  clientName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  alertIssue: {
    color: '#e74c3c', // Rouge par défaut
    fontWeight: 'bold',
    fontSize: 12,
    marginTop: 4
  },
  // Empty State
  emptyState: {
      backgroundColor: '#2A4562',
      borderRadius: 12,
      padding: 20,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row'
  },
  emptyText: {
      color: 'white',
      marginLeft: 10,
      fontSize: 16
  },
  // Performers
  performerCard: {
    backgroundColor: '#2A4562',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#f1c40f' 
  },
  badgeContainer: {
      backgroundColor: 'rgba(46, 204, 113, 0.2)',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 5,
      alignSelf: 'flex-start',
      marginTop: 4
  },
  badgeText: {
      color: '#2ecc71',
      fontSize: 12,
      fontWeight: 'bold'
  },
  performerValue: {
      color: 'white',
      fontWeight: 'bold',
      fontSize: 16
  },
  performerGoal: {
      color: '#aaa',
      fontSize: 12
  }
});