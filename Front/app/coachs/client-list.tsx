import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Dimensions, FlatList, ActivityIndicator, Modal, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import axios from 'axios';
import Constants from 'expo-constants';
import { getUserDetails, getToken } from '@/services/authStorage';
import Toast from 'react-native-toast-message';

const { width } = Dimensions.get('window');

const CoachListScreen = () => {
  const navigation = useRouter();
  const API_URL = Constants.expoConfig?.extra?.API_URL ?? '';
  
  const [clients, setClients] = useState([]);
  const [sentInvitations, setSentInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [clientCode, setClientCode] = useState('#'); 
  const [adding, setAdding] = useState(false);

  const fetchClients = async (id = userId) => {
    if (!id) return;
    try {
        const token = await getToken();
        const response = await axios.get(`${API_URL}/coaches/${id}/clients`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        setClients(response.data);
    } catch (error) {
        console.error("Error fetching clients:", error);
    } finally {
        setLoading(false);
    }
  };

  const fetchSentInvitations = async () => {
      try {
          const token = await getToken();
          const response = await axios.get(`${API_URL}/coaches/me/sent-invitations`, {
              headers: { Authorization: `Bearer ${token}` }
          });
          setSentInvitations(response.data);
      } catch (error) {
          console.error("Error fetching sent invitations:", error);
      }
  };

  useEffect(() => {
      const init = async () => {
          const user = await getUserDetails();
          if (user?.id) {
              setUserId(user.id);
              fetchClients(user.id);
              fetchSentInvitations();
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
          Toast.show({
              type: 'error',
              text1: 'Code invalide',
              text2: 'Veuillez entrer un code valide (ex: #123456)'
          });
          return;
      }
      
      setAdding(true);
      try {
          const token = await getToken();
          await axios.post(
            `${API_URL}/coaches/invite-client`, 
            { unique_code: clientCode.trim() },
            { headers: { Authorization: `Bearer ${token}` } }
          );

          Toast.show({
              type: 'success',
              text1: 'Invitation sent! 🚀',
              text2: 'Your coaching request has been sent to the client.'
          });

          setIsModalVisible(false);
          setClientCode('#');
          fetchSentInvitations();
          
      } catch (error: any) {
          const msg = error.response?.data?.detail || "Failed to send invitation. Please try again.";
          Toast.show({
              type: 'error',
              text1: 'Error',
              text2: msg
          });
      } finally {
          setAdding(false);
      }
  };

  const handleCancelInvitation = async (invitationId: number) => {
    Alert.alert("Remove Invitation", "Are you sure you want to delete this request?", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: async () => {
            try {
                const token = await getToken();
                await axios.delete(`${API_URL}/coaches/invitations/${invitationId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                fetchSentInvitations();
                
                Toast.show({
                    type: 'success',
                    text1: 'Deleted',
                    text2: 'The invitation has been successfully removed.'
                });
            } catch (e) {
                Toast.show({
                    type: 'error',
                    text1: 'Oops!',
                    text2: 'Could not delete invitation. Please try again.'
                });
            }
        }}
    ]);
  };

  const handleViewClient = (client: any) => {
      navigation.push({
          pathname: "/coachs/client-details",
          params: { clientId: client.id }
      });
  };

  const handleContactClient = (client: any) => {
      navigation.push({
          pathname: "/chat/[id]",
          params: { id: client.id, name: client.firstname }
      });
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

  return (
    <View style={styles.container}>
      
      <View style={styles.header}>
          <Text style={styles.headerTitle}>My Clients</Text>
          <TouchableOpacity style={styles.addClientBtn} onPress={() => setIsModalVisible(true)}>
              <Ionicons name="add" size={24} color="white" />
              <Text style={styles.addClientText}>Invite</Text>
          </TouchableOpacity>
      </View>

      {sentInvitations.length > 0 && (
        <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
          <Text style={styles.sectionLabel}>Sent Invitations</Text>
          {sentInvitations.map((inv: any) => (
            <View key={inv.id} style={[styles.invitationItem, { borderLeftColor: inv.status === 'pending' ? '#f1c40f' : '#e74c3c' }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: 'white', fontWeight: 'bold' }}>{inv.client_name}</Text>
                <Text style={{ color: '#8A8D91', fontSize: 12 }}>{inv.client_email}</Text>
                <Text style={{ 
                  color: inv.status === 'pending' ? '#f1c40f' : '#e74c3c', 
                  fontSize: 10, fontWeight: 'bold', marginTop: 4, textTransform: 'uppercase'
                }}>
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

      <Modal visible={isModalVisible} transparent animationType="slide">
          <View style={styles.modalBackground}>
              <View style={styles.modalContainer}>
                  <Text style={styles.modalTitle}>Invite a Client</Text>
                  <Text style={styles.modalSubtitle}>Enter the unique code provided by the client to send a request.</Text>
                  
                  <TextInput 
                      style={styles.input}
                      placeholder="#123456"
                      placeholderTextColor="#aaa"
                      value={clientCode}
                      onChangeText={handleCodeChange}
                      autoCapitalize="none"
                      maxLength={7}
                  />

                  <View style={styles.modalButtons}>
                      <TouchableOpacity 
                        style={[styles.modalBtn, {backgroundColor: '#e74c3c'}]}
                        onPress={() => setIsModalVisible(false)}
                      >
                          <Text style={styles.modalBtnText}>Cancel</Text>
                      </TouchableOpacity>

                      <TouchableOpacity 
                        style={[styles.modalBtn, {backgroundColor: '#3498DB'}]}
                        onPress={handleAddClient}
                        disabled={adding}
                      >
                          {adding ? (
                              <ActivityIndicator color="white" />
                          ) : (
                              <Text style={styles.modalBtnText}>Send Invite</Text>
                          )}
                      </TouchableOpacity>
                  </View>
              </View>
          </View>
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
  sectionLabel: { color: '#8A8D91', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
  invitationItem: { backgroundColor: '#1E2C3D', borderRadius: 12, padding: 12, marginTop: 10, flexDirection: 'row', alignItems: 'center', borderLeftWidth: 4 },
  clientList: { paddingHorizontal: 16, paddingBottom: 20 },
  clientItem: { backgroundColor: '#2A4562', borderRadius: 10, marginBottom: 16, padding: 12 },
  clientInfoContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  clientAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#CCCCCC', justifyContent: 'center', alignItems: 'center' },
  clientDetails: { marginLeft: 10 },
  clientName: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  clientMeta: { color: '#FFFFFF', fontSize: 14, textTransform: 'capitalize' },
  actionButtonsContainer: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 5 },
  actionButton: { backgroundColor: '#3498DB', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 16, alignItems: 'center', width: width * 0.35 },
  actionButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: 'bold' },
  modalBackground: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { width: '85%', backgroundColor: '#2A4562', borderRadius: 15, padding: 20, alignItems: 'center' },
  modalTitle: { color: 'white', fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
  modalSubtitle: { color: '#ccc', textAlign: 'center', marginBottom: 20, fontSize: 14 },
  input: { backgroundColor: '#1A1F2B', width: '100%', color: 'white', padding: 15, borderRadius: 10, fontSize: 18, textAlign: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#3498DB' },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  modalBtn: { flex: 1, padding: 15, borderRadius: 10, alignItems: 'center', marginHorizontal: 5 },
  modalBtnText: { color: 'white', fontWeight: 'bold' }
});

export default CoachListScreen;