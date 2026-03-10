import { PrismaClient, Prisma } from '@prisma/client';
import { getTemplateBySlug } from '../data/cms-templates';
interface CareerJob {
    title: string;
    titleAr: string;
    department: string;
    description: string;
    descriptionAr: string;
    aboutRole: string;
    aboutRoleAr: string;
    responsibilities: string[];
    responsibilitiesAr: string[];
    requirements: string[];
    requirementsAr: string[];
    benefits: string[];
    benefitsAr: string[];
    location: string;
    locationAr: string;
    experience: string;
    experienceAr: string;
    salary: string;
    salaryAr: string;
    date: string;
    dateAr: string;
    type: string;
    typeAr: string;
    image: string;
    slug: string;
}

const careerJobs: CareerJob[] = [
    {
        title: "Sales Manager – Automotive Filters",
        titleAr: "مدير مبيعات – فلاتر السيارات",
        department: "Sales",
        description: "Lead our automotive filters sales team and drive business growth across the Middle East region.",
        descriptionAr: "قيادة فريق مبيعات فلاتر السيارات ودفع نمو الأعمال في منطقة الشرق الأوسط.",
        aboutRole: "We are seeking an experienced Sales Manager to lead our automotive filters division. The role involves strategic planning, team management, and building strong client relationships across the Middle East.\n\nAs a Sales Manager, you will be responsible for developing and executing sales strategies, managing key accounts, and leading a team of sales professionals. You'll work closely with our technical and product teams to deliver customer-focused solutions and drive revenue growth.",
        aboutRoleAr: "نبحث عن مدير مبيعات ذو خبرة لقيادة قسم فلاتر السيارات لدينا. يتضمن الدور التخطيط الاستراتيجي وإدارة الفريق وبناء علاقات قوية مع العملاء في جميع أنحاء الشرق الأوسط.\n\nبصفتك مدير مبيعات، ستكون مسؤولاً عن تطوير وتنفيذ استراتيجيات المبيعات وإدارة الحسابات الرئيسية وقيادة فريق من المتخصصين في المبيعات.",
        responsibilities: [
            "Develop and implement strategic sales plans to achieve company targets",
            "Lead, coach and motivate the sales team to exceed monthly/quarterly targets",
            "Build and maintain strong relationships with key clients and distributors",
            "Identify new business opportunities and market trends",
            "Prepare and present forecasts, budgets and performance reports",
            "Coordinate with marketing teams to create promotional strategies",
            "Monitor competitor activities and market pricing regularly",
            "Ensure customer satisfaction and resolve any escalated issues promptly",
        ],
        responsibilitiesAr: [
            "تطوير وتنفيذ خطط مبيعات استراتيجية لتحقيق أهداف الشركة",
            "قيادة وتدريب وتحفيز فريق المبيعات لتجاوز الأهداف الشهرية/الفصلية",
            "بناء والحفاظ على علاقات قوية مع العملاء الرئيسيين والموزعين",
            "تحديد فرص الأعمال الجديدة واتجاهات السوق",
            "إعداد وتقديم التوقعات والميزانيات وتقارير الأداء",
            "التنسيق مع فرق التسويق لإنشاء استراتيجيات ترويجية",
            "مراقبة أنشطة المنافسين وأسعار السوق بانتظام",
            "ضمان رضا العملاء وحل أي مشكلات متصاعدة على الفور",
        ],
        requirements: [
            "Bachelor's degree in Business, Marketing or related field",
            "Minimum 5–7 years of sales experience in the automotive industry",
            "Proven track record of achieving sales targets and growing revenue",
            "Strong leadership and team management skills",
            "Fluency in English and Arabic preferred",
            "Excellent communication, negotiation and presentation skills",
            "Valid driver's license and willingness to travel",
            "Proficiency in CRM software and Microsoft Office",
        ],
        requirementsAr: [
            "درجة البكالوريوس في إدارة الأعمال أو التسويق أو مجال ذي صلة",
            "خبرة لا تقل عن ٥-٧ سنوات في المبيعات في صناعة السيارات",
            "سجل حافل في تحقيق أهداف المبيعات وزيادة الإيرادات",
            "مهارات قيادية قوية وإدارة الفريق",
            "إجادة اللغتين الإنجليزية والعربية مفضل",
            "مهارات ممتازة في التواصل والتفاوض والعرض",
            "رخصة قيادة سارية والاستعداد للسفر",
            "إتقان برامج CRM وMicrosoft Office",
        ],
        benefits: [
            "Competitive salary with performance-based bonuses",
            "Comprehensive health insurance for you and your family",
            "Annual leave and paid holidays",
            "Professional development and training programs",
            "Company vehicle",
            "Career growth and advancement opportunities",
        ],
        benefitsAr: [
            "راتب تنافسي مع مكافآت قائمة على الأداء",
            "تأمين صحي شامل لك ولعائلتك",
            "إجازة سنوية وعطل مدفوعة",
            "برامج التطوير المهني والتدريب",
            "سيارة الشركة",
            "فرص النمو والتقدم الوظيفي",
        ],
        location: "Riyadh, Saudi Arabia",
        locationAr: "الرياض، المملكة العربية السعودية",
        experience: "5–7 years",
        experienceAr: "٥–٧ سنوات",
        salary: "Competitive",
        salaryAr: "تنافسي",
        date: "January 10, 2026",
        dateAr: "١٠ يناير ٢٠٢٦",
        type: "FULL-TIME",
        typeAr: "دوام كامل",
        image: "/images/career/salesmanager.jpg",
        slug: "sales-manager-automotive-filters",
    },
    {
        title: "Warehouse Operations Manager",
        titleAr: "مدير عمليات المستودعات",
        department: "Operations",
        description: "Oversee warehouse operations and inventory management for our largest distribution center.",
        descriptionAr: "الإشراف على عمليات المستودعات وإدارة المخزون لأكبر مركز توزيع لدينا.",
        aboutRole: "We are looking for a Warehouse Operations Manager to oversee daily warehouse activities and ensure efficient processes. You will manage inventory flow, optimize storage solutions, and lead a team of warehouse staff.\n\nThe ideal candidate will have strong organizational skills and experience in logistics and supply chain management within the automotive or industrial sector.",
        aboutRoleAr: "نبحث عن مدير عمليات مستودعات للإشراف على أنشطة المستودع اليومية وضمان العمليات الفعالة. ستدير تدفق المخزون وتحسين حلول التخزين وقيادة فريق من موظفي المستودع.\n\nيجب أن يتمتع المرشح المثالي بمهارات تنظيمية قوية وخبرة في الخدمات اللوجستية وإدارة سلسلة التوريد.",
        responsibilities: [
            "Manage day-to-day warehouse operations and logistics",
            "Optimize inventory management processes and storage systems",
            "Ensure timely and accurate order fulfillment and shipping",
            "Lead, train, and mentor warehouse team members",
            "Implement safety protocols and maintain compliance standards",
            "Coordinate with procurement and sales teams on stock levels",
            "Monitor KPIs and generate performance reports",
            "Manage vendor relationships for logistics services",
        ],
        responsibilitiesAr: [
            "إدارة عمليات المستودعات واللوجستيات اليومية",
            "تحسين عمليات إدارة المخزون وأنظمة التخزين",
            "ضمان تنفيذ الطلبات والشحن في الوقت المحدد وبدقة",
            "قيادة وتدريب وتوجيه أعضاء فريق المستودع",
            "تنفيذ بروتوكولات السلامة والحفاظ على معايير الامتثال",
            "التنسيق مع فرق المشتريات والمبيعات بشأن مستويات المخزون",
            "مراقبة مؤشرات الأداء الرئيسية وإعداد تقارير الأداء",
            "إدارة علاقات البائعين لخدمات اللوجستيات",
        ],
        requirements: [
            "Bachelor's degree in Supply Chain, Logistics, or related field",
            "4–6 years of warehouse or operations management experience",
            "Strong knowledge of warehouse management systems (WMS)",
            "Experience with inventory control and optimization",
            "Excellent leadership and problem-solving skills",
            "Ability to work in a fast-paced environment",
            "Knowledge of safety regulations and compliance",
            "Proficiency in ERP systems and data analysis",
        ],
        requirementsAr: [
            "درجة البكالوريوس في سلسلة التوريد أو اللوجستيات أو مجال ذي صلة",
            "٤-٦ سنوات من الخبرة في إدارة المستودعات أو العمليات",
            "معرفة قوية بأنظمة إدارة المستودعات",
            "خبرة في مراقبة المخزون والتحسين",
            "مهارات قيادية ممتازة وحل المشكلات",
            "القدرة على العمل في بيئة سريعة الإيقاع",
            "معرفة بلوائح السلامة والامتثال",
            "إتقان أنظمة ERP وتحليل البيانات",
        ],
        benefits: [
            "Competitive salary package",
            "Health and dental insurance",
            "Transportation allowance",
            "Professional development opportunities",
            "Annual performance bonus",
            "Collaborative work environment",
        ],
        benefitsAr: [
            "حزمة رواتب تنافسية",
            "تأمين صحي وتأمين أسنان",
            "بدل نقل",
            "فرص التطوير المهني",
            "مكافأة أداء سنوية",
            "بيئة عمل تعاونية",
        ],
        location: "Jeddah, Saudi Arabia",
        locationAr: "جدة، المملكة العربية السعودية",
        experience: "4–6 years",
        experienceAr: "٤–٦ سنوات",
        salary: "Competitive",
        salaryAr: "تنافسي",
        date: "January 8, 2026",
        dateAr: "٨ يناير ٢٠٢٦",
        type: "FULL-TIME",
        typeAr: "دوام كامل",
        image: "/images/career/warehouseuperation.jpg",
        slug: "warehouse-operations-manager",
    },
    {
        title: "Quality Assurance Engineer",
        titleAr: "مهندس ضمان الجودة",
        department: "Quality Control",
        description: "Ensure product quality and compliance with international standards for our filtration products.",
        descriptionAr: "ضمان جودة المنتج والامتثال للمعايير الدولية لمنتجات الترشيح لدينا.",
        aboutRole: "We are seeking a Quality Assurance Engineer to maintain and improve product quality standards. You will develop testing protocols, conduct inspections, and ensure compliance with international quality certifications.\n\nThis role is critical to maintaining our reputation for excellence in the filtration industry and ensuring every product meets the highest standards.",
        aboutRoleAr: "نبحث عن مهندس ضمان الجودة للحفاظ على معايير جودة المنتج وتحسينها. ستقوم بتطوير بروتوكولات الاختبار وإجراء عمليات التفتيش وضمان الامتثال لشهاتها الجودة الدولية.\n\nهذا الدور حاسم للحفاظ على سمعتنا في التميز في صناعة الترشيح.",
        responsibilities: [
            "Develop and implement quality control procedures and standards",
            "Conduct regular product inspections and testing",
            "Analyze quality data and prepare detailed reports",
            "Collaborate with production teams to resolve quality issues",
            "Manage ISO certification and compliance audits",
            "Train staff on quality assurance best practices",
            "Investigate customer complaints and implement corrective actions",
            "Continuously improve quality processes and reduce defect rates",
        ],
        responsibilitiesAr: [
            "تطوير وتنفيذ إجراءات ومعايير مراقبة الجودة",
            "إجراء عمليات تفتيش واختبار المنتجات بانتظام",
            "تحليل بيانات الجودة وإعداد تقارير مفصلة",
            "التعاون مع فرق الإنتاج لحل مشكلات الجودة",
            "إدارة شهادات ISO ومراجعات الامتثال",
            "تدريب الموظفين على أفضل ممارسات ضمان الجودة",
            "التحقيق في شكاوى العملاء وتنفيذ الإجراءات التصحيحية",
            "تحسين عمليات الجودة باستمرار وتقليل معدلات العيوب",
        ],
        requirements: [
            "Bachelor's degree in Engineering or Quality Management",
            "3–5 years of QA experience in manufacturing or automotive",
            "Knowledge of ISO 9001, ISO/TS 16949 standards",
            "Experience with quality management tools (Six Sigma, Lean)",
            "Strong analytical and problem-solving abilities",
            "Excellent attention to detail",
            "Good communication skills in English and Arabic",
            "Certifications in quality management (CQE, CQA) preferred",
        ],
        requirementsAr: [
            "درجة البكالوريوس في الهندسة أو إدارة الجودة",
            "٣-٥ سنوات من الخبرة في ضمان الجودة في التصنيع أو السيارات",
            "معرفة بمعايير ISO 9001 وISO/TS 16949",
            "خبرة في أدوات إدارة الجودة (Six Sigma, Lean)",
            "قدرات تحليلية قوية وحل المشكلات",
            "اهتمام ممتاز بالتفاصيل",
            "مهارات تواصل جيدة باللغتين الإنجليزية والعربية",
            "شهادات في إدارة الجودة مفضلة",
        ],
        benefits: [
            "Competitive salary with annual increments",
            "Full medical and life insurance",
            "Training and certification sponsorship",
            "Work-life balance initiatives",
            "Performance-based incentives",
            "Modern and safe working environment",
        ],
        benefitsAr: [
            "راتب تنافسي مع زيادات سنوية",
            "تأمين طبي وحياة كامل",
            "رعاية التدريب والشهادات",
            "مبادرات التوازن بين العمل والحياة",
            "حوافز قائمة على الأداء",
            "بيئة عمل حديثة وآمنة",
        ],
        location: "Riyadh, Saudi Arabia",
        locationAr: "الرياض، المملكة العربية السعودية",
        experience: "3–5 years",
        experienceAr: "٣–٥ سنوات",
        salary: "Competitive",
        salaryAr: "تنافسي",
        date: "January 5, 2026",
        dateAr: "٥ يناير ٢٠٢٦",
        type: "FULL-TIME",
        typeAr: "دوام كامل",
        image: "/images/career/assuranceengineer.jpg",
        slug: "quality-assurance-engineer",
    },
    {
        title: "Automotive Service Technician",
        titleAr: "فني خدمة السيارات",
        department: "Technical Services",
        description: "Provide technical support and installation services for automotive filtration systems.",
        descriptionAr: "تقديم الدعم الفني وخدمات التركيب لأنظمة ترشيح السيارات.",
        aboutRole: "We are hiring an Automotive Service Technician to provide hands-on technical support for our filtration products. You will work directly with customers and service centers to ensure proper installation and maintenance.\n\nThe ideal candidate has a strong mechanical background and passion for the automotive industry.",
        aboutRoleAr: "نحن نوظف فني خدمة سيارات لتقديم الدعم الفني العملي لمنتجات الترشيح لدينا. ستعمل مباشرة مع العملاء ومراكز الخدمة لضمان التركيب والصيانة السليمة.\n\nيجب أن يتمتع المرشح المثالي بخلفية ميكانيكية قوية وشغف بصناعة السيارات.",
        responsibilities: [
            "Install and service automotive filtration systems",
            "Diagnose and troubleshoot technical issues",
            "Provide training to workshop staff and technicians",
            "Conduct product demonstrations for clients",
            "Maintain accurate service records and documentation",
            "Support warranty claim investigations",
            "Travel to client locations for on-site service",
            "Stay updated on latest filtration technologies",
        ],
        responsibilitiesAr: [
            "تركيب وصيانة أنظمة ترشيح السيارات",
            "تشخيص واستكشاف المشكلات التقنية وإصلاحها",
            "تقديم التدريب لموظفي الورش والفنيين",
            "إجراء عروض المنتجات للعملاء",
            "الحفاظ على سجلات الخدمة والتوثيق الدقيق",
            "دعم التحقيقات في مطالبات الضمان",
            "السفر إلى مواقع العملاء للخدمة في الموقع",
            "البقاء على اطلاع بأحدث تقنيات الترشيح",
        ],
        requirements: [
            "Technical diploma or degree in Automotive Engineering",
            "2–4 years of hands-on automotive service experience",
            "Strong knowledge of vehicle filtration systems",
            "Excellent troubleshooting and diagnostic skills",
            "Customer-oriented with good communication skills",
            "Willingness to travel frequently",
            "Valid driver's license",
            "Physical fitness for hands-on technical work",
        ],
        requirementsAr: [
            "دبلوم تقني أو درجة في هندسة السيارات",
            "٢-٤ سنوات من الخبرة العملية في خدمة السيارات",
            "معرفة قوية بأنظمة ترشيح المركبات",
            "مهارات ممتازة في استكشاف الأخطاء والتشخيص",
            "موجه للعملاء مع مهارات تواصل جيدة",
            "الاستعداد للسفر بشكل متكرر",
            "رخصة قيادة سارية",
            "لياقة بدنية للعمل التقني العملي",
        ],
        benefits: [
            "Competitive hourly/monthly compensation",
            "Tool and equipment allowance",
            "Health insurance coverage",
            "On-the-job training and certifications",
            "Travel and accommodation allowance",
            "Growth path to senior technical roles",
        ],
        benefitsAr: [
            "تعويض تنافسي بالساعة/الشهر",
            "بدل أدوات ومعدات",
            "تغطية التأمين الصحي",
            "تدريب وشهادات أثناء العمل",
            "بدل سفر وإقامة",
            "مسار نمو إلى أدوار تقنية أعلى",
        ],
        location: "Dammam, Saudi Arabia",
        locationAr: "الدمام، المملكة العربية السعودية",
        experience: "2–4 years",
        experienceAr: "٢–٤ سنوات",
        salary: "Competitive",
        salaryAr: "تنافسي",
        date: "December 28, 2025",
        dateAr: "٢٨ ديسمبر ٢٠٢٥",
        type: "FULL-TIME",
        typeAr: "دوام كامل",
        image: "/images/career/automotiveservice.jpg",
        slug: "automotive-service-technician",
    },
    {
        title: "Marketing Coordinator",
        titleAr: "منسق تسويق",
        department: "Marketing",
        description: "Execute marketing campaigns and manage brand presence across digital and traditional channels.",
        descriptionAr: "تنفيذ الحملات التسويقية وإدارة الحضور العلامة التجارية عبر القنوات الرقمية والتقليدية.",
        aboutRole: "We are looking for a creative Marketing Coordinator to help execute our marketing strategies. You will manage campaigns, create content, and coordinate events to strengthen our brand positioning.\n\nThis is an exciting opportunity for a marketing professional looking to grow in a dynamic and fast-paced environment.",
        aboutRoleAr: "نبحث عن منسق تسويق مبدع للمساعدة في تنفيذ استراتيجيات التسويق لدينا. ستدير الحملات وتنشئ المحتوى وتنسق الفعاليات لتعزيز موقع علامتنا التجارية.\n\nهذه فرصة مثيرة لمحترف تسويق يتطلع للنمو في بيئة ديناميكية وسريعة الإيقاع.",
        responsibilities: [
            "Plan and execute digital and offline marketing campaigns",
            "Manage social media accounts and content calendar",
            "Coordinate trade shows, exhibitions, and events",
            "Create marketing materials (brochures, presentations, ads)",
            "Analyze campaign performance and generate reports",
            "Collaborate with sales team on lead generation",
            "Manage website content and SEO initiatives",
            "Support brand development and positioning strategy",
        ],
        responsibilitiesAr: [
            "تخطيط وتنفيذ حملات التسويق الرقمي والتقليدي",
            "إدارة حسابات التواصل الاجتماعي وتقويم المحتوى",
            "تنسيق المعارض التجارية والمعارض والفعاليات",
            "إنشاء مواد تسويقية (كتيبات، عروض تقديمية، إعلانات)",
            "تحليل أداء الحملات وإعداد التقارير",
            "التعاون مع فريق المبيعات في توليد العملاء المحتملين",
            "إدارة محتوى الموقع ومبادرات تحسين محركات البحث",
            "دعم تطوير العلامة التجارية واستراتيجية التموضع",
        ],
        requirements: [
            "Bachelor's degree in Marketing, Communications, or related field",
            "1–3 years of marketing experience",
            "Proficiency in digital marketing tools and platforms",
            "Experience with graphic design tools (Canva, Adobe Suite)",
            "Strong writing and content creation skills",
            "Knowledge of SEO and social media analytics",
            "Creative mindset with attention to detail",
            "Bilingual (English and Arabic) preferred",
        ],
        requirementsAr: [
            "درجة البكالوريوس في التسويق أو الاتصالات أو مجال ذي صلة",
            "١-٣ سنوات من الخبرة في التسويق",
            "إتقان أدوات ومنصات التسويق الرقمي",
            "خبرة في أدوات التصميم الجرافيكي",
            "مهارات كتابة وإنشاء محتوى قوية",
            "معرفة بتحسين محركات البحث وتحليلات التواصل الاجتماعي",
            "عقلية إبداعية مع الاهتمام بالتفاصيل",
            "ثنائي اللغة (الإنجليزية والعربية) مفضل",
        ],
        benefits: [
            "Competitive salary package",
            "Health and wellness benefits",
            "Creative and dynamic work environment",
            "Professional development courses",
            "Flexible working arrangements",
            "Team building and social events",
        ],
        benefitsAr: [
            "حزمة رواتب تنافسية",
            "فوائد صحية وعافية",
            "بيئة عمل إبداعية وديناميكية",
            "دورات التطوير المهني",
            "ترتيبات عمل مرنة",
            "فعاليات بناء الفريق والفعاليات الاجتماعية",
        ],
        location: "Riyadh, Saudi Arabia",
        locationAr: "الرياض، المملكة العربية السعودية",
        experience: "1–3 years",
        experienceAr: "١–٣ سنوات",
        salary: "Competitive",
        salaryAr: "تنافسي",
        date: "December 20, 2025",
        dateAr: "٢٠ ديسمبر ٢٠٢٥",
        type: "FULL-TIME",
        typeAr: "دوام كامل",
        image: "/images/career/marketingcoordiantor.jpg",
        slug: "marketing-coordinator",
    },
    {
        title: "Account Manager",
        titleAr: "مدير حسابات",
        department: "Sales",
        description: "Manage and grow relationships with key accounts in the industrial filtration sector.",
        descriptionAr: "إدارة وتنمية العلاقات مع الحسابات الرئيسية في قطاع الترشيح الصناعي.",
        aboutRole: "We are looking for an experienced Account Manager to manage and grow key client relationships. You will serve as the primary point of contact, ensuring client satisfaction and identifying opportunities for upselling.\n\nThe ideal candidate will have a consultative sales approach and deep understanding of the industrial filtration market.",
        aboutRoleAr: "نبحث عن مدير حسابات ذو خبرة لإدارة وتنمية علاقات العملاء الرئيسيين. ستكون نقطة الاتصال الأساسية، لضمان رضا العملاء وتحديد فرص البيع الإضافي.\n\nيجب أن يتمتع المرشح المثالي بنهج مبيعات استشاري وفهم عميق لسوق الترشيح الصناعي.",
        responsibilities: [
            "Manage a portfolio of key industrial accounts",
            "Build and maintain long-term client relationships",
            "Identify upselling and cross-selling opportunities",
            "Prepare proposals, quotations, and contracts",
            "Coordinate with internal teams to deliver solutions",
            "Monitor account performance and revenue targets",
            "Resolve client issues and ensure satisfaction",
            "Provide market feedback and competitive intelligence",
        ],
        responsibilitiesAr: [
            "إدارة محفظة من الحسابات الصناعية الرئيسية",
            "بناء والحفاظ على علاقات عملاء طويلة المدى",
            "تحديد فرص البيع الإضافي والبيع المتبادل",
            "إعداد العروض والاقتباسات والعقود",
            "التنسيق مع الفرق الداخلية لتقديم الحلول",
            "مراقبة أداء الحساب وأهداف الإيرادات",
            "حل مشكلات العملاء وضمان الرضا",
            "تقديم ملاحظات السوق والاستخبارات التنافسية",
        ],
        requirements: [
            "Bachelor's degree in Business Administration or related field",
            "3–5 years of account management or B2B sales experience",
            "Experience in industrial or automotive sector preferred",
            "Strong negotiation and relationship management skills",
            "Excellent presentation and communication abilities",
            "Self-motivated with ability to work independently",
            "CRM proficiency (Salesforce, HubSpot, etc.)",
            "Willingness to travel within the region",
        ],
        requirementsAr: [
            "درجة البكالوريوس في إدارة الأعمال أو مجال ذي صلة",
            "٣-٥ سنوات من الخبرة في إدارة الحسابات أو مبيعات B2B",
            "خبرة في القطاع الصناعي أو السيارات مفضل",
            "مهارات قوية في التفاوض وإدارة العلاقات",
            "قدرات ممتازة في العرض والتواصل",
            "متحفز ذاتياً مع القدرة على العمل بشكل مستقل",
            "إتقان CRM (Salesforce, HubSpot, إلخ)",
            "الاستعداد للسفر داخل المنطقة",
        ],
        benefits: [
            "Attractive base salary plus commission",
            "Comprehensive health benefits",
            "Annual bonus based on performance",
            "Professional networking opportunities",
            "Career advancement pathways",
            "Supportive and inclusive team culture",
        ],
        benefitsAr: [
            "راتب أساسي جذاب بالإضافة إلى العمولة",
            "مزايا صحية شاملة",
            "مكافأة سنوية بناءً على الأداء",
            "فرص التواصل المهني",
            "مسارات التقدم الوظيفي",
            "ثقافة فريق داعمة وشاملة",
        ],
        location: "Jeddah, Saudi Arabia",
        locationAr: "جدة، المملكة العربية السعودية",
        experience: "3–5 years",
        experienceAr: "٣–٥ سنوات",
        salary: "Competitive",
        salaryAr: "تنافسي",
        date: "December 15, 2025",
        dateAr: "١٥ ديسمبر ٢٠٢٥",
        type: "FULL-TIME",
        typeAr: "دوام كامل",
        image: "/images/career/accountmanager.jpg",
        slug: "account-manager",
    }
];

