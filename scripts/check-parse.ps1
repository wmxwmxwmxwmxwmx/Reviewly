$path = $args[0]
$errors = $null
[void][System.Management.Automation.Language.Parser]::ParseFile($path, [ref]$null, [ref]$errors)
foreach ($err in $errors) {
    Write-Host "Line $($err.Extent.StartLineNumber): $($err.Message)"
}
