param([String] $inputFile)

$url = "http://localhost:7000"

$body = Get-Content -Path $inputFile -Raw

$resp = Invoke-RestMethod -Uri $url -UseBasicParsing -Method POST -ContentType "text/plain" -Body $body
#$resp
$resp | Where-Object {$_.PSObject.Properties['result']}
