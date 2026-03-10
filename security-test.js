const axios = require("axios");

async function testSecurity() {
  const baseUrl = "http://localhost:3001/api/v1";
  const corruptedToken =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEiLCJyb2xlIjoiYWRtaW4ifQ.invalid_signature_part";

  console.log("Testing PUT /admin/products/test-id with corrupted token...");
  try {
    const response = await axios.put(
      `${baseUrl}/admin/products/test-id`,
      {},
      {
        headers: {
          Authorization: `Bearer ${corruptedToken}`,
        },
      },
    );
    console.log(
      "UNSECURE: Request succeeded with corrupted token!",
      response.status,
    );
  } catch (err) {
    if (err.response) {
      console.log(
        "SECURE: Request failed as expected.",
        err.response.status,
        err.response.data,
      );
    } else {
      console.log("ERROR:", err.message);
    }
  }
}

testSecurity();
