#import <AVFoundation/AVFoundation.h>
#import <AppKit/AppKit.h>
#import <ApplicationServices/ApplicationServices.h>
#import <CoreGraphics/CoreGraphics.h>
#import <QuartzCore/QuartzCore.h>
#import <Speech/Speech.h>

#include <string>

#include "rpc.h"
#include "gen/clipboard.rpc.h"
#include "gen/frontmost_app.rpc.h"
#include "gen/permissions.rpc.h"
#include "gen/recording_overlay.rpc.h"

using mo::rpc::Callback;

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

  const bool trusted = isTrusted();
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

    const bool isTrusted = requestPrompt();

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
  // Writes text to the macOS system pasteboard (NSPasteboard) and synthesises
  // Cmd+V into the current frontmost app.
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

// ─── FrontmostAppServiceImpl ───────────────────────────────────────────────────

class FrontmostAppServiceImpl : public FrontmostAppService {
 public:
  // Records the currently frontmost application into an AppSnapshot so that
  // focus can be restored after the recording overlay has been dismissed.
  void SnapshotFrontmostApp(const google::protobuf::Empty* /*request*/,
                            Callback<AppSnapshot> done) override {
    AppSnapshot snapshot;

    @autoreleasepool {
      NSRunningApplication* frontApp = [[NSWorkspace sharedWorkspace] frontmostApplication];
      if (frontApp) {
        NSString* bundleId = frontApp.bundleIdentifier ?: @"";
        NSString* appName = frontApp.localizedName ?: @"";
        pid_t pid = frontApp.processIdentifier;

        snapshot.set_bundle_id([bundleId UTF8String]);
        snapshot.set_app_name([appName UTF8String]);
        snapshot.set_process_id(static_cast<int32_t>(pid));
      }
    }

    std::move(done).Complete(snapshot);
  }

  // Reactivates the application recorded in the snapshot, preferring the exact
  // process by PID and falling back to any process with the same bundle ID.
  void RestoreFrontmostApp(const AppSnapshot* snapshot,
                           Callback<RestoreResult> done) override {
    RestoreResult result;

    @autoreleasepool {
      NSString* bundleId = [NSString stringWithUTF8String:snapshot->bundle_id().c_str()];
      NSArray<NSRunningApplication*>* apps =
          [NSRunningApplication runningApplicationsWithBundleIdentifier:bundleId];

      if (apps.count > 0) {
        NSRunningApplication* targetApp = nil;

        for (NSRunningApplication* app in apps) {
          if (app.processIdentifier == snapshot->process_id()) {
            targetApp = app;
            break;
          }
        }

        if (!targetApp) {
          targetApp = apps.firstObject;
        }

        if (targetApp) {
          [targetApp activateWithOptions:NSApplicationActivateIgnoringOtherApps];
          result.set_success(true);
        } else {
          result.set_success(false);
          result.set_error("Application not found");
        }
      } else {
        result.set_success(false);
        result.set_error("No running application with bundle ID: " + snapshot->bundle_id());
      }
    }

    std::move(done).Complete(result);
  }
};

// ─── RecordingOverlay ─────────────────────────────────────────────────────────

static const CGFloat kOverlayWidth        = 148.0;
static const CGFloat kOverlayHeight       = 36.0;
static const CGFloat kOverlayCornerRadius = kOverlayHeight / 2.0;
static const CGFloat kDotDiameter         = 10.0;
static const CGFloat kDotLeft             = 14.0;
static const CGFloat kDotTextGap          = 8.0;

@interface RecordingOverlayPanel : NSPanel
@end

@implementation RecordingOverlayPanel
- (BOOL)canBecomeKeyWindow  { return NO; }
- (BOOL)canBecomeMainWindow { return NO; }
@end

@interface RecordingOverlayView : NSView
- (void)setPhase:(NSString*)phase;
@end

@implementation RecordingOverlayView {
  CAShapeLayer* _dotLayer;
  NSTextField*  _label;
}

- (instancetype)initWithFrame:(NSRect)frame {
  self = [super initWithFrame:frame];
  if (!self) return nil;
  self.wantsLayer = YES;
  [self buildDotLayer];
  [self buildLabel];
  return self;
}

- (void)buildDotLayer {
  CGFloat dotY    = (kOverlayHeight - kDotDiameter) / 2.0;
  CGRect  dotRect = CGRectMake(kDotLeft, dotY, kDotDiameter, kDotDiameter);

  _dotLayer = [CAShapeLayer layer];
  CGPathRef path = CGPathCreateWithEllipseInRect(dotRect, NULL);
  _dotLayer.path = path;
  CGPathRelease(path);

  _dotLayer.fillColor    = [NSColor colorWithRed:1.0 green:0.22 blue:0.22 alpha:1.0].CGColor;
  _dotLayer.shadowColor  = [NSColor colorWithRed:1.0 green:0.22 blue:0.22 alpha:1.0].CGColor;
  _dotLayer.shadowRadius  = 4.0;
  _dotLayer.shadowOpacity = 0.85;
  _dotLayer.shadowOffset  = CGSizeZero;
  [self.layer addSublayer:_dotLayer];
}

- (void)buildLabel {
  CGFloat textX     = kDotLeft + kDotDiameter + kDotTextGap;
  CGFloat textWidth = kOverlayWidth - textX - kDotLeft;

  _label = [NSTextField labelWithString:@"Listening\u2026"];
  _label.font      = [NSFont systemFontOfSize:13.0 weight:NSFontWeightMedium];
  _label.textColor = [NSColor whiteColor];
  [_label sizeToFit];
  NSSize sz = _label.frame.size;
  _label.frame = NSMakeRect(textX, (kOverlayHeight - sz.height) / 2.0, textWidth, sz.height);
  [self addSubview:_label];
}

