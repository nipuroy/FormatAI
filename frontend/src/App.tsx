import { DocumentFormatterPage } from './pages/DocumentFormatterPage';
import { UserSettingsProvider } from './context/UserSettingsContext';

export default function App() {
  return (
    <UserSettingsProvider>
      <DocumentFormatterPage />
    </UserSettingsProvider>
  );
}
