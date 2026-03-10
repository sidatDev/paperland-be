// Native fetch
// Actually, I removed node-fetch from check-api.js earlier. 
// I should use the check-dims.js I made before but target the specific ID.

async function verifyApi() {
    const id = "36838e3f-fef4-49c9-b1fc-67e3ed7b850c";
    const url = `http://localhost:3001/api/shop/product/${id}`;
    
    console.log(`Fetching from ${url}...`);
    try {
        // Native fetch
        const res = await fetch(url);
        const json = await res.json();
        
        if (json.success) {
            console.log("API Response Data:", JSON.stringify(json.data, null, 2));
        } else {
            console.log("API Error:", json);
        }
    } catch (e) {
        console.error("Fetch failed:", e);
    }
}

verifyApi();
