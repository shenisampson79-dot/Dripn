# Billing sweep helper - outputs JSON results, no secrets in stdout
param(
  [string]$BaseUrl = "https://dripn-server.onrender.com"
)

function New-TestAccount {
  $ts = Get-Date -Format "yyyyMMddHHmmss"
  $email = "dripn-sweep-$ts@test.dripn.local"
  $reg = Invoke-RestMethod -Uri "$BaseUrl/api/auth/register" -Method POST -Body (@{
    email = $email; password = "SweepTest123!"; displayName = "Sweep"
  } | ConvertTo-Json) -ContentType "application/json"
  return @{ email = $email; token = $reg.token; userId = $reg.user.id }
}

function Get-AuthHeaders($token) {
  return @{ Authorization = "Bearer $token" }
}

function Create-SubCheckout($token, $plan) {
  return Invoke-RestMethod -Uri "$BaseUrl/api/subscription/create-checkout" -Method POST -Body (@{
    plan = $plan; billingCycle = "monthly"
  } | ConvertTo-Json) -ContentType "application/json" -Headers (Get-AuthHeaders $token)
}

function Create-OneTimeCheckout($token, $plan) {
  return Invoke-RestMethod -Uri "$BaseUrl/api/billing/checkout" -Method POST -Body (@{
    plan = $plan
  } | ConvertTo-Json) -ContentType "application/json" -Headers (Get-AuthHeaders $token)
}

function Get-Me($token) {
  return Invoke-RestMethod -Uri "$BaseUrl/api/auth/me" -Method GET -Headers (Get-AuthHeaders $token)
}

function Get-SubStatus($token) {
  return Invoke-RestMethod -Uri "$BaseUrl/api/subscription/status" -Method GET -Headers (Get-AuthHeaders $token)
}

function Verify-Sub($token) {
  return Invoke-RestMethod -Uri "$BaseUrl/api/subscription/verify" -Method POST -Headers (Get-AuthHeaders $token)
}

function Trigger-Success($sessionId) {
  try {
    $resp = Invoke-WebRequest -Uri "$BaseUrl/api/checkout/success?session_id=$sessionId" -Method GET -MaximumRedirection 0 -UseBasicParsing -ErrorAction Stop
    return @{ status = $resp.StatusCode; location = $resp.Headers.Location }
  } catch {
    $r = $_.Exception.Response
    if ($r) {
      return @{ status = [int]$r.StatusCode; location = $r.Headers["Location"] }
    }
    return @{ status = "error"; message = $_.Exception.Message }
  }
}

function Verify-TierUnlock($token, $expectedPlan) {
  $me = Get-Me $token
  $status = Get-SubStatus $token
  $verify = Verify-Sub $token
  $tierOk = ($me.subscriptionTier -eq $expectedPlan) -or (
    $expectedPlan -in @('core_wardrobe','outfit_setup') -and $me.subscriptionTier -ne 'free'
  )
  $planOk = ($status.plan -eq $expectedPlan) -or ($verify.plan -eq $expectedPlan)
  return @{
    meTier = $me.subscriptionTier
    statusPlan = $status.plan
    statusActive = $status.active
    verifyPlan = $verify.plan
    verifyActive = $verify.active
    stripeSubId = $status.stripeSubscriptionId
    stripeCustId = $status.stripeCustomerId
    tierOk = $tierOk
    planOk = $planOk
    pass = $tierOk -and $planOk -and ($status.active -or $verify.active)
  }
}

# Export functions for interactive use
Export-ModuleMember -Function * -ErrorAction SilentlyContinue
