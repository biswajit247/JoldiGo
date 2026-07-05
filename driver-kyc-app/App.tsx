import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  Image, 
  Alert,
  SafeAreaView
} from 'react-native';
import { create } from 'zustand';
import * as ImagePicker from 'expo-image-picker';

// 1. ZUSTAND LOCAL STATE MANAGEMENT CONTROLLER
interface KYCState {
  step: number;
  phone: string;
  isOtpVerified: boolean;
  name: string;
  age: string;
  city: string;
  selfieUri: string | null;
  vehicleType: 'bike' | 'auto';
  vehicleModel: string;
  vehiclePlate: string;
  licenseNumber: string;
  licensePhoto: string | null;
  rcNumber: string;
  rcPhoto: string | null;
  insurancePhoto: string | null;
  pucPhoto: string | null;
  aadharNumber: string;
  aadharPhoto: string | null;
  bankAccount: string;
  bankIfsc: string;
  bankHolder: string;
  setField: (key: string, value: any) => void;
  resetForm: () => void;
}

const useKYCStore = create<KYCState>((set) => ({
  step: 1,
  phone: '',
  isOtpVerified: false,
  name: '',
  age: '',
  city: 'Kolkata',
  selfieUri: null,
  vehicleType: 'bike',
  vehicleModel: '',
  vehiclePlate: '',
  licenseNumber: '',
  licensePhoto: null,
  rcNumber: '',
  rcPhoto: null,
  insurancePhoto: null,
  pucPhoto: null,
  aadharNumber: '',
  aadharPhoto: null,
  bankAccount: '',
  bankIfsc: '',
  bankHolder: '',
  setField: (key, value) => set((state) => ({ ...state, [key]: value })),
  resetForm: () => set({
    step: 1,
    phone: '',
    isOtpVerified: false,
    name: '',
    age: '',
    city: 'Kolkata',
    selfieUri: null,
    vehicleType: 'bike',
    vehicleModel: '',
    vehiclePlate: '',
    licenseNumber: '',
    licensePhoto: null,
    rcNumber: null,
    rcPhoto: null,
    insurancePhoto: null,
    pucPhoto: null,
    aadharNumber: '',
    aadharPhoto: null,
    bankAccount: '',
    bankIfsc: '',
    bankHolder: ''
  })
}));

// MOCK COMPRESSION SIMULATOR
const compressImagePayload = async (uri: string): Promise<string> => {
  console.log("Compressing image at:", uri);
  // In production, use Expo ImageManipulator:
  // const result = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 600 } }], { compress: 0.6, format: SaveFormat.JPEG });
  return uri; 
};

