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
  const [currentPage, setCurrentPage] = useState(1);
  const CLIENTS_PER_PAGE = 15;

  // Modal pour inviter un client
  const [isInviteModalVisible, setIsInviteModalVisible] = useState(false);
  const [clientCode, setClientCode] = useState('#');
  const [adding, setAdding] = useState(false);
  const [inviteError, setInviteError] = useState('');

  // Modal pour voir le profil d'une demande reçue (Comme sur le Home)
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [isRequestModalVisible, setIsRequestModalVisible] = useState(false);

  // Configuration des objectifs pour la modale
  const goalConfig: { [key: string]: { label: string; color: string } } = {
    'lose_weight': { label: 'Weight Loss', color: '#E74C3C' },
    'gain_muscle': { label: 'Muscle Gain', color: '#2ECC71' },
    'maintain_weight': { label: 'Maintain', color: '#F1C40F' }
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
      setInviteError('');
      if (!clientCode.trim().startsWith('#') || clientCode.length < 7) {
          setInviteError('Please enter a valid code (e.g. #123456)');
          return;
      }

      setAdding(true);
      try {
          await api.post(
            `/coaches/invite-client`,
            { unique_code: clientCode.trim() }
          );
          setIsInviteModalVisible(false);
          setClientCode('#');
          setInviteError('');
          fetchSentInvitations();
          Toast.show({ type: 'success', text1: 'Invitation sent', text2: 'Your coaching request has been sent.' });
      } catch (error: any) {
          const msg = error.response?.data?.detail || "Failed to send invitation. Please try again.";
          setInviteError(msg);
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
              text1: status === 'accepted' ? 'Client Assigned' : 'Request Declined',
              text2: status === 'accepted' ? 'New client added to your roster.' : 'The request has been removed.'
          });
          
          setIsRequestModalVisible(false);
          fetchReceivedRequests(userId); 
          if (status === 'accepted') {
              fetchClients(userId); 
          }
      } catch (error) {
          Toast.show({ type: 'error', text1: 'Error', text2: 'Unable to process the request.' });
      }
  };

  const handleViewClient = (client: any) => {
      navigation.push({ pathname: "/coachs/client-details", params: { clientId: client.id } });
  };

  const handleContactClient = (client: any) => {
      navigation.push({ pathname: "/chat/[id]", params: { id: client.id, name: client.firstname } });
  };

  const renderClientItem = ({ item }: any) => {
    return (
      <View style={styles.clientItem}>
        <View style={styles.clientInfoContainer}>
          <View style={styles.clientAvatar}>
              <Text style={styles.clientAvatarText}>
                  {item.firstname ? item.firstname[0].toUpperCase() : '?'}
              </Text>
          </View>
          <View style={styles.clientDetails}>
            <Text style={styles.clientName}>{item.firstname} {item.lastname}</Text>
          </View>
        </View>

        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity style={styles.contactButton} onPress={() => handleContactClient(item)}>
            <Ionicons name="chatbubble-outline" size={16} color="#3498DB" />
            <Text style={styles.contactButtonText}>Contact</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.viewButton} onPress={() => handleViewClient(item)}>
            <Text style={styles.viewButtonText}>Dashboard</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.removeClientBtn} onPress={() => handleRemoveClient(item.id, `${item.firstname} ${item.lastname}`)}>
            <Ionicons name="trash-outline" size={18} color="#e74c3c" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

    const currentClientGoal = goalConfig[selectedRequest?.client_goal] || {
        label: 'Not specified',
        color: '#8A8D91' 
    };

  return (
    <View style={styles.container}>
      
      <View style={styles.header}>
          <Text style={styles.headerTitle}>My Clients</Text>
          <TouchableOpacity style={styles.addClientBtn} onPress={() => setIsInviteModalVisible(true)}>
              <Ionicons name="person-add-outline" size={18} color="white" />
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
              <View style={styles.invitationAvatar}>
                <Ionicons name={inv.status === 'pending' ? "hourglass-outline" : "close-circle-outline"} size={20} color={inv.status === 'pending' ? '#f1c40f' : '#e74c3c'} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 15 }}>{inv.client_name}</Text>
                <Text style={{ color: '#8A8D91', fontSize: 12, marginTop: 2 }}>{inv.client_email}</Text>
                <Text style={{ color: inv.status === 'pending' ? '#f1c40f' : '#e74c3c', fontSize: 10, fontWeight: 'bold', marginTop: 4, textTransform: 'uppercase' }}>
                  {inv.status === 'pending' ? 'Waiting for response...' : 'Request Declined'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => handleCancelInvitation(inv.id)} style={styles.invitationDeleteBtn}>
                  <Ionicons name="close" size={18} color="#e74c3c" />
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
        <>
        <FlatList
            data={clients.slice((currentPage - 1) * CLIENTS_PER_PAGE, currentPage * CLIENTS_PER_PAGE)}
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
        {clients.length > CLIENTS_PER_PAGE && (
          <View style={styles.paginationContainer}>
            <TouchableOpacity
              style={[styles.paginationBtn, currentPage === 1 && styles.paginationBtnDisabled]}
              onPress={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <Ionicons name="chevron-back" size={18} color={currentPage === 1 ? '#555' : 'white'} />
            </TouchableOpacity>
            <Text style={styles.paginationText}>{currentPage} / {Math.ceil(clients.length / CLIENTS_PER_PAGE)}</Text>
            <TouchableOpacity
              style={[styles.paginationBtn, currentPage >= Math.ceil(clients.length / CLIENTS_PER_PAGE) && styles.paginationBtnDisabled]}
              onPress={() => setCurrentPage(p => Math.min(Math.ceil(clients.length / CLIENTS_PER_PAGE), p + 1))}
              disabled={currentPage >= Math.ceil(clients.length / CLIENTS_PER_PAGE)}
            >
              <Ionicons name="chevron-forward" size={18} color={currentPage >= Math.ceil(clients.length / CLIENTS_PER_PAGE) ? '#555' : 'white'} />
            </TouchableOpacity>
          </View>
        )}
        </>
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
          <Pressable style={styles.inviteModalBackground} onPress={() => { setIsInviteModalVisible(false); setInviteError(''); }}>
              <Pressable style={styles.inviteModalContainer} onPress={(e) => e.stopPropagation()}>
                  <Text style={styles.inviteModalTitle}>Invite a Client</Text>
                  <Text style={styles.inviteModalSubtitle}>Enter the unique code provided by the client to send a request.</Text>

                  <TextInput
                      style={[styles.input, inviteError ? styles.inputError : null]}
                      placeholder="#123456"
                      placeholderTextColor="#aaa"
                      value={clientCode}
                      onChangeText={(t) => { handleCodeChange(t); setInviteError(''); }}
                      autoCapitalize="none"
                      maxLength={7}
                  />

                  {inviteError ? (
                      <View style={styles.inviteErrorRow}>
                          <Ionicons name="alert-circle" size={16} color="#E74C3C" />
                          <Text style={styles.inviteErrorText}>{inviteError}</Text>
                      </View>
                  ) : null}

                  <View style={styles.inviteModalButtons}>
                      <TouchableOpacity style={[styles.inviteModalBtn, {backgroundColor: '#e74c3c'}]} onPress={() => { setIsInviteModalVisible(false); setInviteError(''); }}>
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 20, marginTop: 10 },
  headerTitle: { fontSize: 26, fontWeight: 'bold', color: 'white' },
  headerSubtitle: { color: '#8A8D91', fontSize: 13, marginTop: 2 },
  addClientBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#3498DB', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, gap: 8 },
  addClientText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
  sectionLabel: { color: '#8A8D91', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },

  // --- CARTE D'ALERTE POUR LES DEMANDES ---
  alertCard: { borderRadius: 12, padding: 15, borderLeftWidth: 4, width: 280, marginRight: 15 },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  avatarPlaceholder: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#2A4562', justifyContent: 'center', alignItems: 'center' },
  alertClientName: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  alertIssue: { fontWeight: 'bold', fontSize: 12, marginTop: 4 },
  viewBadge: { backgroundColor: '#3498DB', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  viewBadgeText: { color: 'white', fontWeight: 'bold', fontSize: 10 },

  invitationItem: { backgroundColor: '#1E2C3D', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', borderLeftWidth: 4, marginBottom: 10 },
  invitationAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' },
  invitationDeleteBtn: { padding: 8, backgroundColor: 'rgba(231, 76, 60, 0.1)', borderRadius: 8 },

  clientList: { paddingHorizontal: 16, paddingBottom: 20 },
  clientItem: { backgroundColor: '#232D3F', borderRadius: 16, marginBottom: 12, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  clientInfoContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  clientAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#3498DB', justifyContent: 'center', alignItems: 'center' },
  clientAvatarText: { fontSize: 20, fontWeight: 'bold', color: 'white' },
  clientDetails: { flex: 1, marginLeft: 14 },
  clientName: { color: '#FFFFFF', fontSize: 17, fontWeight: 'bold' },
  clientMeta: { color: '#8A8D91', fontSize: 12 },
  goalBadge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  goalBadgeText: { fontSize: 10, fontWeight: 'bold' },
  removeClientBtn: { padding: 8, backgroundColor: 'rgba(231, 76, 60, 0.1)', borderRadius: 10 },
  actionButtonsContainer: { flexDirection: 'row', gap: 10 },
  contactButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: 'rgba(52, 152, 219, 0.1)', borderWidth: 1, borderColor: '#3498DB', borderRadius: 10, paddingVertical: 10 },
  contactButtonText: { color: '#3498DB', fontWeight: 'bold', fontSize: 13 },
  viewButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#3498DB', borderRadius: 10, paddingVertical: 10 },
  viewButtonText: { color: 'white', fontWeight: 'bold', fontSize: 13 },

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
  input: { backgroundColor: '#1A1F2B', width: '100%', color: 'white', padding: 15, borderRadius: 10, fontSize: 18, textAlign: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#3498DB' },
  inputError: { borderColor: '#E74C3C' },
  inviteErrorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14, paddingHorizontal: 4 },
  inviteErrorText: { color: '#E74C3C', fontSize: 13, flex: 1 },
  inviteModalButtons: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  inviteModalBtn: { flex: 1, padding: 15, borderRadius: 10, alignItems: 'center', marginHorizontal: 5 },
  inviteModalBtnText: { color: 'white', fontWeight: 'bold' },

  // --- PAGINATION ---
  paginationContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 12, gap: 20 },
  paginationBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#2A4562', justifyContent: 'center', alignItems: 'center' },
  paginationBtnDisabled: { backgroundColor: '#1E2C3D' },
  paginationText: { color: 'white', fontWeight: 'bold', fontSize: 14 }
});

export default CoachListScreen;