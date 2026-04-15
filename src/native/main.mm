#import <AVFoundation/AVFoundation.h>
#import <AppKit/AppKit.h>
#import <ApplicationServices/ApplicationServices.h>
#import <CoreGraphics/CoreGraphics.h>
#import <ServiceManagement/ServiceManagement.h>
#import <Speech/Speech.h>

#include <string>

#include "rpc.h"
#include "gen/permissions.rpc.h"
#include "gen/paste.rpc.h"
#include "gen/login_item.rpc.h"
#include "gen/builtin_speech.rpc.h"

using mo::rpc::Callback;

// ─── SystemPermissionsServiceImpl ────────────────────────────────────────────

class SystemPermissionsServiceImpl : public SystemPermissionsService {
 public:
  void GetPermissionsStatus(const google::protobuf::Empty* /*request*/,
                            Callback<PermissionsStatusResponse> done) override {
    PermissionsStatusResponse response;

    // Microphone
    auto* mic = response.add_permissions();
    mic->set_type("microphone");
    AVAuthorizationStatus micStatus =
        [AVCaptureDevice authorizationStatusForMediaType:AVMediaTypeAudio];
    mic->set_status(avAuthStatusString(micStatus));

    // Accessibility
    auto* acc = response.add_permissions();
    acc->set_type("accessibility");
    acc->set_status(AXIsProcessTrusted() ? "granted" : "denied");

    // Speech recognition
    auto* speech = response.add_permissions();
    speech->set_type("speechRecognition");
    SFSpeechRecognizerAuthorizationStatus speechStatus =
        [SFSpeechRecognizer authorizationStatus];
    speech->set_status(speechAuthStatusString(speechStatus));

    std::move(done).Complete(response);
  }

  void RequestPermission(const PermissionTypeRequest* request,
                         Callback<google::protobuf::Empty> done) override {
    const std::string& type = request->type();

    if (type == "microphone") {
      dispatch_semaphore_t sem = dispatch_semaphore_create(0);
      [AVCaptureDevice requestAccessForMediaType:AVMediaTypeAudio
                             completionHandler:^(BOOL /*granted*/) {
                               dispatch_semaphore_signal(sem);
                             }];
      dispatch_semaphore_wait(sem, DISPATCH_TIME_FOREVER);

    } else if (type == "speechRecognition") {
      // TODO: This crashes with SIGABRT because NSSpeechRecognitionUsageDescription
      // is absent from the app bundle. Chromium ships NSMicrophoneUsageDescription in
      // its localized InfoPlist.strings files (which is why mic works), but it does not
      // include NSSpeechRecognitionUsageDescription. macOS's TCC subsystem aborts the
      // process immediately when requestAuthorization: is called without that key.
      // Fix: inject NSSpeechRecognitionUsageDescription into the built Info.plist via
      // the MōBrowser build system (mechanism TBD).
      dispatch_semaphore_t sem = dispatch_semaphore_create(0);
      dispatch_async(dispatch_get_main_queue(), ^{
        [SFSpeechRecognizer requestAuthorization:^(SFSpeechRecognizerAuthorizationStatus /*status*/) {
          dispatch_semaphore_signal(sem);
        }];
      });
      dispatch_semaphore_wait(sem, DISPATCH_TIME_FOREVER);

    }

    std::move(done).Complete(google::protobuf::Empty{});
  }

  void OpenSystemSettings(const PermissionTypeRequest* request,
                          Callback<google::protobuf::Empty> done) override {
    const std::string& type = request->type();
    NSString* urlString = nil;

    if (type == "microphone") {
      urlString =
          @"x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone";
    } else if (type == "accessibility") {
      urlString =
          @"x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility";
    } else if (type == "speechRecognition") {
      urlString =
          @"x-apple.systempreferences:com.apple.preference.security?Privacy_SpeechRecognition";
    }

    if (urlString != nil) {
      [[NSWorkspace sharedWorkspace] openURL:[NSURL URLWithString:urlString]];
    }

    std::move(done).Complete(google::protobuf::Empty{});
  }

 private:
  static std::string avAuthStatusString(AVAuthorizationStatus status) {
    switch (status) {
      case AVAuthorizationStatusAuthorized:
        return "granted";
      case AVAuthorizationStatusDenied:
        return "denied";
      case AVAuthorizationStatusRestricted:
        return "denied";
      case AVAuthorizationStatusNotDetermined:
        return "notDetermined";
    }
    return "notDetermined";
  }

  static std::string speechAuthStatusString(
      SFSpeechRecognizerAuthorizationStatus status) {
    switch (status) {
      case SFSpeechRecognizerAuthorizationStatusAuthorized:
        return "granted";
      case SFSpeechRecognizerAuthorizationStatusDenied:
        return "denied";
      case SFSpeechRecognizerAuthorizationStatusRestricted:
        return "denied";
      case SFSpeechRecognizerAuthorizationStatusNotDetermined:
        return "notDetermined";
    }
    return "notDetermined";
  }
};

// ─── PasteServiceImpl ─────────────────────────────────────────────────────────

class PasteServiceImpl : public PasteService {
 public:
  void CaptureFrontmostApp(const google::protobuf::Empty* /*request*/,
                            Callback<CapturedAppResponse> done) override {
    CapturedAppResponse response;
    NSRunningApplication* frontmost =
        [[NSWorkspace sharedWorkspace] frontmostApplication];
    if (frontmost != nil) {
      if (frontmost.bundleIdentifier != nil) {
        response.set_bundle_id(frontmost.bundleIdentifier.UTF8String);
      }
      if (frontmost.localizedName != nil) {
        response.set_name(frontmost.localizedName.UTF8String);
      }
    }
    std::move(done).Complete(response);
  }