- (void)drawRect:(NSRect)__unused dirtyRect {
  NSBezierPath* pill = [NSBezierPath bezierPathWithRoundedRect:self.bounds
                                                       xRadius:kOverlayCornerRadius
                                                       yRadius:kOverlayCornerRadius];
  [[NSColor colorWithRed:0.11 green:0.11 blue:0.11 alpha:0.90] setFill];
  [pill fill];
}

/*
 * Switches the visual state. "recording" shows a pulsing red dot and
 * "Listening..."; "processing" shows a steady dot and "Transcribing...".
 */
- (void)setPhase:(NSString*)phase {
  BOOL isProcessing = [phase isEqualToString:@"processing"];

  _label.stringValue = isProcessing ? @"Transcribing\u2026" : @"Listening\u2026";

  if (isProcessing) {
    [_dotLayer removeAnimationForKey:@"pulse-opacity"];
    [_dotLayer removeAnimationForKey:@"pulse-radius"];
    _dotLayer.shadowOpacity = 0.5;
    _dotLayer.shadowRadius  = 4.0;
  } else {
    CABasicAnimation* opacity = [CABasicAnimation animationWithKeyPath:@"shadowOpacity"];
    opacity.fromValue         = @(0.45);
    opacity.toValue           = @(1.0);
    opacity.duration          = 1.1;
    opacity.autoreverses      = YES;
    opacity.repeatCount       = INFINITY;
    opacity.timingFunction    = [CAMediaTimingFunction functionWithName:kCAMediaTimingFunctionEaseInEaseOut];
    [_dotLayer addAnimation:opacity forKey:@"pulse-opacity"];

    CABasicAnimation* radius  = [CABasicAnimation animationWithKeyPath:@"shadowRadius"];
    radius.fromValue          = @(2.0);
    radius.toValue            = @(9.0);
    radius.duration           = 1.1;
    radius.autoreverses       = YES;
    radius.repeatCount        = INFINITY;
    radius.timingFunction     = [CAMediaTimingFunction functionWithName:kCAMediaTimingFunctionEaseInEaseOut];
    [_dotLayer addAnimation:radius forKey:@"pulse-radius"];
  }
}

@end

// Panel and view are created once on first Show() and reused for the app lifetime.
static RecordingOverlayPanel* gOverlayPanel = nil;
static RecordingOverlayView*  gOverlayView  = nil;

static void RecordingOverlay_CreateIfNeeded() {
  if (gOverlayPanel) return;

  NSScreen* screen = [NSScreen mainScreen] ?: [NSScreen screens].firstObject;
  NSRect visible   = screen ? screen.visibleFrame : NSMakeRect(0, 0, 1440, 900);
  NSRect full      = screen ? screen.frame        : NSMakeRect(0, 0, 1440, 900);

  CGFloat x = NSMidX(full) - kOverlayWidth / 2.0;
  CGFloat y = visible.origin.y + 20.0; // 20 px above the Dock

  NSWindowStyleMask style =
      NSWindowStyleMaskBorderless | NSWindowStyleMaskNonactivatingPanel;

  gOverlayPanel = [[RecordingOverlayPanel alloc]
      initWithContentRect:NSMakeRect(x, y, kOverlayWidth, kOverlayHeight)
                styleMask:style
                  backing:NSBackingStoreBuffered
                    defer:NO
                   screen:screen];

  gOverlayPanel.backgroundColor = [NSColor clearColor];
  gOverlayPanel.opaque          = NO;
  gOverlayPanel.hasShadow       = NO;
  [gOverlayPanel setLevel:NSFloatingWindowLevel];
  [gOverlayPanel setCollectionBehavior:
      NSWindowCollectionBehaviorCanJoinAllSpaces |
      NSWindowCollectionBehaviorStationary       |
      NSWindowCollectionBehaviorIgnoresCycle];
  [gOverlayPanel setIgnoresMouseEvents:YES];

  gOverlayView = [[RecordingOverlayView alloc]
      initWithFrame:NSMakeRect(0, 0, kOverlayWidth, kOverlayHeight)];
  gOverlayPanel.contentView = gOverlayView;
}

class RecordingOverlayServiceImpl : public RecordingOverlayService {
 public:
  // Shows the floating overlay. Phase "recording" pulses the dot and shows
  // "Listening..."; phase "processing" shows a steady dot and "Transcribing...".
  void Show(const RecordingOverlayPhase* request,
            Callback<google::protobuf::Empty> done) override {
    std::string phase = request->phase();
    dispatch_async(dispatch_get_main_queue(), ^{
      RecordingOverlay_CreateIfNeeded();
      [gOverlayView setPhase:[NSString stringWithUTF8String:phase.c_str()]];
      [gOverlayPanel orderFrontRegardless];
    });
    std::move(done).Complete(google::protobuf::Empty{});
  }

  // Hides the overlay.
  void Hide(const google::protobuf::Empty* /*request*/,
            Callback<google::protobuf::Empty> done) override {
    dispatch_async(dispatch_get_main_queue(), ^{
      [gOverlayPanel orderOut:nil];
    });
    std::move(done).Complete(google::protobuf::Empty{});
  }
};

// ─── Registration ─────────────────────────────────────────────────────────────

void launch() {
  mo::rpc::RegisterService(new SystemPermissionsServiceImpl());
  mo::rpc::RegisterService(new AutomationServiceImpl());
  mo::rpc::RegisterService(new FrontmostAppServiceImpl());
  mo::rpc::RegisterService(new RecordingOverlayServiceImpl());
}
