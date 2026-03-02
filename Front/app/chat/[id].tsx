import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, Keyboard, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';
import { getToken, getUserDetails } from '@/services/authStorage';

const ChatScreen = () => {
  const { id, name } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const API_URL = Constants.expoConfig?.extra?.API_URL ?? '';

  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const formatTime = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const markAsRead = async (userId: number) => {
    try {
      const token = await getToken();
      await axios.put(`${API_URL}/messages/read/${id}?current_user_id=${userId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (error) {
      console.error("Erreur lecture messages:", error);
    }
  };

  const fetchMessages = async (userId: number) => {
    try {
      const token = await getToken();
      const res = await axios.get(`${API_URL}/messages/${id}?current_user_id=${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessages(res.data.reverse());
    } catch (error) {
      console.error("Erreur messages:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    const init = async () => {
      const user = await getUserDetails();
      if (user?.id) {
        setCurrentUserId(user.id);
        setCurrentUserRole(user.role);
        await markAsRead(user.id);
        await fetchMessages(user.id);
        interval = setInterval(() => {
          fetchMessages(user.id);
          markAsRead(user.id); 
        }, 3000);
      }
    };
    init();
    return () => clearInterval(interval);
  }, [id]);

  const sendMessage = async () => {
    if (!inputText.trim() || !currentUserId) return;
    const optimisticMsg = {
      id: Math.random(),
      sender_id: currentUserId,
      content: inputText.trim(),
      timestamp: new Date().toISOString()
    };
    setMessages((prev) => [optimisticMsg, ...prev]);
    setInputText('');
    try {
      const token = await getToken();
      await axios.post(`${API_URL}/messages?current_user_id=${currentUserId}`, {
        receiver_id: Number(id),
        content: optimisticMsg.content
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (error) {
      console.error("Erreur envoi message:", error);
    }
  };

  const handleProfileNavigation = () => {
    const path = currentUserRole === 'client' ? "/clients/coach-public-profile" : "/coachs/client-details";
    router.push({ pathname: path as any, params: { [currentUserRole === 'client' ? 'coachId' : 'clientId']: id } });
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isMe = item.sender_id === currentUserId;
    return (
      <View style={[styles.messageBubble, isMe ? styles.myMessage : styles.theirMessage]}>
        <Text style={styles.messageText}>{item.content}</Text>
        <Text style={[styles.timeText, { alignSelf: isMe ? 'flex-end' : 'flex-start' }]}>
          {formatTime(item.timestamp)}
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={styles.avoidingView} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      // 🔥 Valeur négative pour supprimer les derniers pixels de décalage
      keyboardVerticalOffset={Platform.OS === 'ios' ? -20 : 0}
    >
      <View style={styles.mainContainer}>
        {/* Header avec padding dynamique pour l'encoche iPhone */}
        <View style={[styles.header, { paddingTop: insets.top + 5 }]}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 5 }}>
            <Ionicons name="arrow-back" size={28} color="#3498DB" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleProfileNavigation} style={{ alignItems: 'center' }}>
            <Text style={styles.headerTitle}>{name || "Chat"}</Text>
            <Text style={styles.headerSubtitle}>Tap to view profile</Text>
          </TouchableOpacity>
          <View style={{ width: 38 }} />
        </View>

        <View style={styles.listContainer}>
          {loading ? (
            <ActivityIndicator size="large" color="#3498DB" style={{ flex: 1 }} />
          ) : (
            <FlatList
              data={messages}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderMessage}
              inverted 
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
            />
          )}
        </View>
      </View>

      <View style={[styles.inputContainer, { paddingBottom: insets.bottom > 0 ? insets.bottom : 12 }]}>
        <TextInput
          style={styles.textInput}
          placeholder="Message..."
          placeholderTextColor="#8A8D91"
          value={inputText}
          onChangeText={setInputText}
          multiline={false}
          returnKeyType="send"
          onSubmitEditing={sendMessage}
        />
        <TouchableOpacity 
          style={styles.sendButton} 
          onPress={sendMessage}
          disabled={!inputText.trim()}
        >
          <Ionicons name="send" size={20} color="white" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  avoidingView: { flex: 1, backgroundColor: '#1E2C3D' },
  mainContainer: { flex: 1, backgroundColor: '#1A1F2B' },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 16, 
    paddingBottom: 15,
    borderBottomWidth: 1, 
    borderBottomColor: '#2A4562', 
    backgroundColor: '#1A1F2B'
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: 'white' },
  headerSubtitle: { fontSize: 10, color: '#3498DB' },
  listContainer: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 10 },
  messageBubble: { maxWidth: '80%', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 8, borderRadius: 20, marginVertical: 4 },
  myMessage: { alignSelf: 'flex-end', backgroundColor: '#3498DB', borderBottomRightRadius: 5 },
  theirMessage: { alignSelf: 'flex-start', backgroundColor: '#2A4562', borderBottomLeftRadius: 5 },
  messageText: { color: 'white', fontSize: 16 },
  timeText: { fontSize: 10, color: 'rgba(255, 255, 255, 0.6)', marginTop: 4 },
  inputContainer: { 
    flexDirection: 'row', 
    paddingTop: 12, 
    paddingHorizontal: 12, 
    backgroundColor: '#1E2C3D', 
    alignItems: 'center', 
  },
  textInput: { 
    flex: 1, 
    backgroundColor: '#1A1F2B', 
    color: 'white', 
    borderRadius: 20, 
    paddingHorizontal: 15, 
    height: 40, 
    fontSize: 16 
  },
  sendButton: { 
    backgroundColor: '#3498DB', 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginLeft: 10 
  }
});

export default ChatScreen;