export default function App() {
  const store = useKYCStore();
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  // CAMERA & GALLERY PICKER LOGIC
  const pickImage = async (fieldKey: string, useCamera: boolean) => {
    const permissionResult = useCamera 
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert("Permission Denied", "Camera or gallery access is required to upload KYC documents.");
      return;
    }

    const result = useCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const compressedUri = await compressImagePayload(result.assets[0].uri);
      store.setField(fieldKey, compressedUri);
    }
  };

  const handleNextStep = () => {
    if (store.step === 1 && !store.isOtpVerified) {
      Alert.alert("OTP Required", "Please verify your mobile number first.");
      return;
    }
    if (store.step === 2 && (!store.name || !store.age || !store.selfieUri)) {
      Alert.alert("Fields Required", "Please input your name, age, and take a profile selfie.");
      return;
    }
    if (store.step === 3 && (!store.vehicleModel || !store.vehiclePlate)) {
      Alert.alert("Fields Required", "Please input vehicle brand name and plate number.");
      return;
    }
    if (store.step === 4 && (!store.licensePhoto || !store.rcPhoto || !store.insurancePhoto || !store.pucPhoto || !store.aadharPhoto)) {
      Alert.alert("KYC Required", "All 5 verification document snaps are required to proceed.");
      return;
    }
    if (store.step === 5 && (!store.bankAccount || !store.bankIfsc || !store.bankHolder)) {
      Alert.alert("Banking Required", "Please input account details for payouts.");
      return;
    }

    if (store.step === 5) {
      // Submit registration to server
      store.setField('step', 6);
    } else {
      store.setField('step', store.step + 1);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER WIZARD BAR */}
      {store.step <= 5 && (
        <View style={styles.header}>
          <Text style={styles.stepText}>Step {store.step} of 5</Text>
          <View style={styles.progressBar}>
            {Array.from({ length: 5 }).map((_, idx) => (
              <View 
                key={idx} 
                style={[
                  styles.progressSegment, 
                  idx + 1 <= store.step ? styles.progressActive : styles.progressInactive
                ]} 
              />
            ))}
          </View>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* STEP 1: MOBILE OTP VERIFICATION */}
        {store.step === 1 && (
          <View style={styles.stepContainer}>
            <Text style={styles.title}>Verify Phone Number</Text>
            <Text style={styles.subtitle}>Receive a security OTP to verify identity</Text>
            <TextInput 
              style={styles.input} 
              placeholder="Enter Mobile Number" 
              placeholderTextColor="#666"
              keyboardType="phone-pad"
              value={store.phone}
              onChangeText={(text) => store.setField('phone', text)}
            />
            {!otpSent ? (
              <TouchableOpacity style={styles.button} onPress={() => setOtpSent(true)}>
                <Text style={styles.buttonText}>Send OTP</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.otpBox}>
                <Text style={styles.hintText}>SMS Code Hint: 123456</Text>
                <TextInput 
                  style={[styles.input, { textAlign: 'center', letterSpacing: 4 }]} 
                  placeholder="Enter 6-Digit OTP" 
                  placeholderTextColor="#666"
                  keyboardType="number-pad"
                  maxLength={6}
                  value={otpCode}
                  onChangeText={setOtpCode}
                />
                <TouchableOpacity 
                  style={[styles.button, { backgroundColor: '#ffdd00' }]} 
                  onPress={() => {
                    if (otpCode === '123456') {
                      store.setField('isOtpVerified', true);
                      store.setField('step', 2);
                    } else {
                      Alert.alert("Error", "Invalid OTP code.");
                    }
                  }}
                >
                  <Text style={[styles.buttonText, { color: '#000' }]}>Verify & Continue</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* STEP 2: BASIC PROFILE */}
        {store.step === 2 && (
          <View style={styles.stepContainer}>
            <Text style={styles.title}>Basic Profile</Text>
            <TextInput 
              style={styles.input} 
              placeholder="Full Name" 
              placeholderTextColor="#666"
              value={store.name}
              onChangeText={(text) => store.setField('name', text)}
            />
            <TextInput 
              style={styles.input} 
              placeholder="Age" 
              placeholderTextColor="#666"
              keyboardType="number-pad"
              value={store.age}
              onChangeText={(text) => store.setField('age', text)}
            />
            
            <View style={styles.uploadCard}>
              <Text style={styles.uploadLabel}>Profile Photo / Selfie</Text>
              {store.selfieUri ? (
                <View style={styles.previewBox}>
                  <Image source={{ uri: store.selfieUri }} style={styles.previewImage} />
                  <TouchableOpacity style={styles.retakeBtn} onPress={() => store.setField('selfieUri', null)}>
                    <Text style={styles.retakeText}>Retake Selfie</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.pickRow}>
                  <TouchableOpacity style={styles.pickerBtn} onPress={() => pickImage('selfieUri', true)}>
                    <Text style={styles.pickerText}>📷 Camera</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.pickerBtn} onPress={() => pickImage('selfieUri', false)}>
                    <Text style={styles.pickerText}>📤 Upload</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <TouchableOpacity style={styles.button} onPress={handleNextStep}>
              <Text style={styles.buttonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 3: VEHICLE SELECTION */}
        {store.step === 3 && (
          <View style={styles.stepContainer}>
            <Text style={styles.title}>Choose Vehicle Class</Text>
            <View style={styles.toggleRow}>
              <TouchableOpacity 
                style={[styles.toggleCard, store.vehicleType === 'bike' && styles.toggleActive]} 
                onPress={() => store.setField('vehicleType', 'bike')}
              >
                <Text style={styles.toggleIcon}>🏍️</Text>
                <Text style={styles.toggleTitle}>Bike Taxi</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.toggleCard, store.vehicleType === 'auto' && styles.toggleActive]} 
                onPress={() => store.setField('vehicleType', 'auto')}
              >
                <Text style={styles.toggleIcon}>🛺</Text>
                <Text style={styles.toggleTitle}>Auto Rickshaw</Text>
              </TouchableOpacity>
            </View>

            <TextInput 
              style={styles.input} 
              placeholder="Vehicle Brand & Model" 
              placeholderTextColor="#666"
              value={store.vehicleModel}
              onChangeText={(text) => store.setField('vehicleModel', text)}
            />
            <TextInput 
              style={styles.input} 
              placeholder="Vehicle Registration Plate" 
              placeholderTextColor="#666"
              value={store.vehiclePlate}
              onChangeText={(text) => store.setField('vehiclePlate', text)}
            />

            <TouchableOpacity style={styles.button} onPress={handleNextStep}>
              <Text style={styles.buttonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 4: DOCUMENT KYC UPLOADS */}
        {store.step === 4 && (
          <View style={styles.stepContainer}>
            <Text style={styles.title}>Submit KYC Documents</Text>
            
            {/* Driving License */}
            <View style={styles.documentCard}>
              <Text style={styles.docTitle}>1. Driving License (DL)</Text>
              <TextInput 
                style={styles.smallInput} 
                placeholder="DL Card Number" 
                placeholderTextColor="#666"
                value={store.licenseNumber}
                onChangeText={(text) => store.setField('licenseNumber', text)}
              />
              <View style={styles.pickRow}>
                <TouchableOpacity style={styles.smallPickerBtn} onPress={() => pickImage('licensePhoto', true)}><Text style={styles.pickerText}>📷 Camera</Text></TouchableOpacity>
                <TouchableOpacity style={styles.smallPickerBtn} onPress={() => pickImage('licensePhoto', false)}><Text style={styles.pickerText}>📤 Gallery</Text></TouchableOpacity>
              </View>
              {store.licensePhoto && <Text style={styles.verifiedLabel}>✅ DL Snap Loaded</Text>}
            </View>

            {/* RC Card */}
            <View style={styles.documentCard}>
              <Text style={styles.docTitle}>2. Registration Certificate (RC)</Text>
              <TextInput 
                style={styles.smallInput} 
                placeholder="RC Plate Number" 
                placeholderTextColor="#666"
                value={store.rcNumber}
                onChangeText={(text) => store.setField('rcNumber', text)}
              />
              <View style={styles.pickRow}>
                <TouchableOpacity style={styles.smallPickerBtn} onPress={() => pickImage('rcPhoto', true)}><Text style={styles.pickerText}>📷 Camera</Text></TouchableOpacity>
                <TouchableOpacity style={styles.smallPickerBtn} onPress={() => pickImage('rcPhoto', false)}><Text style={styles.pickerText}>📤 Gallery</Text></TouchableOpacity>
              </View>
              {store.rcPhoto && <Text style={styles.verifiedLabel}>✅ RC Snap Loaded</Text>}
            </View>

            {/* Insurance */}
            <View style={styles.documentCard}>
              <Text style={styles.docTitle}>3. Insurance Document Cover</Text>
              <View style={styles.pickRow}>
                <TouchableOpacity style={styles.smallPickerBtn} onPress={() => pickImage('insurancePhoto', true)}><Text style={styles.pickerText}>📷 Camera</Text></TouchableOpacity>
                <TouchableOpacity style={styles.smallPickerBtn} onPress={() => pickImage('insurancePhoto', false)}><Text style={styles.pickerText}>📤 Gallery</Text></TouchableOpacity>
              </View>
              {store.insurancePhoto && <Text style={styles.verifiedLabel}>✅ Insurance Loaded</Text>}
            </View>

            {/* PUC */}
            <View style={styles.documentCard}>
              <Text style={styles.docTitle}>4. Pollution Certificate (PUC)</Text>
              <View style={styles.pickRow}>
                <TouchableOpacity style={styles.smallPickerBtn} onPress={() => pickImage('pucPhoto', true)}><Text style={styles.pickerText}>📷 Camera</Text></TouchableOpacity>
                <TouchableOpacity style={styles.smallPickerBtn} onPress={() => pickImage('pucPhoto', false)}><Text style={styles.pickerText}>📤 Gallery</Text></TouchableOpacity>
              </View>
              {store.pucPhoto && <Text style={styles.verifiedLabel}>✅ PUC Loaded</Text>}
            </View>

            {/* Aadhaar */}
            <View style={styles.documentCard}>
              <Text style={styles.docTitle}>5. PAN / Aadhaar Card</Text>
              <TextInput 
                style={styles.smallInput} 
                placeholder="Aadhaar Card Number" 
                placeholderTextColor="#666"
                keyboardType="numeric"
                value={store.aadharNumber}
                onChangeText={(text) => store.setField('aadharNumber', text)}
              />
              <View style={styles.pickRow}>
                <TouchableOpacity style={styles.smallPickerBtn} onPress={() => pickImage('aadharPhoto', true)}><Text style={styles.pickerText}>📷 Camera</Text></TouchableOpacity>
                <TouchableOpacity style={styles.smallPickerBtn} onPress={() => pickImage('aadharPhoto', false)}><Text style={styles.pickerText}>📤 Gallery</Text></TouchableOpacity>
              </View>
              {store.aadharPhoto && <Text style={styles.verifiedLabel}>✅ Aadhaar Loaded</Text>}
            </View>

            <TouchableOpacity style={styles.button} onPress={handleNextStep}>
              <Text style={styles.buttonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 5: BANK DETAILS */}
        {store.step === 5 && (
          <View style={styles.stepContainer}>
            <Text style={styles.title}>Payout Bank Account</Text>
            <TextInput 
              style={styles.input} 
              placeholder="Account Holder Name" 
              placeholderTextColor="#666"
              value={store.bankHolder}
              onChangeText={(text) => store.setField('bankHolder', text)}
            />
            <TextInput 
              style={styles.input} 
              placeholder="Account Number" 
              placeholderTextColor="#666"
              value={store.bankAccount}
              onChangeText={(text) => store.setField('bankAccount', text)}
            />
            <TextInput 
              style={styles.input} 
              placeholder="IFSC Code" 
              placeholderTextColor="#666"
              value={store.bankIfsc}
              onChangeText={(text) => store.setField('bankIfsc', text)}
            />

            <TouchableOpacity style={styles.button} onPress={handleNextStep}>
              <Text style={styles.buttonText}>Submit Profile for Review</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 6: LANDING STATUS DASHBOARD */}
        {store.step === 6 && (
          <View style={[styles.stepContainer, { alignItems: 'center' }]}>
            <Text style={styles.landingIcon}>⏳</Text>
            <Text style={[styles.title, { color: '#ffdd00' }]}>Verification Pending</Text>
            <Text style={styles.landingText}>Your driver partner credentials and snaps are under review by Jaldi Go Operations.</Text>
            
            <View style={styles.statusPanel}>
              <View style={styles.statusRow}><Text style={styles.statusItem}>Driving License</Text><Text style={styles.badgePending}>Pending</Text></View>
              <View style={styles.statusRow}><Text style={styles.statusItem}>Vehicle RC</Text><Text style={styles.badgePending}>Pending</Text></View>
              <View style={styles.statusRow}><Text style={styles.statusItem}>Insurance Document</Text><Text style={styles.badgePending}>Pending</Text></View>
              <View style={styles.statusRow}><Text style={styles.statusItem}>PUC Certificate</Text><Text style={styles.badgePending}>Pending</Text></View>
              <View style={styles.statusRow}><Text style={styles.statusItem}>Aadhaar/PAN Card</Text><Text style={styles.badgePending}>Pending</Text></View>
            </View>

            <TouchableOpacity style={styles.resetButton} onPress={() => store.resetForm()}>
              <Text style={styles.resetText}>Register Another Captain</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0d14',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1f2c',
  },
  stepText: {
    color: '#a0aec0',
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  progressBar: {
    flexDirection: 'row',
    height: 4,
  },
  progressSegment: {
    flex: 1,
    height: '100%',
    marginRight: 4,
    borderRadius: 2,
  },
  progressActive: {
    backgroundColor: '#ffdd00',
  },
  progressInactive: {
    backgroundColor: '#2d3748',
  },
  scrollContent: {
    padding: 20,
  },
  stepContainer: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: '#718096',
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#161b26',
    borderWidth: 1,
    borderColor: '#2d3748',
    borderRadius: 6,
    padding: 12,
    fontSize: 14,
    color: '#fff',
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#ffdd00',
    borderRadius: 6,
    padding: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 14,
  },
  otpBox: {
    marginTop: 10,
  },
  hintText: {
    fontSize: 10,
    color: '#ffdd00',
    fontWeight: 'bold',
    textAlign: 'right',
    marginBottom: 4,
  },
  uploadCard: {
    backgroundColor: '#161b26',
    borderWidth: 1,
    borderColor: '#2d3748',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  uploadLabel: {
    color: '#a0aec0',
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  pickRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pickerBtn: {
    flex: 1,
    backgroundColor: '#2d3748',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  pickerText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  previewBox: {
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: 140,
    borderRadius: 6,
  },
  retakeBtn: {
    marginTop: 8,
    backgroundColor: '#e53e3e',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 4,
  },
  retakeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  toggleCard: {
    flex: 1,
    backgroundColor: '#161b26',
    borderWidth: 1,
    borderColor: '#2d3748',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  toggleActive: {
    borderColor: '#ffdd00',
    backgroundColor: 'rgba(255, 221, 0, 0.05)',
  },
  toggleIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  toggleTitle: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  documentCard: {
    backgroundColor: '#161b26',
    borderWidth: 1,
    borderColor: '#2d3748',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  docTitle: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  smallInput: {
    backgroundColor: '#0f121d',
    borderWidth: 1,
    borderColor: '#2d3748',
    borderRadius: 4,
    padding: 8,
    fontSize: 12,
    color: '#fff',
    marginBottom: 8,
  },
  smallPickerBtn: {
    flex: 1,
    backgroundColor: '#2d3748',
    padding: 8,
    borderRadius: 4,
    alignItems: 'center',
  },
  verifiedLabel: {
    color: '#48bb78',
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 8,
  },
  landingIcon: {
    fontSize: 48,
    marginTop: 40,
    marginBottom: 16,
  },
  landingText: {
    fontSize: 12,
    color: '#a0aec0',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  statusPanel: {
    width: '100%',
    backgroundColor: '#161b26',
    borderWidth: 1,
    borderColor: '#2d3748',
    borderRadius: 8,
    padding: 12,
    marginBottom: 30,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2d3748',
  },
  statusItem: {
    color: '#e2e8f0',
    fontSize: 13,
  },
  badgePending: {
    backgroundColor: 'rgba(214, 158, 46, 0.2)',
    color: '#ecc94b',
    fontSize: 11,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  resetButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#4a5568',
    padding: 12,
    borderRadius: 6,
    width: '100%',
    alignItems: 'center',
  },
  resetText: {
    color: '#a0aec0',
    fontSize: 12,
    fontWeight: 'bold',
  }
});
