import React, { useState, useEffect, useCallback } from "react";
import { StyleSheet, View, TextInput, Pressable, ActivityIndicator, Alert, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { ScreenKeyboardAwareScrollView } from "@/components/ScreenKeyboardAwareScrollView";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAdminAuth, StylistRecord } from "@/contexts/AdminAuthContext";

type AdminStylistScreenProps = {
  navigation: NativeStackNavigationProp<any>;
  onExit?: () => void;
  onLogout?: () => void;
};

export default function AdminStylistScreen({ navigation, onExit, onLogout }: AdminStylistScreenProps) {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { admin, getStylists, registerStylist, approveStylist, revokeStylist } = useAdminAuth();

  const [stylists, setStylists] = useState<StylistRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [selectedStylist, setSelectedStylist] = useState<StylistRecord | null>(null);

  const [newStylist, setNewStylist] = useState({
    email: '',
    displayName: '',
    bio: '',
    yearsExperience: '',
  });
  const [approvePassword, setApprovePassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadStylists = useCallback(async () => {
    try {
      const data = await getStylists();
      setStylists(data);
    } catch (error) {
      console.error('Failed to load stylists:', error);
    } finally {
      setIsLoading(false);
    }
  }, [getStylists]);

  useEffect(() => {
    loadStylists();
  }, [loadStylists]);

  const handleAddStylist = async () => {
    if (!newStylist.email || !newStylist.displayName) {
      Alert.alert('Error', 'Email and name are required');
      return;
    }

    setIsSubmitting(true);
    try {
      await registerStylist({
        email: newStylist.email,
        displayName: newStylist.displayName,
        bio: newStylist.bio,
        yearsExperience: parseInt(newStylist.yearsExperience) || 0,
      });
      Alert.alert('Success', 'Stylist registered successfully. You can now approve them to grant login access.');
      setShowAddModal(false);
      setNewStylist({ email: '', displayName: '', bio: '', yearsExperience: '' });
      loadStylists();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to register stylist');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApproveStylist = async () => {
    if (!selectedStylist || !approvePassword) {
      Alert.alert('Error', 'Please enter a password for the stylist');
      return;
    }

    setIsSubmitting(true);
    try {
      await approveStylist(selectedStylist.id, approvePassword);
      Alert.alert('Success', `${selectedStylist.displayName} has been approved and can now log in with the password you set.`);
      setShowApproveModal(false);
      setSelectedStylist(null);
      setApprovePassword('');
      loadStylists();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to approve stylist');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevokeStylist = (stylist: StylistRecord) => {
    Alert.alert(
      'Revoke Access',
      `Are you sure you want to revoke access for ${stylist.displayName}? They will no longer be able to log in.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            try {
              await revokeStylist(stylist.id);
              Alert.alert('Success', 'Stylist access revoked');
              loadStylists();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to revoke access');
            }
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: onLogout },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return '#10B981';
      case 'pending': return '#F59E0B';
      case 'suspended': return '#EF4444';
      default: return theme.tabIconDefault;
    }
  };

  const inputStyle = [
    styles.input,
    {
      backgroundColor: theme.backgroundDefault,
      color: theme.text,
      borderColor: theme.border,
    },
  ];

  const renderStylistCard = (stylist: StylistRecord) => (
    <Card key={stylist.id} style={styles.stylistCard}>
      <View style={styles.stylistHeader}>
        <View style={[styles.avatar, { backgroundColor: theme.link + '20' }]}>
          <ThemedText type="body" style={{ color: theme.link, fontWeight: '600' }}>
            {stylist.displayName.charAt(0).toUpperCase()}
          </ThemedText>
        </View>
        <View style={styles.stylistInfo}>
          <ThemedText type="body" style={{ fontWeight: '600' }}>
            {stylist.displayName}
          </ThemedText>
          <ThemedText type="small" style={{ opacity: 0.7 }}>
            {stylist.email}
          </ThemedText>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(stylist.status) + '20' }]}>
          <ThemedText type="small" style={{ color: getStatusColor(stylist.status), fontWeight: '600', textTransform: 'capitalize' }}>
            {stylist.status}
          </ThemedText>
        </View>
      </View>

      {stylist.bio ? (
        <ThemedText type="small" style={styles.bio} numberOfLines={2}>
          {stylist.bio}
        </ThemedText>
      ) : null}

      <View style={styles.stylistMeta}>
        <View style={styles.metaItem}>
          <Feather name="award" size={14} color={theme.tabIconDefault} />
          <ThemedText type="small" style={{ opacity: 0.7 }}>
            {stylist.yearsExperience} years exp.
          </ThemedText>
        </View>
        <View style={styles.metaItem}>
          <Feather name="calendar" size={14} color={theme.tabIconDefault} />
          <ThemedText type="small" style={{ opacity: 0.7 }}>
            Added {new Date(stylist.createdAt).toLocaleDateString()}
          </ThemedText>
        </View>
      </View>

      <View style={styles.actionRow}>
        {stylist.status === 'pending' ? (
          <Pressable
            onPress={() => {
              setSelectedStylist(stylist);
              setShowApproveModal(true);
            }}
            style={[styles.actionButton, { backgroundColor: '#10B981' }]}
          >
            <Feather name="check" size={16} color="#FFFFFF" />
            <ThemedText type="small" style={{ color: '#FFFFFF', marginLeft: 4 }}>
              Approve
            </ThemedText>
          </Pressable>
        ) : null}
        {stylist.status === 'approved' ? (
          <Pressable
            onPress={() => handleRevokeStylist(stylist)}
            style={[styles.actionButton, { backgroundColor: '#EF4444' }]}
          >
            <Feather name="x" size={16} color="#FFFFFF" />
            <ThemedText type="small" style={{ color: '#FFFFFF', marginLeft: 4 }}>
              Revoke
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
    </Card>
  );

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <Pressable
              onPress={onExit}
              style={({ pressed }) => [
                styles.closeButton,
                { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Feather name="x" size={20} color={theme.text} />
            </Pressable>
            <View>
              <ThemedText type="h2">Stylist Management</ThemedText>
              <ThemedText type="small" style={{ opacity: 0.7 }}>
                Logged in as {admin?.displayName || 'Admin'}
              </ThemedText>
            </View>
          </View>
          <Pressable
            onPress={handleLogout}
            style={({ pressed }) => [
              styles.logoutButton,
              { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Feather name="log-out" size={20} color={theme.text} />
          </Pressable>
        </View>
      </View>

      <ScreenKeyboardAwareScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xl }]}
      >
        <Pressable
          onPress={() => setShowAddModal(true)}
          style={[styles.addButton, { backgroundColor: theme.link }]}
        >
          <Feather name="plus" size={20} color="#FFFFFF" />
          <ThemedText type="body" style={{ color: '#FFFFFF', marginLeft: Spacing.sm }}>
            Register New Stylist
          </ThemedText>
        </Pressable>

        <ThemedText type="h3" style={styles.sectionTitle}>
          Registered Stylists ({stylists.length})
        </ThemedText>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.link} />
          </View>
        ) : stylists.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Feather name="users" size={48} color={theme.tabIconDefault} />
            <ThemedText type="body" style={{ marginTop: Spacing.md, opacity: 0.7 }}>
              No stylists registered yet
            </ThemedText>
          </View>
        ) : (
          <View style={styles.stylistsList}>
            {stylists.map(renderStylistCard)}
          </View>
        )}
      </ScreenKeyboardAwareScrollView>

      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddModal(false)}
      >
        <ThemedView style={styles.modalContainer}>
          <View style={[styles.modalHeader, { paddingTop: Spacing.lg }]}>
            <ThemedText type="h3">Register New Stylist</ThemedText>
            <Pressable onPress={() => setShowAddModal(false)}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          </View>

          <ScreenKeyboardAwareScrollView contentContainerStyle={styles.modalContent}>
            <View style={styles.fieldContainer}>
              <ThemedText type="small" style={styles.label}>Email *</ThemedText>
              <TextInput
                style={inputStyle}
                value={newStylist.email}
                onChangeText={(text) => setNewStylist({ ...newStylist, email: text })}
                placeholder="stylist@email.com"
                placeholderTextColor={isDark ? "#9BA1A6" : "#687076"}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.fieldContainer}>
              <ThemedText type="small" style={styles.label}>Full Name *</ThemedText>
              <TextInput
                style={inputStyle}
                value={newStylist.displayName}
                onChangeText={(text) => setNewStylist({ ...newStylist, displayName: text })}
                placeholder="Jane Smith"
                placeholderTextColor={isDark ? "#9BA1A6" : "#687076"}
              />
            </View>

            <View style={styles.fieldContainer}>
              <ThemedText type="small" style={styles.label}>Bio</ThemedText>
              <TextInput
                style={[inputStyle, { height: 100, textAlignVertical: 'top', paddingTop: Spacing.sm }]}
                value={newStylist.bio}
                onChangeText={(text) => setNewStylist({ ...newStylist, bio: text })}
                placeholder="Brief description of expertise..."
                placeholderTextColor={isDark ? "#9BA1A6" : "#687076"}
                multiline
              />
            </View>

            <View style={styles.fieldContainer}>
              <ThemedText type="small" style={styles.label}>Years of Experience</ThemedText>
              <TextInput
                style={inputStyle}
                value={newStylist.yearsExperience}
                onChangeText={(text) => setNewStylist({ ...newStylist, yearsExperience: text })}
                placeholder="5"
                placeholderTextColor={isDark ? "#9BA1A6" : "#687076"}
                keyboardType="number-pad"
              />
            </View>

            <Button
              onPress={handleAddStylist}
              disabled={isSubmitting}
              style={[styles.submitButton, { backgroundColor: theme.link }]}
            >
              {isSubmitting ? "Registering..." : "Register Stylist"}
            </Button>
          </ScreenKeyboardAwareScrollView>
        </ThemedView>
      </Modal>

      <Modal
        visible={showApproveModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowApproveModal(false);
          setSelectedStylist(null);
          setApprovePassword('');
        }}
      >
        <ThemedView style={styles.modalContainer}>
          <View style={[styles.modalHeader, { paddingTop: Spacing.lg }]}>
            <ThemedText type="h3">Approve Stylist</ThemedText>
            <Pressable onPress={() => {
              setShowApproveModal(false);
              setSelectedStylist(null);
              setApprovePassword('');
            }}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          </View>

          <ScreenKeyboardAwareScrollView contentContainerStyle={styles.modalContent}>
            {selectedStylist ? (
              <>
                <Card style={styles.approveCard}>
                  <View style={styles.approveInfo}>
                    <View style={[styles.avatar, { backgroundColor: theme.link + '20' }]}>
                      <ThemedText type="h3" style={{ color: theme.link }}>
                        {selectedStylist.displayName.charAt(0).toUpperCase()}
                      </ThemedText>
                    </View>
                    <View>
                      <ThemedText type="body" style={{ fontWeight: '600' }}>
                        {selectedStylist.displayName}
                      </ThemedText>
                      <ThemedText type="small" style={{ opacity: 0.7 }}>
                        {selectedStylist.email}
                      </ThemedText>
                    </View>
                  </View>
                </Card>

                <View style={styles.fieldContainer}>
                  <ThemedText type="small" style={styles.label}>
                    Set Login Password *
                  </ThemedText>
                  <ThemedText type="small" style={{ opacity: 0.7, marginBottom: Spacing.sm }}>
                    Create a password that the stylist will use to log in to the Stylist Portal.
                  </ThemedText>
                  <TextInput
                    style={inputStyle}
                    value={approvePassword}
                    onChangeText={setApprovePassword}
                    placeholder="Enter password"
                    placeholderTextColor={isDark ? "#9BA1A6" : "#687076"}
                    secureTextEntry
                  />
                </View>

                <Button
                  onPress={handleApproveStylist}
                  disabled={isSubmitting || !approvePassword}
                  style={[styles.submitButton, { backgroundColor: '#10B981' }]}
                >
                  {isSubmitting ? "Approving..." : "Approve & Set Password"}
                </Button>
              </>
            ) : null}
          </ScreenKeyboardAwareScrollView>
        </ThemedView>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  loadingContainer: {
    paddingVertical: Spacing["2xl"],
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: Spacing["2xl"] * 2,
    alignItems: 'center',
  },
  stylistsList: {
    gap: Spacing.md,
  },
  stylistCard: {
    padding: Spacing.md,
  },
  stylistHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stylistInfo: {
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  bio: {
    opacity: 0.8,
    marginBottom: Spacing.sm,
  },
  stylistMeta: {
    flexDirection: 'row',
    gap: Spacing.lg,
    marginBottom: Spacing.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
  },
  modalContent: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  fieldContainer: {
    gap: Spacing.xs,
  },
  label: {
    fontWeight: '600',
  },
  input: {
    height: 50,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    fontSize: Typography.body.fontSize,
    borderWidth: 1,
  },
  submitButton: {
    marginTop: Spacing.md,
  },
  approveCard: {
    padding: Spacing.md,
  },
  approveInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
});
