# Kane execution record

The first run on November 24, 2026 used Kane CLI 0.10.8 and the local store. The wrapper invoked the normal checkout objective and stopped at the authorization requirement.

| Field | Observed value |
| --- | --- |
| Started (UTC) | `2026-11-24T01:43:31.571Z` |
| First flow | `happy` |
| CLI exit code | `1` |
| Kane `run_end` event | Absent |
| Wrapper status / exit code | `blocked` / `2` |
| Repair decisions | 0 |

CLI stderr:

```text
Not authenticated. Run: kane-cli login --oauth, or kane-cli login --username <user> --access-key <key>
```

Kane produced no browser verdict. Use the [authenticated setup](../README.md#run-the-kane-loop) to run the full suite. Each new run writes its own timestamped directory here. Generated results and evidence stay local so the maintainer can review them before sharing.
