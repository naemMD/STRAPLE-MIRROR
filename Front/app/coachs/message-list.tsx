import React, { useState, useCallback } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getUserDetails } from '@/services/authStorage';
import api from '@/services/api';

const MessagesListScreen = () => {
  const router = useRouter();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = async () => {
    try {
      const user = await getUserDetails();

      const response = await api.get(`/messages/conversations?current_user_id=${user.id}`);
      setConversations(response.data);
    } catch (error) {
      console.error("Erreur chargement conversations", error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchConversations();
    }, [])
  );

  const renderItem = ({ item }: any) => (
    <TouchableOpacity 
      style={styles.convItem}
      onPress={() => router.push({ pathname: '/chat/[id]', params: { id: item.client_id, name: item.client_firstname } })}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{item.client_firstname[0]}</Text>
      </View>
      <View style={styles.convDetails}>
        <Text style={styles.convName}>{item.client_firstname} {item.client_lastname}</Text>
        <Text style={styles.lastMessage} numberOfLines={1}>{item.last_message}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#8A8D91" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={28} color="#3498DB" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Messages</Text>
        <View style={{ width: 28 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#3498DB" style={{marginTop: 50}} />
      ) : (
        <FlatList
          data={conversations}
          keyboardDismissMode="on-drag"
          keyExtractor={(item) => item.client_id.toString()}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={<Text style={styles.emptyText}>Aucune conversation.</Text>}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A1F2B' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 15, marginTop: 10 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: 'white' },
  convItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2A4562', padding: 15, borderRadius: 12, marginBottom: 10 },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#3498DB', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  avatarText: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  convDetails: { flex: 1 },
  convName: { color: 'white', fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  lastMessage: { color: '#8A8D91', fontSize: 14 },
  emptyText: { color: '#8A8D91', textAlign: 'center', marginTop: 50 }
});

export default MessagesListScreen;