# Full billing sweep runner - creates accounts, opens Stripe checkout, verifies tiers
param(
  [string]$BaseUrl = "https://dripn-server.onrender.com",
  [string]$ResultsFile = "scripts/sweep-results.json"
)

$ErrorActionPreference = "Continue"
$results = @()

function New-Account {
  $ts = Get-Date -Format "yyyyMMddHHmmss"
  $email = "dripn-sweep-$ts@test.dripn.local"
  $reg = Invoke-RestMethod -Uri "$BaseUrl/api/auth/register" -Method POST -Body (@{
    email = $email; password = "SweepTest123!"; displayName = "Sweep"
  } | ConvertTo-Json) -ContentType "application/json"
  return @{ email = $email; token = $reg.token; userId = $reg.user.id }
}

function H($token) { @{ Authorization = "Bearer $token" } }

function Verify-Tier($token, $expectedPlan) {
  $me = Invoke-RestMethod -Uri "$BaseUrl/api/auth/me" -Headers (H $token)
  $status = Invoke-RestMethod -Uri "$BaseUrl/api/subscription/status" -Headers (H $token)
  $verify = Invoke-RestMethod -Uri "$BaseUrl/api/subscription/verify" -Method POST -Headers (H $token)
  $planMatch = ($status.plan -eq $expectedPlan) -and ($verify.plan -eq $expectedPlan)
  $active = $status.active -and $verify.active
  return @{
    meTier = $me.subscriptionTier
    statusPlan = $status.plan
    verifyPlan = $verify.plan
    active = $active
    stripeSubId = $status.stripeSubscriptionId
    pass = $planMatch -and $active
  }
}

function Run-SubTest($plan, $label) {
  $acc = New-Account
  $checkoutOk = $false
  $checkoutUrl = $null
  $sessionId = $null
  try {
    $c = Invoke-RestMethod -Uri "$BaseUrl/api/subscription/create-checkout" -Method POST -Body (@{
      plan = $plan; billingCycle = "monthly"
    } | ConvertTo-Json) -ContentType "application/json" -Headers (H $acc.token)
    $checkoutOk = [bool]$c.checkoutUrl
    $checkoutUrl = $c.checkoutUrl
    $sessionId = $c.sessionId
  } catch { }
  @{ account = $acc; plan = $plan; label = $label; type = "subscription"; checkoutOk = $checkoutOk; checkoutUrl = $checkoutUrl; sessionId = $sessionId } | ConvertTo-Json -Depth 5 | Set-Content "scripts/sweep-pending.json"
  return @{ label = $label; plan = $plan; checkout = $checkoutOk; account = $acc.email; sessionId = $sessionId }
}

function Run-OneTimeTest($plan, $label) {
  $acc = New-Account
  $checkoutOk = $false
  $checkoutUrl = $null
  $sessionId = $null
  try {
    $c = Invoke-RestMethod -Uri "$BaseUrl/api/billing/checkout" -Method POST -Body (@{ plan = $plan } | ConvertTo-Json) -ContentType "application/json" -Headers (H $acc.token)
    $checkoutOk = [bool]$c.checkoutUrl
    $checkoutUrl = $c.checkoutUrl
    $sessionId = $c.sessionId
  } catch { }
  @{ account = $acc; plan = $plan; label = $label; type = "one_time"; checkoutOk = $checkoutOk; checkoutUrl = $checkoutUrl; sessionId = $sessionId } | ConvertTo-Json -Depth 5 | Set-Content "scripts/sweep-pending.json"
  return @{ label = $label; plan = $plan; checkout = $checkoutOk; account = $acc.email; sessionId = $sessionId }
}

function Complete-Pending($paymentOk, $redirectOk) {
  $pending = Get-Content "scripts/sweep-pending.json" | ConvertFrom-Json
  $v = Verify-Tier $pending.account.token $pending.plan
  $row = @{
    plan = $pending.label
    checkout = if ($pending.checkoutOk) { "PASS" } else { "FAIL" }
    payment = if ($paymentOk) { "PASS" } else { "FAIL" }
    redirect = if ($redirectOk) { "PASS" } else { "FAIL" }
    tierUnlock = if ($v.pass) { "PASS" } else { "FAIL" }
    notes = "me=$($v.meTier) status=$($v.statusPlan) verify=$($v.verifyPlan) sub=$($v.stripeSubId)"
  }
  if (Test-Path $ResultsFile) { $existing = Get-Content $ResultsFile | ConvertFrom-Json } else { $existing = @() }
  $existing += $row
  $existing | ConvertTo-Json -Depth 5 | Set-Content $ResultsFile
  return $row
}

Export-ModuleMember -Function * -ErrorAction SilentlyContinue
