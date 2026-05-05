import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { spacing } from './theme';

const { width: SCREEN_W } = Dimensions.get('window');
const CIRCLE = Math.min(SCREEN_W * 0.62, 280);
const SATELLITE_RADIUS = CIRCLE * 0.62;

type SatelliteDef = {
  icon: any;
  bg: string;
  color: string;
  startAngle: number; // in degrees, 0 = top
};

const SATELLITES: SatelliteDef[] = [
  { icon: 'sunny', bg: '#FDE2B7', color: '#E89B3E', startAngle: 0 },
  { icon: 'sparkles', bg: '#FBD3B9', color: '#C9744B', startAngle: 90 },
  { icon: 'moon', bg: '#D7E4F1', color: '#5B7AA3', startAngle: 180 },
  { icon: 'star', bg: '#E4DDF2', color: '#6E5EA2', startAngle: 270 },
];

/**
 * Splash: heart mascot in center + small icon satellites orbiting around.
 * Pure visual, sensory-friendly (slow continuous rotation).
 */
export function SplashView() {
  const pulse = useRef(new Animated.Value(0)).current;
  const orbit = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.timing(orbit, {
        toValue: 1,
        duration: 9000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [pulse, orbit]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.15] });

  return (
    <LinearGradient
      colors={['#DDD3F0', '#F4EBDA', '#FAD9C3']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <View style={[styles.orb, styles.orbTopLeft]} />
      <View style={[styles.orb, styles.orbTopRight]} />
      <View style={[styles.orb, styles.orbBottom]} />

      <View style={styles.heroWrap}>
        {/* Pulsing rings */}
        <Animated.View
          style={[styles.ring, styles.ringOuter, { transform: [{ scale }], opacity }]}
        />
        <Animated.View
          style={[
            styles.ring,
            styles.ringMid,
            { transform: [{ scale }], opacity: Animated.multiply(opacity, 1.4) },
          ]}
        />

        {/* Central heart */}
        <View style={styles.ring}>
          <LinearGradient
            colors={['#B8D8D3', '#8EC3B9']}
            style={styles.heroCircle}
            start={{ x: 0.2, y: 0.1 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="heart" size={CIRCLE * 0.36} color="#FDFBF7" />
          </LinearGradient>
        </View>

        {/* Orbiting satellites */}
        {SATELLITES.map((sat, i) => (
          <Satellite key={i} sat={sat} orbit={orbit} />
        ))}
      </View>
    </LinearGradient>
  );
}

function Satellite({ sat, orbit }: { sat: SatelliteDef; orbit: Animated.Value }) {
  // angle goes from startAngle to startAngle+360
  const rotate = orbit.interpolate({
    inputRange: [0, 1],
    outputRange: [`${sat.startAngle}deg`, `${sat.startAngle + 360}deg`],
  });
  // Counter-rotate the icon so it stays upright
  const counterRotate = orbit.interpolate({
    inputRange: [0, 1],
    outputRange: [`-${sat.startAngle}deg`, `-${sat.startAngle + 360}deg`],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.satelliteOrbit,
        {
          transform: [{ rotate }],
        },
      ]}
    >
      {/* Translate outward to orbit radius, then counter-rotate so icon stays upright */}
      <Animated.View
        style={[
          styles.satelliteOffset,
          { transform: [{ translateY: -SATELLITE_RADIUS }, { rotate: counterRotate }] },
        ]}
      >
        <View style={[styles.satellite, { backgroundColor: '#FFFFFF' }]}>
          <Ionicons name={sat.icon} size={20} color={sat.color} />
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  orb: { position: 'absolute', borderRadius: 999, opacity: 0.55 },
  orbTopLeft: { width: 220, height: 220, top: -60, left: -60, backgroundColor: '#C8BBE6' },
  orbTopRight: { width: 160, height: 160, top: 60, right: -50, backgroundColor: '#FBD3B9' },
  orbBottom: { width: 280, height: 280, bottom: -100, right: -80, backgroundColor: '#F7E8CD' },
  heroWrap: {
    width: CIRCLE * 1.6,
    height: CIRCLE * 1.6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: CIRCLE * 0.72,
    height: CIRCLE * 0.72,
    borderRadius: (CIRCLE * 0.72) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringMid: {
    width: CIRCLE * 0.88,
    height: CIRCLE * 0.88,
    borderRadius: (CIRCLE * 0.88) / 2,
    backgroundColor: '#FFFFFF',
  },
  ringOuter: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    backgroundColor: '#FFFFFF',
  },
  heroCircle: {
    width: CIRCLE * 0.72,
    height: CIRCLE * 0.72,
    borderRadius: (CIRCLE * 0.72) / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#8EC3B9',
    shadowOpacity: 0.35,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  satelliteOrbit: {
    position: 'absolute',
    width: 0,
    height: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  satelliteOffset: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  satellite: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
});
