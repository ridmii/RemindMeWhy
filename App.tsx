import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';

// This is the structure the AI will eventually return
export type MemoryCard = {
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Memory</Text>
      <Text style={styles.subtitle}>Your temporary screenshot layer</Text>

      {isProcessing && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#50FA7B" />
          <Text style={styles.loadingText}>AI is reading your screenshot...</Text>
        </View>
      )}

      <TouchableOpacity style={styles.button} onPress={pickImage} disabled={isProcessing}>
        <Text style={styles.buttonText}>Select Screenshot</Text>
      </TouchableOpacity>

      <Text style={styles.counterText}>Memories extracted: {memories.length}</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#50FA7B',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  buttonText: {
    color: '#000',
    fontWeight: 'bold',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  loadingText: {
    marginLeft: 8,
    color: '#333',
  },
  counterText: {
    fontSize: 14,
    color: '#888',
  },
});
