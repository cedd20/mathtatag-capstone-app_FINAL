import { MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { get, onValue, ref, set } from 'firebase/database';
import React, { useEffect, useState } from 'react';
import { Alert, Dimensions, ImageBackground, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../constants/firebaseConfig';

const bgImage = require('../assets/images/bg.jpg');
const { width, height } = Dimensions.get('window');

// Helper to get status from score
function getStatusFromScore(score: number, total: number, pattern: number, numbers: number) {
  if ((pattern ?? 0) === 0 && (numbers ?? 0) === 0) return 'Not yet taken';
  if (typeof score !== 'number' || typeof total !== 'number' || total === 0 || score === -1) return 'Not yet taken';
  const percent = (score / total) * 100;
  if (percent < 25) return 'Intervention';
  if (percent < 50) return 'For Consolidation';
  if (percent < 75) return 'For Enhancement';
  if (percent < 85) return 'Proficient';
  return 'Highly Proficient';
}

// Helper to format teacher name - return full name or default
function formatTeacherName(teacherName: string): string {
  if (!teacherName) return 'Teacher';
  return teacherName.trim();
}

// Helper to format parent name as "Student's Parent"
function formatParentName(studentData: any): string {
  if (!studentData?.nickname && !studentData?.name) return 'Parent';
  
  const studentName = studentData.nickname || studentData.name;
  const nameParts = studentName.trim().split(' ');
  const firstName = nameParts[0];
  
  // Handle names ending with 's' (add apostrophe) vs others (add 's)
  if (firstName.endsWith('s')) {
    return `${firstName}' Parent`;
  } else {
    return `${firstName}'s Parent`;
  }
}

const statusColors: any = {
  'Intervention': '#ff5a5a',
  'For Consolidation': '#ffb37b',
  'For Enhancement': '#ffe066',
  'Proficient': '#7ed957',
  'Highly Proficient': '#27ae60',
  'Not yet taken': '#888',
};

const incomeBrackets = [
  '₱10,000 and below',
  '₱10,001–15,000',
  '₱15,001–20,000',
  '₱20,001–25,000',
  '₱25,001 and above',
];

export default function ParentDashboard() {
  const router = useRouter();
  const { parentId, needsSetup } = useLocalSearchParams();
  const [parentData, setParentData] = useState<any>(null);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [setupName, setSetupName] = useState('');
  const [setupContact, setSetupContact] = useState('');
  const [setupLoading, setSetupLoading] = useState(false);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [focusedAnnouncement, setFocusedAnnouncement] = useState<any | null>(null);
  const [teachers, setTeachers] = useState<any>({});
  const [teachersById, setTeachersById] = useState<any>({});
  const [studentData, setStudentData] = useState<any>(null);
  const [classData, setClassData] = useState<any>(null);
  const [setupIncome, setSetupIncome] = useState('');
  const [incomeDropdownVisible, setIncomeDropdownVisible] = useState(false);

  React.useEffect(() => {
    if (!parentId) return;
    const fetchParentAndAnnouncements = async () => {
      const parentRef = ref(db, `Parents/${parentId}`);
      const snap = await get(parentRef);
      if (snap.exists()) {
        const data = snap.val();
        setParentData(data);
        if (!data.name || !data.contact || needsSetup === '1') {
          setShowSetupModal(true);
          setSetupName(data.name || '');
          setSetupContact(data.contact || '');
          setSetupIncome(data.householdIncome || incomeBrackets[0]);
        }
        if (data.studentId) {
          const studentRef = ref(db, `Students/${data.studentId}`);
          const studentSnap = await get(studentRef);
          if (studentSnap.exists()) {
            const studentData = studentSnap.val();
            const classid = studentData.classId;
            if (classid) {
              const annRef = ref(db, 'Announcements');
              onValue(annRef, (snapshot) => {
                const all = snapshot.val() || {};
                const filtered = Object.values(all).filter((a: any) => a.classid === classid);
                filtered.sort((a: any, b: any) => (b.date || '').localeCompare(a.date || ''));
                setAnnouncements(filtered);
              });
            }
          }
        }
      }
    };
    fetchParentAndAnnouncements();
  }, [parentId, needsSetup]);

  useEffect(() => {
    const teachersRef = ref(db, 'Teachers');
    get(teachersRef).then(snap => {
      if (snap.exists()) {
        const all = snap.val();
        setTeachers(all);
        const byId: any = {};
        Object.values(all).forEach((t: any) => {
          if (t.teacherId) byId[t.teacherId] = t;
        });
        setTeachersById(byId);
      }
    });
  }, []);

  useEffect(() => {
    if (parentData?.studentId) {
      const fetchStudentData = async () => {
        const snap = await get(ref(db, `Students/${parentData.studentId}`));
        if (snap.exists()) {
          const student = snap.val();
          setStudentData(student);
          
          // Fetch class data to get teacher information
          if (student.classId) {
            const classSnap = await get(ref(db, `Classes/${student.classId}`));
            if (classSnap.exists()) {
              setClassData(classSnap.val());
            }
          }
        }
      };
      fetchStudentData();
    }
  }, [parentData?.studentId]);

  const handleSetupSubmit = async () => {
    if (!setupName.trim() || !setupContact.trim()) {
      Alert.alert('Please enter your name and contact number.');
      return;
    }
    setSetupLoading(true);
    try {
      const parentRef = ref(db, `Parents/${parentId}`);
      await set(parentRef, {
        ...parentData,
        name: setupName.trim(),
        contact: setupContact.trim(),
        householdIncome: setupIncome,
      });
      setParentData((prev: any) => ({ ...prev, name: setupName.trim(), contact: setupContact.trim(), householdIncome: setupIncome }));
      setShowSetupModal(false);
      Alert.alert('Profile updated!');
    } catch (err) {
      Alert.alert('Failed to update profile.');
    }
    setSetupLoading(false);
  };

  const handleAnnouncementPress = (announcement: any) => {
    setFocusedAnnouncement(announcement);
    setModalVisible(true);
  };

  function formatDateTime(iso: string) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  const parentLastName = parentData?.name ? parentData.name.trim().split(' ').slice(-1)[0] : '';
  const prePattern = studentData?.preScore?.pattern ?? 0;
  const preNumbers = studentData?.preScore?.numbers ?? 0;
  const preScore = prePattern + preNumbers;
  const preStatus = getStatusFromScore(preScore, 20, prePattern, preNumbers);
  const postPattern = studentData?.postScore?.pattern ?? 0;
  const postNumbers = studentData?.postScore?.numbers ?? 0;
  const postScore = postPattern + postNumbers;
  const postStatus = getStatusFromScore(postScore, 20, postPattern, postNumbers);

  // Week progress data for home exercise - all 0% since not started yet
  const weekProgress = [
    { week: 1, progress: 0 },
    { week: 2, progress: 0 },
    { week: 3, progress: 0 },
    { week: 4, progress: 0 },
    { week: 5, progress: 0 },
    { week: 6, progress: 0 },
    { week: 7, progress: 0 },
    { week: 8, progress: 0 },
  ];

  return (
    <ImageBackground source={bgImage} style={styles.bg} imageStyle={{ opacity: 0.13, resizeMode: 'cover' }}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.welcomeText}>Welcome,</Text>
              <Text style={styles.userId}>{formatParentName(studentData)}</Text>
            </View>
            <TouchableOpacity style={styles.profileButton} onPress={() => setShowSetupModal(true)}>
              <MaterialIcons name="account-circle" size={48} color="#2ecc40" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Announcement Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Announcement</Text>
            <View style={styles.greenDot} />
          </View>
          
          {announcements.length > 0 ? (
            <TouchableOpacity 
              style={styles.announcementCard}
              onPress={() => handleAnnouncementPress(announcements[0])}
              activeOpacity={0.8}
            >
              <View style={styles.teacherInfo}>
                <View style={styles.teacherAvatar}>
                  <MaterialIcons name="person" size={24} color="#2ecc40" />
                </View>
                <View style={styles.teacherDetails}>
                  <Text style={styles.teacherName}>
                    {formatTeacherName(teachersById[classData?.teacherId]?.name)}
                  </Text>
                  <Text style={styles.teacherGrade}>
                    Teacher
                  </Text>
                </View>
              </View>
              <Text style={styles.announcementText}>
                {announcements[0]?.message || 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nam fermentum vestibulum lectus, eget eleifend tellus dignissim non. Praesent ultrices faucibus condimentum.'}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.announcementCard}>
              <View style={styles.teacherInfo}>
                <View style={styles.teacherAvatar}>
                  <MaterialIcons name="person" size={24} color="#2ecc40" />
                </View>
                <View style={styles.teacherDetails}>
                  <Text style={styles.teacherName}>
                    {formatTeacherName(teachersById[classData?.teacherId]?.name)}
                  </Text>
                  <Text style={styles.teacherGrade}>
                    Teacher
                  </Text>
                </View>
              </View>
              <Text style={styles.announcementText}>
                No announcements yet. Check back later for updates from your child's teacher.
              </Text>
            </View>
          )}
        </View>

        {/* Home Exercise Button */}
        <TouchableOpacity 
          style={styles.homeExerciseButton} 
          activeOpacity={0.8}
          onPress={() => router.push('/WelcomePage')}
        >
          <Text style={styles.homeExerciseText}>Home Exercise</Text>
        </TouchableOpacity>

        {/* Academic Progress Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Quarter 1</Text>
            <MaterialIcons name="keyboard-arrow-down" size={24} color="#666" />
          </View>
          
          <View style={styles.progressCards}>
            <View style={styles.progressCard}>
              <View style={styles.progressCircle}>
                <Text style={styles.progressPercent}>{Math.round((preScore / 20) * 100)}%</Text>
              </View>
              <Text style={styles.progressLabel}>Pretest</Text>
              <Text style={styles.progressScore}>{preScore}/20</Text>
            </View>
            
            <View style={styles.progressCard}>
              <View style={[styles.progressCircle, { borderColor: '#ff5a5a' }]}>
                <Text style={[styles.progressPercent, { color: '#ff5a5a' }]}>{Math.round((postScore / 20) * 100)}%</Text>
              </View>
              <Text style={styles.progressLabel}>Post-test</Text>
              <Text style={styles.progressScore}>{postScore}/20</Text>
            </View>
          </View>

          {/* Week Progress */}
          <View style={styles.weekProgress}>
            {weekProgress.map((week, index) => (
              <View key={index} style={styles.weekRow}>
                <Text style={styles.weekText}>Week {week.week}</Text>
                <View style={styles.progressBarContainer}>
                  <View style={[styles.progressBar, { width: `${week.progress}%` }]} />
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Announcement Modal */}
        <Modal
          visible={modalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setModalVisible(false)}
        >
          <BlurView intensity={60} tint="light" style={styles.modalBlur}>
            <View style={styles.modalContainer}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>{focusedAnnouncement?.title || 'Announcement'}</Text>
                <Text style={styles.modalTeacher}>
                  {formatTeacherName(teachersById[focusedAnnouncement?.teacherid]?.name) || `Teacher ${focusedAnnouncement?.teacherid}`}
                </Text>
                <Text style={styles.modalMessage}>{focusedAnnouncement?.message}</Text>
                <Text style={styles.modalDate}>{formatDateTime(focusedAnnouncement?.date)}</Text>
                <TouchableOpacity 
                  style={styles.modalCloseButton}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.modalCloseText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </BlurView>
        </Modal>

        {/* Setup Modal */}
        <Modal
          visible={showSetupModal}
          transparent
          animationType="fade"
          onRequestClose={() => {}}
        >
          <BlurView intensity={60} tint="light" style={styles.modalBlur}>
            <View style={styles.modalContainer}>
              <View style={styles.setupModalContent}>
                <Text style={styles.setupTitle}>Set Up Your Profile</Text>
                
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Full Name</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Your Name"
                    value={setupName}
                    onChangeText={setSetupName}
                  />
                </View>
                
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Contact Number</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Contact Number"
                    value={setupContact}
                    onChangeText={setSetupContact}
                    keyboardType="phone-pad"
                  />
                </View>
                
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Household Monthly Income</Text>
                  <TouchableOpacity
                    style={styles.dropdownButton}
                    onPress={() => setIncomeDropdownVisible(true)}
                  >
                    <Text style={[styles.dropdownText, { color: setupIncome ? '#222' : '#aaa' }]}>
                      {setupIncome || 'Select income bracket'}
                    </Text>
                  </TouchableOpacity>
                </View>
                
                <View style={styles.setupButtons}>
                  <TouchableOpacity
                    style={styles.saveButton}
                    onPress={handleSetupSubmit}
                    disabled={setupLoading}
                  >
                    <Text style={styles.saveButtonText}>
                      {setupLoading ? 'Saving...' : 'Save'}
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.logoutButton}
                    onPress={() => router.replace('/RoleSelection')}
                  >
                    <MaterialIcons name="logout" size={20} color="#fff" />
                    <Text style={styles.logoutButtonText}>Logout</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </BlurView>
        </Modal>

        {/* Income Dropdown Modal */}
        <Modal
          visible={incomeDropdownVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setIncomeDropdownVisible(false)}
        >
          <Pressable 
            style={styles.dropdownOverlay} 
            onPress={() => setIncomeDropdownVisible(false)}
          >
            <View style={styles.dropdownContent}>
              {incomeBrackets.map((bracket) => (
                <TouchableOpacity
                  key={bracket}
                  style={styles.dropdownItem}
                  onPress={() => { 
                    setSetupIncome(bracket); 
                    setIncomeDropdownVisible(false); 
                  }}
                >
                  <Text style={styles.dropdownItemText}>{bracket}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Pressable>
        </Modal>
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  container: {
    alignItems: 'center',
    paddingBottom: 32,
    minHeight: height,
  },
  header: {
    width: '100%',
    paddingTop: Math.max(32, height * 0.01),
    paddingBottom: 20,
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(46, 204, 64, 0.1)',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Math.max(20, width * 0.05),
  },
  welcomeText: {
    fontSize: Math.max(24, width * 0.06),
    fontWeight: '700',
    color: '#1a1a1a',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  userId: {
    fontSize: Math.max(20, width * 0.05),
    fontWeight: '700',
    color: '#2ecc40',
    marginTop: 2,
    letterSpacing: 0.8,
    textShadowColor: 'rgba(46, 204, 64, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  profileButton: {
    backgroundColor: '#fff',
    borderRadius: 32,
    padding: 12,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    borderWidth: 3,
    borderColor: 'rgba(46, 204, 64, 0.2)',
  },
  section: {
    width: '92%',
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: Math.max(22, width * 0.055),
    fontWeight: '700',
    color: '#1a1a1a',
    marginRight: 12,
    letterSpacing: 0.5,
  },
  greenDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#2ecc40',
  },
  announcementCard: {
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderRadius: 28,
    padding: 28,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(46, 204, 64, 0.08)',
  },
  teacherInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  teacherAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
    borderWidth: 3,
    borderColor: '#2ecc40',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  teacherDetails: {
    flex: 1,
  },
  teacherName: {
    fontWeight: '700',
    fontSize: Math.max(19, width * 0.048),
    color: '#1a1a1a',
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  teacherGrade: {
    fontSize: Math.max(15, width * 0.038),
    color: '#2ecc40',
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  announcementText: {
    fontSize: Math.max(14, width * 0.035),
    color: '#333',
    lineHeight: Math.max(20, width * 0.05),
    textAlign: 'justify',
  },
  homeExerciseButton: {
    backgroundColor: '#2ecc40',
    borderRadius: 25,
    paddingVertical: 16,
    paddingHorizontal: 32,
    marginVertical: 20,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  homeExerciseText: {
    color: '#fff',
    fontSize: Math.max(18, width * 0.045),
    fontWeight: 'bold',
    textAlign: 'center',
  },
  progressCards: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 16,
  },
  progressCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  progressCircle: {
    width: Math.max(80, width * 0.2),
    height: Math.max(80, width * 0.2),
    borderRadius: Math.max(40, width * 0.1),
    borderWidth: 8,
    borderColor: '#2ecc40',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f7fafd',
    marginBottom: 12,
  },
  progressPercent: {
    fontSize: Math.max(30, width * 0.075),
    fontWeight: '700',
    color: '#2ecc40',
    letterSpacing: 0.5,
  },
  progressLabel: {
    fontSize: Math.max(15, width * 0.038),
    fontWeight: '600',
    color: '#222',
    marginBottom: 4,
  },
  progressScore: {
    fontSize: Math.max(22, width * 0.055),
    fontWeight: '700',
    color: '#0097a7',
    letterSpacing: 0.3,
  },
  weekProgress: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  weekText: {
    fontSize: Math.max(14, width * 0.035),
    fontWeight: '600',
    color: '#222',
    width: Math.max(60, width * 0.15),
  },
  progressBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: '#e6e6e6',
    borderRadius: 4,
    marginLeft: 16,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#2ecc40',
    borderRadius: 4,
  },
  modalBlur: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  modalContent: {
    width: '85%',
    maxWidth: 420,
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderRadius: 22,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  modalTitle: {
    fontWeight: 'bold',
    fontSize: Math.max(18, width * 0.045),
    color: '#27ae60',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalTeacher: {
    fontSize: Math.max(15, width * 0.038),
    color: '#444',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: Math.max(16, width * 0.04),
    color: '#222',
    lineHeight: Math.max(22, width * 0.055),
    marginBottom: 16,
    textAlign: 'justify',
  },
  modalDate: {
    fontSize: Math.max(12, width * 0.03),
    color: '#aaa',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalCloseButton: {
    backgroundColor: '#2ecc40',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignSelf: 'center',
  },
  modalCloseText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: Math.max(16, width * 0.04),
  },
  setupModalContent: {
    width: Math.min(320, width * 0.8),
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
  },
  setupTitle: {
    fontWeight: 'bold',
    fontSize: Math.max(20, width * 0.05),
    color: '#27ae60',
    marginBottom: 20,
  },
  inputGroup: {
    width: '100%',
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: Math.max(15, width * 0.038),
    color: '#222',
    marginBottom: 6,
    fontWeight: '600',
  },
  textInput: {
    width: '100%',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0f7e2',
    padding: 12,
    fontSize: Math.max(16, width * 0.04),
  },
  dropdownButton: {
    borderWidth: 1,
    borderColor: '#e0f7e2',
    borderRadius: 10,
    backgroundColor: '#f9f9f9',
    padding: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
  dropdownText: {
    fontSize: Math.max(15, width * 0.038),
  },
  setupButtons: {
    flexDirection: 'row',
    width: '100%',
    marginTop: 8,
    gap: 12,
  },
  saveButton: {
    backgroundColor: '#27ae60',
    borderRadius: 10,
    paddingVertical: 12,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: Math.max(16, width * 0.04),
  },
  logoutButton: {
    backgroundColor: '#ff5a5a',
    borderRadius: 10,
    paddingVertical: 12,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  logoutButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: Math.max(16, width * 0.04),
  },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    minWidth: Math.max(260, width * 0.65),
  },
  dropdownItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  dropdownItemText: {
    fontSize: Math.max(16, width * 0.04),
    color: '#222',
  },
}); 