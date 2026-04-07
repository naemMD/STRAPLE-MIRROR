import React, { useState, useEffect } from 'react';
import { useLocalSearchParams } from 'expo-router';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  TextInput, TouchableOpacity, KeyboardAvoidingView, Platform
} from 'react-native';
import { crossAlert } from '@/services/crossAlert';

export default function ProgrammeJour() {
  const { days } = useLocalSearchParams();
  const [exercices, setExercices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [addingExercice, setAddingExercice] = useState(false);

  const fetchExercicesByDay = async () => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:8000/exercices/${days}`);
      const data = await response.json();

      if (data.status === 'OK') {
        setExercices(data.exercices);
      } else {
        setError(data.message || 'No exercises found.');
      }
    } catch (err) {
      console.error('API Error:', err);
      setError('Failed to connect to the API');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (days) {
      fetchExercicesByDay();
    }
  }, [days]);

  const searchExercice = async () => {
    if (!searchTerm.trim()) {
      setSearchError('Please enter an exercise name');
      return;
    }

    try {
      setSearching(true);
      setSearchError(null);
      const response = await fetch(`http://localhost:8000/exercice/search?nom=${encodeURIComponent(searchTerm)}`);
      const data = await response.json();

      if (data.status === 'OK') {
        setSearchResult(data.exercice);
      } else {
        setSearchError(data.message || 'Exercise not found');
        setSearchResult(null);
      }
    } catch (err) {
      console.error('Search error:', err);
      setSearchError('An error occurred while searching');
      setSearchResult(null);
    } finally {
      setSearching(false);
    }
  };

  const addExerciseToDay = async () => {
    if (!searchResult) return;

    try {
      setAddingExercice(true);
      const response = await fetch(`http://localhost:8000/exercice/update-day?exercice_id=${searchResult._id}&day=${days}`, {
        method: 'PUT'
      });

      const data = await response.json();

      if (data.status === 'OK') {
        setSearchResult(null);
        setSearchTerm('');

        fetchExercicesByDay();

        crossAlert('Success', `${data.exercice.nom} has been added to ${days}'s program`);
      } else {
        crossAlert('Error', data.message || 'Failed to add the exercise');
      }
    } catch (err) {
      console.error('Add error:', err);
      crossAlert('Error', 'Unable to add the exercise');
    } finally {
      setAddingExercice(false);
    }
  };

  const isExerciseAlreadyScheduled = () => {
    if (!searchResult) return false;
    return searchResult.day === days;
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <Text style={styles.title}>{days}'s Program</Text>

      <View style={styles.searchSection}>
        <Text style={styles.sectionTitle}>Search for an exercise</Text>
        <View style={styles.searchInputContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Exercise name"
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
          <TouchableOpacity
            style={styles.searchButton}
            onPress={searchExercice}
            disabled={searching}
          >
            <Text style={styles.searchButtonText}>Search</Text>
          </TouchableOpacity>
        </View>

        {searching && <ActivityIndicator size="small" color="#007BFF" style={styles.searchLoading} />}
        {searchError && <Text style={styles.errorText}>{searchError}</Text>}

        {searchResult && (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>{searchResult.nom}</Text>
            {searchResult.muscles && (
              <Text style={styles.resultDetails}>
                Targeted muscles: {searchResult.muscles.join(', ')}
              </Text>
            )}
            {searchResult.day && (
              <Text style={styles.resultDay}>
                Scheduled day: {searchResult.day}
              </Text>
            )}

            {!isExerciseAlreadyScheduled() && (
              <TouchableOpacity
                style={styles.addButton}
                onPress={addExerciseToDay}
                disabled={addingExercice}
              >
                {addingExercice ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.addButtonText}>
                    {searchResult.day ? `Move to ${days}` : `Add to ${days}`}
                  </Text>
                )}
              </TouchableOpacity>
            )}

            {isExerciseAlreadyScheduled() && (
              <Text style={styles.alreadyScheduled}>
                This exercise is already scheduled for {days}
              </Text>
            )}
          </View>
        )}
      </View>

      <View style={styles.exercisesSection}>
        <Text style={styles.sectionTitle}>Scheduled exercises</Text>
        {loading ? (
          <ActivityIndicator size="large" color="#007BFF" />
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : exercices.length === 0 ? (
          <Text style={styles.subtitle}>No exercises scheduled for this day.</Text>
        ) : (
          <FlatList
            data={exercices}
            keyboardDismissMode="on-drag"
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => (
              <View style={styles.exerciseItem}>
                <Text style={styles.exerciseName}>{item.nom}</Text>
                {item.muscles && (
                  <Text style={styles.exerciseDetails}>
                    Targeted muscles: {item.muscles.join(', ')}
                  </Text>
                )}
              </View>
            )}
          />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginVertical: 10,
  },
  subtitle: {
    fontSize: 16,
    marginVertical: 10,
    textAlign: 'center',
  },
  errorText: {
    color: 'red',
    marginTop: 5,
  },
  searchSection: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#f8f8f8',
    borderRadius: 10,
  },
  searchInputContainer: {
    flexDirection: 'row',
    marginVertical: 10,
  },
  searchInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    paddingHorizontal: 10,
    backgroundColor: 'white',
  },
  searchButton: {
    marginLeft: 10,
    backgroundColor: '#007BFF',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 15,
    borderRadius: 5,
  },
  searchButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  searchLoading: {
    marginTop: 10,
  },
  resultCard: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  resultDetails: {
    marginTop: 5,
    color: '#555',
  },
  resultDay: {
    marginTop: 5,
    fontWeight: '500',
    color: '#007BFF',
  },
  addButton: {
    backgroundColor: '#28a745',
    padding: 10,
    borderRadius: 5,
    marginTop: 10,
    alignItems: 'center',
  },
  addButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  alreadyScheduled: {
    marginTop: 10,
    color: '#dc3545',
    fontStyle: 'italic',
  },
  exercisesSection: {
    flex: 1,
  },
  exerciseItem: {
    backgroundColor: '#f0f0f0',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  exerciseName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  exerciseDetails: {
    marginTop: 8,
    fontWeight: '500',
    color: '#007BFF',
  },
});
