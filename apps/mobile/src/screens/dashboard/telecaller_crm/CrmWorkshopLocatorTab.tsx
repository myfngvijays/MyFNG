import React from 'react';
import { View, StyleSheet } from 'react-native';
import PublicWorkshopLocatorScreen from '../../PublicWorkshopLocatorScreen';

type Props = {
  navigation: any;
};

/** CRM tab wrapper — workshop locator without public pill nav. */
export default function CrmWorkshopLocatorTab({ navigation }: Props) {
  return (
    <View style={styles.wrap}>
      <PublicWorkshopLocatorScreen navigation={navigation} route={{ params: {} }} embedded />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, minHeight: 0 },
});
