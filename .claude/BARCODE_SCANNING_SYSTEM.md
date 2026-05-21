# BARCODE_SCANNING_SYSTEM.md — Barcode Scanning System

## 1. Why React Native Scanning

The MPOS app exists primarily because of barcode scanning. Web-based barcode scanning solutions (via WebRTC or third-party paid services) were either cost-prohibitive, had high latency, or had poor accuracy on low-end Android devices. React Native with Vision Camera provides:

- Native frame processing (no JS bridge bottleneck for frame analysis)
- Sub-50ms scan recognition in good lighting
- Works offline (no cloud barcode API)
- Full torch/flash control
- Works on ₹5,000-₹15,000 Android handsets used in retail

---

## 2. Scanning Stack

| Component | Library | Version | Role |
|---|---|---|---|
| Camera capture | react-native-vision-camera | 4.7.3 | Live camera frames |
| Frame analysis | useCodeScanner (VisionCamera built-in) | — | Barcode detection |
| Image scanning | @react-native-ml-kit/barcode-scanning | 2.0.0 | Gallery image fallback |
| Permissions | react-native-permissions | 5.5.1 | Camera permission gate |
| Frame worklets | react-native-worklets-core | 1.6.3 | Vision Camera dependency |

---

## 3. Supported Barcode Formats

| Format | Use Case |
|---|---|
| EAN-13 | Standard retail product barcodes (India primary) |
| EAN-8 | Small package products |
| UPC-A | International products |
| UPC-E | Compressed UPC |
| CODE-128 | Variable-length alphanumeric barcodes |
| QR Code | Digital barcodes, special promotions |

**Configuration in BarcodeDialog:**

```typescript
const codeScanner = useCodeScanner({
  codeTypes: ['ean-13', 'ean-8', 'upc-a', 'upc-e', 'code-128', 'qr'],
  onCodeScanned: (codes) => handleScan(codes),
});
```

---

## 4. Scan Architecture

### 4.1 BarcodeDialog Component

Location: `src/components/sections/home-page/BarcodeDialog.tsx` (~1075 lines)

**State machine:**

```
ScanState:
  'idle'       — camera active, waiting for barcode
  'scanning'   — barcode detected, lock active
  'processing' — API call in progress
  'success'    — product found and added
  'error'      — product not found or API failure
```

**Scan lock mechanism (critical):**

Without scan lock, Vision Camera fires `onCodeScanned` multiple times per second for the same barcode. This causes duplicate product additions.

```typescript
const scanLockRef = useRef(false);

const handleScan = useCallback((codes: Code[]) => {
  if (scanLockRef.current) return;  // lock active, ignore
  if (!codes.length) return;

  scanLockRef.current = true;       // engage lock
  const rawBarcode = codes[0].value;
  processBarcode(rawBarcode);

  setTimeout(() => {
    scanLockRef.current = false;    // release lock after 500ms
  }, 500);
}, []);
```

**Why 500ms:** Sufficient time for API round trip on local network. Too short = duplicate triggers. Too long = missed intentional rapid scans (unlikely in retail).

### 4.2 Barcode Normalization

Some barcode formats include a suffix indicating store or variant:

```typescript
const normalizedBarcode = rawBarcode.split('ST')[0];
```

This strips the store-specific `ST` suffix before API lookup. This normalization must happen before every API call. Never send raw barcode values to the backend.

**Edge cases:**
- Barcode with no `ST` suffix: `split('ST')[0]` returns the full string — safe.
- Barcode containing `ST` mid-string: Will incorrectly truncate. This is an existing known behavior. Investigate if barcode format can contain `ST` in product code portion.

### 4.3 Product Lookup

```typescript
const products = await productService.getMultipleProducts([normalizedBarcode]);

if (products.length === 0) {
  setScanState('error');
  showToast('Product not found');
  scanLockRef.current = false;  // release lock immediately on not-found
  return;
}

if (products.length === 1) {
  CartContext.addToCart(products[0]);
  setScanState('success');
  closeDialog();
  return;
}

// Multiple products: show selection UI
setProductSuggestions(products);
setScanState('idle');
```

**Auto-close on success:** Dialog closes automatically when a single product is found and added. This keeps the flow fast — cashier doesn't need to manually dismiss.

**Multiple results:** A barcode returning multiple products indicates variant grouping (same base barcode, different sizes). Show a selection list.

---

## 5. Camera Initialization and Lifecycle

### 5.1 Permission Flow

```typescript
import { Camera } from 'react-native-vision-camera';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';

const requestCameraPermission = async () => {
  const permission = Platform.OS === 'ios'
    ? PERMISSIONS.IOS.CAMERA
    : PERMISSIONS.ANDROID.CAMERA;

  const status = await check(permission);

  if (status === RESULTS.GRANTED) {
    setCameraReady(true);
    return;
  }

  if (status === RESULTS.DENIED) {
    const result = await request(permission);
    setCameraReady(result === RESULTS.GRANTED);
    return;
  }

  if (status === RESULTS.BLOCKED) {
    // Show "Go to Settings" prompt
    showSettingsPrompt();
  }
};
```

Request permission on first BarcodeDialog mount. Cache result in component state. Do NOT request on app start.

### 5.2 Camera Component

```typescript
<Camera
  ref={cameraRef}
  style={styles.camera}
  device={device}
  isActive={isDialogVisible && scanState !== 'processing'}
  codeScanner={codeScanner}
  torch={torchEnabled ? 'on' : 'off'}
  enableZoomGesture
/>
```

**`isActive` control:** Camera must be deactivated when dialog is closed or during processing to prevent background frame processing and battery drain.

### 5.3 Device Selection

