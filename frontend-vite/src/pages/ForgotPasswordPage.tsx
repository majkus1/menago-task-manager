import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import type { ForgotPasswordDto } from '@/types';
import { Mail, ArrowLeft } from 'lucide-react';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

const createForgotPasswordSchema = (t: any) => z.object({
  email: z.string().email(t('auth.forgotPassword.invalidEmail')),
});

type ForgotPasswordFormData = z.infer<ReturnType<typeof createForgotPasswordSchema>>;

export function ForgotPasswordPage() {
  const { t, i18n } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const navigate = useNavigate();

  const forgotPasswordSchema = createForgotPasswordSchema(t);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setIsLoading(true);
    try {
      await apiClient.forgotPassword({
        ...data,
        language: i18n.language,
      } as ForgotPasswordDto);
      setIsSuccess(true);
    } catch (error: any) {
      // Backend always returns success for security, so this is mainly for network errors
      console.error('Error sending password reset:', error);
      // Still show success message to user
      setIsSuccess(true);
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-end mb-2">
              <LanguageSwitcher />
            </div>
            <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <Mail className="w-6 h-6 text-green-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900">
              {t('auth.forgotPassword.successTitle')}
            </CardTitle>
            <CardDescription>
              {t('auth.forgotPassword.successSubtitle')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-gray-600 text-center mb-6">
              <p className="mb-2">
                {t('auth.forgotPassword.successMessage1')}
              </p>
              <p>
                {t('auth.forgotPassword.successMessage2')}
              </p>
            </div>
            <Button className="w-full" onClick={() => navigate('/login')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t('auth.forgotPassword.backToLogin')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-end mb-2">
            <LanguageSwitcher />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            {t('auth.forgotPassword.title')}
          </CardTitle>
          <CardDescription>
            {t('auth.forgotPassword.subtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t('auth.forgotPassword.email')}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder={t('auth.forgotPassword.emailPlaceholder')}
                  className="pl-10"
                  {...register('email')}
                />
              </div>
              {errors.email && (
                <p className="text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? t('auth.forgotPassword.sending') : t('auth.forgotPassword.sendButton')}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link
              to="/login"
              className="text-sm font-medium text-blue-600 hover:text-blue-800 flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              {t('auth.forgotPassword.backToLogin')}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

