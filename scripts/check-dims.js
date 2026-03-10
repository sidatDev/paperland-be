// Using native fetch in Node.js 24+
// I might need to use native fetch if node version supports it, or require it if it's there.
// But earlier verification showed node v24.11.1 which supports fetch. 
// So I can simpler script.

async function checkProductDimensions() {
    // I need a product ID. I'll search for one first or list products.
    console.log("Fetching products list to find a test ID...");
    try {
         // Using native fetch
        const listRes = await fetch('http://localhost:3001/api/v1/shop/products?limit=1');
        const listData = await listRes.json();
        
        if (listData && listData.products && listData.products.length > 0) {
            const productId = listData.products[0].id;
            console.log(`Found Product ID: ${productId}`);
            
            console.log(`Fetching details for ${productId}...`);
            const detailRes = await fetch(`http://localhost:3001/api/v1/shop/products/${productId}`);
            const detailData = await detailRes.json();
            
            if (detailData.success) {
                const p = detailData.data;
                console.log("Product Details Retrieved.");
                console.log("Checking Dimensions:");
                console.log(`- Width: ${p.width}`);
                console.log(`- Length: ${p.length}`);
                console.log(`- Weight: ${p.weight}`);
                console.log(`- Volume: ${p.volume}`);
                
                if (p.width || p.length || p.weight || p.volume) {
                    console.log("SUCCESS: At least one dimension is present.");
                } else {
                    console.log("WARNING: No dimensions found for this product. Might need to update a product to test.");
                }
            } else {
                console.error("Failed to fetch product details:", detailData);
            }
        } else {
            console.log("No products found in the shop.");
        }
    } catch (err) {
        console.error("Error:", err);
    }
}

checkProductDimensions();
