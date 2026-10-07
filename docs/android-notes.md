# Android notes

Capacitor Android project is scaffolded (`android/`) but **not buildable on this
machine** — no JDK/Android SDK. To build later:

1. Install JDK 17 (Temurin) + Android Studio (or command-line tools only:
   `sdkmanager "platforms;android-34" "build-tools;34.0.0"`), set
   `JAVA_HOME` and `ANDROID_HOME`.
2. `npm run build && npx cap sync android`
3. Open in Android Studio (`npx cap open android`) and run on a device.

## Mic permission

`AndroidManifest.xml` needs:

```xml
<uses-permission android:name="android.permission.RECORD_AUDIO" />
```

plus a runtime request before `getUserMedia` — WebView only surfaces the mic
if the permission is granted at the OS level. Capacitor 6+ gates WebView
getUserMedia behind an explicit bridge call; either use the
`@capacitor-community/media` plugin or a tiny custom plugin that calls
`WebChromeClient.onPermissionRequest`.

## Secure context

`getUserMedia` requires a secure context. Capacitor serves from
`https://localhost` by default (scheme rewrite); do not switch to plain `http`.

## Models

Do NOT bundle the ~210MB of wasm+models into the APK assets. Options:

- First-run downloader (Java plugin fetching from GitHub releases into
  `Context.getFilesDir()`, then pointing the app at those paths), or
- Ship the wasm `.data` files as downloadable content on first launch with a
  progress screen (the loader already caches in IndexedDB, so this is a one-time
  cost per install, per OriginPrivateFileSystem if migrated).

## Memory

The ASR wasm bundle is large; on low-memory devices enable
`android:largeHeap="true"` in the application tag if needed.