const prisma = new PrismaClient();

async function run() {
  console.log('--- Starting Career CMS Data Migration ---');

  const pageSlug = 'career';
  const template = getTemplateBySlug(pageSlug);

  if (!template) {
    console.error(`ERROR: Template not found for slug '${pageSlug}'`);
    process.exit(1);
  }

  // Transform static job data
  const formattedJobs = careerJobs.map(job => {
    return {
      titleEn: job.title,
      titleAr: job.titleAr,
      department: job.department,
      locationEn: job.location,
      locationAr: job.locationAr,
      typeEn: job.type,
      typeAr: job.typeAr,
      salaryEn: job.salary,
      salaryAr: job.salaryAr,
      experienceEn: job.experience,
      experienceAr: job.experienceAr,
      dateEn: job.date,
      dateAr: job.dateAr,
      image: job.image,
      slug: job.slug,
      descriptionEn: job.description,
      descriptionAr: job.descriptionAr,
      aboutRoleEn: `<p>${job.aboutRole.replace(/\n\n/g, '</p><p>')}</p>`,
      aboutRoleAr: `<p>${job.aboutRoleAr.replace(/\n\n/g, '</p><p>')}</p>`,
      responsibilitiesEnHtml: `<ul>${job.responsibilities.map(r => `<li>${r}</li>`).join('')}</ul>`,
      responsibilitiesArHtml: `<ul>${job.responsibilitiesAr.map(r => `<li>${r}</li>`).join('')}</ul>`,
      requirementsEnHtml: `<ul>${job.requirements.map(r => `<li>${r}</li>`).join('')}</ul>`,
      requirementsArHtml: `<ul>${job.requirementsAr.map(r => `<li>${r}</li>`).join('')}</ul>`,
      benefitsEnHtml: `<ul>${job.benefits.map(b => `<li>${b}</li>`).join('')}</ul>`,
      benefitsArHtml: `<ul>${job.benefitsAr.map(b => `<li>${b}</li>`).join('')}</ul>`,
      viewDetailsButtonEn: "View Details",
      viewDetailsButtonAr: "عرض التفاصيل"
    };
  });

  const newData = {
    ...template.defaultContent, 
    jobs: formattedJobs         
  };

  // Convert to explicitly generic Prisma Json object
  const safeData = JSON.parse(JSON.stringify(newData)) as Prisma.InputJsonValue;
  const safeSchema = JSON.stringify(template.schema);

  console.log(`Mapping ${formattedJobs.length} jobs to pure Prisma JSON...`);

  try {
    const cmsPage = await prisma.cMSPage.findUnique({ where: { slug: pageSlug } });
    
    if (cmsPage) {
        await prisma.cMSPage.update({
          where: { id: cmsPage.id },
          data: {
            contentJson: safeData,
            content: JSON.stringify(safeData),
            schema: safeSchema,
          }
        });
        console.log(`--- Migration Complete (UPDATED existing) ---`);
    } else {
        const adminUser = await prisma.user.findFirst({ where: { role: { name: 'admin' } } });
        const adminId = adminUser ? adminUser.id : 'system-migration';

        await prisma.cMSPage.create({
          data: {
            slug: pageSlug,
            title: template.title,
            contentJson: safeData,
            content: JSON.stringify(safeData),
            schema: safeSchema,
            versions: {
                create: {
                    content: JSON.stringify(safeData),
                    contentJson: safeData,
                    version: 1,
                    createdBy: adminId
                }
            }
          }
        });
        console.log(`--- Migration Complete (CREATED new) ---`);
    }
  } catch (e: any) {
    console.error("Prisma Validation Error Details:");
    console.error(e.message);
    const fs = require('fs');
    fs.writeFileSync('prisma-error-payload.json', JSON.stringify(safeData, null, 2));
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
