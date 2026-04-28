// Pre-evaluate Expo's lazy global getters so accesses during Jest teardown
// don't trigger requires after the module loader has shut down. Without
// this, a benign teardown read of one of these globals throws "You are
// trying to import a file outside of the scope of the test code" and the
// suite reports failure even though all test bodies passed.
// See node_modules/expo/src/winter/runtime.native.ts for the install list.
for (const name of [
  "TextDecoder",
  "TextDecoderStream",
  "TextEncoderStream",
  "URL",
  "URLSearchParams",
  "__ExpoImportMetaRegistry",
  "structuredClone",
]) {
  try {
    void globalThis[name];
  } catch {
    // Ignore — we just want to trip the lazy getter.
  }
}
