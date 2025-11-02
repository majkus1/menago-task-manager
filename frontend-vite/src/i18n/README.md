# Internationalization (i18n) Setup

This project uses i18next for internationalization with support for Polish (pl) and English (en).

## Translation Keys Structure

All translations are organized in JSON files under `src/i18n/locales/`.

## Adding New Translations

1. Add the key to both `pl.json` and `en.json` with appropriate translations
2. Use the `useTranslation` hook in your component:
   ```typescript
   import { useTranslation } from 'react-i18next';
   
   const { t } = useTranslation();
   const text = t('your.translation.key');
   ```

## Files Structure

- `config.ts` - i18next configuration
- `locales/pl.json` - Polish translations
- `locales/en.json` - English translations

## Language Switcher

The language switcher component is in `components/LanguageSwitcher.tsx`.

