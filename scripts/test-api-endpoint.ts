
async function testApi() {
    try {
        console.log("Testing GET http://localhost:5000/api/shop/products ...");
        const res = await fetch('http://localhost:5000/api/shop/products');
        
        console.log(`Status: ${res.status} ${res.statusText}`);
        
        if (res.ok) {
            const data = await res.json();
            console.log("Response Data Preview:", JSON.stringify(data, null, 2).slice(0, 500));
            
            if (data.data?.products?.length === 0) {
                console.log("WARNING: Products array is empty!");
            } else {
                console.log(`Success! Found ${data.data?.products?.length} products.`);
            }
        } else {
            console.log("Error body:", await res.text());
        }

    } catch (error) {
        console.error("Fetch failed. Is the server running on port 5000?", error);
    }
}

testApi();
