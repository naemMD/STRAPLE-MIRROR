import React, { useState, useCallback } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import axios from 'axios';
import Constants from 'expo-constants';
import { getUserDetails, getToken } from '@/services/authStorage';
import * as Clipboard from 'expo-clipboard';
import { Toast } from 'react-native-toast-message/lib/src/Toast';

const CoachScreen = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const API_URL = Constants.expoConfig?.extra?.API_URL ?? '';

  const [user, setUser] = useState<any>(null);
  const [myCoach, setMyCoach] = useState<any>(null);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const session = await getUserDetails();
      const token = await getToken();
      
      if (session?.id && token) {
         const userRes = await axios.get(`${API_URL}/users/me/${session.id}`);
         const userData = userRes.data;
         setUser(userData);

         if (userData.coach_id) {
             try {
                 const coachRes = await axios.get(`${API_URL}/users/me/${userData.coach_id}`);
                 setMyCoach(coachRes.data);
             } catch (e) {
                 console.error("Could not fetch coach details", e);
             }
         } else {
             setMyCoach(null);
             try {
                 const invRes = await axios.get(`${API_URL}/clients/me/invitations`, {
                     headers: { Authorization: `Bearer ${token}` }
                 });
                 setInvitations(invRes.data.invitations || []);
             } catch (e) {
                 console.error("Could not fetch invitations", e);
             }
         }
      }
    } catch (error) {
      console.error("Erreur chargement:", error);
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
          await Clipboard.setStringAsync(user.unique_code);
            Toast.show({
                type: 'success',
                text1: 'Code copied to clipboard!'
            });
      }
  };

  const handleChangeCoach = () => {
      Alert.alert(
          "Leave Coach",
          "Do you really want to leave your coach?",
          [
              { text: "Cancel", style: "cancel" },
              {
                  text: "Leave",
                  style: "destructive",
                  onPress: async () => {
                      try {
                          const token = await getToken();
                          if (!token) return;

                          await axios.delete(`${API_URL}/users/me/coach`, {
                              headers: { Authorization: `Bearer ${token}` }
                          });
                          
                          setMyCoach(null); 
                          loadData(); 
                      } catch (error: any) {
                          console.error("Error leaving coach:", error);
                          Alert.alert("Error", "Failed to leave coach.");
                      }
                  }
              }
          ]
      );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      
      {loading ? (
        <ActivityIndicator size="large" color="#3498DB" style={{marginTop: 50}} />
      ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
            {myCoach ? (
                <>
                    {/* --- NOUVEAU DESIGN : COACH ACTIF --- */}
                    <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Your Coach</Text>
                    
                    {/* Carte cliquable */}
                    <TouchableOpacity 
                        style={styles.activeCoachCard}
                        activeOpacity={0.8}
                        onPress={() => router.push({
                            pathname: "/clients/coach-public-profile",
                            params: { coachId: myCoach.id }
                        })}
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

                    {/* Boutons d'action modernes (côte à côte) */}
                    <View style={styles.actionRow}>
                        
                        {/* 🔥 C'EST ICI QU'ON A RAJOUTÉ LA REDIRECTION VERS LE CHAT 🔥 */}
                        <TouchableOpacity 
                            style={styles.actionBtnPrimary}
                            onPress={() => router.push({
                                pathname: "/chat/[id]", 
                                params: { id: myCoach.id, name: myCoach.firstname }
                            })}
                        >
                            <Ionicons name="chatbubble-ellipses" size={20} color="white" style={{marginRight: 8}} />
                            <Text style={styles.actionBtnText}>Chat</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.actionBtnAI}>
                            <Ionicons name="hardware-chip" size={20} color="white" style={{marginRight: 8}} />
                            <Text style={styles.actionBtnText}>AI Coach</Text>
                        </TouchableOpacity>
                    </View>
                    
                    {/* Bouton Quitter (Discret et Rouge) */}
                    <TouchableOpacity style={styles.unassignButton} onPress={handleChangeCoach}>
                        <Ionicons name="exit-outline" size={18} color="#e74c3c" style={{marginRight: 8}} />
                        <Text style={styles.unassignText}>Unassign Coach</Text>
                    </TouchableOpacity>
                </>
            ) : (
                <View style={styles.noCoachContainer}>
                    {/* --- CARROUSEL DES INVITATIONS --- */}
                    {invitations.length > 0 && (
                        <View style={styles.invitationsSection}>
                            <Text style={styles.invitationsHeader}>Pending Requests ({invitations.length})</Text>
                            <ScrollView 
                                horizontal 
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={{ paddingRight: 20, paddingBottom: 10 }}
                            >
                                {invitations.map((inv) => (
                                    <TouchableOpacity 
                                        key={inv.id} 
                                        style={styles.invitationCardHorizontal}
                                        onPress={() => router.push({
                                            pathname: "/clients/coach-public-profile",
                                            params: { coachId: inv.coach_id, invitationId: inv.id }
                                        })}
                                    >
                                        <View style={styles.miniAvatar}>
                                            <Text style={styles.miniAvatarText}>{inv.coach_firstname?.[0] || '?'}</Text>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.invitationText} numberOfLines={1}>
                                                <Text style={{ fontWeight: 'bold' }}>{inv.coach_firstname} {inv.coach_lastname}</Text>
                                            </Text>
                                            <Text style={styles.coachCityText}>
                                                <Ionicons name="location" size={12} color="#8A8D91" /> {inv.coach_city || 'Remote'}
                                            </Text>
                                            <Text style={styles.viewProfileLink}>Tap to view & accept</Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={20} color="#3498DB" />
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    )}

                    {invitations.length > 0 && <View style={styles.separator} />}

                    {/* --- CODE UNIQUE --- */}
                    <Ionicons name="people-circle-outline" size={80} color="#3498DB" style={{marginBottom: 20}} />
                    <Text style={styles.noCoachTitle}>You don't have a coach yet</Text>
                    <Text style={styles.noCoachText}>
                        To get started with a professional coach, please share your unique code with them.
                    </Text>

                    <View style={styles.codeCard}>
                        <Text style={styles.codeLabel}>YOUR UNIQUE CODE</Text>
                        <Text style={styles.codeValue}>{user?.unique_code || "Loading..."}</Text>
                    </View>

                    <TouchableOpacity style={styles.copyButton} onPress={handleCopyCode}>
                        <Ionicons name="copy-outline" size={20} color="white" style={{marginRight: 10}}/>
                        <Text style={styles.copyButtonText}>Copy to clipboard</Text>
                    </TouchableOpacity>

                    <View style={styles.infoBox}>
                         <Ionicons name="information-circle-outline" size={24} color="#aaa" />
                         <Text style={styles.infoText}>
                             Once your coach adds this code in their app, you will automatically be linked to them.
                         </Text>
                    </View>
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
  actionBtnAI: { flex: 1, backgroundColor: '#9b59b6', paddingVertical: 14, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  actionBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  
  unassignButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 15, marginHorizontal: 16, borderRadius: 12, backgroundColor: 'rgba(231, 76, 60, 0.1)' },
  unassignText: { color: '#e74c3c', fontWeight: 'bold', fontSize: 16 },

  noCoachContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  noCoachTitle: { color: 'white', fontSize: 24, fontWeight: 'bold', marginBottom: 10, textAlign: 'center', paddingHorizontal: 20 },
  noCoachText: { color: '#aaa', fontSize: 16, textAlign: 'center', marginBottom: 30, paddingHorizontal: 20 },
  codeCard: { backgroundColor: '#2A4562', width: '90%', padding: 20, borderRadius: 15, alignItems: 'center', borderWidth: 1, borderColor: '#3498DB', marginBottom: 20 },
  codeLabel: { color: '#aaa', fontSize: 12, letterSpacing: 1, marginBottom: 5 },
  codeValue: { color: '#fff', fontSize: 32, fontWeight: 'bold', letterSpacing: 2 },
  copyButton: { flexDirection: 'row', backgroundColor: '#3498DB', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 25, alignItems: 'center', marginBottom: 30 },
  copyButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  infoBox: { flexDirection: 'row', backgroundColor: 'rgba(255, 255, 255, 0.05)', padding: 15, borderRadius: 10, alignItems: 'center', marginBottom: 20, width: '90%' },
  infoText: { color: '#888', marginLeft: 10, flex: 1, fontSize: 14, lineHeight: 20 },
  
  invitationsSection: { width: '100%', marginBottom: 30, paddingLeft: 16 },
  invitationsHeader: { color: '#8A8D91', fontSize: 14, fontWeight: 'bold', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 },
  invitationCardHorizontal: { backgroundColor: '#232D3F', borderRadius: 16, padding: 15, borderLeftWidth: 4, borderLeftColor: '#f1c40f', flexDirection: 'row', alignItems: 'center', width: 280, marginRight: 15, elevation: 3 },
  miniAvatar: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#3498DB', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  miniAvatarText: { color: 'white', fontWeight: 'bold', fontSize: 20 },
  invitationText: { color: 'white', fontSize: 14 },
  coachCityText: { color: '#8A8D91', fontSize: 12, marginTop: 2 },
  viewProfileLink: { color: '#f1c40f', fontSize: 12, marginTop: 4, fontWeight: 'bold' },
  separator: { height: 1, backgroundColor: '#2A4562', width: '85%', alignSelf: 'center', marginBottom: 30 }
});

export default CoachScreen;