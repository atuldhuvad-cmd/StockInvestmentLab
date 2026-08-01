# Settings Code Mapping

| Rule | Production source | Evidence |
|---|---|---|
| SET-01 | `js/data-model.js`, `emptyState().settings` | Executed defaults and reset tests |
| SET-02 | `js/data-model.js`, `getSetting` / `getAllSettings` | Executed known/unknown key tests |
| SET-03 | `js/data-model.js`, `replaceAll` / `reset` | Executed replacement and restoration tests |
| SET-04 | `js/modules/settings.js`, `render` | Executed against a minimal container fake |

No production extraction or behavior change was required.
