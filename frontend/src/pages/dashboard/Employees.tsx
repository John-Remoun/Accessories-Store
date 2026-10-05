import { useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { store } from '../../services/store';
import { User } from '../../types';
import { Button } from '../../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, UserPlus, Trash2, Pencil, AlertTriangle } from 'lucide-react';

export const Employees = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const location = useLocation();

  // Get current active branch ID from URL query or localStorage
  const activeBranchId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('id') || localStorage.getItem('last_active_branch') || user?.branchId || 'b1';
  }, [location.search, user?.branchId]);

  const activeBranch = store.getBranch(activeBranchId);
  const activeBranchName = activeBranch?.nameAr || 'فرع القاهرة';

  // Version counter to trigger re-render on save/delete
  const [version, setVersion] = useState(0);

  // Strict Branch Scoping: Show ONLY regular employees of the active branch
  const employees = useMemo(() => {
    const allNonAdmin = store.getUsers().filter(u => u.role !== 'admin');
    return allNonAdmin.filter(u => u.branchId === activeBranchId || (!u.branchId && activeBranchId === 'b1'));
  }, [activeBranchId, version]);

  // Add Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [addError, setAddError] = useState('');

  // Edit Modal States
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editError, setEditError] = useState('');

  // Delete Modal State (Popup Alert)
  const [deletingUser, setDeletingUser] = useState<User | null>(null);

  if (!isAdmin) return <div className="p-8 text-center text-rose-500 font-bold">غير مصرح لك بالوصول لهذه الصفحة</div>;

  // Open Add Modal
  const openAddModal = () => {
    setName('');
    setUsername('');
    setPassword('');
    setAddError('');
    setIsModalOpen(true);
  };

  const handleSaveEmployee = () => {
    if (!name.trim() || !username.trim() || !password.trim()) {
      setAddError('يرجى كتابة الاسم الكامل واسم المستخدم وكلمة المرور للموظف!');
      return;
    }

    // Check username uniqueness
    const existing = store.getUserByUsername(username.trim());
    if (existing) {
      setAddError('اسم المستخدم هذا مستخدم بالفعل! يرجى اختيار اسم مستخدم آخر.');
      return;
    }

    store.addUser({
      id: `u_${Date.now()}`,
      name: name.trim(),
      username: username.trim(),
      password: password.trim(),
      role: 'employee',
      branchId: activeBranchId,
      joinDate: new Date().toISOString().split('T')[0],
      salesCount: 0
    });

    setVersion(v => v + 1);
    setIsModalOpen(false);
  };

  // Open Edit Modal
  const openEditModal = (emp: User) => {
    setEditingUser(emp);
    setEditName(emp.name);
    setEditUsername(emp.username);
    setEditPassword(emp.password || '');
    setEditError('');
  };

  const handleSaveEditEmployee = () => {
    if (!editingUser) return;
    if (!editName.trim() || !editUsername.trim() || !editPassword.trim()) {
      setEditError('يرجى كتابة الاسم، اسم المستخدم، وكلمة المرور بشكل صحيح!');
      return;
    }

    // Check username uniqueness if changed
    if (editUsername.trim() !== editingUser.username) {
      const existing = store.getUserByUsername(editUsername.trim());
      if (existing && existing.id !== editingUser.id) {
        setEditError('اسم المستخدم هذا محجوز لموظف آخر!');
        return;
      }
    }

    store.updateUser(editingUser.id, {
      name: editName.trim(),
      username: editUsername.trim(),
      password: editPassword.trim(),
      role: 'employee'
    });

    setVersion(v => v + 1);
    setEditingUser(null);
  };

  // Confirm Delete Action
  const handleConfirmDelete = () => {
    if (!deletingUser) return;
    store.deleteUser(deletingUser.id);
    setVersion(v => v + 1);
    setDeletingUser(null);
  };

  return (
    <div className="space-y-6 pb-20 md:pb-0 animate-in fade-in" dir="rtl">
      
      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-6 rounded-3xl border border-border/80 shadow-xs">
        <div className="flex items-center gap-3">
          <UserPlus size={28} className="text-amber-500 shrink-0" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">إدارة الموظفين</h1>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              إدارة الفريق وتعيين وتعديل بيانات الموظفين الجدد بالمتجر.
            </p>
          </div>
        </div>

        {/* Clean Add Employee Button */}
        <Button onClick={openAddModal} className="shadow-md gap-2 bg-amber-500 hover:bg-amber-600 text-black font-bold h-11 px-5 rounded-2xl">
          <Plus size={18} />
          <span>إضافة موظف جديد</span>
        </Button>
      </div>

      {/* EMPLOYEES TABLE */}
      <div className="bg-card rounded-2xl shadow-xs border border-border/80 overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="text-right text-xs font-bold py-3.5">الاسم الكامل</TableHead>
              <TableHead className="text-right text-xs font-bold py-3.5">اسم المستخدم</TableHead>
              <TableHead className="text-right text-xs font-bold py-3.5">الدور الوظيفي</TableHead>
              <TableHead className="text-right text-xs font-bold py-3.5">الفرع</TableHead>
              <TableHead className="text-center text-xs font-bold py-3.5">عدد المبيعات</TableHead>
              <TableHead className="text-center text-xs font-bold py-3.5">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground text-xs">
                  لا يوجد موظفون مسجلون في {activeBranchName} حتى الآن.
                </TableCell>
              </TableRow>
            ) : (
              employees.map((emp) => {
                return (
                  <TableRow key={emp.id} className="hover:bg-muted/30">
                    <TableCell className="font-bold text-xs text-foreground py-3.5">{emp.name}</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground py-3.5">{emp.username}</TableCell>
                    <TableCell className="text-xs py-3.5">
                      <span className="px-2.5 py-0.5 rounded-full font-bold text-[11px] bg-muted text-muted-foreground border border-border/40">
                        موظف
                      </span>
                    </TableCell>
                    <TableCell className="py-3.5">
                      <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2.5 py-0.5 rounded-full text-xs font-bold">
                        {activeBranchName}
                      </span>
                    </TableCell>
                    <TableCell className="text-center font-mono font-bold text-xs text-foreground py-3.5">
                      {emp.salesCount || 0}
                    </TableCell>
                    <TableCell className="py-3.5 text-center">
                      <div className="flex items-center justify-center gap-4">
                        {/* EDIT BUTTON */}
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => openEditModal(emp)} 
                          className="text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 font-bold text-xs h-8 px-2.5 rounded-xl gap-1.5"
                          title="تعديل الموظف"
                        >
                          <Pencil size={14} />
                          <span>تعديل</span>
                        </Button>

                        {/* DELETE BUTTON */}
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setDeletingUser(emp)} 
                          className="text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 font-bold text-xs h-8 px-2.5 rounded-xl gap-1.5"
                          title="حذف الموظف"
                        >
                          <Trash2 size={14} />
                          <span>حذف</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* ADD EMPLOYEE MODAL */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-card border-border sm:max-w-md rounded-3xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="font-bold text-lg text-foreground">
              إضافة موظف جديد
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-3">
            {addError && (
              <div className="p-3 bg-rose-500/15 border border-rose-500/30 text-rose-500 text-xs font-bold rounded-xl">
                {addError}
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">الاسم الكامل للموظف</Label>
              <Input 
                value={name} 
                onChange={e => { setName(e.target.value); setAddError(''); }} 
                placeholder="مثال: كريم محمود" 
                className="h-11 rounded-xl text-xs"
              />
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">اسم المستخدم (لالتسجيل والدخول)</Label>
              <Input 
                value={username} 
                onChange={e => { setUsername(e.target.value); setAddError(''); }} 
                placeholder="مثال: kareem_cairo" 
                className="h-11 rounded-xl text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">كلمة المرور / الباسورد للموظف</Label>
              <Input 
                type="password"
                value={password} 
                onChange={e => { setPassword(e.target.value); setAddError(''); }} 
                placeholder="••••••••" 
                className="h-11 rounded-xl text-xs font-mono"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 border-t border-border/80 pt-4">
            <Button variant="outline" onClick={() => setIsModalOpen(false)} className="rounded-xl text-xs font-bold">
              إلغاء
            </Button>
            <Button onClick={handleSaveEmployee} className="bg-amber-500 hover:bg-amber-600 text-black rounded-xl text-xs font-bold">
              إضافة الموظف الآن
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EDIT EMPLOYEE MODAL */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="bg-card border-border sm:max-w-md rounded-3xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="font-bold text-lg text-foreground flex items-center gap-2">
              <Pencil size={18} className="text-amber-500" />
              <span>تعديل بيانات الموظف</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-3">
            {editError && (
              <div className="p-3 bg-rose-500/15 border border-rose-500/30 text-rose-500 text-xs font-bold rounded-xl">
                {editError}
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">الاسم الكامل للموظف</Label>
              <Input 
                value={editName} 
                onChange={e => { setEditName(e.target.value); setEditError(''); }} 
                className="h-11 rounded-xl text-xs font-bold"
              />
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">اسم المستخدم</Label>
              <Input 
                value={editUsername} 
                onChange={e => { setEditUsername(e.target.value); setEditError(''); }} 
                className="h-11 rounded-xl text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">تغيير كلمة المرور / الباسورد</Label>
              <Input 
                type="text"
                value={editPassword} 
                onChange={e => { setEditPassword(e.target.value); setEditError(''); }} 
                className="h-11 rounded-xl text-xs font-mono"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 border-t border-border/80 pt-4">
            <Button variant="outline" onClick={() => setEditingUser(null)} className="rounded-xl text-xs font-bold">
              إلغاء
            </Button>
            <Button onClick={handleSaveEditEmployee} className="bg-amber-500 hover:bg-amber-600 text-black rounded-xl text-xs font-bold">
              حفظ التعديلات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* POPUP DELETE CONFIRMATION MODAL */}
      <Dialog open={!!deletingUser} onOpenChange={(open) => !open && setDeletingUser(null)}>
        <DialogContent className="max-w-md border-border/80 bg-card p-6 shadow-2xl rounded-3xl" dir="rtl">
          <DialogHeader className="space-y-3">
            <div className="flex items-center gap-3 text-rose-500">
              <div className="p-3 bg-rose-500/10 rounded-2xl">
                <AlertTriangle size={24} />
              </div>
              <DialogTitle className="text-xl font-bold text-foreground">تأكيد حذف الموظف</DialogTitle>
            </div>
          </DialogHeader>

          <div className="py-3 space-y-2">
            <p className="text-sm text-muted-foreground leading-relaxed">
              هل أنت متأكد من حذف الموظف <strong className="text-foreground">{deletingUser?.name}</strong>؟
            </p>
            <p className="text-xs text-rose-400 bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">
              ⚠️ لن يتمكن هذا الموظف من تسجيل الدخول إلى النظام مرة أخرى بعد الحذف.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDeletingUser(null)}
              className="rounded-xl border-border"
            >
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl gap-2 font-bold"
            >
              <Trash2 size={16} />
              <span>نعم، إمسح الموظف</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};
