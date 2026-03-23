import React, { useState, useCallback } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { getUserDetails } from '@/services/authStorage';
import api from '@/services/api';
import { copyToClipboard } from '@/services/crossClipboard';
import { crossAlert } from '@/services/crossAlert';
import { Toast } from 'react-native-toast-message/lib/src/Toast';

const CoachScreen = () => {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [myCoach, setMyCoach] = useState<any>(null);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [sentRequests, setSentRequests] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const session = await getUserDetails();

      if (session?.id) {
         const userRes = await api.get(`/users/me/${session.id}`);
         const userData = userRes.data;
         setUser(userData);

         if (userData.coach_id) {
             try {
                 const coachRes = await api.get(`/users/me/${userData.coach_id}`);
                 setMyCoach(coachRes.data);
             } catch (e) {
                 console.error("Could not fetch coach details", e);
             }
         } else {
             setMyCoach(null);
             try {
                 const invRes = await api.get(`/clients/me/invitations`);
                 setInvitations(invRes.data.invitations || []);

                 const sentRes = await api.get(`/clients/me/sent-requests?current_user_id=${session.id}`);
                 setSentRequests(sentRes.data || []);
             } catch (e) {
                 console.error("Could not fetch requests", e);
             }
         }
      }
    } catch (error) {
      console.error("Load error:", error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const handleCopyCode = async () => {
      if (user?.unique_code) {
          await copyToClipboard(user.unique_code);
            Toast.show({ type: 'success', text1: 'Code copied to clipboard!' });
      }
  };

  const handleChangeCoach = () => {
      crossAlert(
          "Leave Coach",
          "Do you really want to leave your coach?",
          [
              { text: "Cancel", style: "cancel" },
              {
                  text: "Leave",
                  style: "destructive",
                  onPress: async () => {
                      try {
                          await api.delete(`/users/me/coach`);
                          setMyCoach(null); 
                          loadData(); 
                      } catch (error) {
                          crossAlert("Error", "Failed to leave coach.");
                      }
                  }
              }
          ]
      );
  };

  const handleCancelRequest = (requestId: number) => {
    crossAlert(
      "Cancel Request",
      "Are you sure you want to cancel your request to this coach?",
      [
        { text: "No", style: "cancel" },
        { 
          text: "Yes, Cancel", 
          style: "destructive", 
          onPress: async () => {
            try {
              const session = await getUserDetails();
              await api.delete(`/clients/requests/${requestId}?current_user_id=${session?.id}`);
              Toast.show({ type: 'success', text1: 'Request cancelled' });
              loadData(); 
            } catch (error) {
              Toast.show({ type: 'error', text1: 'Error cancelling request' });
            }
          }
        }
      ]
    );
  };

  return (
    // 🔥 C'est ici qu'était le problème ! On a supprimé le paddingTop: insets.top
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color="#3498DB" style={{marginTop: 50}} />
      ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
            {myCoach ? (
                <>
                    <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Your Coach</Text>
                    <TouchableOpacity 
                        style={styles.activeCoachCard}
                        onPress={() => router.push({ pathname: "/clients/coach-public-profile", params: { coachId: myCoach.id }})}
                    >
                        <View style={styles.coachImagePlaceholder}>
                            <Text style={styles.avatarText}>{myCoach.firstname ? myCoach.firstname[0] : 'C'}</Text>
                        </View>
                        <View style={styles.coachInfo}>
                            <Text style={styles.coachName}>{myCoach.firstname} {myCoach.lastname}</Text>
                            <Text style={styles.coachCityText}>
                                <Ionicons name="location" size={12} color="#8A8D91" /> {myCoach.city || 'Remote'}
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={24} color="#8A8D91" />
                    </TouchableOpacity>

                    <View style={styles.actionRow}>
                        <TouchableOpacity style={styles.actionBtnPrimary} onPress={() => router.push({ pathname: "/chat/[id]", params: { id: myCoach.id, name: myCoach.firstname } })}>
                            <Ionicons name="chatbubble-ellipses" size={20} color="white" style={{marginRight: 8}} />
                            <Text style={styles.actionBtnText}>Chat</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionBtnAI} onPress={() => router.push('/chat/ai-coach')}>
                            <Ionicons name="sparkles" size={20} color="white" style={{marginRight: 8}} />
                            <Text style={styles.actionBtnText}>Coach IA</Text>
                        </TouchableOpacity>
                    </View>
                    
                    <TouchableOpacity style={styles.unassignButton} onPress={handleChangeCoach}>
                        <Ionicons name="exit-outline" size={18} color="#e74c3c" style={{marginRight: 8}} />
                        <Text style={styles.unassignText}>Unassign Coach</Text>
                    </TouchableOpacity>
                </>
            ) : (
                <View style={styles.noCoachContainer}>
                    
                    {/* --- INVITATIONS RECUES --- */}
                    {invitations.length > 0 && (
                        <View style={styles.listSection}>
                            <Text style={styles.listHeader}>Received Invitations ({invitations.length})</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 20, paddingBottom: 10 }}>
                                {invitations.map((inv) => (
                                    <TouchableOpacity key={inv.id} style={styles.cardHorizontal}
                                        onPress={() => router.push({ pathname: "/clients/coach-public-profile", params: { coachId: inv.coach_id, invitationId: inv.id }})}
                                    >
                                        <View style={styles.miniAvatar}><Text style={styles.miniAvatarText}>{inv.coach_firstname?.[0] || '?'}</Text></View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.cardText} numberOfLines={1}>
                                                <Text style={{ fontWeight: 'bold' }}>{inv.coach_firstname} {inv.coach_lastname}</Text>
                                            </Text>
                                            <Text style={styles.coachCityText}><Ionicons name="location" size={12} color="#8A8D91" /> {inv.coach_city || 'Remote'}</Text>
                                            <Text style={styles.viewProfileLink}>Tap to view & accept</Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={20} color="#3498DB" />
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    )}

                    {/* --- DEMANDES ENVOYÉES --- */}
                    {sentRequests.length > 0 && (
                        <View style={styles.listSection}>
                            <Text style={styles.listHeader}>Your Sent Requests ({sentRequests.length})</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 20, paddingBottom: 10 }}>
                                {sentRequests.map((req) => (
                                    <View key={req.id} style={[styles.cardHorizontal, { borderLeftColor: '#3498DB' }]}>
                                        <View style={styles.miniAvatar}><Text style={styles.miniAvatarText}>{req.coach_firstname?.[0] || '?'}</Text></View>
                                        <View style={{ flex: 1 }}>
                                            <TouchableOpacity onPress={() => router.push({ pathname: "/clients/coach-public-profile", params: { coachId: req.coach_id }})}>
                                                <Text style={styles.cardText} numberOfLines={1}><Text style={{ fontWeight: 'bold' }}>{req.coach_firstname} {req.coach_lastname}</Text></Text>
                                                <Text style={[styles.coachCityText, { color: '#f39c12' }]}>Status: Pending</Text>
                                            </TouchableOpacity>
                                        </View>
                                        <TouchableOpacity onPress={() => handleCancelRequest(req.id)} style={styles.cancelBtn}>
                                            <Ionicons name="close" size={20} color="#e74c3c" />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </ScrollView>
                        </View>
                    )}

                    {(invitations.length > 0 || sentRequests.length > 0) && <View style={styles.separator} />}

                    {/* --- FIND COACH / CODE UNIQUE --- */}
                    <TouchableOpacity style={styles.aiCoachBanner} onPress={() => router.push('/chat/ai-coach')}>
                        <View style={styles.aiCoachBannerIcon}>
                            <Ionicons name="sparkles" size={28} color="#F39C12" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.aiCoachBannerTitle}>AI Coach available</Text>
                            <Text style={styles.aiCoachBannerText}>Ask nutrition & fitness questions while you find your coach</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={24} color="#F39C12" />
                    </TouchableOpacity>

                    <Ionicons name="people-circle-outline" size={80} color="#3498DB" style={{marginBottom: 20}} />
                    <Text style={styles.noCoachTitle}>You don't have a coach yet</Text>
                    <Text style={styles.noCoachText}>Find a coach near you, or share your unique code with your current coach.</Text>

                    <TouchableOpacity style={styles.searchButton} onPress={() => router.push('/clients/search-coach')}>
                        <Ionicons name="search" size={24} color="white" style={{marginRight: 10}}/>
                        <Text style={styles.searchButtonText}>Find a Coach</Text>
                    </TouchableOpacity>

                    <View style={styles.codeCard}>
                        <Text style={styles.codeLabel}>YOUR UNIQUE CODE</Text>
                        <Text style={styles.codeValue}>{user?.unique_code || "Loading..."}</Text>
                    </View>

                    <TouchableOpacity style={styles.copyButton} onPress={handleCopyCode}>
                        <Ionicons name="copy-outline" size={20} color="white" style={{marginRight: 10}}/>
                        <Text style={styles.copyButtonText}>Copy to clipboard</Text>
                    </TouchableOpacity>
                </View>
            )}
          </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A1F2B' },
  sectionTitle: { color: 'white', fontSize: 18, fontWeight: 'bold', marginBottom: 15, paddingHorizontal: 16, textTransform: 'uppercase', letterSpacing: 1 },
  activeCoachCard: { backgroundColor: '#232D3F', borderRadius: 16, padding: 16, marginHorizontal: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#2A4562' },
  coachImagePlaceholder: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#3498DB', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: 'white', fontWeight: 'bold', fontSize: 22 },
  coachInfo: { flex: 1, marginLeft: 16 },
  coachName: { color: 'white', fontWeight: 'bold', fontSize: 18, marginBottom: 4 },
  
  actionRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 12, marginBottom: 30 },
  actionBtnPrimary: { flex: 1, backgroundColor: '#3498DB', paddingVertical: 14, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  actionBtnAI: { flex: 1, backgroundColor: '#F39C12', paddingVertical: 14, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  actionBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  
  unassignButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 15, marginHorizontal: 16, borderRadius: 12, backgroundColor: 'rgba(231, 76, 60, 0.1)' },
  unassignText: { color: '#e74c3c', fontWeight: 'bold', fontSize: 16 },

  noCoachContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  noCoachTitle: { color: 'white', fontSize: 24, fontWeight: 'bold', marginBottom: 10, textAlign: 'center', paddingHorizontal: 20 },
  noCoachText: { color: '#aaa', fontSize: 16, textAlign: 'center', marginBottom: 20, paddingHorizontal: 20 },
  
  searchButton: { flexDirection: 'row', backgroundColor: '#3498DB', paddingHorizontal: 25, paddingVertical: 15, borderRadius: 25, alignItems: 'center', marginBottom: 30, elevation: 5, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
  searchButtonText: { color: 'white', fontWeight: 'bold', fontSize: 18 },

  codeCard: { backgroundColor: '#2A4562', width: '90%', padding: 20, borderRadius: 15, alignItems: 'center', borderWidth: 1, borderColor: '#3498DB', marginBottom: 20 },
  codeLabel: { color: '#aaa', fontSize: 12, letterSpacing: 1, marginBottom: 5 },
  codeValue: { color: '#fff', fontSize: 32, fontWeight: 'bold', letterSpacing: 2 },
  copyButton: { flexDirection: 'row', backgroundColor: '#1E2C3D', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 25, alignItems: 'center', marginBottom: 30, borderWidth: 1, borderColor: '#3498DB' },
  copyButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  
  listSection: { width: '100%', marginBottom: 30, paddingLeft: 16 },
  listHeader: { color: '#8A8D91', fontSize: 14, fontWeight: 'bold', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 },
  cardHorizontal: { backgroundColor: '#232D3F', borderRadius: 16, padding: 15, borderLeftWidth: 4, borderLeftColor: '#f1c40f', flexDirection: 'row', alignItems: 'center', width: 280, marginRight: 15, elevation: 3 },
  miniAvatar: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#3498DB', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  miniAvatarText: { color: 'white', fontWeight: 'bold', fontSize: 20 },
  cardText: { color: 'white', fontSize: 14 },
  coachCityText: { color: '#8A8D91', fontSize: 12, marginTop: 2 },
  viewProfileLink: { color: '#f1c40f', fontSize: 12, marginTop: 4, fontWeight: 'bold' },
  cancelBtn: { padding: 8, backgroundColor: 'rgba(231, 76, 60, 0.2)', borderRadius: 20 },
  separator: { height: 1, backgroundColor: '#2A4562', width: '85%', alignSelf: 'center', marginBottom: 30 },

  aiCoachBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#232D3F', borderRadius: 16, padding: 16, width: '90%', marginBottom: 30, borderWidth: 1, borderColor: 'rgba(243, 156, 18, 0.3)' },
  aiCoachBannerIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(243, 156, 18, 0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  aiCoachBannerTitle: { color: '#F39C12', fontWeight: 'bold', fontSize: 16, marginBottom: 2 },
  aiCoachBannerText: { color: '#8A8D91', fontSize: 12 },
});

export default CoachScreen;