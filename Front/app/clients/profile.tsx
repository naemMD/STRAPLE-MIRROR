import React, { useEffect, useState } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView, ActivityIndicator,
  Modal, TextInput, KeyboardAvoidingView, Platform, Pressable
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getUserDetails } from '@/services/authStorage';
import api from '@/services/api';
import { crossAlert } from '@/services/crossAlert';
import { copyToClipboard } from '@/services/crossClipboard';
import Toast from 'react-native-toast-message';

const GOAL_OPTIONS = [
  { key: 'lose_weight', label: 'Weight Loss', color: '#E74C3C' },
  { key: 'gain_muscle', label: 'Muscle Gain', color: '#2ECC71' },
  { key: 'maintain_weight', label: 'Maintain', color: '#F1C40F' },
];

const ProfileScreen = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit form state
  const [editFirstname, setEditFirstname] = useState('');
  const [editLastname, setEditLastname] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAge, setEditAge] = useState('');
  const [editWeight, setEditWeight] = useState('');
  const [editHeight, setEditHeight] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editGoal, setEditGoal] = useState('');

  const goalConfig: { [key: string]: { label: string; color: string } } = {
    'lose_weight': { label: 'Weight Loss', color: '#E74C3C' },
    'gain_muscle': { label: 'Muscle Gain', color: '#2ECC71' },
    'maintain_weight': { label: 'Maintain', color: '#F1C40F' },
  };

  const loadData = async () => {
    try {
      const session = await getUserDetails();
      if (session?.id) {
        const response = await api.get(`/users/me/${session.id}`);
        setUser(response.data);
      }
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleCopy = async () => {
    if (user?.unique_code) {
      await copyToClipboard(user.unique_code);
      crossAlert("Copied!", "Your identification code is ready to be sent to your coach.");
    }
  };

  const openEditModal = () => {
    setEditFirstname(user?.firstname || '');
    setEditLastname(user?.lastname || '');
    setEditEmail(user?.email || '');
    setEditAge(user?.age ? String(user.age) : '');
    setEditWeight(user?.weight ? String(user.weight) : '');
    setEditHeight(user?.height ? String(user.height) : '');
    setEditCity(user?.city || '');
    setEditGoal(user?.goal || '');
    setIsEditModalVisible(true);
  };

  const handleSaveProfile = async () => {
    if (!editFirstname.trim() || !editLastname.trim() || !editEmail.trim()) {
      return crossAlert("Error", "First name, last name and email are required.");
    }
    setSaving(true);
    try {
      const payload: any = {
        firstname: editFirstname.trim(),
        lastname: editLastname.trim(),
        email: editEmail.trim(),
      };
      if (editAge) payload.age = parseInt(editAge);
      if (editWeight) payload.weight = parseFloat(editWeight);
      if (editHeight) payload.height = parseFloat(editHeight);
      if (editCity) payload.city = editCity.trim();
      if (editGoal) payload.goal = editGoal;

      await api.patch('/users/me/profile', payload);
      if (user?.coach_id) {
        const changes = [];
        if (editWeight && parseFloat(editWeight) !== user.weight) changes.push(`Weight: ${editWeight}kg`);
        if (editHeight && parseFloat(editHeight) !== user.height) changes.push(`Height: ${editHeight}cm`);
        if (editGoal && editGoal !== user.goal) changes.push(`Goal: ${editGoal.replace('_', ' ')}`);
        const label = changes.length > 0 ? changes.join(', ') : 'Profile updated';
        try {
          await api.post('/messages/notify-coach', { type: 'profile_updated', label });
        } catch (e) { console.log('Notify coach error:', e); }
      }
      Toast.show({ type: 'success', text1: 'Profile updated!' });
      setIsEditModalVisible(false);
      loadData();
    } catch (error: any) {
      const msg = error.response?.data?.detail || "Could not update profile.";
      Toast.show({ type: 'error', text1: 'Error', text2: msg });
    } finally {
      setSaving(false);
    }
  };

  const userGoalKey = user?.goal ? String(user.goal).toLowerCase() : '';
  const currentGoal = goalConfig[userGoalKey] || {
    label: user?.goal ? String(user.goal).replace('_', ' ') : 'Not specified',
    color: '#3498DB'
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color="#3498DB" />
      </View>
    );
  }

  return (
    <View style={{flex: 1, backgroundColor: '#1A1F2B'}}>
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false} keyboardDismissMode="on-drag">
      <View style={styles.headerCard}>
        <View style={styles.avatarLarge}>
          <Text style={styles.avatarText}>{user?.firstname?.[0]}</Text>
        </View>
        <Text style={styles.userName}>{user?.firstname} {user?.lastname}</Text>
        <Text style={styles.userSub}>{user?.email}</Text>
        {user?.city && <Text style={styles.userCity}>{user.city}</Text>}

        <TouchableOpacity style={styles.editBtn} onPress={openEditModal}>
          <Ionicons name="create-outline" size={16} color="white" />
          <Text style={styles.editBtnText}>Edit Profile</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Coaching Connection</Text>
      <View style={styles.card}>
        <Text style={styles.cardInfo}>Share this code with your coach to link your accounts:</Text>
        <TouchableOpacity style={styles.codeContainer} onPress={handleCopy}>
          <View>
            <Text style={styles.codeLabel}>My Unique Code</Text>
            <Text style={styles.codeValue}>{user?.unique_code || "---"}</Text>
          </View>
          <Ionicons name="copy-outline" size={24} color="#3498DB" />
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Body Metrics</Text>
      <View style={styles.metricsRow}>
        <View style={styles.metricCard}>
          <Ionicons name="man-outline" size={20} color="#3498DB" />
          <Text style={styles.metricValue}>{user?.height || '--'} cm</Text>
          <Text style={styles.metricLabel}>Height</Text>
        </View>
        <View style={styles.metricCard}>
          <Ionicons name="speedometer-outline" size={20} color="#3498DB" />
          <Text style={styles.metricValue}>{user?.weight || '--'} kg</Text>
          <Text style={styles.metricLabel}>Weight</Text>
        </View>
        <View style={styles.metricCard}>
          <Ionicons name="calendar-outline" size={20} color="#3498DB" />
          <Text style={styles.metricValue}>{user?.age || '--'}</Text>
          <Text style={styles.metricLabel}>Age</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Personal Goal</Text>
      <View style={styles.card}>
        <View style={styles.goalItem}>
          <View>
            <Text style={styles.goalSub}>Primary objective</Text>
            <Text style={[styles.goalText, { color: currentGoal.color, textTransform: 'capitalize' }]}>
              {currentGoal.label}
            </Text>
          </View>
        </View>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>

    {/* EDIT PROFILE MODAL */}
    <Modal visible={isEditModalVisible} animationType="slide" transparent onRequestClose={() => setIsEditModalVisible(false)}>
      <Pressable style={styles.modalOverlay} onPress={() => setIsEditModalVisible(false)}>
        <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView showsVerticalScrollIndicator={true} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
              <Text style={styles.modalTitle}>Edit Profile</Text>

              <View style={styles.formRow}>
                <View style={styles.formHalf}>
                  <Text style={styles.formLabel}>First Name</Text>
                  <TextInput style={styles.formInput} value={editFirstname} onChangeText={setEditFirstname} placeholderTextColor="#666" />
                </View>
                <View style={styles.formHalf}>
                  <Text style={styles.formLabel}>Last Name</Text>
                  <TextInput style={styles.formInput} value={editLastname} onChangeText={setEditLastname} placeholderTextColor="#666" />
                </View>
              </View>

              <Text style={styles.formLabel}>Email</Text>
              <TextInput style={styles.formInput} value={editEmail} onChangeText={setEditEmail} keyboardType="email-address" autoCapitalize="none" placeholderTextColor="#666" />

              <View style={styles.formRow}>
                <View style={styles.formThird}>
                  <Text style={styles.formLabel}>Age</Text>
                  <TextInput style={styles.formInput} value={editAge} onChangeText={setEditAge} keyboardType="numeric" placeholderTextColor="#666" />
                </View>
                <View style={styles.formThird}>
                  <Text style={styles.formLabel}>Weight (kg)</Text>
                  <TextInput style={styles.formInput} value={editWeight} onChangeText={setEditWeight} keyboardType="numeric" placeholderTextColor="#666" />
                </View>
                <View style={styles.formThird}>
                  <Text style={styles.formLabel}>Height (cm)</Text>
                  <TextInput style={styles.formInput} value={editHeight} onChangeText={setEditHeight} keyboardType="numeric" placeholderTextColor="#666" />
                </View>
              </View>

              <Text style={styles.formLabel}>City</Text>
              <TextInput style={styles.formInput} value={editCity} onChangeText={setEditCity} placeholderTextColor="#666" />

              <Text style={styles.formLabel}>Goal</Text>
              <View style={styles.goalGrid}>
                {GOAL_OPTIONS.map((g) => (
                  <TouchableOpacity
                    key={g.key}
                    style={[styles.goalChip, editGoal === g.key && { borderColor: g.color, backgroundColor: `${g.color}20` }]}
                    onPress={() => setEditGoal(g.key)}
                  >
                    <Text style={[styles.goalChipText, editGoal === g.key && { color: g.color }]}>{g.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsEditModalVisible(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSaveProfile} disabled={saving}>
                  {saving ? <ActivityIndicator color="white" /> : <Text style={styles.saveBtnText}>Save</Text>}
                </TouchableOpacity>
              </View>
              <View style={{ height: 20 }} />
            </ScrollView>
          </KeyboardAvoidingView>
        </Pressable>
      </Pressable>
    </Modal>
    <Toast />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A1F2B', paddingHorizontal: 16 },
  headerCard: { alignItems: 'center', marginVertical: 20 },
  avatarLarge: {
    width: 90, height: 90, borderRadius: 45, backgroundColor: '#3498DB',
    justifyContent: 'center', alignItems: 'center', marginBottom: 15,
    borderWidth: 3, borderColor: '#2A4562'
  },
  avatarText: { fontSize: 36, fontWeight: 'bold', color: 'white' },
  userName: { color: 'white', fontSize: 22, fontWeight: 'bold' },
  userSub: { color: '#888', fontSize: 13, marginTop: 4 },
  userCity: { color: '#3498DB', fontSize: 12, marginTop: 4 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#2A4562', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, marginTop: 15 },
  editBtnText: { color: 'white', fontSize: 13, fontWeight: 'bold' },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: 'white', marginTop: 20, marginBottom: 12, marginLeft: 5 },
  card: { backgroundColor: '#2A4562', borderRadius: 15, padding: 15 },
  cardInfo: { color: '#aaa', fontSize: 12, marginBottom: 15, lineHeight: 18 },
  codeContainer: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#1A1F2B', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#3498DB'
  },
  codeLabel: { color: '#888', fontSize: 10, textTransform: 'uppercase', marginBottom: 2 },
  codeValue: { color: 'white', fontSize: 20, fontWeight: 'bold', letterSpacing: 1 },
  metricsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  metricCard: { backgroundColor: '#2A4562', width: '31%', padding: 15, borderRadius: 15, alignItems: 'center' },
  metricValue: { color: 'white', fontSize: 16, fontWeight: 'bold', marginTop: 8 },
  metricLabel: { color: '#888', fontSize: 11, marginTop: 2 },
  goalItem: { flexDirection: 'row', alignItems: 'center' },
  goalText: { fontSize: 18, fontWeight: 'bold' },
  goalSub: { color: '#888', fontSize: 12 },

  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 16 },
  modalContent: { backgroundColor: '#1A1F2B', borderRadius: 20, padding: 20, maxHeight: '90%', borderWidth: 1, borderColor: '#2A4562' },
  modalTitle: { color: 'white', fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  formRow: { flexDirection: 'row', gap: 10 },
  formHalf: { flex: 1 },
  formThird: { flex: 1 },
  formLabel: { color: '#888', fontSize: 12, fontWeight: 'bold', marginBottom: 6, marginTop: 12 },
  formInput: { backgroundColor: '#2A4562', color: 'white', padding: 12, borderRadius: 10, fontSize: 15 },
  goalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  goalChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#444', backgroundColor: '#232D3F' },
  goalChipText: { color: '#888', fontWeight: 'bold', fontSize: 12 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 24 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#888' },
  cancelBtnText: { color: '#888', fontWeight: 'bold', fontSize: 15 },
  saveBtn: { flex: 2, paddingVertical: 14, borderRadius: 10, alignItems: 'center', backgroundColor: '#3498DB' },
  saveBtnText: { color: 'white', fontWeight: 'bold', fontSize: 15 },
});

export default ProfileScreen;
