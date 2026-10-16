/**
 * @file WhatsApp-Style QR Code Modal.
 * Enables users to view their unique personal QR code ("My Code")
 * and scan a friend's QR code using camera, file upload, or test simulation ("Scan Code").
 * 
 * Strict compliance with:
 * - RULE 0.1: Strictly ZERO phone numbers. QR codes encode ChatFlow user identity (@username only).
 * - RULE 0.7: Design Tokens as Law (theme/tokens.ts).
 * - Mobile UX Standards: 48x48px touch targets, safe-area insets, zero horizontal overflow.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  Pressable,
  Image,
  ActivityIndicator,
  Animated,
  Platform,
  Alert,
  ScrollView,
  useColorScheme,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'qrcode';
import jsQR from 'jsqr';

import { tokens } from '../../theme/tokens';
import { Text } from '../atoms/Text';
import { Avatar } from '../atoms/Avatar';
import { Button } from '../atoms/Button';
import { TextInputField } from '../atoms/TextInputField';
import { useAuthStore } from '../../store/useAuthStore';
import { useChatStore } from '../../store/useChatStore';
import * as api from '../../services/api';
import { UserProfile } from '@chatflow/shared';

export interface QRCodeModalProps {
  visible: boolean;
  onClose: () => void;
  initialTab?: 'my_code' | 'scan_code';
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({
  visible,
  onClose,
  initialTab = 'my_code',
}) => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? tokens.colors.dark : tokens.colors.light;

  const { user, token } = useAuthStore();
  const { addContact } = useChatStore();

  const [activeTab, setActiveTab] = useState<'my_code' | 'scan_code'>(initialTab);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);
  const [copiedToast, setCopiedToast] = useState(false);

  // Scanner States
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanningFile, setIsScanningFile] = useState(false);
  const [manualUsernameInput, setManualUsernameInput] = useState('');
  const [scannedUser, setScannedUser] = useState<UserProfile | null>(null);
  const [isLookingUpUser, setIsLookingUpUser] = useState(false);
  const [isAddingContact, setIsAddingContact] = useState(false);

  // Animated laser line
  const scanAnim = useRef(new Animated.Value(0)).current;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanLoopRef = useRef<number | null>(null);

  // Sync initial tab when modal opens
  useEffect(() => {
    if (visible) {
      setActiveTab(initialTab);
      setScannedUser(null);
      setManualUsernameInput('');
      setCameraError(null);
    }
  }, [visible, initialTab]);

  // Generate personal QR Code when "my_code" tab is active
  useEffect(() => {
    if (!visible || !user?.username) return;

    let isMounted = true;
    setIsGeneratingQR(true);

    const payload = `chatflow:user:@${user.username}`;

    QRCode.toDataURL(payload, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 280,
      color: {
        dark: '#008069',
        light: '#FFFFFF',
      },
    })
      .then((url) => {
        if (isMounted) {
          setQrDataUrl(url);
          setIsGeneratingQR(false);
        }
      })
      .catch((err) => {
        console.error('Failed to generate QR code', err);
        if (isMounted) {
          setIsGeneratingQR(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [visible, user?.username]);

  // Laser animation loop for scanner
  useEffect(() => {
    if (visible && activeTab === 'scan_code' && !scannedUser) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(scanAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(scanAnim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    } else {
      scanAnim.setValue(0);
    }
  }, [visible, activeTab, scannedUser, scanAnim]);

  // Helper to parse QR payload
  const parseQRPayload = useCallback((payload: string): string | null => {
    if (!payload) return null;
    const clean = payload.trim();

    // 1. Format: chatflow:user:@username or chatflow:user:username
    const prefixMatch = clean.match(/^chatflow:user:@?([a-zA-Z0-9_]{3,20})$/i);
    if (prefixMatch) return prefixMatch[1];

    // 2. Format: URL ending in /@username or /user/@username
    const urlMatch = clean.match(/\/@?([a-zA-Z0-9_]{3,20})\/?$/i);
    if (urlMatch) return urlMatch[1];

    // 3. Format: JSON { "username": "..." }
    try {
      const parsed = JSON.parse(clean);
      if (parsed && typeof parsed.username === 'string') {
        return parsed.username.replace(/^@/, '');
      }
    } catch {
      // not JSON
    }

    // 4. Raw format: @username or username
    const rawMatch = clean.match(/^@?([a-zA-Z0-9_]{3,20})$/);
    if (rawMatch) return rawMatch[1];

    return null;
  }, []);

  // Handle scanned username
  const handleScannedUsername = useCallback(
    async (usernameToLookup: string) => {
      const cleanUsername = usernameToLookup.trim().replace(/^@/, '');
      if (!cleanUsername) return;

      // Check if user is scanning themselves
      if (user?.username && cleanUsername.toLowerCase() === user.username.toLowerCase()) {
        Alert.alert(
          'Your Own QR Code',
          'Yeh aapka apna QR code hai! Share it with friends so they can add you.'
        );
        return;
      }

      setIsLookingUpUser(true);
      try {
        if (!token) return;
        const res = await api.searchUsers(token, cleanUsername);
        if (res.ok && res.data && res.data.length > 0) {
          const match =
            res.data.find(
              (u) => u.username.toLowerCase() === cleanUsername.toLowerCase()
            ) || res.data[0];
          setScannedUser(match);
        } else {
          Alert.alert(
            'User Not Found',
            `ChatFlow par "@${cleanUsername}" naam ka koi user nahi mila.`
          );
        }
      } catch (err) {
        Alert.alert('Error', 'User search karne me dikkat aayi. Please try again.');
      } finally {
        setIsLookingUpUser(false);
      }
    },
    [user?.username, token]
  );

  // Stop camera stream safely
  // Stop camera stream safely
  const stopCameraStream = useCallback(() => {
    if (scanLoopRef.current) {
      cancelAnimationFrame(scanLoopRef.current);
      scanLoopRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.remove();
      videoRef.current = null;
    }
    if (typeof document !== 'undefined') {
      const mount = document.getElementById('chatflow-qr-video-mount');
      if (mount) {
        mount.innerHTML = '';
      }
    }
    setIsCameraActive(false);
  }, []);

  // Camera scanner loop for Web
  const startWebCamera = useCallback(async () => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      setCameraError('Camera is not supported on this platform.');
      return;
    }

    if (!navigator || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      // Insecure HTTP origin on LAN (e.g. mobile Chrome accessing http://IP:PORT)
      setCameraError(
        'Live stream is restricted by mobile browser on HTTP network. Use the "Take Photo to Scan" button below to scan with your phone camera instantly!'
      );
      return;
    }

    setCameraError(null);
    try {
      const isMobile =
        typeof navigator !== 'undefined' &&
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || '');

      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: isMobile
            ? { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
            : { width: { ideal: 1280 }, height: { ideal: 720 } },
        });
      } catch (err1) {
        console.warn('[QRCodeModal] Primary constraints failed, falling back to basic video constraint:', err1);
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }

      if (!stream) {
        throw new Error('No video stream received from camera');
      }

      streamRef.current = stream;
      setIsCameraActive(true);

      const video = document.createElement('video');
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;
      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');
      video.style.width = '100%';
      video.style.height = '100%';
      video.style.objectFit = 'cover';
      video.style.position = 'absolute';
      video.style.top = '0';
      video.style.left = '0';
      video.style.zIndex = '0';
      video.srcObject = stream;
      videoRef.current = video;

      // Mount video directly inside the visual viewfinder container
      const mount = document.getElementById('chatflow-qr-video-mount');
      if (mount) {
        mount.innerHTML = '';
        mount.appendChild(video);
      }

      await video.play();

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      const checkFrame = () => {
        if (!videoRef.current || videoRef.current.readyState < 2) {
          scanLoopRef.current = requestAnimationFrame(checkFrame);
          return;
        }

        const width = video.videoWidth;
        const height = video.videoHeight;
        if (width > 0 && height > 0 && ctx) {
          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(video, 0, 0, width, height);

          const imageData = ctx.getImageData(0, 0, width, height);
          const code = jsQR(imageData.data, width, height, {
            inversionAttempts: 'attemptBoth',
          });

          if (code && code.data) {
            const username = parseQRPayload(code.data);
            if (username) {
              stopCameraStream();
              void handleScannedUsername(username);
              return;
            }
          }
        }

        scanLoopRef.current = requestAnimationFrame(checkFrame);
      };

      scanLoopRef.current = requestAnimationFrame(checkFrame);
    } catch (err: unknown) {
      console.warn('Camera permission denied or unavailable:', err);
      setCameraError(
        'Camera live feed unavailable. Tap "Take Photo to Scan" below to scan with your phone camera instantly!'
      );
      setIsCameraActive(false);
    }
  }, [handleScannedUsername, parseQRPayload, stopCameraStream]);

  // Lifecycle for Web Camera when switching to scan_code tab
  useEffect(() => {
    if (visible && activeTab === 'scan_code' && !scannedUser) {
      void startWebCamera();
    } else {
      stopCameraStream();
    }

    return () => {
      stopCameraStream();
    };
  }, [visible, activeTab, scannedUser, startWebCamera, stopCameraStream]);

  // Handle image upload from files / gallery or native camera snapshot
  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsScanningFile(true);
      const reader = new FileReader();
      reader.onload = () => {
        const img = new (window as unknown as { Image: new () => HTMLImageElement }).Image();
        img.onload = () => {
          // Normalize dimension to max 1200px for speedy processing
          const maxDim = 1200;
          let width = img.width;
          let height = img.height;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          canvas.width = width;
          canvas.height = height;
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const imageData = ctx.getImageData(0, 0, width, height);
            let code = jsQR(imageData.data, width, height, {
              inversionAttempts: 'attemptBoth',
            });

            // Fallback: try original size if scaled didn't detect
            if (!code && (img.width !== width || img.height !== height)) {
              canvas.width = img.width;
              canvas.height = img.height;
              ctx.drawImage(img, 0, 0, img.width, img.height);
              const fullData = ctx.getImageData(0, 0, img.width, img.height);
              code = jsQR(fullData.data, img.width, img.height, {
                inversionAttempts: 'attemptBoth',
              });
            }

            setIsScanningFile(false);

            if (code && code.data) {
              const username = parseQRPayload(code.data);
              if (username) {
                stopCameraStream();
                void handleScannedUsername(username);
              } else {
                Alert.alert(
                  'Invalid QR Code',
                  `Scanned: "${code.data.substring(0, 60)}". This QR code is not a valid ChatFlow friend code.`
                );
              }
            } else {
              Alert.alert(
                'No QR Code Found',
                'Could not detect a QR code in the captured photo. Please try again with clear lighting and steady focus.'
              );
            }
          } else {
            setIsScanningFile(false);
          }
        };
        img.onerror = () => {
          setIsScanningFile(false);
          Alert.alert('Error', 'Unable to load the selected image.');
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    },
    [handleScannedUsername, parseQRPayload, stopCameraStream]
  );

  // Copy link / payload to clipboard
  const handleCopyLink = useCallback(async () => {
    if (!user?.username) return;
    const shareUrl = `chatflow:user:@${user.username}`;

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
      }
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2500);
    } catch {
      Alert.alert('QR Link', shareUrl);
    }
  }, [user?.username]);

  // Start chat with scanned user
  const handleConfirmAddAndChat = async () => {
    if (!token || !scannedUser) return;
    setIsAddingContact(true);

    const result = await addContact(token, scannedUser.username);
    setIsAddingContact(false);

    if (result.success) {
      onClose();
      router.push({
        pathname: '/chat/[id]',
        params: {
          id: scannedUser.id,
          name: scannedUser.displayName,
          username: scannedUser.username,
        },
      });
    } else {
      Alert.alert('Notice', result.message || 'Could not add friend');
    }
  };

  const translateY = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 240],
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        {/* Header Bar */}
        <View
          style={[
            styles.headerBar,
            {
              backgroundColor: theme.primary,
              paddingTop: Math.max(insets.top, tokens.spacing.sm),
            },
          ]}
        >
          <Pressable
            onPress={onClose}
            style={styles.headerIconButton}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="arrow-back" size={24} color={theme.textInverse} />
          </Pressable>

          <Text variant="h2" colorRole="inverse" style={styles.headerTitle}>
            QR Code
          </Text>

          <Pressable
            onPress={handleCopyLink}
            style={styles.headerIconButton}
            accessibilityRole="button"
            accessibilityLabel="Share QR Code link"
          >
            <Ionicons name="share-social-outline" size={22} color={theme.textInverse} />
          </Pressable>
        </View>

        {/* WhatsApp-Style Segmented Tabs */}
        <View
          style={[
            styles.tabBar,
            {
              backgroundColor: theme.primary,
              borderBottomColor: theme.divider,
            },
          ]}
        >
          <Pressable
            onPress={() => {
              setScannedUser(null);
              setActiveTab('my_code');
            }}
            style={[
              styles.tabItem,
              activeTab === 'my_code' && styles.tabItemActive,
            ]}
          >
            <Ionicons
              name="qr-code-outline"
              size={18}
              color={activeTab === 'my_code' ? theme.textInverse : 'rgba(255,255,255,0.7)'}
              style={{ marginRight: 6 }}
            />
            <Text
              variant="button"
              colorRole="inverse"
              style={{
                opacity: activeTab === 'my_code' ? 1 : 0.7,
                fontWeight: activeTab === 'my_code' ? '700' : '500',
              }}
            >
              My Code
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              setScannedUser(null);
              setActiveTab('scan_code');
            }}
            style={[
              styles.tabItem,
              activeTab === 'scan_code' && styles.tabItemActive,
            ]}
          >
            <Ionicons
              name="scan-outline"
              size={18}
              color={activeTab === 'scan_code' ? theme.textInverse : 'rgba(255,255,255,0.7)'}
              style={{ marginRight: 6 }}
            />
            <Text
              variant="button"
              colorRole="inverse"
              style={{
                opacity: activeTab === 'scan_code' ? 1 : 0.7,
                fontWeight: activeTab === 'scan_code' ? '700' : '500',
              }}
            >
              Scan Code
            </Text>
          </Pressable>
        </View>

        {/* TAB 1: MY CODE */}
        {activeTab === 'my_code' ? (
          <ScrollView
            contentContainerStyle={[
              styles.scrollContainer,
              { paddingBottom: insets.bottom + tokens.spacing.xl },
            ]}
            showsVerticalScrollIndicator={false}
          >
            <View
              style={[
                styles.qrCard,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.divider,
                  ...tokens.elevation[3],
                },
              ]}
            >
              {/* Profile Card Header */}
              <View style={styles.cardProfileRow}>
                <Avatar
                  name={user?.displayName || 'User'}
                  uri={user?.avatarUrl}
                  size="lg"
                  presence="online"
                />
                <View style={styles.cardProfileInfo}>
                  <Text variant="h2" numberOfLines={1}>
                    {user?.displayName || 'ChatFlow User'}
                  </Text>
                  <Text
                    variant="bodyMedium"
                    colorRole="primary"
                    style={styles.cardUsername}
                  >
                    @{user?.username || 'username'}
                  </Text>
                  <Text variant="caption" colorRole="secondary">
                    ChatFlow Contact
                  </Text>
                </View>
              </View>

              {/* QR Code Canvas / Image */}
              <View style={styles.qrWrapper}>
                {isGeneratingQR || !qrDataUrl ? (
                  <View style={styles.qrLoadingBox}>
                    <ActivityIndicator size="large" color={theme.primary} />
                    <Text variant="caption" colorRole="secondary" style={{ marginTop: 8 }}>
                      Generating secure QR code...
                    </Text>
                  </View>
                ) : (
                  <View style={styles.qrImageContainer}>
                    <Image
                      source={{ uri: qrDataUrl }}
                      style={styles.qrImage}
                      resizeMode="contain"
                    />
                    {/* Centered WhatsApp-style brand badge */}
                    <View
                      style={[
                        styles.centerBadge,
                        {
                          backgroundColor: theme.background,
                          borderColor: theme.primary,
                        },
                      ]}
                    >
                      <Ionicons
                        name="chatbubble-ellipses"
                        size={20}
                        color={theme.primary}
                      />
                    </View>
                  </View>
                )}
              </View>

              <Text
                variant="caption"
                colorRole="secondary"
                style={styles.qrExplanation}
              >
                Your QR code is private. If you share it with someone, they can scan it with their ChatFlow camera to add you as a friend.
              </Text>
            </View>

            {/* Quick Actions */}
            <View style={styles.actionButtonsCol}>
              <Button
                label="Copy Invite Link"
                variant="primary"
                onPress={() => void handleCopyLink()}
                style={styles.actionBtn}
              />

              {copiedToast && (
                <View
                  style={[
                    styles.toastPill,
                    { backgroundColor: theme.primaryVariant },
                  ]}
                >
                  <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
                  <Text
                    variant="caption"
                    colorRole="inverse"
                    style={{ marginLeft: 6, fontWeight: '600' }}
                  >
                    Link copied to clipboard!
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>
        ) : (
          /* TAB 2: SCAN CODE */
          <View style={styles.scannerContainer}>
            {/* Scanned Contact Result Card */}
            {scannedUser ? (
              <View
                style={[
                  styles.resultCard,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.divider,
                    ...tokens.elevation[3],
                  },
                ]}
              >
                <View style={styles.resultBadge}>
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={theme.success}
                  />
                  <Text
                    variant="caption"
                    style={{ color: theme.success, fontWeight: '700', marginLeft: 6 }}
                  >
                    Friend Found!
                  </Text>
                </View>

                <Avatar
                  name={scannedUser.displayName}
                  uri={scannedUser.avatarUrl}
                  size="xl"
                  presence={scannedUser.presenceStatus}
                />

                <Text variant="h1" style={{ marginTop: 12 }}>
                  {scannedUser.displayName}
                </Text>
                <Text
                  variant="bodyMedium"
                  colorRole="primary"
                  style={{ fontWeight: '700', marginTop: 2 }}
                >
                  @{scannedUser.username}
                </Text>

                {scannedUser.bio && (
                  <Text
                    variant="body"
                    colorRole="secondary"
                    style={{ textAlign: 'center', marginTop: 8, paddingHorizontal: 16 }}
                  >
                    "{scannedUser.bio}"
                  </Text>
                )}

                <View style={styles.resultActionsRow}>
                  <Button
                    label="Scan Again"
                    variant="secondary"
                    onPress={() => {
                      setScannedUser(null);
                      void startWebCamera();
                    }}
                    style={{ flex: 1, marginRight: 8 }}
                  />
                  <Button
                    label="Message & Add"
                    variant="primary"
                    isLoading={isAddingContact}
                    onPress={() => void handleConfirmAddAndChat()}
                    style={{ flex: 1.5 }}
                  />
                </View>
              </View>
            ) : (
              /* Viewfinder */
              <View style={styles.viewfinderRoot}>
                {/* Viewfinder Box */}
                <View style={styles.viewfinderBox}>
                  {/* Web Live Video Mount */}
                  {Platform.OS === 'web' && (
                    <div
                      id="chatflow-qr-video-mount"
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        overflow: 'hidden',
                        borderRadius: tokens.radii.md,
                        zIndex: 0,
                        backgroundColor: '#000000',
                      }}
                    />
                  )}

                  {/* Corner Brackets */}
                  <View style={[styles.corner, styles.cornerTL, { borderColor: theme.secondary, zIndex: 2 }]} />
                  <View style={[styles.corner, styles.cornerTR, { borderColor: theme.secondary, zIndex: 2 }]} />
                  <View style={[styles.corner, styles.cornerBL, { borderColor: theme.secondary, zIndex: 2 }]} />
                  <View style={[styles.corner, styles.cornerBR, { borderColor: theme.secondary, zIndex: 2 }]} />

                  {/* Animated Sweeping Laser */}
                  <Animated.View
                    style={[
                      styles.laserLine,
                      {
                        backgroundColor: theme.secondary,
                        transform: [{ translateY }],
                        zIndex: 2,
                      },
                    ]}
                  />

                  {/* Loading or status overlay */}
                  {isLookingUpUser && (
                    <View style={[styles.viewfinderOverlayCenter, { zIndex: 3 }]}>
                      <ActivityIndicator size="large" color={theme.secondary} />
                      <Text
                        variant="caption"
                        colorRole="inverse"
                        style={{ marginTop: 8, fontWeight: '600' }}
                      >
                        Looking up friend...
                      </Text>
                    </View>
                  )}
                </View>

                <Text
                  variant="bodyMedium"
                  colorRole="inverse"
                  style={styles.instructionText}
                >
                  Align the ChatFlow QR code within the frame to scan
                </Text>

                {cameraError && (
                  <Text
                    variant="caption"
                    style={styles.cameraErrorText}
                  >
                    {cameraError}
                  </Text>
                )}

                {/* Scanner Helpers: Direct Phone Camera & Gallery Upload */}
                <View style={styles.bottomControlRow}>
                  {Platform.OS === 'web' && (
                    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
                      {/* 1. Take Photo with Native Phone Camera */}
                      <label
                        style={{
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: theme.primary,
                          paddingTop: 12,
                          paddingBottom: 12,
                          paddingLeft: 20,
                          paddingRight: 20,
                          borderRadius: tokens.radii.pill,
                          minHeight: 48,
                          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                        }}
                      >
                        <Ionicons
                          name="camera"
                          size={20}
                          color="#FFFFFF"
                          style={{ marginRight: 8 }}
                        />
                        <Text variant="button" style={{ color: '#FFFFFF', fontWeight: '700' }}>
                          {isScanningFile ? 'Scanning Photo...' : 'Take Photo to Scan'}
                        </Text>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={handleFileUpload}
                          style={{ display: 'none' }}
                        />
                      </label>

                      {/* 2. Choose Image from Gallery */}
                      <label
                        style={{
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: theme.surface,
                          paddingTop: 12,
                          paddingBottom: 12,
                          paddingLeft: 18,
                          paddingRight: 18,
                          borderRadius: tokens.radii.pill,
                          borderWidth: 1,
                          borderColor: theme.divider,
                          minHeight: 48,
                        }}
                      >
                        <Ionicons
                          name="image-outline"
                          size={19}
                          color={theme.primary}
                          style={{ marginRight: 6 }}
                        />
                        <Text variant="button" colorRole="primary">
                          Gallery
                        </Text>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileUpload}
                          style={{ display: 'none' }}
                        />
                      </label>
                    </View>
                  )}
                </View>

                {/* Quick Simulation / Test Box for testing */}
                <View
                  style={[
                    styles.manualSimBox,
                    {
                      backgroundColor: theme.surface,
                      borderColor: theme.divider,
                    },
                  ]}
                >
                  <Text variant="caption" colorRole="secondary" style={{ marginBottom: 6 }}>
                    Direct Test (e.g. paste @username or friend code):
                  </Text>
                  <View style={styles.manualInputRow}>
                    <TextInputField
                      placeholder="e.g. @king90 or alexrivers"
                      value={manualUsernameInput}
                      onChangeText={setManualUsernameInput}
                      style={{ flex: 1 }}
                    />
                    <Button
                      label="Scan"
                      variant="primary"
                      onPress={() => void handleScannedUsername(manualUsernameInput)}
                      isLoading={isLookingUpUser}
                      isDisabled={!manualUsernameInput.trim()}
                      style={{ marginLeft: 8 }}
                    />
                  </View>
                </View>
              </View>
            )}
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.md,
    paddingBottom: tokens.spacing.sm,
  },
  headerIconButton: {
    minWidth: tokens.spacing.huge,
    minHeight: tokens.spacing.huge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontWeight: '700',
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: tokens.spacing.md,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: tokens.spacing.sm,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    minHeight: tokens.spacing.huge,
  },
  tabItemActive: {
    borderBottomColor: '#FFFFFF',
  },
  scrollContainer: {
    alignItems: 'center',
    padding: tokens.spacing.lg,
  },
  qrCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: tokens.radii.xl,
    borderWidth: 1,
    padding: tokens.spacing.xl,
    alignItems: 'center',
  },
  cardProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: tokens.spacing.lg,
  },
  cardProfileInfo: {
    marginLeft: tokens.spacing.md,
    flex: 1,
  },
  cardUsername: {
    fontWeight: '700',
    marginTop: 2,
  },
  qrWrapper: {
    width: 280,
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing.xs,
    overflow: 'hidden',
  },
  qrLoadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrImageContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrImage: {
    width: 260,
    height: 260,
  },
  centerBadge: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrExplanation: {
    textAlign: 'center',
    marginTop: tokens.spacing.lg,
    paddingHorizontal: tokens.spacing.xs,
    lineHeight: 18,
  },
  actionButtonsCol: {
    width: '100%',
    maxWidth: 360,
    marginTop: tokens.spacing.lg,
    alignItems: 'center',
  },
  actionBtn: {
    width: '100%',
  },
  toastPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.md,
    borderRadius: tokens.radii.pill,
    marginTop: tokens.spacing.sm,
  },
  scannerContainer: {
    flex: 1,
    backgroundColor: '#0B141A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: tokens.spacing.lg,
  },
  viewfinderRoot: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  viewfinderBox: {
    width: 260,
    height: 260,
    position: 'relative',
    borderRadius: tokens.radii.md,
    overflow: 'hidden',
  },
  corner: {
    position: 'absolute',
    width: 32,
    height: 32,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: tokens.radii.md,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: tokens.radii.md,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: tokens.radii.md,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: tokens.radii.md,
  },
  laserLine: {
    position: 'absolute',
    left: 10,
    right: 10,
    height: 3,
    borderRadius: 2,
  },
  viewfinderOverlayCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  instructionText: {
    textAlign: 'center',
    marginTop: tokens.spacing.lg,
    paddingHorizontal: tokens.spacing.md,
  },
  cameraErrorText: {
    color: '#EF5350',
    textAlign: 'center',
    marginTop: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.md,
  },
  bottomControlRow: {
    marginTop: tokens.spacing.lg,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  manualSimBox: {
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing.md,
    marginTop: tokens.spacing.lg,
  },
  manualInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resultCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: tokens.radii.xl,
    borderWidth: 1,
    padding: tokens.spacing.xl,
    alignItems: 'center',
  },
  resultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: tokens.spacing.md,
  },
  resultActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: tokens.spacing.xl,
    width: '100%',
  },
});
