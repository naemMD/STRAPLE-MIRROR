import React, { useState, useCallback } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getUserDetails } from '@/services/authStorage';
import api from '@/services/api';

const CONVERSATIONS_PER_PAGE = 15;

const MessagesListScreen = () => {
  const router = useRouter();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

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

  const renderItem = ({ item }: any) => {
    const hasUnread = item.unread_count > 0;
    return (
      <TouchableOpacity
        style={[styles.convItem, hasUnread && styles.convItemUnread]}
        onPress={() => router.push({ pathname: '/chat/[id]', params: { id: item.client_id, name: item.client_firstname } })}
      >
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{item.client_firstname[0]}</Text>
          </View>
          {hasUnread && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{item.unread_count > 9 ? '9+' : item.unread_count}</Text>
            </View>
          )}
        </View>
        <View style={styles.convDetails}>
          <Text style={[styles.convName, hasUnread && styles.convNameUnread]}>{item.client_firstname} {item.client_lastname}</Text>
          <Text style={[styles.lastMessage, hasUnread && styles.lastMessageUnread]} numberOfLines={1}>{item.last_message}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#8A8D91" />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        <View style={{ width: 28 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#3498DB" style={{marginTop: 50}} />
      ) : (
        <>
        <FlatList
          data={conversations.slice((currentPage - 1) * CONVERSATIONS_PER_PAGE, currentPage * CONVERSATIONS_PER_PAGE)}
          keyboardDismissMode="on-drag"
          keyExtractor={(item) => item.client_id.toString()}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={<Text style={styles.emptyText}>No conversations yet. Start chatting with your clients!</Text>}
        />
        {conversations.length > CONVERSATIONS_PER_PAGE && (
          <View style={styles.paginationContainer}>
            <TouchableOpacity
              style={[styles.paginationBtn, currentPage === 1 && styles.paginationBtnDisabled]}
              onPress={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <Ionicons name="chevron-back" size={18} color={currentPage === 1 ? '#555' : 'white'} />
            </TouchableOpacity>
            <Text style={styles.paginationText}>{currentPage} / {Math.ceil(conversations.length / CONVERSATIONS_PER_PAGE)}</Text>
            <TouchableOpacity
              style={[styles.paginationBtn, currentPage >= Math.ceil(conversations.length / CONVERSATIONS_PER_PAGE) && styles.paginationBtnDisabled]}
              onPress={() => setCurrentPage(p => Math.min(Math.ceil(conversations.length / CONVERSATIONS_PER_PAGE), p + 1))}
              disabled={currentPage >= Math.ceil(conversations.length / CONVERSATIONS_PER_PAGE)}
            >
              <Ionicons name="chevron-forward" size={18} color={currentPage >= Math.ceil(conversations.length / CONVERSATIONS_PER_PAGE) ? '#555' : 'white'} />
            </TouchableOpacity>
          </View>
        )}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A1F2B' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 15, marginTop: 10 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: 'white' },
  convItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#232D3F', padding: 15, borderRadius: 12, marginBottom: 10, borderLeftWidth: 3, borderLeftColor: 'transparent' },
  convItemUnread: { borderLeftColor: '#3498DB', backgroundColor: '#1E2C3D' },
  avatarContainer: { position: 'relative', marginRight: 15 },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#3498DB', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  unreadBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#e74c3c', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  unreadBadgeText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
  convDetails: { flex: 1 },
  convName: { color: 'white', fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  convNameUnread: { color: '#3498DB' },
  lastMessage: { color: '#8A8D91', fontSize: 14 },
  lastMessageUnread: { color: '#ccc', fontWeight: '600' },
  emptyText: { color: '#8A8D91', textAlign: 'center', marginTop: 50 },
  paginationContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 12, gap: 20 },
  paginationBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#2A4562', justifyContent: 'center', alignItems: 'center' },
  paginationBtnDisabled: { backgroundColor: '#1E2C3D' },
  paginationText: { color: 'white', fontWeight: 'bold', fontSize: 14 }
});

export default MessagesListScreen;
