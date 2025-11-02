import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import type { RegisterTeamDto } from '@/types';
import { Eye, EyeOff, Mail, Lock, User, Building } from 'lucide-react';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

const createRegisterSchema = (t: any) => z.object({
  teamName: z.string().min(1, t('auth.register.teamNameRequired')),
  teamDescription: z.string().optional(),
  firstName: z.string().min(1, t('auth.register.firstNameRequired')),
  lastName: z.string().min(1, t('auth.register.lastNameRequired')),
  email: z.string().email(t('auth.register.invalidEmail')),
  password: z.string().min(8, t('auth.register.passwordMinLength')),
});

type RegisterFormData = z.infer<ReturnType<typeof createRegisterSchema>>;

export function RegisterPage() {
  const { t } = useTranslation();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const registerSchema = createRegisterSchema(t);

  const {
    register: registerForm,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true);
    try {
      await register(data as RegisterTeamDto);
      navigate('/dashboard');
    } catch (error: any) {
      setError('root', {
        message: error.response?.data?.message || t('auth.register.registerError'),
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-end mb-2">
            <LanguageSwitcher />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            {t('auth.register.title')}
          </CardTitle>
          <CardDescription>
            {t('auth.register.subtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="teamName">{t('auth.register.teamName')}</Label>
              <div className="relative">
                <Building className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="teamName"
                  placeholder={t('auth.register.teamNamePlaceholder')}
                  className="pl-10"
                  {...registerForm('teamName')}
                />
              </div>
              {errors.teamName && (
                <p className="text-sm text-red-600">{errors.teamName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="teamDescription">{t('auth.register.teamDescription')} ({t('common.optional')})</Label>
              <Input
                id="teamDescription"
                placeholder={t('auth.register.teamDescriptionPlaceholder')}
                {...registerForm('teamDescription')}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">{t('auth.register.firstName')}</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="firstName"
                    placeholder={t('auth.register.firstNamePlaceholder')}
                    className="pl-10"
                    {...registerForm('firstName')}
                  />
                </div>
                {errors.firstName && (
                  <p className="text-sm text-red-600">{errors.firstName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">{t('auth.register.lastName')}</Label>
                <Input
                  id="lastName"
                  placeholder={t('auth.register.lastNamePlaceholder')}
                  {...registerForm('lastName')}
                />
                {errors.lastName && (
                  <p className="text-sm text-red-600">{errors.lastName.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{t('auth.register.email')}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder={t('auth.register.emailPlaceholder')}
                  className="pl-10"
                  {...registerForm('email')}
                />
              </div>
              {errors.email && (
                <p className="text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t('auth.register.password')}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('auth.register.passwordPlaceholder')}
                  className="pl-10 pr-10"
                  {...registerForm('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 h-4 w-4 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </button>
              </div>
              {errors.password && (
                <p className="text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>

            {errors.root && (
              <div className="text-sm text-red-600 text-center">
                {errors.root.message}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? t('auth.register.registering') : t('auth.register.registerButton')}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              {t('auth.register.hasAccount')}{' '}
              <Link
                to="/login"
                className="font-medium text-primary hover:text-primary/80"
              >
                {t('auth.register.login')}
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
