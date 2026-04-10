import { PrismaClient } from '@prisma/client';
import ExcelJS from 'exceljs';
import axios from 'axios';
import { PutObjectCommand, S3Client, CreateBucketCommand } from '@aws-sdk/client-s3';
import path from 'path';
import crypto from 'crypto';

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

// Helper: Slugify
const slugify = (text: string) => text.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');

// Process Image
async function uploadUrlToS3(imageUrl: string): Promise<string> {
    if (!imageUrl) return '';
    try {
        const response = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 10000 });
        const buffer = Buffer.from(response.data, 'binary');
        
        let ext = path.extname(new URL(imageUrl).pathname);
        if (!ext) ext = '.jpg';
        const uniqueName = `${crypto.randomBytes(16).toString('hex')}${ext}`;
        const key = `products/${uniqueName}`;

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
        console.error(`Failed to upload image ${imageUrl}:`, e.message);
        return imageUrl; // Fallback to original if upload fails
    }
}

// Category Mapping helper
function mapTypeToCategorySlug(typeStr: string): string {
    const s = typeStr.toLowerCase();
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
    
    // Accessories
    if (s.includes('cufflink')) return 'cufflinks';
    if (s.includes('wallet')) return 'wallets';
    if (s.includes('card holder')) return 'card-holders';
    if (s.includes('key ring') || s.includes('keychain')) return 'key-rings';
    if (s.includes('eyewear')) return 'eyewear';
    if (s.includes('pen case')) return 'pen-cases';
    if (s.includes('bag') || s.includes('travel')) return 'bags-travel';
    if (s.includes('belt')) return 'belts';
    
    return 'stationery-office'; // default fallback
}

async function main() {
    console.log('🏁 Starting Product Import from Excel...');
    const filePath = path.join(__dirname, '../../docs/Extracted_Data_PaperLand-8-4-2026.xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    // Get Lookups
    const categories = await prisma.category.findMany();
    const brands = await prisma.brand.findMany();
    
    // Ensure Currency
    let currencyRec = await prisma.currency.findUnique({ where: { code: 'PKR' } });
    if (!currencyRec) {
         currencyRec = await prisma.currency.create({ data: { code: 'PKR', name: 'Pakistani Rupee', symbol: 'Rs' } });
    }
    
    const othersBrand = brands.find(b => b.slug === 'others');
    if (!othersBrand) throw new Error('Others brand not found. Run category seeds first.');

    // Process Sheets
    const targetSheets = [
        { name: 'Estationery', prefix: 'IMP-EST' }, 
        { name: 'Penworld', prefix: 'IMP-PW' }
    ];

    let totalImported = 0;

    for (const sheetDef of targetSheets) {
        const worksheet = workbook.getWorksheet(sheetDef.name);
        if (!worksheet) {
            console.log(`⚠️ Sheet ${sheetDef.name} not found, skipping.`);
            continue;
        }

        console.log(`\n📂 Processing Sheet: ${sheetDef.name}`);
        
        // Find Headers
        const headerRow = worksheet.getRow(1);
        const colMap: Record<string, number> = {};
        headerRow.eachCell((cell, colNum) => {
            colMap[String(cell.value).trim()] = colNum;
        });

        const rowCount = worksheet.rowCount;
        // Start from row 2
        for (let r = 2; r <= rowCount; r++) {
            const row = worksheet.getRow(r);
            if (!row.hasValues) continue;

            const getVal = (colName: string) => {
                const idx = colMap[colName];
                if (!idx) return '';
                const v = row.getCell(idx).value;
                if (v && typeof v === 'object' && 'text' in v) return v.text; // formula/hyperlink case
                return v ? String(v).trim() : '';
            };

            const title = getVal('Title');
            if (!title) continue; // Skip empty rows

            // Generate SKU
            totalImported++;
            const skuNum = totalImported.toString().padStart(4, '0');
            const sku = `${sheetDef.prefix}-${skuNum}`;
            const slug = slugify(title) + '-' + slugify(sku);

            const images = [getVal('Image 1'), getVal('Image 2'), getVal('Image 3'), getVal('Image 4'), getVal('Image 5')].filter(Boolean);
            const specifications: any = {
                original_image_sources: images,
                import_source: sheetDef.name
            };

            // Skip or Update Metadata if already exists
            const existing = await prisma.product.findFirst({ where: { name: title } });
            if (existing) {
                console.log(`  🔄 Updating Metadata: [${existing.sku}] ${title}`);
                await prisma.product.update({
                    where: { id: existing.id },
                    data: { specifications }
                });
                continue;
            }

            const description = getVal('Description');
            const rawBrand = getVal('Vendor/Brand') || getVal('Vendor');
            const typeStr = getVal('Type');
            const pricePkr = parseFloat(getVal('Price (PKR)')) || 0;

            // Determine Brand
            let brandId = othersBrand.id;
            if (rawBrand) {
                const found = brands.find(b => b.name.toLowerCase() === rawBrand.toLowerCase());
                if (found) brandId = found.id;
            } else if (sheetDef.name === 'Penworld') {
                // Try finding brand from title or type string
                const found = brands.find(b => title.toLowerCase().includes(b.name.toLowerCase()));
                if (found) brandId = found.id;
            }

            // Determine Category
            const expectedSlug = mapTypeToCategorySlug(typeStr || title);
            const category = categories.find(c => c.slug === expectedSlug) || categories.find(c => c.slug === 'stationery-office');
            if (!category) {
                console.log(`⚠️ Category not found for ${title}`);
                continue;
            }
            
            // Upload images to S3
            const s3Urls = [];
            let i = 1;
            for (const img of images) {
                process.stdout.write(`    [Img ${i++}/${images.length}] `);
                s3Urls.push(await uploadUrlToS3(img));
            }

            // Insert to DB
            try {
                process.stdout.write(`\n  🟢 Inserting: [${sku}] ${title} ...`);
                await prisma.product.create({
                    data: {
                        name: title,
                        slug,
                        sku,
                        description,
                        fullDescription: description,
                        price: pricePkr,
                        isActive: true,
                        isVisibleOnEcommerce: true,
                        status: 'Published',
                        categoryId: category.id,
                        brandId: brandId,
                        imageUrl: s3Urls[0] || null,
                        images: s3Urls,
                        specifications,
                        prices: {
                            create: {
                                currencyId: currencyRec.id,
                                priceRetail: pricePkr,
                                priceWholesale: pricePkr, // as per instructions (same as retail or setting to it)
                                priceSpecial: 0,
                                isActive: true
                            }
                        },
                        stocks: {
                            create: { locationId: 'MAIN', qty: 0 } // Stock 0
                        }
                    }
                });
                console.log(` Done.`);
            } catch (e: any) {
                console.log(`\n  ❌ Error inserting ${sku}: ${e.message}`);
            }
        }
    }
    
    console.log(`\n✨ Import Complete! Processed ${totalImported} products.`);
}

main()
  .catch((e) => {
    console.error('❌ Script failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
