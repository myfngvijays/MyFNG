import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Pressable, Linking, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES } from '../constants/theme';
import PublicPillNav, { type PublicPillNavTab } from '../components/PublicPillNav';
import { supabase } from '../lib/supabase';

type Props = {
  navigation: any;
  route: any;
};

export default function PublicServicePackagesScreen({ navigation, route }: Props) {
  const city: string | undefined = route?.params?.city;
  const [supportOpen, setSupportOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [selectedServiceName, setSelectedServiceName] = useState<string | null>(null);
  const [checklistExpanded, setChecklistExpanded] = useState(false);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [checklistError, setChecklistError] = useState<string | null>(null);
  const [checklistTemplate, setChecklistTemplate] = useState<{
    serviceTypeName: string;
    title: string | null;
    points: number | null;
    items: Array<{ id?: string; name?: string; category?: string }>;
  } | null>(null);

  const supportPhone = '+919167779696';
  const supportEmail = 'support@myfng.in';

  const packages = useMemo(
    () => [
      {
        title: 'Periodic Service',
        items: ['Basic service', 'Standard service', 'Premium service'],
        icon: 'calendar',
      },
      {
        title: 'AC Service',
        items: ['AC checkup', 'Gas refill', 'Cooling issue diagnosis'],
        icon: 'snow',
      },
      {
        title: 'Repairs',
        items: ['Brake service', 'Suspension', 'Engine diagnostics'],
        icon: 'build',
      },
      {
        title: 'Detailing',
        items: ['Interior cleaning', 'Exterior polish', 'Ceramic coating'],
        icon: 'sparkles',
      },
      {
        title: 'Roadside Assistance',
        items: ['Battery jumpstart', 'Towing', 'Tyre puncture support'],
        icon: 'car-sport',
      },
    ],
    []
  );

  const selectedPackage = useMemo(() => {
    if (activeCategory === 'ALL') return null;
    return packages.find((p) => p.title === activeCategory) ?? null;
  }, [activeCategory, packages]);

  useEffect(() => {
    // Reset selection when category changes
    setSelectedServiceName(null);
    setChecklistExpanded(false);
    setChecklistTemplate(null);
    setChecklistError(null);
  }, [activeCategory]);

  useEffect(() => {
    async function loadChecklist() {
      if (!selectedPackage || !selectedServiceName) return;

      setChecklistLoading(true);
      setChecklistError(null);
      setChecklistTemplate(null);

      try {
        // 1) Find the service_type row (DB)
        const exactNeedle = selectedServiceName.trim();
        const keywordNeedle = exactNeedle.split(' ')[0] || exactNeedle;

        const tryFindServiceType = async (needle: string) => {
          const { data } = await supabase
            .from('service_types')
            .select('id,name')
            .eq('is_active', true)
            .ilike('name', `%${needle}%`)
            .order('name')
            .limit(1)
            .maybeSingle();
          return data as any;
        };

        let st = await tryFindServiceType(exactNeedle);
        if (!st && keywordNeedle && keywordNeedle !== exactNeedle) st = await tryFindServiceType(keywordNeedle);

        if (!st?.id) {
          setChecklistTemplate({
            serviceTypeName: selectedServiceName,
            title: null,
            points: null,
            items: [],
          });
          return;
        }

        // 2) Fetch customer checklist template for this service_type (DB)
        const { data: tpl } = await supabase
          .from('service_type_checklist_templates')
          .select('title,points,checklist_items')
          .eq('service_type_id', st.id)
          .maybeSingle();

        const serviceTypeName: string = String(st?.name || selectedServiceName);
        const title: string | null = tpl?.title ? String(tpl.title) : null;
        const points: number | null = Number.isFinite(Number(tpl?.points)) ? Number(tpl.points) : null;
        const itemsRaw = (tpl?.checklist_items || []) as any[];

        setChecklistTemplate({
          serviceTypeName,
          title,
          points,
          items: Array.isArray(itemsRaw) ? itemsRaw : [],
        });
      } catch (e: any) {
        setChecklistError(e?.message ? String(e.message) : 'Failed to load checklist');
      } finally {
        setChecklistLoading(false);
      }
    }

    loadChecklist();
  }, [selectedPackage, selectedServiceName]);

  const derivedBadge = useMemo(() => {
    const name = String(selectedServiceName || '').trim();
    if (!name) return '';
    return name.split(' ')[0]?.toUpperCase() || '';
  }, [selectedServiceName]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={20} color={COLORS.primaryDark} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Service Packages</Text>
            <Text style={styles.subTitle}>{city ? `City: ${city}` : 'Browse packages'}</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.loginBtn}>
            <Text style={styles.loginText}>Login</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <Text style={styles.heroTitle}>Transparent pricing. Verified workshops.</Text>
            <Text style={styles.heroSub}>
              You can browse as guest. For booking, start with AI — it recommends the right package.
            </Text>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() =>
                navigation.navigate('AIBooking', { city, prefill: 'I want to view service packages and book.' })
              }
            >
              <Ionicons name="chatbubbles" size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>Chat & Book with AI</Text>
            </TouchableOpacity>
          </View>

          {/* Categories strip (like market apps) */}
          <View style={styles.categoriesWrap}>
            <View style={styles.categoriesGrid}>
              <TouchableOpacity
                style={[styles.categoryTile, activeCategory === 'ALL' ? styles.categoryTileActive : null]}
                activeOpacity={0.9}
                onPress={() => setActiveCategory('ALL')}
              >
                <View style={[styles.categoryIconBox, styles.categoryAllBox]}>
                  <Text style={styles.categoryAllText}>ALL</Text>
                </View>
                <Text style={styles.categoryLabel} numberOfLines={2}>
                  All
                </Text>
              </TouchableOpacity>

          {packages.map((p) => (
                <TouchableOpacity
                  key={p.title}
                  style={[styles.categoryTile, activeCategory === p.title ? styles.categoryTileActive : null]}
                  activeOpacity={0.9}
                  onPress={() => setActiveCategory(p.title)}
                >
                  <View style={styles.categoryIconBox}>
                    <Ionicons name={p.icon as any} size={22} color={COLORS.primaryDark} />
                  </View>
                  <Text style={styles.categoryLabel} numberOfLines={2}>
                    {p.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Selected category details */}
          {selectedPackage ? (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardIcon}>
                  <Ionicons name={selectedPackage.icon as any} size={18} color="#fff" />
                </View>
                <Text style={styles.cardTitle}>{selectedPackage.title}</Text>
              </View>

              <Text style={styles.serviceTypesTitle}>Select a service type</Text>
              {selectedPackage.items.map((it) => {
                const active = selectedServiceName === it;
                return (
                  <TouchableOpacity
                    key={it}
                    style={[styles.serviceTypeRow, active ? styles.serviceTypeRowActive : null]}
                    activeOpacity={0.9}
                    onPress={() => {
                      setSelectedServiceName(it);
                      setChecklistExpanded(true);
                    }}
                  >
                    <View style={styles.serviceTypeLeft}>
                      <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={18} color={COLORS.primary} />
                      <Text style={[styles.serviceTypeText, active ? styles.serviceTypeTextActive : null]}>{it}</Text>
                    </View>
                    <Ionicons name="chevron-down" size={16} color={COLORS.gray[500]} />
                  </TouchableOpacity>
                );
              })}

              {/* Checklist details (DB-driven) */}
              {selectedServiceName ? (
                <View style={styles.checklistCard}>
                  <View style={styles.checklistTopRow}>
                    <View style={styles.checklistTopLeft}>
                      {!!derivedBadge ? <Text style={styles.checklistBadge}>{derivedBadge}</Text> : null}
                      <Text style={styles.checklistTitle} numberOfLines={2}>
                        {checklistTemplate?.title || checklistTemplate?.serviceTypeName || selectedServiceName || 'Checklist'}
                        {checklistTemplate?.points ? ` (${checklistTemplate.points} Points)` : ''}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setChecklistExpanded((v) => !v)}
                      activeOpacity={0.8}
                      style={styles.checklistLinkBtn}
                    >
                      <Text style={styles.checklistLinkText}>{checklistExpanded ? 'Hide checklist' : 'View checklist'}</Text>
                    </TouchableOpacity>
                  </View>

                  {!checklistExpanded ? (
                    <Text style={styles.checklistEmptyText}>Tap “View checklist” to see details.</Text>
                  ) : checklistLoading ? (
                    <View style={styles.checklistLoading}>
                      <ActivityIndicator size="small" color={COLORS.primary} />
                      <Text style={styles.checklistLoadingText}>Loading checklist…</Text>
                    </View>
                  ) : checklistError ? (
                    <Text style={styles.checklistErrorText}>{checklistError}</Text>
                  ) : checklistTemplate && checklistTemplate.items.length ? (
                    <View style={styles.checklistItems}>
                      <View style={styles.checklistStatsRow}>
                        {checklistTemplate.points ? (
                          <View style={styles.checklistPill}>
                            <Ionicons name="checkmark-done" size={14} color={COLORS.gray[700]} />
                            <Text style={styles.checklistPillText}>{checklistTemplate.points} pts</Text>
                          </View>
                        ) : null}
                      </View>

                      <View style={styles.checklistSectionHeader}>
                        <Text style={styles.checklistSectionTitle}>What you get</Text>
                        <Text style={styles.checklistSectionMeta}>Official</Text>
                      </View>

                      {checklistTemplate.items.slice(0, 12).map((ci, idx) => (
                        <View key={String(ci.id || idx)} style={styles.checklistItemRow}>
                          <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.checklistItemText}>{String(ci.name || '')}</Text>
                            {ci.category ? <Text style={styles.checklistItemMeta}>{String(ci.category)}</Text> : null}
                          </View>
                        </View>
                      ))}
                      {checklistTemplate.items.length > 12 ? (
                        <Text style={styles.checklistMoreText}>+ {checklistTemplate.items.length - 12} more points</Text>
                      ) : null}
                    </View>
                  ) : (
                    <Text style={styles.checklistEmptyText}>Checklist is not available for this service yet.</Text>
                  )}
                </View>
              ) : null}

              <TouchableOpacity
                style={styles.cardCta}
                onPress={() =>
                  navigation.navigate('AIBooking', { city, prefill: `I want ${selectedPackage.title.toLowerCase()}.` })
                }
              >
                <Text style={styles.cardCtaText}>Get AI recommendation</Text>
                <Ionicons name="arrow-forward" size={16} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
          ) : (
            packages.map((p) => (
              <View key={p.title} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardIcon}>
                    <Ionicons name={p.icon as any} size={18} color="#fff" />
                  </View>
                  <Text style={styles.cardTitle}>{p.title}</Text>
              </View>

              {p.items.map((it) => (
                <View key={it} style={styles.row}>
                  <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
                  <Text style={styles.rowText}>{it}</Text>
                </View>
              ))}

              <TouchableOpacity
                style={styles.cardCta}
                onPress={() => navigation.navigate('AIBooking', { city, prefill: `I want ${p.title.toLowerCase()}.` })}
              >
                <Text style={styles.cardCtaText}>Get AI recommendation</Text>
                <Ionicons name="arrow-forward" size={16} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
            ))
          )}

          <View style={styles.footerNote}>
            <Ionicons name="shield-checkmark" size={18} color={COLORS.primary} />
            <Text style={styles.footerText}>
              MY FNG ensures quality-audited partner workshops and warranty-backed service.
            </Text>
          </View>
        </ScrollView>

        <PublicPillNav
          activeTab="search"
          onPressTab={(tab: PublicPillNavTab) => {
            if (tab === 'ai') navigation.navigate('AIBooking', { city });
            if (tab === 'search') navigation.navigate('PublicWorkshopLocator', { city });
            if (tab === 'profile') navigation.navigate('Login');
            if (tab === 'settings') setSupportOpen(true);
          }}
        />

        <Modal visible={supportOpen} transparent animationType="fade" onRequestClose={() => setSupportOpen(false)}>
          <Pressable style={styles.modalOverlay} onPress={() => setSupportOpen(false)}>
            <Pressable style={styles.modalCard} onPress={() => undefined}>
              <Text style={styles.modalTitle}>Support</Text>
              <TouchableOpacity style={styles.modalRow} onPress={() => navigation.navigate('AIBooking', { city, prefill: 'I need help.' })}>
                <Text style={styles.modalRowText}>Chat with AI</Text>
                <Ionicons name="chatbubbles" size={18} color={COLORS.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalRow} onPress={() => Linking.openURL(`tel:${supportPhone}`)}>
                <Text style={styles.modalRowText}>Call Support</Text>
                <Ionicons name="call" size={18} color={COLORS.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalRow} onPress={() => Linking.openURL(`mailto:${supportEmail}`)}>
                <Text style={styles.modalRowText}>Email</Text>
                <Ionicons name="mail" size={18} color={COLORS.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalLoginBtn}
                onPress={() => {
                  setSupportOpen(false);
                  navigation.navigate('Login');
                }}
              >
                <Text style={styles.modalLoginText}>Login</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.gray[50] },
  screen: { flex: 1, backgroundColor: COLORS.gray[50] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.gray[50],
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: FONT_SIZES.md,
    fontWeight: '900',
    color: COLORS.primaryDark,
  },
  subTitle: {
    marginTop: 2,
    fontSize: FONT_SIZES.xs,
    fontWeight: '800',
    color: COLORS.gray[600],
  },
  loginBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#EEF6FF',
    borderWidth: 1,
    borderColor: 'rgba(0,136,232,0.16)',
  },
  loginText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '900',
    color: COLORS.primaryDark,
  },
  container: {
    paddingHorizontal: SPACING.md,
    paddingBottom: 140,
  },
  hero: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(0,136,232,0.14)',
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
  },
  categoriesWrap: {
    marginBottom: SPACING.md,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 14,
    columnGap: 10,
  },
  categoryTile: {
    width: '31.5%',
    alignItems: 'center',
  },
  categoryTileActive: {
    transform: [{ scale: 1.02 }],
  },
  categoryIconBox: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: '#EEF6FF',
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryLabel: {
    marginTop: 6,
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.gray[800],
    textAlign: 'center',
    lineHeight: 12,
  },
  categoryAllBox: {
    backgroundColor: '#7C3AED',
    borderColor: 'rgba(124,58,237,0.25)',
  },
  categoryAllText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.primaryDark,
  },
  heroSub: {
    marginTop: 8,
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.gray[600],
    lineHeight: 18,
  },
  primaryBtn: {
    marginTop: SPACING.md,
    height: 52,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: FONT_SIZES.md,
    fontWeight: '900',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.06)',
    marginBottom: SPACING.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: SPACING.md,
  },
  cardIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: COLORS.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '900',
    color: COLORS.primaryDark,
  },
  serviceTypesTitle: {
    marginTop: 2,
    marginBottom: 10,
    fontSize: FONT_SIZES.xs,
    fontWeight: '900',
    color: COLORS.gray[600],
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  serviceTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: '#F8FAFF',
    borderWidth: 1,
    borderColor: 'rgba(0,136,232,0.10)',
    marginBottom: 10,
  },
  serviceTypeRowActive: {
    backgroundColor: '#EEF6FF',
    borderColor: 'rgba(0,136,232,0.22)',
  },
  serviceTypeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    paddingRight: 8,
  },
  serviceTypeText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    fontWeight: '900',
    color: COLORS.primaryDark,
  },
  serviceTypeTextActive: {
    color: COLORS.primaryDark,
  },
  checklistCard: {
    marginTop: 6,
    borderRadius: 18,
    padding: SPACING.md,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.06)',
  },
  checklistTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  checklistTopLeft: {
    flex: 1,
  },
  checklistBadge: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.gray[700],
    letterSpacing: 1,
    marginBottom: 4,
  },
  checklistTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.primaryDark,
    lineHeight: 22,
  },
  checklistLinkBtn: {
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  checklistLinkText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '900',
    color: COLORS.primary,
    textDecorationLine: 'underline',
  },
  checklistLoading: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checklistLoadingText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '800',
    color: COLORS.gray[600],
  },
  checklistErrorText: {
    marginTop: 10,
    fontSize: FONT_SIZES.sm,
    fontWeight: '800',
    color: COLORS.danger,
  },
  checklistEmptyText: {
    marginTop: 10,
    fontSize: FONT_SIZES.sm,
    fontWeight: '800',
    color: COLORS.gray[600],
  },
  checklistItems: {
    marginTop: 12,
  },
  checklistStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  checklistPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
  },
  checklistPillText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '900',
    color: COLORS.gray[700],
  },
  checklistSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  checklistSectionTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '900',
    color: COLORS.gray[800],
  },
  checklistSectionMeta: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '900',
    color: COLORS.success,
  },
  checklistItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(17,24,39,0.06)',
  },
  checklistItemText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '900',
    color: COLORS.primaryDark,
  },
  checklistItemMeta: {
    marginTop: 2,
    fontSize: FONT_SIZES.xs,
    fontWeight: '800',
    color: COLORS.gray[500],
  },
  checklistMoreText: {
    marginTop: 10,
    fontSize: FONT_SIZES.sm,
    fontWeight: '900',
    color: COLORS.primaryDark,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  rowText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.gray[700],
  },
  cardCta: {
    marginTop: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: '#F3F8FF',
    borderWidth: 1,
    borderColor: 'rgba(0,136,232,0.14)',
  },
  cardCtaText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '900',
    color: COLORS.primaryDark,
  },
  footerNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.06)',
  },
  footerText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.gray[600],
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
    padding: SPACING.md,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: SPACING.lg,
  },
  modalTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '900',
    color: COLORS.primaryDark,
    marginBottom: SPACING.md,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(17,24,39,0.06)',
  },
  modalRowText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '800',
    color: COLORS.black,
  },
  modalLoginBtn: {
    marginTop: SPACING.md,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#F3F8FF',
    borderWidth: 1,
    borderColor: 'rgba(0,136,232,0.18)',
    alignItems: 'center',
  },
  modalLoginText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '900',
    color: COLORS.primaryDark,
  },
});


