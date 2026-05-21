# DEVICE_COMPATIBILITY.md — Device Compatibility

## 1. Primary Target Device Profile

The MPOS app is deployed on **mid-range Android handsets** used by retail store cashiers. Device selection is driven by cost (₹5,000–₹15,000 range) and availability in the Indian market.

| Parameter | Target |
|---|---|
| OS | Android 10+ (API Level 29+) |
| RAM | 2GB minimum, 3–4GB typical |
| Processor | Snapdragon 4xx, MediaTek Helio G series |
| Screen | 720×1560 (HD+), 5.5"–6.5" |
| Storage | 32GB+ |
| Camera | Single rear camera, minimum 8MP |

**iOS is secondary.** The app must function on iOS but is not the primary deployment target. iOS support is maintained for management staff who may use iPhones.

---

## 2. Android Version Support

| Android Version | API Level | Status |
|---|---|---|
| Android 10 | 29 | Minimum supported |
| Android 11 | 30 | Supported |
| Android 12 | 31 | Supported |
| Android 13 | 33 | Supported, primary test target |
| Android 14 | 34 | Supported |
| Android 15 | 35 | Supported (2025 devices) |
| Android 9 and below | < 29 | Not supported |

**React Native 0.84 minimum Android API:** 24 (Android 7). However, Vision Camera v4 requires Android API 26+. We set minimum to API 29 to ensure full feature support and avoid edge cases on old Android versions.

---

## 3. iOS Version Support

| iOS Version | Status |
|---|---|
| iOS 15+ | Supported |
| iOS 14 | Best-effort |
| iOS 13 and below | Not supported |

**React Native 0.84 minimum iOS:** 15.1.

---

## 4. Camera Hardware Requirements

Camera is the most critical hardware dependency. Vision Camera v4 requires:

- **Minimum:** Any camera that supports `Camera2 API` (Android) or `AVFoundation` (iOS)
- **Practically:** All Android devices from 2019 onwards

### Camera Capability Detection

```typescript
import { Camera, useCameraDevices } from 'react-native-vision-camera';

const devices = useCameraDevices();
const backCamera = devices.back;

if (!backCamera) {
  // Camera unavailable — show manual entry mode only
  setFallbackMode(true);
  return;
}

// Check for barcode scanning support
const formats = backCamera.formats;
const supportsBarcode = formats.some(f => f.supportedCodeTypes?.length > 0);
```

### Torch/Flash Support

Not all devices have a torch. Vision Camera handles this gracefully — setting `torch="on"` has no effect if hardware doesn't support it. Do not show the torch toggle if the device reports no flash:

```typescript
const torchAvailable = backCamera?.hasTorch ?? false;

{torchAvailable && (
  <TouchableOpacity onPress={toggleTorch}>
    <Icon name="flashlight" />
  </TouchableOpacity>
)}
```

---

## 5. Screen Size Handling

### Safe Area

Always use `react-native-safe-area-context` for screen-edge insets. Notches, punch-hole cameras, and navigation bars are common on modern Android devices.

```typescript
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

// Wrap root screen
<SafeAreaView style={{ flex: 1 }}>
  <QuickBillingHomePage />
</SafeAreaView>

// For precise inset control
const insets = useSafeAreaInsets();
<View style={{ paddingBottom: insets.bottom }}>
```

### Screen Dimension Awareness

```typescript
import { Dimensions, useWindowDimensions } from 'react-native';

// Prefer useWindowDimensions hook for responsive layouts
const { width, height } = useWindowDimensions();

// Adjust for different screen widths
const isSmallScreen = width < 360;  // Very small phones
const isMediumScreen = width >= 360 && width < 411;
const isLargeScreen = width >= 411;
```

### Keyboard Avoiding Behavior

When a keyboard opens (product search, customer name, phone), it must not obscure the cart or total:

```typescript
import { KeyboardAvoidingView, Platform } from 'react-native';

<KeyboardAvoidingView
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
  style={{ flex: 1 }}
>
  {/* Scrollable content */}
</KeyboardAvoidingView>
```

On Android, `behavior="height"` shrinks the view. On iOS, `behavior="padding"` adds padding. These behave differently — test on both platforms.

---

## 6. Permission Handling by Platform

### Android Permissions

```typescript
// AndroidManifest.xml — required permissions
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"
  android:maxSdkVersion="28" />
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.USE_BIOMETRIC" />
```

**Android 13+ (API 33+) storage permissions:**
`READ_EXTERNAL_STORAGE` and `WRITE_EXTERNAL_STORAGE` are deprecated on API 33+. Use granular media permissions:

