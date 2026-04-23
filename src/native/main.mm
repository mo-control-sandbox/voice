#import <AVFoundation/AVFoundation.h>
#import <AppKit/AppKit.h>
#import <ApplicationServices/ApplicationServices.h>
#import <CoreGraphics/CoreGraphics.h>
#import <Speech/Speech.h>

#include <string>

#include "rpc.h"
#include "gen/clipboard.rpc.h"
#include "gen/permissions.rpc.h"

using mo::rpc::Callback;

// ─── Helpers ──────────────────────────────────────────────────────────────────

static PermissionStatus avAuthStatus(AVAuthorizationStatus s) {
  switch (s) {
    case AVAuthorizationStatusAuthorized:    return PERMISSION_STATUS_GRANTED;
    case AVAuthorizationStatusDenied:        return PERMISSION_STATUS_DENIED;
    case AVAuthorizationStatusRestricted:    return PERMISSION_STATUS_DENIED;
    case AVAuthorizationStatusNotDetermined: return PERMISSION_STATUS_NOT_DETERMINED;
  }
  return PERMISSION_STATUS_NOT_DETERMINED;
}

static PermissionStatus sfAuthStatus(SFSpeechRecognizerAuthorizationStatus s) {
  switch (s) {
    case SFSpeechRecognizerAuthorizationStatusAuthorized:    return PERMISSION_STATUS_GRANTED;
    case SFSpeechRecognizerAuthorizationStatusDenied:        return PERMISSION_STATUS_DENIED;
    case SFSpeechRecognizerAuthorizationStatusRestricted:    return PERMISSION_STATUS_DENIED;
    case SFSpeechRecognizerAuthorizationStatusNotDetermined: return PERMISSION_STATUS_NOT_DETERMINED;
  }
  return PERMISSION_STATUS_NOT_DETERMINED;
}

static PermissionStatus axAuthStatus() {
  auto isTrusted = []() -> bool {
    NSDictionary* options = @{
      (__bridge NSString*)kAXTrustedCheckOptionPrompt: @NO,
    };
    return AXIsProcessTrustedWithOptions((__bridge CFDictionaryRef)options);
  };

  if ([NSThread isMainThread]) {
    return isTrusted() ? PERMISSION_STATUS_GRANTED : PERMISSION_STATUS_DENIED;
  }

  __block bool trusted = false;
  dispatch_sync(dispatch_get_main_queue(), ^{
    trusted = isTrusted();
  });
  return trusted ? PERMISSION_STATUS_GRANTED : PERMISSION_STATUS_DENIED;
}

// ─── SystemPermissionsServiceImpl ────────────────────────────────────────────

class SystemPermissionsServiceImpl : public SystemPermissionsService {
 public:
  // Returns the current authorisation status for microphone, speech
  // recognition, and accessibility (Cmd+V simulation requires it).
  void GetPermissionsStatus(const google::protobuf::Empty* /*request*/,
                            Callback<PermissionsStatusResponse> done) override {
    PermissionsStatusResponse response;

    auto* mic = response.add_permissions();
    mic->set_type(PERMISSION_TYPE_MICROPHONE);
    mic->set_status(avAuthStatus(
        [AVCaptureDevice authorizationStatusForMediaType:AVMediaTypeAudio]));

    auto* speech = response.add_permissions();
    speech->set_type(PERMISSION_TYPE_SPEECH_RECOGNITION);
    speech->set_status(sfAuthStatus([SFSpeechRecognizer authorizationStatus]));

    auto* acc = response.add_permissions();
    acc->set_type(PERMISSION_TYPE_ACCESSIBILITY);
    acc->set_status(axAuthStatus());

    std::move(done).Complete(response);
  }

  // Opens the relevant System Settings pane so the user can grant the
  // permission themselves. The x-apple.systempreferences: URL scheme is
  // supported on macOS 13+.
  void OpenSystemSettings(const PermissionTypeRequest* request,
                          Callback<google::protobuf::Empty> done) override {
    openSystemSettings(request->type());
    std::move(done).Complete(google::protobuf::Empty{});
  }

  // Triggers the system permission prompt for microphone or speech
  // recognition. For accessibility there is no programmatic request path;
  // we open System Settings instead.
  //
  // NOTE: Speech recognition requires NSSpeechRecognitionUsageDescription
  // in the app's Info.plist. Without it macOS TCC will terminate the process.
  void RequestPermission(const PermissionTypeRequest* request,
                         Callback<google::protobuf::Empty> done) override {
    switch (request->type()) {
      case PERMISSION_TYPE_MICROPHONE:
        requestMicrophonePermission();
        break;
      case PERMISSION_TYPE_SPEECH_RECOGNITION:
        requestSpeechPermission();
        break;
      case PERMISSION_TYPE_ACCESSIBILITY:
        requestAccessibilityPermission();
        break;
      default:
        break;
    }

    std::move(done).Complete(google::protobuf::Empty{});
  }

