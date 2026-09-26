import { DocumentFormatterPage } from '../frontend/src/pages/DocumentFormatterPage';
import { UserSettingsProvider } from '../frontend/src/context/UserSettingsContext';

export default function App() {
  return (
    <UserSettingsProvider>
      <DocumentFormatterPage />
    </UserSettingsProvider>
  );
}
