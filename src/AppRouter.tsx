import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { App } from './App';
import { I18nProvider } from './i18n/context';
import { detectDefaultLocale, isLocale } from './i18n/types';

function LocaleApp() {
  const { locale } = useParams();
  if (!locale || !isLocale(locale)) {
    return <Navigate to={`/${detectDefaultLocale()}`} replace />;
  }
  return (
    <I18nProvider locale={locale}>
      <App />
    </I18nProvider>
  );
}

export function AppRouter() {
  const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || undefined;
  return (
    <BrowserRouter basename={basename}>
      <Routes>
        <Route index element={<Navigate to={`/${detectDefaultLocale()}`} replace />} />
        <Route path=":locale/*" element={<LocaleApp />} />
        <Route path="*" element={<Navigate to={`/${detectDefaultLocale()}`} replace />} />
      </Routes>
    </BrowserRouter>
  );
}
