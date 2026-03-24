import React, { useEffect, useState, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView, TextInput,
  Modal, KeyboardAvoidingView, Platform, ActivityIndicator, FlatList, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { getToken } from '@/services/authStorage';
import { crossAlert } from '@/services/crossAlert';
import { jwtDecode } from 'jwt-decode';
import { Toast } from 'react-native-toast-message/lib/src/Toast';
import api from '@/services/api';

type Tab = 'all' | 'favorites' | 'mine';
type ViewMode = 'list' | 'detail';

const formatTime = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString();
};

const AuthorName = ({ firstname, lastname, role }: { firstname: string; lastname: string; role: string }) => (
  <Text style={[styles.authorName, role === 'coach' && styles.coachName]}>
    {firstname} {lastname}{role === 'coach' ? ' 🏋️' : ''}
  </Text>
);

const ForumScreen = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [view, setView] = useState<ViewMode>('list');
  const [activeTab, setActiveTab] = useState<Tab>('all');
  const [forums, setForums] = useState<any[]>([]);
  const [currentForum, setCurrentForum] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newStatus, setNewStatus] = useState('public');
  const [creating, setCreating] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editForum, setEditForum] = useState<any>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editStatus, setEditStatus] = useState('public');
  const [saving, setSaving] = useState(false);

  const [newMessage, setNewMessage] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);

  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUserId !== null) {
      setPage(1);
      loadForums(1);
    }
  }, [activeTab, currentUserId]);

  const loadCurrentUser = async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const decoded: any = jwtDecode(token);
      setCurrentUserId(Number(decoded.userId));
    } catch {}
  };

  const loadForums = async (p: number) => {
    setLoading(true);
    try {
      let url = '';
      if (activeTab === 'all') url = `/forums?page=${p}&page_size=15`;
      else if (activeTab === 'favorites') url = `/forums/favorites?page=${p}&page_size=15`;
      else url = `/forums/my-forums?page=${p}&page_size=15`;

      const res = await api.get(url);
      setForums(p === 1 ? res.data.forums : [...forums, ...res.data.forums]);
      setTotalPages(res.data.total_pages);
      setPage(p);
    } catch {
      Toast.show({ type: 'error', text1: 'Failed to load forums' });
    } finally {
      setLoading(false);
    }
  };

  const openForum = async (forumId: number) => {
    setLoadingDetail(true);
    try {
      const res = await api.get(`/forums/${forumId}`);
      setCurrentForum(res.data);
      setView('detail');
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 200);
    } catch {
      Toast.show({ type: 'error', text1: 'Failed to load forum' });
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleCreateForum = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      await api.post(`/forums`, {
        title: newTitle.trim(),
        description: newDescription.trim() || null,
        status: newStatus,
      });
      setShowCreateModal(false);
      setNewTitle('');
      setNewDescription('');
      setNewStatus('public');
      Toast.show({ type: 'success', text1: 'Forum created!' });
      setActiveTab('mine');
    } catch {
      Toast.show({ type: 'error', text1: 'Failed to create forum' });
    } finally {
      setCreating(false);
    }
  };

  const openEditModal = (forum: any) => {
    setEditForum(forum);
    setEditTitle(forum.title);
    setEditDescription(forum.description || '');
    setEditStatus(forum.status);
    setShowEditModal(true);
  };

  const handleEditForum = async () => {
    if (!editForum || !editTitle.trim()) return;
    setSaving(true);
    try {
      await api.patch(`/forums/${editForum.id}`, {
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        status: editStatus,
      });
      setShowEditModal(false);
      Toast.show({ type: 'success', text1: 'Forum updated!' });
      loadForums(1);
    } catch {
      Toast.show({ type: 'error', text1: 'Failed to update forum' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteForum = (forum: any) => {
    crossAlert('Delete Forum', `Delete "${forum.title}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await api.delete(`/forums/${forum.id}`);
            Toast.show({ type: 'success', text1: 'Forum deleted' });
            loadForums(1);
          } catch {
            Toast.show({ type: 'error', text1: 'Failed to delete forum' });
          }
        },
      },
    ]);
  };

  const handleToggleFavorite = async (forum: any) => {
    try {
      const res = await api.post(`/forums/${forum.id}/favorite`, {});
      setForums(prev => prev.map(f =>
        f.id === forum.id ? { ...f, is_favorite: res.data.is_favorite } : f
      ));
      if (activeTab === 'favorites' && !res.data.is_favorite) {
        setForums(prev => prev.filter(f => f.id !== forum.id));
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Failed to toggle favorite' });
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !currentForum) return;
    setSendingMsg(true);
    try {
      const res = await api.post(
        `/forums/${currentForum.id}/messages`,
        { content: newMessage.trim() }
      );
      setCurrentForum((prev: any) => ({
        ...prev,
        messages: [...(prev.messages || []), res.data],
      }));
      setNewMessage('');
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {
      Toast.show({ type: 'error', text1: 'Failed to send message' });
    } finally {
      setSendingMsg(false);
    }
  };

  const confirmDeleteMessage = (messageId: number) => {
    crossAlert('Delete Message', 'Remove this message from the forum?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await api.delete(`/forums/${currentForum.id}/messages/${messageId}`);
            setCurrentForum((prev: any) => ({
              ...prev,
              messages: prev.messages.filter((m: any) => m.id !== messageId),
            }));
          } catch {
            Toast.show({ type: 'error', text1: 'Failed to delete message' });
          }
        },
      },
    ]);
  };

  const navigateToProfile = (userId: number, role: string) => {
    if (role === 'coach') {
      router.push(`/clients/coach-public-profile?coachId=${userId}`);
    }
  };

  // -------------------------------------------------------------------------
  // Detail view
  // -------------------------------------------------------------------------
  if (view === 'detail' && currentForum) {
    const isForumCreator = currentUserId === currentForum.user_id;
    return (
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: '#1A1F2B' }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={[styles.detailHeader, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity onPress={() => setView('list')}>
            <Ionicons name="arrow-back" size={26} color="white" />
          </TouchableOpacity>
          <Text style={styles.detailTitle} numberOfLines={1}>{currentForum.title}</Text>
          <View style={{ width: 26 }} />
        </View>

        {currentForum.description ? (
          <View style={styles.detailDescription}>
            <Text style={styles.descriptionText}>{currentForum.description}</Text>
            <Text style={styles.descriptionMeta}>
              By{' '}
              <Text
                style={[styles.descriptionAuthor, currentForum.author_role === 'coach' && styles.coachName]}
                onPress={() => navigateToProfile(currentForum.user_id, currentForum.author_role)}
              >
                {currentForum.author_firstname} {currentForum.author_lastname}
              </Text>
            </Text>
          </View>
        ) : null}

        <ScrollView
          ref={scrollRef}
          style={styles.messageList}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
          keyboardDismissMode="on-drag"
        >
          {(!currentForum.messages || currentForum.messages.length === 0) && (
            <Text style={styles.emptyMessages}>No messages yet. Be the first!</Text>
          )}
          {currentForum.messages?.map((msg: any) => {
            const isMe = msg.user_id === currentUserId;
            return (
              <View key={msg.id} style={[styles.msgRow, isMe && styles.msgRowMe]}>
                <TouchableOpacity
                  style={[styles.msgAvatar, msg.author_role === 'coach' && styles.msgAvatarCoach]}
                  onPress={() => navigateToProfile(msg.user_id, msg.author_role)}
                >
                  <Text style={styles.msgAvatarText}>{msg.author_firstname?.[0]}</Text>
                </TouchableOpacity>
                <View style={[styles.msgBubble, isMe && styles.msgBubbleMe]}>
                  {!isMe && (
                    <TouchableOpacity onPress={() => navigateToProfile(msg.user_id, msg.author_role)}>
                      <AuthorName
                        firstname={msg.author_firstname}
                        lastname={msg.author_lastname}
                        role={msg.author_role}
                      />
                    </TouchableOpacity>
                  )}
                  <Text style={styles.msgContent}>{msg.content}</Text>
                  <View style={styles.msgBubbleFooter}>
                    <Text style={styles.msgTime}>{formatTime(msg.created_at)}</Text>
                    {isForumCreator && (
                      <TouchableOpacity onPress={() => confirmDeleteMessage(msg.id)} style={styles.deleteMsgBtn}>
                        <Ionicons name="trash-outline" size={12} color="rgba(231,76,60,0.75)" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>

        <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
          <TextInput
            style={styles.messageInput}
            placeholder="Write a message..."
            placeholderTextColor="#8A8D91"
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!newMessage.trim() || sendingMsg) && { opacity: 0.5 }]}
            onPress={handleSendMessage}
            disabled={!newMessage.trim() || sendingMsg}
          >
            {sendingMsg
              ? <ActivityIndicator size="small" color="white" />
              : <Ionicons name="send" size={20} color="white" />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // -------------------------------------------------------------------------
  // List view
  // -------------------------------------------------------------------------
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.tabBar}>
        {(['all', 'favorites', 'mine'] as Tab[]).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'all' ? 'All' : tab === 'favorites' ? '⭐ Favorites' : 'My Forums'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && page === 1 ? (
        <ActivityIndicator size="large" color="#3498DB" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={forums}
          keyboardDismissMode="on-drag"
          keyExtractor={item => String(item.id)}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={
            <Text style={styles.emptyList}>
              {activeTab === 'all'
                ? 'No public forums yet.'
                : activeTab === 'favorites'
                ? 'No favorites yet.'
                : "You haven't created any forums yet."}
            </Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.forumCard} onPress={() => openForum(item.id)} activeOpacity={0.85}>
              <View style={styles.forumCardHeader}>
                <TouchableOpacity
                  style={[styles.cardAvatar, item.author_role === 'coach' && styles.cardAvatarCoach]}
                  onPress={() => navigateToProfile(item.user_id, item.author_role)}
                >
                  <Text style={styles.cardAvatarText}>{item.author_firstname?.[0]}</Text>
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <TouchableOpacity onPress={() => navigateToProfile(item.user_id, item.author_role)}>
                    <AuthorName
                      firstname={item.author_firstname}
                      lastname={item.author_lastname}
                      role={item.author_role}
                    />
                  </TouchableOpacity>
                  <Text style={styles.forumTime}>{formatTime(item.last_activity_at)}</Text>
                </View>
                {item.user_id === currentUserId && (
                  <TouchableOpacity
                    style={styles.mineActionBtn}
                    onPress={() => crossAlert(
                      item.title,
                      undefined,
                      [
                        { text: 'Edit', onPress: () => openEditModal(item) },
                        { text: 'Delete', style: 'destructive', onPress: () => handleDeleteForum(item) },
                        { text: 'Cancel', style: 'cancel' },
                      ]
                    )}
                  >
                    <Ionicons name="ellipsis-vertical" size={18} color="#8A8D91" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => handleToggleFavorite(item)} style={styles.starBtn}>
                  <Ionicons
                    name={item.is_favorite ? 'star' : 'star-outline'}
                    size={20}
                    color={item.is_favorite ? '#FFD700' : '#8A8D91'}
                  />
                </TouchableOpacity>
              </View>

              <Text style={styles.forumTitle}>{item.title}</Text>
              {item.description ? (
                <Text style={styles.forumDescription} numberOfLines={2}>{item.description}</Text>
              ) : null}

              <View style={styles.forumFooter}>
                <View style={styles.forumMeta}>
                  <Ionicons name="chatbubble-outline" size={14} color="#8A8D91" />
                  <Text style={styles.forumMetaText}>{item.message_count} messages</Text>
                </View>
                {item.status !== 'public' && (
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusBadgeText}>{item.status}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          )}
          ListFooterComponent={
            page < totalPages ? (
              <TouchableOpacity style={styles.loadMoreBtn} onPress={() => loadForums(page + 1)} disabled={loading}>
                {loading
                  ? <ActivityIndicator size="small" color="#3498DB" />
                  : <Text style={styles.loadMoreText}>Load more</Text>}
              </TouchableOpacity>
            ) : null
          }
        />
      )}

      {loadingDetail && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#3498DB" />
        </View>
      )}

      <TouchableOpacity
        style={[styles.createBtn, { marginBottom: insets.bottom + 10 }]}
        onPress={() => setShowCreateModal(true)}
      >
        <Ionicons name="add" size={22} color="#2A4562" />
        <Text style={styles.createBtnText}>New Forum</Text>
      </TouchableOpacity>

      {/* Create modal */}
      <Modal visible={showCreateModal} animationType="slide" transparent>
        <Pressable style={styles.modalOverlay} onPress={() => setShowCreateModal(false)}>
        <KeyboardAvoidingView style={{width: '100%'}} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Create a Forum</Text>

            <Text style={styles.inputLabel}>Title <Text style={styles.charCount}>({newTitle.length}/80)</Text></Text>
            <TextInput
              style={styles.textInput}
              placeholder="Forum title..."
              placeholderTextColor="#8A8D91"
              value={newTitle}
              onChangeText={t => setNewTitle(t.slice(0, 80))}
            />

            <Text style={styles.inputLabel}>Description <Text style={styles.charCount}>({newDescription.length}/500)</Text></Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="Optional description..."
              placeholderTextColor="#8A8D91"
              value={newDescription}
              onChangeText={t => setNewDescription(t.slice(0, 500))}
              multiline
            />

            <Text style={styles.inputLabel}>Visibility</Text>
            <View style={styles.statusRow}>
              {['public', 'private', 'draft'].map(s => (
                <TouchableOpacity
                  key={s}
                  style={[styles.statusOption, newStatus === s && styles.statusOptionActive]}
                  onPress={() => setNewStatus(s)}
                >
                  <Text style={[styles.statusOptionText, newStatus === s && styles.statusOptionTextActive]}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowCreateModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, (!newTitle.trim() || creating) && { opacity: 0.5 }]}
                onPress={handleCreateForum}
                disabled={!newTitle.trim() || creating}
              >
                {creating
                  ? <ActivityIndicator size="small" color="white" />
                  : <Text style={styles.modalConfirmText}>Create</Text>}
              </TouchableOpacity>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {/* Edit modal */}
      <Modal visible={showEditModal} animationType="slide" transparent>
        <Pressable style={styles.modalOverlay} onPress={() => setShowEditModal(false)}>
        <KeyboardAvoidingView style={{width: '100%'}} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Edit Forum</Text>

            <Text style={styles.inputLabel}>Title <Text style={styles.charCount}>({editTitle.length}/80)</Text></Text>
            <TextInput
              style={styles.textInput}
              value={editTitle}
              onChangeText={t => setEditTitle(t.slice(0, 80))}
              placeholderTextColor="#8A8D91"
            />

            <Text style={styles.inputLabel}>Description <Text style={styles.charCount}>({editDescription.length}/500)</Text></Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={editDescription}
              onChangeText={t => setEditDescription(t.slice(0, 500))}
              placeholderTextColor="#8A8D91"
              multiline
            />

            <Text style={styles.inputLabel}>Visibility</Text>
            <View style={styles.statusRow}>
              {['public', 'private', 'draft'].map(s => (
                <TouchableOpacity
                  key={s}
                  style={[styles.statusOption, editStatus === s && styles.statusOptionActive]}
                  onPress={() => setEditStatus(s)}
                >
                  <Text style={[styles.statusOptionText, editStatus === s && styles.statusOptionTextActive]}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowEditModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, (!editTitle.trim() || saving) && { opacity: 0.5 }]}
                onPress={handleEditForum}
                disabled={!editTitle.trim() || saving}
              >
                {saving
                  ? <ActivityIndicator size="small" color="white" />
                  : <Text style={styles.modalConfirmText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A1F2B' },

  tabBar: { flexDirection: 'row', backgroundColor: '#161B22', borderBottomWidth: 1, borderBottomColor: '#222' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#3498DB' },
  tabText: { color: '#8A8D91', fontSize: 13, fontWeight: '500' },
  tabTextActive: { color: '#3498DB' },

  forumCard: { backgroundColor: '#2A4562', borderRadius: 12, padding: 14, marginBottom: 12 },
  forumCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  cardAvatar: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#3498DB', justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  cardAvatarCoach: { backgroundColor: '#B8860B' },
  cardAvatarText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
  authorName: { color: '#ccc', fontSize: 13, fontWeight: '600' },
  coachName: { color: '#FFD700' },
  forumTime: { color: '#8A8D91', fontSize: 11, marginTop: 1 },
  starBtn: { padding: 4 },
  forumTitle: { color: 'white', fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  forumDescription: { color: '#aaa', fontSize: 13, lineHeight: 18, marginBottom: 8 },
  forumFooter: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  forumMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  forumMetaText: { color: '#8A8D91', fontSize: 12 },
  statusBadge: { backgroundColor: '#1A1F2B', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusBadgeText: { color: '#8A8D91', fontSize: 11 },
  mineActions: { flexDirection: 'row', gap: 8, marginLeft: 'auto' as any },
  mineActionBtn: { padding: 4 },

  emptyList: { color: '#8A8D91', textAlign: 'center', marginTop: 60, fontSize: 15 },
  loadMoreBtn: { alignItems: 'center', paddingVertical: 16 },
  loadMoreText: { color: '#3498DB', fontSize: 14 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center',
  },
  createBtn: {
    flexDirection: 'row', backgroundColor: 'white', marginHorizontal: 16,
    borderRadius: 12, paddingVertical: 13, justifyContent: 'center', alignItems: 'center', gap: 8,
  },
  createBtnText: { color: '#2A4562', fontWeight: 'bold', fontSize: 15 },

  detailHeader: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: '#161B22', borderBottomWidth: 1, borderBottomColor: '#222', gap: 12,
  },
  detailTitle: { flex: 1, color: 'white', fontSize: 17, fontWeight: 'bold' },
  detailDescription: {
    backgroundColor: '#2A4562', padding: 14,
    marginHorizontal: 16, marginTop: 10, borderRadius: 10,
  },
  descriptionText: { color: '#ddd', fontSize: 14, lineHeight: 20 },
  descriptionMeta: { color: '#8A8D91', fontSize: 12, marginTop: 6 },
  descriptionAuthor: { color: '#ccc', fontWeight: '600' },
  messageList: { flex: 1 },
  emptyMessages: { color: '#8A8D91', textAlign: 'center', marginTop: 40, fontSize: 14 },

  msgRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 12 },
  msgRowMe: { flexDirection: 'row-reverse' },
  msgAvatar: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#3498DB', justifyContent: 'center', alignItems: 'center', marginHorizontal: 6,
  },
  msgAvatarCoach: { backgroundColor: '#B8860B' },
  msgAvatarText: { color: 'white', fontWeight: 'bold', fontSize: 12 },
  msgBubble: {
    maxWidth: '72%', backgroundColor: '#2A4562',
    borderRadius: 14, borderBottomLeftRadius: 4, padding: 10,
  },
  msgBubbleMe: { backgroundColor: '#1B4F8A', borderBottomLeftRadius: 14, borderBottomRightRadius: 4 },
  msgContent: { color: 'white', fontSize: 14, lineHeight: 20 },
  msgBubbleFooter: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 4, gap: 8 },
  msgTime: { color: '#8A8D91', fontSize: 10 },
  deleteMsgBtn: { padding: 2 },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingTop: 8,
    backgroundColor: '#161B22', borderTopWidth: 1, borderTopColor: '#222', gap: 8,
  },
  messageInput: {
    flex: 1, backgroundColor: '#2A4562', borderRadius: 20, paddingHorizontal: 14,
    paddingVertical: 9, color: 'white', fontSize: 14, maxHeight: 100,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#3498DB', justifyContent: 'center', alignItems: 'center',
  },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: '#1A1F2B',
    borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24,
  },
  modalTitle: { color: 'white', fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  inputLabel: { color: '#ccc', fontSize: 13, marginBottom: 6, marginTop: 10 },
  charCount: { color: '#8A8D91', fontSize: 11 },
  textInput: {
    backgroundColor: '#2A4562', color: 'white', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 14,
  },
  textArea: { height: 90, textAlignVertical: 'top' },
  statusRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  statusOption: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    backgroundColor: '#2A4562', alignItems: 'center',
  },
  statusOptionActive: { backgroundColor: '#3498DB' },
  statusOptionText: { color: '#8A8D91', fontWeight: '600', fontSize: 13 },
  statusOptionTextActive: { color: 'white' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  modalCancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    backgroundColor: '#2A4562', alignItems: 'center',
  },
  modalCancelText: { color: '#ccc', fontWeight: 'bold', fontSize: 15 },
  modalConfirmBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    backgroundColor: '#3498DB', alignItems: 'center',
  },
  modalConfirmText: { color: 'white', fontWeight: 'bold', fontSize: 15 },
});

export default ForumScreen;
