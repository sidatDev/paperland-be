import { PrismaClient } from '@prisma/client';
import { CMS_TEMPLATES } from '../data/cms-templates';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting Contact Us & Outlets Migration...');

    const outletsTemplate = CMS_TEMPLATES.find(t => t.slug === 'outlets');
    const contactUsTemplate = CMS_TEMPLATES.find(t => t.slug === 'contact-us');

    if (!outletsTemplate || !contactUsTemplate) {
        console.error('Templates not found in CMS_TEMPLATES');
        return;
    }

    // 1. Outlets Data (Global Presence)
    // ... (rest of the data remains same)
    const outletsData = {
        banner: {
            backgroundImage: "/images/outlet-banner.png",
            titleEn: "Contact us",
            titleAr: "تواصل معنا"
        },
        globalPresence: {
            subtitleEn: "GLOBAL PRESENCE",
            subtitleAr: "تواجد عالمي",
            titleEn: "Find Us Near You",
            titleAr: "ابحث عنا بالقرب منك",
            descriptionEn: "With strategically located outlets across three countries, we ensure quick access to our premium filtration solutions. Visit any of our outlets for personalized service and expert consultation.",
            descriptionAr: "مع منافذ موجودة بشكل استراتيجي في ثلاث دول، نضمن وصولاً سريعاً إلى حلول الترشيح المتميزة لدينا. قم بزيارة أي من منافذنا للحصول على خدمة شخصية واستشارة متخصصة."
        },
        stats: [
            { numberEn: "3", numberAr: "3", labelEn: "Countries", labelAr: "دول" },
            { numberEn: "7+", numberAr: "7+", labelEn: "Outlet Locations", labelAr: "مواقع المنافذ" },
            { numberEn: "24/7", numberAr: "24/7", labelEn: "Customer Support", labelAr: "دعم العملاء" }
        ],
        countries: [
            {
                countryNameEn: "Saudi Arabia",
                countryNameAr: "المملكة العربية السعودية",
                flagImage: "saudiflag",
                bgColor: "#FEF5F5",
                cities: [
                    {
                        nameEn: "Riyadh",
                        nameAr: "الرياض",
                        tagEn: "Main Office",
                        tagAr: "المكتب الرئيسي",
                        addressEn: "King Fahd Road, Riyadh 11564",
                        addressAr: "طريق الملك فهد، الرياض 11564",
                        phone: "+966 11 234 5678",
                        email: "riyadh@filtersexperts.com",
                        hoursEn: "Sun - Thu: 8:00 AM - 6:00 PM",
                        hoursAr: "الأحد - الخميس: 8:00 صباحاً - 6:00 مساءً",
                        mapEmbedUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d463878.2310317589!2d46.5423326!3d24.7253981!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3e2f03890d489bbc%3A0x46613380ced45b71!2sRiyadh%20Saudi%20Arabia!5e0!3m2!1sen!2ssa!4v1688557842000!5m2!1sen!2ssa"
                    },
                    {
                        nameEn: "Jeddah",
                        nameAr: "جدة",
                        tagEn: "Main Office",
                        tagAr: "المكتب الرئيسي",
                        addressEn: "Prince Sultan Street, Jeddah 23442",
                        addressAr: "شارع الأمير سلطان، جدة 23442",
                        phone: "+966 12 345 6789",
                        email: "jeddah@filtersexperts.com",
                        hoursEn: "Sun - Thu: 8:00 AM - 6:00 PM",
                        hoursAr: "الأحد - الخميس: 8:00 صباحاً - 6:00 مساءً",
                        mapEmbedUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d118949.70271707297!2d39.1223405!3d21.5169315!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x15c3d01fb1137e59%3A0xe059579737bfe34c!2sJeddah%20Saudi%20Arabia!5e0!3m2!1sen!2ssa!4v1688557642000!5m2!1sen!2ssa"
                    },
                    {
                        nameEn: "Dammam",
                        nameAr: "الدمام",
                        tagEn: "Main Office",
                        tagAr: "المكتب الرئيسي",
                        addressEn: "King Abdulaziz Street, Dammam 32241",
                        addressAr: "شارع الملك عبدالعزيز، الدمام 32241",
                        phone: "+966 13 345 6789",
                        email: "dammam@filtersexperts.com",
                        hoursEn: "Sun - Thu: 8:00 AM - 6:00 PM",
                        hoursAr: "الأحد - الخميس: 8:00 صباحاً - 6:00 مساءً",
                        mapEmbedUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d114256.76679586407!2d50.1030089!3d26.3926665!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3e49e60a3d463d11%3A0xe6ec07c77d0a273!2sDammam%20Saudi%20Arabia!5e0!3m2!1sen!2ssa!4v1688557342000!5m2!1sen!2ssa"
                    }
                ]
            },
            {
                countryNameEn: "United Arab Emirates",
                countryNameAr: "الإمارات العربية المتحدة",
                flagImage: "uaeflag",
                bgColor: "#FFFFFF",
                cities: [
                    {
                        nameEn: "Dubai",
                        nameAr: "دبي",
                        tagEn: "Main Office",
                        tagAr: "المكتب الرئيسي",
                        addressEn: "Sheikh Zayed Road, Dubai",
                        addressAr: "شارع الشيخ زايد، دبي",
                        phone: "+971 4 123 4567",
                        email: "dubai@filtersexperts.com",
                        hoursEn: "Sun - Thu: 8:00 AM - 6:00 PM",
                        hoursAr: "الأحد - الخميس: 8:00 صباحاً - 6:00 مساءً",
                        mapEmbedUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d462560.3011839799!2d55.227487950000005!3d25.07638145!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3e5f43496ad9c645%3A0xbde66e5084295162!2sDubai%20-%20United%20Arab%20Emirates!5e0!3m2!1sen!2ssa!4v1688557442000!5m2!1sen!2ssa"
                    },
                    {
                        nameEn: "Abu Dhabi",
                        nameAr: "أبوظبي",
                        tagEn: "Branch Office",
                        tagAr: "مكتب فرعي",
                        addressEn: "Corniche Road, Abu Dhabi",
                        addressAr: "طريق الكورنيش، أبوظبي",
                        phone: "+971 2 234 5678",
                        email: "abudhabi@filtersexperts.com",
                        hoursEn: "Sun - Thu: 8:00 AM - 6:00 PM",
                        hoursAr: "الأحد - الخميس: 8:00 صباحاً - 6:00 مساءً",
                        mapEmbedUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d232410.60336214432!2d54.2120016!3d24.3872225!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3e5e440f7a566721%3A0xa67edf0116471659!2sAbu%20Dhabi%20-%20United%20Arab%20Emirates!5e0!3m2!1sen!2ssa!4v1688557942000!5m2!1sen!2ssa"
                    }
                ]
            },
            {
                countryNameEn: "Pakistan",
                countryNameAr: "باكستان",
                flagImage: "pkflag",
                bgColor: "#FEF5F5",
                cities: [
                    {
                        nameEn: "Karachi",
                        nameAr: "كراتشي",
                        tagEn: "Main Office",
                        tagAr: "المكتب الرئيسي",
                        addressEn: "Shahrah-e-Faisal, Karachi",
                        addressAr: "شاهراه فيصل، كراتشي",
                        phone: "+92 21 345 6789",
                        email: "karachi@filtersexperts.com",
                        hoursEn: "Mon - Sat: 9:00 AM - 6:00 PM",
                        hoursAr: "الإثنين - السبت: 9:00 صباحاً - 6:00 مساءً",
                        mapEmbedUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d924237.1216960824!2d67.0099388!3d24.8607343!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3eb33e06651d4bbf%3A0x9cf92f44555a0c23!2sKarachi%2C%20Karachi%20City%2C%20Sindh%2C%20Pakistan!5e0!3m2!1sen!2ssa!4v1688557542000!5m2!1sen!2ssa"
                    },
                    {
                        nameEn: "Lahore",
                        nameAr: "لاهور",
                        tagEn: "Branch Office",
                        tagAr: "مكتب فرعي",
                        addressEn: "Main Boulevard, Lahore",
                        addressAr: "الشارع الرئيسي، لاهور",
                        phone: "+92 42 456 7890",
                        email: "lahore@filtersexperts.com",
                        hoursEn: "Mon - Sat: 9:00 AM - 6:00 PM",
                        hoursAr: "الإثنين - السبت: 9:00 صباحاً - 6:00 مساءً",
                        mapEmbedUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d217760.36625807982!2d74.1950346!3d31.4828113!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x39190483e58107d9%3A0xc20bef065166f150!2sLahore%2C%20Punjab%2C%20Pakistan!5e0!3m2!1sen!2ssa!4v1688557742000!5m2!1sen!2ssa"
                    }
                ]
            }
        ],
        ctaSection: {
            titleEn: "Visit Our Nearest Outlet",
            titleAr: "قم بزيارة أقرب منفذ بيع",
            subtitleEn: "Get expert advice and explore our full range of filtration products at any of our locations",
            subtitleAr: "احصل على مشورة الخبراء واستكشف مجموعتنا الكاملة من منتجات الترشيح في أي من مواقعنا",
            scheduleButtonEn: "Schedule a Visit",
            scheduleButtonAr: "تحديد موعد للزيارة",
            supportButtonEn: "Contact Support",
            supportButtonAr: "اتصل بالدعم",
            callLabelEn: "Call Us",
            callLabelAr: "اتصل بنا",
            emailLabelEn: "Email Us",
            emailLabelAr: "راسلنا",
            hoursLabelEn: "Working Hours",
            hoursLabelAr: "ساعات العمل",
            phone: "+966 59 965 9888",
            email: "info@filtersexperts.com",
            hoursTextEn: "Mon - Sat: 9 AM - 6 PM",
            hoursTextAr: "الإثنين - السبت: 9 صباحًا - 6 مساءً"
        }
    };

    const contactUsData = {
        banner: {
            backgroundImage: "/images/outlet-banner.png",
            titleEn: "Contact Us",
            titleAr: "تواصل معنا"
        },
        contactInfo: {
            titleEn: "Contact Information",
            titleAr: "معلومات الاتصال",
            phoneLabelEn: "Phone Number",
            phoneLabelAr: "رقم الهاتف",
            phone: "+966 59 965 9888",
            emailLabelEn: "Email Address",
            emailLabelAr: "البريد الإلكتروني",
            email: "info@filtersexperts.com",
            locationLabelEn: "Location",
            locationLabelAr: "الموقع",
            locationTextEn: "Riyadh, Saudi Arabia",
            locationTextAr: "الرياض، المملكة العربية السعودية",
            hoursLabelEn: "Business Hours",
            hoursLabelAr: "ساعات العمل",
            hoursTextEn: "Sun - Thu: 8:00 AM - 6:00 PM",
            hoursTextAr: "الأحد - الخميس: 8:00 صباحاً - 6:00 مساءً"
        },
        form: {
            titleEn: "Send us a message",
            titleAr: "أرسل لنا رسالة",
            namePlaceholderEn: "Enter your full name",
            namePlaceholderAr: "أدخل اسمك الكامل",
            emailPlaceholderEn: "Enter your email",
            emailPlaceholderAr: "أدخل بريدك الإلكتروني",
            phonePlaceholderEn: "Enter your phone number",
            phonePlaceholderAr: "أدخل رقم هاتفك",
            companyPlaceholderEn: "Enter your company name",
            companyPlaceholderAr: "أدخل اسم شركتك",
            messagePlaceholderEn: "Tell us about your filtration needs...",
            messagePlaceholderAr: "أخبرنا عن احتياجات التنقية الخاصة بك...",
            submitButtonEn: "Send Message",
            submitButtonAr: "إرسال الرسالة",
            submittingTextEn: "Sending...",
            submittingTextAr: "جاري الإرسال..."
        },
        success: {
            headingEn: "Message Received!",
            headingAr: "تم استلام الرسالة!",
            messageEn: "Thank you for reaching out to Filters Experts. We've received your message and our team will get back to you shortly.",
            messageAr: "شكرًا لتواصلك مع خبراء الفلاتر. لقد استلمنا رسالتك وسيقوم فريقنا بالرد عليك قريباً.",
            cards: [
                {
                    titleEn: "Email Confirmation",
                    titleAr: "تأكيد بالبريد الإلكتروني",
                    descEn: "A confirmation email has been sent to your inbox",
                    descAr: "تم إرسال بريد إلكتروني للتأكيد إلى صندوق الوارد الخاص بك"
                },
                {
                    titleEn: "Quick Response",
                    titleAr: "استجابة سريعة",
                    descEn: "We'll respond within 24 hours during business days",
                    descAr: "سنرد في غضون 24 ساعة خلال أيام العمل"
                },
                {
                    titleEn: "Dedicated Support",
                    titleAr: "دعم مخصص",
                    descEn: "Our team will personally address your inquiry",
                    descAr: "سيقوم فريقنا بمعالجة استفسارك شخصياً"
                }
            ],
            nextStepHeadingEn: "What Happens Next?",
            nextStepHeadingAr: "ماذا يحدث بعد ذلك؟",
            nextStepBodyEn: "Our customer service team is reviewing your message and will reach out to you via email or phone with a detailed response. If your inquiry is urgent, please feel free to call us directly at +966 59 965 9888.",
            nextStepBodyAr: "يقوم فريق خدمة العملاء لدينا بمراجعة رسالتك وسيتواصل معك برد مفصل. إذا كان استفسارك عاجلاً، فلا تتردد في الاتصال بنا مباشرة على +966 59 965 9888.",
            backHomeButtonEn: "Back to Home",
            backHomeButtonAr: "العودة للرئيسية",
            newFormButtonEn: "Send Another Message",
            newFormButtonAr: "إرسال رسالة أخرى"
        }
    };

    try {
        // Upsert Outlets Page
        await prisma.cMSPage.upsert({
            where: { slug: 'outlets' },
            update: {
                title: outletsTemplate.title,
                schema: JSON.stringify(outletsTemplate.schema),
                contentJson: outletsData,
                isActive: true
            },
            create: {
                title: outletsTemplate.title,
                slug: 'outlets',
                schema: JSON.stringify(outletsTemplate.schema),
                contentJson: outletsData,
                isActive: true
            }
        });
        console.log('Outlets page migrated successfully.');

        // Upsert Contact Us Page
        await prisma.cMSPage.upsert({
            where: { slug: 'contact-us' },
            update: {
                title: contactUsTemplate.title,
                schema: JSON.stringify(contactUsTemplate.schema),
                contentJson: contactUsData,
                isActive: true
            },
            create: {
                title: contactUsTemplate.title,
                slug: 'contact-us',
                schema: JSON.stringify(contactUsTemplate.schema),
                contentJson: contactUsData,
                isActive: true
            }
        });
        console.log('Contact Us page migrated successfully.');

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
