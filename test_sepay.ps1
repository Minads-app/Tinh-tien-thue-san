# Tự động lấy API Key từ file .env
$envFile = Get-Content .env
$apiKeyLine = $envFile | Select-String "SEPAY_API_KEY="
$apiKey = ($apiKeyLine -split "=")[1].Trim().Trim("'").Trim('"')

# Cấu hình dữ liệu giả lập
$uri = "http://localhost:8888/.netlify/functions/sepay-webhook"
$headers = @{
    "Authorization" = "Apikey $apiKey"
    "Content-Type"  = "application/json"
}

# Nội dung giao dịch giả (HBA-YYYYMMDD-XXXX)
$body = @{
    id = 999999
    content = "HBA-20240410-0001"
    transferAmount = 50000
    transactionContent = "HBA-20240410-0001 thanh toan san"
    referenceCode = "FAKE_TRANSACTION_001"
} | ConvertTo-Json

Write-Host "--- Dang gui giao dich gia toi Webhook Local ---" -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri $uri -Method Post -Headers $headers -Body $body
    Write-Host "Ket qua tu Server:" -ForegroundColor Green
    $response | ConvertTo-Json
} catch {
    Write-Host "Loi khi gui Webhook: $($_.Exception.Message)" -ForegroundColor Red
}
