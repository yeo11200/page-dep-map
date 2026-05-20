import { SettingsForm } from './SettingsForm';

interface SettingsPageProps {
  userId: string;
  theme: string;
  locale: string;
  notifications: boolean;
}

export default function SettingsPage(props: SettingsPageProps) {
  return (
    <div>
      <h1>Settings</h1>
      <SettingsForm {...props} />
    </div>
  );
}
