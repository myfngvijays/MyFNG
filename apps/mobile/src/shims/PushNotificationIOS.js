'use strict';

/**
 * Stub when NativePushNotificationManagerIOS is not in the dev client binary.
 * Prevents iOS crash: NativeEventEmitter requires a non-null argument.
 * App uses @react-native-firebase/messaging for push — not this legacy API.
 */
class PushNotificationIOSStub {
  static addEventListener() {
    return { remove() {} };
  }
  static removeEventListener() {}
  static requestPermissions() {
    return Promise.resolve({ alert: true, badge: true, sound: true });
  }
  static abandonPermissions() {}
  static checkPermissions(callback) {
    callback({ alert: 0, badge: 0, sound: 0 });
  }
  static presentLocalNotification() {}
  static scheduleLocalNotification() {}
  static cancelAllLocalNotifications() {}
  static removeAllDeliveredNotifications() {}
  static getDeliveredNotifications(callback) {
    callback([]);
  }
  static removeDeliveredNotifications() {}
  static setApplicationIconBadgeNumber() {}
  static getApplicationIconBadgeNumber(callback) {
    callback(0);
  }
  static cancelLocalNotifications() {}
  static getScheduledLocalNotifications(callback) {
    callback([]);
  }
  static getInitialNotification() {
    return Promise.resolve(null);
  }
  static fetchCompletionHandler() {}
}

module.exports = PushNotificationIOSStub;
module.exports.default = PushNotificationIOSStub;
