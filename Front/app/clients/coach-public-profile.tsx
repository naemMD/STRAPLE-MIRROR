import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { crossAlert } from '@/services/crossAlert';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'; // 🔥 Stack importé ici
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getUserDetails } from '@/services/authStorage';
import api from '@/services/api';
import { Toast } from 'react-native-toast-message/lib/src/Toast';

const CoachPublicProfile = () => {
  const { coachId, invitationId } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [coach, setCoach] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  
  const [sendingRequest, setSendingRequest] = useState(false);
  const [requestStatus, setRequestStatus] = useState<'none' | 'pending'>('none');
  const [pendingRequestId, setPendingRequestId] = useState<number | null>(null); 
  
  const [hasCoach, setHasCoach] = useState(false);
  const [isMyCoach, setIsMyCoach] = useState(false);

  useEffect(() => {
    fetchCoachProfileAndStatus();
  }, [coachId]);

  const fetchCoachProfileAndStatus = async () => {
    // 🔥 Protection contre le chargement "fantôme" d'Expo Router
    if (!coachId || coachId === 'undefined') {
        setLoading(false);
        return; 
    }

    try {
      const user = await getUserDetails();

      if (user?.id) {
          const userRes = await api.get(`/users/me/${user.id}`);
          setHasCoach(!!userRes.data.coach_id);
          setIsMyCoach(userRes.data.coach_id === Number(coachId));
      }

      const response = await api.get(`/coaches/${coachId}/public-profile`);
      setCoach(response.data);

      if (user?.id && !invitationId) {
         try {
             const requestsRes = await api.get(`/clients/me/sent-requests?current_user_id=${user.id}`);
             
             const pendingReq = requestsRes.data.find((req: any) => req.coach_id === Number(coachId));
             
             if (pendingReq) {
                 setRequestStatus('pending'); 
                 setPendingRequestId(pendingReq.id); 
             }
         } catch (e) {
             console.error("Could not check pending requests", e);
         }
      }

    } catch (error) {
      Toast.show({ type: 'error', text1: 'Failed to load coach profile.' });
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleResponse = async (status: 'accepted' | 'rejected') => {
    if (status === 'rejected') {
      crossAlert(
        "Decline Invitation",
        "Are you sure you want to decline this coaching request?",
        [
          { text: "Cancel", style: "cancel" },
          { 
            text: "Decline", 
            style: "destructive", 
            onPress: () => submitResponse(status)
          }
        ]
      );
    } else {
      submitResponse(status);
    }
  };
  
  const submitResponse = async (status: 'accepted' | 'rejected') => {
    setProcessing(true);
    try {
      await api.patch(`/clients/invitations/${invitationId}`, { status });
  
      const message = status === 'accepted' 
        ? "You are now linked with your new coach!" 
        : "Invitation declined.";
      
      Toast.show({ type: 'success', text1: message });
      router.push('/clients/home');
    } catch (error: any) {
      Toast.show({ type: 'error', text1: error.response?.data?.message || 'An error occurred. Please try again.' });
    } finally {
      setProcessing(false);
    }
  };

  const handleRequestCoaching = async () => {
    if (hasCoach) {
        crossAlert(
            "Action Not Allowed",
            "You already have a coach. You must first unassign from your current coach in your profile before sending a new request.",
            [{ text: "Got it", style: "default" }]
        );
        return;
    }

    setSendingRequest(true);
    try {
        const user = await getUserDetails();

        await api.post(`/clients/me/requests?current_user_id=${user?.id}`, {
            coach_id: Number(coachId)
        });

        Toast.show({ type: 'success', text1: 'Request sent! 🚀', text2: 'The coach has been notified of your request.' });
        await fetchCoachProfileAndStatus(); 
        
    } catch (error: any) {
        if (error.response?.status === 400) {
            await fetchCoachProfileAndStatus();
            Toast.show({ type: 'info', text1: 'Already requested', text2: 'You already have a pending request for this coach.' });
        } else {
            Toast.show({ type: 'error', text1: 'Oops!', text2: 'Error sending the request.' });
        }
    } finally {
        setSendingRequest(false);
    }
  };

  const handleCancelRequest = () => {
    if (!pendingRequestId) return;

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
              const user = await getUserDetails();
              await api.delete(`/clients/requests/${pendingRequestId}?current_user_id=${user?.id}`);
              
              Toast.show({ type: 'success', text1: 'Request cancelled' });
              setRequestStatus('none');
              setPendingRequestId(null);
            } catch (error) {
              Toast.show({ type: 'error', text1: 'Error cancelling request' });
            }
          }
        }
      ]
    );
  };

  const handleUnassignCoach = () => {
    crossAlert(
      "Leave Coach",
      "Do you really want to unassign from this coach?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unassign",
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/users/me/coach`);
              Toast.show({ type: 'success', text1: 'Coach unassigned' });
              router.push('/clients/coach');
            } catch (error) {
              Toast.show({ type: 'error', text1: 'Failed to unassign coach' });
            }
          }
        }
      ]
    );
  };

  if (loading) return <ActivityIndicator size="large" color="#3498DB" style={{ flex: 1, backgroundColor: '#1A1F2B' }} />;

  return (
  <ScrollView style={[styles.container, { paddingTop: insets.top }]} keyboardDismissMode="on-drag">
      {/* 🔥 SOLUTION : On masque le header global d'Expo Router */}
      <Stack.Screen options={{ headerShown: false }} />

      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={24} color="white" />
      </TouchableOpacity>

      <View style={styles.profileHeader}>
        <View style={styles.avatarLarge}>
          <Text style={styles.avatarText}>{coach?.firstname?.[0]}</Text>
        </View>
        <Text style={styles.name}>{coach?.firstname} {coach?.lastname}</Text>
        <Text style={styles.location}>
          <Ionicons name="location" size={16} color="#3498DB" /> {coach?.city || 'Remote'}
        </Text>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{coach?.stats?.active_clients || 0}</Text>
          <Text style={styles.statLabel}>Clients</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{coach?.stats?.workouts_created || 0}</Text>
          <Text style={styles.statLabel}>Workouts</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About Me</Text>
        <Text style={styles.description}>{coach?.description || "No description provided."}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Certifications</Text>
        {coach?.certifications?.map((cert: string, index: number) => (
          <View key={index} style={styles.certItem}>
            <Ionicons name="checkmark-circle" size={18} color="#2ECC71" />
            <Text style={styles.certText}>{cert}</Text>
          </View>
        ))}
      </View>

      {invitationId ? (
        <View style={styles.actions}>
          <TouchableOpacity 
            style={[styles.btn, styles.btnReject]} 
            onPress={() => handleResponse('rejected')}
            disabled={processing}
          >
            <Text style={styles.btnText}>Decline</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.btn, styles.btnAccept]} 
            onPress={() => handleResponse('accepted')}
            disabled={processing}
          >
            {processing ? <ActivityIndicator color="white" /> : <Text style={styles.btnText}>Accept Coach</Text>}
          </TouchableOpacity>
        </View>
      ) : (
        requestStatus === 'pending' ? (
            <View style={styles.pendingRow}>
                <View style={styles.pendingBadge}>
                    <Ionicons name="time-outline" size={20} color="#8A8D91" style={{ marginRight: 8 }} />
                    <Text style={styles.pendingBadgeText}>Pending Request</Text>
                </View>
                <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelRequest}>
                    <Ionicons name="trash-outline" size={24} color="#E74C3C" />
                </TouchableOpacity>
            </View>
        ) : (
            isMyCoach ? (
              <TouchableOpacity style={styles.unassignButton} onPress={handleUnassignCoach}>
                <Ionicons name="exit-outline" size={20} color="#E74C3C" style={{ marginRight: 10 }} />
                <Text style={styles.unassignButtonText}>Unassign Coach</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                  style={[
                      styles.requestButton,
                      hasCoach ? { backgroundColor: '#2A4562' } : null,
                      sendingRequest && { opacity: 0.7 }
                  ]}
                  onPress={handleRequestCoaching}
                  disabled={sendingRequest}
              >
                  {sendingRequest ? (
                      <ActivityIndicator color="white" />
                  ) : (
                      <>
                          <Ionicons name={hasCoach ? "lock-closed" : "paper-plane"} size={20} color={hasCoach ? "#8A8D91" : "white"} style={{ marginRight: 10 }} />
                          <Text style={[styles.requestButtonText, hasCoach && { color: '#8A8D91' }]}>
                              {hasCoach ? "Already Assigned" : "Request Coaching"}
                          </Text>
                      </>
                  )}
              </TouchableOpacity>
            )
        )
      )}
      
      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A1F2B', paddingHorizontal: 20 },
  backButton: { marginBottom: 8, marginTop: 5 },
  profileHeader: { alignItems: 'center', marginBottom: 20 },
  avatarLarge: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#3498DB', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  avatarText: { fontSize: 40, color: 'white', fontWeight: 'bold' },
  name: { fontSize: 24, fontWeight: 'bold', color: 'white', marginBottom: 5 },
  location: { color: '#8A8D91', fontSize: 16 },
  statsContainer: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#2A4562', borderRadius: 15, padding: 20, marginBottom: 30 },
  statBox: { alignItems: 'center' },
  statValue: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  statLabel: { color: '#8A8D91', fontSize: 12 },
  section: { marginBottom: 25 },
  sectionTitle: { color: 'white', fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  description: { color: '#ccc', lineHeight: 22 },
  certItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  certText: { color: '#ccc', marginLeft: 10 },
  
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, marginBottom: 10 },
  btn: { flex: 1, padding: 15, borderRadius: 12, alignItems: 'center', marginHorizontal: 5 },
  btnReject: { backgroundColor: '#E74C3C' },
  btnAccept: { backgroundColor: '#2ECC71' },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },

  requestButton: { flexDirection: 'row', backgroundColor: '#3498DB', padding: 18, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 20, elevation: 3, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 3, shadowOffset: { width: 0, height: 2 } },
  requestButtonText: { color: 'white', fontWeight: 'bold', fontSize: 18 },

  pendingRow: { flexDirection: 'row', marginTop: 20, gap: 10 },
  pendingBadge: { flex: 1, flexDirection: 'row', backgroundColor: '#2A4562', padding: 18, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  pendingBadgeText: { color: '#8A8D91', fontWeight: 'bold', fontSize: 16 },
  cancelBtn: { backgroundColor: 'rgba(231, 76, 60, 0.1)', paddingHorizontal: 20, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E74C3C' },

  unassignButton: { flexDirection: 'row', backgroundColor: 'rgba(231, 76, 60, 0.1)', padding: 18, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 20, borderWidth: 1, borderColor: '#E74C3C' },
  unassignButtonText: { color: '#E74C3C', fontWeight: 'bold', fontSize: 18 },
});

export default CoachPublicProfile;