# test-registration.ps1
# Run to verify backend registration test cases.

$BASE = "http://localhost:3001/api"

function Post($path, $body) {
  try {
    $r = Invoke-WebRequest -Uri "$BASE$path" -Method POST -ContentType "application/json" -Body ($body | ConvertTo-Json) -UseBasicParsing
    return [PSCustomObject]@{ Code = $r.StatusCode; Body = $r.Content | ConvertFrom-Json }
  } catch {
    $code = $_.Exception.Response.StatusCode.Value__
    $rawMsg = $_.ErrorDetails.Message
    $bodyObj = if ($rawMsg) { $rawMsg | ConvertFrom-Json } else { @{ error = $_.Exception.Message } }
    return [PSCustomObject]@{ Code = $code; Body = $bodyObj }
  }
}

Write-Host "`n===== PLAWMINARY Registration Test Suite =====" -ForegroundColor Cyan

# Cleanup existing test user if present
$null = Post "/auth/register" @{}

# Test 3: Valid new registration (using unique ID for clean run if needed)
$testId = "2024-TEST-REG-" + (Get-Random -Minimum 1000 -Maximum 9999)
$testEmail = "student$testId@plsp.edu.ph"

$r = Post "/auth/register" @{ studentId=$testId; fullName="Julius Test"; email=$testEmail; password="SecurePass123"; confirmPassword="SecurePass123" }
Write-Host "`n[TEST 3] Valid registration ($testId): $($r.Code) => $($r.Body | ConvertTo-Json -Compress)" -ForegroundColor $(if ($r.Code -eq 201) {"Green"} else {"Red"})

# Test 4: Login with newly registered account
$r = Post "/auth/login" @{ studentId=$testId; password="SecurePass123" }
Write-Host "[TEST 4] New student login ($testId): $($r.Code) => $($r.Body | ConvertTo-Json -Compress)" -ForegroundColor $(if ($r.Code -eq 200) {"Green"} else {"Red"})

# Test 5: Duplicate Student ID
$r = Post "/auth/register" @{ studentId=$testId; fullName="Another"; email="other@test.com"; password="SecurePass123"; confirmPassword="SecurePass123" }
Write-Host "[TEST 5] Duplicate ID: $($r.Code) => $($r.Body | ConvertTo-Json -Compress)" -ForegroundColor $(if ($r.Code -eq 409) {"Green"} else {"Red"})

# Test 6: Duplicate email
$r = Post "/auth/register" @{ studentId="2024-DIFF-ID"; fullName="Another"; email=$testEmail; password="SecurePass123"; confirmPassword="SecurePass123" }
Write-Host "[TEST 6] Duplicate email: $($r.Code) => $($r.Body | ConvertTo-Json -Compress)" -ForegroundColor $(if ($r.Code -eq 409) {"Green"} else {"Red"})

# Test 7: Invalid email
$r = Post "/auth/register" @{ studentId="2024-INVALID-MAIL"; fullName="Bad Email"; email="notanemail"; password="SecurePass123"; confirmPassword="SecurePass123" }
Write-Host "[TEST 7] Invalid email: $($r.Code) => $($r.Body | ConvertTo-Json -Compress)" -ForegroundColor $(if ($r.Code -eq 400) {"Green"} else {"Red"})

# Test 8: Password mismatch
$r = Post "/auth/register" @{ studentId="2024-MISMATCH"; fullName="Mismatch"; email="mismatch@test.com"; password="SecurePass123"; confirmPassword="WrongPass999" }
Write-Host "[TEST 8] Password mismatch: $($r.Code) => $($r.Body | ConvertTo-Json -Compress)" -ForegroundColor $(if ($r.Code -eq 400) {"Green"} else {"Red"})

# Test 9: Empty fields
$r = Post "/auth/register" @{ studentId=""; fullName=""; email=""; password=""; confirmPassword="" }
Write-Host "[TEST 9] Empty fields: $($r.Code) => $($r.Body | ConvertTo-Json -Compress)" -ForegroundColor $(if ($r.Code -eq 400) {"Green"} else {"Red"})

# Test 1: Existing student login check
$r = Post "/auth/login" @{ studentId="2023-0001"; password="plsp1234" }
Write-Host "[TEST 1] Existing Student login (2023-0001): $($r.Code) => $($r.Body | ConvertTo-Json -Compress)" -ForegroundColor $(if ($r.Code -eq 200) {"Green"} else {"Red"})

# Test 2 & 10: Existing admin login check
$r = Post "/auth/login" @{ studentId="admin"; password="admin" }
Write-Host "[TEST 2 & 10] Existing Admin login (admin): $($r.Code) => $($r.Body | ConvertTo-Json -Compress)" -ForegroundColor $(if ($r.Code -eq 200) {"Green"} else {"Red"})

Write-Host "`n===== Done =====`n" -ForegroundColor Cyan
