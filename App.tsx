import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert } from 'react-native';
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
    console.log("Selected image URI:", uri);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Memory</Text>
      <Text style={styles.subtitle}>Your temporary screenshot layer</Text>
      <TouchableOpacity style={styles.button} onPress={pickImage} disabled={isProcessing}>
        <Text style={styles.buttonText}>Select Screenshot</Text>
      </TouchableOpacity>
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
  },
  buttonText: {
    color: '#000',
    fontWeight: 'bold',
  },
});
