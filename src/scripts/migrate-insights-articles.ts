import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// Simple markdown-to-HTML converter for article content
function markdownToHtml(md: string): string {
  const lines = md.split('\n');
  let html = '';
  let inList = false;
  let listType = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (inList) { html += `</${listType}>`; inList = false; }
      continue;
    }

    // Headers
    if (trimmed.startsWith('### ')) {
      if (inList) { html += `</${listType}>`; inList = false; }
      html += `<h3>${trimmed.replace('### ', '')}</h3>`;
      continue;
    }
    if (trimmed.startsWith('## ')) {
      if (inList) { html += `</${listType}>`; inList = false; }
      html += `<h2>${trimmed.replace('## ', '')}</h2>`;
      continue;
    }

    // Ordered list items: "1. **text** rest"
    const orderedMatch = trimmed.match(/^\d+\.\s\*\*(.+?)\*\*\s*(.*)$/);
    if (orderedMatch) {
      if (!inList || listType !== 'ol') {
        if (inList) html += `</${listType}>`;
        html += '<ol>';
        inList = true;
        listType = 'ol';
      }
      html += `<li><strong>${orderedMatch[1]}</strong>${orderedMatch[2] ? ' ' + orderedMatch[2] : ''}</li>`;
      continue;
    }

    // Unordered list items with bold: "- **text**: rest"
    const boldListMatch = trimmed.match(/^- \*\*(.+?)\*\*:?\s*(.*)$/);
    if (boldListMatch) {
      if (!inList || listType !== 'ul') {
        if (inList) html += `</${listType}>`;
        html += '<ul>';
        inList = true;
        listType = 'ul';
      }
      html += `<li><strong>${boldListMatch[1]}</strong>${boldListMatch[2] ? ': ' + boldListMatch[2] : ''}</li>`;
      continue;
    }

    // Plain unordered list items: "- text"
    if (trimmed.startsWith('- ')) {
      if (!inList || listType !== 'ul') {
        if (inList) html += `</${listType}>`;
        html += '<ul>';
        inList = true;
        listType = 'ul';
      }
      html += `<li>${trimmed.replace('- ', '')}</li>`;
      continue;
    }

    // Regular paragraph — process inline bold/italic
    if (inList) { html += `</${listType}>`; inList = false; }
    let text = trimmed;
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html += `<p>${text}</p>`;
  }

  if (inList) html += `</${listType}>`;
  return html;
}

interface InsightArticle {
  title: string;
  titleAr: string;
  description: string;
  descriptionAr: string;
  content: string;
  contentAr: string;
  image: string;
  date: string;
  dateAr: string;
  readTime: string;
  readTimeAr: string;
  author: string;
  authorAr: string;
  category: string;
  slug: string;
}

