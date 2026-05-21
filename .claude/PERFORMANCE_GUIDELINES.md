# PERFORMANCE_GUIDELINES.md — Performance Guidelines

## 1. Performance Philosophy

The MPOS app runs on mid-range Android handsets. Performance is not optional — it is a product requirement. A cashier using this app serves customers continuously for 8-hour shifts. Every frame drop, every unnecessary re-render, every sluggish list scroll degrades real-world productivity.

**Performance targets:**

| Metric | Target | Critical Path |
|---|---|---|
| Barcode scan recognition | < 50ms | Yes |
| Product lookup API response | < 300ms | Yes |
| End-to-end scan → cart add | < 500ms | Yes |
| Cart list scroll FPS | 60fps | Yes |
| App cold start | < 3 seconds | Yes |
| Checkout modal open | < 100ms | Yes |
| Search results appear | < 300ms (after debounce) | No |
| RefreshCart response | < 1 second | No |
| E-bill delivery | < 5 seconds | No |

---

## 2. React Native Performance Fundamentals

### JS Bridge vs Native Thread

React Native renders on the JS thread but paints on the main (UI) thread. Heavy JS work blocks rendering. Keep the JS thread free for user interactions.

**Rules:**
- Never perform synchronous heavy computation in render paths
- Use `InteractionManager.runAfterInteractions()` for non-critical post-render work
- Offload image processing and barcode analysis to native modules (Vision Camera does this)

### Hermes Engine

This app uses Hermes (React Native 0.84 default). Hermes pre-compiles JS to bytecode at build time, reducing startup time. Hermes is always enabled — do not disable it.

---

## 3. FlatList Performance (CartTable)

The cart list is the most frequently re-rendered component. Every product add, quantity change, or price update triggers a cart state change.

### Critical FlatList Props

```typescript
<FlatList
  data={cartItems}
  keyExtractor={(item) => String(item.id)}  // Stable key, not index
  renderItem={({ item }) => <CartRow item={item} {...} />}

  // Performance props — ALL REQUIRED:
  removeClippedSubviews={true}    // Unmount off-screen rows
  maxToRenderPerBatch={10}        // Render 10 items per batch
  windowSize={5}                  // Keep 5 viewports of items in memory
  initialNumToRender={8}          // Render 8 items on first paint
  updateCellsBatchingPeriod={50}  // Batch updates every 50ms
  getItemLayout={(_, index) => ({  // Only if fixed row height
    length: CART_ROW_HEIGHT,
    offset: CART_ROW_HEIGHT * index,
    index,
  })}
/>
```

### Memoize CartRow

```typescript
const CartRow = React.memo(({ item, onQuantityChange, onRemove }: CartRowProps) => {
  // Row only re-renders when its own item changes
  return (
    <View>
      <Text>{item.name}</Text>
      {/* ... */}
    </View>
  );
}, (prev, next) => {
  // Custom comparison — only re-render on actual item changes
  return (
    prev.item.quantity === next.item.quantity &&
    prev.item.netPrice === next.item.netPrice &&
    prev.item.id === next.item.id
  );
});
```

### Stable Callback References for CartRow

```typescript
// In CartContext or parent component
const onQuantityChange = useCallback((id: string | number, qty: number) => {
  updateQuantity(id, qty);
}, [updateQuantity]);  // updateQuantity must be memoized in CartContext

const onRemove = useCallback((id: string | number) => {
  removeFromCart(id);
}, [removeFromCart]);
```

Without `useCallback`, new function references on every render cause all CartRows to re-render.

---

## 4. Barcode Scanner Performance

### Frame Processing

Vision Camera processes frames on a native thread. The `useCodeScanner` hook uses VisionCamera's built-in frame processor which runs natively. Do NOT add additional JS-side frame processing.