```typescript
const devices = useCameraDevices();
const device = devices.back;  // always use back camera for scanning
```

Front camera is never used for barcode scanning. If `device` is null (very rare), show "Camera unavailable" state.

### 5.4 Cleanup

Vision Camera cleans up frame processors on component unmount automatically. Ensure BarcodeDialog unmounts (not just hides) when closed to release camera resources.

```typescript
// In QuickBillingHomePage
{showBarcodeDialog && (
  <BarcodeDialog
    onClose={() => setShowBarcodeDialog(false)}
    // ...
  />
)}
```

Conditional rendering (`&&`) ensures unmount on close. Do NOT use `visible` prop patterns that keep the component mounted.

---

## 6. Torch Control

```typescript
const [torchEnabled, setTorchEnabled] = useState(false);

// Toggle button in BarcodeDialog UI
<TouchableOpacity onPress={() => setTorchEnabled(prev => !prev)}>
  <Icon name={torchEnabled ? 'flashlight-on' : 'flashlight-off'} />
</TouchableOpacity>
```

**Default: off.** Torch drains battery. Cashier enables manually in dark environments.

**Torch limitation:** Not available on all devices. Vision Camera handles this gracefully — `torch` prop has no effect if hardware doesn't support it.

---

## 7. Image-Based Scanning (Fallback)

For damaged barcodes or when the customer provides a printed image:

```typescript
import { launchImageLibrary } from 'react-native-image-picker';
import BarcodeScanning from '@react-native-ml-kit/barcode-scanning';

const handleImagePick = async () => {
  const result = await launchImageLibrary({ mediaType: 'photo' });
  if (!result.assets?.length) return;

  const imageUri = result.assets[0].uri;
  const barcodes = await BarcodeScanning.scan(imageUri);

  if (barcodes.length) {
    const rawBarcode = barcodes[0].rawValue;
    await processBarcode(rawBarcode);
  } else {
    showToast('No barcode found in image');
  }
};
```

**Limitations:**
- Image scanning is ~2-5x slower than live scanning
- Accuracy depends on image quality and lighting
- Only first detected barcode is used if multiple found

---

## 8. Manual Barcode Entry

Always available as the final fallback:

```typescript
const [manualBarcode, setManualBarcode] = useState('');

const handleManualEntry = async () => {
  if (!manualBarcode.trim()) return;
  await processBarcode(manualBarcode.trim());
  setManualBarcode('');
};
```

**Keyboard type:** `numeric` if only numeric barcodes expected. `default` otherwise (CODE-128 can include letters).

---

## 9. Performance Characteristics

| Metric | Target | Notes |
|---|---|---|
| Scan recognition latency | < 50ms | Vision Camera native frame processing |
| API round trip (product lookup) | < 300ms | Local network to backend |
| End-to-end (scan → cart add) | < 500ms | Scan recognition + API + render |
| Camera init time | < 1 second | Device dependent |
| Image scan (gallery) | < 2 seconds | ML Kit processing |

**Frame rate:** Vision Camera uses 30fps by default for code scanning. Higher FPS does not improve scan accuracy meaningfully and increases CPU usage. Keep at default.

**CPU throttling note:** On devices with aggressive CPU throttling (common in Indian mid-range devices), continuous camera frame processing may slow after 10-15 minutes. Monitor for thermal throttling. If observed, reduce frame rate or pause scanning when idle.

---

## 10. Error Scenarios and Recovery

| Error | Cause | Recovery |
|---|---|---|
| Camera permission denied | User denied | Show Settings deeplink prompt |
| Camera hardware unavailable | Device issue | Fall back to manual entry mode |
| No barcode detected | Poor lighting, damaged barcode | Suggest torch, image upload, manual entry |
| Product not found (valid barcode) | Product not in catalog | Show "not found" toast, keep scanner open |
| API timeout on product lookup | Network slow | Show toast, release scan lock, allow retry |
| Duplicate scan trigger | Scan lock gap | Scan lock (500ms) prevents this |
| Invalid barcode format | Non-product QR | Ignore non-product QR codes silently |

**Scan lock release on error:** When product lookup fails (not found, network error), release the scan lock immediately so cashier can retry without waiting 500ms.

---

## 11. Security Considerations

- Camera permission is not requested until needed (privacy-preserving)
- No camera frames are persisted to disk or transmitted
- Barcode values are only sent to the configured backend (`mpos.apeirosai.com`), never third-party services
- Image-based scanning processes locally via ML Kit (no cloud API)
- Manual barcode input is sanitized before API call (trim whitespace, no shell injection risk as value goes into JSON body)

---

## 12. Future Improvements

| Enhancement | Approach |
|---|---|
| Haptic feedback on scan | `react-native-haptic-feedback` on successful scan |
| Audible beep on scan | `react-native-sound` with a short beep file |
| Scan history | Keep last 10 scanned barcodes for quick re-add |
| Continuous scanning mode | Re-scan after 2 seconds instead of dialog close |
| Bluetooth scanner support | Listen for hardware keyboard events (HID scanner emulates keyboard) |
| AR product overlay | Vision Camera Frame Processor plugin for real-time overlay |

### Bluetooth/USB Hardware Scanner Support

Retail stores may have hardware barcode scanners (Zebra, Honeywell) that connect via Bluetooth or USB and emulate a keyboard. To support these:

```typescript
// Hardware scanners send barcode as rapid keystrokes + Enter
// Use a hidden TextInput that captures these events
const hiddenInputRef = useRef<TextInput>(null);

useEffect(() => {
  // Auto-focus the hidden input to capture HID scanner keystrokes
  hiddenInputRef.current?.focus();
}, [isDialogVisible]);
```

This requires investigation of `react-native-hid-keyboard` or similar libraries.
