import React, { useState } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, Image,
  FlatList, ActivityIndicator, SafeAreaView, Alert
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { MaterialIcons } from '@expo/vector-icons';

// This is the structure the AI will eventually return
type MemoryCard = {
  id: string;
  imageUri: string;
  category: string;
  title: string;
  summary: string;
  actionableTime: string;
  expiryTime: string;
};

export default function App() {
  const [memories, setMemories] = useState<MemoryCard[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const pickImage = async () => {
    // Request permission
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert("Permission required", "You need to grant photo permissions to use this.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.5, // Compress image before sending to AI to save tokens
    });

    if (!result.canceled) {
      processImage(result.assets[0].uri);
    }
  };

  const processImage = async (uri: string) => {
    setIsProcessing(true);

    try {
      // 1. Prepare the form data
      const formData = new FormData();

      // React Native needs this specific format for file uploads
      const filename = uri.split('/').pop() || 'screenshot.jpg';
      formData.append('file', {
        uri: uri,
        name: filename,
        type: 'image/jpeg',
      } as any);

      // Pass the current time so the AI can calculate "tomorrow at 2 PM"
      formData.append('current_time', new Date().toISOString());

      // 2. Send to your FastAPI backend
      // REPLACE 192.168.X.X WITH YOUR COMPUTER'S LOCAL IP ADDRESS!
      const response = await fetch('http://192.168.X.X:8000/extract', {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const aiData = await response.json();
      console.log("AI Result:", aiData);

      // 3. Create the card from the AI result
      if (aiData.is_actionable) {
        const newCard: MemoryCard = {
          id: Math.random().toString(),
          imageUri: uri,
          category: aiData.category || 'other',
          title: aiData.title || 'New Memory',
          summary: aiData.summary || 'No summary available.',
          actionableTime: aiData.actionable_time || 'N/A',
          expiryTime: aiData.expiry_time || 'N/A',
        };

        setMemories((prev) => [newCard, ...prev]);
      } else {
        Alert.alert("Not actionable", "This screenshot doesn't contain useful data.");
      }

    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to process the image. Is your backend running?");
    } finally {
      setIsProcessing(false);
    }
  };

  const renderCard = ({ item }: { item: MemoryCard }) => (
    <View style={styles.card}>
      <Image source={{ uri: item.imageUri }} style={styles.cardImage} />
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={styles.categoryTag}>{item.category.toUpperCase()}</Text>
          <Text style={styles.expiryText}>Expires: {item.expiryTime}</Text>
        </View>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardSummary}>{item.summary}</Text>
        <View style={styles.actionRow}>
          <MaterialIcons name="notifications-active" size={16} color="#FFB86C" />
          <Text style={styles.actionText}>Remind me: {item.actionableTime}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Memory</Text>
        <Text style={styles.headerSubtitle}>Your temporary screenshot layer</Text>
      </View>

      {isProcessing && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#50FA7B" />
          <Text style={styles.loadingText}>AI is reading your screenshot...</Text>
        </View>
      )}

      <FlatList
        data={memories}
        keyExtractor={(item) => item.id}
        renderItem={renderCard}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialIcons name="document-scanner" size={64} color="#444" />
            <Text style={styles.emptyText}>No temporary memories yet.</Text>
            <Text style={styles.emptySubText}>Tap the + button to scan a screenshot.</Text>
          </View>
        }
      />

      <TouchableOpacity style={styles.fab} onPress={pickImage} disabled={isProcessing}>
        <MaterialIcons name="add" size={32} color="#000" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212', // Dark theme
  },
  header: {
    padding: 20,
    paddingTop: 40,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    flexDirection: 'row',
    elevation: 3,
  },
  cardImage: {
    width: 100,
    height: '100%',
    backgroundColor: '#333',
  },
  cardContent: {
    flex: 1,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryTag: {
    color: '#50FA7B',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  expiryText: {
    color: '#666',
    fontSize: 10,
  },
  cardTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  cardSummary: {
    color: '#AAA',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    padding: 8,
    borderRadius: 8,
  },
  actionText: {
    color: '#FFB86C',
    fontSize: 12,
    marginLeft: 6,
    fontWeight: '500',
  },
  fab: {
    position: 'absolute',
    bottom: 32,
    right: 32,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#50FA7B',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#50FA7B',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 100,
  },
  emptyText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubText: {
    color: '#666',
    fontSize: 14,
    marginTop: 8,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 100,
    alignSelf: 'center',
    backgroundColor: '#1E1E1E',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
    elevation: 10,
  },
  loadingText: {
    color: '#FFF',
    marginLeft: 12,
    fontWeight: '500',
  }
});