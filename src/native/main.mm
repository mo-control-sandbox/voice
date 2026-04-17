#import <AVFoundation/AVFoundation.h>
#import <AppKit/AppKit.h>
#import <ApplicationServices/ApplicationServices.h>
#import <CoreGraphics/CoreGraphics.h>
#import <Speech/Speech.h>

#include <string>

#include "rpc.h"
#include "gen/builtin_speech.rpc.h"
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
    acc->set_status(AXIsProcessTrusted() ? PERMISSION_STATUS_GRANTED : PERMISSION_STATUS_DENIED);

    std::move(done).Complete(response);
  }

  // Opens the relevant System Settings pane so the user can grant the
  // permission themselves. The x-apple.systempreferences: URL scheme is
  // supported on macOS 13+.
  void OpenSystemSettings(const PermissionTypeRequest* request,
                          Callback<google::protobuf::Empty> done) override {
    NSString* url = settingsPaneUrl(request->type());
    if (url != nil) {
      [[NSWorkspace sharedWorkspace] openURL:[NSURL URLWithString:url]];
    }
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
      case PERMISSION_TYPE_ACCESSIBILITY: {
        NSString* url = settingsPaneUrl(request->type());
        if (url != nil) {
          [[NSWorkspace sharedWorkspace] openURL:[NSURL URLWithString:url]];
        }
        break;
      }
      default:
        break;
    }

    std::move(done).Complete(google::protobuf::Empty{});
  }

 private:
  static NSString* settingsPaneUrl(PermissionType type) {
    switch (type) {
      case PERMISSION_TYPE_MICROPHONE:
        return @"x-apple.systempreferences:com.apple.preference.security"
                "?Privacy_Microphone";
      case PERMISSION_TYPE_SPEECH_RECOGNITION:
        return @"x-apple.systempreferences:com.apple.preference.security"
                "?Privacy_SpeechRecognition";
      case PERMISSION_TYPE_ACCESSIBILITY:
        return @"x-apple.systempreferences:com.apple.preference.security"
                "?Privacy_Accessibility";
      default:
        return nil;
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

// ─── BuiltinSpeechServiceImpl ─────────────────────────────────────────────────

class BuiltinSpeechServiceImpl : public BuiltinSpeechService {
 public:
  // Transcribes raw 16 kHz mono Float32 PCM audio using SFSpeechRecognizer.
  // Blocks the calling thread until recognition completes or the 30-second
  // hard timeout elapses.
  void RunBuiltinSpeechRecognition(const SpeechRequest* request,
                                   Callback<SpeechResponse> done) override {
    SFSpeechRecognizer* recognizer = buildRecognizer(request->language());

    if (recognizer == nil || !recognizer.isAvailable) {
      std::move(done).Complete(SpeechResponse{});
      return;
    }

    AVAudioPCMBuffer* buffer = buildPcmBuffer(request->pcm());
    if (buffer == nil) {
      std::move(done).Complete(SpeechResponse{});
      return;
    }

    SFSpeechAudioBufferRecognitionRequest* speechReq =
        [[SFSpeechAudioBufferRecognitionRequest alloc] init];
    speechReq.requiresOnDeviceRecognition = YES;
    [speechReq appendAudioPCMBuffer:buffer];
    [speechReq endAudio];

    dispatch_semaphore_t sem = dispatch_semaphore_create(0);
    __block std::string text;

    [recognizer
        recognitionTaskWithRequest:speechReq
                     resultHandler:^(SFSpeechRecognitionResult* result,
                                     NSError* /*error*/) {
                       if (result.isFinal) {
                         text = result.bestTranscription.formattedString
                                    .UTF8String;
                         dispatch_semaphore_signal(sem);
                       }
                     }];

    dispatch_semaphore_wait(
        sem, dispatch_time(DISPATCH_TIME_NOW, 30 * NSEC_PER_SEC));

    SpeechResponse response;
    response.set_text(text);
    std::move(done).Complete(response);
  }

 private:
  static SFSpeechRecognizer* buildRecognizer(const std::string& language) {
    if (language.empty()) {
      return [[SFSpeechRecognizer alloc] init];
    }
    NSLocale* locale = [NSLocale
        localeWithLocaleIdentifier:[NSString
                                       stringWithUTF8String:language.c_str()]];
    return [[SFSpeechRecognizer alloc] initWithLocale:locale];
  }

  // Wraps raw Float32 PCM bytes (16 kHz, mono) in an AVAudioPCMBuffer.
  static AVAudioPCMBuffer* buildPcmBuffer(const std::string& pcmBytes) {
    NSUInteger frameCount = pcmBytes.size() / sizeof(float);
    if (frameCount == 0) return nil;

    AVAudioFormat* format =
        [[AVAudioFormat alloc] initWithCommonFormat:AVAudioPCMFormatFloat32
                                         sampleRate:16000.0
                                           channels:1
                                        interleaved:NO];
    AVAudioPCMBuffer* buffer =
        [[AVAudioPCMBuffer alloc] initWithPCMFormat:format
                                      frameCapacity:(AVAudioFrameCount)frameCount];
    buffer.frameLength = (AVAudioFrameCount)frameCount;
    memcpy(buffer.floatChannelData[0], pcmBytes.data(), pcmBytes.size());
    return buffer;
  }
};

// ─── Registration ─────────────────────────────────────────────────────────────

void launch() {
  mo::rpc::RegisterService(new SystemPermissionsServiceImpl());
  mo::rpc::RegisterService(new AutomationServiceImpl());
  mo::rpc::RegisterService(new BuiltinSpeechServiceImpl());
}
