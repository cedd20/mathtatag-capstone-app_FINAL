import { useFonts } from 'expo-font';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const { width, height } = Dimensions.get('window');

export default function WelcomePage() {
  const router = useRouter();
  const [fontsLoaded] = useFonts({
    'LeagueSpartan-Bold': require('../assets/fonts/LeagueSpartan-Bold.ttf'),
  });

  // Happy bouncy animation for logo
  const logoScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Happy bouncy animation for logo
    Animated.loop(
      Animated.sequence([
        Animated.timing(logoScale, { toValue: 1.15, duration: 400, useNativeDriver: true }),
        Animated.timing(logoScale, { toValue: 0.95, duration: 300, useNativeDriver: true }),
        Animated.timing(logoScale, { toValue: 1.1, duration: 300, useNativeDriver: true }),
        Animated.timing(logoScale, { toValue: 1, duration: 400, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  if (!fontsLoaded) return null;

  return (
    <View style={styles.container}>
      {/* Background Image - Full screen schoolyard scene */}
      <Image 
        source={require('../assets/game pngs/bgWelcome.png')} 
        style={styles.backgroundImage} 
        resizeMode="cover" 
      />
      
      {/* Game Logo - 3D "MATH TATAG GAME" text with happy bouncy animation */}
      <View style={styles.logoContainer}>
        <Animated.Image 
          source={require('../assets/game pngs/logo.png')}
          style={[styles.gameLogo, { transform: [{ scale: logoScale }] }]}
          resizeMode="contain"
        />
      </View>

      {/* Quarter Name Display */}
      <View style={styles.quarterContainer}>
        <Text style={styles.quarterText}>QUARTER 1</Text>
      </View>

      {/* Start Game Button - Orange button with "START GAME" text */}
      <View style={styles.startButtonContainer}>
        <TouchableOpacity 
          style={styles.startButton}
          onPress={() => router.push('/LoadingScreen')}
          activeOpacity={0.8}
        >
          <Image 
            source={require('../assets/game pngs/start.png')}
            style={styles.startButtonImage}
            resizeMode="contain"
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#e3f2fd',
  },
  backgroundImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    top: 0,
    left: 0,
    zIndex: 0,
  },
  logoContainer: {
    position: 'absolute',
    top: Math.max(30, height * 0.06),
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 2,
    paddingHorizontal: Math.max(20, width * 0.05),
  },
  gameLogo: {
    width: width * 0.7,
    height: 600,
    marginTop: -200,
    marginBottom: 0,
    zIndex: 2,
  },
  quarterContainer: {
    position: 'absolute',
    top: height * 0.6, // Adjust as needed
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 2,
    paddingHorizontal: Math.max(20, width * 0.05),
  },
  quarterText: {
    fontFamily: 'LeagueSpartan-Bold',
    fontSize: 25,
    color: '#333',
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  startButtonContainer: {
    position: 'absolute',
    bottom: -50,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 3,
  },
  startButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonImage: {
    width: 500,
    height: 500,
  },
}); 