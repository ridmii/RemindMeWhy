import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, Image,
  FlatList, ActivityIndicator, Alert
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as MediaLibrary from 'expo-media-library/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';

// --- ⚠️ CHANGE THIS TO YOUR COMPUTER'S CURRENT IP ADDRESS ---
const BACKEND_URL = 'http://172.20.10.2:8000/extract';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

type MemoryCard = {
  id: string;
  imageUri: string;
  originalUri: string;
  category: string;
  title: string;
  summary: string;
  actionableTime: string;
  expiryTime: string;
};

export default function App() {
  const [memories, setMemories] = useState<MemoryCard[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // This keeps track of what we've already scanned (prevents duplicates)
  const processedUris = useRef<Set<string>>(new Set());

  // 1. Load saved memories from the phone's storage when the app starts
  useEffect(() => {
    const loadMemories = async () => {
      try {
        const stored = await AsyncStorage.getItem('@memories');
        if (stored) {
          const parsed: MemoryCard[] = JSON.parse(stored);
          setMemories(parsed);
          // Mark all loaded memories as "processed" so we don't scan them again
          parsed.forEach(m => processedUris.current.add(m.originalUri));
        }
      } catch (e) {
        console.error("Failed to load memories", e);
      } finally {
        setIsLoaded(true);
      }
    };
    loadMemories();
  }, []);

  // 2. Save memories to storage whenever the list changes
  useEffect(() => {
    if (!isLoaded) return;
    AsyncStorage.setItem('@memories', JSON.stringify(memories)).catch(console.error);
  }, [memories, isLoaded]);

  // 3. Start scanning once the app has finished loading saved data
  useEffect(() => {
    if (isLoaded) {
      Notifications.requestPermissionsAsync();
      scanScreenshots();
    }
  }, [isLoaded]);

  const scanScreenshots = async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert("Permission needed", "We need photo access to scan your screenshots.");
        return;
      }

      // NEW: Only get screenshots from the last 7 days
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const assets = await MediaLibrary.getAssetsAsync({
        mediaType: 'photo',
        mediaSubtypes: ['screenshot'],
        sortBy: 'creationTime',
        first: 10,
        createdAfter: oneWeekAgo.getTime(), // <--- Only recent screenshots
      });

      if (assets.assets.length === 0) return;

      const newAssets = assets.assets.filter(a => !processedUris.current.has(a.uri));

      if (newAssets.length === 0) {
        console.log("No new screenshots to process.");
        return;
      }

      setIsProcessing(true);
      for (const asset of newAssets) {
        await processScreenshot(asset.uri);
      }

    } catch (error) {
      console.error("Scan error:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const processScreenshot = async (uri: string) => {
    processedUris.current.add(uri);

    try {
      const manipResult = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 800 } }],
        { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG }
      );

      const base64String = await FileSystem.readAsStringAsync(manipResult.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const response = await fetch(BACKEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: base64String,
          current_time: new Date().toISOString()
        })
      });

      const aiData = await response.json();

      if (aiData.is_actionable) {
        // NEW: Check if the event has already expired (passed)
        const expiryDate = aiData.expiry_time && aiData.expiry_time !== 'null'
          ? new Date(aiData.expiry_time)
          : null;

        if (expiryDate && expiryDate < new Date()) {
          console.log(`Skipping old event: ${aiData.title} (Expired on ${aiData.expiry_time})`);
          return; // Skip this card completely
        }

        const newCard: MemoryCard = {
          id: Math.random().toString(),
          imageUri: manipResult.uri,
          originalUri: uri,
          category: aiData.category || 'other',
          title: aiData.title || 'New Memory',
          summary: aiData.summary || 'No summary available.',
          actionableTime: aiData.actionable_time || 'N/A',
          expiryTime: aiData.expiry_time || 'N/A',
        };

        setMemories((prev) => [newCard, ...prev]);

        // NEW: Schedule 2-day and 1-day advance notifications
        if (aiData.actionable_time && aiData.actionable_time !== 'null') {
          const eventDate = new Date(aiData.actionable_time);

          // Notification 1: 2 Days Before
          const twoDaysBefore = new Date(eventDate);
          twoDaysBefore.setDate(twoDaysBefore.getDate() - 2);

          if (twoDaysBefore > new Date()) {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: "Upcoming: " + newCard.title,
                body: "Happening in 2 days! " + newCard.summary,
              },
              trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: twoDaysBefore
              },
            });
            console.log(`Scheduled 2-day reminder for ${twoDaysBefore}`);
          }

          // Notification 2: 1 Day Before
          const oneDayBefore = new Date(eventDate);
          oneDayBefore.setDate(oneDayBefore.getDate() - 1);

          if (oneDayBefore > new Date()) {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: "Tomorrow: " + newCard.title,
                body: "Happening tomorrow! " + newCard.summary,
              },
              trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: oneDayBefore
              },
            });
            console.log(`Scheduled 1-day reminder for ${oneDayBefore}`);
          }
        }
      }
    } catch (error: any) {
      console.error("Process error:", error.message);
      processedUris.current.delete(uri);
    }
  };

  const renderCard = ({ item }: { item: MemoryCard }) => (
    <View style={styles.card}>
      <Image source={{ uri: item.imageUri }} style={styles.cardImage} />
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={styles.categoryTag}>{item.category.toUpperCase()}</Text>
          <Text style={styles.expiryText}>Expires: {item.expiryTime.split('T')[0]}</Text>
        </View>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardSummary}>{item.summary}</Text>
        <View style={styles.actionRow}>
          <MaterialIcons name="notifications-active" size={16} color="#FFB86C" />
          <Text style={styles.actionText}>Remind me: {item.actionableTime.split('T')[0]}</Text>
        </View>
      </View>
    </View>
  );

  // Show a loading screen while fetching from AsyncStorage on boot
  if (!isLoaded) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#50FA7B" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Memory</Text>
          <Text style={styles.headerSubtitle}>Automatically scanning screenshots</Text>
        </View>

        {isProcessing && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#50FA7B" />
            <Text style={styles.loadingText}>AI is scanning your screenshots...</Text>
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
              <Text style={styles.emptySubText}>Take a screenshot and tap refresh.</Text>
            </View>
          }
        />

        <TouchableOpacity style={styles.fab} onPress={scanScreenshots} disabled={isProcessing}>
          <MaterialIcons name="refresh" size={32} color="#000" />
        </TouchableOpacity>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  header: { padding: 20, paddingTop: 40, borderBottomWidth: 1, borderBottomColor: '#222' },
  headerTitle: { fontSize: 32, fontWeight: 'bold', color: '#FFF' },
  headerSubtitle: { fontSize: 14, color: '#888', marginTop: 4 },
  listContainer: { padding: 16, paddingBottom: 100 },
  card: { backgroundColor: '#1E1E1E', borderRadius: 16, marginBottom: 16, overflow: 'hidden', flexDirection: 'row', elevation: 3 },
  cardImage: { width: 100, height: '100%', backgroundColor: '#333' },
  cardContent: { flex: 1, padding: 16 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  categoryTag: { color: '#50FA7B', fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },
  expiryText: { color: '#666', fontSize: 10 },
  cardTitle: { color: '#FFF', fontSize: 18, fontWeight: '600', marginBottom: 4 },
  cardSummary: { color: '#AAA', fontSize: 13, lineHeight: 18, marginBottom: 12 },
  actionRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2A2A2A', padding: 8, borderRadius: 8 },
  actionText: { color: '#FFB86C', fontSize: 12, marginLeft: 6, fontWeight: '500' },
  fab: { position: 'absolute', bottom: 32, right: 32, width: 64, height: 64, borderRadius: 32, backgroundColor: '#50FA7B', justifyContent: 'center', alignItems: 'center', elevation: 5, shadowColor: '#50FA7B', shadowOpacity: 0.5, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  emptyState: { alignItems: 'center', marginTop: 100 },
  emptyText: { color: '#FFF', fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptySubText: { color: '#666', fontSize: 14, marginTop: 8 },
  loadingOverlay: { position: 'absolute', top: 100, alignSelf: 'center', backgroundColor: '#1E1E1E', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 30, flexDirection: 'row', alignItems: 'center', zIndex: 10, elevation: 10 },
  loadingText: { color: '#FFF', marginLeft: 12, fontWeight: '500' }
});