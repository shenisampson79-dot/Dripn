# Verify billing tier for sweep test account
param(
  [string]$Email,
  [string]$Password = "SweepTest123!",
  [string]$ExpectedPlan,
  [string]$BaseUrl = "https://dripn-server.onrender.com"
)

$login = Invoke-RestMethod -Uri "$BaseUrl/api/auth/login" -Method POST -Body (@{email=$Email; password=$Password} | ConvertTo-Json) -ContentType "application/json"
$headers = @{ Authorization = "Bearer $($login.token)" }
$status = Invoke-RestMethod -Uri "$BaseUrl/api/subscription/status" -Headers $headers
$verify = Invoke-RestMethod -Uri "$BaseUrl/api/subscription/verify" -Method POST -Headers $headers
$tier = $status.subscription.tier
$verifyTier = $verify.tier
$active = $status.subscription.isActive -and $verify.verified
$pass = ($tier -eq $ExpectedPlan) -and ($verifyTier -eq $ExpectedPlan) -and $active
@{
  email = $Email
  expected = $ExpectedPlan
  loginTier = $login.user.subscriptionTier
  statusTier = $tier
  verifyTier = $verifyTier
  active = $active
  stripeSubId = $verify.stripeSubscriptionId
  pass = $pass
} | ConvertTo-Json
