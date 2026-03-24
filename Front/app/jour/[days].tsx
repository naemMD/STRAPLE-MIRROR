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
  
  // États pour la recherche
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [addingExercice, setAddingExercice] = useState(false);

  // Fonction pour récupérer les exercices du jour
  const fetchExercicesByDay = async () => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:8000/exercices/${days}`);
      const data = await response.json();
      
      if (data.status === 'OK') {
        setExercices(data.exercices);
      } else {
        setError(data.message || 'Aucun exercice trouvé.');
      }
    } catch (err) {
      console.error('Erreur API:', err);
      setError('Erreur de connexion à l\'API');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (days) {
      fetchExercicesByDay();
    }
  }, [days]);

  // Fonction pour rechercher un exercice
  const searchExercice = async () => {
    if (!searchTerm.trim()) {
      setSearchError('Veuillez entrer un nom d\'exercice');
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
        setSearchError(data.message || 'Exercice non trouvé');
        setSearchResult(null);
      }
    } catch (err) {
      console.error('Erreur de recherche:', err);
      setSearchError('Erreur lors de la recherche');
      setSearchResult(null);
    } finally {
      setSearching(false);
    }
  };

  // Fonction pour ajouter l'exercice au jour sélectionné
  const addExerciseToDay = async () => {
    if (!searchResult) return;

    try {
      setAddingExercice(true);
      const response = await fetch(`http://localhost:8000/exercice/update-day?exercice_id=${searchResult._id}&day=${days}`, {
        method: 'PUT'
      });
      
      const data = await response.json();
      
      if (data.status === 'OK') {
        // Réinitialiser la recherche
        setSearchResult(null);
        setSearchTerm('');
        
        // Rafraîchir la liste des exercices
        fetchExercicesByDay();
        
        // Afficher un message de succès
        crossAlert('Succès', `${data.exercice.nom} a été ajouté au programme du ${days}`);
      } else {
        crossAlert('Erreur', data.message || 'Erreur lors de l\'ajout de l\'exercice');
      }
    } catch (err) {
      console.error('Erreur d\'ajout:', err);
      crossAlert('Erreur', 'Impossible d\'ajouter l\'exercice');
    } finally {
      setAddingExercice(false);
    }
  };

  // Vérifier si l'exercice est déjà programmé pour ce jour
  const isExerciseAlreadyScheduled = () => {
    if (!searchResult) return false;
    return searchResult.day === days;
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <Text style={styles.title}>Programme du {days}</Text>
      
      {/* Section de recherche d'exercice */}
      <View style={styles.searchSection}>
        <Text style={styles.sectionTitle}>Rechercher un exercice</Text>
        <View style={styles.searchInputContainer}>
          <TextInput 
            style={styles.searchInput}
            placeholder="Nom de l'exercice"
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
          <TouchableOpacity 
            style={styles.searchButton}
            onPress={searchExercice}
            disabled={searching}
          >
            <Text style={styles.searchButtonText}>Rechercher</Text>
          </TouchableOpacity>
        </View>
        
        {searching && <ActivityIndicator size="small" color="#007BFF" style={styles.searchLoading} />}
        {searchError && <Text style={styles.errorText}>{searchError}</Text>}
        
        {searchResult && (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>{searchResult.nom}</Text>
            {searchResult.muscles && (
              <Text style={styles.resultDetails}>
                Muscles travaillés: {searchResult.muscles.join(', ')}
              </Text>
            )}
            {searchResult.day && (
              <Text style={styles.resultDay}>
                Jour programmé: {searchResult.day}
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
                    {searchResult.day ? `Déplacer au ${days}` : `Ajouter au ${days}`}
                  </Text>
                )}
              </TouchableOpacity>
            )}
            
            {isExerciseAlreadyScheduled() && (
              <Text style={styles.alreadyScheduled}>
                Cet exercice est déjà programmé pour le {days}
              </Text>
            )}
          </View>
        )}
      </View>
      
      {/* Liste des exercices du jour */}
      <View style={styles.exercisesSection}>
        <Text style={styles.sectionTitle}>Exercices programmés</Text>
        {loading ? (
          <ActivityIndicator size="large" color="#007BFF" />
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : exercices.length === 0 ? (
          <Text style={styles.subtitle}>Aucun exercice programmé pour ce jour.</Text>
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
                    Muscles travaillés: {item.muscles.join(', ')}
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
  // Section de recherche
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
  // Résultat de recherche
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
  // Section des exercices du jour
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
