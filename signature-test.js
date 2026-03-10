const axios = require("axios");
const jwt = require("jsonwebtoken");

async function testSignatureValidation() {
  const baseUrl = "http://localhost:3001/api/v1";
  const wrongSecret = "wrong-secret-123";
  const payload = { id: "admin-id", role: "SUPER_ADMIN" };

  // Create a token signed with a different secret
  const invalidToken = jwt.sign(payload, wrongSecret, { expiresIn: "8h" });

  console.log("Testing with token signed with WRONG secret...");
  console.log("Token:", invalidToken);

  try {
    const response = await axios.get(`${baseUrl}/admin/products`, {
      headers: {
        Authorization: `Bearer ${invalidToken}`,
      },
    });
    console.log(
      "CRITICAL SECURITY VULNERABILITY: Server accepted token signed with wrong secret!",
      response.status,
    );
    process.exit(1);
  } catch (err) {
    if (err.response && err.response.status === 401) {
      console.log(
        "SUCCESS: Server rejected invalid signature with 401 Unauthorized.",
      );
    } else if (err.response) {
      console.log(
        "Unexpected response:",
        err.response.status,
        err.response.data,
      );
    } else {
      console.log("Connection error:", err.message);
    }
  }
}

testSignatureValidation();