```typescript
import { PERMISSIONS } from 'react-native-permissions';

const storagePermission = Platform.Version >= 33
  ? PERMISSIONS.ANDROID.READ_MEDIA_IMAGES
  : PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE;
```

### iOS Permissions (Info.plist)

```xml
<key>NSCameraUsageDescription</key>
<string>Camera is used for barcode scanning to add products</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>Photo library access is used for scanning barcodes from images</string>
```

---

## 7. Vision Camera v4 Platform Notes

### Android

- Requires `compileSdkVersion 34` (or latest)
- Frame processor plugin requires `react-native-worklets-core`
- Camera2 API is used internally — no additional Android config needed
- USB camera (OTG) is not supported by Vision Camera

### iOS

- AVFoundation is used internally
- Metal API required for frame processors (iOS 13+)
- Camera permission must include explicit description in Info.plist

### Known Vision Camera Issues on Budget Android

| Issue | Device Class | Workaround |
|---|---|---|
| Slow auto-focus | Low-end cameras | Tap-to-focus already handled by Vision Camera |
| Camera freezes after 30 min | Some MediaTek devices | Implement camera restart on freeze detection |
| High CPU usage | Old Snapdragon 4xx | Reduce frame rate or increase scan lock duration |
| Torch not releasing | Some devices | Ensure `torch="off"` on dialog close |

---

## 8. ML Kit Barcode Scanning Compatibility

`@react-native-ml-kit/barcode-scanning` v2.0.0 requires Google Play Services on Android.

**Devices without Google Play Services** (rare in India but possible with custom ROMs):
- ML Kit image-based scanning will not work
- Live scanning via Vision Camera is unaffected (native, no Play Services dependency)
- Fall back to manual barcode entry if Play Services unavailable

```typescript
// Check Play Services availability (add google-apis-client if needed)
// For most Indian retail devices, Play Services is always present
```

---

## 9. Network Conditions

Retail store internet connectivity in India ranges from fiber broadband to 4G hotspot to poor building connectivity.

| Scenario | Expected Behavior |
|---|---|
| Fast WiFi (50Mbps+) | All operations under target latency |
| 4G (10-20Mbps) | Normal operation, slight increase in API times |
| 3G or poor signal | Product search may be slow. Show loading indicator, not error. |
| No connectivity | Block checkout. Show "No internet" message. Cart preserved. |
| Intermittent connectivity | Retry with timeout. Show specific error per operation. |

**Timeout configuration** (`src/services/constants/config.ts`):
```typescript
export const TIMEOUTS = {
  DEFAULT: 10000,   // 10s — product search, customer search
  CHECKOUT: 15000,  // 15s — order placement (higher stakes)
  EBILL: 30000,     // 30s — WhatsApp delivery can be slow
};
```

---

## 10. Hardware Scanner Compatibility (Future)

Many retail environments use dedicated barcode scanner hardware:

| Scanner Type | Connection | Compatibility |
|---|---|---|
| Bluetooth HID scanner | Bluetooth | Emulates keyboard — supported via TextInput |
| USB HID scanner (OTG) | USB | Emulates keyboard — supported via TextInput |
| WiFi scanner | WiFi | Emulates keyboard — supported via TextInput |
| Camera-based scanner (built-in) | Internal | Handled by Vision Camera |

HID (Human Interface Device) scanners emulate a keyboard and send barcode digits followed by Enter. To support:
1. Keep a hidden `TextInput` focused in scan mode
2. Accumulate keystrokes until Enter received
3. Process accumulated string as barcode

This is a future enhancement — not in current scope.

---

## 11. Accessibility Hardware

| Feature | Status |
|---|---|
| Screen readers (TalkBack/VoiceOver) | Partial — accessibility labels on key actions |
| Large text mode | Supported — uses sp units, scales with system font size |
| High contrast mode | Not specifically tested |
| External keyboard | Supported via React Native TextInput |
| Switch access | Not tested |

---

## 12. Testing Device Matrix

Minimum test matrix for production releases:

| Device | Android Version | RAM | Priority |
|---|---|---|---|
| Redmi Note 12 (or equivalent) | Android 13 | 4GB | High |
| Realme C-series (or equivalent) | Android 12 | 3GB | High |
| Samsung Galaxy A-series (mid) | Android 13 | 4GB | High |
| iPhone 12 or later | iOS 17 | — | Medium |
| Budget Android (2GB RAM) | Android 10 | 2GB | Medium |
| Tablet (10") | Android 12 | 4GB | Low |
