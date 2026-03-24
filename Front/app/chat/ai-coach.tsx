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
  Modal,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '@/services/api';

let SecureStore: any = null;
if (Platform.OS !== 'web') {
  SecureStore = require('expo-secure-store');
}

const storageGet = async (key: string) => {
  if (Platform.OS === 'web') return localStorage.getItem(key);
  return await SecureStore.getItemAsync(key);
};

const storageSet = async (key: string, value: string) => {
  if (Platform.OS === 'web') { localStorage.setItem(key, value); return; }
  await SecureStore.setItemAsync(key, value);
};

const STORAGE_KEY_NAME = 'ai_coach_name';
const STORAGE_KEY_COLOR = 'ai_coach_color';

const DEFAULT_NAME = 'AI Coach';
const DEFAULT_COLOR = '#F39C12';
const MESSAGE_MAX_LENGTH = 500;
const DAILY_MESSAGE_LIMIT = 15;

const COLOR_OPTIONS = [
  '#F39C12', // Gold
  '#3498DB', // Blue
  '#2ECC71', // Green
  '#E74C3C', // Red
  '#9B59B6', // Purple
  '#1ABC9C', // Teal
  '#E91E63', // Pink
  '#FF5722', // Deep Orange
];

interface ChatMessage {
  id: number | string;
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
}

