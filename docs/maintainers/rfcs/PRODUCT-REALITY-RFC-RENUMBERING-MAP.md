# RFC renumbering — old → new

The implementation order below supersedes the original category-grouped numbering in the **proposal package only**. Existing RFCs 0001–0028 are unchanged. Use the **new filename and RFC number together** in any GitHub PR, implementation ticket or documentation.

| Previous RFC | New RFC  | Title / purpose                                   |
| ------------ | -------- | ------------------------------------------------- |
| **0046**     | **0029** | Commercial gates and product sequencing           |
| **0029**     | **0030** | Product Reality Engine architecture               |
| **0045**     | **0031** | Security, tenancy and operating constraints       |
| **0036**     | **0032** | Connector contracts and health                    |
| **0030**     | **0033** | Replayable source and change observations         |
| **0031**     | **0034** | Versioned product facts and source authority      |
| **0032**     | **0035** | Customer-facing assets and extracted claims       |
| **0033**     | **0036** | Deterministic impact analysis                     |
| **0034**     | **0037** | Work plans, exact approval and execution          |
| **0035**     | **0038** | Independent verification and outcomes             |
| **0043**     | **0039** | Reviewer workbench and source evidence            |
| **0038**     | **0040** | Relay Sync: commercially valuable accuracy checks |
| **0044**     | **0041** | Versioned API and MCP access                      |
| **0039**     | **0042** | Relay Launch: coordinated releases                |
| **0037**     | **0043** | Protect journey monitoring expansion              |
| **0040**     | **0044** | Conversion and revenue integrity                  |
| **0041**     | **0045** | Activation and support signals                    |
| **0042**     | **0046** | Sales and partner content integrity               |

## Rule for migrating references

- Update both the number **and the Markdown link target**, not only the displayed ID.
- Ranges from the old category order do not generally describe contiguous implementation dependencies. The new metadata headers explicitly name producers where needed.
- Preserve external historical links to **original RFCs 0001–0028**.
- Apply this renumbering only to the proposed files. It does not assert those files already exist on GitHub or that implementation has begun.
