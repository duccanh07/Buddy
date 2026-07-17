import React, { Suspense, lazy } from 'react';

const PetWindow = lazy(() => import('../pet/components/PetWindow'));
const SettingsWindow = lazy(() => import('../settings/SettingsWindow'));

/**
 * App routes to the correct window component based on the URL query param.
 * Tauri opens windows with ?window=pet or ?window=settings.
 */
const App: React.FC = () => {
  const params = new URLSearchParams(window.location.search);
  const windowType = params.get('window') ?? 'pet';

  return (
    <Suspense fallback={null}>
      {windowType === 'settings' ? <SettingsWindow /> : <PetWindow />}
    </Suspense>
  );
};

export default App;
