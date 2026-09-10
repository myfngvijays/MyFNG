#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(MyFNGCallerId, NSObject)

RCT_EXTERN_METHOD(syncAuth:(NSString *)apiUrl token:(NSString *)token)
RCT_EXTERN_METHOD(setPendingCall:(NSDictionary *)map)
RCT_EXTERN_METHOD(clearPendingCall)
RCT_EXTERN_METHOD(setEnabled:(BOOL)enabled)
RCT_EXTERN_METHOD(requestOverlayPermission)
RCT_EXTERN_METHOD(preview)
RCT_EXTERN_METHOD(openIdentificationSettings)
RCT_EXTERN_METHOD(getStatus:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(syncDirectory:(NSArray *)entries
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

@end
