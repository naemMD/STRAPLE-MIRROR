import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import axios from 'axios';
import Constants from 'expo-constants';
import * as Location from 'expo-location';
import { getToken } from '@/services/authStorage';
import Toast from 'react-native-toast-message';

// 🔥 Chargement dynamique pour éviter l'erreur sur le Web (Vercel)
let MapView: any, Marker: any, Callout: any;
if (Platform.OS !== 'web') {
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Marker = Maps.Marker;
  Callout = Maps.Callout;
}

export default function MapSearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const API_URL = Constants.expoConfig?.extra?.API_URL ?? '';

  const [selectedLocation, setSelectedLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [coaches, setCoaches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [region, setRegion] = useState({
    latitude: 48.8566,
    longitude: 2.3522,
    latitudeDelta: 5.0,
    longitudeDelta: 5.0,
  });

  useEffect(() => {
    if (Platform.OS === 'web') return;

    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      let location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      });
    })();
  }, []);

  const handleMapPress = async (event: any) => {
    if (event?.nativeEvent?.action === 'marker-press') return;
    const coordinate = event?.nativeEvent?.coordinate;
    if (!coordinate || !coordinate.latitude || !coordinate.longitude) return; 

    setSelectedLocation(coordinate);
    fetchCoaches(coordinate.latitude, coordinate.longitude);
  };

  const fetchCoaches = async (lat: number, lon: number) => {
    setLoading(true);
    try {
      const token = await getToken();
      const res = await axios.get(`${API_URL}/coaches/search?lat=${lat}&lon=${lon}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const MAX_DISTANCE_KM = 50;
      const nearbyCoaches = res.data.filter((c: any) => c.distance !== null && c.distance <= MAX_DISTANCE_KM);
      setCoaches(nearbyCoaches);
      
      if (nearbyCoaches.length > 0) {
        Toast.show({ type: 'success', text1: 'Coaches found!', text2: `Found ${nearbyCoaches.length} coach(es).` });
      } else {
        Toast.show({ type: 'info', text1: 'No coaches', text2: `No coaches found nearby` });
      }
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Could not fetch coaches.' });
    } finally {
      setLoading(false);
    }
  };

  const goToCoachProfile = (coachId: number) => {
    router.push({ pathname: '/clients/coach-public-profile', params: { coachId } });
  };

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Ionicons name="map-outline" size={80} color="#3498DB" />
        <Text style={{ color: 'white', fontSize: 18, marginTop: 20 }}>Map is only available on Mobile</Text>
        <TouchableOpacity style={{ marginTop: 20 }} onPress={() => router.back()}>
            <Text style={{ color: '#3498DB' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView 
        style={styles.map} 
        region={region} 
        onRegionChangeComplete={setRegion}
        showsUserLocation={true} 
        showsMyLocationButton={false} 
        onPress={handleMapPress}
      >
        {selectedLocation && (
          <Marker coordinate={selectedLocation} pinColor="red" title="Selected Area" />
        )}

        {coaches.map((coach) => (
          coach.latitude && coach.longitude ? (
            <Marker 
              key={coach.id} 
              coordinate={{ latitude: coach.latitude, longitude: coach.longitude }} 
              pinColor="#3498DB"
              onPress={(e: any) => e.stopPropagation()}
            >
              <Callout onPress={() => goToCoachProfile(coach.id)}>
                <View style={styles.calloutContainer}>
                  <Text style={styles.calloutName}>{coach.firstname} {coach.lastname}</Text>
                  <Text style={styles.calloutDistance}>{coach.distance} km away</Text>
                  <Text style={styles.calloutLink}>Tap to view profile ➔</Text>
                </View>
              </Callout>
            </Marker>
          ) : null
        ))}
      </MapView>

      {/* 🔥 CORRECTION ICI : On retire insets.top pour éviter le double espace en haut */}
      <View style={[styles.header, { paddingTop: 15 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Map Search</Text>
            <Text style={styles.headerSubtitle}>Tap anywhere to drop a pin</Text>
        </View>
      </View>

      <TouchableOpacity 
        style={[styles.recenterButton, { bottom: Math.max(insets.bottom, 20) + 20 }]}
        onPress={async () => {
            let location = await Location.getCurrentPositionAsync({});
            setRegion({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                latitudeDelta: 0.1, longitudeDelta: 0.1,
            });
        }}
      >
        <Ionicons name="navigate" size={24} color="#3498DB" />
      </TouchableOpacity>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#3498DB" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A1F2B' },
  map: { ...StyleSheet.absoluteFillObject },
  header: {
    position: 'absolute', top: 0, width: '100%', flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingBottom: 15, backgroundColor: 'rgba(26, 31, 43, 0.8)'
  },
  backButton: {
    backgroundColor: '#3498DB', width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 5, shadowOffset: { width: 0, height: 2 },
  },
  headerTextContainer: { marginLeft: 15 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: 'white' },
  headerSubtitle: { fontSize: 14, color: '#3498DB', fontWeight: 'bold' },
  recenterButton: {
    position: 'absolute', right: 20,
    backgroundColor: 'white', width: 50, height: 50, borderRadius: 25,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 5, shadowOffset: { width: 0, height: 2 },
  },
  loadingOverlay: {
    position: 'absolute', top: '50%', left: '50%', marginLeft: -25, marginTop: -25,
    backgroundColor: 'rgba(26, 31, 43, 0.8)', padding: 15, borderRadius: 25,
  },
  calloutContainer: { width: 150, alignItems: 'center', padding: 5 },
  calloutName: { fontWeight: 'bold', fontSize: 16, marginBottom: 2 },
  calloutDistance: { color: '#8A8D91', fontSize: 12, marginBottom: 8 },
  calloutLink: { color: '#3498DB', fontSize: 12, fontWeight: 'bold' }
});