import { PrismaClient } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import axios from 'axios';
import { PutObjectCommand, S3Client, CreateBucketCommand } from '@aws-sdk/client-s3';
import * as path from 'path';
import * as crypto from 'crypto';
import pLimit from 'p-limit'; // Added for batching logic
import he from 'he';

const prisma = new PrismaClient();

// Configure S3 matching file-upload.utils
const s3Client = new S3Client({
  region: process.env.S3_REGION || 'us-east-1',
  endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || '',
    secretAccessKey: process.env.S3_SECRET_KEY || '',
  },
  forcePathStyle: true,
});
const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'public-bucket';

const cleanTitle = (text: string) => he.decode(text || '').trim();

const slugify = (text: string) => (text || '').toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');

const stripHtml = (html: string) => (html || '').replace(/<[^>]*>?/gm, '').trim();

// Similarity Key helper: Removes color/size/quantity suffixes to group similar products
function getSimilarityKey(title: string): string {
    let t = title.toLowerCase();
    
    // 1. Remove obvious suffix blocks starting with dash or space
    t = t.replace(/[-\s]+(blue|red|black|white|green|yellow|purple|orange|pink|brown|grey|silver|gold|burgundy|taupe|violet|lilac|mint|rose|fiery|deep|sweet|neo|platinum|original|gold plated|gold trim|ct|gt|rollerball|ballpoint|fountain pen|roller ball|gel pen).*/gi, '');
    
    // 2. Remove standalone colors at the end even without dashes
    t = t.replace(/\s+(blue|red|black|white|green|yellow|purple|orange|pink|brown|grey|silver|gold|burgundy|taupe|violet|lilac|mint|rose|fiery|deep|sweet|neo|platinum)$/gi, '');
    
    // 3. Remove sizes and quantities
    t = t.replace(/\s*[(\[]?(\d+)\s*(pcs|piece|pack|box|ml|l|kg|g|oz|lb|mm|pages).*/gi, '');
    t = t.replace(/\s+(small|medium|large|xl|xs|fine|micro|bullet|chisel|chisl|item#).*/gi, '');

    return t.replace(/\s+[#@].*$/, '').trim();
}

async function uploadUrlToS3(imageUrl: string): Promise<string> {
    if (!imageUrl) return '';
    
    const PLACEHOLDER_URL = '/images/placeholders/product-placeholder.webp';
    let targetUrl = imageUrl.trim();

    // 1. AUTO-CORRECT: Amazon/Penworld images often miss the .jpg extension
    const amazonPatterns = ['ssl-images-amazon.com', 'media-amazon.com', 'penworld.com.pk'];
    const hasAmazonPattern = amazonPatterns.some(p => targetUrl.includes(p));
    if (hasAmazonPattern && !targetUrl.toLowerCase().match(/\.(jpg|jpeg|png|webp|gif|bmp)$/)) {
        targetUrl += '.jpg';
    }

    // CHECK: If URL is already on our S3, just return it.
    const s3Endpoint = (process.env.S3_PUBLIC_URL || process.env.S3_ENDPOINT || '').replace(/\/$/, "");
    if (targetUrl.startsWith(s3Endpoint)) {
        return targetUrl;
    }

    try {
        const response = await axios.get(targetUrl, { 
            responseType: 'arraybuffer', 
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const buffer = Buffer.from(response.data, 'binary');
        
        // STABLE KEY: Use a hash of the original URL to prevent duplicates in S3
        const urlHash = crypto.createHash('md5').update(targetUrl).digest('hex');
        
        const parsedUrl = new URL(targetUrl);
        parsedUrl.search = '';
        let ext = path.extname(parsedUrl.pathname);
        if (!ext) ext = '.jpg';
        
        const key = `products/${urlHash}${ext}`;

        const command = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            Body: buffer,
            ContentType: response.headers['content-type'] || 'image/jpeg',
            ACL: 'public-read',
        });

        try {
            await s3Client.send(command);
        } catch (err: any) {
            if (err.name === 'NoSuchBucket') {
                await s3Client.send(new CreateBucketCommand({ Bucket: BUCKET_NAME }));
                await s3Client.send(command);
            } else {
                throw err;
            }
        }

        const endpoint = (process.env.S3_PUBLIC_URL || process.env.S3_ENDPOINT || '').replace(/\/$/, "");
        return `${endpoint}/${BUCKET_NAME}/${key}`;
    } catch (e: any) {
        console.warn(`⚠️ Failed to upload image: ${targetUrl} - ${e.message}`);
        // Return placeholder instead of broken external link
        return PLACEHOLDER_URL;
    }
}

function mapTypeToCategorySlug(typeStr: string): string {
    const s = (typeStr || '').toLowerCase();
    if (s.includes('fountain pen ink') || s.includes('ink bottle')) return 'fountain-pen-inks';
    if (s.includes('fountain pen')) return 'fountain-pens';
    if (s.includes('ballpoint') || s.includes('ball pen')) return 'ballpoint-pens';
    if (s.includes('rollerball')) return 'rollerball-pens';
    if (s.includes('gel pen')) return 'gel-pens';
    if (s.includes('mechanical pencil')) return 'mechanical-pencils';
    if (s.includes('calligraphy')) return 'calligraphy-pens';
    if (s.includes('cartridge')) return 'ink-cartridges';
    if (s.includes('converter')) return 'converters';
    if (s.includes('refill')) {
        if (s.includes('ball')) return 'ballpoint-refills';
        if (s.includes('roller')) return 'rollerball-refills';
        if (s.includes('gel')) return 'gel-refills';
        return 'inks-refills';
    }
    if (s.includes('highlighter')) return 'highlighters';
    if (s.includes('board marker')) return 'board-markers';
    if (s.includes('permanent')) return 'permanent-markers';
    if (s.includes('marker')) return 'markers';
    if (s.includes('cufflink')) return 'cufflinks';
    if (s.includes('wallet')) return 'wallets';
    if (s.includes('card holder')) return 'card-holders';
    if (s.includes('key ring') || s.includes('keychain')) return 'key-rings';
    if (s.includes('eyewear')) return 'eyewear';
    if (s.includes('pen case')) return 'pen-cases';
    if (s.includes('bag') || s.includes('travel')) return 'bags-travel';
    if (s.includes('belt')) return 'belts';
    return 'stationery-office';
}

function detectAttributeName(title: string): string {
    if (!title) return "Option";
    const lTitle = title.toLowerCase();
    if (/(pcs|piece|pack|box)/.test(lTitle)) return "Quantity";
    if (/\b(\d+)\s?(ml|l|kg|g|oz|lb|mm)\b/.test(lTitle)) return "Volume / Size";
    if (/(blue|red|black|white|green|yellow|purple|orange|pink|brown|grey|silver|gold|burgundy|taupe|violet|lilac|mint|rose|platinum)/.test(lTitle)) return "Color";
    if (/(small|medium|large|xl|xs|pages|fine|micro|bullet|chisel|chisl)\b/.test(lTitle)) return "Size";
    return "Option";
}

function normalizeVariantValue(val: string): string {
    if (!val) return "";
    const v = val.trim();
    return v.charAt(0).toUpperCase() + v.slice(1);
}

async function main() {
    console.log('🏁 Starting Enhanced Product Import from Excel...');
    const filePath = path.join(__dirname, '../../Docs/Extracted_Data_PaperLand-8-4-2026_Enhanced.xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const categories = await prisma.category.findMany();
    const brands = await prisma.brand.findMany();
    
    let currencyRec = await prisma.currency.findUnique({ where: { code: 'PKR' } });
    if (!currencyRec) {
         currencyRec = await prisma.currency.create({ data: { code: 'PKR', name: 'Pakistani Rupee', symbol: 'Rs' } });
    }
    
    const othersBrand = brands.find(b => b.slug === 'others');
    if (!othersBrand) throw new Error('Others brand not found. Please assure brands are seeded.');

    const worksheet = workbook.getWorksheet('Products') || workbook.worksheets[0];
    if (!worksheet) {
        throw new Error("Could not find worksheet to process.");
    }

    const headerMap: Record<string, number> = {};
    worksheet.getRow(1).eachCell((cell, colNum) => {
        headerMap[String(cell.value).trim()] = colNum;
    });

    const getVal = (row: ExcelJS.Row, colName: string) => {
        const idx = headerMap[colName];
        if (!idx) return '';
        const v = row.getCell(idx).value;
        if (v && typeof v === 'object' && 'text' in v) return String(v.text).trim(); // formula/hyperlink case
        return v ? String(v).trim() : '';
    };

    type FlatRow = Record<string, string>;
    const rawData: FlatRow[] = [];

    const rowCount = worksheet.rowCount;
    for (let r = 2; r <= rowCount; r++) {
        const row = worksheet.getRow(r);
        if (!row.hasValues) continue;
        
        let rowObj: any = {};
        for (const [header, idx] of Object.entries(headerMap)) {
            rowObj[header] = getVal(row, header);
        }
        
        if (rowObj['product_page_status'] === '404/Broken') continue;
        if (!rowObj['Title'] || !rowObj['Handle']) continue;

        // RULE: Remove products with no images
        if (!rowObj['all_images'] || rowObj['all_images'] === 'null' || rowObj['all_images'].trim() === '') {
            continue;
        }

        rawData.push(rowObj);
    }

    // STRICT GROUPING: By Similarity Key (Base Title)
    const grouped = new Map();
    for (const row of rawData) {
        const simKey = getSimilarityKey(row['Title']);
        if (!grouped.has(simKey)) grouped.set(simKey, []);
        grouped.get(simKey).push(row);
    }

    console.log(`\n📂 Normalized into ${grouped.size} products from ${rawData.length} rows (Similarity Grouping).`);

    const limit = pLimit(10);
    const updatedIds = new Set<string>();    const tasks = Array.from(grouped.entries()).map(([simKey, rows]) => limit(async () => {
        const baseRow = rows[0];
        const parentName = normalizeVariantValue(simKey).replace(/pen\s+$/i, 'Pen').trim(); 
        const description = stripHtml(baseRow['description_text']);
        const pkrPriceBase = parseFloat(baseRow['Price (PKR)']) || 0;
        const typeStr = baseRow['Type'];
        const productUrl = baseRow['product_url'];
        
        const handleHash = crypto.createHash('md5').update(simKey).digest('hex').substring(0, 10).toUpperCase();
        const baseSku = `IMP-H-${handleHash}`;
        const slug = (slugify(parentName) + '-' + baseSku).toLowerCase();

        // 1. Detect varying attributes
        const colorSet = new Set<string>();
        const quantitySet = new Set<string>();
        const colorRegex = /\b(blue|red|black|white|green|yellow|purple|orange|pink|brown|grey|silver|gold|burgundy|taupe|violet|lilac|mint|rose|fiery|deep|sweet|neo|platinum|original|gold plated|gold trim|ct|gt)\b/gi;

        const processedRows = rows.map((r: any) => {
            const rowTitle = r['Title'] || '';
            const variantTitle = r['variant_title'] || '';
            const colorMatch = rowTitle.match(colorRegex);
            const color = colorMatch ? normalizeVariantValue(colorMatch[0]) : 'Standard';
            const qty = variantTitle.trim() || '1 pc';
            
            colorSet.add(color);
            quantitySet.add(qty);
            return { ...r, _color: color, _qty: qty };
        });

        const variantOptions: any[] = [];
        if (colorSet.size > 1) {
            variantOptions.push({ name: 'Color', values: Array.from(colorSet) });
        }
        if (quantitySet.size > 1 || (processedRows.length > 1 && colorSet.size === 1)) {
            variantOptions.push({ name: 'Quantity', values: Array.from(quantitySet) });
        }

        // Image processing
        const uniqueImages = new Set<string>();
        for (const r of rows) {
            if (r['all_images'] && r['all_images'] !== 'null') {
                r['all_images'].split(',').map((u: string) => u.trim()).filter(Boolean).forEach((u: string) => uniqueImages.add(u));
            }
        }
        const imagesList = Array.from(uniqueImages).slice(0, 8);

        // LOGO FILTERING: Find the first image that doesn't look like a logo
        const logoRegex = /logo|brand|icon|social|banner/i;
        let mainImageUrl = imagesList[0];
        for (const img of imagesList) {
            if (!logoRegex.test(img)) {
                mainImageUrl = img;
                break;
            }
        }

        let s3Urls: string[] = [];
        if (imagesList.length === 0) return;

        try {
            // Upload main image first to ensure it's prioritized
            const mainS3 = await uploadUrlToS3(mainImageUrl);
            s3Urls.push(mainS3);
            
            // Upload remaining
            for (const imgUrl of imagesList) {
                if (imgUrl === mainImageUrl) continue;
                const uploadedUrl = await uploadUrlToS3(imgUrl);
                if (uploadedUrl !== imgUrl) s3Urls.push(uploadedUrl);
            }
        } catch (e) { return; }

        if (s3Urls.length === 0) return;

        // Metadata
        const rawBrand = baseRow['Vendor'];
        let brandId = othersBrand.id;
        if (rawBrand) {
            const b = brands.find(b => b.name.toLowerCase() === rawBrand.toLowerCase());
            if (b) brandId = b.id;
        }

        const expectedCatSlug = mapTypeToCategorySlug(typeStr || parentName);
        const category = categories.find(c => c.slug === expectedCatSlug) || categories.find(c => c.slug === 'stationery-office');
        const categoryId = category ? category.id : categories[0].id;

        // UPSERT PARENT
        const product = await prisma.product.upsert({
            where: { sku: baseSku },
            update: {
                name: parentName,
                slug,
                description,
                fullDescription: description,
                imageUrl: s3Urls[0],
                images: s3Urls,
                price: pkrPriceBase,
                isActive: true,
                isVisibleOnEcommerce: true,
                status: 'Active',
                variantOptions,
                parentId: null,
            },
            create: {
                name: parentName,
                sku: baseSku,
                slug,
                description,
                fullDescription: description,
                imageUrl: s3Urls[0],
                images: s3Urls,
                price: pkrPriceBase,
                brandId,
                categoryId,
                isActive: true,
                isVisibleOnEcommerce: true,
                status: 'Active',
                variantOptions,
            }
        });
        updatedIds.add(product.id);

        // Parent Price Table Audit (for Homepage)
        const existingParentPrice = await prisma.price.findFirst({ where: { productId: product.id } });
        await prisma.price.upsert({
            where: { id: existingParentPrice?.id || '00000000-0000-0000-0000-000000000000' },
            update: { priceRetail: pkrPriceBase, priceSpecial: pkrPriceBase, isActive: true },
            create: { productId: product.id, currencyId: currencyRec!.id, priceRetail: pkrPriceBase, priceSpecial: pkrPriceBase, isActive: true }
        });

        // UPSERT VARIANTS
        for (let i = 0; i < processedRows.length; i++) {
            const r = processedRows[i];
            const varSku = `${baseSku}-V${i + 1}`;
            const pkrPrice = parseFloat(r['Price (PKR)']) || pkrPriceBase;
            
            const variantAttributes: any = {};
            if (colorSet.size > 1) variantAttributes['Color'] = r._color;
            if (quantitySet.size > 1 || (processedRows.length > 1 && colorSet.size === 1)) {
                 variantAttributes['Quantity'] = r._qty;
            }

            const varImages = r['all_images'] && r['all_images'] !== 'null' ? r['all_images'].split(',')[0].trim() : null;
            let varImageS3 = product.imageUrl;
            if (varImages) {
                try {
                    const uploaded = await uploadUrlToS3(varImages);
                    if (uploaded !== varImages) varImageS3 = uploaded;
                } catch {}
            }

            const variant = await prisma.product.upsert({
                where: { sku: varSku },
                update: {
                    name: cleanTitle(r['Title']),
                    price: pkrPrice,
                    imageUrl: varImageS3,
                    isActive: true,
                    isVisibleOnEcommerce: true,
                    status: 'Active',
                    variantAttributes,
                    parentId: product.id,
                },
                create: {
                    name: cleanTitle(r['Title']),
                    sku: varSku,
                    price: pkrPrice,
                    imageUrl: varImageS3,
                    brandId: product.brandId,
                    categoryId: product.categoryId,
                    isActive: true,
                    isVisibleOnEcommerce: true,
                    status: 'Active',
                    variantAttributes,
                    parentId: product.id,
                }
            });
            updatedIds.add(variant.id);
            
            const existingPrice = await prisma.price.findFirst({ where: { productId: variant.id } });
            await prisma.price.upsert({
                where: { id: existingPrice?.id || '00000000-0000-0000-0000-000000000000' },
                update: { priceRetail: pkrPrice, priceSpecial: pkrPrice, isActive: true },
                create: { productId: variant.id, currencyId: currencyRec!.id, priceRetail: pkrPrice, priceSpecial: pkrPrice, isActive: true }
            });

            await prisma.stock.upsert({
                where: { productId_warehouseId: { productId: variant.id, warehouseId: 'default-main-warehouse' } },
                update: { qty: 50 },
                create: { productId: variant.id, warehouseId: 'default-main-warehouse', qty: 50, locationId: 'MAIN' }
            });
        }
        process.stdout.write('.');
    }));
    
    await Promise.all(tasks);

    // SOFT CLEANUP: Deactivate any orphaned IMP- products that were not updated (meaning they are duplicates or unwanted)
    console.log('\n🧹 Performing soft cleanup of orphaned IMP products...');
    const orphaned = await prisma.product.findMany({
        where: {
            sku: { startsWith: 'IMP-' },
            id: { notIn: Array.from(updatedIds) },
            parentId: null
        },
        select: { id: true, sku: true }
    });

    if (orphaned.length > 0) {
        console.log(`🔍 Found ${orphaned.length} orphaned products. Marking as inactive.`);
        await prisma.product.updateMany({
            where: { id: { in: orphaned.map(o => o.id) } },
            data: { isActive: false, isVisibleOnEcommerce: false, status: 'Retired' }
        });
    }
    
    console.log(`\n✨ Normalized Import Complete! Processes executed safely.`);
}

main()
  .catch((e) => {
    console.error('❌ Script failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
