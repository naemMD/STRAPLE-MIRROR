import React, { useState, useCallback, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, FlatList, ActivityIndicator,
  Modal, ScrollView, Animated, PanResponder, Dimensions
} from 'react-native';
import { crossAlert } from '@/services/crossAlert';
import { useRouter, useFocusEffect } from 'expo-router';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import api from '@/services/api';

LocaleConfig.locales['en'] = {
  monthNames: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  monthNamesShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  dayNames: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  dayNamesShort: ['S', 'M', 'T', 'W', 'T', 'F', 'S'], 
};
LocaleConfig.defaultLocale = 'en';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SHEET_MIN_Y = SCREEN_HEIGHT * 0.15; 
const SHEET_MAX_Y = SCREEN_HEIGHT * 0.55; 

const TrainingDashboard = () => {
  const router = useRouter();

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [markedDates, setMarkedDates] = useState<any>({});
  const [loading, setLoading] = useState(false);
  
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedWorkout, setSelectedWorkout] = useState<any>(null);

  const panY = useRef(new Animated.Value(SHEET_MAX_Y)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => { panY.extractOffset(); },
      onPanResponderMove: (e, gestureState) => { panY.setValue(gestureState.dy); },
      onPanResponderRelease: (e, gestureState) => {
        panY.flattenOffset();
        if (gestureState.vy < -0.5 || gestureState.dy < -100) {
           Animated.spring(panY, { toValue: SHEET_MIN_Y, useNativeDriver: false, friction: 5 }).start();
        } else if (gestureState.vy > 0.5 || gestureState.dy > 100) {
           Animated.spring(panY, { toValue: SHEET_MAX_Y, useNativeDriver: false, friction: 5 }).start();
        } else {
           const currentPos = (panY as any)._value; 
           const midPoint = (SHEET_MAX_Y + SHEET_MIN_Y) / 2;
           Animated.spring(panY, { toValue: currentPos < midPoint ? SHEET_MIN_Y : SHEET_MAX_Y, useNativeDriver: false }).start();
        }
      }
    })
  ).current;

  useFocusEffect(
    useCallback(() => {
      fetchWorkouts();
    }, [])
  );

  const fetchWorkouts = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/workouts/my-workouts`);
      const allWorkouts = res.data;
      
      const sanitizedWorkouts = allWorkouts.map((w:any) => ({
          ...w,
          is_completed: !!w.is_completed
      }));

      setWorkouts(sanitizedWorkouts);

      const marks: any = {};
      sanitizedWorkouts.forEach((w: any) => {
        const dateStr = w.scheduled_date.split('T')[0];
        const dotColor = w.is_completed ? '#2ecc71' : '#e74c3c'; 
        marks[dateStr] = { marked: true, dotColor: dotColor };
      });
      setMarkedDates(marks);
    } catch (error) {
      console.error("Error fetching workouts:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleWorkout = async (workoutId: number) => {
      const previousWorkouts = [...workouts];

      setWorkouts(prev => prev.map(w => 
          w.id === workoutId ? { ...w, is_completed: !w.is_completed } : w
      ));

      try {
          await api.patch(`/workouts/${workoutId}/toggle-complete`);
      } catch (error) {
          console.error("Error toggling workout:", error);
          setWorkouts(previousWorkouts); 
          crossAlert("Error", "Could not update status.");
      }
  };

  const handleDeleteWorkout = async (workoutId: number) => {
    crossAlert(
        "Delete Workout",
        "Are you sure you want to delete this session?",
        [
            { text: "Cancel", style: "cancel" },
            { 
                text: "Delete", 
                style: "destructive", 
                onPress: async () => {
                    try {
                        await api.delete(`/workouts/${workoutId}`);
                        setDetailModalVisible(false);
                        fetchWorkouts();
                    } catch (error) {
                        crossAlert("Error", "Could not delete workout.");
                    }
                }
            }
        ]
    );
  };

  const dailyWorkouts = workouts.filter(w => w.scheduled_date.startsWith(selectedDate));

  const openWorkoutDetails = (workout: any) => {
      setSelectedWorkout(workout);
      setDetailModalVisible(true);
  };

  const safeParseSets = (sets: any) => {
    if (!sets) return [];
    if (typeof sets === 'string') {
      try { return JSON.parse(sets); } catch (e) { return []; }
    }
    return sets;
  };

  const renderWorkoutItem = ({ item }: { item: any }) => {
    const time = new Date(item.scheduled_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    let exercises = [];
    try {
        exercises = typeof item.exercises === 'string' ? JSON.parse(item.exercises) : item.exercises;
    } catch(e) { exercises = []; }

    const uniqueMuscles = Array.from(new Set(exercises.map((e: any) => e.muscle))).join(', ');
    const isDone = item.is_completed;

    return (
      <TouchableOpacity onPress={() => openWorkoutDetails(item)} activeOpacity={0.7}>
        <View style={[styles.card, isDone && styles.cardCompleted]}>
            <View style={styles.cardLeft}>
                <Text style={[styles.cardTime, isDone && {color: '#888'}]}>{time}</Text>
                <View style={[styles.verticalLine, isDone && {backgroundColor: '#2ecc71'}]} />
            </View>

            <View style={styles.cardContent}>
                <Text style={[styles.cardTitle, isDone && styles.textCompleted]}>{item.name}</Text>
                <Text style={styles.cardSubtitle}>
                    {exercises.length} Exercises • {uniqueMuscles || "General"}
                </Text>
            </View>
            
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <TouchableOpacity 
                    onPress={() => handleToggleWorkout(item.id)} 
                    style={{padding: 8, marginRight: 5}}
                >
                    <Ionicons 
                        name={isDone ? "checkmark-circle" : "radio-button-off"} 
                        size={28} 
                        color={isDone ? "#2ecc71" : "#888"} 
                    />
                </TouchableOpacity>

                <Ionicons name="eye-outline" size={20} color={isDone ? "#666" : "#3498DB"} />
            </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      
      <View style={styles.fixedBackground}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Training Plan</Text>
            <TouchableOpacity style={styles.createBtnHeader} onPress={() => router.push('/clients/create-session')}>
                <Ionicons name="add" size={24} color="white" />
            </TouchableOpacity>
          </View>

          <Calendar
              current={selectedDate}
              theme={{
                  backgroundColor: '#1A1F2B',
                  calendarBackground: '#1A1F2B',
                  textSectionTitleColor: '#666',
                  selectedDayBackgroundColor: '#3498DB',
                  selectedDayTextColor: '#ffffff',
                  todayTextColor: '#3498DB',
                  dayTextColor: '#ffffff',
                  textDisabledColor: '#333',
                  dotColor: '#2ecc71',
                  arrowColor: '#3498DB',
                  monthTextColor: '#ffffff',
                  indicatorColor: '#ffffff',
                  textDayFontWeight: 'bold',
                  textMonthFontWeight: 'bold',
                  textDayHeaderFontWeight: '500',
                  textDayFontSize: 14,
              }}
              onDayPress={(day: any) => {
                  setSelectedDate(day.dateString);
                  Animated.spring(panY, { toValue: SHEET_MAX_Y, useNativeDriver: false }).start();
              }}
              markedDates={{
                  ...markedDates,
                  [selectedDate]: { ...(markedDates[selectedDate] || {}), selected: true, selectedColor: '#3498DB' }
              }}
              hideExtraDays={true} 
              firstDay={1}
          />
      </View>

      <Animated.View style={[styles.bottomSheet, { top: panY, height: SCREEN_HEIGHT }]}>
        <View {...panResponder.panHandlers} style={styles.dragHandleArea}>
            <View style={styles.dragHandleBar} />
        </View>

        <View style={styles.sheetContent}>
            <Text style={styles.sectionTitle}>Workouts for {new Date(selectedDate).toDateString()}</Text>
            {loading ? (
                <ActivityIndicator color="#3498DB" style={{marginTop: 20}} />
            ) : (
                <FlatList
                    data={dailyWorkouts}
                    keyboardDismissMode="on-drag"
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderWorkoutItem}
                    contentContainerStyle={{ paddingBottom: 200 }}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>Rest Day</Text>
                            <Text style={styles.emptySubText}>Swipe up to see details or add a workout.</Text>
                        </View>
                    }
                />
            )}
        </View>
        <TouchableOpacity style={styles.fab} onPress={() => router.push('/clients/create-session')}>
             <Ionicons name="add" size={30} color="white" />
        </TouchableOpacity>
      </Animated.View>

      <Modal visible={detailModalVisible} animationType="slide" transparent onRequestClose={() => setDetailModalVisible(false)}>
          <TouchableOpacity 
            style={styles.modalBackground} 
            activeOpacity={1} 
            onPressOut={() => setDetailModalVisible(false)}
          >
              <TouchableOpacity activeOpacity={1} style={styles.modalContainer}>
                  {selectedWorkout && (
                      <>
                        <View style={styles.modalHeader}>
                            <View style={{flex: 1}}>
                                <Text style={styles.modalTitle}>{selectedWorkout.name}</Text>
                                <Text style={{color:'#888'}}>
                                    {new Date(selectedWorkout.scheduled_date).toDateString()}
                                </Text>
                            </View>
                            
                            <View style={{flexDirection: 'row', gap: 15, alignItems: 'center'}}>
                                <TouchableOpacity onPress={() => handleDeleteWorkout(selectedWorkout.id)}>
                                    <Ionicons name="trash-outline" size={26} color="#e74c3c" />
                                </TouchableOpacity>

                                <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
                                    <Ionicons name="close-circle" size={30} color="#666" />
                                </TouchableOpacity>
                            </View>
                        </View>

                        <ScrollView style={{marginTop: 15}} showsVerticalScrollIndicator={false}>
                            {
                                (typeof selectedWorkout.exercises === 'string' 
                                    ? JSON.parse(selectedWorkout.exercises) 
                                    : selectedWorkout.exercises
                                ).map((exo: any, index: number) => (
                                <View key={index} style={styles.detailRow}>
                                    <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 8}}>
                                        <Text style={styles.detailExoName}>{index+1}. {exo.name}</Text>
                                        <View style={styles.muscleBadge}>
                                            <Text style={styles.detailMuscle}>{exo.muscle}</Text>
                                        </View>
                                    </View>
                                    
                                    <View style={styles.setsContainer}>
                                        {safeParseSets(exo.sets_details).map((s: any, i: number) => (
                                            <View key={i} style={styles.setRow}>
                                                <Text style={styles.setNumber}>Set {s.set_number}</Text>
                                                <View style={styles.setValues}>
                                                    <Text style={styles.setValueText}>
                                                        {s.duration > 0 ? `${s.duration}s` : `${s.reps} reps`}
                                                    </Text>
                                                    {s.weight > 0 && <Text style={styles.setWeightText}>{s.weight} kg</Text>}
                                                </View>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            ))}
                        </ScrollView>
                      </>
                  )}
              </TouchableOpacity>
          </TouchableOpacity>
      </Modal>

    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A1F2B' },
  fixedBackground: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 10, paddingTop: 10 },
  headerTitle: { color: 'white', fontSize: 22, fontWeight: 'bold' },
  createBtnHeader: { padding: 8, backgroundColor: '#2A4562', borderRadius: 8 },
  bottomSheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: '#141824', borderTopLeftRadius: 30, borderTopRightRadius: 30,
    shadowColor: "#000", shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.5, shadowRadius: 5, elevation: 20,
  },
  dragHandleArea: { width: '100%', height: 40, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent' },
  dragHandleBar: { width: 50, height: 5, backgroundColor: '#4A5568', borderRadius: 3 },
  sheetContent: { flex: 1, paddingHorizontal: 20 },
  sectionTitle: { color: '#888', fontSize: 14, marginBottom: 15, textTransform: 'uppercase', letterSpacing: 1, marginTop: 5 },
  
  card: { flexDirection: 'row', backgroundColor: '#1A1F2B', padding: 15, borderRadius: 12, marginBottom: 12, alignItems: 'center' },
  cardCompleted: { backgroundColor: '#1e2530', opacity: 0.8 }, 
  textCompleted: { color: '#888', textDecorationLine: 'line-through' }, 

  cardLeft: { alignItems: 'center', marginRight: 15, width: 50 },
  cardTime: { color: 'white', fontWeight: 'bold', fontSize: 16, marginBottom: 5 },
  verticalLine: { width: 2, height: 25, backgroundColor: '#3498DB', borderRadius: 2 },
  cardContent: { flex: 1 },
  cardTitle: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  cardSubtitle: { color: '#888', fontSize: 12 },
  emptyState: { alignItems: 'center', marginTop: 40 },
  emptyText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  emptySubText: { color: '#666', fontSize: 14 },
  fab: { position: 'absolute', bottom: 120, right: 30, backgroundColor: '#3498DB', width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  
  modalBackground: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
  modalContainer: { backgroundColor: '#1A1F2B', borderRadius: 15, padding: 20, maxHeight: '85%', borderWidth: 1, borderColor: '#3498DB' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#2A4562', paddingBottom: 15 },
  modalTitle: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  
  detailRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  detailExoName: { color: 'white', fontSize: 16, fontWeight: 'bold', marginRight: 10 },
  muscleBadge: { backgroundColor: '#2A4562', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  detailMuscle: { color: '#3498DB', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
  
  setsContainer: { backgroundColor: '#232D3F', borderRadius: 8, padding: 10, marginTop: 5 },
  setRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  setNumber: { color: '#888', fontSize: 13, fontWeight: 'bold' },
  setValues: { flexDirection: 'row', alignItems: 'center' },
  setValueText: { color: 'white', fontSize: 14, fontWeight: 'bold', width: 70, textAlign: 'right' },
  setWeightText: { color: '#3498DB', fontSize: 14, fontWeight: 'bold', marginLeft: 10, width: 60, textAlign: 'right' }
});

export default TrainingDashboard;