import React, { useState } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, 
  Alert, KeyboardAvoidingView, Platform, ActivityIndicator, Modal, FlatList 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import axios from 'axios';
import Constants from 'expo-constants';
import DateTimePicker from '@react-native-community/datetimepicker'; 
import { getToken } from '@/services/authStorage';
import { getUniqueMuscles, getExercisesByMuscle, ExerciseType } from '@/constants/exercisesData';

interface SetDetail {
  set_number: number;
  reps: number;
  weight: number;
  duration: number;
}

interface LocalExercise {
  id: number;
  name: string;
  muscle: string;
  type: ExerciseType;
  num_sets: number;
  sets_details: SetDetail[];
}

const CreateSessionScreen = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const API_URL = Constants.expoConfig?.extra?.API_URL ?? '';

  const [sessionName, setSessionName] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [exercises, setExercises] = useState<LocalExercise[]>([]);
  const [loadingSave, setLoadingSave] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [modalStep, setModalStep] = useState<'muscles' | 'exercises'>('muscles');
  const [listData, setListData] = useState<any[]>([]); 
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);

  const [selectedExoData, setSelectedExoData] = useState<any>(null);
  const [currentSets, setCurrentSets] = useState<SetDetail[]>([{ set_number: 1, reps: 10, weight: 0, duration: 0 }]);

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) setDate(selectedDate);
    if(Platform.OS === 'android') setShowDatePicker(false);
  };

  const openAddModal = () => {
    setModalVisible(true);
    setModalStep('muscles');
    setListData(getUniqueMuscles());
  };

  const handleSelectMuscle = (muscle: string) => {
      setSelectedMuscle(muscle);
      setModalStep('exercises');
      setListData(getExercisesByMuscle(muscle));
  };

  const handleBackToMuscles = () => {
      setModalStep('muscles');
      setListData(getUniqueMuscles());
  };

  const handleSelectExercise = (exerciseObj: any) => {
      const isDuration = exerciseObj.type === 'duration';
      setSelectedExoData(exerciseObj);
      setCurrentSets([{ 
          set_number: 1, 
          reps: isDuration ? 0 : 10, 
          weight: 0, 
          duration: isDuration ? 60 : 0 
      }]);
      setModalVisible(false);
  };

  const handleConfirmExercise = () => {
    if (!selectedExoData) return Alert.alert('Error', 'Please select an exercise.');
    const newExo: LocalExercise = {
      id: Date.now(),
      name: selectedExoData.name,
      muscle: selectedMuscle || 'Global',
      type: selectedExoData.type,
      num_sets: currentSets.length,
      sets_details: [...currentSets]
    };
    setExercises([...exercises, newExo]);
    setSelectedExoData(null); 
    setCurrentSets([{ set_number: 1, reps: 10, weight: 0, duration: 0 }]);
  };

  const handleEditExercise = (exo: LocalExercise) => {
    if (selectedExoData) {
        Alert.alert("Edition in progress", "Please confirm or cancel the current exercise before editing another one.");
        return;
    }
    setSelectedExoData({ name: exo.name, type: exo.type });
    setSelectedMuscle(exo.muscle);
    setCurrentSets(exo.sets_details);
    setExercises(exercises.filter(e => e.id !== exo.id));
  };

  const handleAddSet = () => {
      const lastSet = currentSets[currentSets.length - 1];
      setCurrentSets([...currentSets, { ...lastSet, set_number: currentSets.length + 1 }]);
  };

  const handleRemoveSet = (index: number) => {
      if (currentSets.length > 1) {
          const updated = currentSets.filter((_, i) => i !== index).map((s, i) => ({ ...s, set_number: i + 1 }));
          setCurrentSets(updated);
      }
  };

  const updateCurrentSet = (index: number, field: keyof SetDetail, value: string) => {
    const updated = [...currentSets];
    updated[index] = { ...updated[index], [field]: parseFloat(value) || 0 };
    setCurrentSets(updated);
  };

  const removeExerciseFromList = (id: number) => {
    setExercises(exercises.filter(e => e.id !== id));
  };

  const handleSaveSession = async () => {
      if (!sessionName.trim() || exercises.length === 0) {
          Alert.alert("Missing Info", "Name and Exercises required.");
          return;
      }
      setLoadingSave(true);
      try {
          const token = await getToken();
          const payload = {
              name: sessionName,
              description: "Custom Session",
              difficulty: "Intermediate",
              scheduled_date: date.toISOString(),
              exercises: exercises.map(e => ({
                  name: e.name,
                  muscle: e.muscle,
                  num_sets: e.sets_details.length,
                  rest_time: 60,
                  sets_details: e.sets_details.map(s => ({
                      set_number: s.set_number,
                      reps: s.reps,
                      weight: s.weight,
                      duration: s.duration
                  }))
              }))
          };
          await axios.post(`${API_URL}/workouts/create`, payload, {
              headers: { Authorization: `Bearer ${token}` }
          });
          router.back();
      } catch (error: any) {
          if (error.response) console.log("ERR 422 DETAILS:", error.response.data.detail);
          Alert.alert("Error", "Could not create workout.");
      } finally {
          setLoadingSave(false);
      }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{padding: 5}}>
            <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Workout</Text>
        <View style={{width: 30}} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{flex: 1}}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardDismissMode="on-drag">
            
            <View style={styles.section}>
                <Text style={styles.label}>Workout Name</Text>
                <TextInput style={styles.input} placeholder="e.g. Leg Day" placeholderTextColor="#666" value={sessionName} onChangeText={setSessionName} />
                <TouchableOpacity style={styles.dateBtn} onPress={() => setShowDatePicker(true)}>
                    <Ionicons name="calendar-outline" size={20} color="white" />
                    <Text style={styles.dateText}>{date.toLocaleDateString()} at {date.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</Text>
                </TouchableOpacity>
                {showDatePicker && <DateTimePicker value={date} mode="datetime" display="default" onChange={onDateChange} themeVariant="dark" />}
            </View>

            {exercises.length > 0 && (
                <View style={styles.section}>
                    <Text style={[styles.label, {color: '#3498DB'}]}>Exercises List</Text>
                    {exercises.map((exo) => (
                        <View key={exo.id} style={styles.exoItem}>
                            <View style={{flex: 1}}>
                                <Text style={styles.exoNameFinal}>{exo.name}</Text>
                                <Text style={styles.exoMuscleFinal}>{exo.muscle.toUpperCase()}</Text>
                            </View>
                            <View style={{flexDirection: 'row', alignItems: 'center'}}>
                                <TouchableOpacity onPress={() => handleEditExercise(exo)} style={{marginRight: 15}}>
                                    <Ionicons name="create-outline" size={22} color="#3498DB" />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => removeExerciseFromList(exo.id)}>
                                    <Ionicons name="trash-outline" size={22} color="#e74c3c" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))}
                </View>
            )}

            <View style={styles.addExoCard}>
                <Text style={styles.addExoTitle}>{selectedExoData ? "Configure Exercise" : "Add Exercise"}</Text>
                <TouchableOpacity style={styles.exoSelectorBtn} onPress={openAddModal}>
                    <Text style={{color: selectedExoData ? 'white' : '#888'}}>
                        {selectedExoData ? selectedExoData.name : "Choose from list..."}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color="#888" />
                </TouchableOpacity>

                {selectedExoData && (
                    <>
                        <View style={styles.setsHeader}>
                            <Text style={styles.colHeader}>Set</Text>
                            <Text style={[styles.colHeader, {flex: 1, textAlign: 'center'}]}>
                                {selectedExoData.type === 'strength' ? 'Reps' : 'Time (s)'}
                            </Text>
                            {selectedExoData.type === 'strength' && (
                                <Text style={[styles.colHeader, {flex: 1, textAlign: 'center'}]}>Weight</Text>
                            )}
                            <View style={{width: 30}} />
                        </View>

                        {currentSets.map((set, index) => (
                            <View key={index} style={styles.setRow}>
                                <Text style={styles.setNumLabel}>S{index + 1}</Text>
                                <View style={{flex: 1, paddingHorizontal: 5}}>
                                    <TextInput 
                                        style={styles.setInput} 
                                        keyboardType="numeric" 
                                        value={String(selectedExoData.type === 'strength' ? set.reps : set.duration)} 
                                        onChangeText={(v) => updateCurrentSet(index, selectedExoData.type === 'strength' ? 'reps' : 'duration', v)} 
                                    />
                                </View>
                                {selectedExoData.type === 'strength' && (
                                    <View style={{flex: 1, paddingHorizontal: 5}}>
                                        <TextInput 
                                            style={styles.setInput} 
                                            keyboardType="numeric" 
                                            value={String(set.weight)} 
                                            onChangeText={(v) => updateCurrentSet(index, 'weight', v)} 
                                        />
                                    </View>
                                )}
                                <TouchableOpacity onPress={() => handleRemoveSet(index)} style={{width: 30, alignItems: 'flex-end'}}>
                                    <Ionicons name="close-circle" size={22} color="#e74c3c" />
                                </TouchableOpacity>
                            </View>
                        ))}
                        <TouchableOpacity style={styles.addSetBtn} onPress={handleAddSet}>
                            <Text style={{color: '#3498DB', fontWeight: 'bold'}}>+ Add Set</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.confirmExoButton} onPress={handleConfirmExercise}>
                            <Text style={styles.buttonText}>Confirm Exercise</Text>
                        </TouchableOpacity>
                    </>
                )}
            </View>
            <View style={{height: 120}} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* --- FOOTER : CENTRAGE HORIZONTAL ET VERTICAL PARFAIT --- */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <TouchableOpacity style={styles.saveBtn} onPress={handleSaveSession} disabled={loadingSave}>
              {loadingSave ? <ActivityIndicator color="white"/> : <Text style={styles.saveBtnText}>Save Workout</Text>}
          </TouchableOpacity>
      </View>

      <Modal visible={modalVisible} animationType="slide">
          <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
              <View style={styles.modalHeader}>
                  {modalStep === 'exercises' ? (
                      <TouchableOpacity onPress={handleBackToMuscles} style={{flexDirection: 'row', alignItems: 'center'}}>
                          <Ionicons name="chevron-back" size={24} color="#3498DB" />
                          <Text style={{color: '#3498DB', fontSize: 16}}>Back</Text>
                      </TouchableOpacity>
                  ) : <View style={{width: 50}} />}
                  <Text style={styles.modalTitle}>{modalStep === 'muscles' ? 'Select Muscle' : 'Select Exercise'}</Text>
                  <TouchableOpacity onPress={() => setModalVisible(false)}>
                      <Text style={{color: '#3498DB', fontSize: 16, fontWeight: 'bold'}}>Close</Text>
                  </TouchableOpacity>
              </View>
              <FlatList
                  data={listData}
                  keyExtractor={(_, index) => index.toString()}
                  renderItem={({item}) => (
                      <TouchableOpacity 
                        style={styles.modalItem}
                        onPress={() => modalStep === 'muscles' ? handleSelectMuscle(item) : handleSelectExercise(item)}
                      >
                          <Text style={styles.modalItemText}>{typeof item === 'string' ? item.toUpperCase() : item.name}</Text>
                          <Ionicons name="chevron-forward" size={20} color="#666" />
                      </TouchableOpacity>
                  )}
              />
          </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A1F2B' },
  header: { flexDirection: 'row', justifyContent:'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderColor: '#2A4562' },
  headerTitle: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  scrollContent: { padding: 20 },
  section: { marginBottom: 20 },
  label: { color: '#888', marginBottom: 8, fontSize: 13, fontWeight: 'bold' },
  input: { backgroundColor: '#2A4562', color: 'white', padding: 15, borderRadius: 10, marginBottom: 15 },
  dateBtn: { flexDirection: 'row', backgroundColor: '#2A4562', padding: 15, borderRadius: 10, alignItems: 'center' },
  dateText: { color: 'white', marginLeft: 10 },
  exoItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#232D3F', padding: 12, borderRadius: 10, marginBottom: 10, borderLeftWidth: 3, borderLeftColor: '#2ecc71' },
  exoNameFinal: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  exoMuscleFinal: { color: '#3498DB', fontSize: 10, fontWeight: 'bold', marginTop: 2 },
  addExoCard: { backgroundColor: '#232D3F', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#3498DB', borderStyle: 'dashed' },
  addExoTitle: { color: '#3498DB', fontWeight: 'bold', marginBottom: 15, textAlign: 'center', fontSize: 16 },
  exoSelectorBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#2A4562', padding: 15, borderRadius: 8, marginBottom: 15 },
  setsHeader: { flexDirection: 'row', marginBottom: 5, paddingHorizontal: 5 },
  colHeader: { color: '#888', fontSize: 12, fontWeight: 'bold' },
  setRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1F2B', paddingHorizontal: 5, paddingVertical: 8, borderRadius: 8, marginBottom: 8 },
  setNumLabel: { color: '#3498DB', fontWeight: 'bold', width: 30 },
  setInput: { backgroundColor: '#2A4562', color: 'white', paddingVertical: 8, borderRadius: 6, width: '100%', textAlign: 'center' },
  addSetBtn: { alignSelf: 'center', padding: 10 },
  confirmExoButton: { backgroundColor: '#3498DB', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  buttonText: { color: 'white', fontWeight: 'bold' },
  
  // FOOTER : Alignement centré horizontal
  footer: { 
    position: 'absolute', 
    bottom: 0, 
    width: '100%', 
    backgroundColor: '#1A1F2B', 
    borderTopWidth: 1, 
    borderColor: '#2A4562', 
    paddingTop: 8,
    alignItems: 'center', // 🔥 Centre le bouton horizontalement
  },
  
  saveBtn: { 
    backgroundColor: '#2ecc71', 
    width: '92%', // 🔥 Largeur uniforme et centrée
    padding: 14, 
    borderRadius: 12, 
    alignItems: 'center',
    justifyContent: 'center'
  }, 
  saveBtnText: { color: 'white', fontWeight: 'bold', fontSize: 18 },
  modalContainer: { flex: 1, backgroundColor: '#1A1F2B' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderColor: '#2A4562', alignItems: 'center' },
  modalTitle: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  modalItem: { padding: 20, borderBottomWidth: 1, borderColor: '#2A4562', flexDirection: 'row', justifyContent: 'space-between' },
  modalItemText: { color: 'white', fontSize: 16 }
});

export default CreateSessionScreen;