const insightArticles: InsightArticle[] = [
  {
    title: "Understanding Automotive Filter Maintenance",
    titleAr: "فهم صيانة فلاتر السيارات",
    description: "Learn the essential practices for maintaining your vehicle's filters to ensure optimal performance and longevity.",
    descriptionAr: "تعرف على الممارسات الأساسية لصيانة فلاتر سيارتك لضمان الأداء الأمثل وطول العمر.",
    content: `Maintaining your vehicle's filters is crucial for ensuring optimal performance and extending the life of your engine. In this comprehensive guide, we'll cover everything you need to know about automotive filter maintenance.

## Why Filter Maintenance Matters

Filters play a critical role in protecting your engine from contaminants. A clogged or dirty filter can reduce fuel efficiency, decrease engine performance, and even cause long-term damage to your vehicle.

## Types of Automotive Filters

### Air Filters
Air filters prevent dust, debris, and other particles from entering your engine. They should be inspected every 12,000-15,000 miles and replaced as needed.

### Oil Filters
Oil filters remove contaminants from your engine oil, helping to keep your engine running smoothly. Most manufacturers recommend changing the oil filter with every oil change.

### Fuel Filters
Fuel filters prevent impurities in the fuel from reaching the engine. They typically need replacement every 20,000-40,000 miles.

### Cabin Air Filters
Cabin air filters clean the air that enters your vehicle's interior through the heating and air conditioning system. They should be replaced every 15,000-25,000 miles.

## Best Practices for Filter Maintenance

1. **Follow your manufacturer's recommendations** for filter replacement intervals
2. **Use quality replacement filters** that meet or exceed OEM specifications
3. **Inspect filters regularly** during routine maintenance checks
4. **Keep records** of when filters were last replaced
5. **Don't ignore warning signs** like reduced performance or unusual engine sounds`,
    contentAr: `صيانة فلاتر سيارتك أمر بالغ الأهمية لضمان الأداء الأمثل وإطالة عمر المحرك. في هذا الدليل الشامل، سنغطي كل ما تحتاج معرفته عن صيانة فلاتر السيارات.

## لماذا تعتبر صيانة الفلاتر مهمة

تلعب الفلاتر دوراً حاسماً في حماية محركك من الملوثات. يمكن أن يؤدي الفلتر المسدود أو المتسخ إلى تقليل كفاءة الوقود وتقليل أداء المحرك وحتى التسبب في أضرار طويلة المدى لسيارتك.

## أنواع فلاتر السيارات

### فلاتر الهواء
تمنع فلاتر الهواء الغبار والحطام والجسيمات الأخرى من دخول محركك. يجب فحصها كل 12,000-15,000 ميل واستبدالها حسب الحاجة.

### فلاتر الزيت
تزيل فلاتر الزيت الملوثات من زيت المحرك، مما يساعد في الحفاظ على تشغيل المحرك بسلاسة.

### فلاتر الوقود
تمنع فلاتر الوقود الشوائب في الوقود من الوصول إلى المحرك.

### فلاتر هواء المقصورة
تنظف فلاتر هواء المقصورة الهواء الذي يدخل داخل سيارتك.`,
    image: "/images/insight/automotivefilter.jpg",
    date: "January 8, 2026",
    dateAr: "٨ يناير ٢٠٢٦",
    readTime: "5 min read",
    readTimeAr: "٥ دقائق قراءة",
    author: "Sarah Thompson",
    authorAr: "سارة طومسون",
    category: "Maintenance",
    slug: "understanding-automotive-filter-maintenance",
  },
  {
    title: "The Ultimate Guide to Engine Parts",
    titleAr: "الدليل الشامل لأجزاء المحرك",
    description: "Explore the critical components that keep your engine running efficiently and how to maintain them.",
    descriptionAr: "استكشف المكونات الحيوية التي تحافظ على تشغيل محركك بكفاءة وكيفية صيانتها.",
    content: `Your engine is the heart of your vehicle, and understanding its components is key to proper maintenance. In this guide, we'll explore the critical parts that keep your engine running efficiently.

## Core Engine Components

### Pistons and Cylinders
Pistons move up and down within the cylinders, converting fuel energy into mechanical motion. Regular maintenance ensures they operate within optimal tolerances.

### Crankshaft
The crankshaft converts the linear motion of the pistons into rotational motion that drives the wheels. It must be precisely balanced for smooth operation.

### Camshaft
The camshaft controls the opening and closing of the engine valves, ensuring proper timing for the combustion process.

## Filtration Components

### Engine Air Filter
The air filter is the first line of defense against contaminants entering your engine. A clean air filter ensures optimal air-fuel mixture for combustion.

### Oil Filter
The oil filter removes microscopic particles from your engine oil, preventing wear on critical components.

## Maintenance Tips

1. **Regular oil changes** are the single most important maintenance task
2. **Monitor fluid levels** including coolant, brake fluid, and transmission fluid
3. **Listen for unusual sounds** that may indicate worn components
4. **Follow the service schedule** outlined in your owner's manual`,
    contentAr: `محركك هو قلب سيارتك، وفهم مكوناته هو مفتاح الصيانة السليمة. في هذا الدليل، سنستكشف الأجزاء الحيوية التي تحافظ على تشغيل محركك بكفاءة.

## مكونات المحرك الأساسية

### المكابس والأسطوانات
تتحرك المكابس لأعلى ولأسفل داخل الأسطوانات، محولة طاقة الوقود إلى حركة ميكانيكية.

### عمود المرفق
يحول عمود المرفق الحركة الخطية للمكابس إلى حركة دورانية تقود العجلات.

### عمود الكامات
يتحكم عمود الكامات في فتح وإغلاق صمامات المحرك.

## مكونات الترشيح

### فلتر هواء المحرك
فلتر الهواء هو خط الدفاع الأول ضد الملوثات التي تدخل محركك.

### فلتر الزيت
يزيل فلتر الزيت الجسيمات المجهرية من زيت محركك.`,
    image: "/images/insight/engineparts.jpg",
    date: "January 5, 2026",
    dateAr: "٥ يناير ٢٠٢٦",
    readTime: "7 min read",
    readTimeAr: "٧ دقائق قراءة",
    author: "Michael Chen",
    authorAr: "مايكل تشن",
    category: "Technical",
    slug: "ultimate-guide-engine-parts",
  },
  {
    title: "Industrial Filtration Systems Explained",
    titleAr: "شرح أنظمة الترشيح الصناعية",
    description: "Discover how industrial filtration systems work and their importance in manufacturing environments.",
    descriptionAr: "اكتشف كيف تعمل أنظمة الترشيح الصناعية وأهميتها في بيئات التصنيع.",
    content: `Industrial filtration systems are essential to modern manufacturing processes. They ensure product quality, protect equipment, and maintain safe working environments.

## Types of Industrial Filtration

### Bag Filters
Bag filters use fabric bags to capture particulate matter from gas streams. They are widely used in power plants, cement factories, and steel mills.

### Cartridge Filters
Cartridge filters provide high-efficiency filtration in a compact design. They're ideal for applications requiring fine particle removal.

### HEPA Filters
High-Efficiency Particulate Air filters capture 99.97% of particles as small as 0.3 microns. They're used in clean rooms, hospitals, and pharmaceutical manufacturing.

## Benefits of Proper Industrial Filtration

1. **Product quality improvement** through contamination control
2. **Equipment protection** by removing abrasive particles
3. **Regulatory compliance** with environmental standards
4. **Worker safety** by maintaining clean air quality
5. **Cost savings** through reduced maintenance and downtime`,
    contentAr: `أنظمة الترشيح الصناعية ضرورية لعمليات التصنيع الحديثة. فهي تضمن جودة المنتج وتحمي المعدات وتحافظ على بيئات عمل آمنة.

## أنواع الترشيح الصناعي

### فلاتر الأكياس
تستخدم فلاتر الأكياس أكياساً من القماش لالتقاط المواد الجسيمية من تيارات الغاز.

### فلاتر الخراطيش
توفر فلاتر الخراطيش ترشيحاً عالي الكفاءة في تصميم مدمج.

### فلاتر HEPA
تلتقط فلاتر الهواء عالية الكفاءة 99.97% من الجسيمات الصغيرة حتى 0.3 ميكرون.

## فوائد الترشيح الصناعي السليم

1. تحسين جودة المنتج من خلال التحكم في التلوث
2. حماية المعدات عن طريق إزالة الجسيمات الكاشطة
3. الامتثال التنظيمي للمعايير البيئية`,
    image: "/images/insight/industriafilteration.jpg",
    date: "December 28, 2025",
    dateAr: "٢٨ ديسمبر ٢٠٢٥",
    readTime: "6 min read",
    readTimeAr: "٦ دقائق قراءة",
    author: "David Rodriguez",
    authorAr: "ديفيد رودريغيز",
    category: "Industrial",
    slug: "industrial-filtration-systems-explained",
  },
  {
    title: "Oil Filter Replacement: A Step-by-Step Guide",
    titleAr: "استبدال فلتر الزيت: دليل خطوة بخطوة",
    description: "Master the art of oil filter replacement with this comprehensive guide for vehicle owners.",
    descriptionAr: "أتقن فن استبدال فلتر الزيت مع هذا الدليل الشامل لأصحاب السيارات.",
    content: `Replacing your oil filter is one of the most important maintenance tasks you can perform on your vehicle. This step-by-step guide will walk you through the process.

## Tools You'll Need

- New oil filter (check your owner's manual for the correct specifications)
- Oil filter wrench
- Drain pan
- New engine oil
- Funnel
- Clean rags or paper towels

## Step-by-Step Instructions

### Step 1: Prepare Your Vehicle
Park on a level surface and allow the engine to cool for at least 15 minutes. Engage the parking brake and place wheel chocks if needed.

### Step 2: Locate the Oil Filter
Refer to your owner's manual to find the exact location of the oil filter. It's typically on the side or bottom of the engine.

### Step 3: Drain the Old Oil
Place the drain pan under the oil drain plug. Remove the plug and allow all the oil to drain completely.

### Step 4: Remove the Old Filter
Use the oil filter wrench to loosen the old filter. Remove it carefully to avoid spilling oil.

### Step 5: Install the New Filter
Apply a thin coat of new oil to the gasket on the new filter. Screw the new filter on hand-tight, then give it an additional 3/4 turn.

### Step 6: Refill with New Oil
Replace the drain plug and pour in the recommended amount of new oil using the funnel.

### Step 7: Check for Leaks
Start the engine and let it run for a few minutes. Check around the filter and drain plug for any leaks.`,
    contentAr: `استبدال فلتر الزيت هو أحد أهم مهام الصيانة التي يمكنك القيام بها على سيارتك. سيرشدك هذا الدليل خطوة بخطوة خلال العملية.

## الأدوات التي ستحتاجها

- فلتر زيت جديد
- مفتاح فلتر الزيت
- وعاء تصريف
- زيت محرك جديد
- قمع
- خرق نظيفة

## تعليمات خطوة بخطوة

### الخطوة 1: جهز سيارتك
اركن على سطح مستوٍ واترك المحرك يبرد لمدة 15 دقيقة على الأقل.

### الخطوة 2: حدد موقع فلتر الزيت
ارجع إلى دليل المالك لمعرفة الموقع الدقيق لفلتر الزيت.

### الخطوة 3: صرف الزيت القديم
ضع وعاء التصريف تحت سدادة تصريف الزيت.

### الخطوة 4: أزل الفلتر القديم
استخدم مفتاح فلتر الزيت لفك الفلتر القديم.

### الخطوة 5: ركب الفلتر الجديد
ضع طبقة رقيقة من الزيت الجديد على حشية الفلتر الجديد.`,
    image: "/images/insight/oilfilter.jpg",
    date: "December 22, 2025",
    dateAr: "٢٢ ديسمبر ٢٠٢٥",
    readTime: "8 min read",
    readTimeAr: "٨ دقائق قراءة",
    author: "Jessica Martinez",
    authorAr: "جيسيكا مارتينيز",
    category: "DIY Guides",
    slug: "oil-filter-replacement-guide",
  },
  {
    title: "Optimizing Your Auto Parts Inventory",
    titleAr: "تحسين مخزون قطع غيار السيارات",
    description: "Learn effective strategies for managing auto parts inventory to improve efficiency and reduce costs.",
    descriptionAr: "تعلم استراتيجيات فعالة لإدارة مخزون قطع غيار السيارات لتحسين الكفاءة وتقليل التكاليف.",
    content: `Managing auto parts inventory effectively is crucial for any automotive business. Whether you run a small repair shop or a large dealership, proper inventory management can significantly impact your bottom line.

## Key Strategies for Inventory Optimization

### 1. Implement a Digital Inventory System
Modern inventory management software can track stock levels in real-time, automate reordering, and provide valuable analytics.

### 2. Use ABC Analysis
Categorize your inventory based on value and movement:
- **A items**: High-value, fast-moving parts (filters, brake pads, oil)
- **B items**: Medium-value, moderate-moving parts
- **C items**: Low-value, slow-moving parts

### 3. Set Reorder Points
Establish minimum stock levels for each part based on:
- Average daily usage
- Lead time from suppliers
- Safety stock requirements

### 4. Build Strong Supplier Relationships
Reliable suppliers are key to maintaining consistent inventory levels. Negotiate favorable terms and establish backup suppliers for critical parts.

### 5. Regular Inventory Audits
Conduct physical inventory counts regularly to ensure accuracy between your system and actual stock levels.

## Benefits of Optimized Inventory

1. **Reduced carrying costs** from excess inventory
2. **Fewer stockouts** that lead to lost sales
3. **Improved cash flow** management
4. **Better customer satisfaction** through parts availability`,
    contentAr: `إدارة مخزون قطع غيار السيارات بفعالية أمر بالغ الأهمية لأي عمل في مجال السيارات.

## استراتيجيات رئيسية لتحسين المخزون

### 1. تطبيق نظام مخزون رقمي
يمكن لبرامج إدارة المخزون الحديثة تتبع مستويات المخزون في الوقت الفعلي.

### 2. استخدام تحليل ABC
صنف مخزونك بناءً على القيمة والحركة.

### 3. تحديد نقاط إعادة الطلب
حدد مستويات المخزون الدنيا لكل قطعة.

### 4. بناء علاقات قوية مع الموردين
الموردون الموثوقون هم مفتاح الحفاظ على مستويات المخزون المتسقة.

### 5. مراجعات المخزون المنتظمة
قم بإجراء عمليات جرد مادي بانتظام.`,
    image: "/images/insight/autopartsinventory.jpg",
    date: "December 15, 2025",
    dateAr: "١٥ ديسمبر ٢٠٢٥",
    readTime: "6 min read",
    readTimeAr: "٦ دقائق قراءة",
    author: "Robert Johnson",
    authorAr: "روبرت جونسون",
    category: "Business",
    slug: "optimizing-auto-parts-inventory",
  },
  {
    title: "Essential Vehicle Maintenance Tips for Winter",
    titleAr: "نصائح أساسية لصيانة السيارة في الشتاء",
    description: "Prepare your vehicle for winter with these essential maintenance tips to ensure safe and reliable performance.",
    descriptionAr: "جهز سيارتك لفصل الشتاء مع هذه النصائح الأساسية للصيانة لضمان أداء آمن وموثوق.",
    content: `Winter driving presents unique challenges for your vehicle. Proper preparation can make the difference between a safe journey and a breakdown in freezing conditions.

## Pre-Winter Checklist

### Battery Check
Cold weather puts extra strain on your battery. Have it tested to ensure it can handle winter starting demands. Replace batteries older than 3-4 years.

### Tire Inspection
Check tire tread depth and consider switching to winter tires for better traction. Maintain proper tire pressure, which decreases in cold weather.

### Fluid Checks
- **Antifreeze/Coolant**: Ensure proper concentration for your climate
- **Windshield Washer Fluid**: Use winter-grade fluid rated for freezing temperatures
- **Engine Oil**: Consider switching to a lower viscosity oil for cold starts

### Filter Replacement
Replace your engine air filter and cabin air filter before winter. Clean filters ensure proper airflow and heating performance.

### Brake Inspection
Have your brakes inspected to ensure they're in good condition. Winter driving requires reliable stopping power.

## Winter Driving Tips

1. **Keep your gas tank at least half full** to prevent fuel line freezing
2. **Carry an emergency kit** with blankets, flashlight, and basic tools
3. **Allow extra time for warming up** your engine
4. **Clear all snow and ice** from your vehicle before driving
5. **Maintain a safe following distance** on slippery roads`,
    contentAr: `القيادة في الشتاء تقدم تحديات فريدة لسيارتك. التحضير السليم يمكن أن يصنع الفرق بين رحلة آمنة وعطل في ظروف التجمد.

## قائمة التحقق قبل الشتاء

### فحص البطارية
الطقس البارد يضع ضغطاً إضافياً على بطاريتك. قم باختبارها للتأكد من قدرتها على التعامل مع متطلبات التشغيل الشتوية.

### فحص الإطارات
تحقق من عمق مداس الإطار وفكر في التبديل إلى إطارات شتوية.

### فحوصات السوائل
- سائل التبريد: تأكد من التركيز المناسب لمناخك
- سائل غسيل الزجاج الأمامي: استخدم سائلاً شتوياً
- زيت المحرك: فكر في التبديل إلى زيت أقل لزوجة

### استبدال الفلاتر
استبدل فلتر هواء المحرك وفلتر هواء المقصورة قبل الشتاء.

### فحص الفرامل
قم بفحص فراملك للتأكد من أنها في حالة جيدة.`,
    image: "/images/insight/vehicelmaintenance.jpg",
    date: "December 10, 2025",
    dateAr: "١٠ ديسمبر ٢٠٢٥",
    readTime: "7 min read",
    readTimeAr: "٧ دقائق قراءة",
    author: "Emily Watson",
    authorAr: "إيميلي واتسون",
    category: "Maintenance",
    slug: "essential-vehicle-maintenance-winter",
  },
];

