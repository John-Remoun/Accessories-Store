import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { store } from '../../services/store';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Eye, EyeOff } from 'lucide-react';
import darkLogo from '../../assets/dark-logo.png';
import lightLogo from '../../assets/light-logo.png';

export const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await login(username, password);
    if (success) {
      const loggedUser = store.getUserByUsername(username);
      if (loggedUser && loggedUser.role !== 'admin') {
        navigate('/pos');
      } else {
        navigate('/dashboard');
      }
    } else {
      setError('اسم المستخدم أو كلمة المرور غير صحيحة!');
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background relative overflow-hidden p-4" dir="rtl">
      {/* Ambient Gradients */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-secondary/10 rounded-full blur-3xl pointer-events-none" />

      {/* Centered Login Card */}
      <div className="w-full max-w-md bg-card/95 backdrop-blur-md border border-border shadow-2xl rounded-3xl p-8 sm:p-10 relative z-10 animate-in fade-in zoom-in-95 duration-300">
        <div className="flex flex-col items-center text-center mb-6">
          <img src={darkLogo} alt="Salla Bola & Mina" className="hidden dark:block h-28 sm:h-32 w-auto object-contain mb-3 drop-shadow-md" />
          <img src={lightLogo} alt="Salla Bola & Mina" className="block dark:hidden h-28 sm:h-32 w-auto object-contain mb-3 drop-shadow-md" />
          <p className="text-xs text-muted-foreground font-semibold tracking-wide">متجر الإكسسوارات</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="username" className="text-xs font-bold text-muted-foreground">
              اسم المستخدم
            </Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="أدخل اسم المستخدم"
              className="h-12 bg-muted/30 border-border focus:border-primary focus:ring-primary rounded-xl px-4 text-sm"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-xs font-bold text-muted-foreground">
              كلمة السر
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-12 bg-muted/30 border-border focus:border-primary focus:ring-primary rounded-xl px-4 text-sm pl-11"
                required
              />
              <button
                type="button"
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && <p className="text-xs text-destructive text-center font-bold bg-destructive/10 p-2.5 rounded-xl">{error}</p>}

          <Button type="submit" className="w-full h-12 text-sm font-bold rounded-xl shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground transition-all">
            تسجيل الدخول للنظام
          </Button>
        </form>
      </div>
    </div>
  );
};
