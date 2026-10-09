import { useState, useEffect } from 'react';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { store } from '../../services/store';
import { useAuth } from '../../contexts/AuthContext';
import { useStoreSync } from '../../hooks/useStoreSync';
import { User, CheckCircle2, ShieldAlert, UserPlus, ShieldCheck } from 'lucide-react';

export const Settings = () => {
  useStoreSync();
  const { user } = useAuth();

  if (user?.role !== 'admin') {
    return (
      <div className="p-8 text-center text-rose-500 font-bold bg-card border border-border rounded-2xl m-6" dir="rtl">
        غير مصرح لك بالوصول لصفحة الإعدادات (متاح للسوبر أدمن فقط).
      </div>
    );
  }

  // Card 1: Profile Settings Form States
  const [fullName, setFullName] = useState<string>(() => user?.name || user?.username || '');
  const [phone, setPhone] = useState<string>(() => user?.phone || '01000000000');
  const [newPassword, setNewPassword] = useState<string>('');
  
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string>('');
  const [profileErrorMsg, setProfileErrorMsg] = useState<string>('');

  // Auto-sync form inputs when user context loads
  useEffect(() => {
    if (user) {
      setFullName(user.name || user.username || '');
      setPhone(user.phone || '01000000000');
    }
  }, [user]);

  // Card 2: New Super Admin Creation Form States
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminUsername, setNewAdminUsername] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');

  const [createAdminSuccessMsg, setCreateAdminSuccessMsg] = useState('');
  const [createAdminErrorMsg, setCreateAdminErrorMsg] = useState('');

  // Handler for Profile Updates
  const handleUpdateProfile = () => {
    setProfileSuccessMsg('');
    setProfileErrorMsg('');

    const targetName = fullName.trim() || user?.name || user?.username || 'مدير النظام';

    if (user?.id) {
      const updates: Partial<any> = {
        name: targetName,
        phone: phone.trim(),
      };

      if (newPassword.trim()) {
        updates.password = newPassword.trim();
      }

      store.updateUser(user.id, updates);

      // Update current user in session state
      Object.assign(user, updates);
    }

    setProfileSuccessMsg(newPassword.trim() ? 'تم تحديث البيانات الشخصية وكلمة السر المشفرة بنجاح!' : 'تم تحديث البيانات الشخصية بنجاح!');
    setNewPassword('');
  };

  // Handler for Creating New Super Admin
  const handleCreateSuperAdmin = () => {
    setCreateAdminSuccessMsg('');
    setCreateAdminErrorMsg('');

    if (!newAdminName.trim() || !newAdminUsername.trim() || !newAdminPassword.trim()) {
      setCreateAdminErrorMsg('جميع الحقول (الاسم، اسم المستخدم، كلمة السر) إجبارية لإنشاء السوبر أدمن!');
      return;
    }

    const cleanUsername = newAdminUsername.trim().toLowerCase();
    const existing = store.getUserByUsername(cleanUsername);

    if (existing) {
      setCreateAdminErrorMsg(`اسم المستخدم (${cleanUsername}) مستخدم بالفعل! يرجى اختيار اسم مستخدم آخر.`);
      return;
    }

    const newAdmin = {
      id: `admin_${Date.now()}`,
      name: newAdminName.trim(),
      username: cleanUsername,
      password: newAdminPassword.trim(),
      role: 'admin' as const,
      joinDate: new Date().toISOString().split('T')[0],
    };

    store.addUser(newAdmin);

    setCreateAdminSuccessMsg(`تم إنشاء حساب السوبر أدمن الجديد (${newAdminName.trim()}) وتشفير كلمة السر بنجاح! يمكنه الآن تسجيل الدخول.`);
    setNewAdminName('');
    setNewAdminUsername('');
    setNewAdminPassword('');
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-16" dir="rtl">
      
      {/* PAGE TITLE */}
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1">إعدادات الحساب والملف الشخصي</h1>
        <p className="text-xs text-muted-foreground">تحديث البيانات الشخصية وتشفير كلمة السر وإدارة حسابات المسؤولين (سوبر أدمن).</p>
      </div>

      {/* CARD 1: PROFILE SETTINGS CARD */}
      <Card className="bg-card border border-border/80 rounded-3xl p-6 shadow-xs space-y-6 border-l-4 border-l-amber-500">
        
        {/* CARD HEADER */}
        <div className="flex justify-between items-center border-b border-border/60 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center justify-center shadow-xs">
              <User size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">الملف الشخصي</h2>
              <p className="text-[11px] text-muted-foreground">تعديل الاسم ورقم التليفون وكلمة السر المباشرة.</p>
            </div>
          </div>
        </div>

        {/* NOTIFICATION MESSAGES */}
        {profileSuccessMsg && (
          <div className="flex items-center gap-2 p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-bold">
            <CheckCircle2 size={16} className="shrink-0" />
            <span>{profileSuccessMsg}</span>
          </div>
        )}

        {profileErrorMsg && (
          <div className="flex items-center gap-2 p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-bold">
            <ShieldAlert size={16} className="shrink-0" />
            <span>{profileErrorMsg}</span>
          </div>
        )}

        {/* FORM FIELDS */}
        <div className="space-y-4">
          
          {/* Row 1: Full Name */}
          <div className="space-y-2">
            <Label className="text-xs font-bold text-foreground">الاسم بالكامل (اسم المستخدم) <span className="text-rose-500">*</span></Label>
            <Input 
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="الاسم بالكامل..."
              className="h-11 rounded-xl text-xs bg-background border-border/80 font-bold"
            />
          </div>

          {/* Row 2: Phone & New Password */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            <div className="space-y-2">
              <Label className="text-xs font-bold text-foreground">رقم التليفون</Label>
              <Input 
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="01000000000"
                className="h-11 rounded-xl text-xs bg-background border-border/80 font-mono font-bold"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-foreground">كلمة السر الجديدة (مباشرة)</Label>
              <Input 
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="ادخل كلمة السر الجديدة هنا لتغييرها..."
                className="h-11 rounded-xl text-xs bg-background border-border/80 font-bold"
              />
            </div>

          </div>

          {/* SUBMIT BUTTON */}
          <div className="pt-2">
            <Button 
              onClick={handleUpdateProfile}
              className="h-11 px-6 bg-amber-500 hover:bg-amber-600 text-black font-extrabold text-xs rounded-2xl shadow-md gap-2"
            >
              <CheckCircle2 size={16} />
              <span>تحديث البيانات الشخصية</span>
            </Button>
          </div>

        </div>

      </Card>

      {/* CARD 2: CREATE NEW SUPER ADMIN CARD */}
      <Card className="bg-card border border-border/80 rounded-3xl p-6 shadow-xs space-y-6 border-l-4 border-l-amber-500">
        
        {/* CARD HEADER */}
        <div className="flex justify-between items-center border-b border-border/60 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center justify-center shadow-xs">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">إنشاء حساب سوبر أدمن جديد</h2>
              <p className="text-[11px] text-muted-foreground">إضافة مسؤول رئيسي جديد للنظام للوصول الشامل لجميع الفروع والإعدادات.</p>
            </div>
          </div>
        </div>

        {/* NOTIFICATION MESSAGES FOR CREATE ADMIN */}
        {createAdminSuccessMsg && (
          <div className="flex items-center gap-2 p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-bold">
            <CheckCircle2 size={16} className="shrink-0" />
            <span>{createAdminSuccessMsg}</span>
          </div>
        )}

        {createAdminErrorMsg && (
          <div className="flex items-center gap-2 p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-bold">
            <ShieldAlert size={16} className="shrink-0" />
            <span>{createAdminErrorMsg}</span>
          </div>
        )}

        {/* FORM FIELDS FOR NEW SUPER ADMIN */}
        <div className="space-y-4">
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            
            {/* Field 1: Full Name */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-foreground">الاسم الكامل <span className="text-rose-500">*</span></Label>
              <Input 
                value={newAdminName}
                onChange={e => setNewAdminName(e.target.value)}
                placeholder="مثال: أحمد محمود"
                className="h-11 rounded-xl text-xs bg-background border-border/80 font-bold"
              />
            </div>

            {/* Field 2: Username */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-foreground">اسم المستخدم للدخول <span className="text-rose-500">*</span></Label>
              <Input 
                value={newAdminUsername}
                onChange={e => setNewAdminUsername(e.target.value)}
                placeholder="مثال: ahmed_admin"
                className="h-11 rounded-xl text-xs bg-background border-border/80 font-mono font-bold"
              />
            </div>

            {/* Field 3: Password */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-foreground">كلمة السر <span className="text-rose-500">*</span></Label>
              <Input 
                type="password"
                value={newAdminPassword}
                onChange={e => setNewAdminPassword(e.target.value)}
                placeholder="••••••••"
                className="h-11 rounded-xl text-xs bg-background border-border/80 font-bold"
              />
            </div>

          </div>

          {/* SUBMIT BUTTON */}
          <div className="pt-2">
            <Button 
              onClick={handleCreateSuperAdmin}
              className="h-11 px-6 bg-amber-500 hover:bg-amber-600 text-black font-extrabold text-xs rounded-2xl shadow-md gap-2"
            >
              <UserPlus size={16} />
              <span>إنشاء حساب سوبر أدمن جديد</span>
            </Button>
          </div>

        </div>

      </Card>

    </div>
  );
};
