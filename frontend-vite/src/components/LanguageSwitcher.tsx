import { useTranslation } from 'react-i18next';
import { Button } from './ui/Button';
import { Globe } from 'lucide-react';

export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const toggleLanguage = () => {
    const newLang = i18n.language === 'pl' ? 'en' : 'pl';
    i18n.changeLanguage(newLang);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleLanguage}
      className="flex items-center gap-2"
      title={i18n.language === 'pl' ? 'Switch to English' : 'Przełącz na Polski'}
    >
      <Globe className="w-4 h-4" />
      <span className="font-medium">{i18n.language.toUpperCase()}</span>
    </Button>
  );
}

