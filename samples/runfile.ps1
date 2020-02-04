[CmdletBinding()]
param(
    [String] $inputFile,
    [String] $url = "http://localhost:7000",
    [Switch] $EachLine
    )


if ($EachLine) {
    Get-Content -Path $inputFile | ForEach-Object {
        $resp = Invoke-RestMethod -Uri $url -UseBasicParsing -Method POST -ContentType "text/plain" -Body $_
        $resp | Where-Object {$_.PSObject.Properties['result']}
    }
} else {
    $body = Get-Content -Path $inputFile -Raw
    $resp = Invoke-RestMethod -Uri $url -UseBasicParsing -Method POST -ContentType "text/plain" -Body $body
    $resp | Where-Object {$_.PSObject.Properties['result']}
}

