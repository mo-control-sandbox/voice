#import <AppKit/AppKit.h>
#import <CoreGraphics/CoreGraphics.h>
#import <QuartzCore/QuartzCore.h>

#include <string>

#include "rpc.h"
#include "gen/clipboard.rpc.h"
#include "gen/frontmost_app.rpc.h"
#include "gen/recording_overlay.rpc.h"

using mo::rpc::Callback;

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
  mo::rpc::RegisterService(new AutomationServiceImpl());
  mo::rpc::RegisterService(new FrontmostAppServiceImpl());
  mo::rpc::RegisterService(new RecordingOverlayServiceImpl());
}
