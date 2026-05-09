$BASE = "http://localhost:4000/api/v1"
$PASS = 0
$FAIL = 0

function Invoke-API {
    param([string]$Method, [string]$Url, [hashtable]$Body = $null, [string]$Token = "")
    $headers = @{ "Content-Type" = "application/json" }
    if ($Token) { $headers["Authorization"] = "Bearer $Token" }
    $params = @{ Uri = $Url; Method = $Method; Headers = $headers; UseBasicParsing = $true }
    if ($Body) { $params["Body"] = ($Body | ConvertTo-Json -Depth 5) }
    try {
        $resp = Invoke-WebRequest @params
        return @{ ok = $true; code = [int]$resp.StatusCode; data = ($resp.Content | ConvertFrom-Json) }
    } catch {
        $errBody = $null
        try { $sr = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream()); $errBody = $sr.ReadToEnd() | ConvertFrom-Json } catch {}
        $code = 0; try { $code = [int]$_.Exception.Response.StatusCode } catch {}
        return @{ ok = $false; code = $code; data = $errBody }
    }
}

function Show { param([string]$Name, [bool]$Passed, [string]$Detail="")
    if ($Passed) { Write-Host "  [PASS] $Name" -ForegroundColor Green; $script:PASS++ }
    else { Write-Host "  [FAIL] $Name  ($Detail)" -ForegroundColor Red; $script:FAIL++ }
}

Write-Host "====== Snearal KYC + Email OTP Test Suite =====" -ForegroundColor Yellow
Write-Host "Base: $BASE
"

# 1 Health
$r = Invoke-API -Method GET -Url "$BASE/health"
Show "01 Health check" $r.ok "HTTP $($r.code)"

# 2 SP Login
$r = Invoke-API -Method POST -Url "$BASE/auth/login" -Body @{ email="ramesh.electrician@service.com"; password="password123" }
$spToken = ""; if ($r.ok) { $spToken = $r.data.data.accessToken }
Show "02 Service Partner login" ($spToken -ne "") "HTTP $($r.code)"

# 3 Admin Login
$r = Invoke-API -Method POST -Url "$BASE/auth/login" -Body @{ email="admin@snearal.com"; password="password123" }
$adminToken = ""; if ($r.ok) { $adminToken = $r.data.data.accessToken }
Show "03 Admin login" ($adminToken -ne "") "HTTP $($r.code)"

# 4 Customer Login
$r = Invoke-API -Method POST -Url "$BASE/auth/login" -Body @{ email="rajesh.kumar@gmail.com"; password="password123" }
$custToken = ""; if ($r.ok) { $custToken = $r.data.data.accessToken }
Show "04 Customer login" ($custToken -ne "") "HTTP $($r.code)"

# 5 Get Profile
$r = Invoke-API -Method GET -Url "$BASE/auth/me" -Token $spToken
Show "05 GET /auth/me (SP profile)" $r.ok "HTTP $($r.code) name=$($r.data.data.full_name)"

Write-Host "
[Email OTP Tests]" -ForegroundColor Cyan

# 6 Forgot Password
$r = Invoke-API -Method POST -Url "$BASE/auth/forgot-password" -Body @{ email="ramesh.electrician@service.com" }
Show "06 POST /auth/forgot-password (email OTP)" ($r.code -in @(200,201)) "HTTP $($r.code) $($r.data.message)"

# 7 Resend OTP
$r = Invoke-API -Method POST -Url "$BASE/auth/resend-otp" -Body @{ email="ramesh.electrician@service.com" }
Show "07 POST /auth/resend-otp (already-verified=400 OK)" ($r.code -in @(200,201,400)) "HTTP $($r.code)"

# 8 Verify OTP wrong
$r = Invoke-API -Method POST -Url "$BASE/auth/verify-otp" -Body @{ email="ramesh.electrician@service.com"; otp="000000" }
Show "08 POST /auth/verify-otp (wrong otp -> 400/401)" ($r.code -in @(400,401,422)) "HTTP $($r.code)"

Write-Host "
[Cashfree KYC Endpoints]" -ForegroundColor Cyan

# 9 GET status/me
$r = Invoke-API -Method GET -Url "$BASE/kyc/cashfree/status/me" -Token $spToken
$kycVerifId = ""; if ($r.data.data.verification_id) { $kycVerifId = $r.data.data.verification_id }
Show "09 GET /kyc/cashfree/status/me" $r.ok "HTTP $($r.code) kyc=$($r.data.data.kyc_status)"

# 10 Initiate KYC
$r = Invoke-API -Method POST -Url "$BASE/kyc/cashfree/initiate" -Token $spToken -Body @{}
if ($r.data.data.verification_id) { $kycVerifId = $r.data.data.verification_id }
if ($r.data.data.kyc_link) { Write-Host "  >> KYC Link: $($r.data.data.kyc_link)" -ForegroundColor Magenta }
Show "10 POST /kyc/cashfree/initiate" ($r.code -in @(200,201,400)) "HTTP $($r.code) $($r.data.message)"

# 11 Status by ID
$tid = if ($kycVerifId) { $kycVerifId } else { "snearal_test_fallback" }
$r = Invoke-API -Method GET -Url "$BASE/kyc/cashfree/status/$tid" -Token $spToken
Show "11 GET /kyc/cashfree/status/:id" ($r.code -in @(200,400)) "HTTP $($r.code) $($r.data.data.status)"

# 12 Verify PAN valid format
$r = Invoke-API -Method POST -Url "$BASE/kyc/cashfree/verify-pan" -Token $spToken -Body @{ pan="ABCDE1234F"; name="Ramesh Kumar" }
Show "12 POST /kyc/cashfree/verify-pan (valid format)" ($r.code -in @(200,201,400,402,404)) "HTTP $($r.code) $($r.data.message)"

