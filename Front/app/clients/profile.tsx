import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import axios from 'axios';
import Constants from 'expo-constants';
import * as Clipboard from 'expo-clipboard'; // Utilise expo-clipboard si disponible
import { getUserDetails } from '@/services/authStorage';

const ProfileScreen = () => {
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const API_URL = Constants.expoConfig?.extra?.API_URL ?? '';

  // --- CONFIGURATION DES OBJECTIFS (Traductions & Icônes) ---
  const goalConfig: { [key: string]: { label: string; icon: any; color: string } } = {
    'lose_weight': { label: 'Lose Weight', icon: 'trending-down', color: '#E74C3C' },
    'gain_muscle': { label: 'Gain Muscle', icon: 'barbell', color: '#2ECC71' },
    'maintain': { label: 'Maintain Weight', icon: 'git-commit', color: '#F1C40F' },
    'get_stronger': { label: 'Get Stronger', icon: 'flash', color: '#9B59B6' },
  };

  const loadData = async () => {
    try {
        const session = await getUserDetails();
        if (session?.id) {
            const response = await axios.get(`${API_URL}/users/me/${session.id}`);
            setUser(response.data);
        }
    } catch (e) {
        console.log(e);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const copyToClipboard = async () => {
      if (user?.unique_code) {
          await Clipboard.setStringAsync(user.unique_code);
          Alert.alert("Copied!", "Your identification code is ready to be sent to your coach.");
      }
  };

  // Récupère la config correspondante ou une config par défaut
  const currentGoal = user?.goal ? goalConfig[user.goal] : { label: 'Not specified', icon: 'help-circle', color: '#3498DB' };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color="#3498DB" />
      </View>
    );
  }

  return (
    // Suppression du padding top manuel ici car il vient du layout
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.headerCard}>
        <View style={styles.avatarLarge}>
          <Text style={styles.avatarText}>{user?.firstname?.[0]}</Text>
        </View>
        <Text style={styles.userName}>{user?.firstname} {user?.lastname}</Text>
        <Text style={styles.userSub}>{user?.email}</Text>
        
        <TouchableOpacity style={styles.editBtn}>
          <Text style={styles.editBtnText}>Edit Profile</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Coaching Connection</Text>
      <View style={styles.card}>
        <Text style={styles.cardInfo}>Share this code with your coach to link your accounts:</Text>
        <TouchableOpacity style={styles.codeContainer} onPress={copyToClipboard}>
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
            <View style={[styles.iconCircle, { backgroundColor: `${currentGoal.color}20` }]}>
                <Ionicons name={currentGoal.icon} size={24} color={currentGoal.color} />
            </View>
            <View style={{ marginLeft: 15 }}>
                <Text style={styles.goalSub}>Primary objective</Text>
                <Text style={[styles.goalText, { color: currentGoal.color }]}>
                    {currentGoal.label}
                </Text>
            </View>
        </View>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
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
  editBtn: { backgroundColor: '#2A4562', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, marginTop: 15 },
  editBtnText: { color: 'white', fontSize: 12, fontWeight: 'bold' },
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
  iconCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  goalText: { fontSize: 18, fontWeight: 'bold' },
  goalSub: { color: '#888', fontSize: 12 }
});

export default ProfileScreen;