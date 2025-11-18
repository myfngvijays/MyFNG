import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  Alert
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../../../constants/theme';

export default function SystemSettingsScreen({ navigation }: any) {
  const [settings, setSettings] = useState({
    maintenanceMode: false,
    autoAssignment: true,
    smsNotifications: true,
    emailNotifications: true,
    pushNotifications: true,
    twoFactorAuth: false,
    apiAccess: true,
    autoBackup: true,
  });

  const [slaRules, setSlaRules] = useState({
    leadAssignment: '15',
    workshopAcceptance: '30',
    pickupArrival: '60',
    serviceCompletion: '240',
  });

  const handleToggle = (key: string) => {
    if (key === 'maintenanceMode') {
      Alert.alert(
        'Maintenance Mode',
        settings.maintenanceMode
          ? 'Disable maintenance mode? System will be accessible to all users.'
          : 'Enable maintenance mode? All users except Super Admins will be logged out.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: settings.maintenanceMode ? 'Disable' : 'Enable',
            style: settings.maintenanceMode ? 'default' : 'destructive',
            onPress: () => {
              setSettings({ ...settings, [key]: !settings[key] });
              Alert.alert('Success', `Maintenance mode ${settings.maintenanceMode ? 'disabled' : 'enabled'}`);
            }
          }
        ]
      );
    } else {
      setSettings({ ...settings, [key]: !settings[key] });
    }
  };

  const handleSaveSLA = () => {
    Alert.alert('Success', 'SLA rules updated successfully');
  };

  const handleClearCache = () => {
    Alert.alert(
      'Clear Cache',
      'Clear system cache? This may temporarily slow down the system.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => Alert.alert('Success', 'Cache cleared successfully')
        }
      ]
    );
  };

  const handleExportLogs = () => {
    Alert.alert('Success', 'System logs export initiated. Download link will be sent to your email.');
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>System Settings</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* System Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🚀 System Status</Text>
          
          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <MaterialCommunityIcons name="wrench" size={24} color={COLORS.red} />
                <View style={{ flex: 1, marginLeft: SPACING.md }}>
                  <Text style={styles.settingLabel}>Maintenance Mode</Text>
                  <Text style={styles.settingDescription}>
                    System accessible only to Super Admins
                  </Text>
                </View>
              </View>
              <Switch
                value={settings.maintenanceMode}
                onValueChange={() => handleToggle('maintenanceMode')}
                trackColor={{ false: COLORS.gray, true: COLORS.red }}
                thumbColor={settings.maintenanceMode ? '#fff' : '#f4f3f4'}
              />
            </View>
          </View>

          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <MaterialCommunityIcons name="auto-fix" size={24} color={COLORS.blue} />
                <View style={{ flex: 1, marginLeft: SPACING.md }}>
                  <Text style={styles.settingLabel}>Auto Lead Assignment</Text>
                  <Text style={styles.settingDescription}>
                    Automatically assign leads to workshops
                  </Text>
                </View>
              </View>
              <Switch
                value={settings.autoAssignment}
                onValueChange={() => handleToggle('autoAssignment')}
                trackColor={{ false: COLORS.gray, true: COLORS.blue }}
              />
            </View>
          </View>
        </View>

        {/* Notifications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔔 Notifications</Text>

          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <MaterialCommunityIcons name="message-text" size={24} color={COLORS.green} />
                <Text style={styles.settingLabel}>SMS Notifications</Text>
              </View>
              <Switch
                value={settings.smsNotifications}
                onValueChange={() => handleToggle('smsNotifications')}
                trackColor={{ false: COLORS.gray, true: COLORS.green }}
              />
            </View>
          </View>

          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <MaterialCommunityIcons name="email" size={24} color={COLORS.blue} />
                <Text style={styles.settingLabel}>Email Notifications</Text>
              </View>
              <Switch
                value={settings.emailNotifications}
                onValueChange={() => handleToggle('emailNotifications')}
                trackColor={{ false: COLORS.gray, true: COLORS.blue }}
              />
            </View>
          </View>

          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <MaterialCommunityIcons name="bell" size={24} color={COLORS.orange} />
                <Text style={styles.settingLabel}>Push Notifications</Text>
              </View>
              <Switch
                value={settings.pushNotifications}
                onValueChange={() => handleToggle('pushNotifications')}
                trackColor={{ false: COLORS.gray, true: COLORS.orange }}
              />
            </View>
          </View>
        </View>

        {/* Security */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔐 Security</Text>

          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <MaterialCommunityIcons name="two-factor-authentication" size={24} color={COLORS.purple} />
                <View style={{ flex: 1, marginLeft: SPACING.md }}>
                  <Text style={styles.settingLabel}>Two-Factor Authentication</Text>
                  <Text style={styles.settingDescription}>
                    Require 2FA for all admin accounts
                  </Text>
                </View>
              </View>
              <Switch
                value={settings.twoFactorAuth}
                onValueChange={() => handleToggle('twoFactorAuth')}
                trackColor={{ false: COLORS.gray, true: COLORS.purple }}
              />
            </View>
          </View>

          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <MaterialCommunityIcons name="api" size={24} color={COLORS.teal} />
                <Text style={styles.settingLabel}>API Access</Text>
              </View>
              <Switch
                value={settings.apiAccess}
                onValueChange={() => handleToggle('apiAccess')}
                trackColor={{ false: COLORS.gray, true: COLORS.teal }}
              />
            </View>
          </View>
        </View>

        {/* SLA Rules */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⏱️ SLA Rules (minutes)</Text>

          <View style={styles.slaCard}>
            <View style={styles.slaRow}>
              <Text style={styles.slaLabel}>Lead Assignment to Manager</Text>
              <TextInput
                style={styles.slaInput}
                value={slaRules.leadAssignment}
                onChangeText={(text) => setSlaRules({ ...slaRules, leadAssignment: text })}
                keyboardType="numeric"
                placeholder="15"
              />
            </View>

            <View style={styles.slaRow}>
              <Text style={styles.slaLabel}>Workshop Acceptance</Text>
              <TextInput
                style={styles.slaInput}
                value={slaRules.workshopAcceptance}
                onChangeText={(text) => setSlaRules({ ...slaRules, workshopAcceptance: text })}
                keyboardType="numeric"
                placeholder="30"
              />
            </View>

            <View style={styles.slaRow}>
              <Text style={styles.slaLabel}>Pickup Boy Arrival</Text>
              <TextInput
                style={styles.slaInput}
                value={slaRules.pickupArrival}
                onChangeText={(text) => setSlaRules({ ...slaRules, pickupArrival: text })}
                keyboardType="numeric"
                placeholder="60"
              />
            </View>

            <View style={styles.slaRow}>
              <Text style={styles.slaLabel}>Service Completion</Text>
              <TextInput
                style={styles.slaInput}
                value={slaRules.serviceCompletion}
                onChangeText={(text) => setSlaRules({ ...slaRules, serviceCompletion: text })}
                keyboardType="numeric"
                placeholder="240"
              />
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveSLA}>
              <Text style={styles.saveBtnText}>Save SLA Rules</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Data & Backup */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💾 Data & Backup</Text>

          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <MaterialCommunityIcons name="backup-restore" size={24} color={COLORS.green} />
                <View style={{ flex: 1, marginLeft: SPACING.md }}>
                  <Text style={styles.settingLabel}>Automatic Backup</Text>
                  <Text style={styles.settingDescription}>
                    Daily backup at 2:00 AM
                  </Text>
                </View>
              </View>
              <Switch
                value={settings.autoBackup}
                onValueChange={() => handleToggle('autoBackup')}
                trackColor={{ false: COLORS.gray, true: COLORS.green }}
              />
            </View>
          </View>
        </View>

        {/* System Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚙️ System Actions</Text>

          <TouchableOpacity style={styles.actionCard} onPress={handleClearCache}>
            <MaterialCommunityIcons name="broom" size={24} color={COLORS.orange} />
            <View style={{ flex: 1, marginLeft: SPACING.md }}>
              <Text style={styles.actionLabel}>Clear System Cache</Text>
              <Text style={styles.actionDescription}>Free up memory and improve performance</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={handleExportLogs}>
            <MaterialCommunityIcons name="file-export" size={24} color={COLORS.blue} />
            <View style={{ flex: 1, marginLeft: SPACING.md }}>
              <Text style={styles.actionLabel}>Export System Logs</Text>
              <Text style={styles.actionDescription}>Download logs for debugging</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard}>
            <MaterialCommunityIcons name="database-sync" size={24} color={COLORS.purple} />
            <View style={{ flex: 1, marginLeft: SPACING.md }}>
              <Text style={styles.actionLabel}>Sync Database</Text>
              <Text style={styles.actionDescription}>Force database synchronization</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: COLORS.red + '15' }]}
            onPress={() => Alert.alert('Danger', 'This action requires additional authorization')}
          >
            <MaterialCommunityIcons name="restart" size={24} color={COLORS.red} />
            <View style={{ flex: 1, marginLeft: SPACING.md }}>
              <Text style={[styles.actionLabel, { color: COLORS.red }]}>Restart System</Text>
              <Text style={styles.actionDescription}>Emergency system restart</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.red} />
          </TouchableOpacity>
        </View>

        {/* Integrations */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔌 Integrations</Text>

          <TouchableOpacity style={styles.integrationCard}>
            <View style={styles.integrationHeader}>
              <MaterialCommunityIcons name="whatsapp" size={28} color="#25D366" />
              <View style={{ flex: 1, marginLeft: SPACING.md }}>
                <Text style={styles.integrationName}>WhatsApp Business</Text>
                <Text style={styles.integrationStatus}>Connected</Text>
              </View>
              <View style={[styles.statusDot, { backgroundColor: COLORS.green }]} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.integrationCard}>
            <View style={styles.integrationHeader}>
              <MaterialCommunityIcons name="google-maps" size={28} color="#4285F4" />
              <View style={{ flex: 1, marginLeft: SPACING.md }}>
                <Text style={styles.integrationName}>Google Maps API</Text>
                <Text style={styles.integrationStatus}>Connected</Text>
              </View>
              <View style={[styles.statusDot, { backgroundColor: COLORS.green }]} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.integrationCard}>
            <View style={styles.integrationHeader}>
              <MaterialCommunityIcons name="credit-card" size={28} color="#635BFF" />
              <View style={{ flex: 1, marginLeft: SPACING.md }}>
                <Text style={styles.integrationName}>Payment Gateway</Text>
                <Text style={styles.integrationStatus}>Connected</Text>
              </View>
              <View style={[styles.statusDot, { backgroundColor: COLORS.green }]} />
            </View>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    paddingTop: SPACING.xl,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    marginLeft: SPACING.md,
  },
  content: {
    flex: 1,
  },
  section: {
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  settingCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    elevation: 1,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  settingDescription: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  slaCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: SPACING.md,
    elevation: 1,
  },
  slaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  slaLabel: {
    fontSize: 14,
    color: COLORS.textPrimary,
    flex: 1,
  },
  slaInput: {
    width: 60,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.gray + '40',
    borderRadius: 8,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
    padding: SPACING.md,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: SPACING.md,
    borderRadius: 12,
    marginBottom: SPACING.sm,
    elevation: 1,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  actionDescription: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  integrationCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    elevation: 1,
  },
  integrationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  integrationName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  integrationStatus: {
    fontSize: 12,
    color: COLORS.green,
    marginTop: 2,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});

