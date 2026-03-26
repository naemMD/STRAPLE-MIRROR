import React, { useState, useCallback, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, FlatList, ActivityIndicator,
  Modal, ScrollView, Animated, PanResponder, Dimensions, TextInput, Pressable
} from 'react-native';
import { crossAlert } from '@/services/crossAlert';
import { useRouter, useFocusEffect } from 'expo-router';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import api from '@/services/api';
import { getUniqueMuscles, getExercisesByMuscle, getSafeExercises } from '@/constants/exercisesData';
import { getUserDetails } from '@/services/authStorage';

LocaleConfig.locales['en'] = {
  monthNames: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  monthNamesShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  dayNames: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  dayNamesShort: ['S', 'M', 'T', 'W', 'T', 'F', 'S'], 
};
LocaleConfig.defaultLocale = 'en';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SHEET_MIN_Y = SCREEN_HEIGHT * 0.15; 
const SHEET_MAX_Y = SCREEN_HEIGHT * 0.68;

const TrainingDashboard = () => {
  const router = useRouter();

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [markedDates, setMarkedDates] = useState<any>({});
  const [loading, setLoading] = useState(false);
  
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedWorkout, setSelectedWorkout] = useState<any>(null);

  // Edit mode state
  const [editExercises, setEditExercises] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [addExoModalVisible, setAddExoModalVisible] = useState(false);
  const [addExoStep, setAddExoStep] = useState<'muscles' | 'exercises'>('muscles');
  const [addExoListData, setAddExoListData] = useState<any[]>([]);
  const [addExoSelectedMuscle, setAddExoSelectedMuscle] = useState<string | null>(null);

  // AI Program generation
  const [injuries, setInjuries] = useState<any[]>([]);
  const [aiModalVisible, setAiModalVisible] = useState(false);
  const [dayPrefs, setDayPrefs] = useState<{[date: string]: { enabled: boolean, focus: string, mode: string }}>({});
  const [generating, setGenerating] = useState(false);
  const [previewWorkouts, setPreviewWorkouts] = useState<any[]>([]);
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [savingProgram, setSavingProgram] = useState(false);

  const FOCUS_OPTIONS = injuries.length > 0
    ? ['Adapted Full Body', 'Upper Body', 'Lower Body', 'Push', 'Pull', 'Core', 'Cardio']
    : ['Full Body', 'Upper Body', 'Lower Body', 'Push', 'Pull', 'Core', 'Cardio'];
  const MODE_OPTIONS: { key: string, label: string, desc: string }[] = [
    { key: 'progressive', label: 'Progressive', desc: 'Charges increase, reps decrease' },
    { key: 'degressive', label: 'Degressive', desc: 'Charges decrease, reps increase' },
    { key: 'constant', label: 'Constant', desc: 'Same charge across all sets' },
  ];

  const panY = useRef(new Animated.Value(SHEET_MAX_Y)).current;

  const panOffset = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        panOffset.current = (panY as any)._value;
        panY.setOffset(0);
      },
      onPanResponderMove: (e, gestureState) => {
        const newVal = Math.min(SHEET_MAX_Y, Math.max(SHEET_MIN_Y, panOffset.current + gestureState.dy));
        panY.setValue(newVal);
      },
      onPanResponderRelease: (e, gestureState) => {
        const currentPos = (panY as any)._value;
        if (gestureState.vy < -0.5 || gestureState.dy < -100) {
           Animated.spring(panY, { toValue: SHEET_MIN_Y, useNativeDriver: false, friction: 5 }).start();
        } else if (gestureState.vy > 0.5 || gestureState.dy > 100) {
           Animated.spring(panY, { toValue: SHEET_MAX_Y, useNativeDriver: false, friction: 5 }).start();
        } else {
           const midPoint = (SHEET_MAX_Y + SHEET_MIN_Y) / 2;
           Animated.spring(panY, { toValue: currentPos < midPoint ? SHEET_MIN_Y : SHEET_MAX_Y, useNativeDriver: false }).start();
        }
      }
    })
  ).current;

  useFocusEffect(
    useCallback(() => {
      fetchWorkouts();
      fetchInjuries();
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

  const fetchInjuries = async () => {
    try {
      const res = await api.get('/injuries');
      setInjuries(res.data);
    } catch (error) {
      console.log("Error fetching injuries:", error);
    }
  };

  const getNext7Days = () => {
    const days = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      days.push({
        date: d.toISOString().split('T')[0],
        label: d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }),
      });
    }
    return days;
  };

  const openAiModal = () => {
    setDayPrefs({});
    setAiModalVisible(true);
  };

  const toggleDay = (dateStr: string) => {
    setDayPrefs(prev => {
      const existing = prev[dateStr];
      if (existing?.enabled) {
        const { [dateStr]: _, ...rest } = prev;
        return rest;
      }
      const defaultFocus = injuries.length > 0 ? 'Adapted Full Body' : 'Full Body';
      return { ...prev, [dateStr]: { enabled: true, focus: defaultFocus, mode: 'progressive' } };
    });
  };

  const updateDayPref = (dateStr: string, field: 'focus' | 'mode', value: string) => {
    setDayPrefs(prev => ({
      ...prev,
      [dateStr]: { ...prev[dateStr], [field]: value },
    }));
  };

  const handleGenerateProgram = async () => {
    const chosenDays = Object.entries(dayPrefs).filter(([_, v]) => v.enabled);
    if (chosenDays.length === 0) {
      crossAlert("Select days", "Please select at least one training day.");
      return;
    }

    setGenerating(true);
    try {
      const userDetails = await getUserDetails();
      const injuredZones = injuries.map((inj: any) => inj.body_zone);
      const safeExercises = getSafeExercises(injuredZones);
      const fitnessLevel = userDetails?.fitness_level || 'intermediate';
      const levels = ['beginner', 'intermediate', 'advanced'];
      const filtered = safeExercises.filter(
        ex => levels.indexOf(ex.difficulty) <= levels.indexOf(fitnessLevel as any)
      );

      const exerciseList = filtered.map(ex => ({
        name: ex.name,
        muscle: ex.muscle,
        type: ex.type,
        difficulty: ex.difficulty,
      }));

      const dayConfigs = chosenDays.map(([date, prefs]) => ({
        date,
        focus: prefs.focus,
        mode: prefs.mode,
      }));

      const res = await api.post('/workouts/preview-program', {
        selected_dates: chosenDays.map(([k]) => k),
        available_exercises: exerciseList,
        day_configs: dayConfigs,
      });

      setPreviewWorkouts(res.data.workouts || []);
      setAiModalVisible(false);
      setPreviewModalVisible(true);
    } catch (error) {
      console.error("Error generating program:", error);
      crossAlert("Error", "Could not generate program. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const handleAcceptProgram = async () => {
    setSavingProgram(true);
    try {
      await api.post('/workouts/save-generated-program', {
        workouts: previewWorkouts,
      });
      setPreviewModalVisible(false);
      setPreviewWorkouts([]);
      fetchWorkouts();
      crossAlert("Success", "Your AI training program has been saved!");
    } catch (error) {
      console.error("Error saving program:", error);
      crossAlert("Error", "Could not save program. Please try again.");
    } finally {
      setSavingProgram(false);
    }
  };

  const handleRejectProgram = () => {
    setPreviewModalVisible(false);
    setPreviewWorkouts([]);
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
      const exos = typeof workout.exercises === 'string' ? JSON.parse(workout.exercises) : workout.exercises;
      setEditExercises(exos.map((e: any, i: number) => ({
        ...e,
        _id: e.id || Date.now() + i,
        sets_details: safeParseSets(e.sets_details),
      })));
      setDetailModalVisible(true);
  };

  const safeParseSets = (sets: any) => {
    if (!sets) return [];
    if (typeof sets === 'string') {
      try { return JSON.parse(sets); } catch (e) { return []; }
    }
    return sets;
  };

  // --- Edit helpers ---
  const updateSetField = (exoIdx: number, setIdx: number, field: string, value: string) => {
    setEditExercises(prev => {
      const updated = [...prev];
      const sets = [...updated[exoIdx].sets_details];
      sets[setIdx] = { ...sets[setIdx], [field]: parseFloat(value) || 0 };
      updated[exoIdx] = { ...updated[exoIdx], sets_details: sets };
      return updated;
    });
  };

  const addSetToExercise = (exoIdx: number) => {
    setEditExercises(prev => {
      const updated = [...prev];
      const sets = [...updated[exoIdx].sets_details];
      const last = sets[sets.length - 1] || { reps: 10, weight: 0, duration: 0 };
      sets.push({ set_number: sets.length + 1, reps: last.reps, weight: last.weight, duration: last.duration });
      updated[exoIdx] = { ...updated[exoIdx], sets_details: sets, num_sets: sets.length };
      return updated;
    });
  };

  const removeSetFromExercise = (exoIdx: number, setIdx: number) => {
    setEditExercises(prev => {
      const updated = [...prev];
      const sets = updated[exoIdx].sets_details.filter((_: any, i: number) => i !== setIdx)
        .map((s: any, i: number) => ({ ...s, set_number: i + 1 }));
      if (sets.length === 0) return prev;
      updated[exoIdx] = { ...updated[exoIdx], sets_details: sets, num_sets: sets.length };
      return updated;
    });
  };

  const removeExercise = (exoIdx: number) => {
    setEditExercises(prev => prev.filter((_, i) => i !== exoIdx));
  };

  const openAddExoModal = () => {
    setAddExoStep('muscles');
    setAddExoListData(getUniqueMuscles());
    setAddExoSelectedMuscle(null);
    setAddExoModalVisible(true);
  };

  const handleAddExoSelectMuscle = (muscle: string) => {
    setAddExoSelectedMuscle(muscle);
    setAddExoStep('exercises');
    setAddExoListData(getExercisesByMuscle(muscle));
  };

  const handleAddExoSelect = (exerciseObj: any) => {
    const isDuration = exerciseObj.type === 'duration';
    const newExo = {
      _id: Date.now(),
      name: exerciseObj.name,
      muscle: addExoSelectedMuscle || 'Global',
      num_sets: 1,
      rest_time: 60,
      sets_details: [{ set_number: 1, reps: isDuration ? 0 : 10, weight: 0, duration: isDuration ? 60 : 0 }],
    };
    setEditExercises(prev => [...prev, newExo]);
    setAddExoModalVisible(false);
  };

  const handleSaveWorkout = async () => {
    if (!selectedWorkout || editExercises.length === 0) {
      crossAlert("Error", "A workout must have at least one exercise.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: selectedWorkout.name,
        difficulty: selectedWorkout.difficulty || "Intermediate",
        exercises: editExercises.map(e => ({
          name: e.name,
          muscle: e.muscle,
          num_sets: e.sets_details.length,
          rest_time: e.rest_time || 60,
          sets_details: e.sets_details.map((s: any) => ({
            set_number: s.set_number,
            reps: s.reps || 0,
            weight: s.weight || 0,
            duration: s.duration || 0,
          })),
        })),
      };
      await api.put(`/workouts/${selectedWorkout.id}`, payload);
      setDetailModalVisible(false);
      fetchWorkouts();
    } catch (error) {
      console.error("Error updating workout:", error);
      crossAlert("Error", "Could not update workout.");
    } finally {
      setSaving(false);
    }
  };

  const isDurationExercise = (exo: any) => {
    const sets = exo.sets_details || [];
    return sets.length > 0 && sets[0].duration > 0 && (sets[0].reps === 0 || !sets[0].reps);
  };

  const BODY_ZONE_LABELS: Record<string, string> = {
    right_shoulder: 'Right Shoulder', left_shoulder: 'Left Shoulder',
    right_trapezius: 'Right Trapezius', left_trapezius: 'Left Trapezius',
    upper_back: 'Upper Back', lower_back: 'Lower Back', neck: 'Neck',
    right_elbow: 'Right Elbow', left_elbow: 'Left Elbow',
    right_wrist: 'Right Wrist', left_wrist: 'Left Wrist',
    chest: 'Chest', abs: 'Abs',
    right_hip: 'Right Hip', left_hip: 'Left Hip',
    right_knee: 'Right Knee', left_knee: 'Left Knee',
    right_ankle: 'Right Ankle', left_ankle: 'Left Ankle',
    right_foot: 'Right Foot', left_foot: 'Left Foot',
    right_calf: 'Right Calf', left_calf: 'Left Calf',
    right_thigh: 'Right Thigh', left_thigh: 'Left Thigh',
    right_bicep: 'Right Bicep', left_bicep: 'Left Bicep',
    right_tricep: 'Right Tricep', left_tricep: 'Left Tricep',
    right_forearm: 'Right Forearm', left_forearm: 'Left Forearm',
  };

  const renderWorkoutItem = ({ item }: { item: any }) => {
    const time = new Date(item.scheduled_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let exercises = [];
    try {
        exercises = typeof item.exercises === 'string' ? JSON.parse(item.exercises) : item.exercises;
    } catch(e) { exercises = []; }

    const uniqueMuscles = Array.from(new Set(exercises.map((e: any) => e.muscle))).join(', ');
    const isDone = item.is_completed;
    const isAi = item.is_ai_generated;
    const accentColor = isAi ? '#f39c12' : '#3498DB';

    return (
      <TouchableOpacity onPress={() => openWorkoutDetails(item)} activeOpacity={0.7}>
        <View style={[styles.card, isDone && styles.cardCompleted, isAi && styles.cardAi]}>
            <View style={styles.cardLeft}>
                <Text style={[styles.cardTime, isDone && {color: '#888'}]}>{time}</Text>
                <View style={[styles.verticalLine, {backgroundColor: isDone ? '#2ecc71' : accentColor}]} />
            </View>

            <View style={[styles.cardContent, {marginRight: 10}]}>
                <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
                  <Text style={[styles.cardTitle, isDone && styles.textCompleted, isAi && {color: '#f39c12'}]} numberOfLines={1}>{item.name}</Text>
                  {isAi && <Ionicons name="sparkles" size={14} color="#f39c12" />}
                </View>
                <Text style={[styles.cardSubtitle, isAi && {color: '#b8860b'}]}>
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

                <Ionicons name="eye-outline" size={20} color={isDone ? "#666" : accentColor} />
            </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      
      {injuries.length > 0 && (
        <TouchableOpacity style={styles.injuryBanner} onPress={() => router.push('/chat/ai-coach')} activeOpacity={0.8}>
          <View style={styles.injuryBannerIcon}>
            <Ionicons name="warning" size={22} color="#fff" />
          </View>
          <View style={{flex: 1}}>
            <Text style={styles.injuryBannerTitle}>Active Injury</Text>
            <Text style={styles.injuryBannerText}>
              {injuries.map((inj: any) => BODY_ZONE_LABELS[inj.body_zone] || inj.body_zone).join(', ')}
            </Text>
            <Text style={styles.injuryBannerSubtext}>Be careful during training — tap to manage</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>
      )}

      <View style={styles.fixedBackground}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Training Plan</Text>
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
            <View style={styles.sheetHeader}>
              <Text style={styles.sectionTitle}>Workouts for {new Date(selectedDate).toDateString()}</Text>
              <View style={styles.sheetHeaderBtns}>
                <TouchableOpacity style={styles.sheetBtnAi} onPress={openAiModal}>
                  <Ionicons name="sparkles" size={16} color="white" />
                  <Text style={styles.sheetBtnText}>AI Program</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.sheetBtnAdd} onPress={() => router.push('/clients/create-session')}>
                  <Ionicons name="add" size={16} color="white" />
                  <Text style={styles.sheetBtnText}>New Training</Text>
                </TouchableOpacity>
              </View>
            </View>

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
      </Animated.View>

      <Modal visible={detailModalVisible} animationType="slide" transparent onRequestClose={() => setDetailModalVisible(false)}>
          <Pressable style={styles.modalBackground} onPress={() => setDetailModalVisible(false)}>
              <Pressable style={styles.modalContainer} onPress={(e) => e.stopPropagation()}>
                  {selectedWorkout && (
                      <>
                        <View style={[styles.modalHeader, selectedWorkout.is_ai_generated && {borderBottomColor: '#f39c12'}]}>
                            <View style={{flex: 1, marginRight: 20}}>
                                <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
                                  <Text style={[styles.modalTitle, selectedWorkout.is_ai_generated && {color: '#f39c12'}, {flexShrink: 1}]} numberOfLines={1}>{selectedWorkout.name}</Text>
                                  {selectedWorkout.is_ai_generated && <Ionicons name="sparkles" size={16} color="#f39c12" />}
                                </View>
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

                        {selectedWorkout.is_ai_generated && selectedWorkout.description && (
                          <View style={styles.aiDescriptionBox}>
                            <View style={{flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6}}>
                              <Ionicons name="sparkles" size={14} color="#f39c12" />
                              <Text style={{color: '#f39c12', fontWeight: 'bold', fontSize: 13}}>AI Coach Explanation</Text>
                            </View>
                            <Text style={styles.aiDescriptionText}>{selectedWorkout.description}</Text>
                          </View>
                        )}

                        <ScrollView style={{marginTop: 15}} showsVerticalScrollIndicator={false} keyboardDismissMode="on-drag">
                            {editExercises.map((exo: any, exoIdx: number) => {
                                const isDur = isDurationExercise(exo);
                                return (
                                  <View key={exo._id || exoIdx} style={styles.detailRow}>
                                    <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 8}}>
                                        <Text style={styles.detailExoName}>{exoIdx+1}. {exo.name}</Text>
                                        <View style={styles.muscleBadge}>
                                            <Text style={styles.detailMuscle}>{exo.muscle}</Text>
                                        </View>
                                        <View style={{flex: 1}} />
                                        <TouchableOpacity onPress={() => removeExercise(exoIdx)} style={{padding: 4}}>
                                            <Ionicons name="trash-outline" size={20} color="#e74c3c" />
                                        </TouchableOpacity>
                                    </View>

                                    {/* Sets header */}
                                    <View style={{flexDirection: 'row', paddingHorizontal: 8, marginBottom: 4}}>
                                      <Text style={{color: '#888', fontSize: 11, width: 35}}>Set</Text>
                                      <Text style={{color: '#888', fontSize: 11, flex: 1, textAlign: 'center'}}>{isDur ? 'Time (s)' : 'Reps'}</Text>
                                      {!isDur && <Text style={{color: '#888', fontSize: 11, flex: 1, textAlign: 'center'}}>Weight (kg)</Text>}
                                      <View style={{width: 28}} />
                                    </View>

                                    <View style={styles.setsContainer}>
                                        {(exo.sets_details || []).map((s: any, setIdx: number) => (
                                            <View key={setIdx} style={styles.editSetRow}>
                                                <Text style={styles.setNumber}>S{setIdx + 1}</Text>
                                                <View style={{flex: 1, paddingHorizontal: 4}}>
                                                  <TextInput
                                                    style={styles.editSetInput}
                                                    keyboardType="numeric"
                                                    value={String(isDur ? (s.duration || 0) : (s.reps || 0))}
                                                    onChangeText={(v) => updateSetField(exoIdx, setIdx, isDur ? 'duration' : 'reps', v)}
                                                  />
                                                </View>
                                                {!isDur && (
                                                  <View style={{flex: 1, paddingHorizontal: 4}}>
                                                    <TextInput
                                                      style={styles.editSetInput}
                                                      keyboardType="numeric"
                                                      value={String(s.weight || 0)}
                                                      onChangeText={(v) => updateSetField(exoIdx, setIdx, 'weight', v)}
                                                    />
                                                  </View>
                                                )}
                                                <TouchableOpacity onPress={() => removeSetFromExercise(exoIdx, setIdx)} style={{width: 28, alignItems: 'center'}}>
                                                    <Ionicons name="close-circle" size={18} color="#e74c3c" />
                                                </TouchableOpacity>
                                            </View>
                                        ))}
                                        <TouchableOpacity onPress={() => addSetToExercise(exoIdx)} style={{alignSelf: 'center', paddingVertical: 6}}>
                                            <Text style={{color: '#3498DB', fontWeight: 'bold', fontSize: 13}}>+ Add Set</Text>
                                        </TouchableOpacity>
                                    </View>
                                  </View>
                                );
                            })}

                            {/* Add exercise button */}
                            <TouchableOpacity style={styles.addExoBtn} onPress={openAddExoModal}>
                                <Ionicons name="add-circle-outline" size={20} color="#3498DB" />
                                <Text style={{color: '#3498DB', fontWeight: 'bold', marginLeft: 8}}>Add Exercise</Text>
                            </TouchableOpacity>

                            <View style={{height: 20}} />
                        </ScrollView>

                        {/* Save button */}
                        <TouchableOpacity style={styles.saveWorkoutBtn} onPress={handleSaveWorkout} disabled={saving}>
                            {saving ? <ActivityIndicator color="white" /> : (
                              <Text style={{color: 'white', fontWeight: 'bold', fontSize: 16}}>Save Changes</Text>
                            )}
                        </TouchableOpacity>
                      </>
                  )}
              </Pressable>
          </Pressable>
      </Modal>

      {/* Add exercise modal */}
      <Modal visible={addExoModalVisible} animationType="slide" onRequestClose={() => setAddExoModalVisible(false)}>
          <View style={styles.addExoModalContainer}>
              <View style={styles.addExoModalHeader}>
                  {addExoStep === 'exercises' ? (
                      <TouchableOpacity onPress={() => { setAddExoStep('muscles'); setAddExoListData(getUniqueMuscles()); }} style={{flexDirection: 'row', alignItems: 'center'}}>
                          <Ionicons name="chevron-back" size={24} color="#3498DB" />
                          <Text style={{color: '#3498DB', fontSize: 16}}>Back</Text>
                      </TouchableOpacity>
                  ) : <View style={{width: 50}} />}
                  <Text style={{color: 'white', fontSize: 18, fontWeight: 'bold'}}>{addExoStep === 'muscles' ? 'Select Muscle' : 'Select Exercise'}</Text>
                  <TouchableOpacity onPress={() => setAddExoModalVisible(false)}>
                      <Text style={{color: '#3498DB', fontSize: 16, fontWeight: 'bold'}}>Close</Text>
                  </TouchableOpacity>
              </View>
              <FlatList
                  data={addExoListData}
                  keyExtractor={(_, index) => index.toString()}
                  renderItem={({item}) => (
                      <TouchableOpacity
                        style={styles.addExoModalItem}
                        onPress={() => addExoStep === 'muscles' ? handleAddExoSelectMuscle(item) : handleAddExoSelect(item)}
                      >
                          <Text style={{color: 'white', fontSize: 16}}>{typeof item === 'string' ? item.toUpperCase() : item.name}</Text>
                          <Ionicons name="chevron-forward" size={20} color="#666" />
                      </TouchableOpacity>
                  )}
              />
          </View>
      </Modal>

      {/* AI Program day selection modal */}
      <Modal visible={aiModalVisible} animationType="slide" transparent onRequestClose={() => setAiModalVisible(false)}>
        <Pressable style={styles.modalBackground} onPress={() => !generating && setAiModalVisible(false)}>
          <Pressable style={styles.aiModalContainer} onPress={(e) => e.stopPropagation()}>
            <View style={styles.aiModalHeader}>
              <Ionicons name="sparkles" size={24} color="#f39c12" />
              <Text style={styles.aiModalTitle}>AI Training Program</Text>
              <TouchableOpacity onPress={() => !generating && setAiModalVisible(false)}>
                <Ionicons name="close-circle" size={28} color="#666" />
              </TouchableOpacity>
            </View>

            <Text style={styles.aiModalSubtitle}>
              Select the days you want to train this week. The AI will generate personalized workouts based on your profile, goals, and fitness level.
            </Text>

            <ScrollView style={{maxHeight: 400}} showsVerticalScrollIndicator={false}>
              {getNext7Days().map((day) => {
                const pref = dayPrefs[day.date];
                const isSelected = !!pref?.enabled;
                return (
                  <View key={day.date}>
                    <TouchableOpacity
                      style={[styles.aiDayRow, isSelected && styles.aiDayRowSelected]}
                      onPress={() => toggleDay(day.date)}
                      disabled={generating}
                    >
                      <Ionicons
                        name={isSelected ? "checkbox" : "square-outline"}
                        size={24}
                        color={isSelected ? "#f39c12" : "#666"}
                      />
                      <Text style={[styles.aiDayText, isSelected && {color: '#f39c12'}]}>
                        {day.label}
                      </Text>
                    </TouchableOpacity>

                    {isSelected && (
                      <View style={styles.aiDayOptions}>
                        {/* Focus selector */}
                        <Text style={styles.aiOptionLabel}>Focus</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 8}}>
                          {FOCUS_OPTIONS.map(f => (
                            <TouchableOpacity
                              key={f}
                              style={[styles.aiChip, pref.focus === f && styles.aiChipActive]}
                              onPress={() => updateDayPref(day.date, 'focus', f)}
                            >
                              <Text style={[styles.aiChipText, pref.focus === f && styles.aiChipTextActive]}>{f}</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>

                        {/* Mode selector */}
                        <Text style={styles.aiOptionLabel}>Load Mode</Text>
                        <View style={{flexDirection: 'row', gap: 6}}>
                          {MODE_OPTIONS.map(m => (
                            <TouchableOpacity
                              key={m.key}
                              style={[styles.aiModeBtn, pref.mode === m.key && styles.aiModeBtnActive]}
                              onPress={() => updateDayPref(day.date, 'mode', m.key)}
                            >
                              <Text style={[styles.aiModeBtnText, pref.mode === m.key && {color: '#f39c12'}]}>{m.label}</Text>
                              <Text style={styles.aiModeBtnDesc}>{m.desc}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={[styles.aiGenerateBtn, generating && {opacity: 0.6}]}
              onPress={handleGenerateProgram}
              disabled={generating}
            >
              {generating ? (
                <View style={{flexDirection: 'row', alignItems: 'center', gap: 10}}>
                  <ActivityIndicator color="white" />
                  <Text style={{color: 'white', fontWeight: 'bold', fontSize: 16}}>Generating...</Text>
                </View>
              ) : (
                <Text style={{color: 'white', fontWeight: 'bold', fontSize: 16}}>Generate Program</Text>
              )}
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* AI Program Preview / Validation Modal */}
      <Modal visible={previewModalVisible} animationType="slide" transparent onRequestClose={() => !savingProgram && setPreviewModalVisible(false)}>
        <Pressable style={styles.modalBackground} onPress={() => !savingProgram && setPreviewModalVisible(false)}>
          <Pressable style={styles.previewModalContainer} onPress={(e) => e.stopPropagation()}>
            <View style={styles.previewHeader}>
              <Ionicons name="sparkles" size={24} color="#f39c12" />
              <Text style={styles.previewTitle}>Review Your Program</Text>
              <TouchableOpacity onPress={() => !savingProgram && handleRejectProgram()}>
                <Ionicons name="close-circle" size={28} color="#666" />
              </TouchableOpacity>
            </View>

            <Text style={styles.previewSubtitle}>
              The AI has generated {previewWorkouts.length} workout{previewWorkouts.length > 1 ? 's' : ''} for you. Review the details below before confirming.
            </Text>

            <ScrollView style={{maxHeight: '70%'}} showsVerticalScrollIndicator={false}>
              {previewWorkouts.map((workout: any, wIdx: number) => {
                const dateLabel = new Date(workout.scheduled_date).toLocaleDateString('en-US', {
                  weekday: 'long', month: 'short', day: 'numeric'
                });
                const exercises = workout.exercises || [];
                return (
                  <View key={wIdx} style={styles.previewCard}>
                    <View style={styles.previewCardHeader}>
                      <View style={{flex: 1}}>
                        <Text style={styles.previewCardDate}>{dateLabel}</Text>
                        <Text style={styles.previewCardName}>{workout.name}</Text>
                      </View>
                      <View style={styles.previewBadge}>
                        <Text style={styles.previewBadgeText}>{workout.difficulty}</Text>
                      </View>
                    </View>

                    {workout.description && (
                      <View style={styles.previewDescriptionBox}>
                        <Ionicons name="bulb-outline" size={14} color="#f39c12" />
                        <Text style={styles.previewDescriptionText}>{workout.description}</Text>
                      </View>
                    )}

                    <View style={styles.previewExercisesList}>
                      {exercises.map((ex: any, eIdx: number) => {
                        const sets = ex.sets_details || [];
                        const isDur = sets.length > 0 && sets[0].duration > 0 && (!sets[0].reps || sets[0].reps === 0);
                        return (
                          <View key={eIdx} style={styles.previewExoRow}>
                            <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 4}}>
                              <Text style={styles.previewExoName}>{eIdx + 1}. {ex.name}</Text>
                              <View style={styles.previewMuscleBadge}>
                                <Text style={styles.previewMuscleText}>{ex.muscle}</Text>
                              </View>
                            </View>
                            <Text style={styles.previewExoDetails}>
                              {sets.length} set{sets.length > 1 ? 's' : ''} • {
                                isDur
                                  ? sets.map((s: any) => `${s.duration}s`).join(' / ')
                                  : sets.map((s: any) => `${s.reps} reps${s.weight ? ` @ ${s.weight}kg` : ''}`).join(' / ')
                              }
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            <View style={styles.previewButtons}>
              <TouchableOpacity style={styles.previewRejectBtn} onPress={handleRejectProgram} disabled={savingProgram}>
                <Ionicons name="close" size={20} color="#e74c3c" />
                <Text style={styles.previewRejectText}>Reject</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.previewAcceptBtn} onPress={handleAcceptProgram} disabled={savingProgram}>
                {savingProgram ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={20} color="white" />
                    <Text style={styles.previewAcceptText}>Accept & Save</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
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
  sectionTitle: { color: '#888', fontSize: 14, textTransform: 'uppercase', letterSpacing: 1, flex: 1 },
  
  card: { flexDirection: 'row', backgroundColor: '#1A1F2B', padding: 15, borderRadius: 12, marginBottom: 12, alignItems: 'center' },
  cardCompleted: { backgroundColor: '#1e2530', opacity: 0.8 },
  cardAi: { backgroundColor: '#2a2310', borderWidth: 1, borderColor: 'rgba(243, 156, 18, 0.3)' },
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
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sheetHeaderBtns: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sheetBtnAi: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f39c12', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, gap: 5 },
  sheetBtnText: { color: 'white', fontWeight: 'bold', fontSize: 12 },
  sheetBtnAdd: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#3498DB', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, gap: 5 },
  
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
  setNumber: { color: '#888', fontSize: 13, fontWeight: 'bold', width: 35 },
  setValues: { flexDirection: 'row', alignItems: 'center' },
  setValueText: { color: 'white', fontSize: 14, fontWeight: 'bold', width: 70, textAlign: 'right' },
  setWeightText: { color: '#3498DB', fontSize: 14, fontWeight: 'bold', marginLeft: 10, width: 60, textAlign: 'right' },

  editSetRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  editSetInput: { backgroundColor: '#1A1F2B', color: 'white', paddingVertical: 6, borderRadius: 6, textAlign: 'center', fontSize: 14 },
  addExoBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderWidth: 1, borderColor: '#3498DB', borderStyle: 'dashed', borderRadius: 10, marginTop: 10 },
  saveWorkoutBtn: { backgroundColor: '#2ecc71', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 10 },

  injuryBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#C0392B', borderRadius: 16, padding: 14, marginHorizontal: 20, marginTop: 10, gap: 12 },
  injuryBannerIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(0,0,0,0.2)', justifyContent: 'center', alignItems: 'center' },
  injuryBannerTitle: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  injuryBannerText: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '600', marginTop: 2 },
  injuryBannerSubtext: { color: 'rgba(255,255,255,0.55)', fontSize: 11, marginTop: 3 },

  aiDescriptionBox: { backgroundColor: 'rgba(243, 156, 18, 0.1)', borderWidth: 1, borderColor: 'rgba(243, 156, 18, 0.3)', borderRadius: 10, padding: 12, marginTop: 12 },
  aiDescriptionText: { color: 'rgba(255,255,255,0.8)', fontSize: 13, lineHeight: 18 },

  addExoModalContainer: { flex: 1, backgroundColor: '#1A1F2B' },
  addExoModalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderColor: '#2A4562', alignItems: 'center' },
  addExoModalItem: { padding: 20, borderBottomWidth: 1, borderColor: '#2A4562', flexDirection: 'row', justifyContent: 'space-between' },

  aiModalContainer: { backgroundColor: '#1A1F2B', borderRadius: 20, padding: 20, marginHorizontal: 10, borderWidth: 1, borderColor: '#f39c12' },
  aiModalHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  aiModalTitle: { color: 'white', fontSize: 20, fontWeight: 'bold', flex: 1 },
  aiModalSubtitle: { color: '#888', fontSize: 13, marginBottom: 15, lineHeight: 18 },
  aiDayRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 10, borderRadius: 10 },
  aiDayRowSelected: { backgroundColor: 'rgba(243, 156, 18, 0.1)' },
  aiDayText: { color: 'white', fontSize: 16 },
  aiDayOptions: { paddingHorizontal: 14, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  aiOptionLabel: { color: '#888', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  aiChip: { backgroundColor: '#232D3F', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, marginRight: 6 },
  aiChipActive: { backgroundColor: 'rgba(243, 156, 18, 0.2)', borderWidth: 1, borderColor: '#f39c12' },
  aiChipText: { color: '#888', fontSize: 12, fontWeight: '600' },
  aiChipTextActive: { color: '#f39c12' },
  aiModeBtn: { flex: 1, backgroundColor: '#232D3F', padding: 8, borderRadius: 8, alignItems: 'center' },
  aiModeBtnActive: { backgroundColor: 'rgba(243, 156, 18, 0.15)', borderWidth: 1, borderColor: '#f39c12' },
  aiModeBtnText: { color: 'white', fontSize: 12, fontWeight: 'bold', marginBottom: 2 },
  aiModeBtnDesc: { color: '#666', fontSize: 9, textAlign: 'center' },
  aiGenerateBtn: { backgroundColor: '#f39c12', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 15 },

  previewModalContainer: { backgroundColor: '#1A1F2B', borderRadius: 20, padding: 20, marginHorizontal: 10, borderWidth: 1, borderColor: '#f39c12', maxHeight: '90%' },
  previewHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  previewTitle: { color: 'white', fontSize: 20, fontWeight: 'bold', flex: 1 },
  previewSubtitle: { color: '#888', fontSize: 13, marginBottom: 15, lineHeight: 18 },

  previewCard: { backgroundColor: '#232D3F', borderRadius: 12, padding: 14, marginBottom: 12, borderLeftWidth: 3, borderLeftColor: '#f39c12' },
  previewCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  previewCardDate: { color: '#f39c12', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  previewCardName: { color: 'white', fontSize: 16, fontWeight: 'bold', marginTop: 2 },
  previewBadge: { backgroundColor: 'rgba(243, 156, 18, 0.2)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  previewBadgeText: { color: '#f39c12', fontSize: 11, fontWeight: 'bold' },

  previewDescriptionBox: { flexDirection: 'row', backgroundColor: 'rgba(243, 156, 18, 0.08)', borderRadius: 8, padding: 10, marginBottom: 10, gap: 8, alignItems: 'flex-start' },
  previewDescriptionText: { color: 'rgba(255,255,255,0.75)', fontSize: 12, lineHeight: 17, flex: 1 },

  previewExercisesList: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 8 },
  previewExoRow: { paddingVertical: 6 },
  previewExoName: { color: 'white', fontSize: 14, fontWeight: '600', marginRight: 8 },
  previewMuscleBadge: { backgroundColor: '#2A4562', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  previewMuscleText: { color: '#3498DB', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
  previewExoDetails: { color: '#888', fontSize: 12, marginTop: 2 },

  previewButtons: { flexDirection: 'row', gap: 10, marginTop: 15 },
  previewRejectBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: '#e74c3c', backgroundColor: 'rgba(231, 76, 60, 0.1)' },
  previewRejectText: { color: '#e74c3c', fontWeight: 'bold', fontSize: 15 },
  previewAcceptBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 12, backgroundColor: '#2ecc71' },
  previewAcceptText: { color: 'white', fontWeight: 'bold', fontSize: 15 },
});

export default TrainingDashboard;