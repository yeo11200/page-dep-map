interface SettingsFormProps {
  userId: string;
  theme: string;
  locale: string;
  notifications: boolean;
}

export function SettingsForm({ userId, theme, locale, notifications }: SettingsFormProps) {
  return (
    <form>
      <input name="userId" defaultValue={userId} />
      <select name="theme" defaultValue={theme}>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
      <select name="locale" defaultValue={locale}>
        <option value="en">English</option>
        <option value="ko">Korean</option>
      </select>
      <label>
        <input type="checkbox" checked={notifications} readOnly />
        Notifications
      </label>
    </form>
  );
}
