Set-Location c:\RemindMeWhy
$base = "chore/mobile-upload-and-safe-area-deps"
$ErrorActionPreference = "Stop"

# Save current working-tree versions of modified files
$appTsx     = Get-Content App.tsx -Raw
$appJson    = Get-Content app.json -Raw
$backendPy  = Get-Content backend/main.py -Raw
$pkgJson    = Get-Content package.json -Raw
$pkgLock    = Get-Content package-lock.json -Raw

function Reset-To-Base {
    git checkout $base
    git restore .
}

function Commit-And-Push {
    param($branch, $message)
    git checkout -b $branch
    git add -A
    git commit -m $message
    git push origin $branch
    Write-Host "✅  Pushed: $branch"
    Reset-To-Base
}

# ── PR 1: Dependency additions ────────────────────────────────────────────────
Reset-To-Base
Set-Content package.json $pkgJson -NoNewline
Set-Content package-lock.json $pkgLock -NoNewline
Commit-And-Push `
    "chore/add-media-notifications-asyncstorage-deps" `
    "chore: add expo-media-library, expo-notifications, and async-storage deps"

# ── PR 2: Fix app.json malformed iOS config ───────────────────────────────────
Reset-To-Base
Set-Content app.json $appJson -NoNewline
Commit-And-Push `
    "fix/app-json-ios-infoplist-config" `
    "fix(app.json): consolidate duplicate iOS block and add infoPlist permissions"

# ── PR 3: Backend – JSON body, stricter prompt, updated model ─────────────────
Reset-To-Base
Set-Content backend/main.py $backendPy -NoNewline
Commit-And-Push `
    "refactor/backend-json-body-stricter-prompt" `
    "refactor(backend): accept JSON body, tighten system prompt, update model name"

# ── PR 4: App.tsx – MediaLibrary, persistence, scheduled notifications ─────────
# Stage the full new App.tsx but with the handler missing shouldShowBanner/List
# (that deliberate incomplete version lets PR 5 be the isolated fix)
$appTsxWithoutFix = $appTsx -replace `
    "(shouldSetBadge: false,)\r?\n\s+shouldShowBanner: true,\r?\n\s+shouldShowList: true,", `
    '$1'
Reset-To-Base
Set-Content App.tsx $appTsxWithoutFix -NoNewline
Commit-And-Push `
    "feat/media-library-persistence-notifications" `
    "feat(App): replace ImagePicker with MediaLibrary, add AsyncStorage persistence and scheduled push notifications"

# ── PR 5: Fix NotificationBehavior type – add shouldShowBanner/shouldShowList ──
git checkout "feat/media-library-persistence-notifications"
git pull origin "feat/media-library-persistence-notifications"
Set-Content App.tsx $appTsx -NoNewline
git add App.tsx
git commit -m "fix(notifications): add shouldShowBanner and shouldShowList to satisfy NotificationBehavior type"
git push origin "feat/media-library-persistence-notifications"
git checkout -b "fix/notification-behavior-missing-fields"
# reset to same state as feat branch then cherry the fix
git reset --soft HEAD~1
# No — easier: branch off feat branch, the fix commit is already at HEAD
# Re-approach: branch directly from the feat branch, re-apply just the fix
git checkout "feat/media-library-persistence-notifications"
$lastCommit = git rev-parse HEAD
git checkout $base
git checkout -b "fix/notification-behavior-missing-fields" $lastCommit
Set-Content App.tsx $appTsx -NoNewline
git add App.tsx
git commit -m "fix(notifications): add shouldShowBanner and shouldShowList to satisfy NotificationBehavior type"
git push origin "fix/notification-behavior-missing-fields"
Write-Host "✅  Pushed: fix/notification-behavior-missing-fields"

git checkout $base
Write-Host ""
Write-Host "All 5 branches pushed. Open PRs at:"
Write-Host "https://github.com/ridmii/RemindMeWhy/compare"
