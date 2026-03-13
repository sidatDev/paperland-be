/**
 * CMS Page Templates
 * Each template defines a JSON Schema for a corporate page type.
 * The "widget" property on fields is a custom hint used by ContentForm 
 * to generate RJSF uiSchema (maps to custom widgets like RichTextWidget, ImageWidget, etc.)
 */

export interface CmsTemplate {
    slug: string;
    title: string;
    description: string;
    schema: Record<string, any>;
    defaultContent?: Record<string, any>;
}

export const CMS_TEMPLATES: CmsTemplate[] = [
    {
        slug: "about",
        title: "About Us",
        description: "Company about page: hero, history, CEO message, mission, vision, timeline, leadership",
        schema: {
            type: "object",
            properties: {
                hero: {
                    type: "object",
                    title: "Hero Section",
                    properties: {
                        backgroundImage: { type: "string", title: "Background Image", widget: "image" },
                        titleEn: { type: "string", title: "Title (English)" },
                        highlightEn: { type: "string", title: "Highlighted Word (English)" }
                    }
                },
                companyHistory: {
                    type: "object",
                    title: "Company History",
                    properties: {
                        sectionTitle: { type: "string", title: "Section Title" },
                        description: { type: "string", title: "Description", widget: "richtext" }
                    }
                },
                ceoMessage: {
                    type: "object",
                    title: "CEO's Message",
                    properties: {
                        image: { type: "string", title: "CEO Image", widget: "image" },
                        subtitle: { type: "string", title: "Subtitle" },
                        heading: { type: "string", title: "Heading" },
                        message: { type: "string", title: "Message", widget: "richtext" }
                    }
                },
                mission: {
                    type: "object",
                    title: "Mission",
                    properties: {
                        heading: { type: "string", title: "Heading" },
                        description: { type: "string", title: "Description", widget: "richtext" }
                    }
                },
                vision: {
                    type: "object",
                    title: "Vision",
                    properties: {
                        heading: { type: "string", title: "Heading" },
                        description: { type: "string", title: "Description", widget: "richtext" }
                    }
                },
                timelineSection: {
                    type: "object",
                    title: "Timeline Section",
                    properties: {
                        sectionTitle: { type: "string", title: "Section Title" },
                        sectionHeading: { type: "string", title: "Section Heading" },
                        timeline: {
                            type: "array",
                            title: "Timeline Items",
                            items: {
                                type: "object",
                                properties: {
                                    year: { type: "string", title: "Year" },
                                    description: { type: "string", title: "Description" },
                                    icon: { type: "string", title: "Icon Image", widget: "image" },
                                    isActive: { type: "boolean", title: "Active (highlighted)" }
                                }
                            }
                        }
                    }
                },
                leadership: {
                    type: "object",
                    title: "Leadership Section",
                    properties: {
                        sectionTitle: { type: "string", title: "Section Title" },
                        sectionHeading: { type: "string", title: "Section Heading" },
                        teamMembers: {
                            type: "array",
                            title: "Team Members",
                            items: {
                                type: "object",
                                properties: {
                                    name: { type: "string", title: "Name" },
                                    role: { type: "string", title: "Role" },
                                    image: { type: "string", title: "Photo", widget: "image" }
                                }
                            }
                        }
                    }
                }
            }
        }
    },
    {
        slug: "privacy-policy",
        title: "Privacy Policy",
        description: "Privacy policy page with dated sections",
        schema: {
            type: "object",
            properties: {
                title: { type: "string", title: "Page Title" },
                lastUpdated: { type: "string", title: "Last Updated Date" },
                sections: {
                    type: "array",
                    title: "Policy Sections",
                    items: {
                        type: "object",
                        properties: {
                            heading: { type: "string", title: "Section Heading" },
                            text: { type: "string", title: "Section Content", widget: "richtext" }
                        }
                    }
                }
            }
        }
    },
    {
        slug: "terms-conditions",
        title: "Terms & Conditions",
        description: "Terms and conditions page with dated sections",
        schema: {
            type: "object",
            properties: {
                title: { type: "string", title: "Page Title" },
                lastUpdated: { type: "string", title: "Last Updated Date" },
                sections: {
                    type: "array",
                    title: "Terms Sections",
                    items: {
                        type: "object",
                        properties: {
                            heading: { type: "string", title: "Section Heading" },
                            text: { type: "string", title: "Section Content", widget: "richtext" }
                        }
                    }
                }
            }
        }
    },
    {
        slug: "industries",
        title: "Industries We Serve",
        description: "Industries page with banner, grid, capabilities, and CTA",
        schema: {
            type: "object",
            properties: {
                banner: {
                    type: "object",
                    title: "Banner Section",
                    properties: {
                        backgroundImage: { type: "string", title: "Background Image", widget: "image" },
                        title: { type: "string", title: "Title" },
                        subtitle: { type: "string", title: "Subtitle" }
                    }
                },
                industriesSection: {
                    type: "object",
                    title: "Industries Grid Section",
                    properties: {
                        sectionTitle: { type: "string", title: "Section Label (e.g. Industry Expertise)" },
                        heading: { type: "string", title: "Section Heading" },
                        description: { type: "string", title: "Section Description", widget: "textarea" },
                        items: {
                            type: "array",
                            title: "Industry Items",
                            items: {
                                type: "object",
                                properties: {
                                    name: { type: "string", title: "Industry Name" },
                                    description: { type: "string", title: "Description", widget: "textarea" },
                                    icon: { type: "string", title: "Icon/Image", widget: "image" }
                                }
                            }
                        }
                    }
                },
                capabilitiesSection: {
                    type: "object",
                    title: "Capabilities Section",
                    properties: {
                        heading: { type: "string", title: "Section Heading" },
                        description: { type: "string", title: "Section Description", widget: "textarea" },
                        items: {
                            type: "array",
                            title: "Capability Items",
                            items: {
                                type: "object",
                                properties: {
                                    title: { type: "string", title: "Capability Title" },
                                    description: { type: "string", title: "Description", widget: "textarea" },
                                    icon: { type: "string", title: "Icon", widget: "image" }
                                }
                            }
                        }
                    }
                },
                cta: {
                    type: "object",
                    title: "CTA Section",
                    properties: {
                        heading: { type: "string", title: "Heading" },
                        description: { type: "string", title: "Description", widget: "textarea" },
                        buttonText: { type: "string", title: "Button Text" },
                        buttonLink: { type: "string", title: "Button Link" }
                    }
                }
            }
        },
        defaultContent: {
            banner: {
                backgroundImage: "/images/MediaCenter/mediacenterbanner.jpg",
                title: "Industries",
                subtitle: "We Serve"
            },
            industriesSection: {
                sectionTitle: "Industry Expertise",
                heading: "Tailored Stationery Solutions for Every Sector",
                description: "Paperland has been at the forefront of the stationery and office supplies industry for over two decades. We understand the unique challenges of each industry and provide customized solutions that ensure optimal performance and reliability.",
                items: [
                    { name: "Automotive", description: "High-performance filtration for cars, trucks, and heavy-duty vehicles ensuring engine longevity and efficiency." },
                    { name: "Manufacturing", description: "Industrial-grade filtration systems for production facilities, ensuring clean air and optimal machinery performance." },
                    { name: "Oil & Gas", description: "Specialized filters for oil refineries, gas processing plants, and petrochemical facilities meeting strict standards." },
                    { name: "Water Treatment", description: "Advanced filtration solutions for municipal water treatment, wastewater management, and purification systems." },
                    { name: "HVAC Systems", description: "Air filtration products for heating, ventilation, and air conditioning systems in commercial and residential buildings." },
                    { name: "Construction", description: "Durable filters for construction equipment, heavy machinery, and onsite power generation systems." },
                    { name: "Marine", description: "Corrosion-resistant filtration systems for ships, boats, and offshore platforms operating in harsh environments." },
                    { name: "Power Generation", description: "High-efficiency filters for power plants, turbines, and generators ensuring uninterrupted energy production." }
                ]
            },
            capabilitiesSection: {
                heading: "Our Industry Capabilities",
                description: "Comprehensive filtration expertise backed by decades of industry experience",
                items: [
                    { title: "Quality Certifications", description: "ISO certified products meeting international quality standards and industry-specific regulations across all sectors." },
                    { title: "Rapid Deployment", description: "Quick turnaround times and efficient logistics ensuring minimal downtime for critical industrial operations." },
                    { title: "Technical Support", description: "Expert consultation and ongoing technical assistance to optimize filtration performance for your specific needs." }
                ]
            },
            cta: {
                heading: "Ready to Find the Perfect Stationery Solution?",
                description: "Our industry experts are here to help you select the right supplies for your specific application",
                buttonText: "Contact Our Team",
                buttonLink: "/en/company/contact-us"
            }
        }
    },
    {
        slug: "media-center",
        title: "Media Center",
        description: "Media Center page: banner, photo gallery, video library, resources, and info banner",
        schema: {
            type: "object",
            properties: {
                banner: {
                    type: "object",
                    title: "Banner Section",
                    properties: {
                        backgroundImage: { type: "string", title: "Background Image", widget: "image" },
                        titleEn: { type: "string", title: "Title (English)" },
                        titleAr: { type: "string", title: "Title (Arabic)" },
                        subtitleEn: { type: "string", title: "Subtitle (English)" },
                        subtitleAr: { type: "string", title: "Subtitle (Arabic)" }
                    }
                },
                photosSection: {
                    type: "object",
                    title: "Photo Gallery Section",
                    properties: {
                        titleEn: { type: "string", title: "Section Title (English)" },
                        titleAr: { type: "string", title: "Section Title (Arabic)" },
                        descriptionEn: { type: "string", title: "Description (English)" },
                        descriptionAr: { type: "string", title: "Description (Arabic)" },
                        viewFullGalleryButtonEn: { type: "string", title: "View Gallery Button (English)" },
                        viewFullGalleryButtonAr: { type: "string", title: "View Gallery Button (Arabic)" },
                        items: {
                            type: "array",
                            title: "Photos",
                            items: {
                                type: "object",
                                properties: {
                                    image: { type: "string", title: "Image", widget: "image" },
                                    altEn: { type: "string", title: "Alt Text (English)" },
                                    altAr: { type: "string", title: "Alt Text (Arabic)" }
                                }
                            }
                        }
                    }
                },
                videosSection: {
                    type: "object",
                    title: "Video Library Section",
                    properties: {
                        titleEn: { type: "string", title: "Section Title (English)" },
                        titleAr: { type: "string", title: "Section Title (Arabic)" },
                        descriptionEn: { type: "string", title: "Description (English)" },
                        descriptionAr: { type: "string", title: "Description (Arabic)" },
                        items: {
                            type: "array",
                            title: "Videos",
                            items: {
                                type: "object",
                                properties: {
                                    titleEn: { type: "string", title: "Video Title (English)" },
                                    titleAr: { type: "string", title: "Video Title (Arabic)" },
                                    durationEn: { type: "string", title: "Duration (English, e.g. 3:45 mins)" },
                                    durationAr: { type: "string", title: "Duration (Arabic, e.g. ٣:٤٥ دقائق)" },
                                    image: { type: "string", title: "Thumbnail Image", widget: "image" },
                                    videoUrl: { type: "string", title: "Video URL" }
                                }
                            }
                        }
                    }
                },
                resourcesSection: {
                    type: "object",
                    title: "Media Resources Section",
                    properties: {
                        titleEn: { type: "string", title: "Section Title (English)" },
                        titleAr: { type: "string", title: "Section Title (Arabic)" },
                        descriptionEn: { type: "string", title: "Section Description (English)" },
                        descriptionAr: { type: "string", title: "Section Description (Arabic)" },
                        items: {
                            type: "array",
                            title: "Resources",
                            items: {
                                type: "object",
                                properties: {
                                    titleEn: { type: "string", title: "Resource Title (English)" },
                                    titleAr: { type: "string", title: "Resource Title (Arabic)" },
                                    typeEn: { type: "string", title: "Type (English, e.g. PDF)" },
                                    typeAr: { type: "string", title: "Type (Arabic, e.g. PDF)" },
                                    sizeEn: { type: "string", title: "Size (English, e.g. 2.5 MB)" },
                                    sizeAr: { type: "string", title: "Size (Arabic, e.g. ٢.٥ ميجابايت)" },
                                    fileUrl: { type: "string", title: "File URL", widget: "image" },
                                    iconType: { type: "string", title: "Icon Type (pdf, archive, image, default)", default: "pdf" }
                                }
                            }
                        },
                        infoBanner: {
                            type: "object",
                            title: "Need More Information? Banner",
                            properties: {
                                headingEn: { type: "string", title: "Heading (English)" },
                                headingAr: { type: "string", title: "Heading (Arabic)" },
                                subtextEn: { type: "string", title: "Subtext (English)" },
                                subtextAr: { type: "string", title: "Subtext (Arabic)" },
                                buttonEn: { type: "string", title: "Button Text (English)" },
                                buttonAr: { type: "string", title: "Button Text (Arabic)" },
                                buttonLink: { type: "string", title: "Button Link" }
                            }
                        }
                    }
                }
            }
        },
        defaultContent: {
            banner: {
                backgroundImage: "/images/MediaCenter/mediacenterbanner.jpg",
                titleEn: "Media",
                titleAr: "المركز",
                subtitleEn: "Center",
                subtitleAr: "الإعلامي"
            },
            photosSection: {
                titleEn: "Photo Gallery",
                titleAr: "معرض الصور",
                descriptionEn: "Explore our facilities, products, and team in action",
                descriptionAr: "استكشف مرافقنا ومنتجاتنا وفريقنا في العمل",
                viewFullGalleryButtonEn: "View Full Gallery",
                viewFullGalleryButtonAr: "عرض المعرض الكامل",
                items: [
                    { image: "/images/MediaCenter/gallery.jpg", altEn: "Gallery Image", altAr: "صورة المعرض" },
                    { image: "/images/MediaCenter/gallery1.jpg", altEn: "Gallery Image", altAr: "صورة المعرض" },
                    { image: "/images/MediaCenter/gallery2.jpg", altEn: "Gallery Image", altAr: "صورة المعرض" },
                    { image: "/images/MediaCenter/gallery3.jpg", altEn: "Gallery Image", altAr: "صورة المعرض" },
                    { image: "/images/MediaCenter/gallery4.jpg", altEn: "Gallery Image", altAr: "صورة المعرض" },
                    { image: "/images/MediaCenter/gallery5.jpg", altEn: "Gallery Image", altAr: "صورة المعرض" }
                ]
            },
            videosSection: {
                titleEn: "Video Library",
                titleAr: "مكتبة الفيديو",
                descriptionEn: "Watch our company overview, product demonstrations, and customer testimonials",
                descriptionAr: "شاهد نظرة عامة على شركتنا، وعروض المنتجات، وشهادات العملاء",
                items: [
                    { titleEn: "Company Overview", titleAr: "نظرة عامة على الشركة", durationEn: "3:45 mins", durationAr: "٣:٤٥ دقائق", image: "/images/MediaCenter/gallery1.jpg", videoUrl: "" },
                    { titleEn: "Manufacturing Process", titleAr: "عملية التصنيع", durationEn: "5:20 mins", durationAr: "٥:٢٠ دقائق", image: "/images/MediaCenter/gallery3.jpg", videoUrl: "" },
                    { titleEn: "Product Showcase", titleAr: "عرض المنتج", durationEn: "4:10 mins", durationAr: "٤:١٠ دقائق", image: "/images/MediaCenter/gallery5.jpg", videoUrl: "" }
                ]
            },
            resourcesSection: {
                titleEn: "Media Resources",
                titleAr: "الموارد الإعلامية",
                descriptionEn: "Download our company materials, product catalogs, and press kits",
                descriptionAr: "قم بتنزيل مواد شركتنا وكتالوجات المنتجات والكتيبات الصحفية",
                items: [
                    { titleEn: "Company Brochure", titleAr: "كتيب الشركة", typeEn: "PDF", typeAr: "PDF", sizeEn: "2.5 MB", sizeAr: "٢.٥ ميجابايت", fileUrl: "", iconType: "pdf" },
                    { titleEn: "Product Catalog 2026", titleAr: "كتالوج المنتجات ٢٠٢٦", typeEn: "PDF", typeAr: "PDF", sizeEn: "8.3 MB", sizeAr: "٨.٣ ميجابايت", fileUrl: "", iconType: "pdf" },
                    { titleEn: "Logo Pack (High-Res)", titleAr: "حزمة الشعار", typeEn: "ZIP", typeAr: "ZIP", sizeEn: "4.1 MB", sizeAr: "٤.١ ميجابايت", fileUrl: "", iconType: "archive" },
                    { titleEn: "Press Release Archive", titleAr: "أرشيف البيانات الصحفية", typeEn: "PDF", typeAr: "PDF", sizeEn: "1.8 MB", sizeAr: "١.٨ ميجابايت", fileUrl: "", iconType: "pdf" }
                ],
                infoBanner: {
                    headingEn: "Need More Information?",
                    headingAr: "هل تحتاج لمزيد من المعلومات؟",
                    subtextEn: "Contact our media relations team for additional resources and inquiries",
                    subtextAr: "اتصل بفريق العلاقات الإعلامية لدينا لمزيد من الموارد والاستفسارات",
                    buttonEn: "Contact Media Team",
                    buttonAr: "اتصل بفريق الإعلام",
                    buttonLink: "/company/contact-us"
                }
            }
        }
    },
    {
        slug: "outlets",
        title: "Outlets / Global Presence",
        description: "Global presence page with stats, countries, and branch locations",
        schema: {
            type: "object",
            properties: {
                banner: {
                    type: "object",
                    title: "Banner Section",
                    properties: {
                        backgroundImage: { type: "string", title: "Background Image", widget: "image" },
                        titleEn: { type: "string", title: "Title (English)" },
                        titleAr: { type: "string", title: "Title (Arabic)" }
                    }
                },
                globalPresence: {
                    type: "object",
                    title: "Global Presence Header",
                    properties: {
                        subtitleEn: { type: "string", title: "Subtitle (English)" },
                        subtitleAr: { type: "string", title: "Subtitle (Arabic)" },
                        titleEn: { type: "string", title: "Title (English)" },
                        titleAr: { type: "string", title: "Title (Arabic)" },
                        descriptionEn: { type: "string", title: "Description (English)", widget: "textarea" },
                        descriptionAr: { type: "string", title: "Description (Arabic)", widget: "textarea" }
                    }
                },
                stats: {
                    type: "array",
                    title: "Stats Items",
                    items: {
                        type: "object",
                        properties: {
                            numberEn: { type: "string", title: "Number (English)" },
                            numberAr: { type: "string", title: "Number (Arabic)" },
                            labelEn: { type: "string", title: "Label (English)" },
                            labelAr: { type: "string", title: "Label (Arabic)" }
                        }
                    }
                },
                countries: {
                    type: "array",
                    title: "Countries & Branches",
                    items: {
                        type: "object",
                        properties: {
                            countryNameEn: { type: "string", title: "Country Name (English)" },
                            countryNameAr: { type: "string", title: "Country Name (Arabic)" },
                            flagImage: { type: "string", title: "Flag Image", widget: "image" },
                            bgColor: { type: "string", title: "Background Color (hex)" },
                            cities: {
                                type: "array",
                                title: "Cities / Branches",
                                items: {
                                    type: "object",
                                    properties: {
                                        nameEn: { type: "string", title: "City Name (English)" },
                                        nameAr: { type: "string", title: "City Name (Arabic)" },
                                        tagEn: { type: "string", title: "Tag (English, e.g., Head Office)" },
                                        tagAr: { type: "string", title: "Tag (Arabic)" },
                                        addressEn: { type: "string", title: "Address (English)" },
                                        addressAr: { type: "string", title: "Address (Arabic)" },
                                        phone: { type: "string", title: "Phone" },
                                        email: { type: "string", title: "Email" },
                                        hoursEn: { type: "string", title: "Working Hours (English)" },
                                        hoursAr: { type: "string", title: "Working Hours (Arabic)" },
                                        mapEmbedUrl: { type: "string", title: "Google Maps Embed URL" }
                                    }
                                }
                            }
                        }
                    }
                },
                ctaSection: {
                    type: "object",
                    title: "CTA Section",
                    properties: {
                        titleEn: { type: "string", title: "Title (English)" },
                        titleAr: { type: "string", title: "Title (Arabic)" },
                        subtitleEn: { type: "string", title: "Subtitle (English)" },
                        subtitleAr: { type: "string", title: "Subtitle (Arabic)" },
                        scheduleButtonEn: { type: "string", title: "Schedule Button (English)" },
                        scheduleButtonAr: { type: "string", title: "Schedule Button (Arabic)" },
                        supportButtonEn: { type: "string", title: "Support Button (English)" },
                        supportButtonAr: { type: "string", title: "Support Button (Arabic)" },
                        callLabelEn: { type: "string", title: "Call Label (English)" },
                        callLabelAr: { type: "string", title: "Call Label (Arabic)" },
                        emailLabelEn: { type: "string", title: "Email Label (English)" },
                        emailLabelAr: { type: "string", title: "Email Label (Arabic)" },
                        hoursLabelEn: { type: "string", title: "Hours Label (English)" },
                        hoursLabelAr: { type: "string", title: "Hours Label (Arabic)" },
                        phone: { type: "string", title: "Phone" },
                        email: { type: "string", title: "Email" },
                        hoursTextEn: { type: "string", title: "Hours Text (English)" },
                        hoursTextAr: { type: "string", title: "Hours Text (Arabic)" }
                    }
                }
            }
        }
    },
    {
        slug: "contact-us",
        title: "Contact Us",
        description: "Company contact page with form, info and success screens",
        schema: {
            type: "object",
            properties: {
                banner: {
                    type: "object",
                    title: "Banner Section",
                    properties: {
                        backgroundImage: { type: "string", title: "Background Image", widget: "image" },
                        titleEn: { type: "string", title: "Title (English)" },
                        titleAr: { type: "string", title: "Title (Arabic)" }
                    }
                },
                contactInfo: {
                    type: "object",
                    title: "Contact Info Section",
                    properties: {
                        titleEn: { type: "string", title: "Section Title (English)" },
                        titleAr: { type: "string", title: "Section Title (Arabic)" },
                        phoneLabelEn: { type: "string", title: "Phone Label (English)" },
                        phoneLabelAr: { type: "string", title: "Phone Label (Arabic)" },
                        phone: { type: "string", title: "Phone Number" },
                        emailLabelEn: { type: "string", title: "Email Label (English)" },
                        emailLabelAr: { type: "string", title: "Email Label (Arabic)" },
                        email: { type: "string", title: "Email Address" },
                        locationLabelEn: { type: "string", title: "Location Label (English)" },
                        locationLabelAr: { type: "string", title: "Location Label (Arabic)" },
                        locationTextEn: { type: "string", title: "Location Text (English)" },
                        locationTextAr: { type: "string", title: "Location Text (Arabic)" },
                        hoursLabelEn: { type: "string", title: "Hours Label (English)" },
                        hoursLabelAr: { type: "string", title: "Hours Label (Arabic)" },
                        hoursTextEn: { type: "string", title: "Hours Text (English)" },
                        hoursTextAr: { type: "string", title: "Hours Text (Arabic)" }
                    }
                },
                form: {
                    type: "object",
                    title: "Message Form Section",
                    properties: {
                        titleEn: { type: "string", title: "Form Title (English)" },
                        titleAr: { type: "string", title: "Form Title (Arabic)" },
                        namePlaceholderEn: { type: "string", title: "Name Placeholder (English)" },
                        namePlaceholderAr: { type: "string", title: "Name Placeholder (Arabic)" },
                        emailPlaceholderEn: { type: "string", title: "Email Placeholder (English)" },
                        emailPlaceholderAr: { type: "string", title: "Email Placeholder (Arabic)" },
                        phonePlaceholderEn: { type: "string", title: "Phone Placeholder (English)" },
                        phonePlaceholderAr: { type: "string", title: "Phone Placeholder (Arabic)" },
                        companyPlaceholderEn: { type: "string", title: "Company Placeholder (English)" },
                        companyPlaceholderAr: { type: "string", title: "Company Placeholder (Arabic)" },
                        messagePlaceholderEn: { type: "string", title: "Message Placeholder (English)" },
                        messagePlaceholderAr: { type: "string", title: "Message Placeholder (Arabic)" },
                        submitButtonEn: { type: "string", title: "Submit Button (English)" },
                        submitButtonAr: { type: "string", title: "Submit Button (Arabic)" },
                        submittingTextEn: { type: "string", title: "Submitting Text (English)" },
                        submittingTextAr: { type: "string", title: "Submitting Text (Arabic)" }
                    }
                },
                success: {
                    type: "object",
                    title: "Success Screen",
                    properties: {
                        headingEn: { type: "string", title: "Heading (English)" },
                        headingAr: { type: "string", title: "Heading (Arabic)" },
                        messageEn: { type: "string", title: "Message (English)" },
                        messageAr: { type: "string", title: "Message (Arabic)" },
                        cards: {
                            type: "array",
                            title: "Success Detail Cards",
                            items: {
                                type: "object",
                                properties: {
                                    titleEn: { type: "string", title: "Card Title (English)" },
                                    titleAr: { type: "string", title: "Card Title (Arabic)" },
                                    descEn: { type: "string", title: "Card Desc (English)" },
                                    descAr: { type: "string", title: "Card Desc (Arabic)" }
                                }
                            }
                        },
                        nextStepHeadingEn: { type: "string", title: "Next Step Heading (English)" },
                        nextStepHeadingAr: { type: "string", title: "Next Step Heading (Arabic)" },
                        nextStepBodyEn: { type: "string", title: "Next Step Body (English)", widget: "textarea" },
                        nextStepBodyAr: { type: "string", title: "Next Step Body (Arabic)", widget: "textarea" },
                        backHomeButtonEn: { type: "string", title: "Back to Home Button (English)" },
                        backHomeButtonAr: { type: "string", title: "Back to Home Button (Arabic)" },
                        newFormButtonEn: { type: "string", title: "New Form Button (English)" },
                        newFormButtonAr: { type: "string", title: "New Form Button (Arabic)" }
                    }
                }
            }
        }
    },
    {
        slug: "products",
        title: "Company Products",
        description: "Products showcase page",
        schema: {
            type: "object",
            properties: {
                banner: {
                    type: "object",
                    title: "Banner Section",
                    properties: {
                        backgroundImage: { type: "string", title: "Background Image", widget: "image" },
                        title: { type: "string", title: "Title" },
                        subtitle: { type: "string", title: "Subtitle" }
                    }
                },
                ctaSection: {
                    type: "object",
                    title: "CTA Section",
                    properties: {
                        badge: { type: "string", title: "Section Badge", default: "Premium Quality Filters" },
                        title: { type: "string", title: "Main Title", default: "Get the Best Filters" },
                        subtitle: { type: "string", title: "Subtitle", default: "for Your Business" },
                        description: { type: "string", title: "Description", widget: "textarea", default: "Join thousands of satisfied customers who trust Filters Experts for their industrial and automotive filtration needs." },
                        shopText: { type: "string", title: "Shop Button Text", default: "Shop Now" },
                        shopLink: { type: "string", title: "Shop Button Link" },
                        contactText: { type: "string", title: "Contact Button Text", default: "Contact Sales" },
                        contactLink: { type: "string", title: "Contact Button Link" },
                        features: {
                            type: "array",
                            title: "Features List",
                            items: {
                                type: "object",
                                properties: {
                                    title: { type: "string", title: "Title" },
                                    desc: { type: "string", title: "Description" },
                                    icon: { type: "string", title: "Icon Image (White recommended)", widget: "image" }
                                }
                            }
                        },
                        cards: {
                            type: "array",
                            title: "Cards List",
                            items: {
                                type: "object",
                                properties: {
                                    title: { type: "string", title: "Title" },
                                    desc: { type: "string", title: "Description" },
                                    icon: { type: "string", title: "Icon Image", widget: "image" },
                                    badge: { type: "string", title: "Badge Text" }
                                }
                            }
                        },
                        stats: {
                            type: "array",
                            title: "Stats Summary",
                            items: {
                                type: "object",
                                properties: {
                                    value: { type: "string", title: "Stat Value" },
                                    label: { type: "string", title: "Stat Label" }
                                }
                            }
                        },
                        viewMoreText: { type: "string", title: "Card 'View More' Text", default: "View More" }
                    }
                },
                productList: {
                    type: "array",
                    title: "Static Product List",
                    items: {
                        type: "object",
                        properties: {
                            title: { type: "string", title: "Product Title" },
                            desc: { type: "string", title: "Description", widget: "textarea" },
                            image: { type: "string", title: "Product Image", widget: "image" }
                        }
                    }
                },
                content: { type: "string", title: "Page Content", widget: "richtext" }
            }
        },
        defaultContent: {
            banner: {
                backgroundImage: "/images/Productbanner.jpg",
                title: "Our Products",
                subtitle: ""
            },
            ctaSection: {
                badge: "Premium Quality Stationery",
                title: "Get the Best Stationery",
                subtitle: "for Your Office",
                description: "Join thousands of satisfied customers who trust Paperland for their stationery and office supplies needs.",
                shopText: "Shop Now",
                shopLink: "",
                contactText: "Contact Sales",
                contactLink: "",
                features: [
                    { title: "Quality Guaranteed", desc: "ISO certified products with 2+ decades of expertise", icon: "/images/icons/quality-icon.png" },
                    { title: "Fast Delivery", desc: "Quick shipping to keep your operations running", icon: "/images/icons/delivery-icon.png" },
                    { title: "Best Prices", desc: "Competitive pricing without compromising quality", icon: "/images/icons/price-icon.png" }
                ],
                cards: [
                    { title: "Air Filters", desc: "Premium quality filtration", icon: "/images/icons/air-filter-icon.png", badge: "30% OFF" },
                    { title: "Oil Filters", desc: "Industrial grade performance", icon: "/images/icons/oil-filter-icon.png", badge: "" },
                    { title: "Water Filters", desc: "Superior purification system", icon: "/images/icons/water-filter-icon.png", badge: "" }
                ],
                stats: [
                    { value: "2000+", label: "Happy Clients" },
                    { value: "20+", label: "Years Experience" },
                    { value: "50K+", label: "Products Delivered" }
                ],
                viewMoreText: "View More"
            },
            productList: [
                { id: 1, title: "Filter Element Ultrapleat", desc: "As the next step on the path toward Leadership in Filtration, Filters Expert is strengthening its leadership structure and expanding its Management Board", image: "/images/companyproduct/filterelement.jpg" },
                { id: 2, title: "Filter Dfo Ultra-Web", desc: "New CO2-reduced filters impregnated with plant-based raw materials, manufactured using renewable energy, and packaged in sustainable, recycled material.", image: "/images/companyproduct/filterdfo.jpg" },
                { id: 3, title: "Air Filter", desc: "New CO2-reduced filters impregnated with plant-based raw materials, manufactured using renewable energy, and packaged in sustainable, recycled material.", image: "/images/companyproduct/airfilter.jpg" },
                { id: 4, title: "Water Filter", desc: "As the next step on the path toward Leadership in Filtration, Filters Expert is strengthening its leadership structure and expanding its Management Board", image: "/images/companyproduct/waterfilter.jpg" },
                { id: 5, title: "Hydraulic Filter", desc: "New CO2-reduced filters impregnated with plant-based raw materials, manufactured using renewable energy, and packaged in sustainable, recycled material.", image: "/images/companyproduct/hydraulic.jpg" },
                { id: 6, title: "Oil Filter", desc: "New CO2-reduced filters impregnated with plant-based raw materials, manufactured using renewable energy, and packaged in sustainable, recycled material.", image: "/images/companyproduct/oil.jpg" }
            ]
        }
    },
    {
        slug: "insights",
        title: "Insights",
        description: "Company insights/articles page",
        schema: {
            type: "object",
            properties: {
                banner: {
                    type: "object",
                    title: "Banner Section",
                    properties: {
                        backgroundImage: { type: "string", title: "Background Image", widget: "image" },
                        titleEn: { type: "string", title: "Title (English)" },
                        titleAr: { type: "string", title: "Title (Arabic)" }
                    }
                },
                sectionHeader: {
                    type: "object",
                    title: "Section Header",
                    properties: {
                        titleEn: { type: "string", title: "Title (English)" },
                        titleAr: { type: "string", title: "Title (Arabic)" },
                        descriptionEn: { type: "string", title: "Description (English)" },
                        descriptionAr: { type: "string", title: "Description (Arabic)" }
                    }
                },
                categories: {
                    type: "array",
                    title: "Categories Filter",
                    items: {
                        type: "object",
                        properties: {
                            labelEn: { type: "string", title: "Label (English)" },
                            labelAr: { type: "string", title: "Label (Arabic)" },
                            value: { type: "string", title: "Value (matches filter)" }
                        }
                    }
                },
                insights: {
                    type: "array",
                    title: "Insights List",
                    items: {
                        type: "object",
                        properties: {
                            title: { type: "string", title: "Article Title (English)" },
                            titleAr: { type: "string", title: "Article Title (Arabic)" },
                            category: { type: "string", title: "Category (matches value above)" },
                            date: { type: "string", title: "Date (English)" },
                            dateAr: { type: "string", title: "Date (Arabic)" },
                            readTime: { type: "string", title: "Read Time (English)" },
                            readTimeAr: { type: "string", title: "Read Time (Arabic)" },
                            author: { type: "string", title: "Author Name (English)" },
                            authorAr: { type: "string", title: "Author Name (Arabic)" },
                            image: { type: "string", title: "Article Image", widget: "image" },
                            slug: { type: "string", title: "Slug" },
                            description: { type: "string", title: "Short Description (English)", widget: "textarea" },
                            descriptionAr: { type: "string", title: "Short Description (Arabic)", widget: "textarea" },
                            contentEn: { type: "string", title: "Full Content (English)", widget: "richtext" },
                            contentAr: { type: "string", title: "Full Content (Arabic)", widget: "richtext" }
                        }
                    }
                }
            }
        },
        defaultContent: {
            banner: {
                backgroundImage: "/images/insight/insightbanner.jpg",
                titleEn: "Insights",
                titleAr: "رؤانا"
            },
            sectionHeader: {
                titleEn: "Latest Insights",
                titleAr: "أحدث المقالات",
                descriptionEn: "Stay informed with the latest news, tips, and insights from Paperland",
                descriptionAr: "ابقَ على اطلاع بأحدث الأخبار والنصائح والرؤى من بايبر لاند"
            },
            categories: [
                { labelEn: "All", labelAr: "الكل", value: "All" },
                { labelEn: "Maintenance", labelAr: "الصيانة", value: "Maintenance" },
                { labelEn: "Technical", labelAr: "تقني", value: "Technical" },
                { labelEn: "Industrial", labelAr: "صناعي", value: "Industrial" },
                { labelEn: "DIY Guides", labelAr: "أدلة DIY", value: "DIY Guides" },
                { labelEn: "Business", labelAr: "أعمال", value: "Business" }
            ],
            insights: [
                {
                    title: "Understanding Automotive Filter Maintenance",
                    titleAr: "فهم صيانة فلاتر السيارات",
                    category: "Maintenance",
                    date: "January 8, 2026",
                    dateAr: "٨ يناير ٢٠٢٦",
                    readTime: "5 min read",
                    readTimeAr: "٥ دقائق قراءة",
                    author: "Sarah Thompson",
                    authorAr: "سارة طومسون",
                    image: "/images/insight/automotivefilter.jpg",
                    slug: "understanding-automotive-filter-maintenance",
                    description: "Learn the essential practices for maintaining your vehicle's filters to ensure optimal performance and longevity.",
                    descriptionAr: "تعرف على الممارسات الأساسية لصيانة فلاتر سيارتك لضمان الأداء الأمثل وطول العمر.",
                    contentEn: "Maintaining your vehicle's filters is crucial...",
                    contentAr: "صيانة فلاتر سيارتك أمر بالغ الأهمية..."
                }
            ]
        }
    },
    {
        slug: "career",
        title: "Career",
        description: "Career/jobs page",
        schema: {
            type: "object",
            properties: {
                banner: {
                    type: "object",
                    title: "Banner Section",
                    properties: {
                        backgroundImage: { type: "string", title: "Background Image", widget: "image" },
                        titleEn: { type: "string", title: "Title (English)" },
                        titleAr: { type: "string", title: "Title (Arabic)" }
                    }
                },
                openings: {
                    type: "object",
                    title: "Career Openings Features",
                    properties: {
                        items: {
                            type: "array",
                            title: "Features",
                            items: {
                                type: "object",
                                properties: {
                                    icon: { type: "string", title: "Icon Image", widget: "image" },
                                    titleEn: { type: "string", title: "Title (English)" },
                                    titleAr: { type: "string", title: "Title (Arabic)" },
                                    descriptionEn: { type: "string", title: "Description (English)", widget: "textarea" },
                                    descriptionAr: { type: "string", title: "Description (Arabic)", widget: "textarea" }
                                }
                            }
                        }
                    }
                },
                departments: {
                    type: "array",
                    title: "Departments Filter",
                    items: {
                        type: "object",
                        properties: {
                            value: { type: "string", title: "Department Key (e.g. Sales)" },
                            labelEn: { type: "string", title: "Label (English)" },
                            labelAr: { type: "string", title: "Label (Arabic)" }
                        }
                    }
                },
                jobs: {
                    type: "array",
                    title: "Jobs List",
                    items: {
                        type: "object",
                        properties: {
                            titleEn: { type: "string", title: "Job Title (English)" },
                            titleAr: { type: "string", title: "Job Title (Arabic)" },
                            department: { type: "string", title: "Department (matches filter value)" },
                            locationEn: { type: "string", title: "Location (English)" },
                            locationAr: { type: "string", title: "Location (Arabic)" },
                            typeEn: { type: "string", title: "Job Type (English)" },
                            typeAr: { type: "string", title: "Job Type (Arabic)" },
                            salaryEn: { type: "string", title: "Salary (English)" },
                            salaryAr: { type: "string", title: "Salary (Arabic)" },
                            experienceEn: { type: "string", title: "Experience (English)" },
                            experienceAr: { type: "string", title: "Experience (Arabic)" },
                            dateEn: { type: "string", title: "Date Posted (English)" },
                            dateAr: { type: "string", title: "Date Posted (Arabic)" },
                            image: { type: "string", title: "Job Image", widget: "image" },
                            slug: { type: "string", title: "Job Slug" },
                            descriptionEn: { type: "string", title: "Short Description (English)", widget: "textarea" },
                            descriptionAr: { type: "string", title: "Short Description (Arabic)", widget: "textarea" },
                            aboutRoleEn: { type: "string", title: "About the Role (English)", widget: "richtext" },
                            aboutRoleAr: { type: "string", title: "About the Role (Arabic)", widget: "richtext" },
                            responsibilitiesEnHtml: { type: "string", title: "Responsibilities English (HTML List)", widget: "richtext" },
                            responsibilitiesArHtml: { type: "string", title: "Responsibilities Arabic (HTML List)", widget: "richtext" },
                            requirementsEnHtml: { type: "string", title: "Requirements English (HTML List)", widget: "richtext" },
                            requirementsArHtml: { type: "string", title: "Requirements Arabic (HTML List)", widget: "richtext" },
                            benefitsEnHtml: { type: "string", title: "Benefits English (HTML List)", widget: "richtext" },
                            benefitsArHtml: { type: "string", title: "Benefits Arabic (HTML List)", widget: "richtext" },
                            viewDetailsButtonEn: { type: "string", title: "View Details Button (English)", default: "View Details" },
                            viewDetailsButtonAr: { type: "string", title: "View Details Button (Arabic)", default: "عرض التفاصيل" }
                        }
                    }
                },
                applySection: {
                    type: "object",
                    title: "Apply Section (Detail Page)",
                    properties: {
                        headingEn: { type: "string", title: "Heading (English)", default: "Ready to Apply?" },
                        headingAr: { type: "string", title: "Heading (Arabic)", default: "هل أنت مستعد للتقديم؟" },
                        subtextEn: { type: "string", title: "Subtext (English)", default: "Complete the form below and we'll get back to you soon" },
                        subtextAr: { type: "string", title: "Subtext (Arabic)", default: "أكمل النموذج أدناه وسنتواصل معك قريباً" },
                        submitButtonEn: { type: "string", title: "Submit Button (English)", default: "Apply Now →" },
                        submitButtonAr: { type: "string", title: "Submit Button (Arabic)", default: "قدم الآن" }
                    }
                }
            }
        },
        defaultContent: {
            banner: {
                backgroundImage: "/images/insight/insightbanner.jpg",
                titleEn: "Career",
                titleAr: "الوظائف"
            },
            openings: {
                items: [
                    { titleEn: "Career Growth", titleAr: "النمو الوظيفي", descriptionEn: "Continuous learning and development opportunities to advance your career", descriptionAr: "فرص التعلم والتطوير المستمر للتقدم في مسيرتك المهنية" },
                    { titleEn: "Great Benefits", titleAr: "مزايا رائعة", descriptionEn: "Competitive compensation packages with comprehensive health coverage", descriptionAr: "حزم تعويضات تنافسية مع تغطية صحية شاملة" },
                    { titleEn: "Innovative Culture", titleAr: "ثقافة مبتكرة", descriptionEn: "Work in a dynamic environment that values creativity and innovation", descriptionAr: "العمل في بيئة ديناميكية تقدر الإبداع والابتكار" }
                ]
            },
            departments: [
                { value: "All", labelEn: "All", labelAr: "الكل" },
                { value: "Sales", labelEn: "Sales", labelAr: "المبيعات" },
                { value: "Operations", labelEn: "Operations", labelAr: "العمليات" },
                { value: "Quality Control", labelEn: "Quality Control", labelAr: "مراقبة الجودة" },
                { value: "Technical Services", labelEn: "Technical Services", labelAr: "الخدمات التقنية" },
                { value: "Marketing", labelEn: "Marketing", labelAr: "التسويق" }
            ],
            jobs: [
                {
                    titleEn: "Sales Manager – Office Supplies",
                    titleAr: "مدير مبيعات – أدوات مكتبية",
                    department: "Sales",
                    locationEn: "Karachi, Pakistan",
                    locationAr: "كراتشي، باكستان",
                    typeEn: "FULL-TIME",
                    typeAr: "دوام كامل",
                    salaryEn: "Competitive",
                    salaryAr: "تنافسي",
                    experienceEn: "5–7 years",
                    experienceAr: "٥–٧ سنوات",
                    dateEn: "January 10, 2026",
                    dateAr: "١٠ يناير ٢٠٢٦",
                    image: "/images/career/salesmanager.jpg",
                    slug: "sales-manager-office-supplies",
                    descriptionEn: "Lead our office supplies sales team and drive business growth across Pakistan.",
                    descriptionAr: "قيادة فريق مبيعات الأدوات المكتبية ودفع نمو الأعمال في باکستان.",
                    aboutRoleEn: "We are seeking an experienced Sales Manager to lead our automotive filters division.",
                    aboutRoleAr: "نبحث عن مدير مبيعات ذو خبرة لقيادة قسم فلاتر السيارات لدينا.",
                    responsibilitiesEnHtml: "<ul><li>Develop and implement strategic sales plans</li></ul>",
                    responsibilitiesArHtml: "<ul><li>تطوير وتنفيذ خطط مبيعات استراتيجية</li></ul>",
                    requirementsEnHtml: "<ul><li>Bachelor's degree in Business</li></ul>",
                    requirementsArHtml: "<ul><li>درجة البكالوريوس في إدارة الأعمال</li></ul>",
                    benefitsEnHtml: "<ul><li>Competitive salary</li></ul>",
                    benefitsArHtml: "<ul><li>راتب تنافسي</li></ul>"
                }
            ],
            applySection: {
                headingEn: "Ready to Apply?",
                headingAr: "هل أنت مستعد للتقديم؟",
                subtextEn: "Complete the form below and we'll get back to you soon",
                subtextAr: "أكمل النموذج أدناه وسنتواصل معك قريباً",
                submitButtonEn: "Apply Now →",
                submitButtonAr: "قدم الآن"
            }
        }
    },
    {
        slug: "company",
        title: "Company Main Page",
        description: "Company landing page: banner, expertise, services, categories, industries, social, and insights",
        schema: {
            type: "object",
            properties: {
                banner: {
                    type: "object",
                    title: "Banner Section",
                    properties: {
                        backgroundImage: { type: "string", title: "Background Image", widget: "image" },
                        titleEn: { type: "string", title: "Title (English)" },
                        titleAr: { type: "string", title: "Title (Arabic)" },
                        descriptionEn: { type: "string", title: "Description (English)", widget: "textarea" },
                        descriptionAr: { type: "string", title: "Description (Arabic)", widget: "textarea" },
                        buttonTextEn: { type: "string", title: "Button Text (English)" },
                        buttonTextAr: { type: "string", title: "Button Text (Arabic)" },
                        buttonLink: { type: "string", title: "Button Link" },
                        ratingTextEn: { type: "string", title: "Rating Text (English)" },
                        ratingTextAr: { type: "string", title: "Rating Text (Arabic)" }
                    }
                },
                expertise: {
                    type: "object",
                    title: "Expertise Section",
                    properties: {
                        sectionTitleEn: { type: "string", title: "Section Badge (English)" },
                        sectionTitleAr: { type: "string", title: "Section Badge (Arabic)" },
                        headingEn: { type: "string", title: "Heading (English)" },
                        headingAr: { type: "string", title: "Heading (Arabic)" },
                        descriptionEn: { type: "string", title: "Description (English)", widget: "textarea" },
                        descriptionAr: { type: "string", title: "Description (Arabic)", widget: "textarea" },
                        viewMoreButtonEn: { type: "string", title: "Button Text (English)" },
                        viewMoreButtonAr: { type: "string", title: "Button Text (Arabic)" },
                        viewMoreLink: { type: "string", title: "Button Link" },
                        items: {
                            type: "array",
                            title: "Stats Items",
                            items: {
                                type: "object",
                                properties: {
                                    value: { type: "string", title: "Stat Value (e.g. 20+)" },
                                    labelEn: { type: "string", title: "Stat Label (English)" },
                                    labelAr: { type: "string", title: "Stat Label (Arabic)" }
                                }
                            }
                        }
                    }
                },
                services: {
                    type: "object",
                    title: "Services Section",
                    properties: {
                        sectionTitleEn: { type: "string", title: "Section Title (English)" },
                        sectionTitleAr: { type: "string", title: "Section Title (Arabic)" },
                        headingEn: { type: "string", title: "Heading (English)" },
                        headingAr: { type: "string", title: "Heading (Arabic)" },
                        descriptionEn: { type: "string", title: "Description (English)", widget: "textarea" },
                        descriptionAr: { type: "string", title: "Description (Arabic)", widget: "textarea" },
                        items: {
                            type: "array",
                            title: "Service Items",
                            items: {
                                type: "object",
                                properties: {
                                    titleEn: { type: "string", title: "Title (English)" },
                                    titleAr: { type: "string", title: "Title (Arabic)" },
                                    descriptionEn: { type: "string", title: "Description (English)", widget: "textarea" },
                                    descriptionAr: { type: "string", title: "Description (Arabic)", widget: "textarea" },
                                    icon: { type: "string", title: "Service Icon URL", widget: "image" }
                                }
                            }
                        }
                    }
                },
                categories: {
                    type: "object",
                    title: "Categories Section",
                    properties: {
                        sectionTitleEn: { type: "string", title: "Section Title (English)" },
                        sectionTitleAr: { type: "string", title: "Section Title (Arabic)" },
                        headingEn: { type: "string", title: "Heading (English)" },
                        headingAr: { type: "string", title: "Heading (Arabic)" },
                        items: {
                            type: "array",
                            title: "Category Items",
                            items: {
                                type: "object",
                                properties: {
                                    titleEn: { type: "string", title: "Category Title (English)" },
                                    titleAr: { type: "string", title: "Category Title (Arabic)" },
                                    descriptionEn: { type: "string", title: "Description (English)", widget: "textarea" },
                                    descriptionAr: { type: "string", title: "Description (Arabic)", widget: "textarea" },
                                    image: { type: "string", title: "Background Image", widget: "image" },
                                    link: { type: "string", title: "Link" }
                                }
                            }
                        }
                    }
                },
                industries: {
                    type: "object",
                    title: "Industries Overview (Carousel)",
                    properties: {
                        sectionTitleEn: { type: "string", title: "Section Title (English)" },
                        sectionTitleAr: { type: "string", title: "Section Title (Arabic)" },
                        headingEn: { type: "string", title: "Heading (English)" },
                        headingAr: { type: "string", title: "Heading (Arabic)" },
                        descriptionEn: { type: "string", title: "Description (English)", widget: "textarea" },
                        descriptionAr: { type: "string", title: "Description (Arabic)", widget: "textarea" },
                        items: {
                            type: "array",
                            title: "Industry Items",
                            items: {
                                type: "object",
                                properties: {
                                    titleEn: { type: "string", title: "Industry Title (English)" },
                                    titleAr: { type: "string", title: "Industry Title (Arabic)" },
                                    descriptionEn: { type: "string", title: "Description (English)", widget: "textarea" },
                                    descriptionAr: { type: "string", title: "Description (Arabic)", widget: "textarea" },
                                    image: { type: "string", title: "Image", widget: "image" }
                                }
                            }
                        }
                    }
                },
                social: {
                    type: "object",
                    title: "Social Community Section",
                    properties: {
                        sectionTitleEn: { type: "string", title: "Section Title (English)" },
                        sectionTitleAr: { type: "string", title: "Section Title (Arabic)" },
                        descriptionEn: { type: "string", title: "Description (English)", widget: "textarea" },
                        descriptionAr: { type: "string", title: "Description (Arabic)", widget: "textarea" }
                    }
                },
                insights: {
                    type: "object",
                    title: "Insights Section",
                    properties: {
                        sectionTitleEn: { type: "string", title: "Section Title (English)" },
                        sectionTitleAr: { type: "string", title: "Section Title (Arabic)" },
                        headingEn: { type: "string", title: "Heading (English)" },
                        headingAr: { type: "string", title: "Heading (Arabic)" },
                        viewMoreButtonEn: { type: "string", title: "Button Text (English)" },
                        viewMoreButtonAr: { type: "string", title: "Button Text (Arabic)" },
                        items: {
                            type: "array",
                            title: "Insight Previews",
                            items: {
                                type: "object",
                                properties: {
                                    titleEn: { type: "string", title: "Title (English)" },
                                    titleAr: { type: "string", title: "Title (Arabic)" },
                                    descriptionEn: { type: "string", title: "Description (English)", widget: "textarea" },
                                    descriptionAr: { type: "string", title: "Description (Arabic)", widget: "textarea" },
                                    image: { type: "string", title: "Image", widget: "image" },
                                    dateEn: { type: "string", title: "Date (English)" },
                                    dateAr: { type: "string", title: "Date (Arabic)" },
                                    categoryEn: { type: "string", title: "Category (English)" },
                                    categoryAr: { type: "string", title: "Category (Arabic)" },
                                    authorEn: { type: "string", title: "Author (English)" },
                                    authorAr: { type: "string", title: "Author (Arabic)" },
                                    readTimeEn: { type: "string", title: "Read Time (English)" },
                                    readTimeAr: { type: "string", title: "Read Time (Arabic)" },
                                    contentEn: { type: "string", title: "Full Content (English)", widget: "richtext" },
                                    contentAr: { type: "string", title: "Full Content (Arabic)", widget: "richtext" },
                                    slug: { type: "string", title: "Slug (for detail page)" },
                                    link: { type: "string", title: "Link (URL override)" }
                                }
                            }
                        }
                    }
                }
            }
        },
        defaultContent: {
            banner: {
                backgroundImage: "/images/companybanner.jpg",
                titleEn: "Premium <span class='text-[#ED2823]'>Stationery Solutions</span> <br /> for Every Office",
                titleAr: "حلول <span class='text-[#ED2823]'>القرطاسية</span> المتميزة <br /> لكل مكتب",
                descriptionEn: "Paperland specializes in top-tier stationery solutions, providing trusted brands like Pelikan, Deli",
                descriptionAr: "تتخصص شركة بايبر لاند في تقديم حلول القرطاسية عالية المستوى، وتوفير علامات تجارية موثوقة مثل Pelikan و Deli",
                buttonTextEn: "Explore More",
                buttonTextAr: "اكتشف المزيد",
                buttonLink: "/products",
                ratingTextEn: "4.5/5 on the stores",
                ratingTextAr: "4.5/5 في المتاجر"
            },
            expertise: {
                sectionTitleEn: "OUR EXPERTISE",
                sectionTitleAr: "خبرتنا",
                headingEn: "The Stationery Specialists! We provide one stop solution",
                headingAr: "متخصصو القرطاسية! نحن نقدم حلاً شاملاً",
                descriptionEn: "Paperland specializes in top-tier stationery solutions...",
                descriptionAr: "تتخصص شركة بايبر لاند في تقديم حلول القرطاسية عالية المستوى...",
                viewMoreButtonEn: "View More",
                viewMoreButtonAr: "اقرأ المزيد",
                viewMoreLink: "/company/about",
                items: [
                    { value: "20+", labelEn: "World Wide Dealerships", labelAr: "وكلاء حول العالم" },
                    { value: "4.7", labelEn: "Customer Rating", labelAr: "تقييم العملاء" },
                    { value: "50+", labelEn: "World Wide Locations", labelAr: "مواقع حول العالم" },
                    { value: "400+", labelEn: "Satisfied Customer", labelAr: "عميل راضٍ" }
                ]
            },
            services: {
                sectionTitleEn: "FILTERS SPECIALISTS",
                sectionTitleAr: "أخصائيو الفلاتر",
                headingEn: "Our promised services",
                headingAr: "خدماتنا الموعودة",
                descriptionEn: "Filters Experts leads in turn-key soft wash equipment with top-tier filtration.",
                descriptionAr: "تتخصص شركة خبراء الفلاتر للتجارة في تقديم حلول تنقية عالية المستوى، وتوفير علامات تجارية موثوقة مثل Fleetguard و Donaldson.",
                items: [
                    { titleEn: "Innovation", titleAr: "الابتكار", descriptionEn: "Investing in research and development clearly pays off.", descriptionAr: "الاستثمار في البحث والتطوير يؤتي ثماره بوضوح.", icon: "/images/vectors/promisedservice.png" },
                    { titleEn: "Sustainability", titleAr: "الاستدامة", descriptionEn: "Charging your car can be a chance for you to recharge too.", descriptionAr: "شحن سيارتك يمكن أن يكون فرصة لك لإعادة شحن طاقتك أيضًا.", icon: "/images/vectors/sustainability.png" },
                    { titleEn: "Digital Transformation", titleAr: "التحول الرقمي", descriptionEn: "Making the world a healthier place by helping to reduce stress and clean our cities", descriptionAr: "جعل العالم مكانًا أكثر صحة من خلال المساعدة في تقليل التوتر وتنظيف مدننا.", icon: "/images/vectors/digitaltransformation.png" }
                ]
            },
            categories: {
                sectionTitleEn: "ALL YOU NEED",
                sectionTitleAr: "كل ما تحتاجه",
                headingEn: "Filter Categories",
                headingAr: "فئات الفلاتر",
                items: [
                    { titleEn: "Air Filters", titleAr: "فلاتر الهواء", descriptionEn: "Investing in research and development clearly pays off.", descriptionAr: "الاستثمار في البحث والتطوير يؤتي ثماره بوضوح.", image: "/images/company/airfilter.jpg", link: "/products?category=air-filters" },
                    { titleEn: "Vacuum Filters", titleAr: "فلاتر الفراغ", descriptionEn: "Investing in research and development clearly pays off.", descriptionAr: "الاستثمار في البحث والتطوير يؤتي ثماره بوضوح.", image: "/images/company/vaccumefilter.png", link: "/products?category=vaccum-filters" },
                    { titleEn: "Air deoiling", titleAr: "إزالة الزيت من الهواء", descriptionEn: "Investing in research and development clearly pays off.", descriptionAr: "الاستثمار في البحث والتطوير يؤتي ثماره بوضوح.", image: "/images/company/airdeoiling.jpg", link: "/products?category=air-deoiling" },
                    { titleEn: "Hydraulic filters", titleAr: "الفلاتر الهيدروليكية", descriptionEn: "Investing in research and development clearly pays off.", descriptionAr: "الاستثمار في البحث والتطوير يؤتي ثماره بوضوح.", image: "/images/company/hydraulicfilter.jpg", link: "/products?category=hydraulic-filters" }
                ]
            },
            industries: {
                sectionTitleEn: "INDUSTRIES WE SERVE",
                sectionTitleAr: "الصناعات التي نخدمها",
                headingEn: "Filtration solutions for every industry and sector",
                headingAr: "حلول الترشيح لكل صناعة وقطاع",
                descriptionEn: "Filters Experts leads in turn-key soft wash equipment with top-tier filtration.",
                descriptionAr: "تتصدر شركة خبراء الفلاتر في معدات الغسيل الناعم الجاهزة مع ترشيح من الدرجة الأولى.",
                items: [
                    { titleEn: "Automotive", titleAr: "السيارات", descriptionEn: "Technology, innovation & systems integration", descriptionAr: "التكنولوجيا والابتكار وتكامل الأنظمة", image: "https://images.unsplash.com/photo-1617074064882-3ca2e8f96bbd?w=600&auto=format&fit=crop" },
                    { titleEn: "Water Rescue", titleAr: "الإنقاذ المائي", descriptionEn: "Technology, innovation & systems integration", descriptionAr: "التكنولوجيا والابتكار وتكامل الأنظمة", image: "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=600&h=800&fit=crop" },
                    { titleEn: "Agriculture", titleAr: "الزراعة", descriptionEn: "Technology, innovation & systems integration", descriptionAr: "التكنولوجيا والابتكار وتكامل الأنظمة", image: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=600&h=800&fit=crop" },
                    { titleEn: "Mining", titleAr: "التعدين", descriptionEn: "Technology, innovation & systems integration", descriptionAr: "التكنولوجيا والابتكار وتكامل الأنظمة", image: "https://images.unsplash.com/photo-1578319439584-104c94d37305?w=600&h=800&fit=crop" },
                    { titleEn: "Marine", titleAr: "البحرية", descriptionEn: "Technology, innovation & systems integration", descriptionAr: "التكنولوجيا والابتكار وتكامل الأنظمة", image: "https://images.unsplash.com/photo-1559825481-12a05cc00344?w=600&h=800&fit=crop" },
                    { titleEn: "Energy", titleAr: "الطاقة", descriptionEn: "Technology, innovation & systems integration", descriptionAr: "التكنولوجيا والابتكار وتكامل الأنظمة", image: "https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=600&h=800&fit=crop" }
                ]
            },
            social: {
                sectionTitleEn: "Be a part of our Social Community",
                sectionTitleAr: "كن جزءاً من مجتمعنا الاجتماعي",
                descriptionEn: "",
                descriptionAr: "",
                items: [
                    { image: "/images/instagram/image.png", link: "https://instagram.com" },
                    { image: "/images/instagram/image1.png", link: "https://instagram.com" },
                    { image: "/images/instagram/image2.png", link: "https://instagram.com" },
                    { image: "/images/instagram/image1.png", link: "https://instagram.com" },
                    { image: "/images/instagram/image.png", link: "https://instagram.com" }
                ]
            },
            insights: {
                sectionTitleEn: "OUR INSIGHTS",
                sectionTitleAr: "رؤانا",
                headingEn: "Discover the filter world Insights!",
                headingAr: "اكتشف عالم الفلاتر!",
                viewMoreButtonEn: "View More",
                viewMoreButtonAr: "عرض المزيد",
                items: [
                    {
                        titleEn: "Filters Experts expands Management Board",
                        titleAr: "خبراء الفلاتر يوسعون مجلس الإدارة",
                        descriptionEn: "As the next step on the path toward Leadership in Filtration, Filters Expert is strengthening its leadership structure and expanding its Management Board",
                        descriptionAr: "كخطوة تالية على طريق الريادة في الترشيح، تعمل شركة خبراء الفلاتر على تعزيز هيكلها القيادي وتوسيع مجلس إدارتها",
                        image: "/images/company/management.jpg",
                        dateEn: "June 2, 2025",
                        dateAr: "٢ يونيو ٢٠٢٥",
                        categoryEn: "Corporate Communications",
                        categoryAr: "الاتصالات المؤسسية",
                        authorEn: "Filters Expert Team",
                        authorAr: "فريق خبراء الفلاتر",
                        readTimeEn: "5 min read",
                        readTimeAr: "٥ دقائق قراءة",
                        contentEn: "<p>Full content description goes here...</p>",
                        contentAr: "<p>وصف المحتوى الكامل يذهب هنا...</p>",
                        slug: "filters-experts-expands-management-board",
                        link: "#"
                    },
                    {
                        titleEn: "Filters Experts opens South African Production Facility",
                        titleAr: "خبراء الفلاتر يفتتحون مرفق إنتاج في جنوب أفريقيا",
                        descriptionEn: "New CO2-reduced filters impregnated with plant-based raw materials, manufactured using renewable energy, and packaged in sustainable, recycled material.",
                        descriptionAr: "فلاتر جديدة مخفضة لثاني أكسيد الكربون مشربة بمواد خام نباتية، مصنعة باستخدام الطاقة المتجددة، ومعبأة في مواد مستدامة ومعاد تدويرها.",
                        image: "/images/company/production.jpg",
                        dateEn: "June 2, 2025",
                        dateAr: "٢ يونيو ٢٠٢٥",
                        categoryEn: "Corporate Communications",
                        categoryAr: "الاتصالات المؤسسية",
                        authorEn: "Filters Expert Team",
                        authorAr: "فريق خبراء الفلاتر",
                        readTimeEn: "5 min read",
                        readTimeAr: "٥ دقائق قراءة",
                        contentEn: "<p>Full content description goes here...</p>",
                        contentAr: "<p>وصف المحتوى الكامل يذهب هنا...</p>",
                        slug: "south-african-production-facility",
                        link: "#"
                    },
                    {
                        titleEn: "Filtration of the future - inspired by nature",
                        titleAr: "ترشيح المستقبل - مستوحى من الطبيعة",
                        descriptionEn: "New CO2-reduced filters impregnated with plant-based raw materials, manufactured using renewable energy, and packaged in sustainable, recycled material.",
                        descriptionAr: "فلاتر جديدة مخفضة لثاني أكسيد الكربون مشربة بمواد خام نباتية، مصنعة باستخدام الطاقة المتجددة، ومعبأة في مواد مستدامة ومعاد تدويرها.",
                        image: "/images/company/filteration.png",
                        dateEn: "June 2, 2025",
                        dateAr: "٢ يونيو ٢٠٢٥",
                        categoryEn: "Corporate Communications",
                        categoryAr: "الاتصالات المؤسسية",
                        authorEn: "Filters Expert Team",
                        authorAr: "فريق خبراء الفلاتر",
                        readTimeEn: "5 min read",
                        readTimeAr: "٥ دقائق قراءة",
                        contentEn: "<p>Full content description goes here...</p>",
                        contentAr: "<p>وصف المحتوى الكامل يذهب هنا...</p>",
                        slug: "filtration-of-the-future",
                        link: "#"
                    }
                ]
            }
        }
    },
    {
        slug: "media-center",
        title: "Media Center",
        description: "Media center page with gallery, videos and resources",
        schema: {
            type: "object",
            properties: {
                banner: {
                    type: "object",
                    title: "Banner Section",
                    properties: {
                        backgroundImage: { type: "string", title: "Background Image", widget: "image" },
                        titleEn: { type: "string", title: "Title (English)" },
                        titleAr: { type: "string", title: "Title (Arabic)" },
                        subtitleEn: { type: "string", title: "Subtitle (English)" },
                        subtitleAr: { type: "string", title: "Subtitle (Arabic)" }
                    }
                },
                photosSection: {
                    type: "object",
                    title: "Photo Gallery Section",
                    properties: {
                        titleEn: { type: "string", title: "Heading (English)" },
                        titleAr: { type: "string", title: "Heading (Arabic)" },
                        descriptionEn: { type: "string", title: "Description (English)", widget: "textarea" },
                        descriptionAr: { type: "string", title: "Description (Arabic)", widget: "textarea" },
                        viewFullGalleryButtonEn: { type: "string", title: "Button Text (English)", default: "View Full Gallery" },
                        viewFullGalleryButtonAr: { type: "string", title: "Button Text (Arabic)", default: "عرض المعرض الكامل" },
                        items: {
                            type: "array",
                            title: "Gallery Images",
                            items: {
                                type: "object",
                                properties: {
                                    image: { type: "string", title: "Image", widget: "image" },
                                    altEn: { type: "string", title: "Alt Text (English)" },
                                    altAr: { type: "string", title: "Alt Text (Arabic)" }
                                }
                            }
                        }
                    }
                },
                videosSection: {
                    type: "object",
                    title: "Video Library Section",
                    properties: {
                        titleEn: { type: "string", title: "Heading (English)" },
                        titleAr: { type: "string", title: "Heading (Arabic)" },
                        descriptionEn: { type: "string", title: "Description (English)", widget: "textarea" },
                        descriptionAr: { type: "string", title: "Description (Arabic)", widget: "textarea" },
                        items: {
                            type: "array",
                            title: "Video Items",
                            items: {
                                type: "object",
                                properties: {
                                    titleEn: { type: "string", title: "Title (English)" },
                                    titleAr: { type: "string", title: "Title (Arabic)" },
                                    durationEn: { type: "string", title: "Duration (English)" },
                                    durationAr: { type: "string", title: "Duration (Arabic)" },
                                    image: { type: "string", title: "Thumbnail Image", widget: "image" },
                                    videoUrl: { type: "string", title: "Video URL" }
                                }
                            }
                        }
                    }
                },
                resourcesSection: {
                    type: "object",
                    title: "Media Resources Section",
                    properties: {
                        titleEn: { type: "string", title: "Heading (English)" },
                        titleAr: { type: "string", title: "Heading (Arabic)" },
                        descriptionEn: { type: "string", title: "Description (English)", widget: "textarea" },
                        descriptionAr: { type: "string", title: "Description (Arabic)", widget: "textarea" },
                        items: {
                            type: "array",
                            title: "Resource Items",
                            items: {
                                type: "object",
                                properties: {
                                    titleEn: { type: "string", title: "Title (English)" },
                                    titleAr: { type: "string", title: "Title (Arabic)" },
                                    typeEn: { type: "string", title: "File Type (e.g. PDF)" },
                                    typeAr: { type: "string", title: "File Type Ar" },
                                    sizeEn: { type: "string", title: "File Size" },
                                    sizeAr: { type: "string", title: "File Size Ar" },
                                    fileUrl: { type: "string", title: "Download URL", widget: "image" },
                                    iconType: { 
                                        type: "string", 
                                        title: "Icon Type", 
                                        enum: ["pdf", "image", "archive", "general"],
                                        default: "pdf"
                                    }
                                }
                            }
                        }
                    }
                },
                infoBanner: {
                    type: "object",
                    title: "Info Banner",
                    properties: {
                        headingEn: { type: "string", title: "Heading (English)", default: "Need More Information?" },
                        headingAr: { type: "string", title: "Heading (Arabic)", default: "هل تحتاج لمزيد من المعلومات؟" },
                        subtextEn: { type: "string", title: "Subtext (English)", default: "Contact our media relations team for additional resources and inquiries" },
                        subtextAr: { type: "string", title: "Subtext (Arabic)", default: "اتصل بفريق العلاقات الإعلامية لدينا لمزيد من الموارد والاستفسارات" },
                        buttonEn: { type: "string", title: "Button Text (English)", default: "Contact Media Team" },
                        buttonAr: { type: "string", title: "Button Text (Arabic)", default: "اتصل بفريق الإعلام" }
                    }
                }
            }
        },
        defaultContent: {
            banner: {
                backgroundImage: "/images/MediaCenter/mediacenterbanner.jpg",
                titleEn: "Media",
                titleAr: "المركز",
                subtitleEn: "Center",
                subtitleAr: "الإعلامي"
            },
            photosSection: {
                titleEn: "Photo Gallery",
                titleAr: "معرض الصور",
                descriptionEn: "Explore our facilities, products, and team in action",
                descriptionAr: "استكشف مرافقنا ومنتجاتنا وفريقنا في العمل",
                viewFullGalleryButtonEn: "View Full Gallery",
                viewFullGalleryButtonAr: "عرض المعرض الكامل",
                items: [
                    { image: "/images/MediaCenter/gallery.jpg", altEn: "Gallery 1", altAr: "صور 1" },
                    { image: "/images/MediaCenter/gallery1.jpg", altEn: "Gallery 2", altAr: "صور 2" },
                    { image: "/images/MediaCenter/gallery2.jpg", altEn: "Gallery 3", altAr: "صور 3" },
                    { image: "/images/MediaCenter/gallery3.jpg", altEn: "Gallery 4", altAr: "صور 4" },
                    { image: "/images/MediaCenter/gallery4.jpg", altEn: "Gallery 5", altAr: "صور 5" },
                    { image: "/images/MediaCenter/gallery5.jpg", altEn: "Gallery 6", altAr: "صور 6" }
                ]
            },
            videosSection: {
                titleEn: "Video Library",
                titleAr: "مكتبة الفيديو",
                descriptionEn: "Watch our company overview, product demonstrations, and customer testimonials",
                descriptionAr: "شاهد نظرة عامة على شركتنا، وعروض المنتجات، وشهادات العملاء",
                items: [
                    { titleEn: "Company Overview", titleAr: "نظرة عامة على الشركة", durationEn: "3:45 mins", durationAr: "٣:٤٥ دقائق", image: "/images/MediaCenter/gallery1.jpg", videoUrl: "" },
                    { titleEn: "Manufacturing Process", titleAr: "عملية التصنيع", durationEn: "5:20 mins", durationAr: "٥:٢٠ دقائق", image: "/images/MediaCenter/gallery3.jpg", videoUrl: "" },
                    { titleEn: "Product Showcase", titleAr: "عرض المنتج", durationEn: "4:10 mins", durationAr: "٤:١٠ دقائق", image: "/images/MediaCenter/gallery5.jpg", videoUrl: "" }
                ]
            },
            resourcesSection: {
                titleEn: "Media Resources",
                titleAr: "الموارد الإعلامية",
                descriptionEn: "Download our company materials, product catalogs, and press kits",
                descriptionAr: "قم بتنزيل مواد شركتنا وكتالوجات المنتجات والكتيبات الصحفية",
                items: [
                    { titleEn: "Company Brochure", titleAr: "كتيب الشركة", typeEn: "PDF", typeAr: "PDF", sizeEn: "2.5 MB", sizeAr: "٢.٥ ميجابايت", fileUrl: "", iconType: "pdf" },
                    { titleEn: "Product Catalog 2026", titleAr: "كتالوج المنتجات ٢٠٢٦", typeEn: "PDF", typeAr: "PDF", sizeEn: "8.3 MB", sizeAr: "٨.٣ ميجابايت", fileUrl: "", iconType: "pdf" },
                    { titleEn: "Logo Pack (High-Res)", titleAr: "حزمة الشعار", typeEn: "ZIP", typeAr: "ZIP", sizeEn: "4.1 MB", sizeAr: "٤.١ ميجابايت", fileUrl: "", iconType: "archive" },
                    { titleEn: "Press Release Archive", titleAr: "أرشيف البيانات الصحفية", typeEn: "PDF", typeAr: "PDF", sizeEn: "1.8 MB", sizeAr: "١.٨ ميجابايت", fileUrl: "", iconType: "pdf" }
                ]
            },
            infoBanner: {
                headingEn: "Need More Information?",
                headingAr: "هل تحتاج لمزيد من المعلومات؟",
                subtextEn: "Contact our media relations team for additional resources and inquiries",
                subtextAr: "اتصل بفريق العلاقات الإعلامية لدينا لمزيد من الموارد والاستفسارات",
                buttonEn: "Contact Media Team",
                buttonAr: "اتصل بفريق الإعلام"
            }
        }
    },
    {
        slug: "home",
        title: "Home Page",
        description: "Main landing page: hero banner, product sections, brands, instagram, reviews, and locations",
        schema: {
            type: "object",
            properties: {
                banner: {
                    type: "object",
                    title: "Hero Banner",
                    properties: {
                        backgroundImage: { type: "string", title: "Background Image", widget: "image" },
                        titlePart1En: { type: "string", title: "Title Part 1 (English)" },
                        titlePart1Ar: { type: "string", title: "Title Part 1 (Arabic)" },
                        titlePart2En: { type: "string", title: "Title Part 2 (English - Highlighted)" },
                        titlePart2Ar: { type: "string", title: "Title Part 2 (Arabic - Highlighted)" },
                        titlePart3En: { type: "string", title: "Title Part 3 (English)" },
                        titlePart3Ar: { type: "string", title: "Title Part 3 (Arabic)" },
                        descriptionEn: { type: "string", title: "Description (English)", widget: "textarea" },
                        descriptionAr: { type: "string", title: "Description (Arabic)", widget: "textarea" },
                        searchPlaceholderEn: { type: "string", title: "Search Placeholder (English)" },
                        searchPlaceholderAr: { type: "string", title: "Search Placeholder (Arabic)" },
                        searchButtonEn: { type: "string", title: "Search Button (English)" },
                        searchButtonAr: { type: "string", title: "Search Button (Arabic)" }
                    }
                },
                brandsSection: {
                    type: "object",
                    title: "Trusted Brands (Logo Loop)",
                    properties: {
                        titleEn: { type: "string", title: "Section Title (English)" },
                        titleAr: { type: "string", title: "Section Title (Arabic)" },
                        descriptionEn: { type: "string", title: "Description (English)" },
                        descriptionAr: { type: "string", title: "Description (Arabic)" },
                        items: {
                            type: "array",
                            title: "Brand Logos",
                            items: {
                                type: "object",
                                properties: {
                                    image: { type: "string", title: "Logo Image", widget: "image" },
                                    alt: { type: "string", title: "Alt Text" },
                                    link: { type: "string", title: "Link (Optional)" }
                                }
                            }
                        }
                    }
                },
                instagramSection: {
                    type: "object",
                    title: "Instagram Section",
                    properties: {
                        titleEn: { type: "string", title: "Title (English)" },
                        titleAr: { type: "string", title: "Title (Arabic)" },
                        descriptionEn: { type: "string", title: "Description (English)" },
                        descriptionAr: { type: "string", title: "Description (Arabic)" },
                        items: {
                            type: "array",
                            title: "Instagram Posts",
                            items: {
                                type: "object",
                                properties: {
                                    image: { type: "string", title: "Post Image", widget: "image" },
                                    link: { type: "string", title: "Post Link" }
                                }
                            }
                        }
                    }
                },
                reviewsSection: {
                    type: "object",
                    title: "Client Reviews",
                    properties: {
                        titleEn: { type: "string", title: "Title (English)" },
                        titleAr: { type: "string", title: "Title (Arabic)" },
                        descriptionEn: { type: "string", title: "Description (English)" },
                        descriptionAr: { type: "string", title: "Description (Arabic)" },
                        items: {
                            type: "array",
                            title: "Reviews",
                            items: {
                                type: "object",
                                properties: {
                                    titleEn: { type: "string", title: "Review Title (English)" },
                                    titleAr: { type: "string", title: "Review Title (Arabic)" },
                                    quoteEn: { type: "string", title: "Quote (English)", widget: "textarea" },
                                    quoteAr: { type: "string", title: "Quote (Arabic)", widget: "textarea" },
                                    authorEn: { type: "string", title: "Author (English)" },
                                    authorAr: { type: "string", title: "Author (Arabic)" },
                                    rating: { type: "number", title: "Rating (1-5)", default: 5 }
                                }
                            }
                        }
                    }
                },
                locationsSection: {
                    type: "object",
                    title: "Office Locations",
                    properties: {
                        titleEn: { type: "string", title: "Title (English)" },
                        titleAr: { type: "string", title: "Title (Arabic)" },
                        descriptionEn: { type: "string", title: "Description (English)" },
                        descriptionAr: { type: "string", title: "Description (Arabic)" },
                        countries: {
                            type: "array",
                            title: "Countries",
                            items: {
                                type: "object",
                                properties: {
                                    nameEn: { type: "string", title: "Country Name (English)" },
                                    nameAr: { type: "string", title: "Country Name (Arabic)" },
                                    offices: {
                                        type: "array",
                                        title: "Offices",
                                        items: {
                                            type: "object",
                                            properties: {
                                                cityEn: { type: "string", title: "City (English)" },
                                                cityAr: { type: "string", title: "City (Arabic)" },
                                                typeEn: { type: "string", title: "Type (English, e.g. Main Office)" },
                                                typeAr: { type: "string", title: "Type (Arabic)" },
                                                addressEn: { type: "string", title: "Address (English)" },
                                                addressAr: { type: "string", title: "Address (Arabic)" },
                                                phone: { type: "string", title: "Phone" },
                                                email: { type: "string", title: "Email" },
                                                hoursEn: { type: "string", title: "Hours (English)" },
                                                hoursAr: { type: "string", title: "Hours (Arabic)" },
                                                mapEmbedLink: { type: "string", title: "Google Maps Embed Link", widget: "textarea" }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        defaultContent: {
            banner: {
                backgroundImage: "/images/bannerBackgroundImg.png",
                titlePart1En: "Premium Filtration",
                titlePart1Ar: "حلول تنقية",
                titlePart2En: "Solutions",
                titlePart2Ar: "متميزة",
                titlePart3En: "for Every Industry",
                titlePart3Ar: "لكل صناعة",
                descriptionEn: "High-quality filters for every application, ensuring optimal performance and protection for your equipment.",
                descriptionAr: "فلاتر عالية الجودة لكل تطبيق، مما يضمن الأداء الأمثل والحماية لمعداتك.",
                searchPlaceholderEn: "Search for Part Number...",
                searchPlaceholderAr: "البحث عن رقم القطعة...",
                searchButtonEn: "Search",
                searchButtonAr: "بحث"
            },
            brandsSection: {
                titleEn: "Trusted Brands",
                titleAr: "العلامات التجارية الموثوقة",
                descriptionEn: "We partner with the world's leading filtration experts",
                descriptionAr: "نحن نشارك مع خبراء الترشيح الرائدين في العالم",
                items: [
                    { image: "/images/clientsLogo/image6153.png", alt: "Company 1" },
                    { image: "/images/clientsLogo/image6154.png", alt: "Company 2" },
                    { image: "/images/clientsLogo/image6155.png", alt: "Company 3" },
                    { image: "/images/clientsLogo/image6156.png", alt: "Company 4" },
                    { image: "/images/clientsLogo/image6157.png", alt: "Company 5" }
                ]
            },
            instagramSection: {
                titleEn: "Follow Us on Instagram",
                titleAr: "تابعنا على إنستغرام",
                descriptionEn: "Stay updated with our latest products and news",
                descriptionAr: "ابق على اطلاع بأحدث منتجاتنا وأخبارنا",
                items: [
                    { image: "/images/instagram/image.png", link: "https://instagram.com" },
                    { image: "/images/instagram/image1.png", link: "https://instagram.com" },
                    { image: "/images/instagram/image2.png", link: "https://instagram.com" }
                ]
            },
            reviewsSection: {
                titleEn: "What Our Clients Say",
                titleAr: "ماذا يقول عملاؤنا",
                descriptionEn: "Join thousands of satisfied customers worldwide",
                descriptionAr: "انضم إلى آلاف العملاء الراضين حول العالم",
                items: [
                    {
                        titleEn: "Reliable and Trustworthy",
                        titleAr: "موثوق وجدير بالثقة",
                        quoteEn: "We've been working with Filters Experts for nearly a decade, and they've become an indispensable part of our operations.",
                        quoteAr: "نحن نعمل مع خبراء الفلاتر منذ ما يقرب من عقد من الزمان، وقد أصبحوا جزءاً لا غنى عنه في عملياتنا.",
                        authorEn: "Glen R, MN",
                        authorAr: "جلين ر، إم إن",
                        rating: 5
                    }
                ]
            },
            locationsSection: {
                titleEn: "Our Global Presence",
                titleAr: "تواجدنا العالمي",
                descriptionEn: "Find us in major hubs across the region",
                descriptionAr: "تجدنا في المراكز الرئيسية عبر المنطقة",
                countries: [
                    {
                        nameEn: "Saudi Arabia",
                        nameAr: "المملكة العربية السعودية",
                        offices: [
                            {
                                cityEn: "Riyadh",
                                cityAr: "الرياض",
                                typeEn: "Main Office",
                                typeAr: "المكتب الرئيسي",
                                addressEn: "King Abdulaziz Street, Riyadh 12211",
                                addressAr: "شارع الملك عبد العزيز، الرياض 12211",
                                phone: "+966 11 123 4567",
                                email: "riyadh@filtersexperts.com",
                                hoursEn: "Sun - Thu: 8:00 AM - 6:00 PM",
                                hoursAr: "الأحد - الخميس: 8:00 صباحاً - 6:00 مساءً",
                                mapEmbedLink: ""
                            }
                        ]
                    }
                ]
            }
        }
    }
];

export function getTemplateBySlug(slug: string): CmsTemplate | undefined {
    return CMS_TEMPLATES.find(t => t.slug === slug);
}
