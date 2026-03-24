import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Toast } from 'react-native-toast-message/lib/src/Toast';
import api from '@/services/api';

const GOAL_LABELS: Record<string, string> = {
  lose_weight: 'Lose Weight',
  gain_muscle: 'Gain Muscle',
  maintain_weight: 'Maintain Weight',
};

const UserPublicProfile = () => {
  const { userId } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || userId === 'undefined') {
      setLoading(false);
      return;
    }
    fetchProfile();
  }, [userId]);

  const fetchProfile = async () => {
    try {
      const response = await api.get(`/users/${userId}/public-profile`);
      setUser(response.data);
    } catch {
      Toast.show({ type: 'error', text1: 'Failed to load profile.' });
      router.back();
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <ActivityIndicator size="large" color="#3498DB" style={{ flex: 1, backgroundColor: '#1A1F2B' }} />;
  }

  return (
    <ScrollView style={[styles.container, { paddingTop: insets.top }]} keyboardDismissMode="on-drag">
      <Stack.Screen options={{ headerShown: false }} />

      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={24} color="white" />
      </TouchableOpacity>

      <View style={styles.profileHeader}>
        <View style={styles.avatarLarge}>
          <Text style={styles.avatarText}>{user?.firstname?.[0]}</Text>
        </View>
        <Text style={styles.name}>{user?.firstname} {user?.lastname}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{user?.role === 'coach' ? '🏋️ Coach' : '👤 Member'}</Text>
        </View>
        {user?.city && (
          <Text style={styles.location}>
            <Ionicons name="location" size={16} color="#3498DB" /> {user.city}
          </Text>
        )}
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{user?.age ?? '—'}</Text>
          <Text style={styles.statLabel}>Age</Text>
        </View>
        {user?.weight && (
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{user.weight} kg</Text>
            <Text style={styles.statLabel}>Weight</Text>
          </View>
        )}
        {user?.height && (
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{user.height} cm</Text>
            <Text style={styles.statLabel}>Height</Text>
          </View>
        )}
      </View>

      {user?.goal && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Goal</Text>
          <View style={styles.goalBadge}>
            <Ionicons name="trophy-outline" size={18} color="#3498DB" style={{ marginRight: 8 }} />
            <Text style={styles.goalText}>{GOAL_LABELS[user.goal] ?? user.goal}</Text>
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <Text style={styles.description}>{user?.description || 'No description provided.'}</Text>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A1F2B', paddingHorizontal: 20 },
  backButton: { marginBottom: 15, marginTop: 10 },
  profileHeader: { alignItems: 'center', marginBottom: 30 },
  avatarLarge: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: '#3498DB', justifyContent: 'center', alignItems: 'center', marginBottom: 15,
  },
  avatarText: { fontSize: 40, color: 'white', fontWeight: 'bold' },
  name: { fontSize: 24, fontWeight: 'bold', color: 'white', marginBottom: 8 },
  roleBadge: {
    backgroundColor: '#2A4562', paddingHorizontal: 14, paddingVertical: 5,
    borderRadius: 20, marginBottom: 8,
  },
  roleText: { color: '#3498DB', fontWeight: '600', fontSize: 14 },
  location: { color: '#8A8D91', fontSize: 15 },
  statsContainer: {
    flexDirection: 'row', justifyContent: 'space-around',
    backgroundColor: '#2A4562', borderRadius: 15, padding: 20, marginBottom: 30,
  },
  statBox: { alignItems: 'center' },
  statValue: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  statLabel: { color: '#8A8D91', fontSize: 12, marginTop: 2 },
  section: { marginBottom: 25 },
  sectionTitle: { color: 'white', fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  description: { color: '#ccc', lineHeight: 22 },
  goalBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#2A4562', padding: 14, borderRadius: 12,
  },
  goalText: { color: 'white', fontSize: 15, fontWeight: '500' },
});

export default UserPublicProfile;
