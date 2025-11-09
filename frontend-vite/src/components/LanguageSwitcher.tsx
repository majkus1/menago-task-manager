import { useTranslation } from 'react-i18next';
import { Button } from './ui/Button';
import { Globe } from 'lucide-react';

export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const toggleLanguage = () => {
    const current = (i18n.language || '').toLowerCase();
    const isPolish = current.startsWith('pl');
    const newLang = isPolish ? 'en' : 'pl';
    i18n.changeLanguage(newLang);
  };

  const current = (i18n.language || '').toLowerCase();
  const isPolish = current.startsWith('pl');
  const nextLang = isPolish ? 'en' : 'pl';

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleLanguage}
      className="flex items-center gap-2"
      title={isPolish ? 'Switch to English' : 'Przełącz na polski'}
    >
      <Globe className="w-4 h-4" />
      <span className="font-medium">{nextLang.toUpperCase()}</span>
    </Button>
  );
}