async function run() {
  console.log('--- Starting Insights CMS Data Migration ---');

  const pageSlug = 'insights';

  // Transform static article data
  const formattedArticles = insightArticles.map(article => {
    return {
      title: article.title, // schema uses 'title' for English
      titleAr: article.titleAr,
      description: article.description, // schema uses 'description' for English
      descriptionAr: article.descriptionAr,
      contentEn: markdownToHtml(article.content), // schema uses 'contentEn'
      contentAr: markdownToHtml(article.contentAr), // schema uses 'contentAr'
      image: article.image,
      date: article.date, // schema uses 'date' for English
      dateAr: article.dateAr,
      readTime: article.readTime, // schema uses 'readTime' for English
      readTimeAr: article.readTimeAr,
      author: article.author, // schema uses 'author' for English
      authorAr: article.authorAr,
      category: article.category,
      slug: article.slug,
    };
  });

  console.log(`Transformed ${formattedArticles.length} articles with HTML content.`);

  try {
    const cmsPage = await prisma.cMSPage.findUnique({ where: { slug: pageSlug } });

    const categories = [
      { labelEn: "All", labelAr: "الكل", value: "All" },
      { labelEn: "Maintenance", labelAr: "الصيانة", value: "Maintenance" },
      { labelEn: "Technical", labelAr: "تقني", value: "Technical" },
      { labelEn: "Industrial", labelAr: "صناعي", value: "Industrial" },
      { labelEn: "DIY Guides", labelAr: "أدلة DIY", value: "DIY Guides" },
      { labelEn: "Business", labelAr: "أعمال", value: "Business" },
    ];

    const sectionHeader = {
      titleEn: "Latest Insights",
      titleAr: "أحدث المقالات",
      descriptionEn: "Stay informed with the latest news, tips, and insights from Filters Experts",
      descriptionAr: "ابقَ على اطلاع بأحدث الأخبار والنصائح والرؤى من خبراء الفلاتر"
    };

    if (cmsPage) {
      // Merge with existing contentJson to preserve banner data if exists
      const existingContent = (cmsPage.contentJson as any) || {};
      const newData = {
        ...existingContent,
        sectionHeader: sectionHeader,
        categories: categories,
        insights: formattedArticles, // Key must be 'insights' per schema
      };

      const safeData = JSON.parse(JSON.stringify(newData)) as Prisma.InputJsonValue;

      await prisma.cMSPage.update({
        where: { id: cmsPage.id },
        data: {
          contentJson: safeData,
          content: JSON.stringify(safeData),
        }
      });
      console.log(`--- Migration Complete (UPDATED existing '${pageSlug}' page) ---`);
    } else {
      const newData = {
        banner: {
          titleEn: "Insights",
          titleAr: "رؤانا",
          backgroundImage: "/images/insight/insightbanner.jpg",
        },
        sectionHeader: sectionHeader,
        categories: categories,
        insights: formattedArticles, // Key must be 'insights' per schema
      };
      const safeData = JSON.parse(JSON.stringify(newData)) as Prisma.InputJsonValue;

      await prisma.cMSPage.create({
        data: {
          slug: pageSlug,
          title: 'Insights',
          contentJson: safeData,
          content: JSON.stringify(safeData),
          schema: '[]', // Note: schema fix is handled separately via raw update if needed
        }
      });
      console.log(`--- Migration Complete (CREATED new '${pageSlug}' page) ---`);
    }
  } catch (e: any) {
    console.error("Prisma Error Details:");
    console.error(e.message);
    process.exit(1);
  }
}

run()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
