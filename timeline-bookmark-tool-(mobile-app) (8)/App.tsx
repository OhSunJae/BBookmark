
import React, {useEffect, useState} from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  DeviceEventEmitter,
  Modal,
  TextInput,
  FlatList,
  Linking,
  Alert,
  StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import FloatingWidgetModule from './native_modules/FloatingWidgetModule';

interface Bookmark {
  id: string;
  note: string;
  app: string;
  timestamp: string;
}

const App = () => {
  const [hasPermission, setHasPermission] = useState(false);
  const [isServiceRunning, setIsServiceRunning] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentNote, setCurrentNote] = useState('');
  const [context, setContext] = useState<{app: string; timestamp: string} | null>(null);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);

  // Load bookmarks from storage on mount
  useEffect(() => {
    const loadBookmarks = async () => {
      try {
        const storedBookmarks = await AsyncStorage.getItem('bookmarks');
        if (storedBookmarks) {
          setBookmarks(JSON.parse(storedBookmarks));
        }
      } catch (e) {
        console.error("Failed to load bookmarks.", e);
      }
    };
    loadBookmarks();
  }, []);

  // Check initial permission status and service status
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const permissionStatus = await FloatingWidgetModule.hasOverlayPermission();
        setHasPermission(permissionStatus);
        if(permissionStatus) {
            const serviceStatus = await FloatingWidgetModule.isServiceRunning();
            setIsServiceRunning(serviceStatus);
        }
      } catch (e) {
        console.error("Failed to check status.", e);
      }
    };
    checkStatus();
  }, []);

  // Listen for floating button clicks from the native service
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(
      'onFloatingButtonPress',
      async () => {
        try {
          const foregroundApp = await FloatingWidgetModule.getForegroundApp();
          const timestamp = new Date().toLocaleString();
          setContext({ app: foregroundApp, timestamp });
          setModalVisible(true);
        } catch (e) {
          console.error('Failed to get context', e);
          Alert.alert("Error", "Could not get current app info. You may need to grant Usage Access permission manually in your phone's settings.");
        }
      },
    );

    return () => {
      subscription.remove();
    };
  }, []);

  const requestPermission = async () => {
    try {
        const granted = await FloatingWidgetModule.requestOverlayPermission();
        setHasPermission(granted);
        if (!granted) {
            Alert.alert(
                "Permission Denied",
                "The floating button requires 'Draw over other apps' permission. Please grant it from the settings.",
                [{ text: "Open Settings", onPress: () => Linking.openSettings() }, { text: "Cancel" }]
            );
        }
    } catch (e) {
        console.error("Failed to request permission", e);
    }
  };

  const toggleService = () => {
    if (isServiceRunning) {
      FloatingWidgetModule.stopFloatingWidgetService();
      setIsServiceRunning(false);
    } else if (hasPermission) {
      FloatingWidgetModule.startFloatingWidgetService();
      setIsServiceRunning(true);
    } else {
      requestPermission();
    }
  };

  const handleSaveNote = async () => {
    if (!currentNote || !context) return;

    try {
        const newBookmark: Bookmark = {
          id: Date.now().toString(),
          note: currentNote,
          app: context.app,
          timestamp: context.timestamp,
        };

        const updatedBookmarks = [newBookmark, ...bookmarks];
        setBookmarks(updatedBookmarks);
        await AsyncStorage.setItem('bookmarks', JSON.stringify(updatedBookmarks));
        
        setCurrentNote('');
        setContext(null);
        setModalVisible(false);
    } catch (e) {
        console.error("Failed to save bookmark.", e);
        Alert.alert("Error", "Could not save the bookmark.");
    }
  };
  
  const renderBookmark = ({ item }: { item: Bookmark }) => (
    <View style={styles.bookmarkItem}>
      <Text style={styles.bookmarkNote}>{item.note}</Text>
      <Text style={styles.bookmarkContext}>
        Captured from: {item.app}
      </Text>
      <Text style={styles.bookmarkContext}>{item.timestamp}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />
      <View style={styles.header}>
        <Text style={styles.title}>Timeline Bookmark Tool</Text>
        <Text style={styles.subtitle}>React Native Edition</Text>
      </View>

      <View style={styles.controls}>
        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>Overlay Permission:</Text>
          <Text style={[styles.statusValue, { color: hasPermission ? '#4CAF50' : '#F44336' }]}>
            {hasPermission ? 'Granted' : 'Denied'}
          </Text>
        </View>
        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>Floating Button Service:</Text>
          <Text style={[styles.statusValue, { color: isServiceRunning ? '#4CAF50' : '#F44336' }]}>
            {isServiceRunning ? 'Running' : 'Stopped'}
          </Text>
        </View>
        
        {!hasPermission && (
          <TouchableOpacity style={styles.button} onPress={requestPermission}>
            <Text style={styles.buttonText}>Request Permission</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={[styles.button, !hasPermission && styles.buttonDisabled]} onPress={toggleService} disabled={!hasPermission}>
          <Text style={styles.buttonText}>{isServiceRunning ? 'Stop Service' : 'Start Service'}</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={bookmarks}
        renderItem={renderBookmark}
        keyExtractor={item => item.id}
        style={styles.list}
        ListHeaderComponent={<Text style={styles.listHeader}>My Bookmarks</Text>}
        ListEmptyComponent={<Text style={styles.emptyList}>No bookmarks yet. Start the service and tap the floating button!</Text>}
      />

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>Add Bookmark</Text>
            {context && (
                <Text style={styles.modalContext}>
                    From: {context.app} at {context.timestamp}
                </Text>
            )}
            <TextInput
              style={styles.input}
              placeholder="Enter your note..."
              placeholderTextColor="#888"
              value={currentNote}
              onChangeText={setCurrentNote}
              multiline
            />
            <TouchableOpacity style={styles.button} onPress={handleSaveNote}>
              <Text style={styles.buttonText}>Save Note</Text>
            </TouchableOpacity>
             <TouchableOpacity style={[styles.button, styles.buttonCancel]} onPress={() => setModalVisible(false)}>
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', padding: 16 },
  header: { marginBottom: 24, alignItems: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#FFF' },
  subtitle: { fontSize: 16, color: '#a5b4fc' },
  controls: { backgroundColor: '#1E1E1E', padding: 16, borderRadius: 8, marginBottom: 24 },
  statusContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  statusText: { color: '#CCC', fontSize: 16 },
  statusValue: { fontSize: 16, fontWeight: 'bold' },
  button: { backgroundColor: '#4F46E5', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 12 },
  buttonDisabled: { backgroundColor: '#444' },
  buttonCancel: { backgroundColor: '#555' },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  list: { flex: 1 },
  listHeader: { fontSize: 22, fontWeight: 'bold', color: '#FFF', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#333', paddingBottom: 8 },
  emptyList: { color: '#888', textAlign: 'center', marginTop: 40, fontSize: 16 },
  bookmarkItem: { backgroundColor: '#2A2A2A', padding: 16, borderRadius: 8, marginBottom: 10 },
  bookmarkNote: { color: '#FFF', fontSize: 16, fontWeight: '500' },
  bookmarkContext: { color: '#AAA', fontSize: 12, marginTop: 6 },
  modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)' },
  modalView: { width: '90%', backgroundColor: '#1E1E1E', borderRadius: 12, padding: 20, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#FFF', marginBottom: 8 },
  modalContext: { color: '#AAA', marginBottom: 16, textAlign: 'center' },
  input: { width: '100%', backgroundColor: '#333', color: '#FFF', borderRadius: 8, padding: 12, minHeight: 100, textAlignVertical: 'top', marginBottom: 16, fontSize: 16 },
});

export default App;
