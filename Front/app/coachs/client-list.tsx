import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Dimensions, FlatList, ActivityIndicator, Modal, TextInput, ScrollView, Pressable } from 'react-native';
import { crossAlert } from '@/services/crossAlert';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getUserDetails } from '@/services/authStorage';
import api from '@/services/api';
import Toast from 'react-native-toast-message';

const { width } = Dimensions.get('window');

const CoachListScreen = () => {
  const navigation = useRouter();
  const [clients, setClients] = useState([]);
  const [sentInvitations, setSentInvitations] = useState([]);
  const [receivedRequests, setReceivedRequests] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);

  // Modal pour inviter un client
  const [isInviteModalVisible, setIsInviteModalVisible] = useState(false);
  const [clientCode, setClientCode] = useState('#'); 
  const [adding, setAdding] = useState(false);

  // Modal pour voir le profil d'une demande reçue (Comme sur le Home)
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [isRequestModalVisible, setIsRequestModalVisible] = useState(false);

  // Configuration des objectifs pour la modale
  const goalConfig: { [key: string]: { label: string; icon: any; color: string } } = {
    'lose_weight': { label: 'Lose Weight', icon: 'trending-down', color: '#E74C3C' },
    'gain_muscle': { label: 'Gain Muscle', icon: 'barbell', color: '#2ECC71' },
    'maintain': { label: 'Maintain Weight', icon: 'git-commit', color: '#F1C40F' }
  };

  const fetchClients = async (id = userId) => {
    if (!id) return;
    try {
        const response = await api.get(`/coaches/${id}/clients`);
        setClients(response.data);
    } catch (error) {
        console.error("Error fetching clients:", error);
    } finally {
        setLoading(false);
    }
  };

  const fetchSentInvitations = async () => {
      try {
          const response = await api.get(`/coaches/me/sent-invitations`);
          setSentInvitations(response.data);
      } catch (error) {
          console.error("Error fetching sent invitations:", error);
      }
  };

  const fetchReceivedRequests = async (id = userId) => {
      if (!id) return;
      try {
          const response = await api.get(`/coaches/me/pending-requests?current_user_id=${id}`);
          setReceivedRequests(response.data);
      } catch (error) {
          console.error("Error fetching received requests:", error);
      }
  };

  useEffect(() => {
      const init = async () => {
          const user = await getUserDetails();
          if (user?.id) {
              setUserId(user.id);
              fetchClients(user.id);
              fetchSentInvitations();
              fetchReceivedRequests(user.id);
          }
      };
      init();
  }, []);

  const handleCodeChange = (text: string) => {
      if (text === '') {
          setClientCode('#');
          return;
      }
      if (!text.startsWith('#')) {
          setClientCode('#' + text.replace(/#/g, ''));
      } else {
          setClientCode(text);
      }
  };

  const handleAddClient = async () => {
      if (!clientCode.trim().startsWith('#') || clientCode.length < 7) {
          Toast.show({ type: 'error', text1: 'Code invalide', text2: 'Veuillez entrer un code valide (ex: #123456)' });
          return;
      }
      
      setAdding(true);
      try {
          await api.post(
            `/coaches/invite-client`,
            { unique_code: clientCode.trim() }
          );
          Toast.show({ type: 'success', text1: 'Invitation sent! 🚀', text2: 'Your coaching request has been sent.' });
          setIsInviteModalVisible(false);
          setClientCode('#');
          fetchSentInvitations();
      } catch (error: any) {
          const msg = error.response?.data?.detail || "Failed to send invitation. Please try again.";
          Toast.show({ type: 'error', text1: 'Error', text2: msg });
      } finally {
          setAdding(false);
      }
  };

  const handleCancelInvitation = async (invitationId: number) => {
    crossAlert("Remove Invitation", "Are you sure you want to delete this request?", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: async () => {
            try {
                await api.delete(`/coaches/invitations/${invitationId}`);
                fetchSentInvitations();
                Toast.show({ type: 'success', text1: 'Deleted', text2: 'The invitation has been successfully removed.' });
            } catch (e) {
                Toast.show({ type: 'error', text1: 'Oops!', text2: 'Could not delete invitation. Please try again.' });
            }
        }}
    ]);
  };

  const handleRemoveClient = (clientId: number, clientName: string) => {
      crossAlert(
          "Remove Client",
          `Are you sure you want to stop coaching ${clientName}? They will no longer see your training plans.`,
          [
              { text: "Cancel", style: "cancel" },
              {
                  text: "Remove",
                  style: "destructive",
                  onPress: async () => {
                      try {
                          await api.delete(`/coaches/clients/${clientId}`);
                          Toast.show({ type: 'success', text1: 'Client Removed', text2: `${clientName} is no longer your client.` });
                          fetchClients(userId); 
                      } catch (error) {
                          Toast.show({ type: 'error', text1: 'Error', text2: 'Could not remove the client.' });
                      }
                  }
              }
          ]
      );
  };

  // 🔥 ACTION SUR LES DEMANDES REÇUES
  const handleRequestAction = async (requestId: number, status: 'accepted' | 'rejected') => {
      try {
          await api.patch(
              `/coaches/requests/${requestId}?status=${status}&current_user_id=${userId}`,
              {}
          );
          
          Toast.show({
              type: 'success',
              text1: status === 'accepted' ? 'Client Assigned! ✅' : 'Request Declined',
              text2: status === 'accepted' ? 'New client added to your roster.' : 'The request has been removed.'
          });
          
          setIsRequestModalVisible(false);
          fetchReceivedRequests(userId); 
          if (status === 'accepted') {
              fetchClients(userId); 
          }
      } catch (error) {
          Toast.show({ type: 'error', text1: 'Erreur', text2: 'Impossible de traiter la demande.' });
      }
  };

  const handleViewClient = (client: any) => {
      navigation.push({ pathname: "/coachs/client-details", params: { clientId: client.id } });
  };

  const handleContactClient = (client: any) => {
      navigation.push({ pathname: "/chat/[id]", params: { id: client.id, name: client.firstname } });
  };

  const renderClientItem = ({ item }: any) => (
    <View style={styles.clientItem}>
      <View style={styles.clientInfoContainer}>
        <View style={styles.clientAvatar}>
            <Text style={{fontSize: 20, fontWeight:'bold', color: '#2A4562'}}>
                {item.firstname ? item.firstname[0] : '?'}
            </Text>
        </View>
        <View style={styles.clientDetails}>
          <Text style={styles.clientName}>{item.firstname} {item.lastname}</Text>
          <Text style={styles.clientMeta}>Age: {item.age} • {item.gender}</Text>
          <Text style={styles.clientMeta}>Goal: {item.goal ? String(item.goal).replace('_', ' ') : 'Not specified'}</Text>
        </View>
        
        <TouchableOpacity style={styles.removeClientBtn} onPress={() => handleRemoveClient(item.id, `${item.firstname} ${item.lastname}`)}>
            <Ionicons name="trash-outline" size={20} color="#e74c3c" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.actionButtonsContainer}>
        <TouchableOpacity style={styles.actionButton} onPress={() => handleContactClient(item)}>
          <Text style={styles.actionButtonText}>Contact</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.actionButton} onPress={() => handleViewClient(item)}>
          <Text style={styles.actionButtonText}>View</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

    const currentClientGoal = goalConfig[selectedRequest?.client_goal] || { 
        label: 'Not specified', 
        icon: 'help-circle', 
        color: '#8A8D91' 
    };

  return (
    <View style={styles.container}>
      
      <View style={styles.header}>
          <Text style={styles.headerTitle}>My Clients</Text>
          <TouchableOpacity style={styles.addClientBtn} onPress={() => setIsInviteModalVisible(true)}>
              <Ionicons name="add" size={24} color="white" />
              <Text style={styles.addClientText}>Invite</Text>
          </TouchableOpacity>
      </View>

      {/* 🔥 DEMANDES REÇUES : Scroll Horizontal avec le même design que le Home */}
      {receivedRequests.length > 0 && (
        <View style={{ marginBottom: 20 }}>
          <Text style={[styles.sectionLabel, { paddingHorizontal: 16 }]}>⚠️ Coaching Requests</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
              {receivedRequests.map((req: any) => (
                  <TouchableOpacity 
                      key={req.request_id} 
                      style={[styles.alertCard, { borderLeftColor: '#3498DB', backgroundColor: 'rgba(52, 152, 219, 0.1)' }]}
                      onPress={() => {
                          setSelectedRequest(req);
                          setIsRequestModalVisible(true);
                      }}
                  >
                      <View style={styles.cardHeader}>
                          <View style={[styles.avatarPlaceholder, { backgroundColor: 'rgba(52, 152, 219, 0.2)' }]}>
                              <Ionicons name="person-add" size={24} color="#3498DB" />
                          </View>
                          <View style={{flex: 1, marginLeft: 15, marginRight: 15}}>
                              <Text style={styles.alertClientName} numberOfLines={1}>{req.client_name}</Text>
                              <Text style={[styles.alertIssue, { color: '#3498DB' }]}>
                                  Wants to be your client
                              </Text>
                          </View>
                          <View style={styles.viewBadge}>
                              <Text style={styles.viewBadgeText}>VIEW</Text>
                          </View>
                      </View>
                  </TouchableOpacity>
              ))}
          </ScrollView>
        </View>
      )}

      {/* Invitations envoyées */}
      {sentInvitations.length > 0 && (
        <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
          <Text style={styles.sectionLabel}>Sent Invitations</Text>
          {sentInvitations.map((inv: any) => (
            <View key={inv.id} style={[styles.invitationItem, { borderLeftColor: inv.status === 'pending' ? '#f1c40f' : '#e74c3c' }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: 'white', fontWeight: 'bold' }}>{inv.client_name}</Text>
                <Text style={{ color: '#8A8D91', fontSize: 12 }}>{inv.client_email}</Text>
                <Text style={{ color: inv.status === 'pending' ? '#f1c40f' : '#e74c3c', fontSize: 10, fontWeight: 'bold', marginTop: 4, textTransform: 'uppercase' }}>
                  {inv.status === 'pending' ? '• Waiting for client...' : '• Request Declined'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => handleCancelInvitation(inv.id)} style={{ padding: 5 }}>
                  <Ionicons name="trash-outline" size={20} color="#e74c3c" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <View style={{ paddingHorizontal: 16, marginBottom: 10 }}>
          <Text style={styles.sectionLabel}>Active Clients</Text>
      </View>

      {loading ? (
          <ActivityIndicator size="large" color="#3498DB" style={{marginTop: 50}} />
      ) : (
        <FlatList
            data={clients}
            keyboardDismissMode="on-drag"
            renderItem={renderClientItem}
            keyExtractor={item => item.id.toString()}
            contentContainerStyle={styles.clientList}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
                <View style={{marginTop: 50, paddingHorizontal: 30}}>
                    <Text style={{color: 'white', textAlign: 'center', fontSize: 16}}>No active clients.</Text>
                    <Text style={{color: '#8A8D91', textAlign: 'center', marginTop: 10}}>Use the "Invite" button to send a request.</Text>
                </View>
            }
        />
      )}

      {/* 🔥 MODAL DE PROFIL DU CLIENT (Copie exacte de la page Home) */}
      <Modal visible={isRequestModalVisible} animationType="slide" transparent onRequestClose={() => setIsRequestModalVisible(false)}>
          <Pressable style={styles.modalOverlay} onPress={() => setIsRequestModalVisible(false)}>
              <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
                  {selectedRequest && (
                      <>
                          <View style={styles.modalHeaderInfo}>
                              <View style={styles.avatarLarge}>
                                  <Text style={styles.avatarLargeText}>{selectedRequest.client_name ? selectedRequest.client_name[0] : 'U'}</Text>
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
                                      <View style={[styles.iconGoalCircle, { backgroundColor: `${currentClientGoal.color}15` }]}>
                                          <Ionicons name={currentClientGoal.icon} size={20} color={currentClientGoal.color} />
                                      </View>
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
                          
                          <TouchableOpacity style={styles.closeModal} onPress={() => setIsRequestModalVisible(false)}>
                              <Text style={{color: '#8A8D91', fontWeight: 'bold'}}>Close</Text>
                          </TouchableOpacity>
                      </>
                  )}
              </Pressable>
          </Pressable>
      </Modal>

      {/* Modal originale d'Invitation via Code */}
      <Modal visible={isInviteModalVisible} transparent animationType="slide">
          <Pressable style={styles.inviteModalBackground} onPress={() => setIsInviteModalVisible(false)}>
              <Pressable style={styles.inviteModalContainer} onPress={(e) => e.stopPropagation()}>
                  <Text style={styles.inviteModalTitle}>Invite a Client</Text>
                  <Text style={styles.inviteModalSubtitle}>Enter the unique code provided by the client to send a request.</Text>
                  
                  <TextInput 
                      style={styles.input}
                      placeholder="#123456"
                      placeholderTextColor="#aaa"
                      value={clientCode}
                      onChangeText={handleCodeChange}
                      autoCapitalize="none"
                      maxLength={7}
                  />

                  <View style={styles.inviteModalButtons}>
                      <TouchableOpacity style={[styles.inviteModalBtn, {backgroundColor: '#e74c3c'}]} onPress={() => setIsInviteModalVisible(false)}>
                          <Text style={styles.inviteModalBtnText}>Cancel</Text>
                      </TouchableOpacity>

                      <TouchableOpacity style={[styles.inviteModalBtn, {backgroundColor: '#3498DB'}]} onPress={handleAddClient} disabled={adding}>
                          {adding ? <ActivityIndicator color="white" /> : <Text style={styles.inviteModalBtnText}>Send Invite</Text>}
                      </TouchableOpacity>
                  </View>
              </Pressable>
          </Pressable>
      </Modal>

    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A1F2B' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 15, marginTop: 10 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: 'white' },
  addClientBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#3498DB', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20 },
  addClientText: { color: 'white', fontWeight: 'bold', marginLeft: 5 },
  sectionLabel: { color: '#8A8D91', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  
  // --- CARTE D'ALERTE POUR LES DEMANDES (Design Home) ---
  alertCard: { borderRadius: 12, padding: 15, borderLeftWidth: 4, width: 280, marginRight: 15 },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  avatarPlaceholder: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#2A4562', justifyContent: 'center', alignItems: 'center' },
  alertClientName: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  alertIssue: { fontWeight: 'bold', fontSize: 12, marginTop: 4 },
  viewBadge: { backgroundColor: '#3498DB', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  viewBadgeText: { color: 'white', fontWeight: 'bold', fontSize: 10 },

  invitationItem: { backgroundColor: '#1E2C3D', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', borderLeftWidth: 4 },
  
  clientList: { paddingHorizontal: 16, paddingBottom: 20 },
  clientItem: { backgroundColor: '#2A4562', borderRadius: 10, marginBottom: 16, padding: 12 },
  clientInfoContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  clientAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#CCCCCC', justifyContent: 'center', alignItems: 'center' },
  clientDetails: { flex: 1, marginLeft: 10 }, 
  clientName: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  clientMeta: { color: '#FFFFFF', fontSize: 14, textTransform: 'capitalize' },
  removeClientBtn: { padding: 8, backgroundColor: 'rgba(231, 76, 60, 0.1)', borderRadius: 8, marginLeft: 10 },
  actionButtonsContainer: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 5 },
  actionButton: { backgroundColor: '#3498DB', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 16, alignItems: 'center', width: width * 0.35 },
  actionButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: 'bold' },

  // --- MODAL DU PROFIL DU CLIENT (Design Home) ---
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
  closeModal: { marginTop: 25 },

  // --- MODAL D'INVITATION CLASSIQUE ---
  inviteModalBackground: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  inviteModalContainer: { width: '85%', backgroundColor: '#2A4562', borderRadius: 15, padding: 20, alignItems: 'center' },
  inviteModalTitle: { color: 'white', fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
  inviteModalSubtitle: { color: '#ccc', textAlign: 'center', marginBottom: 20, fontSize: 14 },
  input: { backgroundColor: '#1A1F2B', width: '100%', color: 'white', padding: 15, borderRadius: 10, fontSize: 18, textAlign: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#3498DB' },
  inviteModalButtons: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  inviteModalBtn: { flex: 1, padding: 15, borderRadius: 10, alignItems: 'center', marginHorizontal: 5 },
  inviteModalBtnText: { color: 'white', fontWeight: 'bold' }
});

export default CoachListScreen;