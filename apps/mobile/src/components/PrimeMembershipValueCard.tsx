import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import {
  PRIME_VALUE_ADDON,
  PRIME_VALUE_BENEFITS,
  PRIME_VALUE_FOOTER,
  PRIME_VALUE_PRICE,
  PRIME_VALUE_SAVE,
  PRIME_VALUE_TOTAL,
} from '../constants/primeMembershipValueCard';
import type { ValueCardBenefit, ValueCardConfig } from '../lib/membershipPlan';
import MembershipBenefitIcon, { benefitIconStyles } from './MembershipBenefitIcon';
import CarModelSearchField from './CarModelSearchField';

export type MembershipVehicleOption = {
  key: string;
  vehicle_number?: string;
  make?: string;
  model?: string;
  label?: string;
};

export type GuestVehicleForm = {
  name: string;
  phone: string;
  vehicleNumber: string;
  make: string;
  model: string;
  carSearchDisplay?: string;
};

export type LinkedMembershipVehicle = {
  label: string;
  vehicle_number?: string;
  make?: string;
  model?: string;
};

type Props = {
  isLoggedIn: boolean;
  isActive: boolean;
  hasSecondCarAddon?: boolean;
  linkedPrimaryVehicle?: LinkedMembershipVehicle | null;
  linkedSecondVehicle?: LinkedMembershipVehicle | null;
  linkedPrimaryVehicleKey?: string | null;
  activeExpiry?: string;
  membershipLabel?: string;
  vehicles: MembershipVehicleOption[];
  primaryVehicleKey: string | null;
  onPrimaryVehicleKeyChange: (key: string) => void;
  addSecondCar: boolean;
  onAddSecondCarChange: (v: boolean) => void;
  secondVehicleKey: string | null;
  onSecondVehicleKeyChange: (key: string) => void;
  showSecondVehicleForm: boolean;
  onShowSecondVehicleFormChange: (v: boolean) => void;
  guestForm: GuestVehicleForm;
  onGuestFormChange: (patch: Partial<GuestVehicleForm>) => void;
  guestSecondForm: Pick<GuestVehicleForm, 'vehicleNumber' | 'make' | 'model' | 'carSearchDisplay'>;
  onGuestSecondFormChange: (patch: Partial<GuestVehicleForm>) => void;
  onActivate: () => void;
  onBuySecondCarAddon?: () => void;
  activating?: boolean;
  planName?: string;
  planPrice?: number;
  addonPrice?: number;
  tagline?: string;
  valueCard?: Partial<ValueCardConfig>;
  addonIcon?: string;
  addonIconUrl?: string;
  addonTitle?: string;
  addonDescription?: string;
  footerNote?: string;
};

