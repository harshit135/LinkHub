import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { listURLs } from '../../src/api/urls';
import { getEmail } from '../../src/storage/tokens';

function StatRow({ label, value, color = '#111827' }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statRowLabel}>{label}</Text>
      <Text style={[styles.statRowValue, { color }]}>{value}</Text>
    </View>
  );
}

export default function Profile() {
  const [email, setEmail] = useState('');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [storedEmail, list] = await Promise.all([
          getEmail(),
          listURLs({ limit: 100 }),
        ]);
        setEmail(storedEmail || '');
        const urls = list.data || [];
        const totalClicks = urls.reduce((s, u) => s + u.click_count, 0);
        const active = urls.filter((u) => u.is_active).length;
        setStats({
          total: list.total,
          totalClicks,
          active,
          inactive: list.total - active,
          topLink: [...urls].sort((a, b) => b.click_count - a.click_count)[0] || null,
        });
      } catch { /* show what we have */ }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const initial = email ? email[0].toUpperCase() : '?';

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <View style={styles.logo}><Text style={styles.logoChar}>L</Text></View>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Avatar + email */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <Text style={styles.emailText}>{email || 'Loading…'}</Text>
          <View style={styles.memberBadge}>
            <Text style={styles.memberBadgeText}>LinkHub Member</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#4F46E5" style={{ marginTop: 40 }} />
        ) : stats ? (
          <>
            <Text style={styles.sectionLabel}>Account Stats</Text>
            <View style={styles.card}>
              <StatRow label="Total Links Created" value={stats.total} color="#4F46E5" />
              <View style={styles.divider} />
              <StatRow label="Total Clicks" value={stats.totalClicks} color="#0EA5E9" />
              <View style={styles.divider} />
              <StatRow label="Active Links" value={stats.active} color="#10B981" />
              <View style={styles.divider} />
              <StatRow label="Inactive Links" value={stats.inactive} color="#9CA3AF" />
            </View>

            {stats.topLink && (
              <>
                <Text style={styles.sectionLabel}>Best Performing Link</Text>
                <View style={styles.card}>
                  <Text style={styles.topLinkCode}>/{stats.topLink.short_code}</Text>
                  <Text style={styles.topLinkUrl} numberOfLines={1}>
                    {stats.topLink.original_url.replace(/^https?:\/\/(www\.)?/, '')}
                  </Text>
                  <View style={styles.topLinkStats}>
                    <View style={styles.topLinkStatItem}>
                      <Text style={styles.topLinkStatValue}>{stats.topLink.click_count}</Text>
                      <Text style={styles.topLinkStatLabel}>Clicks</Text>
                    </View>
                    <View style={styles.topLinkStatDivider} />
                    <View style={styles.topLinkStatItem}>
                      <View style={[
                        styles.topLinkDot,
                        { backgroundColor: stats.topLink.is_active ? '#10B981' : '#9CA3AF' }
                      ]} />
                      <Text style={styles.topLinkStatLabel}>
                        {stats.topLink.is_active ? 'Active' : 'Inactive'}
                      </Text>
                    </View>
                  </View>
                </View>
              </>
            )}

            <Text style={styles.sectionLabel}>Activity Overview</Text>
            <View style={styles.card}>
              <View style={styles.activityBar}>
                <View style={styles.activityBarLabel}>
                  <View style={styles.dotGreen} />
                  <Text style={styles.activityBarText}>Active</Text>
                </View>
                <Text style={styles.activityBarPct}>
                  {stats.total > 0
                    ? `${Math.round((stats.active / stats.total) * 100)}%`
                    : '—'}
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: stats.total > 0 ? `${(stats.active / stats.total) * 100}%` : '0%' },
                  ]}
                />
              </View>
              <Text style={styles.activityCaption}>
                {stats.active} of {stats.total} links are currently active
              </Text>
            </View>
          </>
        ) : null}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
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

  scroll: { paddingHorizontal: 20, paddingTop: 24 },

  // Avatar section
  avatarSection: { alignItems: 'center', marginBottom: 32 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarText: { color: '#fff', fontSize: 32, fontWeight: '800' },
  emailText: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 8 },
  memberBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  memberBadgeText: { fontSize: 12, fontWeight: '600', color: '#4F46E5' },

  // Section label
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
  },

  // Card
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 2 },

  // Stats
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 11,
  },
  statRowLabel: { fontSize: 14, color: '#374151', fontWeight: '500' },
  statRowValue: { fontSize: 18, fontWeight: '800' },

  // Top link
  topLinkCode: { fontSize: 18, fontWeight: '800', color: '#4F46E5', marginBottom: 4 },
  topLinkUrl: { fontSize: 13, color: '#6B7280', marginBottom: 14 },
  topLinkStats: { flexDirection: 'row', alignItems: 'center' },
  topLinkStatItem: { flex: 1, alignItems: 'center', gap: 4 },
  topLinkStatValue: { fontSize: 20, fontWeight: '800', color: '#111827' },
  topLinkStatLabel: { fontSize: 12, color: '#9CA3AF', fontWeight: '500' },
  topLinkStatDivider: { width: 1, height: 32, backgroundColor: '#E5E7EB' },
  topLinkDot: { width: 10, height: 10, borderRadius: 5 },

  // Activity
  activityBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  activityBarLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dotGreen: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' },
  activityBarText: { fontSize: 14, color: '#374151', fontWeight: '500' },
  activityBarPct: { fontSize: 14, fontWeight: '700', color: '#111827' },
  progressTrack: {
    height: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: { height: 6, backgroundColor: '#10B981', borderRadius: 3 },
  activityCaption: { fontSize: 12, color: '#9CA3AF' },
});