  void ActivateAndPaste(const ActivateRequest* request,
                        Callback<ActivateResult> done) override {
    ActivateResult result;
    NSString* bundleId =
        [NSString stringWithUTF8String:request->bundle_id().c_str()];

    NSArray<NSRunningApplication*>* apps =
        [NSRunningApplication runningApplicationsWithBundleIdentifier:bundleId];
    if (apps.count == 0) {
      result.set_success(false);
      result.set_error_code("APP_NOT_RUNNING");
      std::move(done).Complete(result);
      return;
    }

    NSRunningApplication* app = apps.firstObject;
    [app activateWithOptions:NSApplicationActivateIgnoringOtherApps];

    // Allow the target app time to come to the foreground before synthesising
    // the keystroke. 100 ms is empirically sufficient on modern macOS.
    usleep(100000);

    // Synthesize Cmd+V (virtual key code 9 = 'v').
    CGEventRef keyDown = CGEventCreateKeyboardEvent(nullptr, 9, true);
    CGEventSetFlags(keyDown, kCGEventFlagMaskCommand);
    CGEventPost(kCGHIDEventTap, keyDown);
    CFRelease(keyDown);

    CGEventRef keyUp = CGEventCreateKeyboardEvent(nullptr, 9, false);
    CGEventSetFlags(keyUp, kCGEventFlagMaskCommand);
    CGEventPost(kCGHIDEventTap, keyUp);
    CFRelease(keyUp);

    result.set_success(true);
    std::move(done).Complete(result);
  }
};

// ─── LoginItemServiceImpl ─────────────────────────────────────────────────────

class LoginItemServiceImpl : public LoginItemService {
 public:
  void SetLaunchAtLogin(const BoolRequest* request,
                        Callback<google::protobuf::Empty> done) override {
    SMAppService* service = [SMAppService mainAppService];
    NSError* error = nil;
    if (request->value()) {
      [service registerAndReturnError:&error];
    } else {
      [service unregisterAndReturnError:&error];
    }
    // Errors are not surfaced to the caller — the main process logs them
    // and the preference value is still persisted. The worst case is that
    // the login-item state does not change, which the user can retry.
    std::move(done).Complete(google::protobuf::Empty{});
  }
};

// ─── BuiltinSpeechServiceImpl ─────────────────────────────────────────────────

class BuiltinSpeechServiceImpl : public BuiltinSpeechService {
 public:
  void RunBuiltinSpeechRecognition(const SpeechRequest* request,
                                   Callback<SpeechResponse> done) override {
    // Build the recogniser. An explicit locale is used when language is set.
    SFSpeechRecognizer* recognizer = nil;
    const std::string& language = request->language();
    if (!language.empty()) {
      NSLocale* locale = [NSLocale
          localeWithLocaleIdentifier:[NSString
                                         stringWithUTF8String:language.c_str()]];
      recognizer = [[SFSpeechRecognizer alloc] initWithLocale:locale];
    } else {
      recognizer = [[SFSpeechRecognizer alloc] init];
    }

    if (recognizer == nil || !recognizer.isAvailable) {
      SpeechResponse response;
      std::move(done).Complete(response);
      return;
    }

    // Reconstruct an AVAudioPCMBuffer from the raw Float32 PCM bytes.
    // Input format: 16 kHz, mono, 32-bit float (little-endian).
    const std::string& pcmBytes = request->pcm();
    NSUInteger sampleCount = pcmBytes.size() / sizeof(float);

    AVAudioFormat* format = [[AVAudioFormat alloc]
        initWithCommonFormat:AVAudioPCMFormatFloat32
                  sampleRate:16000.0
                    channels:1
                 interleaved:NO];

    AVAudioPCMBuffer* buffer =
        [[AVAudioPCMBuffer alloc] initWithPCMFormat:format
                                      frameCapacity:(AVAudioFrameCount)sampleCount];
    buffer.frameLength = (AVAudioFrameCount)sampleCount;
    memcpy(buffer.floatChannelData[0], pcmBytes.data(), pcmBytes.size());

    SFSpeechAudioBufferRecognitionRequest* speechRequest =
        [[SFSpeechAudioBufferRecognitionRequest alloc] init];
    [speechRequest appendAudioPCMBuffer:buffer];
    [speechRequest endAudio];

    // Block the calling thread with a semaphore. The RPC handler runs on a
    // worker thread managed by the MōBrowser runtime, not on the main thread,
    // so blocking here does not freeze the UI.
    dispatch_semaphore_t semaphore = dispatch_semaphore_create(0);
    __block std::string transcribedText;

    [recognizer recognitionTaskWithRequest:speechRequest
                             resultHandler:^(SFSpeechRecognitionResult* result,
                                            NSError* error) {
                               if (result.isFinal || error != nil) {
                                 if (result != nil) {
                                   transcribedText =
                                       result.bestTranscription.formattedString
                                           .UTF8String;
                                 }
                                 dispatch_semaphore_signal(semaphore);
                               }
                             }];

    // 30-second hard timeout — avoids blocking forever on empty/silent audio.
    dispatch_semaphore_wait(
        semaphore,
        dispatch_time(DISPATCH_TIME_NOW, 30 * NSEC_PER_SEC));

    SpeechResponse response;
    response.set_text(transcribedText);
    std::move(done).Complete(response);
  }
};

// ─── Registration ─────────────────────────────────────────────────────────────

void launch() {
  mo::rpc::RegisterService(new SystemPermissionsServiceImpl());
  mo::rpc::RegisterService(new PasteServiceImpl());
  mo::rpc::RegisterService(new LoginItemServiceImpl());
  mo::rpc::RegisterService(new BuiltinSpeechServiceImpl());
}