function inr(n: number) {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`;
}

function vehicleLabel(v: MembershipVehicleOption) {
  const plate = String(v.vehicle_number || '').trim().toUpperCase();
  const mm = [v.make, v.model].filter(Boolean).join(' ');
  return mm ? `${mm}${plate ? ` · ${plate}` : ''}` : plate || v.label || 'Vehicle';
}

function VehiclePicker({
  title,
  options,
  selectedKey,
  onSelect,
  onAddNew,
  showAddNew,
}: {
  title: string;
  options: MembershipVehicleOption[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  onAddNew?: () => void;
  showAddNew?: boolean;
}) {
  return (
    <View style={styles.vehicleBlock}>
      <Text style={styles.vehicleBlockTitle}>{title}</Text>
      {options.length === 0 ? (
        <Text style={styles.vehicleHint}>No saved car in profile — search and add below.</Text>
      ) : (
        options.map((v) => {
          const active = selectedKey === v.key;
          return (
            <TouchableOpacity
              key={v.key}
              style={[styles.vehicleChip, active ? styles.vehicleChipActive : null]}
              onPress={() => onSelect(v.key)}
            >
              <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={18} color={active ? COLORS.primary : '#9CA3AF'} />
              <Text style={[styles.vehicleChipText, active ? styles.vehicleChipTextActive : null]}>{vehicleLabel(v)}</Text>
            </TouchableOpacity>
          );
        })
      )}
      {showAddNew && onAddNew ? (
        <TouchableOpacity style={styles.addVehicleBtn} onPress={onAddNew}>
          <Ionicons name="add-circle-outline" size={18} color={COLORS.primary} />
          <Text style={styles.addVehicleBtnText}>Add another car</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function BenefitValue({ prefix, label }: { prefix?: string; label: string }) {
  if (prefix) {
    return (
      <View style={styles.bValueStack}>
        <Text style={styles.bValuePrefix}>{prefix}</Text>
        <Text style={styles.bValue}>{label}</Text>
      </View>
    );
  }
  return <Text style={styles.bValue}>{label}</Text>;
}

function GuestCarSection({
  form,
  onChange,
  title,
  includeProfileFields = true,
}: {
  form: GuestVehicleForm | Pick<GuestVehicleForm, 'vehicleNumber' | 'make' | 'model' | 'carSearchDisplay'>;
  onChange: (patch: Partial<GuestVehicleForm>) => void;
  title?: string;
  includeProfileFields?: boolean;
}) {
  const showNamePhone = includeProfileFields && 'name' in form;
  const carDisplay =
    (form as GuestVehicleForm).carSearchDisplay ||
    [form.make, form.model].filter(Boolean).join(' ');

  return (
    <View style={styles.guestForm}>
      {title ? <Text style={styles.vehicleBlockTitle}>{title}</Text> : null}
      {showNamePhone ? (
        <>
          <TextInput
            style={styles.input}
            placeholder="Full name"
            value={(form as GuestVehicleForm).name}
            onChangeText={(name) => onChange({ name })}
          />
          <TextInput
            style={styles.input}
            placeholder="Mobile number"
            keyboardType="phone-pad"
            maxLength={10}
            value={(form as GuestVehicleForm).phone}
            onChangeText={(phone) => onChange({ phone: phone.replace(/\D/g, '').slice(0, 10) })}
          />
        </>
      ) : null}
      <TextInput
        style={styles.input}
        placeholder="Car number (e.g. MH12AB1234)"
        autoCapitalize="characters"
        value={form.vehicleNumber}
        onChangeText={(vehicleNumber) => onChange({ vehicleNumber: vehicleNumber.toUpperCase() })}
      />
      <CarModelSearchField
        label="Car brand & model"
        displayValue={carDisplay}
        selectedMake={form.make}
        selectedModel={form.model}
        onSelect={(make, model, display) =>
          onChange({ make, model, carSearchDisplay: display })
        }
        onClear={() => onChange({ make: '', model: '', carSearchDisplay: '' })}
      />
    </View>
  );
}

function LinkedVehicleCard({
  title,
  vehicle,
  badge,
  validUntil,
}: {
  title: string;
  vehicle: LinkedMembershipVehicle;
  badge?: string;
  validUntil?: string;
}) {
  return (
    <View style={styles.linkedCarCard}>
      <View style={styles.linkedCarIcon}>
        <Ionicons name="car-sport" size={18} color={COLORS.primary} />
      </View>
      <View style={styles.linkedCarBody}>
        <Text style={styles.linkedCarTitle}>{title}</Text>
        <Text style={styles.linkedCarName}>{vehicle.label}</Text>
        {vehicle.vehicle_number ? (
          <Text style={styles.linkedCarPlate}>{vehicle.vehicle_number}</Text>
        ) : null}
        {validUntil ? <Text style={styles.linkedCarValid}>Valid until {validUntil}</Text> : null}
      </View>
      {badge ? (
        <View style={styles.linkedCarBadge}>
          <Text style={styles.linkedCarBadgeText}>{badge}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function PrimeMembershipValueCard({
  isLoggedIn,
  isActive,
  hasSecondCarAddon = false,
  linkedPrimaryVehicle = null,
  linkedSecondVehicle = null,
  linkedPrimaryVehicleKey = null,
  activeExpiry,
  membershipLabel,
  vehicles,
  primaryVehicleKey,
  onPrimaryVehicleKeyChange,
  addSecondCar,
  onAddSecondCarChange,
  secondVehicleKey,
  onSecondVehicleKeyChange,
  showSecondVehicleForm,
  onShowSecondVehicleFormChange,
  guestForm,
  onGuestFormChange,
  guestSecondForm,
  onGuestSecondFormChange,
  onActivate,
  onBuySecondCarAddon,
  activating,
  planName = 'MyFNG Prime',
  planPrice = PRIME_VALUE_PRICE,
  addonPrice = PRIME_VALUE_ADDON,
  tagline,
  valueCard,
  addonIcon = 'car-sport',
  addonIconUrl,
  addonTitle = '2nd Car Add-On',
  addonDescription = "same benefits, same membership period as primary car",
  footerNote,
}: Props) {
  const canBuySecondCarAddon = isActive && !hasSecondCarAddon && Boolean(onBuySecondCarAddon);
  const showFullPurchase = !isActive;
  const totalPay = planPrice + (addSecondCar ? addonPrice : 0);
  const primaryOptions = vehicles;

  const cardBenefits: ValueCardBenefit[] =
    valueCard?.benefits && valueCard.benefits.length > 0
      ? valueCard.benefits
      : PRIME_VALUE_BENEFITS.map((b) => ({
          icon: b.icon,
          title: b.title,
          description: b.description,
          valueLabel: b.valueLabel,
          valuePrefix: b.valuePrefix,
        }));

  const totalBenefitsValue = valueCard?.totalBenefitsValue ?? PRIME_VALUE_TOTAL;
  const saveAmount = valueCard?.saveAmount ?? PRIME_VALUE_SAVE;
  const valueColumnLabel = valueCard?.valueColumnLabel ?? 'VALUE';
  const totalBenefitsLabel = valueCard?.totalBenefitsLabel ?? 'Total Benefits Value';
  const saveLabel = valueCard?.saveLabel ?? 'You Save';
  const priceHeroLabel = valueCard?.priceHeroLabel ?? 'YOU PAY ONLY';
  const priceHeroSub = valueCard?.priceHeroSub ?? 'All benefits · One full year · One car';
  const headerTagline = tagline || valueCard?.tagline || 'Your Car. Our Responsibility.';
  const cardFooter = footerNote || valueCard?.footerNote || PRIME_VALUE_FOOTER;

  const benefitsHead = `BENEFITS FOR ${String(planName || 'MYFNG PRIME').toUpperCase()}`;

  const renderSecondCarDetails = (addonOnly = false) => {
    const excludeKey = addonOnly ? linkedPrimaryVehicleKey || primaryVehicleKey : primaryVehicleKey;
    const pickerOptions = addonOnly
      ? vehicles.filter((v) => v.key !== excludeKey)
      : vehicles.filter((v) => v.key !== primaryVehicleKey);
    const showAddForm = showSecondVehicleForm || pickerOptions.length === 0;
    return (
    <View style={styles.detailsSection}>
      {isLoggedIn ? (
        pickerOptions.length > 0 && !showAddForm ? (
          <VehiclePicker
            title={addonOnly ? 'Select your 2nd car' : 'Select 2nd car from profile'}
            options={pickerOptions}
            selectedKey={secondVehicleKey}
            onSelect={onSecondVehicleKeyChange}
            showAddNew
            onAddNew={() => onShowSecondVehicleFormChange(true)}
          />
        ) : (
          <>
            {pickerOptions.length > 0 ? (
              <TouchableOpacity onPress={() => onShowSecondVehicleFormChange(false)} style={styles.backLink}>
                <Text style={styles.backLinkText}>← Choose from saved cars</Text>
              </TouchableOpacity>
            ) : null}
            <GuestCarSection
              title={addonOnly ? 'Add your 2nd car' : '2nd car details'}
              form={guestSecondForm}
              onChange={onGuestSecondFormChange}
              includeProfileFields={false}
            />
          </>
        )
      ) : (
        <GuestCarSection title="2nd car details" form={guestSecondForm} onChange={onGuestSecondFormChange} includeProfileFields={false} />
      )}
    </View>
    );
  };

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>{planName}</Text>
            <Text style={styles.headerSub}>{headerTagline}</Text>
          </View>
          <View style={styles.crownWrap}>
            <Text style={styles.crownEmoji}>👑</Text>
          </View>
        </View>

        {isActive ? (
          <View style={styles.activeBanner}>
            <Ionicons name="checkmark-circle" size={18} color="#047857" />
            <Text style={styles.activeBannerText}>
              {membershipLabel || 'Prime Member'} active{activeExpiry ? ` · until ${activeExpiry}` : ''}
              {hasSecondCarAddon ? ' · 2nd car included' : ''}
            </Text>
          </View>
        ) : null}

        {isActive && isLoggedIn && linkedPrimaryVehicle ? (
          <View style={styles.linkedCarsSection}>
            <Text style={styles.linkedCarsHeading}>Your membership covers</Text>
            {activeExpiry ? (
              <Text style={styles.linkedCarsSub}>
                Dono cars ki validity same hai · membership {activeExpiry} tak active
              </Text>
            ) : null}
            <LinkedVehicleCard
              title="Primary car"
              vehicle={linkedPrimaryVehicle}
              badge="ACTIVE"
              validUntil={activeExpiry}
            />
            {hasSecondCarAddon && linkedSecondVehicle ? (
              <LinkedVehicleCard
                title="2nd car add-on"
                vehicle={linkedSecondVehicle}
                badge="ADD-ON"
                validUntil={activeExpiry}
              />
            ) : null}
          </View>
        ) : null}

        <View style={styles.benefitsSection}>
          <View style={styles.benefitsHead}>
            <Text style={[styles.benefitsHeadText, styles.benefitsHeadLeft]}>{benefitsHead}</Text>
            <Text style={styles.benefitsHeadText}>{valueColumnLabel}</Text>
          </View>
          {cardBenefits.map((b, idx) => (
            <View key={`${b.title}-${idx}`} style={[styles.bRow, idx === cardBenefits.length - 1 ? styles.bRowLast : null]}>
              <View style={styles.bLeft}>
                <View style={styles.bIcon}>
                  <MembershipBenefitIcon icon={b.icon} iconUrl={b.iconUrl} size={15} />
                </View>
                <View style={styles.bTextWrap}>
                  <Text style={styles.bTitle}>{b.title}</Text>
                  <Text style={styles.bSub}>{b.description}</Text>
                </View>
              </View>
              <BenefitValue prefix={b.valuePrefix} label={b.valueLabel} />
            </View>
          ))}
        </View>

        <View style={styles.totalBand}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{totalBenefitsLabel}</Text>
            <Text style={[styles.totalValue, styles.totalStrike]}>{inr(totalBenefitsValue)}</Text>
          </View>
          <View style={styles.saveRow}>
            <Text style={styles.saveLabel}>{saveLabel}</Text>
            <Text style={styles.saveValue}>{inr(saveAmount)}</Text>
          </View>
        </View>

        {!isActive ? (
        <View style={styles.priceHero}>
          <Text style={styles.priceHeroLabel}>{priceHeroLabel}</Text>
          <Text style={styles.priceHeroAmount}>
            {inr(planPrice)} <Text style={styles.priceHeroPeriod}>/ year</Text>
          </Text>
          <Text style={styles.priceHeroSub}>{priceHeroSub}</Text>
        </View>
        ) : null}

        {showFullPurchase ? (
          <>
            <View style={styles.detailsSection}>
              <Text style={styles.detailsTitle}>Which car is this membership for?</Text>
              {isLoggedIn ? (
                <>
                  <VehiclePicker
                    title="Primary car"
                    options={primaryOptions}
                    selectedKey={primaryVehicleKey}
                    onSelect={onPrimaryVehicleKeyChange}
                  />
                  {primaryOptions.length === 0 ? (
                    <GuestCarSection form={guestForm} onChange={onGuestFormChange} includeProfileFields={false} />
                  ) : null}
                </>
              ) : (
                <GuestCarSection form={guestForm} onChange={onGuestFormChange} />
              )}
            </View>

            <TouchableOpacity
              style={[styles.addon, addSecondCar ? styles.addonActive : null]}
              onPress={() => onAddSecondCarChange(!addSecondCar)}
              activeOpacity={0.85}
            >
              <Ionicons name={addSecondCar ? 'checkbox' : 'square-outline'} size={20} color={addSecondCar ? COLORS.primary : '#9CA3AF'} />
              <View style={benefitIconStyles.wrap}>
                <MembershipBenefitIcon icon={addonIcon} iconUrl={addonIconUrl} size={14} />
              </View>
              <Text style={styles.addonText}>
                <Text style={styles.addonBold}>{addonTitle}</Text> — {addonDescription}
              </Text>
              <Text style={styles.addonPrice}>+{inr(addonPrice)}</Text>
            </TouchableOpacity>

            {addSecondCar ? (
              <Text style={styles.addonPeriodNote}>
                2nd car bhi primary car ke saath same date tak valid hogi — alag renewal nahi.
              </Text>
            ) : null}

            {addSecondCar ? renderSecondCarDetails(false) : null}

            <View style={styles.checkoutRow}>
              <Text style={styles.checkoutLabel}>Total payable</Text>
              <Text style={styles.checkoutAmount}>{inr(totalPay)}</Text>
            </View>

            <TouchableOpacity
              style={styles.cta}
              onPress={onActivate}
              disabled={activating}
              activeOpacity={0.9}
            >
              {activating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.ctaText}>Activate Prime — {inr(totalPay)} →</Text>
              )}
            </TouchableOpacity>
          </>
        ) : null}

        {canBuySecondCarAddon ? (
          <View style={styles.addonUpgradeSection}>
            <Text style={styles.addonUpgradeTitle}>Add 2nd Car to your membership</Text>
            <Text style={styles.addonUpgradeSub}>
              2nd car primary car ke saath same membership period mein chalegi
              {activeExpiry ? ` · valid until ${activeExpiry}` : ''}. Alag saal ki renewal nahi hogi.
            </Text>
            {renderSecondCarDetails(true)}
            <View style={styles.checkoutRow}>
              <Text style={styles.checkoutLabel}>2nd car add-on</Text>
              <Text style={styles.checkoutAmount}>{inr(addonPrice)}</Text>
            </View>
            <TouchableOpacity
              style={styles.ctaAddon}
              onPress={onBuySecondCarAddon}
              disabled={activating}
              activeOpacity={0.9}
            >
              {activating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.ctaText}>Add 2nd Car — {inr(addonPrice)} →</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}

        {isActive && hasSecondCarAddon && linkedSecondVehicle ? (
          <View style={styles.addonDoneBanner}>
            <Ionicons name="car-sport" size={18} color={COLORS.primary} />
            <Text style={styles.addonDoneText}>
              2nd car active: {linkedSecondVehicle.label}
              {linkedSecondVehicle.vehicle_number ? ` · ${linkedSecondVehicle.vehicle_number}` : ''}
              {activeExpiry ? ` · valid until ${activeExpiry}` : ''}
            </Text>
          </View>
        ) : null}

        <Text style={styles.foot}>{cardFooter}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  content: { paddingBottom: 24 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#023D95',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  header: {
    backgroundColor: '#023D95',
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: { flex: 1, paddingRight: 12 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  headerSub: { color: '#9ec3f0', fontSize: 12, fontStyle: 'italic', marginTop: 2 },
  crownWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  crownEmoji: { fontSize: 20 },
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#D1FAE5',
  },
  activeBannerText: { color: '#047857', fontSize: 12, fontWeight: '600', flex: 1 },
  linkedCarsSection: {
    marginHorizontal: 20,
    marginTop: 14,
    padding: 12,
    backgroundColor: '#F0F7FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    gap: 10,
  },
  linkedCarsHeading: { fontSize: 12, fontWeight: '800', color: '#023D95', letterSpacing: 0.3 },
  linkedCarsSub: { fontSize: 11, fontWeight: '600', color: '#475569', lineHeight: 16 },
  linkedCarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  linkedCarIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#E6F0FB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkedCarBody: { flex: 1 },
  linkedCarTitle: { fontSize: 10, fontWeight: '700', color: '#64748B', textTransform: 'uppercase' },
  linkedCarName: { fontSize: 14, fontWeight: '800', color: '#1A1A1A', marginTop: 1 },
  linkedCarPlate: { fontSize: 11, fontWeight: '600', color: '#475569', marginTop: 2 },
  linkedCarValid: { fontSize: 10, fontWeight: '600', color: '#047857', marginTop: 3 },
  linkedCarBadge: {
    backgroundColor: '#ECFDF5',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  linkedCarBadgeText: { fontSize: 9, fontWeight: '800', color: '#047857' },
  benefitsSection: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 6 },
  benefitsHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: '#f0f4f8',
    marginBottom: 4,
    gap: 8,
  },
  benefitsHeadText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, color: '#8A8A8A' },
  benefitsHeadLeft: { flex: 1 },
  bRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#f4f7fb',
  },
  bRowLast: { borderBottomWidth: 0 },
  bLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, flex: 1, paddingRight: 10 },
  bIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#E6F0FB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bTextWrap: { flex: 1 },
  bTitle: { fontSize: 12, fontWeight: '700', color: '#1A1A1A', lineHeight: 16 },
  bSub: { fontSize: 9.5, color: '#9A9A9A', marginTop: 1, lineHeight: 13 },
  bValueStack: { alignItems: 'flex-end' },
  bValuePrefix: { fontSize: 9, fontWeight: '600', color: '#64748B', lineHeight: 11 },
  bValue: { fontSize: 12, fontWeight: '800', color: '#023D95' },
  totalBand: {
    marginHorizontal: 20,
    marginTop: 6,
    backgroundColor: '#F2F6FC',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 13, color: '#555', fontWeight: '600' },
  totalValue: { fontSize: 18, fontWeight: '800', color: '#023D95' },
  totalStrike: { textDecorationLine: 'line-through', color: '#C0392B' },
  saveRow: {
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#c5d6ec',
    borderStyle: 'dashed',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  saveLabel: { fontSize: 13, fontWeight: '700', color: '#1f9d55' },
  saveValue: { fontSize: 18, fontWeight: '800', color: '#1f9d55' },
  priceHero: {
    marginHorizontal: 20,
    marginTop: 14,
    backgroundColor: '#023D95',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  priceHeroLabel: { fontSize: 11, letterSpacing: 1, color: 'rgba(255,255,255,0.85)' },
  priceHeroAmount: { fontSize: 34, fontWeight: '800', color: '#fff', marginTop: 2 },
  priceHeroPeriod: { fontSize: 16, fontWeight: '500', opacity: 0.85 },
  priceHeroSub: { fontSize: 11, color: '#9ec3f0', marginTop: 4, textAlign: 'center' },
  detailsSection: {
    marginHorizontal: 20,
    marginTop: 14,
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  detailsTitle: { fontSize: 13, fontWeight: '800', color: '#1A1A1A', marginBottom: 8 },
  vehicleBlock: { gap: 8 },
  vehicleBlockTitle: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 2 },
  vehicleHint: { fontSize: 12, color: '#64748B' },
  vehicleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#fff',
  },
  vehicleChipActive: { borderColor: COLORS.primary, backgroundColor: '#E6F0FB' },
  vehicleChipText: { flex: 1, fontSize: 12, color: '#334155', fontWeight: '600' },
  vehicleChipTextActive: { color: COLORS.primary },
  addVehicleBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  addVehicleBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: 12 },
  guestForm: { gap: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#fff',
    color: '#111',
  },
  addon: {
    marginHorizontal: 20,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  addonActive: { borderColor: COLORS.primary, backgroundColor: '#E8F2FF' },
  addonText: { flex: 1, fontSize: 12, color: '#555', lineHeight: 16 },
  addonBold: { fontWeight: '800', color: '#023D95' },
  addonPrice: { fontWeight: '800', color: '#023D95', fontSize: 13 },
  addonPeriodNote: {
    marginHorizontal: 20,
    marginTop: -4,
    marginBottom: 8,
    fontSize: 11,
    fontWeight: '600',
    color: '#047857',
    lineHeight: 16,
  },
  backLink: { marginBottom: 8 },
  backLinkText: { color: COLORS.primary, fontSize: 12, fontWeight: '700' },
  checkoutRow: {
    marginHorizontal: 20,
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  checkoutLabel: { fontSize: 14, color: '#64748B', fontWeight: '600' },
  checkoutAmount: { fontSize: 18, fontWeight: '800', color: '#111' },
  cta: {
    marginHorizontal: 20,
    marginTop: 12,
    backgroundColor: '#023D95',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaAddon: {
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 4,
    backgroundColor: '#023D95',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  addonUpgradeSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  addonUpgradeTitle: {
    marginHorizontal: 20,
    marginTop: 10,
    fontSize: 15,
    fontWeight: '800',
    color: '#023D95',
  },
  addonUpgradeSub: {
    marginHorizontal: 20,
    marginTop: 4,
    marginBottom: 4,
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
  },
  addonDoneBanner: {
    marginHorizontal: 20,
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E8F2FF',
    borderRadius: 12,
    padding: 12,
  },
  addonDoneText: { flex: 1, fontSize: 12, fontWeight: '600', color: '#023D95' },
  foot: {
    textAlign: 'center',
    fontSize: 9.5,
    color: '#AAA',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 18,
    lineHeight: 14,
  },
});