```typescript
// GOOD — native frame processing
const codeScanner = useCodeScanner({
  codeTypes: ['ean-13', 'ean-8', 'upc-a', 'upc-e', 'code-128', 'qr'],
  onCodeScanned: (codes) => {
    // This runs on JS thread — keep it minimal
    if (scanLockRef.current) return;
    handleScan(codes[0]);
  },
});

// BAD — JS-side frame processing
const frameProcessor = useFrameProcessor((frame) => {
  'worklet';
  // Heavy JS worklet = frame drops
}, []);
```

### Scan Lock Performance

The scan lock (500ms) prevents duplicate API calls. The lock check is a ref comparison — O(1), no performance cost.

```typescript
// Lock check is a single boolean ref read — negligible cost
if (scanLockRef.current) return;
```

### Camera Deactivation

When the BarcodeDialog is not visible, the camera MUST be inactive:

```typescript
<Camera
  isActive={dialogVisible}  // Deactivate when closed
  // ...
/>
```

An active camera with no visible UI still processes frames, consuming CPU, battery, and RAM.

---

## 5. Search Debounce

Product search fires on every keystroke without debounce — a 10-character search word would trigger 10 API calls.

```typescript
// src/hooks/useDebounce.ts
export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

// In QuickBillingSearchBar
const debouncedQuery = useDebounce(searchQuery, 300);

useEffect(() => {
  if (debouncedQuery.length < 2) return;
  searchProducts(debouncedQuery);
}, [debouncedQuery]);
```

**300ms is the minimum.** Do not reduce below 200ms.

---

## 6. AsyncStorage Performance

AsyncStorage is async — it's backed by SQLite on Android. It's fast but not instantaneous.

### Never await AsyncStorage in render

```typescript
// WRONG — blocks rendering
const Component = () => {
  const [data, setData] = useState(null);
  const d = await AsyncStorage.getItem('key');  // Can't do this in render
  // ...
};

// CORRECT — useEffect
useEffect(() => {
  AsyncStorage.getItem('key').then(setData);
}, []);
```

### Batch AsyncStorage operations

```typescript
// WRONG — multiple sequential reads
const token = await AsyncStorage.getItem('AccessToken');
const orgName = await AsyncStorage.getItem('orgName');
const storeName = await AsyncStorage.getItem('storeName');

// CORRECT — parallel reads
const [token, orgName, storeName] = await AsyncStorage.multiGet([
  'AccessToken', 'orgName', 'storeName'
]).then(results => results.map(([, value]) => value));
```

### Debounce cart writes

Cart changes trigger AsyncStorage writes. On rapid quantity changes (e.g., incrementing by tapping), writes should be debounced:

```typescript
const saveCartDebounced = useMemo(
  () => debounce((items: CartItem[]) => saveCart(items), 300),
  []
);

useEffect(() => {
  if (!cartLoaded) return;
  saveCartDebounced(cartItems);
}, [cartItems]);
```

---

## 7. Image Performance

### Product images in cart or search results

If product images are loaded, use:

```typescript
// FastImage for better caching than default Image
// Consider adding: react-native-fast-image
import FastImage from 'react-native-fast-image';

<FastImage
  source={{ uri: product.imageUrl, priority: FastImage.priority.normal }}
  style={{ width: 40, height: 40 }}
  resizeMode={FastImage.resizeMode.contain}
/>
```

`react-native-fast-image` is not in current dependencies. Add if product images are displayed.

### Placeholder images

Always show a placeholder (`src/assets/noImage.png`) while remote images load. Never show blank space.

---

## 8. Modal and Animation Performance

### Use `useNativeDriver: true` for all animations

```typescript
Animated.timing(drawerAnim, {
  toValue: 0,
  duration: 250,
  useNativeDriver: true,  // Runs on UI thread, no JS bottleneck
}).start();
```

Without `useNativeDriver: true`, animations run through the JS bridge and can drop frames.

### Avoid animating layout properties

```typescript
// BAD — triggers layout recalculation on every frame
Animated.timing(height, { toValue: 300, useNativeDriver: false }).start();

// GOOD — translation runs entirely on UI thread
Animated.timing(translateY, { toValue: 0, useNativeDriver: true }).start();
```

Layout properties (height, width, padding, margin) cannot use `useNativeDriver: true`. Use translate/opacity instead.

