#!/bin/bash

# Base URL
URL="http://localhost:4000/api"

echo "=== 1. Login as Admin ==="
LOGIN_RES=$(curl -s -X POST $URL/auth/login -H "Content-Type: application/json" -d '{"email": "sarah@sky.net", "password": "securepassword123"}')
TOKEN=$(echo $LOGIN_RES | grep -o '"token":"[^"]*' | cut -d'"' -f4)
echo "Admin Token Acquired"
echo ""

echo "=== 2. Create Categories ==="
CAT_A_RES=$(curl -s -X POST $URL/categories \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Science Fiction", "description": "Sci-Fi books"}')
CAT_A_ID=$(echo $CAT_A_RES | grep -o '"_id":"[^"]*' | cut -d'"' -f4)
echo "Category A Created: $CAT_A_RES"

CAT_B_RES=$(curl -s -X POST $URL/categories \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Fantasy", "description": "Fantasy books"}')
CAT_B_ID=$(echo $CAT_B_RES | grep -o '"_id":"[^"]*' | cut -d'"' -f4)
echo "Category B Created: $CAT_B_RES"
echo ""

echo "=== 3. Get All Categories (Public) ==="
curl -s -X GET $URL/categories | grep -o '"name":"[^"]*' | cut -d'"' -f4
echo ""

echo "=== 4. Update Category B ==="
UPDATE_CAT_RES=$(curl -s -X PUT $URL/categories/$CAT_B_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "High Fantasy"}')
echo "Updated Category: $UPDATE_CAT_RES"
echo ""

echo "=== 5. Delete Category B ==="
DELETE_CAT_RES=$(curl -s -X DELETE $URL/categories/$CAT_B_ID \
  -H "Authorization: Bearer $TOKEN")
echo "Deleted Category: $DELETE_CAT_RES"
echo ""

echo "=== 6. Create Books ==="
BOOK_1_RES=$(curl -s -X POST $URL/books \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bookTitle": "Dune",
    "author": "Frank Herbert",
    "aboutAuthor": "He wrote Dune.",
    "description": "A book about sand.",
    "price": 15.99,
    "bookImage": "http://example.com/dune.jpg",
    "bookUrl": "http://example.com/dune.epub",
    "bookFormat": "EPUB",
    "category": "'$CAT_A_ID'"
  }')
BOOK_1_ID=$(echo $BOOK_1_RES | grep -o '"_id":"[^"]*' | cut -d'"' -f4)
echo "Book 1 Created: $BOOK_1_RES"

BOOK_2_RES=$(curl -s -X POST $URL/books \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bookTitle": "Neuromancer",
    "author": "William Gibson",
    "aboutAuthor": "Cyberpunk father.",
    "description": "A book about cyberspace.",
    "price": 12.50,
    "bookImage": "http://example.com/neuro.jpg",
    "bookUrl": "http://example.com/neuro.epub",
    "bookFormat": "EPUB",
    "category": "'$CAT_A_ID'"
  }')
BOOK_2_ID=$(echo $BOOK_2_RES | grep -o '"_id":"[^"]*' | cut -d'"' -f4)
echo "Book 2 Created: $BOOK_2_RES"
echo ""

echo "=== 7. Get All Books (Public) ==="
curl -s -X GET $URL/books | grep -o '"bookTitle":"[^"]*' | cut -d'"' -f4
echo ""

echo "=== 8. Get Book 1 ==="
curl -s -X GET $URL/books/$BOOK_1_ID | grep -o '"bookTitle":"Dune"'
echo ""

echo "=== 9. Update Book 1 ==="
UPDATE_BOOK_RES=$(curl -s -X PUT $URL/books/$BOOK_1_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"price": 19.99}')
echo "Updated Book Price to 19.99"
echo ""

echo "=== 10. Soft Delete Book 2 ==="
DELETE_BOOK_RES=$(curl -s -X DELETE $URL/books/$BOOK_2_ID \
  -H "Authorization: Bearer $TOKEN")
echo "Deleted Book: $DELETE_BOOK_RES"
echo ""

echo "=== 11. Get All Books (Public) - Expected: Only Dune ==="
curl -s -X GET $URL/books | grep -o '"bookTitle":"[^"]*' | cut -d'"' -f4
echo ""

echo "=== 12. Get All Books (Admin with includeDeleted=true) - Expected: Dune and Neuromancer ==="
curl -s -X GET "$URL/books?includeDeleted=true" -H "Authorization: Bearer $TOKEN" | grep -o '"bookTitle":"[^"]*' | cut -d'"' -f4
echo ""

echo "=== 13. Get Single Soft-Deleted Book (Public) - Expected: 404 ==="
curl -vs -X GET $URL/books/$BOOK_2_ID 2>&1 | grep "HTTP/"
echo ""

echo "=== 14. Get Single Soft-Deleted Book (Admin) - Expected: 200 ==="
curl -vs -X GET $URL/books/$BOOK_2_ID -H "Authorization: Bearer $TOKEN" 2>&1 | grep "HTTP/"
echo ""

echo "=== 15. Create User explicitly for Deactivation Test ==="
USER_RES=$(curl -s -X POST $URL/auth/signup -H "Content-Type: application/json" -d '{"fullname": "Test User", "email": "deactivateme@example.com", "username": "deactivatemetest", "password": "Password123!"}')
echo "User Created: $USER_RES"
echo ""

echo "=== 16. Login as Test User ==="
USER_LOGIN_RES=$(curl -s -X POST $URL/auth/login -H "Content-Type: application/json" -d '{"email": "deactivateme@example.com", "password": "Password123!"}')
USER_TOKEN=$(echo $USER_LOGIN_RES | grep -o '"token":"[^"]*' | cut -d'"' -f4)
echo "Test User Token Acquired"
echo ""

echo "=== 17. Deactivate Test User Account ==="
DEACTIVATE_RES=$(curl -s -X POST $URL/auth/deactivate \
  -H "Content-Type: application/json" \
  -d '{"email": "deactivateme@example.com", "password": "Password123!"}')
echo "Deactivate Result: $DEACTIVATE_RES"
echo ""

echo "=== 18. Attempt Login with Deactivated Account - Expected: 403 ==="
curl -vs -X POST $URL/auth/login -H "Content-Type: application/json" -d '{"email": "deactivateme@example.com", "password": "Password123!"}' 2>&1 | grep "HTTP/"
echo ""
