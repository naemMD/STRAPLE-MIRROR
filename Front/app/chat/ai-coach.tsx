import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '@/services/api';

interface ChatMessage {
  id: number | string;
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
  pending?: boolean;
}

const AiCoachScreen = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const res = await api.get('/ai-coach/history');
      setMessages(res.data.reverse());
    } catch (error) {
      console.error('Error loading AI chat history:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim() || sending) return;

    const userMessage = inputText.trim();
    setInputText('');

    // Optimistic user message
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: ChatMessage = {
      id: tempId,
      role: 'user',
      content: userMessage,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [optimisticMsg, ...prev]);

    // Show typing indicator
    setSending(true);

    try {
      const res = await api.post('/ai-coach/chat', { message: userMessage });
      const aiResponse: ChatMessage = {
        id: res.data.message_id,
        role: 'assistant',
        content: res.data.response,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [aiResponse, ...prev]);
    } catch (error) {
      console.error('Error sending message to AI coach:', error);
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: "Sorry, I couldn't respond. Please check your connection and try again.",
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [errorMsg, ...prev]);
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.messageBubble, isUser ? styles.userMessage : styles.aiMessage]}>
        {!isUser && (
          <View style={styles.aiBadge}>
            <Ionicons name="sparkles" size={12} color="#F39C12" />
            <Text style={styles.aiBadgeText}>NutriCoach AI</Text>
          </View>
        )}
        <Text style={styles.messageText}>{item.content}</Text>
        <Text style={[styles.timeText, { alignSelf: isUser ? 'flex-end' : 'flex-start' }]}>
          {formatTime(item.created_at)}
        </Text>
      </View>
    );
  };

  const renderTypingIndicator = () => {
    if (!sending) return null;
    return (
      <View style={[styles.messageBubble, styles.aiMessage, { paddingVertical: 14 }]}>
        <View style={styles.aiBadge}>
          <Ionicons name="sparkles" size={12} color="#F39C12" />
          <Text style={styles.aiBadgeText}>NutriCoach AI</Text>
        </View>
        <View style={styles.typingRow}>
          <ActivityIndicator size="small" color="#F39C12" />
          <Text style={styles.typingText}>Thinking...</Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.avoidingView}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? -20 : 0}
    >
      <View style={styles.mainContainer}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 5 }]}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 5 }}>
            <Ionicons name="arrow-back" size={28} color="#F39C12" />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="sparkles" size={18} color="#F39C12" style={{ marginRight: 6 }} />
              <Text style={styles.headerTitle}>Coach IA</Text>
            </View>
            <Text style={styles.headerSubtitle}>Nutrition & Fitness Assistant</Text>
          </View>
          <View style={{ width: 38 }} />
        </View>

        {/* Messages */}
        <View style={styles.listContainer}>
          {loading ? (
            <ActivityIndicator size="large" color="#F39C12" style={{ flex: 1 }} />
          ) : (
            <>
              {messages.length === 0 && !sending && (
                <View style={styles.emptyState}>
                  <Ionicons name="sparkles" size={60} color="#F39C12" />
                  <Text style={styles.emptyTitle}>Welcome!</Text>
                  <Text style={styles.emptyText}>
                    I'm your NutriTrain AI Coach.{'\n'}
                    Ask me anything about nutrition,{'\n'}
                    training, or get personalized advice!
                  </Text>
                  <View style={styles.suggestionsContainer}>
                    {[
                      'How much protein should I eat daily?',
                      'Best pre-workout breakfast ideas?',
                      'How can I improve my recovery?',
                    ].map((suggestion, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={styles.suggestionChip}
                        onPress={() => {
                          setInputText(suggestion);
                        }}
                      >
                        <Text style={styles.suggestionText}>{suggestion}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
              <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderMessage}
                inverted
                ListHeaderComponent={renderTypingIndicator}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                keyboardDismissMode="on-drag"
                keyboardShouldPersistTaps="handled"
              />
            </>
          )}
        </View>
      </View>

      {/* Input */}
      <View style={[styles.inputContainer, { paddingBottom: insets.bottom > 0 ? insets.bottom : 12 }]}>
        <TextInput
          style={styles.textInput}
          placeholder="Ask a question..."
          placeholderTextColor="#8A8D91"
          value={inputText}
          onChangeText={setInputText}
          multiline={false}
          returnKeyType="send"
          onSubmitEditing={sendMessage}
          editable={!sending}
        />
        <TouchableOpacity
          style={[styles.sendButton, sending && { opacity: 0.5 }]}
          onPress={sendMessage}
          disabled={!inputText.trim() || sending}
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
    backgroundColor: '#1A1F2B',
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: 'white' },
  headerSubtitle: { fontSize: 10, color: '#F39C12' },
  listContainer: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 10 },

  messageBubble: {
    maxWidth: '85%',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
    borderRadius: 20,
    marginVertical: 4,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#3498DB',
    borderBottomRightRadius: 5,
  },
  aiMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#232D3F',
    borderBottomLeftRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(243, 156, 18, 0.2)',
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  aiBadgeText: {
    fontSize: 10,
    color: '#F39C12',
    fontWeight: 'bold',
    marginLeft: 4,
  },
  messageText: { color: 'white', fontSize: 16, lineHeight: 22 },
  timeText: { fontSize: 10, color: 'rgba(255, 255, 255, 0.6)', marginTop: 4 },

  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typingText: { color: '#F39C12', fontSize: 14, fontStyle: 'italic' },

  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: 30,
  },
  emptyTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    color: '#8A8D91',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  suggestionsContainer: { gap: 10, width: '100%' },
  suggestionChip: {
    backgroundColor: '#232D3F',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: 'rgba(243, 156, 18, 0.3)',
  },
  suggestionText: { color: '#F39C12', fontSize: 14, textAlign: 'center' },

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
    fontSize: 16,
  },
  sendButton: {
    backgroundColor: '#F39C12',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
});

export default AiCoachScreen;
