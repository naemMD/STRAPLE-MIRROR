import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, FlatList, ActivityIndicator, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { getUserDetails } from '@/services/authStorage';
import api from '@/services/api';
import { getCurrentLocation, requestLocationPermission } from '@/services/crossLocation';
import Toast from 'react-native-toast-message';

export default function SearchCoachScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [citySearch, setCitySearch] = useState('');
  const [coaches, setCoaches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Search by City
  const searchByCity = async () => {
    if (!citySearch.trim()) return;
    
    Keyboard.dismiss();
    setLoading(true);
    
    try {
      const res = await api.get(`/coaches/search?city=${encodeURIComponent(citySearch)}`);
      setCoaches(res.data);
    } catch (error) {
      console.error("City search error:", error);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Could not fetch coaches.' });
    } finally {
      setLoading(false);
    }
  };

  // Search by GPS Location & Save to DB
  const searchByLocation = async () => {
    setLoading(true);
    try {
      const granted = await requestLocationPermission();
      if (!granted) {
        Toast.show({ type: 'error', text1: 'Permission Denied', text2: 'Location access is required to find nearby coaches.' });
        setLoading(false);
        return;
      }

      const location = await getCurrentLocation();
      if (!location) {
        Toast.show({ type: 'error', text1: 'Error', text2: 'Could not get your location.' });
        setLoading(false);
        return;
      }

      const user = await getUserDetails();

      const res = await api.get(`/coaches/search?lat=${location.latitude}&lon=${location.longitude}`);
      setCoaches(res.data);

      if (user?.id) {
          await api.patch(`/users/me/location?current_user_id=${user.id}`, {
              latitude: location.latitude,
              longitude: location.longitude
          });
      }

    } catch (error) {
      console.error("GPS Error:", error);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to get your current location.' });
    } finally {
      setLoading(false);
    }
  };

  const renderCoach = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={styles.coachCard}
      onPress={() => router.push({ pathname: '/clients/coach-public-profile', params: { coachId: item.id } })}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
            {item.firstname ? item.firstname[0].toUpperCase() : '?'}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.coachName}>
            {item.firstname || 'Coach'} {item.lastname || ''}
        </Text>
        <Text style={styles.coachCity}>
          <Ionicons name="location" size={12} color="#8A8D91" /> {item.city || 'Not specified'}
        </Text>
      </View>
      {item.distance != null && (
        <View style={styles.distanceBadge}>
          <Text style={styles.distanceText}>{item.distance} km</Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={24} color="#3498DB" />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 5 }}>
          <Ionicons name="arrow-back" size={28} color="#3498DB" />
        </TouchableOpacity>
        <Text style={styles.title}>Find a Coach</Text>
        <View style={{ width: 38 }} />
      </View>

      <View style={styles.searchSection}>
        {/* Search Bar */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Search a city (e.g., Paris)"
            placeholderTextColor="#8A8D91"
            value={citySearch}
            onChangeText={setCitySearch}
            onSubmitEditing={searchByCity}
          />
          <TouchableOpacity style={styles.searchIconBtn} onPress={searchByCity}>
            <Ionicons name="search" size={20} color="white" />
          </TouchableOpacity>
        </View>

        {/* Action Buttons: GPS and Map */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.gpsBtn} onPress={searchByLocation}>
            <Ionicons name="navigate" size={20} color="white" style={{ marginRight: 8 }} />
            <Text style={styles.btnText}>Near me</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.mapBtn} onPress={() => router.push('/clients/map-search')}>
            <Ionicons name="map" size={20} color="white" style={{ marginRight: 8 }} />
            <Text style={styles.btnText}>Open Map</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#3498DB" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={coaches}
          keyboardDismissMode="on-drag"
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderCoach}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Search for a city or use your location to find a coach.</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A1F2B' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 15 },
  title: { fontSize: 20, fontWeight: 'bold', color: 'white' },
  searchSection: { paddingHorizontal: 16, marginBottom: 10 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2A4562', borderRadius: 12, marginBottom: 15 },
  input: { flex: 1, color: 'white', padding: 15, fontSize: 16 },
  searchIconBtn: { backgroundColor: '#3498DB', padding: 15, borderTopRightRadius: 12, borderBottomRightRadius: 12 },
  
  // Nouveaux styles pour les boutons alignés
  actionRow: { flexDirection: 'row', justifyContent: 'space-between' },
  gpsBtn: { flex: 1, flexDirection: 'row', backgroundColor: '#232D3F', padding: 15, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#3498DB', marginRight: 5 },
  mapBtn: { flex: 1, flexDirection: 'row', backgroundColor: '#3498DB', padding: 15, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginLeft: 5 },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  
  coachCard: { flexDirection: 'row', backgroundColor: '#2A4562', padding: 15, borderRadius: 12, alignItems: 'center', marginBottom: 12 },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#3498DB', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  avatarText: { color: 'white', fontWeight: 'bold', fontSize: 20 },
  coachName: { color: 'white', fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  coachCity: { color: '#8A8D91', fontSize: 14 },
  distanceBadge: { backgroundColor: 'rgba(52, 152, 219, 0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginRight: 10 },
  distanceText: { color: '#3498DB', fontSize: 12, fontWeight: 'bold' },
  emptyText: { color: '#8A8D91', textAlign: 'center', marginTop: 50, fontSize: 16 }
});