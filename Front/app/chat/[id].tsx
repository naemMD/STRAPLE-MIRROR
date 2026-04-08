import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, Keyboard, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getUserDetails } from '@/services/authStorage';
import api from '@/services/api';

const ChatScreen = () => {
  const { id, name } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const router = useRouter();
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
      await api.put(`/messages/read/${id}?current_user_id=${userId}`);
    } catch (error) {
      console.error("Erreur lecture messages:", error);
    }
  };

  const fetchMessages = async (userId: number) => {
    try {
      const res = await api.get(`/messages/${id}?current_user_id=${userId}`);
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
      await api.post(`/messages?current_user_id=${currentUserId}`, {
        receiver_id: Number(id),
        content: optimisticMsg.content
      });
    } catch (error) {
      console.error("Erreur envoi message:", error);
    }
  };

  const handleProfileNavigation = () => {
    const path = currentUserRole === 'client' ? "/clients/coach-public-profile" : "/coachs/client-details";
    router.push({ pathname: path as any, params: { [currentUserRole === 'client' ? 'coachId' : 'clientId']: id } });
  };

  const parseNotification = (content: string) => {
    try {
      const parsed = JSON.parse(content);
      if (parsed._notification) return parsed;
    } catch {}
    return null;
  };

  const getNotificationIcon = (type: string): string => {
    if (type.startsWith('meal')) return 'restaurant';
    if (type.startsWith('workout')) return 'barbell';
    if (type.startsWith('profile')) return 'person';
    return 'notifications';
  };

  const getNotificationColor = (type: string): string => {
    if (type.startsWith('meal')) return '#2ecc71';
    if (type.startsWith('workout')) return '#3498DB';
    if (type.startsWith('profile')) return '#9b59b6';
    return '#888';
  };

  const getNotificationLabel = (type: string): string => {
    const labels: Record<string, string> = {
      meal_created: 'New Meal',
      meal_updated: 'Meal Updated',
      workout_updated: 'Workout Updated',
      profile_updated: 'Profile Updated',
    };
    return labels[type] || 'Update';
  };

  const handleNotificationPress = (notif: any) => {
    if (currentUserRole === 'coach') {
      const p: any = { clientId: id, initialDate: notif.date || '' };
      if (notif.type?.startsWith('meal')) p.openMeal = 'true';
      router.push({ pathname: '/coachs/client-details' as any, params: p });
    }
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isMe = item.sender_id === currentUserId;
    const notif = parseNotification(item.content);

    if (notif) {
      const nColor = getNotificationColor(notif.type);
      return (
        <TouchableOpacity
          style={styles.notifCard}
          onPress={() => handleNotificationPress(notif)}
          activeOpacity={0.7}
        >
          <View style={[styles.notifIconBox, { backgroundColor: `${nColor}20` }]}>
            <Ionicons name={getNotificationIcon(notif.type) as any} size={22} color={nColor} />
          </View>
          <View style={styles.notifBody}>
            <View style={styles.notifTopRow}>
              <Text style={[styles.notifType, { color: nColor }]}>{getNotificationLabel(notif.type)}</Text>
              <Text style={styles.notifTime}>{formatTime(item.timestamp)}</Text>
            </View>
            <Text style={styles.notifLabel} numberOfLines={2}>{notif.client_name || ''}</Text>
            <Text style={styles.notifDetail} numberOfLines={1}>{notif.label}</Text>
            {currentUserRole === 'coach' && (
              <View style={styles.notifAction}>
                <Text style={[styles.notifActionText, { color: nColor }]}>View in dashboard</Text>
                <Ionicons name="chevron-forward" size={12} color={nColor} />
              </View>
            )}
          </View>
        </TouchableOpacity>
      );
    }

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
  },
  notifCard: { flexDirection: 'row', alignSelf: 'stretch', marginHorizontal: 8, marginVertical: 6, backgroundColor: '#1E2C3D', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  notifIconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  notifBody: { flex: 1 },
  notifTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  notifType: { fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 },
  notifTime: { color: '#555', fontSize: 10 },
  notifLabel: { color: 'white', fontSize: 14, fontWeight: '600' },
  notifDetail: { color: '#888', fontSize: 13, marginTop: 2 },
  notifAction: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  notifActionText: { fontSize: 11, fontWeight: '600' },
});

export default ChatScreen;