import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// the translations
const resources = {
  en: {
    translation: {
      "login": "Login",
      "username": "Username",
      "dashboard": "Dashboard",
      "pos": "POS",
      "products": "Products",
      "inventory": "Inventory",
      "qrcodes": "QR Codes",
      "invoices": "Invoices",
      "settings": "Settings",
      "logout": "Logout",
      "welcome": "Welcome",
      "role": "Role",
      "branch": "Branch",
      "search": "Search...",
      "addToCart": "Add to Cart",
      "checkout": "Checkout",
      "total": "Total",
      "language": "Language",
      "theme": "Theme",
      "light": "Light",
      "dark": "Dark",
      "system": "System"
    }
  },
  ar: {
    translation: {
      "login": "تسجيل الدخول",
      "username": "اسم المستخدم",
      "dashboard": "لوحة القيادة",
      "pos": "نقطة البيع",
      "products": "المنتجات",
      "inventory": "المخزون",
      "qrcodes": "رموز الاستجابة السريعة",
      "invoices": "الفواتير",
      "settings": "الإعدادات",
      "logout": "تسجيل الخروج",
      "welcome": "مرحباً",
      "role": "الدور",
      "branch": "الفرع",
      "search": "بحث...",
      "addToCart": "أضف إلى السلة",
      "checkout": "الدفع",
      "total": "المجموع",
      "language": "اللغة",
      "theme": "المظهر",
      "light": "فاتح",
      "dark": "داكن",
      "system": "النظام"
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: "ar", // default language strictly Arabic
    fallbackLng: "ar",
    interpolation: {
      escapeValue: false
    }
  });

document.documentElement.dir = 'rtl';
document.documentElement.lang = 'ar';

// Handle RTL on language change
i18n.on('languageChanged', (lng) => {
  document.documentElement.dir = 'rtl';
  document.documentElement.lang = 'ar';
});

export default i18n;
