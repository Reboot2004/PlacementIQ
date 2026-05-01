param(
  [string]$RemoteUrl = "https://github.com/Reboot2004/PlacementIQ.git",
  [string]$Branch = "main",
  [string]$CommitMessage = "Build pitch-aligned PlacementIQ prototype"
)

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $RepoRoot

Write-Host "Repo root: $RepoRoot"
Write-Host "This will remove the existing .git folder and recreate Git history as the current Windows user."
$confirm = Read-Host "Type RESET to continue"
if ($confirm -ne "RESET") {
  Write-Host "Cancelled."
  exit 1
}

$gitDir = Join-Path $RepoRoot ".git"
if (Test-Path $gitDir) {
  Remove-Item -LiteralPath $gitDir -Recurse -Force
  Write-Host "Removed old .git folder."
}

git init
git branch -M $Branch
git add .
git commit -m $CommitMessage
git remote add origin $RemoteUrl

Write-Host ""
Write-Host "Done. Verify with:"
Write-Host "  git status"
Write-Host "  git remote -v"
Write-Host ""
Write-Host "When ready to publish, run:"
Write-Host "  git push -u origin $Branch"