 private:
  static NSArray<NSString*>* settingsPaneUrls(PermissionType type) {
    switch (type) {
      case PERMISSION_TYPE_MICROPHONE:
        return @[
          @"x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension",
          @"x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_Microphone",
          @"x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone"
        ];
      case PERMISSION_TYPE_SPEECH_RECOGNITION:
        return @[
          @"x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension",
          @"x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_SpeechRecognition",
          @"x-apple.systempreferences:com.apple.preference.security?Privacy_SpeechRecognition"
        ];
      case PERMISSION_TYPE_ACCESSIBILITY:
        return @[
          @"x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension",
          @"x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_Accessibility",
          @"x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"
        ];
      default:
        return nil;
    }
  }

  static void openSystemSettings(PermissionType type) {
    NSArray<NSString*>* urls = settingsPaneUrls(type);
    if (urls == nil || urls.count == 0) return;

    dispatch_async(dispatch_get_main_queue(), ^{
      for (NSUInteger i = 0; i < urls.count; i++) {
        dispatch_after(
            dispatch_time(DISPATCH_TIME_NOW, static_cast<int64_t>(i * 150 * NSEC_PER_MSEC)),
            dispatch_get_main_queue(), ^{
              NSURL* url = [NSURL URLWithString:urls[i]];
              if (url != nil) {
                [[NSWorkspace sharedWorkspace] openURL:url];
              }
            });
      }
    });
  }

  static void requestAccessibilityPermission() {
    auto requestPrompt = []() -> bool {
      NSDictionary* options = @{
        (__bridge NSString*)kAXTrustedCheckOptionPrompt: @YES,
      };
      return AXIsProcessTrustedWithOptions((__bridge CFDictionaryRef)options);
    };

    __block bool isTrusted = false;
    if ([NSThread isMainThread]) {
      isTrusted = requestPrompt();
    } else {
      dispatch_sync(dispatch_get_main_queue(), ^{
        isTrusted = requestPrompt();
      });
    }

    if (!isTrusted) {
      openSystemSettings(PERMISSION_TYPE_ACCESSIBILITY);
    }
  }

  // Blocks the calling (background RPC) thread until the system shows the
  // microphone prompt and the user responds.
  static void requestMicrophonePermission() {
    dispatch_semaphore_t sem = dispatch_semaphore_create(0);
    [AVCaptureDevice
        requestAccessForMediaType:AVMediaTypeAudio
               completionHandler:^(BOOL /*granted*/) {
                 dispatch_semaphore_signal(sem);
               }];
    dispatch_semaphore_wait(sem, DISPATCH_TIME_FOREVER);
  }

  // Blocks the calling (background RPC) thread until the speech recognition
  // authorisation dialog is dismissed. The requestAuthorization: callback runs
  // on the main queue, so this must not be called from the main thread.
  //
  // TODO: NSSpeechRecognitionUsageDescription must be present in Info.plist or
  // macOS TCC will terminate the process on this call. MōBrowser does not yet
  // expose a way to inject custom Info.plist keys. Re-test once that is possible.
  static void requestSpeechPermission() {
    // Guard: macOS TCC hard-kills the process if this key is absent. Skip the
    // request rather than crash; the status will remain notDetermined.
    NSString* usageDesc = [[NSBundle mainBundle]
        objectForInfoDictionaryKey:@"NSSpeechRecognitionUsageDescription"];
    if (usageDesc == nil) return;

    dispatch_semaphore_t sem = dispatch_semaphore_create(0);
    [SFSpeechRecognizer
        requestAuthorization:^(SFSpeechRecognizerAuthorizationStatus /*s*/) {
          dispatch_semaphore_signal(sem);
        }];
    dispatch_semaphore_wait(sem, DISPATCH_TIME_FOREVER);
  }
};

// ─── AutomationServiceImpl ─────────────────────────────────────────────────────

class AutomationServiceImpl : public AutomationService {
 public:
  // Synthesises Cmd+V into the current frontmost app.
  //
  // Requires the Accessibility permission (AXIsProcessTrusted) so that
  // CGEventPost() is allowed to deliver keystrokes to other processes.
  void Paste(const google::protobuf::Empty* /*request*/,
             Callback<google::protobuf::Empty> done) override {
    // Virtual key code 9 = 'v' on all Apple keyboards.
    CGEventRef down = CGEventCreateKeyboardEvent(nullptr, 9, true);
    CGEventSetFlags(down, kCGEventFlagMaskCommand);
    CGEventPost(kCGHIDEventTap, down);
    CFRelease(down);

    CGEventRef up = CGEventCreateKeyboardEvent(nullptr, 9, false);
    CGEventSetFlags(up, kCGEventFlagMaskCommand);
    CGEventPost(kCGHIDEventTap, up);
    CFRelease(up);

    std::move(done).Complete(google::protobuf::Empty{});
  }
};

// ─── Registration ─────────────────────────────────────────────────────────────

void launch() {
  mo::rpc::RegisterService(new SystemPermissionsServiceImpl());
  mo::rpc::RegisterService(new AutomationServiceImpl());
}
