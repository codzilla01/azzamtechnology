/* Shared, client-side translations. Arabic is the source/fallback language. */
(function () {
    'use strict';

    const STORAGE_KEY = 'azzam_language';
    const english = {
        'Azzam Technology | الشاشات و أجهزة الكمبيوتر واللابتوب': 'Azzam Technology | Monitors, Computers & Laptops',
        'Azzam Technology | المساعد الذكي': 'Azzam Technology | Assistant',
        'Azzam Technology | لوحة التحكم': 'Azzam Technology | Dashboard',
        'Azzam Technology | دخول الإدارة': 'Azzam Technology | Admin sign in',
        'Azzam Technology — العودة للمتجر': 'Azzam Technology — Back to store',
        'دخول الإدارة': 'Admin sign in',
        'مساحة الإدارة': 'Admin workspace',
        'كل ما تحتاجه لإدارة متجرك،': 'Everything you need to manage your store,',
        'في مكان واحد.': 'in one place.',
        'سجّل دخولك للوصول إلى المنتجات والإعدادات وأدوات المتجر.': 'Sign in to access products, settings and store tools.',
        'هذه الصفحة مخصصة للمسؤول فقط.': 'This page is for the administrator only.',
        'جارٍ التحقق من الجلسة...': 'Checking your session...',
        'أهلاً بعودتك': 'Welcome back',
        'أدخل اسم المستخدم وكلمة المرور للمتابعة.': 'Enter your username and password to continue.',
        'اسم المستخدم': 'Username',
        'كلمة المرور': 'Password',
        'تسجيل الدخول': 'Sign in',
        'أول دخول؟ بيانات الدخول المؤقتة متاحة في إعداد الخادم.': 'First sign-in? Find your temporary credentials in the server setup.',
        'خطوة أخيرة': 'One last step',
        'أمّن حسابك': 'Secure your account',
        'لأمان حسابك، غيّر كلمة المرور المؤقتة قبل دخول لوحة الإدارة.': 'For your security, change the temporary password before accessing the dashboard.',
        'اسم المستخدم الجديد': 'New username',
        'كلمة المرور الحالية': 'Current password',
        'كلمة المرور الجديدة': 'New password',
        'تأكيد كلمة المرور الجديدة': 'Confirm new password',
        'من ٣ إلى ٣٢ حرفاً إنجليزياً أو رقماً، ويمكن استخدام . و _ و -.': '3–32 English letters or numbers; . _ and - are also allowed.',
        '١٢ حرفاً على الأقل. استخدم كلمة مرور فريدة.': 'At least 12 characters. Use a unique password.',
        '١٢ حرفاً على الأقل. اتركها فارغة لتغيير اسم المستخدم فقط.': 'At least 12 characters. Leave blank to change only the username.',
        'حفظ ومتابعة': 'Save and continue',
        'بيانات دخول الإدارة': 'Admin sign-in details',
        'لتغيير اسم المستخدم أو كلمة المرور، أدخل كلمة المرور الحالية. سيُسجَّل خروج الأجهزة الأخرى.': 'Enter your current password to change your username or password. Other devices will be signed out.',
        'حفظ بيانات الدخول': 'Save sign-in details',
        'حساب المسؤول': 'Administrator account',
        'كلمتا المرور غير متطابقتين.': 'Passwords do not match.',
        'اسم المستخدم أو كلمة المرور غير صحيحة.': 'The username or password is incorrect.',
        'كلمة المرور الحالية غير صحيحة.': 'The current password is incorrect.',
        'اسم المستخدم يجب أن يكون من ٣ إلى ٣٢ حرفاً إنجليزياً أو رقماً، ويمكن أن يتضمن . أو _ أو -.': 'The username must be 3–32 English letters or numbers and may include . _ or -.',
        'اختر كلمة مرور من ١٢ حرفاً على الأقل ولا تزيد على ٢٥٦ بايت.': 'Choose a password of at least 12 characters and no more than 256 bytes.',
        'اختر كلمة مرور مختلفة عن الحالية.': 'Choose a different password from the current one.',
        'لم تُغيَّر بيانات الدخول.': 'No sign-in details were changed.',
        'محاولات كثيرة. انتظر ١٥ دقيقة ثم حاول مجدداً.': 'Too many attempts. Wait 15 minutes, then try again.',
        'خدمة تسجيل الدخول غير متاحة. تحقّق من إعداد الخادم ثم حاول مجدداً.': 'Sign-in is unavailable. Check the server setup and try again.',
        'يتطلب تسجيل الدخول اتصالاً آمناً عبر HTTPS.': 'Sign-in requires a secure HTTPS connection.',
        'انتهت الجلسة. سجّل الدخول مجدداً.': 'Your session has ended. Sign in again.',
        'تعذر تسجيل الخروج. حاول مرة أخرى.': 'Could not sign out. Please try again.',
        'تعذر حفظ بيانات الدخول. قد يكون التغيير قد تم؛ حاول تسجيل الدخول بالبيانات الجديدة.': 'Could not confirm the update. It may have been saved; try signing in with the new details.',
        'تم تحديث بيانات الدخول وتسجيل الخروج من الجلسات الأخرى.': 'Sign-in details updated. Other sessions have been signed out.',
        'اكتشف الشاشات واللابتوبات والأجهزة المجمّعة، أو ابدأ بتجميع جهازك مع Azzam Technology.': 'Explore monitors, laptops and prebuilt PCs, or start building your own PC with Azzam Technology.',
        'تخطَّ إلى المحتوى': 'Skip to content',
        'وجهتك لكل ما يخص عالم الكمبيوتر': 'Your destination for everything computing',
        'الرئيسية': 'Home',
        'الشاشات': 'Monitors',
        'اللابتوبات': 'Laptops',
        'أجهزة PC': 'Desktop PCs',
        'تجميع PC': 'Build a PC',
        '🔐 دخول المسؤول': '🔐 Admin sign in',
        'طلب كود التحقق': 'Request verification code',
        'أدخل الكود المكون من 6 أرقام': 'Enter the 6-digit code',
        'إعادة الإرسال': 'Resend',
        'أهلاً بك في Azzam Technology': 'Welcome to Azzam Technology',
        'تقنيتك المناسبة': 'The right tech',
        'تبدأ من هنا.': 'starts here.',
        'من شاشة تناسب يومك إلى تجميعة تحلم بها، كل اللي تحتاجه لعالمك الرقمي في مكان واحد.': 'From a screen for your day to the PC build you have in mind, find what you need for your digital world.',
        'اكتشف المنتجات': 'Explore products',
        'ابنِ تجميعتك': 'Build your PC',
        'شاشات': 'Monitors',
        'لابتوبات': 'Laptops',
        'تجميعات PC': 'PC builds',
        'مساحتك، على طريقتك': 'Your space, your way',
        'اختيارات تناسب احتياجك': 'Choices for your needs',
        'تسوّق حسب احتياجك': 'Shop by category',
        'اكتشف عالمك التقني': 'Explore your tech world',
        'كل قسم يقرّبك خطوة من الجهاز المناسب لك.': 'Find the right device, one category at a time.',
        'تصفّح الأقسام': 'Browse categories',
        'تصفح الأقسام': 'Browse categories',
        'صورة أوضح لكل لحظة': 'A clearer view for every moment',
        'شغلك معك أينما كنت': 'Take your work anywhere',
        'تجميعات جاهزة لك': 'Ready-to-use builds',
        'تجميع جهازك': 'Build your PC',
        'اختيارات على مقاسك': 'Choices tailored to you',
        'بتدور على حاجة معينة؟': 'Looking for something specific?',
        'ابحث بالاسم، الماركة أو المواصفات': 'Search by name, brand or specifications',
        'ابحث في المنتجات': 'Search products',
        'وضوح يصنع الفرق': 'Clarity makes the difference',
        'للعمل، اللعب، وكل ما بينهما.': 'For work, play and everything in between.',
        'كل الشاشات': 'All monitors',
        'عادية': 'Standard',
        'بدون إطار': 'Frameless',
        'منحنية': 'Curved',
        'للألعاب': 'Gaming',
        'إنجازك في كل مكان': 'Productivity wherever you go',
        'اختيارات تناسب أسلوب عملك وحياتك.': 'Options for the way you work and live.',
        'جاهز للانطلاق': 'Ready to go',
        'أجهزة PC المجمّعة': 'Prebuilt PCs',
        'اكتشف الأجهزة الجاهزة للاستخدام.': 'Explore PCs ready to use.',
        'جهاز يشبه طموحك': 'A PC built for your ambitions',
        'تجميعك، اختيارك': 'Your build, your choice',
        'اختر القطع المناسبة لك وتابع التكلفة خطوة بخطوة.': 'Choose the components you need and see the cost as you go.',
        'تفاصيل اختيارك': 'Your selections',
        'ملخص التجميعة': 'Build summary',
        'اختر ٣ قطع على الأقل لإضافة التجميعة للسلة.': 'Choose at least 3 components to add your build to the cart.',
        '0 ج.م': '0 EGP',
        'إضافة للسلة': 'Add to cart',
        'إعادة تعيين': 'Reset',
        'لسه محتار؟': 'Still deciding?',
        'خلّينا نساعدك تختار صح.': 'Let us help you choose.',
        'تواصل معنا لو عندك سؤال عن الأجهزة أو التجميع.': 'Get in touch with questions about devices or PC builds.',
        'تواصل معنا': 'Contact us',
        'مساحتك لكل ما يخص أجهزة الكمبيوتر، الشاشات والتجميع.': 'Your place for computers, monitors and custom builds.',
        'اسأل المساعد': 'Ask the assistant',
        'تصفّح المتجر': 'Explore the store',
        'نقدر نساعدك؟': 'Need help?',
        'المساعد الذكي': 'Assistant',
        'تواصل عبر واتساب': 'Contact us on WhatsApp',
        'مول البستان - القاهرة': 'Al Bostan Mall, Cairo',
        '2026 Azzam Technology. جميع الحقوق محفوظة.': '2026 Azzam Technology. All rights reserved.',
        'المساعد': 'Assistant',
        'التنقل الرئيسي': 'Main navigation',
        'تفعيل الوضع الفاتح': 'Switch to light mode',
        'تفعيل الوضع الداكن': 'Switch to dark mode',
        'تغيير المظهر': 'Change theme',
        'المقارنة': 'Compare',
        'المفضلة': 'Wishlist',
        'السلة': 'Cart',
        'فتح القائمة': 'Open menu',
        'إغلاق القائمة': 'Close menu',
        'إغلاق نافذة دخول المسؤول': 'Close admin sign in',
        'أقسام المتجر': 'Store categories',
        'مساحة عمل تضم شاشة ولابتوب وجهاز كمبيوتر': 'A workspace with a monitor, laptop and desktop computer',
        'مثلاً: شاشة أو Dell...': 'For example: monitor or Dell...',
        'مسح البحث': 'Clear search',
        'تصفية الشاشات': 'Filter monitors',
        'إغلاق تفاصيل المنتج': 'Close product details',
        'إغلاق النافذة': 'Close dialog',

        'العودة إلى المتجر': 'Back to the store',
        'محادثة المساعد': 'Assistant conversation',
        'اكتب سؤالك للمساعد': 'Write your question to the assistant',
        'اكتب سؤالك هنا...': 'Type your question here...',
        'إرسال السؤال': 'Send question',
        'تصفية المنتجات': 'Filter products',
        '👋 مرحباً! أنا مساعد': '👋 Hello! I am the assistant for',
        '. اسألني عن الأسعار، المواصفات، التجميع، أو أي استفسار!': '. Ask me about prices, specifications, PC builds or anything else!',
        '💻 اللابتوبات': '💻 Laptops',
        '🖥️ الشاشات': '🖥️ Monitors',
        '🔧 تجميع PC': '🔧 Build a PC',
        '🛡️ الضمان': '🛡️ Warranty',
        'أسعار اللابتوبات': 'Laptop prices',
        'الشاشات المتاحة': 'Available monitors',
        'الضمان': 'Warranty',
        '👋 أهلاً! كيف أساعدك؟': '👋 Hello! How can I help?',
        '🛡️ الشاشات وPC: شهر (استبدال) | اللابتوبات: 3 شهور | البطارية: شهر': '🛡️ Monitors and PCs: 1 month (replacement) | Laptops: 3 months | Battery: 1 month',
        '🚚 نوصل لكل مصر! مجاني فوق 5000 ج.م': '🚚 We deliver across Egypt. Delivery is free for orders over 5,000 EGP.',
        '📞 01025555207 | 📍 مول البستان - القاهرة': '📞 01025555207 | 📍 Al Bostan Mall, Cairo',
        '💻 اللابتوبات:': '💻 Laptops:',
        '⚠️ لا توجد لابتوبات': '⚠️ No laptops are listed.',
        '🖥️ الشاشات:': '🖥️ Monitors:',
        '⚠️ لا توجد شاشات': '⚠️ No monitors are listed.',
        '🔧 توجه لقسم تجميع PC في موقعنا!': '🔧 Visit the PC builder on our website!',
        '💰 الأرخص: {cheap} - {cheapPrice}\n💎 الأعلى: {expensive} - {expensivePrice}': '💰 Lowest price: {cheap} - {cheapPrice}\n💎 Highest price: {expensive} - {expensivePrice}',
        '🔍 نتائج:': '🔍 Results:',
        '🤔 اسألني عن: اللابتوبات | الشاشات | تجميع PC | الضمان | الأسعار': '🤔 Ask me about laptops, monitors, PC builds, warranty or prices.',

        'لوحة التحكم - تسجيل الدخول': 'Admin dashboard - sign in',
        'نسخة تجريبية: لوحة الإدارة غير مؤمّنة': 'Prototype only: the dashboard is not secured',
        'سيتم إرسال كود تحقق لمرة واحدة إلى الحساب المصرح له': 'A one-time code will be sent to the authorized account',
        'تم إرسال الكود': 'Code sent',
        'أدخل الكود': 'Enter the code',
        'إعادة إرسال الكود': 'Resend code',
        'العودة': 'Back',
        'أو': 'or',
        'مستخدم': 'User',
        'لوحة المعلومات': 'Dashboard',
        'إدارة المنتجات': 'Products',
        'إضافة منتج': 'Add product',
        'المخزون': 'Inventory',
        'الكوبونات': 'Coupons',
        'قطع PC': 'PC components',
        'سجل الطلبات': 'Order history',
        'الإعدادات': 'Settings',
        'العودة للمتجر': 'Back to store',
        'تحديث': 'Refresh',
        'الكل': 'All',
        '💻 لابتوب': '💻 Laptop',
        '🖥️ شاشة': '🖥️ Monitor',
        '🖥️ PC مجمع': '🖥️ Prebuilt PC',
        '🔧 قطع تجميع': '🔧 Components',
        'جديد': 'New',
        'الصورة': 'Image',
        'الاسم': 'Name',
        'النوع': 'Type',
        'الماركة': 'Brand',
        'السعر': 'Price',
        'إجراءات': 'Actions',
        'لا توجد منتجات': 'No products yet',
        'إضافة منتج جديد': 'Add a new product',
        'تعديل المنتج': 'Edit product',
        'اسم المنتج *': 'Product name (Arabic/default) *',
        'اسم المنتج بالإنجليزية (اختياري)': 'Product name in English (optional)',
        'السعر (ج.م) *': 'Price (EGP) *',
        'نوع المنتج *': 'Product type *',
        '🖥️ PC مجمع مسبقاً': '🖥️ Prebuilt PC',
        '🔧 قطعة تجميع PC': '🔧 PC component',
        'نوع القطعة': 'Component type',
        'معالج (CPU)': 'Processor (CPU)',
        'لوحة أم (Motherboard)': 'Motherboard',
        'كرت شاشة (GPU)': 'Graphics card (GPU)',
        'ذاكرة (RAM)': 'Memory (RAM)',
        'تخزين (Storage)': 'Storage',
        'مزود طاقة (PSU)': 'Power supply (PSU)',
        'صندوق (Case)': 'Case',
        'شاشة (Monitor)': 'Monitor',
        'اختر': 'Choose',
        'أخرى': 'Other',
        '📷 صورة المنتج': '📷 Product image',
        'اسحب وأفلت الصورة أو انقر للاختيار': 'Drag and drop an image or click to choose',
        'تغيير': 'Change',
        'إزالة': 'Remove',
        'الوصف': 'Description (Arabic/default)',
        'الوصف بالإنجليزية (اختياري)': 'Description in English (optional)',
        'المواصفات': 'Specifications',
        'إضافة مواصفة': 'Add specification',
        'حفظ': 'Save',
        'إلغاء': 'Cancel',
        'مسح': 'Clear',
        'إدارة المخزون': 'Inventory management',
        'تنبيهات تلقائية عند انخفاض المخزون (أقل من 5 قطع)': 'Automatic alerts when stock is low (fewer than 5 items)',
        'المنتج': 'Product',
        'الحالة': 'Status',
        'إدارة الكوبونات': 'Coupons',
        'كوبون جديد': 'New coupon',
        'الكود *': 'Code *',
        'النوع *': 'Type *',
        'نسبة مئوية (%)': 'Percentage (%)',
        'مبلغ ثابت (ج.م)': 'Fixed amount (EGP)',
        'القيمة *': 'Value *',
        'الحد الأدنى للطلب': 'Minimum order',
        'قطع تجميع PC': 'PC components',
        'إدارة Chatbot': 'Manage assistant',
        'رسالة الترحيب': 'Welcome message',
        'سؤال وجواب': 'Question and answer',
        'مسح الكل': 'Clear all',
        'التاريخ': 'Date',
        'عدد المنتجات': 'Number of products',
        'الإجمالي': 'Total',
        'الكوبون': 'Coupon',
        'لا توجد طلبات مسجلة': 'No orders recorded',
        'اسم المتجر': 'Store name',
        'رقم الواتساب': 'WhatsApp number',
        'العنوان': 'Address',
        'البريد الإلكتروني': 'Email',
        'الموقع الإلكتروني': 'Website',
        'تصدير': 'Export',
        'استيراد': 'Import',
        'معاينة': 'Preview',
        'أو رابط صورة خارجي': 'Or paste an external image URL',
        'مثال: WELCOME10': 'Example: WELCOME10',
        'اسم المواصفة': 'Specification name (Arabic/default)',
        'القيمة': 'Value (Arabic/default)',
        'اسم المواصفة بالإنجليزية (اختياري)': 'Specification name in English (optional)',
        'القيمة بالإنجليزية (اختياري)': 'Value in English (optional)',
        'إزالة المواصفة': 'Remove specification',
        'الاسم والوصف والمواصفات الإنجليزية اختيارية؛ تُعرض البيانات الأصلية عند تركها فارغة.': 'English names, descriptions and specifications are optional. The original data is shown when they are left blank.',

        'منتج': 'Product',
        'شاشة': 'Monitor',
        'لابتوب': 'Laptop',
        'جهاز PC': 'Desktop PC',
        'المعالج': 'Processor',
        'اللوحة الأم': 'Motherboard',
        'كرت الشاشة': 'Graphics card',
        'الذاكرة': 'Memory',
        'التخزين': 'Storage',
        'مزود الطاقة': 'Power supply',
        'الصندوق': 'Case',
        'الشاشة': 'Monitor',
        'التبريد': 'Cooling',
        'لوحة المفاتيح': 'Keyboard',
        'الفأرة': 'Mouse',
        'السماعة': 'Headset',
        'السماعات': 'Speakers',
        'كارت الشبكة': 'Network card',
        'عدد النتائج الظاهرة: {count} — البحث عن «{query}»': 'Showing {count} results for “{query}”',
        'عرض تفاصيل {name}': 'View details for {name}',
        'إضافة إلى المفضلة: {name}': 'Add to wishlist: {name}',
        'إزالة من المفضلة: {name}': 'Remove from wishlist: {name}',
        'إضافة إلى المقارنة: {name}': 'Add to comparison: {name}',
        'إزالة من المقارنة: {name}': 'Remove from comparison: {name}',
        'وفر {discount}%': 'Save {discount}%',
        'أضف قطعة أخرى': 'Add another',
        'لا توجد شاشات معروضة حالياً': 'No monitors are listed right now',
        'تواصل معنا لمعرفة أحدث الشاشات المتاحة.': 'Contact us to ask about available monitors.',
        'لا توجد لابتوبات معروضة حالياً': 'No laptops are listed right now',
        'تواصل معنا لمعرفة أحدث الأجهزة المتاحة.': 'Contact us to ask about available devices.',
        'لا توجد أجهزة مجمّعة معروضة حالياً': 'No prebuilt PCs are listed right now',
        'يسعدنا مساعدتك في اختيار جهاز مناسب.': 'We can help you find the right PC.',
        'القطع غير متاحة للعرض حالياً': 'Components are not listed right now',
        'تواصل معنا وسنساعدك في تجهيز تجميعتك.': 'Contact us for help with your build.',
        'لا توجد نتائج مطابقة هنا': 'No matching results here',
        'جرّب كلمة أخرى أو امسح البحث لاستعراض كل المنتجات.': 'Try another search or clear it to see all products.',
        'اسأل عن المتاح': 'Ask what is available',
        'اختر القطعة المناسبة': 'Choose a component',
        'لم يُختر بعد': 'Not selected yet',
        'اختر ٣ قطع على الأقل لإضافة التجميعة للسلة (تم اختيار {count}).': 'Choose at least 3 components to add your build to the cart ({count} selected).',
        'تم اختيار {count} قطع. يمكنك إضافة التجميعة للسلة.': '{count} components selected. You can add your build to the cart.',
        'شراء مباشر': 'Buy now',
        'إزالة من المفضلة': 'Remove from wishlist',
        'إزالة من المقارنة': 'Remove from comparison',
        'مقارنة': 'Compare',
        'مرحباً، أريد الاستفسار عن شراء:': 'Hello, I would like to ask about purchasing:',
        'تمت إضافة المنتج إلى السلة': 'Added to cart',
        'تمت الإضافة إلى المفضلة': 'Added to wishlist',
        'تمت الإزالة من المفضلة': 'Removed from wishlist',
        'تمت الإزالة من المقارنة': 'Removed from comparison',
        'يمكنك مقارنة ٤ منتجات كحد أقصى': 'You can compare up to 4 products',
        'تمت الإضافة إلى المقارنة': 'Added to comparison',
        'تقليل كمية {name}': 'Decrease quantity of {name}',
        'زيادة كمية {name}': 'Increase quantity of {name}',
        'الكمية': 'Quantity',
        'لا توجد مواصفات إضافية': 'No additional specifications',
        'إزالة {name}': 'Remove {name}',
        'سلة التسوق': 'Shopping cart',
        'سلتك فاضية لسه': 'Your cart is empty',
        'اكتشف المنتجات وأضف اختياراتك هنا.': 'Explore products and add your choices here.',
        'مفضلتك فاضية لسه': 'Your wishlist is empty',
        'احفظ المنتجات اللي عجبتك عشان ترجع لها بسهولة.': 'Save products you like so you can find them later.',
        'مقارنة المنتجات': 'Compare products',
        'مافيش منتجات للمقارنة': 'No products to compare',
        'أضف حتى ٤ منتجات وشوف أهم مواصفاتها هنا.': 'Add up to 4 products to see their key specifications here.',
        'طلب عبر واتساب': 'Order via WhatsApp',
        'تُراجع تفاصيل الطلب مع الفريق قبل التأكيد.': 'The team will review your order details before confirmation.',
        'يمكنك إضافة حتى ٤ منتجات للمقارنة.': 'You can compare up to 4 products.',
        'مرحباً، أود طلب المنتجات التالية:': 'Hello, I would like to order the following products:',
        'تجميعة PC مخصصة': 'Custom PC build',
        'تمت إعادة تعيين التجميعة': 'Build has been reset',
        '✅ تم الفتح!': '✅ Opened!',
        '⌨️ اختصار الدخول': '⌨️ Sign-in shortcut',
        'جاري الإرسال...': 'Sending...',
        '✅ تم الإرسال': '✅ Sent',
        '❌ فشل الإرسال': '❌ Could not send',
        '❌ فشل الاتصال': '❌ Connection failed',
        'أدخل 6 أرقام': 'Enter 6 digits',
        'منتهي': 'Expired',
        'محظور': 'Blocked',
        '❌ خطأ - متبقي {count} محاولات': '❌ Incorrect code - {count} attempts remaining',

        '✅ تم إرسال الكود': '✅ Code sent',
        'الرجاء إدخال الرمز كاملاً': 'Please enter the complete code',
        'انتهت صلاحية الرمز': 'The code has expired',
        '⏰ انتهت صلاحية الرمز': '⏰ The code has expired',
        '🚫 تجاوزت عدد المحاولات': '🚫 Too many attempts',
        '❌ رمز غير صحيح. متبقي {count} محاولات': '❌ Incorrect code. {count} attempts remaining',
        '⏰ متبقي: {time}': '⏰ Time remaining: {time}',
        'تسجيل الخروج؟': 'Sign out?',
        'تسجيل الخروج': 'Sign out',
        '👋 مرحباً @{name}!': '👋 Welcome, @{name}!',
        'تعديل {name}': 'Edit {name}',
        'حذف {name}': 'Delete {name}',
        'تم تسجيل الخروج': 'Signed out',
        'زائر': 'Guest',
        'دخول محدود (زائر)': 'Limited guest access',
        'قطعة تجميع': 'Components',
        'إجمالي المخزون': 'Total stock',
        'كوبونات': 'Coupons',
        'متوفر': 'In stock',
        'منخفض': 'Low stock',
        'نفذ': 'Out of stock',
        '🧠 معالج': '🧠 Processor',
        '📟 لوحة أم': '📟 Motherboard',
        '🎮 كرت شاشة': '🎮 Graphics card',
        '🧮 ذاكرة': '🧮 Memory',
        '💾 تخزين': '💾 Storage',
        '⚡ مزود طاقة': '⚡ Power supply',
        '📦 صندوق': '📦 Case',
        'لا توجد قطع': 'No components yet',
        'نشط': 'Active',
        'غير نشط': 'Inactive',
        'لا توجد كوبونات': 'No coupons yet',
        'حذف الكوبون؟': 'Delete this coupon?',
        'تم الحذف': 'Deleted',
        'تم الحذف!': 'Deleted!',
        'املأ الحقول': 'Complete the required fields',
        'تم الحفظ!': 'Saved!',
        'حذف المنتج؟': 'Delete this product?',
        'الاسم والسعر مطلوبان': 'Name and price are required',
        'تم التحديث!': 'Updated!',
        'تمت الإضافة!': 'Added!',
        'ملف صورة فقط': 'Please choose an image file',
        'حجم كبير': 'Image file is too large',
        'تم التصدير!': 'Exported!',
        'دمج؟': 'Merge imported data with existing data?',
        'تم الاستيراد!': 'Imported!',
        'ملف غير صالح': 'Invalid file',
        'إعادة تعيين؟': 'Reset the data?',
        'تم إعادة التعيين!': 'Data reset!',
        'مسح سجل الطلبات؟': 'Clear the order history?',
        'تم المسح': 'Cleared'
    };

    function readLanguage() {
        try { return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'ar'; }
        catch (error) { return 'ar'; }
    }

    let language = readLanguage();

    function translateFor(targetLanguage, source, values = {}) {
        const text = targetLanguage === 'en' && Object.prototype.hasOwnProperty.call(english, source) ? english[source] : source;
        return String(text).replace(/\{(\w+)\}/g, (match, key) =>
            Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match
        );
    }

    function t(source, values = {}) { return translateFor(language, source, values); }

    function productText(product, field) {
        const translated = language === 'en' ? product?.translations?.en?.[field] : null;
        return typeof translated === 'string' && translated.trim() ? translated : (product?.[field] ?? '');
    }

    function productSpecs(product) {
        if (!product?.specs || typeof product.specs !== 'object') return [];
        const translated = language === 'en' ? product?.translations?.en?.specs : null;
        return Object.entries(product.specs).map(([name, value]) => {
            const entry = translated && typeof translated === 'object' ? translated[name] : null;
            return [entry?.name || name, entry?.value || value];
        });
    }

    function formatPrice(price) {
        const number = Number(price);
        return `${(Number.isFinite(number) ? number : 0).toLocaleString('en-US')} ${language === 'en' ? 'EGP' : 'ج.م'}`;
    }

    function productCount(count) {
        return language === 'en' ? `${count} ${Number(count) === 1 ? 'product' : 'products'}` : `${count} منتج`;
    }

    function updateDocumentDirection() {
        document.documentElement.lang = language;
        document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    }

    function setMessage(element, source, values = {}) {
        element.dataset.i18nMessage = source;
        element._i18nValues = values;
        element.textContent = t(source, values);
    }

    function translateDocument() {
        document.querySelectorAll('[data-i18n]').forEach(element => {
            element.textContent = t(element.getAttribute('data-i18n'));
        });
        document.querySelectorAll('[data-i18n-message]').forEach(element => {
            element.textContent = t(element.dataset.i18nMessage, element._i18nValues || {});
        });
        const attributes = {
            'data-i18n-aria-label': 'aria-label',
            'data-i18n-placeholder': 'placeholder',
            'data-i18n-title': 'title',
            'data-i18n-alt': 'alt',
            'data-i18n-data-q': 'data-q',
            'data-i18n-content': 'content'
        };
        Object.entries(attributes).forEach(([source, target]) => {
            document.querySelectorAll(`[${source}]`).forEach(element => element.setAttribute(target, t(element.getAttribute(source))));
        });
        document.querySelectorAll('[data-language-switch]').forEach(button => {
            const label = button.querySelector('[data-language-label]');
            if (label) {
                label.textContent = language === 'ar' ? 'EN' : 'عربي';
                label.lang = language === 'ar' ? 'en' : 'ar';
            }
            const accessibleLabel = language === 'ar' ? 'EN — Switch to English' : 'عربي — التبديل إلى العربية';
            button.setAttribute('aria-label', accessibleLabel);
            button.setAttribute('title', accessibleLabel);
        });
    }

    function setLanguage(next, persist = true) {
        if (!['ar', 'en'].includes(next)) return;
        language = next;
        if (persist) {
            try { localStorage.setItem(STORAGE_KEY, language); } catch (error) { /* The page still works without storage. */ }
        }
        updateDocumentDirection();
        translateDocument();
        document.dispatchEvent(new CustomEvent('azzam:languagechange', { detail: { language } }));
    }

    window.I18n = {
        t,
        translateFor,
        productText,
        productSpecs,
        productCount,
        formatPrice,
        setLanguage,
        setMessage,
        translateDocument,
        get language() { return language; },
        hasTranslation(source) { return Object.prototype.hasOwnProperty.call(english, source); }
    };

    updateDocumentDirection();
    document.addEventListener('DOMContentLoaded', translateDocument);
    document.addEventListener('click', event => {
        if (event.target.closest('[data-language-switch]')) setLanguage(language === 'ar' ? 'en' : 'ar');
    });
    window.addEventListener('storage', event => {
        if (event.key === STORAGE_KEY || event.key === null) setLanguage(event.newValue === 'en' ? 'en' : 'ar', false);
    });
})();
