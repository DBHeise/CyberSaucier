[CmdletBinding()]
param(
    # The Folder containing all the json recipes
    [Parameter(Mandatory=$true)][String] $RuleFolder,
    [String] $CyberSaucierURL = "http://localhost:7000"    
    )

Get-ChildItem -Path $RuleFolder -Recurse -File -Include ("*.json") | ForEach-Object {
    $file = $_.FullName

    $rule = Get-Content -Path $file -Raw | ConvertFrom-Json

    $url = $CyberSaucierURL + "/" + $rule.name

    if ($rule.verify -ne $null) {
        $resp = Invoke-RestMethod -Method Post -UseBasicParsing -Uri $url -ContentType "text/plain" -body $rule.verify.originalInput
        
        if ($resp.result -eq $rule.verify.expectedOutput) {
            Write-Host -Object ($rule.name + " : PASS") -ForegroundColor Green -BackgroundColor Black            
        } else {
            Write-Host -Object ($rule.name + " : FAIL" + [Environment]::NewLine +
                ('Actual   = "' + $resp.result + '"') + [Environment]::NewLine +
                ('Expected = "' + $rule.verify.expectedOutput + '"')
            ) -ForegroundColor Red -BackgroundColor Black   
            Write-Verbose ($resp | ConvertTo-Json)         
        }
    }
}