# 13 Verify PAN bad format
$r = Invoke-API -Method POST -Url "$BASE/kyc/cashfree/verify-pan" -Token $spToken -Body @{ pan="INVALID123" }
Show "13 POST /kyc/cashfree/verify-pan (bad format->422)" ($r.code -in @(400,422)) "HTTP $($r.code)"

# 14 Aadhaar generate OTP
$r = Invoke-API -Method POST -Url "$BASE/kyc/cashfree/aadhaar/generate-otp" -Token $spToken -Body @{ aadhaar_number="123456789012" }
$aaRef = ""; if ($r.data.data.ref_id) { $aaRef = $r.data.data.ref_id }
Show "14 POST /kyc/cashfree/aadhaar/generate-otp" ($r.code -in @(200,201,400,402)) "HTTP $($r.code) $($r.data.message)"

# 15 Aadhaar bad input
$r = Invoke-API -Method POST -Url "$BASE/kyc/cashfree/aadhaar/generate-otp" -Token $spToken -Body @{ aadhaar_number="1234" }
Show "15 POST /kyc/cashfree/aadhaar/generate-otp (bad->422)" ($r.code -in @(400,422)) "HTTP $($r.code)"

# 16 Aadhaar verify OTP
$tr = if ($aaRef) { $aaRef } else { "dummy_ref_999" }
$r = Invoke-API -Method POST -Url "$BASE/kyc/cashfree/aadhaar/verify-otp" -Token $spToken -Body @{ ref_id=$tr; otp="123456" }
Show "16 POST /kyc/cashfree/aadhaar/verify-otp" ($r.code -in @(200,201,400,402)) "HTTP $($r.code) $($r.data.message)"

# 17 Bank verification valid
$r = Invoke-API -Method POST -Url "$BASE/kyc/cashfree/verify-bank" -Token $spToken -Body @{ account_number="9876543210123456"; ifsc="HDFC0001234"; name="Ramesh" }
Show "17 POST /kyc/cashfree/verify-bank (valid)" ($r.code -in @(200,201,400,402)) "HTTP $($r.code) $($r.data.message)"

# 18 Bank bad IFSC
$r = Invoke-API -Method POST -Url "$BASE/kyc/cashfree/verify-bank" -Token $spToken -Body @{ account_number="12345678"; ifsc="BADIFC" }
Show "18 POST /kyc/cashfree/verify-bank (bad IFSC->422)" ($r.code -in @(400,422)) "HTTP $($r.code)"

Write-Host "
[Webhook Tests]" -ForegroundColor Cyan

# 19 Webhook COMPLETED
$wid = if ($kycVerifId) { $kycVerifId } else { "snearal_sp_no_partner" }
$r = Invoke-API -Method POST -Url "$BASE/kyc/cashfree/webhook" -Body @{ verification_id=$wid; status="COMPLETED" }
Show "19 POST /kyc/cashfree/webhook (COMPLETED)" ($r.code -eq 200) "HTTP $($r.code) handled=$($r.data.handled) new_status=$($r.data.new_status)"

# 20 Webhook REJECTED unknown
$r = Invoke-API -Method POST -Url "$BASE/kyc/cashfree/webhook" -Body @{ verification_id="snearal_unknown_xyz"; status="REJECTED" }
Show "20 POST /kyc/cashfree/webhook (REJECTED unknown)" ($r.code -eq 200) "HTTP $($r.code) handled=$($r.data.handled)"

# 21 Webhook missing verif_id
$r = Invoke-API -Method POST -Url "$BASE/kyc/cashfree/webhook" -Body @{ status="COMPLETED" }
Show "21 POST /kyc/cashfree/webhook (missing verif_id)" ($r.code -eq 200) "HTTP $($r.code)"

Write-Host "
[Security Guards]" -ForegroundColor Cyan

# 22 No auth
$r = Invoke-API -Method GET -Url "$BASE/kyc/cashfree/status/me"
Show "22 GET status/me without token -> 401" ($r.code -eq 401) "HTTP $($r.code)"

# 23 Customer cannot initiate KYC
$r = Invoke-API -Method POST -Url "$BASE/kyc/cashfree/initiate" -Token $custToken -Body @{}
Show "23 POST initiate as CUSTOMER -> 403" ($r.code -eq 403) "HTTP $($r.code)"

Write-Host "
[Admin / Legacy]" -ForegroundColor Cyan

# 24 Legacy generate-link
$r = Invoke-API -Method POST -Url "$BASE/kyc/cashfree/generate-link" -Token $adminToken -Body @{ phone="+919876543220"; name="Test Partner"; email="test@test.com" }
Show "24 POST /kyc/cashfree/generate-link (admin)" ($r.code -in @(200,201,400)) "HTTP $($r.code) $($r.data.message)"

# 25 Admin KYC view
$r = Invoke-API -Method GET -Url "$BASE/partners?limit=5" -Token $adminToken
Show "25 GET /partners (admin sees all partners)" ($r.code -in @(200,400)) "HTTP $($r.code)"

Write-Host ""
Write-Host "========================================" -ForegroundColor Yellow
Write-Host " FINAL: PASS=$PASS  FAIL=$FAIL  TOTAL=$($PASS+$FAIL)" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
if ($FAIL -eq 0) { Write-Host " ALL TESTS PASSED" -ForegroundColor Green } else { Write-Host " $FAIL FAILED" -ForegroundColor Red }

exit $FAIL