const AiCoachScreen = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Limits
  const [remainingMessages, setRemainingMessages] = useState(DAILY_MESSAGE_LIMIT);

  // Customization state
  const [coachName, setCoachName] = useState(DEFAULT_NAME);
  const [accentColor, setAccentColor] = useState(DEFAULT_COLOR);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    loadPreferences();
    loadHistory();
    loadRemaining();
  }, []);

  const loadPreferences = async () => {
    try {
      const savedName = await storageGet(STORAGE_KEY_NAME);
      const savedColor = await storageGet(STORAGE_KEY_COLOR);
      if (savedName) setCoachName(savedName);
      if (savedColor) setAccentColor(savedColor);
    } catch (e) {
      // use defaults
    }
  };

  const savePreferences = async (name: string, color: string) => {
    setCoachName(name);
    setAccentColor(color);
    await storageSet(STORAGE_KEY_NAME, name);
    await storageSet(STORAGE_KEY_COLOR, color);
  };

  const openSettings = () => {
    setEditName(coachName);
    setSettingsVisible(true);
  };

  const loadRemaining = async () => {
    try {
      const res = await api.get('/ai-coach/remaining');
      setRemainingMessages(res.data.remaining);
    } catch (e) {}
  };

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
    if (!inputText.trim() || sending || remainingMessages <= 0) return;

    const userMessage = inputText.trim().slice(0, MESSAGE_MAX_LENGTH);
    setInputText('');

    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: ChatMessage = {
      id: tempId,
      role: 'user',
      content: userMessage,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [optimisticMsg, ...prev]);
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
      setRemainingMessages(res.data.remaining_messages);
    } catch (error: any) {
      console.error('Error sending message to AI coach:', error);
      const is429 = error?.response?.status === 429;
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: is429
          ? "You've reached your daily message limit. Come back tomorrow!"
          : "Sorry, I couldn't respond. Please check your connection and try again.",
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [errorMsg, ...prev]);
      if (is429) setRemainingMessages(0);
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
      <View style={[styles.messageBubble, isUser ? styles.userMessage : [styles.aiMessage, { borderColor: accentColor + '33' }]]}>
        {!isUser && (
          <View style={styles.aiBadge}>
            <Ionicons name="sparkles" size={12} color={accentColor} />
            <Text style={[styles.aiBadgeText, { color: accentColor }]}>{coachName}</Text>
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
      <View style={[styles.messageBubble, styles.aiMessage, { paddingVertical: 14, borderColor: accentColor + '33' }]}>
        <View style={styles.aiBadge}>
          <Ionicons name="sparkles" size={12} color={accentColor} />
          <Text style={[styles.aiBadgeText, { color: accentColor }]}>{coachName}</Text>
        </View>
        <View style={styles.typingRow}>
          <ActivityIndicator size="small" color={accentColor} />
          <Text style={[styles.typingText, { color: accentColor }]}>Thinking...</Text>
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
            <Ionicons name="arrow-back" size={28} color={accentColor} />
          </TouchableOpacity>
          <TouchableOpacity onPress={openSettings} style={{ alignItems: 'center' }}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="sparkles" size={18} color={accentColor} style={{ marginRight: 6 }} />
              <Text style={styles.headerTitle}>{coachName}</Text>
              <Ionicons name="create-outline" size={14} color="#8A8D91" style={{ marginLeft: 6 }} />
            </View>
            <Text style={[styles.headerSubtitle, { color: accentColor }]}>Tap to customize</Text>
          </TouchableOpacity>
          <View style={{ width: 38 }} />
        </View>

        {/* Messages */}
        <View style={styles.listContainer}>
          {loading ? (
            <ActivityIndicator size="large" color={accentColor} style={{ flex: 1 }} />
          ) : (
            <>
              {messages.length === 0 && !sending && (
                <View style={styles.emptyState}>
                  <Ionicons name="sparkles" size={60} color={accentColor} />
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
                        style={[styles.suggestionChip, { borderColor: accentColor + '4D' }]}
                        onPress={() => setInputText(suggestion)}
                      >
                        <Text style={[styles.suggestionText, { color: accentColor }]}>{suggestion}</Text>
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
      <View style={[styles.inputWrapper, { paddingBottom: insets.bottom > 0 ? insets.bottom : 12 }]}>
        <View style={styles.inputMeta}>
          <Text style={[styles.charCount, inputText.length > MESSAGE_MAX_LENGTH * 0.9 && { color: '#E74C3C' }]}>
            {inputText.length}/{MESSAGE_MAX_LENGTH}
          </Text>
          <Text style={[styles.dailyCount, remainingMessages <= 3 && { color: '#E74C3C' }]}>
            {remainingMessages}/{DAILY_MESSAGE_LIMIT} messages left today
          </Text>
        </View>
        {remainingMessages <= 0 ? (
          <View style={styles.limitReached}>
            <Ionicons name="time-outline" size={18} color="#E74C3C" />
            <Text style={styles.limitReachedText}>Daily limit reached — come back tomorrow!</Text>
          </View>
        ) : (
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              placeholder="Ask a question..."
              placeholderTextColor="#8A8D91"
              value={inputText}
              onChangeText={(t) => setInputText(t.slice(0, MESSAGE_MAX_LENGTH))}
              multiline={false}
              returnKeyType="send"
              onSubmitEditing={sendMessage}
              editable={!sending}
              maxLength={MESSAGE_MAX_LENGTH}
            />
            <TouchableOpacity
              style={[styles.sendButton, { backgroundColor: accentColor }, (sending || !inputText.trim()) && { opacity: 0.5 }]}
              onPress={sendMessage}
              disabled={!inputText.trim() || sending}
            >
              <Ionicons name="send" size={20} color="white" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Settings Modal */}
      <Modal visible={settingsVisible} transparent animationType="fade">
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setSettingsVisible(false)}
        >
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Customize your AI Coach</Text>

            {/* Name */}
            <Text style={styles.modalLabel}>Name</Text>
            <TextInput
              style={styles.modalInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Enter a name..."
              placeholderTextColor="#8A8D91"
              maxLength={24}
            />

            {/* Color */}
            <Text style={[styles.modalLabel, { marginTop: 20 }]}>Accent color</Text>
            <View style={styles.colorGrid}>
              {COLOR_OPTIONS.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorCircle,
                    { backgroundColor: color },
                    accentColor === color && styles.colorCircleSelected,
                  ]}
                  onPress={() => setAccentColor(color)}
                >
                  {accentColor === color && (
                    <Ionicons name="checkmark" size={18} color="white" />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Save */}
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: accentColor }]}
              onPress={() => {
                const finalName = editName.trim() || DEFAULT_NAME;
                savePreferences(finalName, accentColor);
                setSettingsVisible(false);
              }}
            >
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
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
  headerSubtitle: { fontSize: 10 },
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
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  aiBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  messageText: { color: 'white', fontSize: 16, lineHeight: 22 },
  timeText: { fontSize: 10, color: 'rgba(255, 255, 255, 0.6)', marginTop: 4 },

  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typingText: { fontSize: 14, fontStyle: 'italic' },

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
  },
  suggestionText: { fontSize: 14, textAlign: 'center' },

  inputWrapper: {
    backgroundColor: '#1E2C3D',
    paddingHorizontal: 12,
  },
  inputMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  charCount: {
    fontSize: 11,
    color: '#8A8D91',
  },
  dailyCount: {
    fontSize: 11,
    color: '#8A8D91',
  },
  limitReached: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  limitReachedText: {
    color: '#E74C3C',
    fontSize: 14,
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    paddingBottom: 4,
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
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },

  // Settings modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1E2C3D',
    borderRadius: 20,
    padding: 24,
    width: '85%',
    maxWidth: 400,
  },
  modalTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalLabel: {
    color: '#8A8D91',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: '#1A1F2B',
    color: 'white',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#2A4562',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  colorCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorCircleSelected: {
    borderWidth: 3,
    borderColor: 'white',
  },
  saveButton: {
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default AiCoachScreen;
