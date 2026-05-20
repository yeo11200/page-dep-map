import { useContext } from 'react';
import { ThemeContext } from '@/contexts/theme';
import { SettingsPanel } from '@/components/common/SettingsPanel';

export default function SettingsPage() {
  const theme = useContext(ThemeContext);

  return (
    <div>
      <h1>Settings</h1>
      {theme === 'dark' ? (
        <SettingsPanel variant="dark" />
      ) : (
        <SettingsPanel variant="light" />
      )}
    </div>
  );
}
