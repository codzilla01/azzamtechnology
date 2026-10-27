<p align="center">
  <img src="images/Azzam_Cover.jpg"/>
</p>

## 🧠 About The Project
AZZAM TECHNOLOGY is a modern, scalable **digital store platform** designed to deliver high-performance e-commerce experiences.

Built with a focus on:
- ⚡ Speed & Performance
- 🔐 Security & Reliability
- 🎯 Conversion Optimization
- 📈 Business Scalability

This project represents a **production-ready digital solution** tailored for businesses looking to dominate the online market.


## 🚀 Features

### 🛒 Core E-Commerce
- Advanced product management system
- Smart categorization & filtering
- Dynamic pricing & offers
- Cart & checkout optimization

### 🔐 Security First
- Secure authentication system
- Protection against common vulnerabilities
- Safe payment integrations (ready)

### 📊 Business Intelligence
- Analytics-ready structure
- Customer behavior tracking support
- Sales performance monitoring

### ⚙️ Admin Dashboard
- Full control over products & orders
- User management system
- Real-time updates

## 🧱 Tech Stack

```bash
Frontend   → HTML5 / CSS3 / JavaScript
Backend    → (Expandable Architecture)
Database   → Scalable DB Ready
Hosting    → Cloud Ready ☁️

---

## ✅ ما تم تنفيذه (تجربة الشراء)

### 🛒 السلة وإتمام الطلب
- لوحة سلة جانبية كاملة: كميات ±، حذف، إجمالي لحظي، وشحن مجاني فوق 5000 ج.م.
- مفضلة ومقارنة (حتى 4 منتجات) كاملتين بدل الأزرار الفارغة.
- أكواد خصم حقيقية (نسبة/مبلغ ثابت/حد أدنى) موصولة بجدول الكوبونات في لوحة التحكم.
- شحن محسوب لكل محافظة + خيار الاستلام من الفرع.
- Checkout بخطوتين مع تحقق من الاسم والموبايل والعنوان، وشاشة نجاح برقم طلب (`AZ-XXXXXX`).
- كل طلب يُسجَّل في `store_orders_log` ويُرسل ملخّصه للمتجر على واتساب برسالة منسّقة.

### 🧾 سجل الطلبات في لوحة التحكم
- جدول طلبات حقيقي: رقم الطلب، العميل وموبايله، المنتجات، الإجمالي، الحالة.
- تغيير حالة الطلب (جديد / قيد التجهيز / تم الشحن / تم التسليم / ملغي) مع الحفظ.
- تفاصيل قابلة للفتح + واتساب/اتصال بالعميل + طباعة فاتورة.
- تصدير الطلبات CSV (يفتح في Excel بعربي سليم) + تحديث لحظي عند وصول طلب جديد.
- لوحة المعلومات تعرض الآن: عدد الطلبات، الجديدة، إجمالي المبيعات، ومتوسط قيمة الطلب.

### 🧪 معاينة سريعة
افتح `index.html?seed=1` مرة واحدة لزرع بيانات تجريبية (شاشات/لابتوبات/قطع PC) لتجربة السلة والشراء،
ثم استبدلها بمنتجاتك من لوحة التحكم.

> 📌 خطة التطوير الكاملة بالتفصيل: [`docs/roadmap.html`](docs/roadmap.html)
