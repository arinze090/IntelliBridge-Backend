import { execSync } from 'child_process';

const URL = 'http://localhost:4000/api';

const run = () => {
  try {
    // 1. Create user
    console.log("=== 1. Signup ===");
    const timestamp = Date.now();
    const signupPayload = {
      fullname: "Test User",
      email: `test_${timestamp}@example.com`,
      username: `tuser_${timestamp}`,
      password: "Password123!"
    };
    
    const signupRes = JSON.parse(execSync(`curl -s -X POST ${URL}/auth/signup -H "Content-Type: application/json" -d '${JSON.stringify(signupPayload)}'`).toString());
    console.log(signupRes);

    // 2. Login
    console.log("=== 2. Login ===");
    const loginRes = JSON.parse(execSync(`curl -s -X POST ${URL}/auth/login -H "Content-Type: application/json" -d '{"email": "${signupPayload.email}", "password": "Password123!"}'`).toString());
    console.log(loginRes);

    const token = loginRes.token;

    // 3. Deactivate
    console.log("=== 3. Deactivate ===");
    const deactivateRes = JSON.parse(execSync(`curl -s -X POST ${URL}/auth/deactivate -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" -d '{"password": "Password123!"}'`).toString());
    console.log(deactivateRes);

    // 4. Try Login again
    console.log("=== 4. Try Login again ===");
    const loginAgainRes = JSON.parse(execSync(`curl -s -X POST ${URL}/auth/login -H "Content-Type: application/json" -d '{"email": "${signupPayload.email}", "password": "Password123!"}'`).toString());
    console.log(loginAgainRes);
    
    // 5. Signup again with same email
    console.log("=== 5. Signup again with same email ===");
    const signupAgainPayload = {
      fullname: "Test User 2",
      email: signupPayload.email,
      username: `tuser2_${timestamp}`,
      password: "Password123!"
    };
    
    const signupAgainRes = JSON.parse(execSync(`curl -s -X POST ${URL}/auth/signup -H "Content-Type: application/json" -d '${JSON.stringify(signupAgainPayload)}'`).toString());
    console.log(signupAgainRes);

  } catch(e) {
    console.error(e.message);
    if(e.stdout) console.error(e.stdout.toString());
  }
}

run();
