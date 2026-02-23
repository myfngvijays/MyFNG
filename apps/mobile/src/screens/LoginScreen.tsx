import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import { supabase } from '../lib/supabase';

export default function LoginScreen({ navigation, onLoginSuccess }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    setLoading(true);
    try {
      // Login
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (authError) throw authError;

      if (!authData.user) {
        throw new Error('No user returned');
      }

      // ✅ FIX: Fetch profile with correct role join (like web)
      const { data: profile, error: profileError } = await supabase
        .from('users_login')
        .select(`
          *,
          role:roles!role_id(role_code, role_name)
        `)
        .eq('id', authData.user.id)
        .single();

      if (profileError) throw profileError;

      // Success: AuthContext will react to the new session. If a callback is provided, call it.
      if (typeof onLoginSuccess === 'function') {
        onLoginSuccess(authData.user, profile);
      }
    } catch (error: any) {
      console.error('Login error:', error);
      Alert.alert(
        'Login Failed',
        error.message || 'Invalid email or password'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo Section */}
        <View style={styles.logoSection}>
          <Image 
            source={require('../../assets/images/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {/* Login Form */}
        <View style={styles.formSection}>
          <Text style={styles.formTitle}>Welcome Back! 👋</Text>
          <Text style={styles.formSubtitle}>Sign in to continue</Text>

          {/* Email Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputIcon}>📧</Text>
            <TextInput
              style={styles.input}
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!loading}
            />
          </View>

          {/* Password Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputIcon}>🔒</Text>
            <TextInput
              style={styles.input}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              editable={!loading}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeIcon}
            >
              <Text style={{fontSize: 18}}>{showPassword ? '👁️' : '🙈'}</Text>
            </TouchableOpacity>
          </View>

          {/* Login Button */}
          <TouchableOpacity
            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Text style={styles.loginButtonText}>Sign In</Text>
                <Text style={{fontSize: 18, color: '#FFF'}}>→</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Test Credentials Info */}
          <View style={styles.infoBox}>
            <Text style={{fontSize: 18, color: '#3B82F6'}}>ℹ️</Text>
            <Text style={styles.infoText}>
              Use your registered credentials to login
            </Text>
          </View>

          {/* Customer Signup */}
          <View style={styles.signupRow}>
            <Text style={styles.signupText}>New customer?</Text>
            <TouchableOpacity
              onPress={() => navigation?.navigate?.('CustomerSignup')}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Text style={styles.signupLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.customerOtpButton}
            onPress={() => navigation?.navigate?.('CustomerOtpLogin')}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Text style={styles.customerOtpButtonText}>Login as Customer (Mobile + OTP)</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Powered by MyFNG © 2025
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logo: {
    width: 200,
    height: 80,
  },
  formSection: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 5,
  },
  formSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 25,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 15,
    paddingHorizontal: 15,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 15,
    fontSize: 16,
    color: '#1F2937',
  },
  eyeIcon: {
    padding: 5,
  },
  loginButton: {
    backgroundColor: '#0088E8',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    shadowColor: '#0088E8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    padding: 12,
    borderRadius: 8,
    marginTop: 20,
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#1E40AF',
    lineHeight: 18,
  },
  signupRow: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  signupText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
  },
  signupLink: {
    fontSize: 13,
    color: '#0088E8',
    fontWeight: '800',
  },
  customerOtpButton: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#0088E8',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
  },
  customerOtpButtonText: {
    color: '#005FB8',
    fontSize: 13,
    fontWeight: '700',
  },
  footer: {
    alignItems: 'center',
    marginTop: 30,
  },
  footerText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
});
