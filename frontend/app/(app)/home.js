import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { listURLs, topURLs } from '../../src/api/urls';
import { clearTokens } from '../../src/storage/tokens';

const MAX_SHELL_W = 480;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeSummary(urls, total) {
  const totalClicks = urls.reduce((s, u) => s + u.click_count, 0);
  const active = urls.filter((u) => u.is_active).length;
  const avgClicks = total > 0 ? (totalClicks / total).toFixed(1) : '0';
  return { total, totalClicks, active, inactive: total - active, avgClicks };
}

function getLast7Days(urls) {
  const slots = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    slots.push({
      key: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString('en', { weekday: 'short' }),
      count: 0,
    });
  }
  for (const url of urls) {
    const key = new Date(url.created_at).toISOString().slice(0, 10);
    const slot = slots.find((s) => s.key === key);
    if (slot) slot.count++;
  }
  return slots;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({ label, value, color, note, cardWidth }) {
  return (
    <View style={[styles.statCard, { width: cardWidth }]}>
      <View style={[styles.statBar, { backgroundColor: color }]} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {note ? <Text style={styles.statNote}>{note}</Text> : null}
    </View>
  );
}

function BarChart({ days }) {
  const max = Math.max(...days.map((d) => d.count), 1);
  const TRACK_H = 80;
  return (
    <View style={styles.chartRow}>
      {days.map((day) => {
        const fillH = day.count > 0 ? Math.max((day.count / max) * TRACK_H, 6) : 0;
        return (
          <View key={day.key} style={styles.barCol}>
            <Text style={styles.barCount}>{day.count > 0 ? day.count : ''}</Text>
            <View style={[styles.barTrack, { height: TRACK_H }]}>
              <View style={{ flex: 1 }} />
              <View style={[styles.barFill, { height: fillH }]} />
            </View>
            <Text style={styles.barDayLabel}>{day.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

function TopLinkRow({ url, maxClicks, rank }) {
  const pct = maxClicks > 0 ? Math.round((url.click_count / maxClicks) * 100) : 0;
  const domain = url.original_url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
  return (
    <View style={styles.topRow}>
      <Text style={styles.topRank}>#{rank}</Text>
      <View style={styles.topBody}>
        <View style={styles.topMeta}>
          <Text style={styles.topCode}>/{url.short_code}</Text>
          <View style={[styles.badge, { backgroundColor: url.is_active ? '#D1FAE5' : '#F3F4F6' }]}>
            <Text style={[styles.badgeText, { color: url.is_active ? '#065F46' : '#6B7280' }]}>
              {url.is_active ? 'active' : 'off'}
            </Text>
          </View>
        </View>
        <Text style={styles.topDomain} numberOfLines={1}>{domain}</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${pct}%` }]} />
        </View>
      </View>
      <Text style={styles.topClicks}>{url.click_count}</Text>
    </View>
  );
}

function RecentRow({ url }) {
  const domain = url.original_url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
  const date = new Date(url.created_at).toLocaleDateString('en', {
    month: 'short',
    day: 'numeric',
  });
  return (
    <View style={styles.recentRow}>
      <View style={[styles.statusDot, { backgroundColor: url.is_active ? '#10B981' : '#D1D5DB' }]} />
      <View style={styles.recentBody}>
        <Text style={styles.recentCode}>/{url.short_code}</Text>
        <Text style={styles.recentDomain} numberOfLines={1}>{domain}</Text>
      </View>
      <View style={styles.recentRight}>
        <Text style={styles.recentClicks}>{url.click_count} clicks</Text>
        <Text style={styles.recentDate}>{date}</Text>
      </View>
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function Home() {
  const { width } = useWindowDimensions();
  const screenW = Math.min(width, MAX_SHELL_W);
  const CARD_W = (screenW - 48 - 12) / 2;

  const [urlList, setUrlList] = useState({ data: [], total: 0 });
  const [top, setTop] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const [list, topList] = await Promise.all([
        listURLs({ limit: 100 }),
        topURLs(),
      ]);
      setUrlList(list);
      setTop(topList);
    } catch (err) {
      if (err.status === 401) {
        await clearTokens();
        router.replace('/(auth)/login');
        return;
      }
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  const { data: urls, total } = urlList;
  const summary = computeSummary(urls, total);
  const last7 = getLast7Days(urls);
  const recentLinks = urls.slice(0, 5);
  const maxClicks = top[0]?.click_count || 1;

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.logo}><Text style={styles.logoChar}>L</Text></View>
        <View>
          <Text style={styles.headerTitle}>Dashboard</Text>
          <Text style={styles.headerSub}>LinkHub Analytics</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchAll(true)}
            tintColor="#4F46E5"
          />
        }
      >
        {/* ── Error banner ── */}
        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={() => fetchAll()}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* ── Overview cards ── */}
        <Text style={styles.sectionLabel}>Overview</Text>
        <View style={styles.statsGrid}>
          <StatCard label="Total Links" value={summary.total} color="#4F46E5" cardWidth={CARD_W} />
          <StatCard label="Total Clicks" value={summary.totalClicks} color="#0EA5E9" cardWidth={CARD_W} />
          <StatCard label="Active Links" value={summary.active} color="#10B981" cardWidth={CARD_W} />
          <StatCard
            label="Avg Clicks"
            value={summary.avgClicks}
            color="#F59E0B"
            note="per link"
            cardWidth={CARD_W}
          />
        </View>

        {/* ── Activity chart ── */}
        <Text style={styles.sectionLabel}>Links Created — Last 7 Days</Text>
        <View style={styles.card}>
          {total === 0 ? (
            <Text style={styles.emptyCardText}>No links created yet</Text>
          ) : (
            <BarChart days={last7} />
          )}
        </View>

        {/* ── Top links ── */}
        {top.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Top Links by Clicks</Text>
            <View style={styles.card}>
              {top.slice(0, 5).map((url, i) => (
                <View key={url.short_code}>
                  <TopLinkRow url={url} maxClicks={maxClicks} rank={i + 1} />
                  {i < Math.min(top.length, 5) - 1 && <View style={styles.divider} />}
                </View>
              ))}
            </View>
          </>
        )}

        {/* ── Active vs inactive breakdown ── */}
        {total > 0 && (
          <>
            <Text style={styles.sectionLabel}>Link Status Breakdown</Text>
            <View style={styles.card}>
              <View style={styles.breakdownRow}>
                <View style={styles.breakdownItem}>
                  <Text style={[styles.breakdownValue, { color: '#10B981' }]}>
                    {summary.active}
                  </Text>
                  <Text style={styles.breakdownLabel}>Active</Text>
                </View>
                <View style={styles.breakdownDivider} />
                <View style={styles.breakdownItem}>
                  <Text style={[styles.breakdownValue, { color: '#9CA3AF' }]}>
                    {summary.inactive}
                  </Text>
                  <Text style={styles.breakdownLabel}>Inactive</Text>
                </View>
                <View style={styles.breakdownDivider} />
                <View style={styles.breakdownItem}>
                  <Text style={[styles.breakdownValue, { color: '#4F46E5' }]}>
                    {total > 0 ? Math.round((summary.active / total) * 100) : 0}%
                  </Text>
                  <Text style={styles.breakdownLabel}>Active Rate</Text>
                </View>
              </View>
              <View style={styles.breakdownBarTrack}>
                <View
                  style={[
                    styles.breakdownBarFill,
                    { width: `${total > 0 ? (summary.active / total) * 100 : 0}%` },
                  ]}
                />
              </View>
            </View>
          </>
        )}

        {/* ── Recent links ── */}
        {recentLinks.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Recent Links</Text>
            <View style={styles.card}>
              {recentLinks.map((url, i) => (
                <View key={url.short_code}>
                  <RecentRow url={url} />
                  {i < recentLinks.length - 1 && <View style={styles.divider} />}
                </View>
              ))}
            </View>
          </>
        )}

        {/* ── Empty state ── */}
        {total === 0 && !error && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No links yet</Text>
            <Text style={styles.emptySub}>
              Create your first short link to see analytics here.
            </Text>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F3F4F6' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20 },

  // Header
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
  headerSub: { fontSize: 12, color: '#6B7280', marginTop: 1 },

  // Error banner
  errorBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: { fontSize: 13, color: '#B91C1C', flex: 1 },
  retryText: { fontSize: 13, color: '#4F46E5', fontWeight: '600', marginLeft: 12 },

  // Section label
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
  },

  // Stat cards
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  statValue: { fontSize: 30, fontWeight: '800', marginTop: 8 },
  statLabel: { fontSize: 12, color: '#6B7280', marginTop: 4, fontWeight: '500' },
  statNote: { fontSize: 11, color: '#9CA3AF', marginTop: 1 },

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
  emptyCardText: { textAlign: 'center', color: '#9CA3AF', fontSize: 14, paddingVertical: 12 },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 2 },

  // Bar chart
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  barCol: { flex: 1, alignItems: 'center' },
  barCount: { fontSize: 10, color: '#6B7280', fontWeight: '600', marginBottom: 3, height: 14 },
  barTrack: {
    width: '62%',
    backgroundColor: '#EEF2FF',
    borderRadius: 4,
    overflow: 'hidden',
    flexDirection: 'column',
  },
  barFill: { width: '100%', backgroundColor: '#4F46E5', borderRadius: 4 },
  barDayLabel: { fontSize: 10, color: '#9CA3AF', marginTop: 6, fontWeight: '500' },

  // Top links
  topRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  topRank: { fontSize: 12, fontWeight: '700', color: '#9CA3AF', width: 24 },
  topBody: { flex: 1, marginHorizontal: 10 },
  topMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  topCode: { fontSize: 14, fontWeight: '700', color: '#111827' },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgeText: { fontSize: 10, fontWeight: '600' },
  topDomain: { fontSize: 12, color: '#6B7280', marginBottom: 6 },
  progressTrack: { height: 4, backgroundColor: '#EEF2FF', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, backgroundColor: '#4F46E5', borderRadius: 2 },
  topClicks: { fontSize: 15, fontWeight: '700', color: '#111827', width: 40, textAlign: 'right' },

  // Breakdown
  breakdownRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  breakdownItem: { flex: 1, alignItems: 'center' },
  breakdownValue: { fontSize: 24, fontWeight: '800' },
  breakdownLabel: { fontSize: 11, color: '#9CA3AF', marginTop: 3, fontWeight: '500' },
  breakdownDivider: { width: 1, height: 36, backgroundColor: '#F3F4F6' },
  breakdownBarTrack: {
    height: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 3,
    overflow: 'hidden',
  },
  breakdownBarFill: { height: 6, backgroundColor: '#10B981', borderRadius: 3 },

  // Recent links
  recentRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 12 },
  recentBody: { flex: 1 },
  recentCode: { fontSize: 14, fontWeight: '600', color: '#111827' },
  recentDomain: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  recentRight: { alignItems: 'flex-end' },
  recentClicks: { fontSize: 12, fontWeight: '600', color: '#374151' },
  recentDate: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151', marginBottom: 8 },
  emptySub: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 20 },
});