### Modal re-render prevention

```typescript
// Memoize expensive modal content
const CheckoutModal = React.memo(QuickBillingCheckout);

// Use stable references for modal callbacks
const handleOrderComplete = useCallback(() => { ... }, []);
```

---

## 9. Memory Management

### Camera cleanup

Vision Camera frame processors hold references to native buffers. The camera component must unmount (not just hide) when the dialog closes:

```typescript
// CORRECT — camera component unmounts
{showBarcodeDialog && <BarcodeDialog />}

// WRONG — camera stays mounted, still processing frames
<BarcodeDialog visible={showBarcodeDialog} />
```

### Large cart performance

A cart with 50+ items is unusual but possible for bulk purchase. FlatList with `removeClippedSubviews` handles this. Beyond 100 items, consider virtualization with fixed row heights.

### Memory pressure on long sessions

Cashiers run the app for 8+ hours. Watch for:
- Event listener leaks (add and forget cleanup in `useEffect`)
- Timer leaks (clear `setTimeout`/`setInterval` in cleanup)
- Subscription leaks (unsubscribe from any pub/sub patterns)

```typescript
// Pattern: always return cleanup from useEffect
useEffect(() => {
  const subscription = SomeEventEmitter.addListener('event', handler);
  return () => subscription.remove();
}, []);
```

---

## 10. Network Performance

### Request timeout configuration

```typescript
// Default: 10 seconds
// E-bill: 30 seconds (WhatsApp integration can be slow)
// Never: no timeout (hanging request blocks UX indefinitely)
```

### Parallel requests where safe

At checkout open, multiple data fetches happen:

```typescript
// WRONG — sequential fetches
const upiId = await getUpiId();
const gst = await getGst();
const refreshedCart = await refreshCart(cartItems);

// CORRECT — parallel fetches
const [upiId, gst, refreshedCart] = await Promise.all([
  getUpiId(),
  getGst(),
  refreshCart(cartItems),
]);
```

`refreshCart` depends on the cart items but not on UPI or GST — run them in parallel.

### Response data minimization

Product search can return large payloads if the backend sends all product fields. Request only needed fields if the backend supports field filtering. The `CartItem` interface has many optional fields — validate that the backend isn't sending unnecessary data.

---

## 11. Startup Performance

App cold start sequence:

```
JS bundle load (Hermes bytecode)        ~200ms
React tree init + AuthProvider mount    ~100ms
AsyncStorage reads (token, cart, tabs)  ~50ms
Network: verifyAuth()                   ~200-500ms (network dependent)
First render of billing screen          ~100ms
Total target: < 3 seconds
```

**Optimization opportunities:**
- Render the billing screen shell immediately, show loading state for async data
- Do not await verifyAuth() before rendering — render with `isLoading: true` state
- Cart hydration shows empty list with `cartLoaded: false` indicator, not blank screen

---

## 12. Android-Specific Performance

### ProGuard rules

React Native production builds use ProGuard. Ensure these classes are not obfuscated:

```proguard
# ML Kit
-keep class com.google.mlkit.** { *; }
-keep class com.google.android.gms.** { *; }

# Vision Camera
-keep class com.mrousavy.camera.** { *; }

# Async Storage
-keep class com.reactnativecommunity.asyncstorage.** { *; }
```

### Low-memory devices (2GB RAM)

On 2GB RAM devices:
- Do not load all product category images upfront
- Limit product search results display to 20 items (add "Show more" if needed)
- Camera resolution for scanning: use `'low'` preset if high resolution causes issues

```typescript
<Camera
  photo={false}
  video={false}
  // Use device's native resolution for scanning
  // Don't request 4K — unnecessary for barcodes
/>
```

### CPU thermal throttling

After 15+ minutes of continuous camera use, CPU may throttle on budget devices. Symptom: scan recognition slows to > 200ms. If reported:
- Add a 30-second camera idle timeout that deactivates the camera until the user taps again
- Show thermal indicator if `Camera.getCameraPermissionStatus` reports unusual latency
