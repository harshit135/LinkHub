import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Share,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { shortenURL } from '../../src/api/urls';
import { BASE_URL } from '../../src/api/client';

export default function Create() {
  const [url, setUrl] = useState('');
  const [shortCode, setShortCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [result, setResult] = useState(null);

  function validate() {
    const errs = {};
    const trimmed = url.trim();
    if (!trimmed) {
      errs.url = 'URL is required';
    } else if (!/^https?:\/\/.+\..+/.test(trimmed)) {
      errs.url = 'Enter a valid URL starting with http:// or https://';
    }
    if (shortCode.trim() && shortCode.trim().length % 2 !== 0) {
      errs.shortCode = 'Custom code must be even length (2, 4, 6…)';
    }
    return errs;
  }

  async function handleShorten() {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setApiError('');
    setLoading(true);
    try {
      const data = await shortenURL(url.trim(), shortCode.trim() || undefined);
      setResult(data);
      setUrl('');
      setShortCode('');
    } catch (err) {
      setApiError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleCreateAnother() {
    setResult(null);
    setApiError('');
  }

  async function handleShare(shortUrl) {
    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ url: shortUrl, title: 'LinkHub short URL' });
      } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(shortUrl);
        Alert.alert('Copied!', 'Short URL copied to clipboard.');
      }
      return;
    }
    try {
      await Share.share({ message: shortUrl, url: shortUrl });
    } catch { /* user cancelled */ }
  }

  if (result) {
    const shortUrl = `${BASE_URL}/${result.short_code}`;
    return (
      <View style={styles.root}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <View style={styles.logo}><Text style={styles.logoChar}>L</Text></View>
          <Text style={styles.headerTitle}>Create Link</Text>
        </View>
        <View style={styles.successWrap}>
          <View style={styles.successIconWrap}>
            <Ionicons name="checkmark-circle" size={56} color="#10B981" />
          </View>
          <Text style={styles.successTitle}>Link Created!</Text>
          <Text style={styles.successSub}>Your short link is ready to share</Text>

          <View style={styles.resultCard}>
            <Text style={styles.resultLabel}>Short URL</Text>
            <Text style={styles.resultUrl} selectable>{shortUrl}</Text>
            <View style={styles.resultDivider} />
            <Text style={styles.resultLabel}>Original URL</Text>
            <Text style={styles.resultOriginal} numberOfLines={2} selectable>
              {result.original_url}
            </Text>
          </View>

          <View style={styles.resultStats}>
            <View style={styles.resultStatItem}>
              <Text style={styles.resultStatValue}>{result.click_count}</Text>
              <Text style={styles.resultStatLabel}>Clicks</Text>
            </View>
            <View style={styles.resultStatDivider} />
            <View style={styles.resultStatItem}>
              <View style={[styles.activeDot, { backgroundColor: result.is_active ? '#10B981' : '#9CA3AF' }]} />
              <Text style={styles.resultStatLabel}>{result.is_active ? 'Active' : 'Inactive'}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.shareBtn}
            onPress={() => handleShare(shortUrl)}
            activeOpacity={0.85}
          >
            <Ionicons name="share-outline" size={18} color="#fff" />
            <Text style={styles.shareBtnText}>Share Link</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.anotherBtn}
            onPress={handleCreateAnother}
            activeOpacity={0.8}
          >
            <Text style={styles.anotherBtnText}>Create Another</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="dark" />
      <View style={styles.header}>
        <View style={styles.logo}><Text style={styles.logoChar}>L</Text></View>
        <Text style={styles.headerTitle}>Create Link</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>Shorten a URL</Text>
        <Text style={styles.pageSub}>Paste a long URL and get a short link instantly</Text>

        {apiError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{apiError}</Text>
          </View>
        ) : null}

        <View style={styles.form}>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Destination URL</Text>
            <TextInput
              style={[styles.input, errors.url && styles.inputError]}
              placeholder="https://example.com/very-long-url"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              value={url}
              onChangeText={(t) => {
                setUrl(t);
                if (errors.url) setErrors((e) => ({ ...e, url: null }));
                setApiError('');
              }}
            />
            {errors.url ? <Text style={styles.errorMsg}>{errors.url}</Text> : null}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>
              Custom Short Code{' '}
              <Text style={styles.optional}>(optional)</Text>
            </Text>
            <TextInput
              style={[styles.input, errors.shortCode && styles.inputError]}
              placeholder="e.g. mycool (must be even length)"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              autoCorrect={false}
              value={shortCode}
              onChangeText={(t) => {
                setShortCode(t);
                if (errors.shortCode) setErrors((e) => ({ ...e, shortCode: null }));
              }}
            />
            {errors.shortCode ? (
              <Text style={styles.errorMsg}>{errors.shortCode}</Text>
            ) : (
              <Text style={styles.hint}>Leave blank to auto-generate · Must be even length if custom</Text>
            )}
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
            onPress={handleShorten}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="link-outline" size={18} color="#fff" />
                <Text style={styles.primaryBtnText}>Shorten URL</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F3F4F6' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoChar: { color: '#fff', fontSize: 18, fontWeight: '800' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },

  scroll: { padding: 24 },

  pageTitle: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 6 },
  pageSub: { fontSize: 14, color: '#6B7280', marginBottom: 28, lineHeight: 20 },

  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: { fontSize: 13, color: '#B91C1C' },

  form: { gap: 20 },
  fieldGroup: { gap: 6 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151' },
  optional: { fontWeight: '400', color: '#9CA3AF' },
  input: {
    height: 50,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#fff',
  },
  inputError: { borderColor: '#EF4444' },
  errorMsg: { fontSize: 12, color: '#EF4444' },
  hint: { fontSize: 11, color: '#9CA3AF' },

  primaryBtn: {
    height: 52,
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnDisabled: { opacity: 0.7 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Success state
  successWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  successIconWrap: { marginBottom: 16 },
  successTitle: { fontSize: 24, fontWeight: '700', color: '#111827', marginBottom: 6 },
  successSub: { fontSize: 14, color: '#6B7280', marginBottom: 28 },

  resultCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  resultLabel: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  resultUrl: { fontSize: 16, fontWeight: '700', color: '#4F46E5', marginBottom: 14 },
  resultDivider: { height: 1, backgroundColor: '#F3F4F6', marginBottom: 14 },
  resultOriginal: { fontSize: 13, color: '#6B7280', lineHeight: 18 },

  resultStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    width: '100%',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  resultStatItem: { flex: 1, alignItems: 'center', gap: 4 },
  resultStatValue: { fontSize: 22, fontWeight: '800', color: '#111827' },
  resultStatLabel: { fontSize: 12, color: '#9CA3AF', fontWeight: '500' },
  resultStatDivider: { width: 1, height: 32, backgroundColor: '#E5E7EB' },
  activeDot: { width: 10, height: 10, borderRadius: 5 },

  shareBtn: {
    width: '100%',
    height: 52,
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  shareBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  anotherBtn: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  anotherBtnText: { fontSize: 15, fontWeight: '600', color: '#374151' },
});
