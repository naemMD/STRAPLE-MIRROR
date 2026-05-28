import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type SharedMeal = {
  id: number;
  name: string;
  total_calories: number;
  total_proteins: number;
  total_carbohydrates: number;
  total_lipids: number;
  meal_type?: string | null;
  hourtime: string;
  aliments_count: number;
};

export type SharedWorkout = {
  id: number;
  name: string;
  description?: string | null;
  difficulty: string;
  scheduled_date: string;
  exercises_count: number;
  is_completed: boolean;
};

const formatDay = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
};

export const SharedMealCard = ({ meal, compact }: { meal: SharedMeal; compact?: boolean }) => (
  <View style={[styles.card, styles.mealCard, compact && styles.compact]}>
    <View style={styles.header}>
      <Ionicons name="restaurant-outline" size={16} color="#27AE60" />
      <Text style={styles.headerLabel}>Meal</Text>
      {meal.meal_type ? (
        <View style={styles.typeBadge}>
          <Text style={styles.typeBadgeText}>{meal.meal_type}</Text>
        </View>
      ) : null}
    </View>
    <Text style={styles.title} numberOfLines={1}>{meal.name}</Text>
    <Text style={styles.subtitle}>{formatDay(meal.hourtime)} · {meal.aliments_count} item{meal.aliments_count !== 1 ? 's' : ''}</Text>
    <View style={styles.macroRow}>
      <View style={styles.macroPill}>
        <Text style={styles.macroValue}>{Math.round(meal.total_calories)}</Text>
        <Text style={styles.macroLabel}>kcal</Text>
      </View>
      <View style={styles.macroPill}>
        <Text style={styles.macroValue}>{Math.round(meal.total_proteins)}g</Text>
        <Text style={styles.macroLabel}>prot</Text>
      </View>
      <View style={styles.macroPill}>
        <Text style={styles.macroValue}>{Math.round(meal.total_carbohydrates)}g</Text>
        <Text style={styles.macroLabel}>carbs</Text>
      </View>
      <View style={styles.macroPill}>
        <Text style={styles.macroValue}>{Math.round(meal.total_lipids)}g</Text>
        <Text style={styles.macroLabel}>fat</Text>
      </View>
    </View>
  </View>
);

export const SharedWorkoutCard = ({ workout, compact }: { workout: SharedWorkout; compact?: boolean }) => (
  <View style={[styles.card, styles.workoutCard, compact && styles.compact]}>
    <View style={styles.header}>
      <Ionicons name="barbell-outline" size={16} color="#3498DB" />
      <Text style={[styles.headerLabel, { color: '#3498DB' }]}>Workout</Text>
      {workout.is_completed ? (
        <View style={[styles.typeBadge, { backgroundColor: 'rgba(46, 204, 113, 0.2)' }]}>
          <Text style={[styles.typeBadgeText, { color: '#2ECC71' }]}>Done</Text>
        </View>
      ) : null}
    </View>
    <Text style={styles.title} numberOfLines={1}>{workout.name}</Text>
    <Text style={styles.subtitle}>{formatDay(workout.scheduled_date)} · {workout.exercises_count} exercise{workout.exercises_count !== 1 ? 's' : ''}</Text>
    {workout.description ? (
      <Text style={styles.description} numberOfLines={2}>{workout.description}</Text>
    ) : null}
    <View style={styles.workoutFooter}>
      <View style={styles.difficultyChip}>
        <Text style={styles.difficultyText}>{workout.difficulty}</Text>
      </View>
    </View>
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    borderLeftWidth: 3,
  },
  compact: { padding: 10, marginTop: 0 },
  mealCard: { borderLeftColor: '#27AE60' },
  workoutCard: { borderLeftColor: '#3498DB' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  headerLabel: { color: '#27AE60', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  typeBadge: {
    marginLeft: 'auto',
    backgroundColor: 'rgba(39, 174, 96, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  typeBadgeText: { color: '#27AE60', fontSize: 10, fontWeight: '600', textTransform: 'capitalize' },
  title: { color: 'white', fontSize: 14, fontWeight: '700', marginTop: 2 },
  subtitle: { color: '#8A8D91', fontSize: 11, marginTop: 2 },
  description: { color: '#ccc', fontSize: 12, marginTop: 6, lineHeight: 16 },
  macroRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  macroPill: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 8,
    paddingVertical: 4,
    alignItems: 'center',
  },
  macroValue: { color: 'white', fontSize: 12, fontWeight: '700' },
  macroLabel: { color: '#8A8D91', fontSize: 9, marginTop: 1 },
  workoutFooter: { flexDirection: 'row', marginTop: 8 },
  difficultyChip: {
    backgroundColor: 'rgba(52, 152, 219, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  difficultyText: { color: '#3498DB', fontSize: 11, fontWeight: '600' },
});
