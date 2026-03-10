require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

async function checkKpiEndpoint() {
    console.log("Checking KPI Endpoint...");
    try {
        const apiUrl = process.env.API_URL || 'http://localhost:3001';
        const res = await fetch(`${apiUrl}/api/v1/admin/dashboard/kpi`);
        console.log(`Status: ${res.status}`);
        
        try {
            const data = await res.json();
            console.log("Response Body:", JSON.stringify(data, null, 2));
        } catch (e) {
            const text = await res.text();
            console.log("Response Text:", text);
        }
    } catch (err) {
        console.error("Fetch Error:", err);
    }
}

checkKpiEndpoint();
