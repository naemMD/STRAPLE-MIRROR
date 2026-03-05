import React, { useEffect, useState, useMemo, useRef } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, ScrollView, 
  ActivityIndicator, Alert, Dimensions, Modal, TextInput, 
  KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import axios from 'axios';
import Constants from 'expo-constants';
import Toast from 'react-native-toast-message';
import { CameraView, useCameraPermissions } from 'expo-camera';

import { getUniqueMuscles, getExercisesByMuscle } from '@/constants/exercisesData';
import { getToken } from '@/services/authStorage';

const { width } = Dimensions.get('window');

const FoodImage = ({ uri, style, iconSize = 24 }: any) => {
  const hasValidImage = uri && uri !== '' && uri !== 'null';
  if (hasValidImage) {
    return <Image source={{ uri: uri }} style={style} />;
  } else {
    return (
      <View style={[style, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#2C3E50' }]}>
        <Ionicons name="fast-food-outline" size={iconSize} color="#888" />
      </View>
    );
  }
};

const goalLabels: { [key: string]: string } = {
  'lose_weight': '📉 Weight Loss',
  'gain_muscle': '💪 Muscle Gain',
  'maintain': '⚖️ Maintain'
};

const ClientDetailsScreen = () => {
  const navigation = useRouter();
  const params = useLocalSearchParams();
  const API_URL = Constants.expoConfig?.extra?.API_URL ?? '';

  const [clientData, setClientData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());

  // --- NUTRITION GOALS STATES ---
  const [isModalVisible, setModalVisible] = useState(false);
  const [updatingGoals, setUpdatingGoals] = useState(false);
  const [editCalories, setEditCalories] = useState('');
  const [editProteins, setEditProteins] = useState('');
  const [editCarbs, setEditCarbs] = useState('');
  const [editFats, setEditFats] = useState('');

  // --- WORKOUTS STATES ---
  const [isWorkoutModalVisible, setWorkoutModalVisible] = useState(false);
  const [savingWorkout, setSavingWorkout] = useState(false);
  const [workoutName, setWorkoutName] = useState('');
  const [workoutDifficulty, setWorkoutDifficulty] = useState('Medium');
  const [exercises, setExercises] = useState<any[]>([]);
  const [editingWorkoutId, setEditingWorkoutId] = useState<number | null>(null);
  const [isExoSelectorVisible, setIsExoSelectorVisible] = useState(false);
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);
  const [exoSearch, setExoSearch] = useState('');
  const [selectedExoData, setSelectedExoData] = useState<any>(null);
  const [expandedWorkouts, setExpandedWorkouts] = useState<number[]>([]);
  const [currentSets, setCurrentSets] = useState<any[]>([{ reps: '10', duration: '0', weight: '0' }]);

  // --- MEALS STATES ---
  const [isMealModalVisible, setIsMealModalVisible] = useState(false);
  const [savingMeal, setSavingMeal] = useState(false);
  const [mealName, setMealName] = useState('');
  const [expandedMeals, setExpandedMeals] = useState<number[]>([]);
  const [editingMealId, setEditingMealId] = useState<number | null>(null);
  const [selectedFoods, setSelectedFoods] = useState<any[]>([]);
  
  // --- FOOD SEARCH STATES ---
  const [foodSearchQuery, setFoodSearchQuery] = useState('');
  const [foodSearchWeight, setFoodSearchWeight] = useState('');
  const [foodSearchResults, setFoodSearchResults] = useState<any[]>([]);
  const [searchingFood, setSearchingFood] = useState(false);

  // --- SCANNER STATES ---
  const [permission, requestPermission] = useCameraPermissions();
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [scanned, setScanned] = useState(false);
  const isProcessingScan = useRef(false);
  
  // --- SCANNER DETAIL MODAL STATES ---
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
  const [scannedFood, setScannedFood] = useState<any>(null);
  const [scannedNutriments, setScannedNutriments] = useState<any>(null);
  const [scanGrammage, setScanGrammage] = useState('');

  const clientId = params.clientId;

  const loadData = async () => {
    setLoading(true);
    try {
      if (clientId) {
          const token = await getToken();
          const formattedDate = selectedDate.toISOString().split('T')[0];
          const response = await axios.get(`${API_URL}/coaches/client-details/${clientId}`, {
              params: { target_date: formattedDate },
              headers: { Authorization: `Bearer ${token}` }
          });
          setClientData(response.data);
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Could not fetch client details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [clientId, selectedDate]);

  const changeDate = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate);
  };

  const safeParseJSON = (data: any) => {
    if (!data) return [];
    if (typeof data === 'string') {
      try { return JSON.parse(data); } catch (e) { return []; }
    }
    return data;
  };

  const toggleWorkoutExpand = (id: number) => {
    setExpandedWorkouts(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const toggleMealExpand = (id: number) => {
    setExpandedMeals(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const openEditModal = () => {
    setEditCalories(clientData?.goal_calories?.toString() || '2500');
    setEditProteins(clientData?.goals_macros?.proteins?.toString() || '150');
    setEditCarbs(clientData?.goals_macros?.carbs?.toString() || '250');
    setEditFats(clientData?.goals_macros?.fats?.toString() || '70');
    setModalVisible(true);
  };

  const handleUpdateGoals = async () => {
    setUpdatingGoals(true);
    try {
      const token = await getToken();
      const payload = {
        daily_caloric_needs: parseFloat(editCalories) || 0,
        goal_proteins: parseFloat(editProteins) || 0,
        goal_carbs: parseFloat(editCarbs) || 0,
        goal_fats: parseFloat(editFats) || 0,
      };
      await axios.patch(`${API_URL}/users/${clientId}/goals`, payload, {
          headers: { Authorization: `Bearer ${token}` }
      });
      setModalVisible(false);
      loadData();
      Toast.show({ type: 'success', text1: 'Goals updated! 🎯' });
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Could not update goals.' });
    } finally {
      setUpdatingGoals(false);
    }
  };

  const openCreateMealModal = () => {
    setEditingMealId(null);
    setMealName('');
    setSelectedFoods([]);
    setFoodSearchQuery('');
    setFoodSearchWeight('');
    setFoodSearchResults([]);
    setIsMealModalVisible(true);
  };

  const openEditMealModal = (meal: any) => {
    setEditingMealId(meal.id);
    setMealName(meal.name);
    
    const parsedItems = safeParseJSON(meal.aliments || meal.items);
    const mappedItems = parsedItems.map((item: any) => {
        const ratio = item.weight / 100;
        return {
            ...item,
            id: item.id || Date.now() + Math.random(),
            baseMacros: item.baseMacros || {
                energy: (parseFloat(item.macros?.energy) || 0) / ratio,
                proteins: (parseFloat(item.macros?.proteins) || 0) / ratio,
                carbohydrates: (parseFloat(item.macros?.carbohydrates) || 0) / ratio,
                lipids: (parseFloat(item.macros?.lipids) || 0) / ratio,
            }
        };
    });
    
    setSelectedFoods(mappedItems); 
    setFoodSearchQuery('');
    setFoodSearchWeight('');
    setFoodSearchResults([]);
    setIsMealModalVisible(true);
  };

  const searchFoodApi = async () => {
    if (!foodSearchWeight || isNaN(parseFloat(foodSearchWeight)) || parseFloat(foodSearchWeight) <= 0) {
      Alert.alert("Weight Missing", "Please enter a weight (grams) BEFORE searching.");
      return; 
    }
    if (!foodSearchQuery.trim()) return;

    setSearchingFood(true);
    try {
      const response = await axios.get(`${API_URL}/getAlimentFromApi/${foodSearchQuery}`);
      setFoodSearchResults(response.data.map((food: any) => ({
          name: food.name,
          image: food.image,
          code: food.code || food.id || food.barcode || null
      })));
    } catch (error) {
      setFoodSearchResults([]);
    }
    setSearchingFood(false);
  };

  const handleSelectFoodResult = async (item: any) => {
    if (!foodSearchWeight) {
        Alert.alert("Error", "Weight is missing.");
        return;
    }

    setSearchingFood(true);
    try {
      const response = await axios.get(`${API_URL}/getAlimentNutriment/${item.code}/${foodSearchWeight}`);
      const foodDetails = response.data;
      const weightNum = parseFloat(foodSearchWeight);
      const ratio = weightNum / 100;

      const newItem = {
        id: Date.now() + Math.random(),
        name: item.name, 
        image: item.image, 
        weight: weightNum, 
        code: item.code,
        baseMacros: {
          energy: (parseFloat(foodDetails.energy) || 0) / ratio, 
          proteins: (parseFloat(foodDetails.proteins) || 0) / ratio,
          carbohydrates: (parseFloat(foodDetails.carbohydrates) || 0) / ratio, 
          lipids: (parseFloat(foodDetails.lipids) || 0) / ratio, 
        }
      };

      setSelectedFoods(prev => [...prev, newItem]);
      setFoodSearchResults([]); 
      setFoodSearchQuery(''); 
      setFoodSearchWeight('');
    } catch (error) {
      Alert.alert("Error", "Could not fetch food details.");
    }
    setSearchingFood(false);
  };

  const updateFoodWeight = (id: number, weight: string) => {
    const val = parseFloat(weight) || 0;
    setSelectedFoods(selectedFoods.map(f => f.id === id ? { ...f, weight: val } : f));
  };

  const removeSelectedFood = (indexToRemove: number) => {
      setSelectedFoods(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const totalMealMacros = useMemo(() => {
    return selectedFoods.reduce((acc, item) => {
      const ratio = item.weight / 100;
      return {
        calories: acc.calories + ((item.baseMacros?.energy || 0) * ratio),
        proteins: acc.proteins + ((item.baseMacros?.proteins || 0) * ratio),
        carbs: acc.carbs + ((item.baseMacros?.carbohydrates || 0) * ratio),
        fats: acc.fats + ((item.baseMacros?.lipids || 0) * ratio),
      };
    }, { calories: 0, proteins: 0, carbs: 0, fats: 0 });
  }, [selectedFoods]);

  const handleSaveMeal = async () => {
    if (!mealName.trim() || selectedFoods.length === 0) {
        return Alert.alert("Error", "Please provide a name and add at least one food item.");
    }
    setSavingMeal(true);
    try {
      const token = await getToken();
      
      const payload = {
        name: mealName,
        total_calories: totalMealMacros.calories,
        total_proteins: totalMealMacros.proteins,
        total_carbohydrates: totalMealMacros.carbs,
        total_lipids: totalMealMacros.fats,
        date_of_meal: selectedDate.toISOString(),
        aliments: selectedFoods.map(f => ({
            name: f.name,
            image: f.image,
            code: f.code,
            weight: f.weight,
            macros: {
                energy: f.baseMacros.energy * (f.weight / 100),
                proteins: f.baseMacros.proteins * (f.weight / 100),
                carbohydrates: f.baseMacros.carbohydrates * (f.weight / 100),
                lipids: f.baseMacros.lipids * (f.weight / 100)
            }
        })) 
      };

      if (editingMealId) {
        await axios.put(`${API_URL}/coaches/meals/${editingMealId}`, payload, { headers: { Authorization: `Bearer ${token}` } });
      } else {
        await axios.post(`${API_URL}/coaches/clients/${clientId}/meals/create`, payload, { headers: { Authorization: `Bearer ${token}` } });
      }
      setIsMealModalVisible(false);
      setSelectedFoods([]);
      loadData();
      Toast.show({ type: 'success', text1: editingMealId ? 'Meal updated!' : 'Meal scheduled!' });
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error saving meal' });
    } finally {
      setSavingMeal(false);
    }
  };

  const handleDeleteMeal = async (id: number) => {
    Alert.alert("Delete Meal", "Are you sure you want to delete this meal?", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: async () => {
            const token = await getToken();
            await axios.delete(`${API_URL}/coaches/meals/${id}`, { headers: { Authorization: `Bearer ${token}` } });
            loadData();
            Toast.show({ type: 'success', text1: 'Meal deleted.' });
        }}
    ]);
  };

  const openCameraModal = async () => {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        Alert.alert("Permission Required", "Camera access is needed to scan barcodes.");
        return;
      }
    }
    isProcessingScan.current = false;
    setScanned(false);
    
    setIsMealModalVisible(false);
    setTimeout(() => { setIsCameraOpen(true); }, 400);
  };

  const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
      if (scanned || isProcessingScan.current) return;
      isProcessingScan.current = true;
      setScanned(true);

      try {
          const response = await axios.get(`${API_URL}/scan/${data}/json`);
          const foodData = { 
              name: response.data.name || 'Scanned Food', 
              code: data, 
              image: response.data.image 
          };
          
          setScannedNutriments(response.data);
          setScannedFood(foodData);
          setScanGrammage('');

          setIsCameraOpen(false);
          setTimeout(() => { setIsDetailModalVisible(true); }, 400);

      } catch (error) {
          Alert.alert("Not Found", "Product not found. Try manual search.");
          setIsCameraOpen(false);
          setTimeout(() => setIsMealModalVisible(true), 400);
      } finally {
          isProcessingScan.current = false;
      }
  };
  
  const validateGrammageScan = () => {
    if (!scannedNutriments) return;
    const g = parseFloat(scanGrammage);
    if (isNaN(g) || g <= 0) {
        Alert.alert("Invalid Weight", "Please enter a valid weight in grams.");
        return;
    }
    
    const newItem = { 
        id: Date.now() + Math.random(),
        ...scannedFood, 
        weight: g, 
        baseMacros: {
            energy: parseFloat(scannedNutriments.energy) || 0,
            proteins: parseFloat(scannedNutriments.proteins) || 0,
            carbohydrates: parseFloat(scannedNutriments.carbohydrates) || 0,
            lipids: parseFloat(scannedNutriments.lipids) || 0,
        }
    };
    
    setSelectedFoods(prev => [...prev, newItem]);
    setIsDetailModalVisible(false);
    setTimeout(() => setIsMealModalVisible(true), 400);
  };

  const handleEditWorkout = (workout: any) => {
    setEditingWorkoutId(workout.id);
    setWorkoutName(workout.name);
    setWorkoutDifficulty(workout.difficulty || 'Medium');
    const formattedExos = safeParseJSON(workout.exercises).map((exo: any) => ({
      name: exo.name,
      muscle: exo.muscle,
      num_sets: exo.num_sets,
      sets_details: safeParseJSON(exo.sets_details)
    }));
    setExercises(formattedExos);
    setSelectedExoData(null);
    setWorkoutModalVisible(true);
  };

  const handleDeleteWorkout = async (id: number) => {
    Alert.alert("Delete Workout", "Are you sure you want to delete this workout?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
          try {
            const token = await getToken();
            await axios.delete(`${API_URL}/coaches/workouts/${id}`, { headers: { Authorization: `Bearer ${token}` }});
            Toast.show({ type: 'success', text1: 'Workout deleted.' });
            loadData();
          } catch (e) { Alert.alert("Error", "Could not delete workout"); }
      }}
    ]);
  };

  const openCreateWorkoutModal = () => {
    setEditingWorkoutId(null);
    setWorkoutName('');
    setExercises([]);
    setSelectedExoData(null);
    setWorkoutModalVisible(true);
  };

  const handleAddSet = () => setCurrentSets([...currentSets, { reps: '10', duration: '30', weight: '0' }]);
  const handleRemoveSet = (index: number) => setCurrentSets(currentSets.filter((_, i) => i !== index));
  const handleUpdateSet = (index: number, field: string, value: string) => {
    const updated = [...currentSets];
    updated[index] = { ...updated[index], [field]: value };
    setCurrentSets(updated);
  };

  const handleConfirmExercise = () => {
    if (!selectedExoData) return Alert.alert('Error', 'Please select an exercise.');
    const formattedSets = currentSets.map((s, idx) => ({
      set_number: idx + 1,
      reps: selectedExoData.type === 'strength' ? (parseInt(s.reps) || 0) : 0,
      duration: selectedExoData.type === 'duration' ? (parseInt(s.duration) || 0) : 0,
      weight: selectedExoData.type === 'strength' ? (parseFloat(s.weight) || 0) : 0,
    }));
    setExercises([...exercises, {
      name: selectedExoData.name, muscle: selectedExoData.muscle, num_sets: currentSets.length, rest_time: 60, sets_details: formattedSets
    }]);
    setSelectedExoData(null);
    setCurrentSets([{ reps: '10', duration: '0', weight: '0' }]);
  };

  const handleEditExercise = (index: number) => {
    const exoToEdit = exercises[index];
    const isDuration = exoToEdit.sets_details.some((s: any) => s.duration > 0);
    setSelectedExoData({ name: exoToEdit.name, muscle: exoToEdit.muscle, type: isDuration ? 'duration' : 'strength' });
    const loadedSets = exoToEdit.sets_details.map((s: any) => ({ reps: String(s.reps || 0), duration: String(s.duration || 0), weight: String(s.weight || 0) }));
    setCurrentSets(loadedSets);
    setExercises(exercises.filter((_, i) => i !== index));
  };

  const handleSaveWorkout = async () => {
    if (!workoutName.trim()) return Alert.alert("Error", "Please provide a workout name.");
    setSavingWorkout(true);
    try {
      const token = await getToken();
      const payload = {
        name: workoutName, description: "", difficulty: workoutDifficulty, scheduled_date: selectedDate.toISOString(), exercises: exercises
      };
      if (editingWorkoutId) {
        await axios.put(`${API_URL}/coaches/workouts/${editingWorkoutId}`, payload, { headers: { Authorization: `Bearer ${token}` }});
      } else {
        await axios.post(`${API_URL}/coaches/clients/${clientId}/workouts/create`, payload, { headers: { Authorization: `Bearer ${token}` }});
      }
      setWorkoutModalVisible(false);
      loadData();
      Toast.show({ type: 'success', text1: 'Workout saved! 💪' });
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: "Could not save workout." });
    } finally { 
        setSavingWorkout(false); 
    }
  };

  const renderProgressBar = (label: string, value: number, max: number, color: string) => {
    const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
    return (
      <View style={styles.progressRow} key={label}>
        <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom: 5}}>
          <Text style={styles.progressLabel}>{label}</Text>
          <Text style={styles.progressValue}>{value.toFixed(1)} / {max} g</Text>
        </View>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${percentage}%`, backgroundColor: color }]} />
        </View>
      </View>
    );
  };

  const isToday = selectedDate.toDateString() === new Date().toDateString();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.back()}><Ionicons name="arrow-back" size={24} color="white" /></TouchableOpacity>
        <Text style={styles.headerTitle}>Client Dashboard</Text>
        <View style={{width: 30}} /> 
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator size="large" color="#3498DB" /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardDismissMode="on-drag">
          <View style={styles.profileCard}>
                <View style={styles.avatar}><Text style={styles.avatarText}>{clientData?.firstname?.[0]}</Text></View>
                <View style={{marginLeft: 15, flex: 1}}>
                    <Text style={styles.clientName}>{clientData?.firstname} {clientData?.lastname}</Text>
                    <Text style={styles.clientInfo}>{clientData?.age} years old • {clientData?.gender}</Text>
                    
                    <View style={styles.badgesContainer}>
                        {/* 🔥 CORRECTIF ICI : Vérification robuste de l'objectif */}
                        <View style={styles.goalBadge}>
                            <Text style={styles.goalBadgeText}>
                                {clientData?.goal && goalLabels[clientData.goal] 
                                    ? goalLabels[clientData.goal] 
                                    : (clientData?.goal ? `🎯 ${clientData.goal.replace('_', ' ')}` : 'No goal specified')
                                }
                            </Text>
                        </View>
                        
                        {clientData?.weight ? (
                            <View style={styles.metricBadge}>
                                <Text style={styles.metricBadgeText}>{clientData.weight} kg</Text>
                            </View>
                        ) : null}

                        {clientData?.height ? (
                            <View style={styles.metricBadge}>
                                <Text style={styles.metricBadgeText}>{clientData.height} cm</Text>
                            </View>
                        ) : null}
                    </View>
                </View>
            </View>

            <View style={styles.dateNavigator}>
                <TouchableOpacity onPress={() => changeDate(-1)}><Ionicons name="chevron-back" size={24} color="#3498DB" /></TouchableOpacity>
                <View style={{ alignItems: 'center' }}>
                    <Text style={styles.dateText}>{selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</Text>
                    {isToday && <Text style={styles.todayBadge}>Today</Text>}
                </View>
                <TouchableOpacity onPress={() => changeDate(1)}><Ionicons name="chevron-forward" size={24} color="#3498DB" /></TouchableOpacity>
            </View>

            <View style={styles.sectionContainer}>
                <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15}}>
                   <Text style={styles.sectionTitle}>Nutrition Goals</Text>
                   <TouchableOpacity onPress={openEditModal}><Ionicons name="pencil" size={20} color="#3498DB" /></TouchableOpacity>
                </View>
                <View style={styles.caloriesCard}>
                    <Text style={styles.calTitle}>Total Consumed</Text>
                    <Text style={styles.calValue}>{clientData?.today_stats?.calories || 0} <Text style={styles.calGoal}>/ {clientData?.goal_calories || 2500} kcal</Text></Text>
                    <View style={styles.progressBarBg}>
                      <View style={[styles.progressBarFill, { width: `${Math.min(((clientData?.today_stats?.calories || 0) / (clientData?.goal_calories || 2500)) * 100, 100)}%`, backgroundColor: '#3498DB' }]} />
                    </View>
                </View>
                <View style={styles.macrosContainer}>
                    {renderProgressBar("Proteins", clientData?.today_stats?.proteins || 0, clientData?.goals_macros?.proteins || 150, "#e67e22")}
                    {renderProgressBar("Carbs", clientData?.today_stats?.carbs || 0, clientData?.goals_macros?.carbs || 250, "#f1c40f")}
                    {renderProgressBar("Fats", clientData?.today_stats?.fats || 0, clientData?.goals_macros?.fats || 70, "#9b59b6")}
                </View>
            </View>

            <View style={styles.sectionContainer}>
                <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10}}>
                   <Text style={styles.sectionTitle}>Meals Plan</Text>
                   <TouchableOpacity onPress={openCreateMealModal}><Ionicons name="add-circle" size={28} color="#3498DB" /></TouchableOpacity>
                </View>
                <View style={styles.listContainer}>
                    {clientData?.meals_today?.length > 0 ? (
                        clientData.meals_today.map((meal: any) => (
                            <View key={meal.id} style={styles.displayCard}>
                                <TouchableOpacity style={{flex: 1, flexDirection: 'row', alignItems: 'center'}} onPress={() => toggleMealExpand(meal.id)}>
                                    <Ionicons name={meal.is_consumed ? "checkmark-circle" : "time-outline"} size={22} color={meal.is_consumed ? "#2ecc71" : "#888"} style={{marginRight: 10}} />
                                    <View style={{flex: 1}}>
                                        <Text style={[styles.listName, meal.is_consumed && styles.completedText]}>{meal.name}</Text>
                                        <Text style={{color: meal.is_consumed ? '#2ecc71' : '#888', fontSize: 12, marginTop: 2}}>
                                            {meal.is_consumed ? 'Done' : 'Pending'} • {meal.calories || meal.total_calories} kcal
                                        </Text>
                                    </View>
                                    <Ionicons name={expandedMeals.includes(meal.id) ? "chevron-up" : "chevron-down"} size={20} color="#888" />
                                </TouchableOpacity>
                                <View style={{flexDirection: 'row', marginLeft: 15, alignItems: 'center'}}>
                                    <TouchableOpacity onPress={() => openEditMealModal(meal)} style={{marginRight: 15}}><Ionicons name="pencil" size={20} color="#3498DB" /></TouchableOpacity>
                                    <TouchableOpacity onPress={() => handleDeleteMeal(meal.id)}><Ionicons name="trash" size={20} color="#e74c3c" /></TouchableOpacity>
                                </View>
                                
                                {expandedMeals.includes(meal.id) && (
                                    <View style={styles.detailBox}>
                                        {safeParseJSON(meal.items || meal.aliments).length > 0 ? (
                                            safeParseJSON(meal.items || meal.aliments).map((f: any, idx: number) => (
                                                <View key={idx} style={{flexDirection: 'row', alignItems: 'center', marginBottom: 8}}>
                                                    <FoodImage uri={f.image} style={{width: 25, height: 25, borderRadius: 5, marginRight: 10}} iconSize={16} />
                                                    <Text style={{color: '#ccc', flex: 1, fontSize: 13}} numberOfLines={1}>{f.name}</Text>
                                                    <Text style={{color: '#888', fontSize: 12}}>{f.weight}g • {Math.round(f.macros?.energy || 0)} kcal</Text>
                                                </View>
                                            ))
                                        ) : (
                                            <Text style={{color: '#888', fontStyle: 'italic', fontSize: 12}}>No details provided.</Text>
                                        )}
                                    </View>
                                )}
                            </View>
                        ))
                    ) : <Text style={styles.emptyText}>No meals scheduled.</Text>}
                </View>
            </View>

            <View style={styles.sectionContainer}>
                <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10}}>
                   <Text style={styles.sectionTitle}>Workouts Plan</Text>
                   <TouchableOpacity onPress={openCreateWorkoutModal}><Ionicons name="add-circle" size={28} color="#3498DB" /></TouchableOpacity>
                </View>
                <View style={styles.listContainer}>
                    {clientData?.workouts_today?.length > 0 ? (
                        clientData.workouts_today.map((workout: any) => (
                            <View key={workout.id} style={styles.displayCard}>
                                <TouchableOpacity style={{flex: 1, flexDirection: 'row', alignItems: 'center'}} onPress={() => toggleWorkoutExpand(workout.id)}>
                                    <Ionicons name={workout.is_completed ? "checkmark-circle" : "time-outline"} size={22} color={workout.is_completed ? "#2ecc71" : "#888"} style={{marginRight: 10}} />
                                    <View style={{flex: 1}}>
                                        <Text style={[styles.listName, workout.is_completed && styles.completedText]}>{workout.name}</Text>
                                        <Text style={{color: workout.is_completed ? '#2ecc71' : '#888', fontSize: 12, marginTop: 2}}>
                                            {workout.is_completed ? 'Done' : 'Pending'}
                                        </Text>
                                    </View>
                                    <Ionicons name={expandedWorkouts.includes(workout.id) ? "chevron-up" : "chevron-down"} size={20} color="#888" />
                                </TouchableOpacity>
                                <View style={{flexDirection: 'row', marginLeft: 15, alignItems: 'center'}}>
                                    <TouchableOpacity onPress={() => handleEditWorkout(workout)} style={{marginRight: 15}}><Ionicons name="pencil" size={20} color="#3498DB" /></TouchableOpacity>
                                    <TouchableOpacity onPress={() => handleDeleteWorkout(workout.id)}><Ionicons name="trash" size={20} color="#e74c3c" /></TouchableOpacity>
                                </View>
                                {expandedWorkouts.includes(workout.id) && (
                                    <View style={styles.detailBox}>
                                        {safeParseJSON(workout.exercises).map((exo: any, idx: number) => (
                                            <View key={idx} style={{marginBottom: 8}}>
                                                <Text style={{color: '#3498DB', fontWeight: 'bold'}}>{exo.name}</Text>
                                                {safeParseJSON(exo.sets_details).map((s: any, i: number) => (
                                                    <Text key={i} style={{color: '#ccc', fontSize: 12, marginLeft: 10}}>
                                                        Set {s.set_number}: {s.duration > 0 ? `${s.duration}s` : `${s.reps} reps`} {s.weight > 0 ? `@${s.weight}kg` : ''}
                                                    </Text>
                                                ))}
                                            </View>
                                        ))}
                                    </View>
                                )}
                            </View>
                        ))
                    ) : <Text style={styles.emptyText}>No workouts scheduled.</Text>}
                </View>
            </View>
            <View style={{height: 40}}/>
        </ScrollView>
      )}

      {/* MODALS (Identiques au reste) */}
      <Modal visible={isMealModalVisible} animationType="slide" transparent>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setIsMealModalVisible(false)}>
            <TouchableWithoutFeedback>
                <View style={styles.mealModalContent}>
                    <Text style={styles.modalTitle}>{editingMealId ? "Edit Meal" : "Create Meal"}</Text>
                    <TextInput style={styles.inputModal} placeholder="Meal Name (e.g. Lunch)" placeholderTextColor="#888" value={mealName} onChangeText={setMealName} />
                    
                    <Text style={styles.inputLabelModal}>Add Food (Enter Weight first!)</Text>
                    <View style={styles.searchRow}>
                        <TextInput 
                            style={[styles.inputModal, {width: 80, textAlign:'center', marginBottom: 0}]} 
                            placeholder="g" 
                            keyboardType="numeric"  
                            value={foodSearchWeight} 
                            onChangeText={setFoodSearchWeight} 
                            placeholderTextColor="#888"
                        />
                        <TextInput 
                            style={[styles.inputModal, {flex: 1, marginLeft: 10, marginBottom: 0}]} 
                            placeholder="Search food..." 
                            placeholderTextColor="#888" 
                            value={foodSearchQuery} 
                            onChangeText={setFoodSearchQuery} 
                            onSubmitEditing={searchFoodApi} 
                        />
                        <TouchableOpacity style={styles.searchBtn} onPress={searchFoodApi}>
                            {searchingFood ? <ActivityIndicator size="small" color="white"/> : <Ionicons name="search" size={20} color="white" />}
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.scanBtn} onPress={openCameraModal}>
                            <Ionicons name="barcode-outline" size={20} color="white" />
                        </TouchableOpacity>
                    </View>
                    
                    {foodSearchResults.length > 0 && (
                        <View style={styles.resultsBox}>
                            <ScrollView nestedScrollEnabled keyboardDismissMode="on-drag">
                                {foodSearchResults.map((item, i) => (
                                    <TouchableOpacity key={i} style={styles.resultItem} onPress={() => handleSelectFoodResult(item)}>
                                        <FoodImage uri={item.image} style={styles.resultImage} iconSize={18}/>
                                        <Text style={styles.resultText} numberOfLines={1}>{item.name}</Text>
                                        <Ionicons name="add-circle" size={24} color="#3498DB" />
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    )}

                    <View style={styles.fixedListContainer}>
                        <Text style={[styles.inputLabelModal, {marginBottom: 5}]}>Selected Items ({selectedFoods.length})</Text>
                        {selectedFoods.length === 0 ? (
                            <View style={styles.emptyListPlaceholder}>
                                <Text style={{color:'#666'}}>No food selected.</Text>
                                <Text style={{color:'#444', fontSize:10}}>Add food via search or barcode</Text>
                            </View>
                        ) : (
                            <ScrollView nestedScrollEnabled style={{width: '100%'}} keyboardDismissMode="on-drag">
                                {selectedFoods.map((item, index) => (
                                    <View key={item.id} style={styles.selectedFoodRow}>
                                        <FoodImage uri={item.image} style={styles.selectedFoodImage} iconSize={18} />
                                        <View style={styles.selectedFoodInfo}>
                                            <Text style={styles.selectedFoodName} numberOfLines={1}>{item.name}</Text>
                                            <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 4}}>
                                                <TextInput 
                                                    style={styles.amountInput} 
                                                    keyboardType="numeric" 
                                                    value={String(item.weight)} 
                                                    onChangeText={(val) => updateFoodWeight(item.id, val)} 
                                                />
                                                <Text style={{color: '#aaa', fontSize: 12, marginLeft: 5}}>
                                                    g • {Math.round((item.baseMacros?.energy || 0) * (item.weight / 100))} kcal
                                                </Text>
                                            </View>
                                        </View>
                                        <TouchableOpacity onPress={() => removeSelectedFood(index)} style={{padding:8}}>
                                            <Ionicons name="trash-outline" size={22} color="#e74c3c" />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </ScrollView>
                        )}
                    </View>

                    <View style={styles.summaryBox}>
                        <Text style={styles.summaryTitle}>Total: {totalMealMacros.calories.toFixed(0)} kcal</Text>
                        <Text style={styles.summaryText}>P: {totalMealMacros.proteins.toFixed(1)}g | C: {totalMealMacros.carbs.toFixed(1)}g | F: {totalMealMacros.fats.toFixed(1)}g</Text>
                    </View>

                    <View style={styles.modalActions}>
                        <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setIsMealModalVisible(false)}><Text style={styles.buttonText}>Cancel</Text></TouchableOpacity>
                        <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handleSaveMeal} disabled={savingMeal}><Text style={styles.buttonText}>Save Meal</Text></TouchableOpacity>
                    </View>
                </View>
            </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>

      <Modal visible={isCameraOpen} animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'black' }}>
            <CameraView 
                style={StyleSheet.absoluteFillObject} 
                facing="back" 
                onBarcodeScanned={scanned ? undefined : handleBarCodeScanned} 
            />
            <View style={styles.overlay}>
                <View style={styles.layerTop} />
                <View style={styles.layerCenter}>
                    <View style={styles.layerLeft} />
                    <View style={styles.focused}>
                        <View style={[styles.corner, {top:0, left:0, borderTopWidth:3, borderLeftWidth:3}]} />
                        <View style={[styles.corner, {top:0, right:0, borderTopWidth:3, borderRightWidth:3}]} />
                        <View style={[styles.corner, {bottom:0, left:0, borderBottomWidth:3, borderLeftWidth:3}]} />
                        <View style={[styles.corner, {bottom:0, right:0, borderBottomWidth:3, borderRightWidth:3}]} />
                    </View>
                    <View style={styles.layerRight} />
                </View>
                <View style={styles.layerBottom} />
            </View>
            <View style={{position:'absolute', top: 60, width:'100%', alignItems:'center'}}>
                <Text style={{color:'white', fontSize: 18, fontWeight:'bold', textShadowColor:'black', textShadowRadius:5}}>
                    Scan Barcode
                </Text>
            </View>
            <TouchableOpacity style={styles.closeCameraButton} onPress={() => { setIsCameraOpen(false); setIsMealModalVisible(true); }}>
                <Ionicons name="close" size={32} color="black" />
            </TouchableOpacity>
        </View>
      </Modal>

      <Modal visible={isDetailModalVisible} animationType="slide" transparent>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => { }}>
            <TouchableWithoutFeedback>
                <View style={[styles.modalContent, {height: 'auto', maxHeight: '60%'}]}>
                    {scannedFood && (
                        <>
                            <Text style={styles.modalTitle}>{scannedFood.name}</Text>
                            <FoodImage uri={scannedFood.image} style={{width: 100, height: 100, borderRadius: 10, alignSelf:'center', marginBottom:15}} />
                            
                            <Text style={[styles.inputLabelModal, {textAlign:'center'}]}>Enter Weight (g)</Text>
                            <TextInput 
                                style={[styles.inputModal, {textAlign:'center', fontSize: 20, fontWeight:'bold', marginBottom: 20}]} 
                                keyboardType="numeric" 
                                value={scanGrammage} 
                                onChangeText={setScanGrammage} 
                                placeholder="e.g. 100" 
                                placeholderTextColor="#555"
                                autoFocus
                            />
                            <View style={styles.modalActions}>
                                <TouchableOpacity onPress={() => { setIsDetailModalVisible(false); setIsMealModalVisible(true); }} style={[styles.modalButton, styles.cancelButton]}>
                                    <Text style={styles.buttonText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={validateGrammageScan} style={[styles.modalButton, styles.saveButton]}>
                                    <Text style={styles.buttonText}>Add to Meal</Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    )}
                </View>
            </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>

      <Modal visible={isWorkoutModalVisible} animationType="slide" transparent>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setWorkoutModalVisible(false)}>
            <TouchableWithoutFeedback>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%' }}>
                    <View style={styles.modalContent}>
                        {isExoSelectorVisible ? (
                            <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
                                    {selectedMuscle && (
                                    <TouchableOpacity onPress={() => setSelectedMuscle(null)} style={{ marginRight: 10 }}>
                                        <Ionicons name="arrow-back-circle" size={32} color="#3498DB" />
                                    </TouchableOpacity>
                                    )}
                                    <Text style={styles.modalTitle}>
                                        {selectedMuscle ? `Exercises: ${selectedMuscle}` : "Select Muscle Group"}
                                    </Text>
                                </View>
                                {!selectedMuscle ? (
                                    <ScrollView style={{ flex: 1 }} keyboardDismissMode="on-drag">
                                    {getUniqueMuscles().map((muscle) => (
                                        <TouchableOpacity key={muscle} style={styles.muscleRow} onPress={() => setSelectedMuscle(muscle)}>
                                        <Text style={styles.muscleRowText}>{muscle.toUpperCase()}</Text>
                                        <Ionicons name="chevron-forward" size={20} color="#888" />
                                        </TouchableOpacity>
                                    ))}
                                    </ScrollView>
                                ) : (
                                    <View style={{ flex: 1 }}>
                                    <TextInput 
                                        style={[styles.inputModal, { marginBottom: 10, textAlign: 'left' }]} 
                                        placeholder="Search exercise..." 
                                        value={exoSearch} 
                                        onChangeText={setExoSearch} 
                                        placeholderTextColor="#888" 
                                    />
                                    <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
                                        {getExercisesByMuscle(selectedMuscle)
                                        .filter(e => e.name.toLowerCase().includes(exoSearch.toLowerCase()))
                                        .map((e, i) => (
                                        <TouchableOpacity 
                                            key={i} 
                                            style={styles.exoSearchResult} 
                                            onPress={() => {
                                                setSelectedExoData(e);
                                                setIsExoSelectorVisible(false);
                                                setSelectedMuscle(null);
                                                setExoSearch('');
                                                setCurrentSets([{ reps: '10', duration: '30', weight: '0' }]);
                                            }}
                                        >
                                            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 15 }}>{e.name}</Text>
                                            <Text style={{ color: '#aaa', fontSize: 11 }}>{e.equipment} • {e.type}</Text>
                                        </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                    </View>
                                )}
                                <TouchableOpacity style={styles.largeBackButton} onPress={() => setIsExoSelectorVisible(false)}>
                                    <Text style={styles.largeBackButtonText}>BACK TO WORKOUT</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={{ flex: 1 }}>
                                <Text style={styles.modalTitle}>{editingWorkoutId ? "Edit Workout" : "Create Workout"}</Text>
                                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ flex: 1 }} keyboardDismissMode="on-drag">
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.inputLabelModal}>Workout Name</Text>
                                        <TextInput style={[styles.inputModal, {textAlign: 'left'}]} placeholder="e.g., Push Day" value={workoutName} onChangeText={setWorkoutName} placeholderTextColor="#888" />
                                    </View>

                                    {exercises.length > 0 && (
                                        <View style={{marginBottom: 20}}>
                                            <Text style={[styles.inputLabelModal, {color: '#3498DB'}]}>Exercises List</Text>
                                            {exercises.map((exo, index) => (
                                            <View key={index} style={styles.exoItem}>
                                                <View style={{flex: 1}}>
                                                <Text style={styles.exoName}>{exo.name}</Text>
                                                {exo.sets_details.map((s: any, i: number) => (
                                                    <Text key={i} style={styles.exoDetailsList}>
                                                    S{s.set_number}: {s.duration > 0 ? `${s.duration}s` : `${s.reps} reps`} {s.weight > 0 ? `@ ${s.weight}kg` : ''}
                                                    </Text>
                                                ))}
                                                </View>
                                                <View style={{flexDirection: 'row'}}>
                                                <TouchableOpacity onPress={() => handleEditExercise(index)} style={{marginRight: 15}}><Ionicons name="pencil" size={20} color="#3498DB" /></TouchableOpacity>
                                                <TouchableOpacity onPress={() => setExercises(exercises.filter((_, i) => i !== index))}><Ionicons name="trash" size={20} color="#e74c3c" /></TouchableOpacity>
                                                </View>
                                            </View>
                                            ))}
                                        </View>
                                    )}

                                    <View style={styles.addExoCard}>
                                        <Text style={styles.addExoTitle}>{selectedExoData ? "Edit Exercise" : "Add New Exercise"}</Text>
                                        <TouchableOpacity style={styles.exoSelectorBtn} onPress={() => setIsExoSelectorVisible(true)}>
                                            <Text style={{color: selectedExoData ? 'white' : '#888'}}>{selectedExoData ? selectedExoData.name : "Choose from list..."}</Text>
                                            <Ionicons name="chevron-down" size={20} color="#888" />
                                        </TouchableOpacity>

                                        {selectedExoData && (
                                            <>
                                            <View style={{flexDirection: 'row', alignItems: 'center', paddingHorizontal: 5, marginBottom: 5}}>
                                                <Text style={{color: '#888', fontSize: 12, width: 40, fontWeight: 'bold'}}>Set</Text>
                                                <Text style={{color: '#888', fontSize: 12, flex: 1, textAlign: 'center', fontWeight: 'bold'}}>{selectedExoData.type === 'strength' ? 'Reps' : 'Time (s)'}</Text>
                                                {selectedExoData.type === 'strength' && <Text style={{color: '#888', fontSize: 12, flex: 1, textAlign: 'center', fontWeight: 'bold'}}>Weight</Text>}
                                                <View style={{width: 30}} />
                                            </View>

                                            {currentSets.map((set, index) => (
                                                <View key={index} style={styles.setRow}>
                                                    <Text style={{color: '#3498DB', fontWeight: 'bold', width: 40}}>S{index + 1}</Text>
                                                    <View style={{flex: 1, paddingHorizontal: 5}}>
                                                        <TextInput style={styles.setInput} keyboardType="numeric" value={selectedExoData.type === 'strength' ? set.reps : set.duration} onChangeText={(v) => handleUpdateSet(index, selectedExoData.type === 'strength' ? 'reps' : 'duration', v)} placeholderTextColor="#888" />
                                                    </View>
                                                    {selectedExoData.type === 'strength' && (
                                                        <View style={{flex: 1, paddingHorizontal: 5}}>
                                                            <TextInput style={styles.setInput} keyboardType="numeric" value={set.weight} onChangeText={(v) => handleUpdateSet(index, 'weight', v)} placeholderTextColor="#888" />
                                                        </View>
                                                    )}
                                                    <TouchableOpacity onPress={() => handleRemoveSet(index)} style={{width: 30, alignItems: 'flex-end'}}><Ionicons name="close-circle" size={22} color="#e74c3c" /></TouchableOpacity>
                                                </View>
                                            ))}
                                            <TouchableOpacity style={styles.addSetBtn} onPress={handleAddSet}><Text style={{color: '#3498DB', fontWeight: 'bold'}}>+ Add Set</Text></TouchableOpacity>
                                            <TouchableOpacity style={styles.addExoButton} onPress={handleConfirmExercise}><Text style={styles.buttonText}>Confirm Exercise</Text></TouchableOpacity>
                                            </>
                                        )}
                                    </View>
                                    <View style={{ height: 20 }} />
                                </ScrollView>

                                <View style={styles.modalActions}>
                                    <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setWorkoutModalVisible(false)}><Text style={styles.buttonText}>Cancel</Text></TouchableOpacity>
                                    <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handleSaveWorkout} disabled={savingWorkout}>
                                        {savingWorkout ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Save Workout</Text>}
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    </View>
                </KeyboardAvoidingView>
            </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>

      <Modal animationType="slide" transparent={true} visible={isModalVisible} onRequestClose={() => setModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setModalVisible(false)}>
            <TouchableWithoutFeedback>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%' }}>
                    <View style={styles.nutritionModalContent}>
                        <Text style={styles.modalTitle}>Edit Nutritional Goals</Text>
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabelModal}>Calories (kcal)</Text>
                            <TextInput style={styles.inputModal} keyboardType="numeric" value={editCalories} onChangeText={setEditCalories} placeholderTextColor="#888" />
                        </View>
                        <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                            <View style={[styles.inputGroup, {flex: 0.31}]}>
                                <Text style={styles.inputLabelModal}>Proteins (g)</Text>
                                <TextInput style={styles.inputModal} keyboardType="numeric" value={editProteins} onChangeText={setEditProteins} placeholderTextColor="#888" />
                            </View>
                            <View style={[styles.inputGroup, {flex: 0.31}]}>
                                <Text style={styles.inputLabelModal}>Carbs (g)</Text>
                                <TextInput style={styles.inputModal} keyboardType="numeric" value={editCarbs} onChangeText={setEditCarbs} placeholderTextColor="#888" />
                            </View>
                            <View style={[styles.inputGroup, {flex: 0.31}]}>
                                <Text style={styles.inputLabelModal}>Fats (g)</Text>
                                <TextInput style={styles.inputModal} keyboardType="numeric" value={editFats} onChangeText={setEditFats} placeholderTextColor="#888" />
                            </View>
                        </View>
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setModalVisible(false)}><Text style={styles.buttonText}>Cancel</Text></TouchableOpacity>
                            <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handleUpdateGoals} disabled={updatingGoals}>
                                {updatingGoals ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Save</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>

      <Toast />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A1F2B' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#2A4562', marginTop: 10 },
  headerTitle: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  content: { padding: 16 },
  profileCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2A4562', borderRadius: 15, padding: 20, marginBottom: 20 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#3498DB', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: 'white', fontSize: 24, fontWeight: 'bold' },
  clientName: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  clientInfo: { color: '#aaa', marginTop: 2 },
  dateNavigator: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#2A4562', padding: 15, borderRadius: 15, marginBottom: 20 },
  dateText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  todayBadge: { color: '#3498DB', fontSize: 12, fontWeight: 'bold', marginTop: 2 },
  sectionContainer: { marginBottom: 30 },
  sectionTitle: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  caloriesCard: { backgroundColor: '#2A4562', borderRadius: 15, padding: 20, marginBottom: 15 },
  calTitle: { color: '#aaa', marginBottom: 5 },
  calValue: { color: 'white', fontSize: 32, fontWeight: 'bold' },
  calGoal: { fontSize: 16, color: '#aaa' },
  macrosContainer: { backgroundColor: '#2A4562', borderRadius: 15, padding: 20 },
  progressRow: { marginBottom: 15 },
  progressLabel: { color: 'white', fontWeight: '600' },
  progressValue: { color: '#ccc', fontSize: 12 },
  progressBarBg: { height: 8, backgroundColor: '#1A1F2B', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%' },
  listContainer: { backgroundColor: '#2A4562', borderRadius: 15, padding: 15 },
  displayCard: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  listName: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  completedText: { textDecorationLine: 'line-through', color: '#888' },
  emptyText: { color: '#888', fontStyle: 'italic', textAlign: 'center' },
  detailBox: { marginTop: 10, padding: 10, backgroundColor: '#1E2C3D', borderRadius: 10 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#1A1F2B', borderRadius: 15, padding: 20, borderWidth: 1, borderColor: '#3498DB', height: '85%' },
  nutritionModalContent: { backgroundColor: '#1A1F2B', borderRadius: 15, padding: 20, borderWidth: 1, borderColor: '#3498DB', width: '100%' },
  mealModalContent: { backgroundColor: '#1A1F2B', borderRadius: 15, padding: 20, borderWidth: 1, borderColor: '#2ecc71', maxHeight: '90%', width: '100%' },
  modalTitle: { color: 'white', fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  inputGroup: { marginBottom: 15 },
  inputLabelModal: { color: '#aaa', marginBottom: 8, fontSize: 13, fontWeight: 'bold' },
  inputModal: { backgroundColor: '#2A4562', color: 'white', padding: 12, borderRadius: 8, fontSize: 16, marginBottom: 10 },
  
  searchRow: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  searchBtn: { backgroundColor: '#3498DB', padding: 12, borderRadius: 8, justifyContent: 'center' },
  scanBtn: { backgroundColor: '#9b59b6', padding: 12, borderRadius: 8, justifyContent: 'center' },
  resultsBox: { backgroundColor: '#1E2C3D', borderRadius: 8, padding: 5, maxHeight: 150, marginBottom: 10 },
  resultItem: { flexDirection: 'row', alignItems: 'center', padding: 10, borderBottomWidth: 1, borderBottomColor: '#333' },
  resultImage: { width: 30, height: 30, borderRadius: 15, marginRight: 10 },
  resultText: { color: 'white', fontWeight: 'bold', flex: 1 },
  
  fixedListContainer: { height: 180, marginBottom: 10 },
  emptyListPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#444', borderStyle: 'dashed', borderRadius: 8, backgroundColor: '#253545' },
  selectedFoodRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1F2937', padding: 10, borderRadius: 8, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: '#3498DB' },
  selectedFoodImage: { width: 35, height: 35, borderRadius: 8, marginRight: 10 },
  selectedFoodInfo: { flex: 1 },
  selectedFoodName: { color: 'white', fontWeight: 'bold', fontSize: 14 },
  amountInput: { backgroundColor: '#1A1F2B', color: 'white', width: 50, textAlign: 'center', borderRadius: 4, padding: 4 },

  summaryBox: { marginTop: 10, padding: 15, backgroundColor: '#232D3F', borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#2ecc71' },
  summaryTitle: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  summaryText: { color: '#aaa', fontSize: 12, marginTop: 4 },
  
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  modalButton: { flex: 0.48, padding: 15, borderRadius: 8, alignItems: 'center' },
  cancelButton: { backgroundColor: '#e74c3c' },
  saveButton: { backgroundColor: '#2ecc71' },
  buttonText: { color: 'white', fontWeight: 'bold' },

  addExoCard: { backgroundColor: '#232D3F', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#3498DB', borderStyle: 'dashed' },
  addExoTitle: { color: '#3498DB', fontWeight: 'bold', marginBottom: 15, textAlign: 'center', fontSize: 16 },
  addExoButton: { backgroundColor: '#3498DB', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 15 },
  exoItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2A4562', padding: 10, borderRadius: 8, marginBottom: 8 },
  exoName: { color: 'white', fontWeight: 'bold', fontSize: 16, marginBottom: 4 },
  exoDetailsList: { color: '#ccc', fontSize: 13, marginTop: 2, paddingLeft: 10 },
  exoSelectorBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#2A4562', padding: 15, borderRadius: 8, marginBottom: 15 },
  muscleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: '#2A4562', borderRadius: 8, marginBottom: 8 },
  muscleRowText: { color: 'white', fontWeight: 'bold' },
  exoSearchResult: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#333' },
  setRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1F2B', paddingHorizontal: 5, paddingVertical: 8, borderRadius: 8, marginBottom: 8 },
  setInput: { backgroundColor: '#2A4562', color: 'white', paddingVertical: 8, borderRadius: 6, width: '100%', textAlign: 'center' },
  addSetBtn: { alignSelf: 'center', padding: 15 },
  largeBackButton: { alignSelf: 'center', width: '100%', height: 65, backgroundColor: '#e74c3c', borderRadius: 12, marginTop: 10, justifyContent: 'center', alignItems: 'center' },
  largeBackButtonText: { color: 'white', fontWeight: 'bold', fontSize: 18 },

  goalBadge: { backgroundColor: 'rgba(52, 152, 219, 0.15)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, alignSelf: 'flex-start', marginTop: 8, borderWidth: 1, borderColor: '#3498DB' },
  goalBadgeText: { color: '#3498DB', fontSize: 12, fontWeight: 'bold' },
  badgesContainer: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  metricBadge: { backgroundColor: 'rgba(255, 255, 255, 0.1)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, marginRight: 8, marginBottom: 5, justifyContent: 'center' },
  metricBadgeText: { color: '#ddd', fontSize: 12, fontWeight: 'bold' },
  
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  layerTop: { flex: 1, width: '100%', backgroundColor: 'rgba(0, 0, 0, 0.6)' },
  layerCenter: { flexDirection: 'row', height: 250 },
  layerLeft: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)' },
  focused: { width: 250, height: 250, borderWidth: 1, borderColor: '#3498DB', backgroundColor: 'transparent' },
  layerRight: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)' },
  layerBottom: { flex: 1, width: '100%', backgroundColor: 'rgba(0, 0, 0, 0.6)' },
  corner: { position: 'absolute', width: 20, height: 20, borderColor: 'white' },
  closeCameraButton: { position: 'absolute', bottom: 50, alignSelf:'center', backgroundColor:'white', width:60, height:60, borderRadius:30, justifyContent:'center', alignItems:'center' }
});

export default ClientDetailsScreen;